// 1년치 LME 일별 시세를 네이버에서 수집해 Supabase에 적재한다.
// 사용:
//   - 로컬: .env 파일에 SUPABASE_URL, SUPABASE_SERVICE_KEY 설정 후 node scripts/backfill-naver.js
//   - GitHub Actions: workflow_dispatch로 backfill.yml 트리거
//
// 멱등성:
//   같은 (symbol, collected_at) 행이 이미 있어도 INSERT 됩니다 (중복 생길 수 있음).
//   1회성 작업이라 단순화. 재실행 시 사전에 테이블 비우는 걸 권장.

import { fetchAllNaverHistory, NAVER_LME_MAP } from "../lib/sources/naver-history.js";

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("환경변수 누락: SUPABASE_URL, SUPABASE_SERVICE_KEY 모두 필요합니다.");
  process.exit(1);
}

const CHUNK_SIZE = 500;

async function insertChunk(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/price_snapshots`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer: "return=minimal"
    },
    body: JSON.stringify(rows)
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Supabase insert 실패: ${res.status} ${detail}`);
  }
}

async function main() {
  console.log(`[백필 시작] ${new Date().toISOString()}`);
  console.log(`[대상] ${Object.keys(NAVER_LME_MAP).length}개 LME 금속`);

  const history = await fetchAllNaverHistory();

  const allRows = [];
  for (const [symbol, rows] of Object.entries(history)) {
    for (const { date, price } of rows) {
      allRows.push({
        symbol,
        usd_per_kg: Number((price / 1000).toFixed(4)), // USD/T → USD/kg
        raw_value: price,
        raw_unit: "USD/T",
        source: "Naver Finance (backfill)",
        collected_at: new Date(date + "T00:00:00Z").toISOString()
      });
    }
  }

  console.log(`[수집 완료] 총 ${allRows.length}행 → Supabase 적재 시작`);

  for (let i = 0; i < allRows.length; i += CHUNK_SIZE) {
    const chunk = allRows.slice(i, i + CHUNK_SIZE);
    await insertChunk(chunk);
    console.log(`[적재] ${Math.min(i + CHUNK_SIZE, allRows.length)}/${allRows.length}`);
  }

  console.log(`[백필 완료] ${new Date().toISOString()}`);
}

main().catch((error) => {
  console.error("[백필 실패]", error);
  process.exit(1);
});
