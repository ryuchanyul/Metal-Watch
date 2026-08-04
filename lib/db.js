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
//
// View(latest_price_per_symbol_source) 사용:
//   - 종목×source 조합당 1행만 반환 (Postgres DISTINCT ON)
//   - limit 의존성 없음 → 종목/누적 행수가 늘어도 안전
//   - 응답 크기 ~32행 (16종목 × 평균 2 source)
export async function fetchLatestPrices() {
  assertEnv();
  const url = `${SUPABASE_URL}/rest/v1/latest_price_per_symbol_source?select=symbol,usd_per_kg,raw_value,raw_unit,source,collected_at`;
  let res = await fetch(url, { headers: buildHeaders() });

  // View가 아직 생성 안 됐을 때 — price_snapshots로 fallback (큰 limit)
  if (res.status === 404 || res.status === 400) {
    console.warn("[fetchLatestPrices] view 미존재, table fallback");
    const fallbackUrl = `${SUPABASE_URL}/rest/v1/price_snapshots?select=symbol,usd_per_kg,raw_value,raw_unit,source,collected_at&order=collected_at.desc&limit=10000`;
    res = await fetch(fallbackUrl, {
      headers: { ...buildHeaders(), "Range-Unit": "items", Range: "0-9999" }
    });
  }

  if (!res.ok) {
    throw new Error(`Supabase latest prices ${res.status}: ${await res.text()}`);
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

// 시스템이 마지막으로 데이터를 적재한 시각 (source 무관 최신)
// → 화면 '최종 업데이트(수집시간)'에 사용. 매시간 자동 수집(TE)이 들어오면
//    그 시각이 반영됨. KOMIS 가격 기준일과는 별개.
export async function fetchLastCollectionTime() {
  assertEnv();
  const url = `${SUPABASE_URL}/rest/v1/price_snapshots?select=collected_at&order=collected_at.desc&limit=1`;
  const res = await fetch(url, { headers: buildHeaders() });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0]?.collected_at || null;
}

// 전월(달력 기준) 평균 (모든 종목) — 변동률 계산용
// 예: 오늘이 5/23 → 4/1 00:00 UTC ~ 5/1 00:00 UTC 사이의 데이터 평균
//
// Supabase가 기본 1000행 제한이 있어 전체 쿼리로는 알파벳 앞 종목만 반환됨.
// → 심볼 목록을 먼저 확보 후 심볼별로 병렬 쿼리 (각 종목 6월 데이터 최대 ~1000행 이내라 안전)
export async function fetchMonthlyAverages() {
  assertEnv();
  const now = new Date();
  const prevMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
  );
  const thisMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );

  // 1) latest_price_per_symbol_source VIEW에서 심볼 목록 확보 (전체 종목 커버)
  const symbolsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/latest_price_per_symbol_source?select=symbol`,
    { headers: buildHeaders() }
  );
  if (!symbolsRes.ok) {
    throw new Error(`Supabase symbols ${symbolsRes.status}: ${await symbolsRes.text()}`);
  }
  const symbolRows = await symbolsRes.json();
  const symbols = [...new Set(symbolRows.map((r) => r.symbol))];

  // 2) 심볼별 병렬 쿼리 → 일별 dedup → 평균
  const avgs = {};
  await Promise.all(
    symbols.map(async (sym) => {
      const url =
        `${SUPABASE_URL}/rest/v1/price_snapshots` +
        `?symbol=eq.${encodeURIComponent(sym)}` +
        `&collected_at=gte.${prevMonthStart.toISOString()}` +
        `&collected_at=lt.${thisMonthStart.toISOString()}` +
        `&select=usd_per_kg,collected_at,source`;
      const res = await fetch(url, { headers: buildHeaders() });
      if (!res.ok) return;
      const rows = await res.json();
      if (rows.length === 0) return;
      const deduped = dedupByDay(rows);
      if (deduped.length === 0) return;
      const sum = deduped.reduce((s, r) => s + Number(r.usd_per_kg), 0);
      avgs[sym] = sum / deduped.length;
    })
  );
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
  const [latestPrices, latestFx, monthlyAvgs, lastCollection] = await Promise.all([
    fetchLatestPrices(),
    fetchLatestFx(),
    fetchMonthlyAverages(),
    fetchLastCollectionTime()
  ]);

  const prices = {};
  for (const [symbol, row] of Object.entries(latestPrices)) {
    const currentUsd = Number(row.usd_per_kg);
    // 전월 데이터 없으면(신규 종목 등) 현재가로 폴백 → 변동률 0%로 표시
    const monthlyAvg = monthlyAvgs[symbol] != null ? monthlyAvgs[symbol] : currentUsd;
    prices[symbol] = {
      name: symbol,
      usd: currentUsd,
      monthlyAvg,
      unit: "USD/kg",
      raw: Number(row.raw_value),
      rawUnit: row.raw_unit,
      source: row.source,
      collected_at: row.collected_at
    };
  }

  // 전월(달력 기준) 번호 — 화면 헤더 동적 표기용
  // 5월이면 4, 1월이면 12
  const now = new Date();
  const prevMonthIndex = now.getMonth() - 1; // -1 ~ 10
  const prevMonth = prevMonthIndex < 0 ? 12 : prevMonthIndex + 1;

  return {
    exchangeRate: {
      USD_KRW: latestFx.USD_KRW ?? null,
      USD_CNY: latestFx.USD_CNY ?? null
    },
    prices,
    prevMonth,
    lastCollectionAt: lastCollection,
    fetchedAt: new Date().toISOString()
  };
}
