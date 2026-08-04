// KOMIS daily cron 성공 후 종목별 최신 데이터 날짜를 텔레그램에 보낸다.

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  GITHUB_RUN_ID,
  GITHUB_REPOSITORY
} = process.env;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.log("[skip] TELEGRAM_BOT_TOKEN/CHAT_ID 미설정");
  process.exit(0);
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.log("[skip] SUPABASE_URL/SERVICE_KEY 미설정");
  process.exit(0);
}

// 대상 심볼 — KOMIS + JM PGM (Rh/Ir)까지 모두 커버
// source 필터 없이 각 심볼의 가장 최신 데이터를 그대로 사용 (소스 무관)
const SYMBOLS = [
  "Cu", "Al", "Ni", "Pb", "Zn", "Sn",
  "Au", "Ag", "Pd",
  "Co", "Li", "Mn", "Mo", "W_WC", "W_WO3", "Mg", "Ti", "In",
  "Rh", "Ir"
];

async function getLatestDate(symbol) {
  const url =
    `${SUPABASE_URL}/rest/v1/price_snapshots` +
    `?symbol=eq.${symbol}` +
    `&order=collected_at.desc&limit=1&select=collected_at,source`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data[0]) return null;
  return {
    date: data[0].collected_at.slice(0, 10),
    source: data[0].source
  };
}

// source 짧은 라벨 (텔레그램 메시지 간결화)
function shortSource(source) {
  if (!source) return "?";
  if (source.startsWith("KOMIS")) return "KOMIS";
  if (source === "Johnson Matthey") return "JM";
  if (source === "Trading Economics") return "TE";
  if (source.startsWith("Manual")) return "manual";
  return source;
}

async function main() {
  // 종목별 최신 날짜 + 소스 수집 (병렬)
  const entries = await Promise.all(
    SYMBOLS.map(async (sym) => [sym, await getLatestDate(sym)])
  );

  // 날짜별 종목 그룹화 (최신 날짜부터). 심볼은 "Rh(JM)" 같은 형태
  const byDate = {};
  const missing = [];
  for (const [sym, info] of entries) {
    if (!info) {
      missing.push(sym);
      continue;
    }
    const label = `${sym}(${shortSource(info.source)})`;
    if (!byDate[info.date]) byDate[info.date] = [];
    byDate[info.date].push(label);
  }

  const sortedDates = Object.keys(byDate).sort().reverse();

  // KST 시간 표시
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000)
    .toISOString().slice(0, 16).replace("T", " ");

  let summary = "";
  for (const date of sortedDates) {
    summary += `📅 ${date} : ${byDate[date].join(", ")}\n`;
  }
  if (missing.length) {
    summary += `\n⚠️ 데이터 없음 : ${missing.join(", ")}\n`;
  }

  const runUrl = GITHUB_RUN_ID
    ? `https://github.com/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
    : "";

  const text = `✅ [Metal Watch] 일일 수집 완료 (KOMIS + JM PGM)

실행 시각: ${kstNow} KST
실행 ID: #${GITHUB_RUN_ID || "-"}

종목별 최신 데이터:
${summary}
${runUrl ? `로그: ${runUrl}` : ""}`;

  const params = new URLSearchParams();
  params.set("chat_id", TELEGRAM_CHAT_ID);
  params.set("text", text);
  params.set("disable_web_page_preview", "true");

  const tgRes = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    }
  );

  if (!tgRes.ok) {
    const detail = await tgRes.text();
    console.error("텔레그램 전송 실패:", tgRes.status, detail);
    process.exit(1);
  }
  console.log("텔레그램 성공 알림 전송 완료");
  console.log("---");
  console.log(text);
}

main().catch((e) => {
  console.error("[notify-komis-status] 실패:", e);
  process.exit(1);
});
