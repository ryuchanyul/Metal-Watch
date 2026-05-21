// Trading Economics 시세/환율 수집 모듈.
// server.js (런타임 캐시 + API)와 scripts/collect.js (배치 수집) 양쪽이 공유한다.

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "text/html,application/xhtml+xml"
};

export const COMMODITY_MAP = {
  cobalt: "Co",
  lithium: "Li",
  nickel: "Ni",
  manganese: "Mn",
  copper: "Cu",
  aluminum: "Al",
  tin: "Sn"
};

function parseNumber(text) {
  return Number(String(text).replace(/,/g, ""));
}

// 외부 단위 → USD/kg 정규화. CNY 단위는 usdcny 없으면 null.
export function normalizeToUsdPerKg(value, unit, usdcny) {
  const v = Number(value);
  if (!Number.isFinite(v)) return null;

  switch (unit) {
    case "USD/T":
    case "USD/MT":
      return v / 1000;
    case "USD/Lbs":
      return v * 2.20462;
    case "CNY/T":
      return usdcny ? v / 1000 / usdcny : null;
    case "CNY/mtu":
      // mtu(metric tonne unit) = 광석 1톤당 함량 1% 분량.
      // 100% 함량 기준으로 환산: CNY/mtu × 100 → CNY/T metal basis
      return usdcny ? (v * 100) / 1000 / usdcny : null;
    default:
      return null;
  }
}

export function extractCurrency(html, symbol) {
  const pattern = new RegExp(
    `data-symbol="${symbol}:CUR"[\\s\\S]{0,1500}?<td[^>]*id="p"[\\s\\S]{0,300}?([\\d,]+\\.\\d+)`
  );
  const match = html.match(pattern);
  return match ? parseNumber(match[1]) : null;
}

export function parseCommodities(commoditiesHtml, usdcny) {
  const pattern =
    /href="\/commodity\/([a-z0-9-]+)"[\s\S]{0,300}?<b>([^<]+)<\/b>[\s\S]{0,1000}?<div[^>]*font-size[^>]*>([^<]+)<\/div>[\s\S]{0,1000}?<td[^>]*id="p"[^>]*>[\s\n]*([\d,]+(?:\.\d+)?)/g;

  const prices = {};
  for (const match of commoditiesHtml.matchAll(pattern)) {
    const [, slug, name, unitRaw, valueRaw] = match;
    const symbol = COMMODITY_MAP[slug];
    if (!symbol) continue;
    if (prices[symbol]) continue;

    const unit = unitRaw.trim();
    const raw = parseNumber(valueRaw);
    const usd = normalizeToUsdPerKg(raw, unit, usdcny);

    prices[symbol] = {
      name: name.trim(),
      usd: usd != null ? Number(usd.toFixed(4)) : null,
      unit: "USD/kg",
      raw,
      rawUnit: unit,
      source: "Trading Economics"
    };
  }

  return prices;
}

export async function fetchPricesFromSources() {
  const [commoditiesRes, currenciesRes] = await Promise.all([
    fetch("https://tradingeconomics.com/commodities", { headers: FETCH_HEADERS }),
    fetch("https://tradingeconomics.com/currencies", { headers: FETCH_HEADERS })
  ]);

  if (!commoditiesRes.ok || !currenciesRes.ok) {
    throw new Error(
      `Trading Economics 응답 실패: commodities=${commoditiesRes.status}, currencies=${currenciesRes.status}`
    );
  }

  const [commoditiesHtml, currenciesHtml] = await Promise.all([
    commoditiesRes.text(),
    currenciesRes.text()
  ]);

  const usdkrw = extractCurrency(currenciesHtml, "USDKRW");
  const usdcny = extractCurrency(currenciesHtml, "USDCNY");
  const prices = parseCommodities(commoditiesHtml, usdcny);

  return {
    exchangeRate: { USD_KRW: usdkrw, USD_CNY: usdcny },
    prices,
    fetchedAt: new Date().toISOString()
  };
}
