// Supabase REST API에서 최신 시세/환율을 읽는 모듈.
// Vercel Function이 cold start마다 호출하므로 가볍게 유지한다.
//
// 환경변수:
//   SUPABASE_URL          예: https://xxxxx.supabase.co
//   SUPABASE_ANON_KEY     publishable / legacy anon 키 (SELECT만 필요하므로 service_role 사용 안 함)

const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

// 공식 백필 출처. 자동 수집과 같은 날 중복되면 이 source가 우선.
const PRIMARY_SOURCE = "KOMIS (광해광업공단)";

// 같은 (symbol, date) 중복 시 우선순위: KOMIS 우선, 아니면 최신 collected_at
function pickPreferredRow(existing, candidate) {
  if (!existing) return candidate;
  if (candidate.source === PRIMARY_SOURCE && existing.source !== PRIMARY_SOURCE) {
    return candidate;
  }
  if (existing.source === PRIMARY_SOURCE && candidate.source !== PRIMARY_SOURCE) {
    return existing;
  }
  // 같은 등급(둘 다 KOMIS 또는 둘 다 자동수집) → 최신 collected_at
  return candidate.collected_at > existing.collected_at ? candidate : existing;
}

// 일별로 dedup. KOMIS와 Trading Economics가 같은 날 있으면 KOMIS 채택.
function dedupByDay(rows) {
  const byDay = new Map();
  for (const row of rows) {
    const day = row.collected_at.slice(0, 10);
    byDay.set(day, pickPreferredRow(byDay.get(day), row));
  }
  return Array.from(byDay.values()).sort((a, b) =>
    a.collected_at.localeCompare(b.collected_at)
  );
}

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

// 시세: 각 symbol의 최신 정식 가격 (KOMIS 우선)
// 같은 종목 안에 KOMIS와 TE가 같은 날짜로 들어오면 KOMIS 채택.
// KOMIS가 N일치 누락된 경우만 TE 최신값으로 대체.
export async function fetchLatestPrices() {
  assertEnv();
  const url = `${SUPABASE_URL}/rest/v1/price_snapshots?select=symbol,usd_per_kg,raw_value,raw_unit,source,collected_at&order=collected_at.desc&limit=500`;
  const res = await fetch(url, { headers: buildHeaders() });
  if (!res.ok) {
    throw new Error(`Supabase price_snapshots ${res.status}: ${await res.text()}`);
  }
  const rows = await res.json();

  // 종목별로 KOMIS 최신값과 자동수집 최신값을 따로 추적
  const byKomis = {};
  const byAuto = {};
  for (const row of rows) {
    if (row.source === PRIMARY_SOURCE) {
      if (!byKomis[row.symbol]) byKomis[row.symbol] = row;
    } else {
      if (!byAuto[row.symbol]) byAuto[row.symbol] = row;
    }
  }

  // KOMIS가 있으면 KOMIS 우선, 없으면 자동수집(TE) 폴백
  const latest = {};
  const allSymbols = new Set([...Object.keys(byKomis), ...Object.keys(byAuto)]);
  for (const sym of allSymbols) {
    latest[sym] = byKomis[sym] || byAuto[sym];
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

// 최근 30일 평균 (모든 종목) — 변동률 계산용
export async function fetchMonthlyAverages() {
  assertEnv();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const url =
    `${SUPABASE_URL}/rest/v1/price_snapshots` +
    `?select=symbol,usd_per_kg,source,collected_at` +
    `&collected_at=gte.${cutoff.toISOString()}` +
    `&limit=10000`;
  const res = await fetch(url, {
    headers: { ...buildHeaders(), "Range-Unit": "items", Range: "0-9999" }
  });
  if (!res.ok) {
    throw new Error(`Supabase 30d avg ${res.status}: ${await res.text()}`);
  }
  const rows = await res.json();

  // 종목별로 일별 dedup 후 평균
  const bySymbol = {};
  for (const r of rows) {
    if (!bySymbol[r.symbol]) bySymbol[r.symbol] = [];
    bySymbol[r.symbol].push(r);
  }

  const avgs = {};
  for (const [sym, list] of Object.entries(bySymbol)) {
    const deduped = dedupByDay(list);
    const sum = deduped.reduce((s, r) => s + Number(r.usd_per_kg), 0);
    avgs[sym] = sum / deduped.length;
  }
  return avgs;
}

// 특정 symbol의 전체 history (시간순 오름차순, 일별 dedup)
// 같은 날짜에 KOMIS + Trading Economics 있으면 KOMIS 우선.
export async function fetchHistoryBySymbol(symbol) {
  assertEnv();
  const url = `${SUPABASE_URL}/rest/v1/price_snapshots?symbol=eq.${encodeURIComponent(
    symbol
  )}&select=usd_per_kg,collected_at,source&order=collected_at.asc&limit=10000`;
  const res = await fetch(url, {
    headers: {
      ...buildHeaders(),
      "Range-Unit": "items",
      Range: "0-9999"
    }
  });
  if (!res.ok) {
    throw new Error(
      `Supabase history(${symbol}) ${res.status}: ${await res.text()}`
    );
  }
  const rows = await res.json();
  const deduped = dedupByDay(
    rows.map((r) => ({
      usd_per_kg: Number(r.usd_per_kg),
      collected_at: r.collected_at,
      source: r.source
    }))
  );
  // source 컬럼은 클라이언트로 안 보냄
  return deduped.map(({ usd_per_kg, collected_at }) => ({
    usd_per_kg,
    collected_at
  }));
}

// 프론트가 기대하는 형식으로 통합
export async function fetchLatestData() {
  const [latestPrices, latestFx, monthlyAvgs] = await Promise.all([
    fetchLatestPrices(),
    fetchLatestFx(),
    fetchMonthlyAverages()
  ]);

  const prices = {};
  for (const [symbol, row] of Object.entries(latestPrices)) {
    prices[symbol] = {
      name: symbol,
      usd: Number(row.usd_per_kg),
      monthlyAvg: monthlyAvgs[symbol] ?? null,
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
