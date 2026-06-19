// 시세/환율을 1회 수집하여 Supabase에 적재한다.
// GitHub Actions cron에서 호출되거나 로컬에서 수동 실행 가능.
// 필요한 환경변수:
//   SUPABASE_URL          예: https://xxxxx.supabase.co
//   SUPABASE_SERVICE_KEY  서비스 롤 키 (Service Role Key)

import { fetchPricesFromSources } from "../lib/prices.js";

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "환경변수 누락: SUPABASE_URL, SUPABASE_SERVICE_KEY 모두 필요합니다."
  );
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// JWT issued at future 같은 일시적 시간 sync 이슈 대비 — 최대 3회 retry (2초 간격)
async function insertRowsWithRetry(table, rows, attempt = 1) {
  if (!rows.length) {
    console.log(`[${table}] 적재할 행 없음`);
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer: "return=minimal"
    },
    body: JSON.stringify(rows)
  });

  if (res.ok) {
    console.log(`[${table}] ${rows.length}행 적재 완료${attempt > 1 ? ` (재시도 ${attempt - 1}회)` : ""}`);
    return;
  }

  const detail = await res.text();
  const isJwtTimeIssue = res.status === 401 && detail.includes("JWT issued at future");

  if (isJwtTimeIssue && attempt < 3) {
    console.log(`[${table}] JWT 시간 sync 이슈 — 2초 대기 후 재시도 (${attempt}/3)`);
    await sleep(2000);
    return insertRowsWithRetry(table, rows, attempt + 1);
  }

  throw new Error(`Supabase insert ${table} 실패: ${res.status} ${detail}`);
}

const insertRows = (table, rows) => insertRowsWithRetry(table, rows);

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`[수집 시작] ${startedAt}`);

  const data = await fetchPricesFromSources();

  const priceRows = Object.entries(data.prices)
    .filter(([, item]) => item.usd != null)
    .map(([symbol, item]) => ({
      symbol,
      usd_per_kg: item.usd,
      raw_value: item.raw,
      raw_unit: item.rawUnit,
      source: item.source
    }));

  const fxRows = Object.entries(data.exchangeRate)
    .filter(([, rate]) => rate != null)
    .map(([pair, rate]) => ({ pair, rate }));

  await Promise.all([
    insertRows("price_snapshots", priceRows),
    insertRows("fx_snapshots", fxRows)
  ]);

  console.log(`[수집 완료] ${data.fetchedAt}`);
}

main().catch((error) => {
  console.error("[수집 실패]", error);
  process.exit(1);
});
