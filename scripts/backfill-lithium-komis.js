// KOMIS(한국광해광업공단) 리튬 일별 가격을 Supabase에 적재.
// 데이터 소스: scripts/data/lithium-komis.json
// xlsx 원본은 사용자가 KOMIS에서 다운로드 후 Python으로 변환.
//
// 멱등성: 같은 source의 기존 행을 먼저 삭제 후 재적재.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("환경변수 누락: SUPABASE_URL, SUPABASE_SERVICE_KEY 모두 필요합니다.");
  process.exit(1);
}

const KOMIS_SOURCE = "KOMIS (광해광업공단)";
const CHUNK_SIZE = 500;

const here = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(here, "data", "lithium-komis.json");

async function clearPreviousKomis() {
  const url =
    `${SUPABASE_URL}/rest/v1/price_snapshots` +
    `?symbol=eq.Li&source=eq.${encodeURIComponent(KOMIS_SOURCE)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer: "return=minimal"
    }
  });
  if (!res.ok) {
    throw new Error(`기존 KOMIS 행 삭제 실패: ${res.status} ${await res.text()}`);
  }
  console.log(`[정리] Li + source='${KOMIS_SOURCE}' 행 삭제 완료`);
}

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
    throw new Error(`Supabase insert 실패: ${res.status} ${await res.text()}`);
  }
}

async function main() {
  const raw = await readFile(DATA_PATH, "utf-8");
  const points = JSON.parse(raw); // [["YYYY-MM-DD", price], ...]
  console.log(`[백필 시작] Lithium KOMIS, ${points.length}개 포인트`);

  await clearPreviousKomis();

  const rows = points.map(([date, price]) => ({
    symbol: "Li",
    usd_per_kg: Number(price),
    raw_value: Number(price),
    raw_unit: "USD/kg",
    source: KOMIS_SOURCE,
    collected_at: new Date(date + "T00:00:00Z").toISOString()
  }));

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    await insertChunk(chunk);
    console.log(`[적재] ${Math.min(i + CHUNK_SIZE, rows.length)}/${rows.length}`);
  }

  console.log(`[백필 완료] ${new Date().toISOString()}`);
}

main().catch((error) => {
  console.error("[백필 실패]", error);
  process.exit(1);
});
