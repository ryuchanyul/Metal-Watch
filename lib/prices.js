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
  // manganese: TE는 저순도 Mn ore 스크래핑, KOMIS(순수 Mn 99.7%)와 값이 크게 다름 → 제거
  copper: "Cu",
  aluminum: "Al",
  tin: "Sn",
  lead: "Pb",
  zinc: "Zn",
  gold: "Au",
  silver: "Ag"
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
    case "USD/t.oz":
    case "USD/oz":
      // 트로이 온스 1 oz = 31.1035 g → USD/kg = USD/oz × 32.1507
      return v * 32.1507;
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

// 네이버 finance 메인 페이지에서 USD/KRW 매매기준율 추출.
// 하나은행 매매기준율(한국 기준)로 Trading Economics OTC보다 한국 사용자에게 정확.
// 실패 시 null 반환 → 호출자가 TE로 폴백.
async function fetchNaverUsdKrw() {
  try {
    const res = await fetch("https://finance.naver.com/marketindex/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const html = new TextDecoder("euc-kr").decode(buf);
    const m = html.match(
      /FX_USDKRW[\s\S]{0,800}?<span class="value">([\d,]+\.\d+)<\/span>/
    );
    return m ? parseNumber(m[1]) : null;
  } catch (error) {
    console.warn("[fx] 네이버 환율 fetch 실패:", error.message);
    return null;
  }
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
  // USDKRW는 네이버(하나은행 매매기준율) 우선, 실패 시 TE 폴백.
  // USDCNY는 TE 그대로 (네이버에 USDCNY 직접 비율 없음).
  const [commoditiesRes, currenciesRes, naverUsdKrw] = await Promise.all([
    fetch("https://tradingeconomics.com/commodities", { headers: FETCH_HEADERS }),
    fetch("https://tradingeconomics.com/currencies", { headers: FETCH_HEADERS }),
    fetchNaverUsdKrw()
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

  const usdkrw = naverUsdKrw ?? extractCurrency(currenciesHtml, "USDKRW");
  const usdcny = extractCurrency(currenciesHtml, "USDCNY");
  const prices = parseCommodities(commoditiesHtml, usdcny);

  return {
    exchangeRate: { USD_KRW: usdkrw, USD_CNY: usdcny },
    prices,
    fetchedAt: new Date().toISOString()
  };
}
