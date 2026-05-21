// 네이버 finance 일별 시세 페이지에서 1년치 데이터를 수집한다.
// EUC-KR 인코딩, HTML 테이블 구조 의존.

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "text/html"
};

// 네이버 코드 → 우리 앱 심볼.
// 단위는 모두 USD/T (Trading Economics 일치 확인 완료).
export const NAVER_LME_MAP = {
  CMDT_CDY: "Cu",
  CMDT_AAY: "Al",
  CMDT_NDY: "Ni",
  CMDT_SDY: "Sn"
};

const PAGE_DELAY_MS = 500;
const MAX_PAGES = 80; // 1년치 안전 상한 (실측 50페이지면 1년치)

async function fetchNaverPage(code, page) {
  const url = `https://finance.naver.com/marketindex/worldDailyQuote.naver?marketindexCd=${code}&fdtc=2&page=${page}`;
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`네이버 ${code} page=${page} HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return new TextDecoder("euc-kr").decode(buf);
}

// 페이지 HTML에서 (date, price) 행을 모두 추출한다.
function parseHistoryPage(html) {
  const rows = [];
  const pattern =
    /<tr class="(?:up|down|nochange)">[\s\S]*?<td class="date">\s*([\d.]+)\s*<\/td>[\s\S]*?<td class="num">\s*([\d,.]+)\s*<\/td>/g;

  for (const match of html.matchAll(pattern)) {
    const dateRaw = match[1].trim(); // "2026.05.20"
    const priceRaw = match[2].replace(/,/g, "");
    const price = Number(priceRaw);
    if (!Number.isFinite(price)) continue;

    // YYYY.MM.DD → ISO 날짜
    const isoDate = dateRaw.replace(/\./g, "-");
    rows.push({ date: isoDate, price });
  }

  return rows;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 1년치(어제까지)를 만족할 때까지 페이지를 넘긴다.
async function fetchOneYearHistory(code) {
  const yearAgo = new Date();
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  yearAgo.setHours(0, 0, 0, 0);

  const all = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const html = await fetchNaverPage(code, page);
    const rows = parseHistoryPage(html);

    if (rows.length === 0) break;
    all.push(...rows);

    // 마지막 행의 날짜가 1년 전을 넘어갔으면 중단
    const oldestRow = rows[rows.length - 1];
    const oldestDate = new Date(oldestRow.date);
    if (oldestDate < yearAgo) break;

    await sleep(PAGE_DELAY_MS);
  }

  // 1년 이내로 필터링 + 중복 제거
  const seen = new Set();
  return all
    .filter((row) => new Date(row.date) >= yearAgo)
    .filter((row) => {
      if (seen.has(row.date)) return false;
      seen.add(row.date);
      return true;
    });
}

export async function fetchAllNaverHistory({ log = console.log } = {}) {
  const result = {};
  for (const [code, symbol] of Object.entries(NAVER_LME_MAP)) {
    log(`[수집] ${symbol} (${code}) 시작`);
    const start = Date.now();
    result[symbol] = await fetchOneYearHistory(code);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    log(`[수집] ${symbol}: ${result[symbol].length}행 (${elapsed}초)`);
  }
  return result;
}
