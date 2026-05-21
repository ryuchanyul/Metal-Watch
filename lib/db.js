// Supabase REST API에서 최신 시세/환율을 읽는 모듈.
// Vercel Function이 cold start마다 호출하므로 가볍게 유지한다.
//
// 환경변수:
//   SUPABASE_URL          예: https://xxxxx.supabase.co
//   SUPABASE_ANON_KEY     publishable / legacy anon 키 (SELECT만 필요하므로 service_role 사용 안 함)

const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

function buildHeaders() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`
  };
}

function assertEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "환경변수 누락: SUPABASE_URL, SUPABASE_ANON_KEY가 모두 필요합니다."
    );
  }
}

// 시세: 각 symbol의 최신 1행만 추출
export async function fetchLatestPrices() {
  assertEnv();
  const url = `${SUPABASE_URL}/rest/v1/price_snapshots?select=symbol,usd_per_kg,raw_value,raw_unit,source,collected_at&order=collected_at.desc&limit=200`;
  const res = await fetch(url, { headers: buildHeaders() });
  if (!res.ok) {
    throw new Error(`Supabase price_snapshots ${res.status}: ${await res.text()}`);
  }
  const rows = await res.json();

  const latest = {};
  for (const row of rows) {
    if (!latest[row.symbol]) latest[row.symbol] = row;
  }
  return latest;
}

// 환율: pair별 최신 1행
export async function fetchLatestFx() {
  assertEnv();
  const url = `${SUPABASE_URL}/rest/v1/fx_snapshots?select=pair,rate,collected_at&order=collected_at.desc&limit=20`;
  const res = await fetch(url, { headers: buildHeaders() });
  if (!res.ok) {
    throw new Error(`Supabase fx_snapshots ${res.status}: ${await res.text()}`);
  }
  const rows = await res.json();

  const latest = {};
  for (const row of rows) {
    if (!latest[row.pair]) latest[row.pair] = Number(row.rate);
  }
  return latest;
}

// 프론트가 기대하는 형식으로 통합
export async function fetchLatestData() {
  const [latestPrices, latestFx] = await Promise.all([
    fetchLatestPrices(),
    fetchLatestFx()
  ]);

  const prices = {};
  for (const [symbol, row] of Object.entries(latestPrices)) {
    prices[symbol] = {
      name: symbol,
      usd: Number(row.usd_per_kg),
      unit: "USD/kg",
      raw: Number(row.raw_value),
      rawUnit: row.raw_unit,
      source: row.source,
      collected_at: row.collected_at
    };
  }

  return {
    exchangeRate: {
      USD_KRW: latestFx.USD_KRW ?? null,
      USD_CNY: latestFx.USD_CNY ?? null
    },
    prices,
    fetchedAt: new Date().toISOString()
  };
}
