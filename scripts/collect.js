// 시세/환율을 1회 수집하여 Supabase에 적재한다.
// GitHub Actions cron에서 호출되거나 로컬에서 수동 실행 가능.
// 필요한 환경변수:
//   SUPABASE_URL          예: https://xxxxx.supabase.co
//   SUPABASE_SERVICE_KEY  서비스 롤 키 (Service Role Key)
//   TELEGRAM_BOT_TOKEN    (선택) 가드 거부 시 경고 전송
//   TELEGRAM_CHAT_ID      (선택) 가드 거부 시 경고 전송

import { fetchPricesFromSources } from "../lib/prices.js";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID
} = process.env;

// ⚠️ 재발 방지 가드.
// Mn/Li/Co 모두 TE 값이 KOMIS 대비 1000% 이상 벗어났음에도 저장돼 운영 지표를 오염시켰다.
// KOMIS 참조값 대비 TE 값이 ±25% 이상 벗어나면 저장 거부 + 텔레그램 경고.
// 임계값 25%는 Mn(400%)·Li(50%)·Co(1700%)을 모두 잡고, 금·은의 실제 급등락(최대 20%)은 통과시키는 기준.
const GUARD_THRESHOLD = 0.25;
const PRIMARY_SOURCE_PREFIX = "KOMIS"; // 참조값 출처
const GUARDED_SOURCE = "Trading Economics"; // 검증 대상 source

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

// latest_price_per_symbol_source VIEW에서 KOMIS 참조값(symbol → usd_per_kg) 조회
async function fetchKomisReferences() {
  const url = `${SUPABASE_URL}/rest/v1/latest_price_per_symbol_source?select=symbol,usd_per_kg,source`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });
  if (!res.ok) {
    console.warn(`[가드] KOMIS 참조값 조회 실패 (${res.status}) — 가드 비활성화`);
    return {};
  }
  const rows = await res.json();
  const refs = {};
  for (const row of rows) {
    if (row.source && row.source.startsWith(PRIMARY_SOURCE_PREFIX)) {
      refs[row.symbol] = Number(row.usd_per_kg);
    }
  }
  return refs;
}

async function sendGuardAlert(rejected) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const lines = rejected.map(
    (r) =>
      `  • ${r.symbol}: TE $${r.usd.toFixed(4)} vs KOMIS $${r.ref.toFixed(4)} (${(r.diff * 100).toFixed(1)}% 차이)`
  );
  const text =
    `🚫 [Metal Watch 가드] TE 이상치 저장 거부\n\n` +
    `KOMIS 참조값 대비 ±${(GUARD_THRESHOLD * 100).toFixed(0)}% 초과:\n` +
    lines.join("\n") +
    `\n\nlib/prices.js COMMODITY_MAP에서 해당 심볼 제거 검토 필요.`;
  const params = new URLSearchParams();
  params.set("chat_id", TELEGRAM_CHAT_ID);
  params.set("text", text);
  params.set("disable_web_page_preview", "true");
  await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    }
  ).catch((e) => console.warn("[가드] 텔레그램 전송 실패:", e.message));
}

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`[수집 시작] ${startedAt}`);

  const data = await fetchPricesFromSources();
  const komisRefs = await fetchKomisReferences();

  const rejected = [];
  const priceRows = Object.entries(data.prices)
    .filter(([, item]) => item.usd != null)
    .filter(([symbol, item]) => {
      // KOMIS 참조값이 있고, 이 수집값이 KOMIS가 아닌 자동 수집 source일 때만 가드 적용
      const ref = komisRefs[symbol];
      if (!ref || item.source !== GUARDED_SOURCE) return true;
      const diff = Math.abs(item.usd - ref) / ref;
      if (diff > GUARD_THRESHOLD) {
        rejected.push({ symbol, usd: item.usd, ref, diff });
        console.error(
          `[가드] ${symbol} 거부: TE $${item.usd.toFixed(4)} vs KOMIS $${ref.toFixed(4)} (${(diff * 100).toFixed(1)}% 차이)`
        );
        return false;
      }
      return true;
    })
    .map(([symbol, item]) => ({
      symbol,
      usd_per_kg: item.usd,
      raw_value: item.raw,
      raw_unit: item.rawUnit,
      source: item.source
    }));

  if (rejected.length) {
    await sendGuardAlert(rejected);
  }

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
