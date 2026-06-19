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

// 키 형식 진단 (보안: 첫 12자만 노출)
console.log("[DEBUG] SUPABASE_SERVICE_KEY prefix:", SUPABASE_SERVICE_KEY.substring(0, 12) + "...");
console.log("[DEBUG] SUPABASE_SERVICE_KEY length:", SUPABASE_SERVICE_KEY.length);
console.log("[DEBUG] runner UTC time:", new Date().toISOString());

async function insertRows(table, rows) {
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

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Supabase insert ${table} 실패: ${res.status} ${detail}`);
  }

  console.log(`[${table}] ${rows.length}행 적재 완료`);
}

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
