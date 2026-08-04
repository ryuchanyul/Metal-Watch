const formatter = {
  usd(value) {
    return `$${Number(value).toLocaleString("en-US", {
      minimumFractionDigits: value >= 100 ? 3 : 4,
      maximumFractionDigits: value >= 100 ? 3 : 4
    })}`;
  },
  krw(value) {
    return `₩${Math.round(value).toLocaleString("ko-KR")}`;
  },
  percent(value) {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  }
};

let exchangeRate = 1507.82;
let selectedPeriod = "1Y";

// 전월(달력 기준) 번호. API의 prevMonth로 갱신됨. fallback은 클라이언트 계산.
function defaultPrevMonth() {
  const now = new Date();
  const idx = now.getMonth() - 1; // -1~10
  return idx < 0 ? 12 : idx + 1;
}
let prevMonth = defaultPrevMonth();

// 화면 상의 "월평균" 라벨을 "N월평균"으로 일괄 갱신
function updateMonthlyAvgLabels() {
  const numText = `${prevMonth}월평균`;
  if (els.prevMonthUsdHeader) els.prevMonthUsdHeader.textContent = `${numText} USD`;
  if (els.prevMonthKrwHeader) els.prevMonthKrwHeader.textContent = `${numText} KRW`;
  if (els.welcomePrevMonthUsdHeader) els.welcomePrevMonthUsdHeader.textContent = `${numText} USD`;
  if (els.welcomePrevMonthKrwHeader) els.welcomePrevMonthKrwHeader.textContent = `${numText} KRW`;
  if (els.welcomeModalAvgLabel) els.welcomeModalAvgLabel.textContent = numText;
  if (els.topGainLabel) els.topGainLabel.textContent = `(${numText} 대비)`;
  if (els.topLossLabel) els.topLossLabel.textContent = `(${numText} 대비)`;
  if (els.newAvgLabel) {
    // 첫 텍스트 노드(라벨 텍스트)만 교체. <input>은 그대로.
    const node = Array.from(els.newAvgLabel.childNodes).find(
      (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim()
    );
    if (node) node.textContent = `\n                  ${numText} USD\n                  `;
  }
}

// 종목 메타데이터. usd / monthlyAvg는 loadLivePrices()가 API에서 덮어씀.
let commodities = [
  {
    symbol: "Co",
    name: "Co(코발트)",
    spec: "99.8%min In warehouse Rotterdam",
    usd: 0,
    monthlyAvg: 0,
    unit: "USD/kg",
    source: "KOMIS"
  },
  {
    symbol: "Li",
    name: "Li(리튬)",
    spec: "Li2CO3 99.5%min CIF China",
    usd: 0,
    monthlyAvg: 0,
    unit: "USD/kg",
    source: "KOMIS"
  },
  {
    symbol: "Ni",
    name: "Ni(니켈)",
    spec: "LME CASH",
    usd: 0,
    monthlyAvg: 0,
    unit: "USD/kg",
    source: "KOMIS"
  },
  {
    symbol: "Mn",
    name: "Mn(망간)",
    spec: "Mn 75%min, C 2%max EXW China",
    usd: 0,
    monthlyAvg: 0,
    unit: "USD/kg",
    source: "KOMIS"
  },
  {
    symbol: "Cu",
    name: "Cu(구리)",
    spec: "LME CASH",
    usd: 0,
    monthlyAvg: 0,
    unit: "USD/kg",
    source: "KOMIS"
  },
  {
    symbol: "Al",
    name: "Al(알루미늄)",
    spec: "LME CASH",
    usd: 0,
    monthlyAvg: 0,
    unit: "USD/kg",
    source: "KOMIS"
  },
  {
    symbol: "Sn",
    name: "Sn(주석)",
    spec: "LME CASH",
    usd: 0,
    monthlyAvg: 0,
    unit: "USD/kg",
    source: "KOMIS"
  },
  {
    symbol: "Pb",
    name: "Pb(납)",
    spec: "LME CASH",
    usd: 0,
    monthlyAvg: 0,
    unit: "USD/kg",
    source: "KOMIS"
  },
  {
    symbol: "Zn",
    name: "Zn(아연)",
    spec: "LME CASH",
    usd: 0,
    monthlyAvg: 0,
    unit: "USD/kg",
    source: "KOMIS"
  },
  {
    symbol: "W_WC",
    name: "W(텅스텐 WC)",
    spec: "99.8%min 2.5-7.0μm FOB China",
    usd: 0,
    monthlyAvg: 0,
    unit: "USD/kg",
    source: "KOMIS"
  },
  {
    symbol: "W_WO3",
    name: "W(텅스텐 WO3)",
    spec: "99.95%min EXW China",
    usd: 0,
    monthlyAvg: 0,
    unit: "USD/kg",
    source: "KOMIS"
  },
  {
    symbol: "Mo",
    name: "Mo(몰리브덴)",
    spec: "Mo 60%min EXW China",
    usd: 0,
    monthlyAvg: 0,
    unit: "USD/kg",
    source: "KOMIS"
  },
  {
    symbol: "Au",
    name: "Au(금)",
    spec: "LBMA 99.99% (USD/oz 원본)",
    usd: 0,
    monthlyAvg: 0,
    unit: "USD/kg",
    source: "KOMIS"
  },
  {
    symbol: "Ag",
    name: "Ag(은)",
    spec: "LBMA 99.99% (USD/oz 원본)",
    usd: 0,
    monthlyAvg: 0,
    unit: "USD/kg",
    source: "KOMIS"
  },
  {
    symbol: "Pd",
    name: "Pd(팔라듐)",
    spec: "LBMA 99.95% (USD/oz 원본)",
    usd: 0,
    monthlyAvg: 0,
    unit: "USD/kg",
    source: "KOMIS"
  },
  {
    symbol: "Mg",
    name: "Mg(마그네슘)",
    spec: "99.9%min FOB China",
    usd: 0,
    monthlyAvg: 0,
    unit: "USD/kg",
    source: "KOMIS"
  },
  {
    symbol: "Ti",
    name: "Ti(티타늄)",
    spec: "70%min In warehouse Rotterdam",
    usd: 0,
    monthlyAvg: 0,
    unit: "USD/kg",
    source: "KOMIS"
  },
  {
    symbol: "In",
    name: "In(인듐)",
    spec: "99.995%min EXW China",
    usd: 0,
    monthlyAvg: 0,
    unit: "USD/kg",
    source: "KOMIS"
  },
  {
    symbol: "Ba",
    name: "Ba(바륨)",
    spec: "99%min 산업용 (추정값, 자동 수집 불가)",
    usd: 25,
    usdRange: 5,
    isEstimate: true,
    monthlyAvg: 25,
    unit: "USD/kg",
    source: "Manual estimate (분기 수동 갱신)"
  }
];

// 분석표 탭 상태 — 메타(공통) + 탭별(A, B) 독립 데이터
function blankTab() {
  return {
    metals: [], // [{ name, symbol, content }]  content = %
    moisture: null,
    totalQty: 1000,
    payRates: {} // { symbol: 100 }
  };
}

const analysisState = {
  imageDataUrl: null,
  meta: {
    sampleName: "",
    reportNumber: "",
    testDate: "",
    issuer: "",
    confidence: null
  },
  tabs: { A: blankTab(), B: blankTab() },
  activeTab: "A"
};

const els = {
  updatedAt: document.querySelector("#updatedAt"),
  exchangeRate: document.querySelector("#exchangeRate"),
  headerExchange: document.querySelector("#headerExchange"),
  topGain: document.querySelector("#topGain"),
  topLoss: document.querySelector("#topLoss"),
  commodityCards: document.querySelector("#commodityCards"),
  priceRows: document.querySelector("#priceRows"),
  priceSearch: document.querySelector("#priceSearch"),
  refreshPrices: document.querySelector("#refreshPrices"),
  commodityPicker: document.querySelector("#commodityPicker"),
  detailName: document.querySelector("#detailName"),
  detailUsd: document.querySelector("#detailUsd"),
  detailKrw: document.querySelector("#detailKrw"),
  yearHigh: document.querySelector("#yearHigh"),
  yearLow: document.querySelector("#yearLow"),
  yearAvg: document.querySelector("#yearAvg"),
  yearChart: document.querySelector("#yearChart"),
  chartTitle: document.querySelector("#chartTitle"),
  chartTooltip: document.querySelector("#chartTooltip"),
  prevMonthUsdHeader: document.querySelector("#prevMonthUsdHeader"),
  prevMonthKrwHeader: document.querySelector("#prevMonthKrwHeader"),
  topGainLabel: document.querySelector("#topGainLabel"),
  topLossLabel: document.querySelector("#topLossLabel"),
  newAvgLabel: document.querySelector("#newAvgLabel"),
  welcomeModal: document.querySelector("#welcomeModal"),
  welcomeModalClose: document.querySelector("#welcomeModalClose"),
  welcomeModalCloseLarge: document.querySelector("#welcomeModalCloseLarge"),
  welcomeModalAvgLabel: document.querySelector("#welcomeModalAvgLabel"),
  ocrLoadingModal: document.querySelector("#ocrLoadingModal"),
  welcomePriceRows: document.querySelector("#welcomePriceRows"),
  welcomePrevMonthUsdHeader: document.querySelector("#welcomePrevMonthUsdHeader"),
  welcomePrevMonthKrwHeader: document.querySelector("#welcomePrevMonthKrwHeader"),
  analysisFile: document.querySelector("#analysisFile"),
  uploadZone: document.querySelector(".upload-zone"),
  uploadHint: document.querySelector("#uploadHint"),
  previewImage: document.querySelector("#previewImage"),
  runOcrBtn: document.querySelector("#runOcrBtn"),
  clearUploadBtn: document.querySelector("#clearUploadBtn"),
  cameraBtn: document.querySelector("#cameraBtn"),
  cameraInput: document.querySelector("#cameraInput"),
  uploadOrDivider: document.querySelector("#uploadOrDivider"),
  ocrStatus: document.querySelector("#ocrStatus"),
  exSample: document.querySelector("#exSample"),
  exReport: document.querySelector("#exReport"),
  exDate: document.querySelector("#exDate"),
  exIssuer: document.querySelector("#exIssuer"),
  exConfidence: document.querySelector("#exConfidence"),
  calcTabs: document.querySelectorAll(".calc-tab"),
  calcPanels: document.querySelectorAll(".calc-tab-panel"),
  calcTableA: document.querySelector("#calcTableA"),
  calcTableB: document.querySelector("#calcTableB"),
  analysisNotes: document.querySelector("#analysisNotes"),
  saveAnalysisBtn: document.querySelector("#saveAnalysisBtn"),
  saveStatus: document.querySelector("#saveStatus"),
  saveSuccessModal: document.querySelector("#saveSuccessModal"),
  saveSuccessClose: document.querySelector("#saveSuccessClose"),
  savedAnalysisId: document.querySelector("#savedAnalysisId"),
  refreshInventoryBtn: document.querySelector("#refreshInventoryBtn"),
  inventoryRows: document.querySelector("#inventoryRows"),
  inventoryStatus: document.querySelector("#inventoryStatus"),
  inventoryDetailModal: document.querySelector("#inventoryDetailModal"),
  inventoryDetailBody: document.querySelector("#inventoryDetailBody"),
  inventoryDetailClose: document.querySelector("#inventoryDetailClose"),
  inventoryDetailCloseLarge: document.querySelector("#inventoryDetailCloseLarge"),
  inventoryDetailTitle: document.querySelector("#inventoryDetailTitle"),
  addCommodityForm: document.querySelector("#addCommodityForm"),
  newName: document.querySelector("#newName"),
  newSymbol: document.querySelector("#newSymbol"),
  newUsd: document.querySelector("#newUsd"),
  newAvg: document.querySelector("#newAvg")
};

function changePercent(item) {
  if (!item.monthlyAvg || !Number.isFinite(item.monthlyAvg)) return 0;
  return ((item.usd - item.monthlyAvg) / item.monthlyAvg) * 100;
}

function krwPrice(usd) {
  return usd * exchangeRate;
}

function updateTime(date = new Date()) {
  els.updatedAt.textContent = new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

// API 응답의 prices.* 안의 collected_at 중 가장 최근값을 찾는다.
function findLatestCollectedAt(data) {
  const prices = data?.prices ?? {};
  const timestamps = Object.values(prices)
    .map((p) => p?.collected_at)
    .filter(Boolean)
    .map((t) => new Date(t).getTime())
    .filter((n) => Number.isFinite(n));
  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps));
}

function renderTopChange(element, symbol, change) {
  // textContent + createElement로 안전하게 마크업 구성 (innerHTML 사용 안 함)
  while (element.firstChild) element.removeChild(element.firstChild);
  element.append(document.createTextNode(`${symbol} `));
  const span = document.createElement("span");
  span.className = `change ${change >= 0 ? "up" : "down"}`;
  span.textContent = formatter.percent(change);
  element.append(span);
}

function renderDashboard() {
  // 추정값 종목(isEstimate)은 변동률 0이라 TOP 계산에서 제외
  const ranked = [...commodities]
    .filter((item) => !item.isEstimate)
    .sort((a, b) => changePercent(b) - changePercent(a));
  const gain = ranked[0];
  const loss = ranked[ranked.length - 1];

  els.exchangeRate.textContent = formatter.krw(exchangeRate);
  if (els.headerExchange) els.headerExchange.textContent = formatter.krw(exchangeRate);

  renderTopChange(els.topGain, gain.symbol, changePercent(gain));
  renderTopChange(els.topLoss, loss.symbol, changePercent(loss));

  els.commodityCards.innerHTML = commodities.slice(0, 6).map((item) => {
    const change = changePercent(item);
    const direction = change >= 0 ? "up" : "down";
    return `
      <article class="commodity-card ${direction}" data-symbol="${item.symbol}">
        <div>
          <strong>${item.name}</strong>
          <small>${item.spec}</small>
        </div>
        <div class="price-stack">
          <strong>${formatter.usd(item.usd)}</strong>
          <span>${formatter.krw(krwPrice(item.usd))}</span>
          <span class="change ${direction}">${formatter.percent(change)}</span>
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll(".commodity-card").forEach((card) => {
    card.addEventListener("click", () => {
      selectCommodity(card.dataset.symbol);
      setView("detail");
    });
  });
}

function renderPriceTable() {
  const query = els.priceSearch.value.trim().toLowerCase();
  const filtered = commodities.filter((item) => {
    return [item.symbol, item.name, item.spec].join(" ").toLowerCase().includes(query);
  });

  const rowsHtml = filtered.map((item) => {
    // 수집일자 셀: ISO collected_at → 'MM-DD'. 없으면 '-'
    const dateCell = (() => {
      if (!item.collected_at) return "-";
      const d = new Date(item.collected_at);
      if (!Number.isFinite(d.getTime())) return "-";
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${mm}-${dd}`;
    })();

    // 추정값 종목(예: Ba): "$25 ±$5" 형태로 표시, 변동률은 ±%
    if (item.isEstimate) {
      const range = item.usdRange || 0;
      const rangePct = item.usd ? (range / item.usd) * 100 : 0;
      return `
      <tr class="clickable-row estimate-row" data-symbol="${item.symbol}">
        <td><strong>${item.name.replace("(", " (")}</strong><br><small>${item.spec}</small></td>
        <td>${formatter.usd(item.usd)} <span class="range">±${formatter.usd(range).replace("$","$")}</span></td>
        <td class="date-cell">-</td>
        <td class="avg-cell">-</td>
        <td>${formatter.krw(krwPrice(item.usd))} <span class="range">±${formatter.krw(krwPrice(range))}</span></td>
        <td>-</td>
        <td><span class="change estimate">±${rangePct.toFixed(0)}%</span></td>
      </tr>
    `;
    }

    const change = changePercent(item);
    const direction = change >= 0 ? "up" : "down";
    return `
      <tr class="clickable-row" data-symbol="${item.symbol}">
        <td><strong>${item.name.replace("(", " (")}</strong><br><small>${item.spec}</small></td>
        <td>${formatter.usd(item.usd)}</td>
        <td class="date-cell">${dateCell}</td>
        <td class="avg-cell">${formatter.usd(item.monthlyAvg)}</td>
        <td>${formatter.krw(krwPrice(item.usd))}</td>
        <td>${formatter.krw(krwPrice(item.monthlyAvg))}</td>
        <td><span class="change ${direction}">${formatter.percent(change)}</span></td>
      </tr>
    `;
  }).join("");

  els.priceRows.innerHTML = rowsHtml;
  // 웰컴 모달 안 테이블도 같은 데이터로 갱신 (검색 필터링 영향 없음 — 검색은 시세표만)
  if (els.welcomePriceRows) els.welcomePriceRows.innerHTML = rowsHtml;

  document.querySelectorAll("#priceRows .clickable-row").forEach((row) => {
    row.addEventListener("click", () => {
      selectCommodity(row.dataset.symbol);
      setView("detail");
    });
  });

  // 모달 안 행 클릭 시 — 모달 닫고 상세 차트로 이동
  if (els.welcomePriceRows) {
    els.welcomePriceRows.querySelectorAll(".clickable-row").forEach((row) => {
      row.addEventListener("click", () => {
        selectCommodity(row.dataset.symbol);
        setView("detail");
        closeWelcomeModal();
      });
    });
  }
}

// 현재 선택된 종목 symbol (이전 select.value 대체)
let selectedSymbol = "Cu";

function renderCommoditySelect() {
  // textContent + DOM API로 칩 생성 (innerHTML 미사용 — 보안 훅)
  const picker = els.commodityPicker;
  while (picker.firstChild) picker.removeChild(picker.firstChild);

  for (const item of commodities) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (item.symbol === selectedSymbol ? " active" : "");
    btn.dataset.symbol = item.symbol;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", item.symbol === selectedSymbol ? "true" : "false");
    btn.textContent = item.symbol.replace("_", " ");
    btn.addEventListener("click", () => selectCommodity(item.symbol));
    picker.appendChild(btn);
  }
}

function selectCommodity(symbol) {
  selectedSymbol = symbol;
  // 활성 칩 갱신
  els.commodityPicker.querySelectorAll(".chip").forEach((b) => {
    const isActive = b.dataset.symbol === symbol;
    b.classList.toggle("active", isActive);
    b.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  renderDetail();
}

// 종목별 history 캐시 (같은 symbol 두 번 fetch 안 함)
const historyCache = new Map();

async function fetchHistory(symbol) {
  if (historyCache.has(symbol)) return historyCache.get(symbol);
  try {
    const res = await fetch(`/api/history?symbol=${encodeURIComponent(symbol)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rows = Array.isArray(data.rows) ? data.rows : [];
    historyCache.set(symbol, rows);
    return rows;
  } catch (error) {
    console.warn(`history fetch 실패 (${symbol}):`, error);
    return [];
  }
}

async function renderDetail() {
  const selected =
    commodities.find((item) => item.symbol === selectedSymbol) ||
    commodities[0];

  els.chartTitle.textContent = CHART_TITLE_MAP[selectedPeriod] || "차트";

  const history = await fetchHistory(selected.symbol);
  const chartData = buildPeriodData(history, selectedPeriod);
  const values = chartData.values;

  els.detailName.textContent = `${selected.name} · ${selected.unit} · ${selected.source}`;
  els.detailUsd.textContent = formatter.usd(selected.usd);
  els.detailKrw.textContent = `${formatter.krw(krwPrice(selected.usd))} · ${prevMonth}월평균 대비 ${formatter.percent(changePercent(selected))}`;

  if (values.length === 0) {
    // 데이터 부족 상태 — 차트 비우고 안내
    els.yearHigh.textContent = "-";
    els.yearLow.textContent = "-";
    els.yearAvg.textContent = "-";
    els.chartTitle.textContent = `${CHART_TITLE_MAP[selectedPeriod]} · 데이터 부족`;
    els.yearChart.innerHTML = `
      <text x="380" y="160" text-anchor="middle" fill="#8492a0" font-size="14">
        ${selected.symbol} ${selectedPeriod} 데이터 없음
      </text>`;
    return;
  }

  const high = Math.max(...values);
  const low = Math.min(...values);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;

  els.yearHigh.textContent = formatter.usd(high);
  els.yearLow.textContent = formatter.usd(low);
  els.yearAvg.textContent = formatter.usd(avg);

  // 데이터 적을 때(예: 1M인데 5일치만) 제목에 알림
  const expectedMin = selectedPeriod === "1M" ? 15 : selectedPeriod === "3M" ? 40 : 100;
  if (values.length < expectedMin) {
    els.chartTitle.textContent = `${CHART_TITLE_MAP[selectedPeriod]} · ${values.length}개 데이터만`;
  }

  drawYearChart(chartData, avg);
}

// 오늘 기준 N일 전 날짜를 "M/D" 형식으로 반환
function dateLabel(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// 오늘 기준 N개월 전 날짜를 "M/D" 형식으로 반환
function monthLabel(monthsAgo) {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// Supabase에서 받은 history 배열을 기간으로 잘라 차트 데이터로 변환.
// history: [{ usd_per_kg, collected_at }, ...] 시간순 오름차순
function buildPeriodData(history, period) {
  const daysBack = period === "1M" ? 30 : period === "3M" ? 90 : 365;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);

  const filtered = history.filter((row) => new Date(row.collected_at) >= cutoff);
  const values = filtered.map((row) => row.usd_per_kg);
  const dates = filtered.map((row) => row.collected_at);

  const labels =
    period === "1Y"
      ? [monthLabel(11), monthLabel(6), monthLabel(0)]
      : [dateLabel(daysBack - 1), dateLabel(Math.floor(daysBack / 2)), dateLabel(0)];

  return { period, values, dates, labels };
}

const CHART_TITLE_MAP = {
  "1M": "월간 차트",
  "3M": "분기 차트",
  "1Y": "연간 차트"
};

function drawYearChart(chartData, average) {
  const values = chartData.values;
  const width = 760;
  const height = 320;
  const padding = { top: 34, right: 98, bottom: 38, left: 34 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const min = Math.min(...values) * 0.96;
  const max = Math.max(...values) * 1.04;
  const axisTicks = [max, (max + min) / 2, min];
  const months = buildPointLabels(chartData);

  const point = (value, index) => {
    // 데이터 1개일 때 division by zero 방지: 중앙에 표시
    const x =
      values.length > 1
        ? padding.left + (chartWidth / (values.length - 1)) * index
        : padding.left + chartWidth / 2;
    const y = padding.top + chartHeight - ((value - min) / (max - min || 1)) * chartHeight;
    return [x, y];
  };

  const points = values.map(point);
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${padding.left + chartWidth} ${height - padding.bottom} L${padding.left} ${height - padding.bottom} Z`;
  const avgY = point(average, 0)[1];
  const last = points[points.length - 1];
  const axisX = padding.left + chartWidth + 20;
  const gridLines = axisTicks.map((value) => {
    const y = point(value, 0)[1];
    return `M${padding.left} ${y.toFixed(1)}H${padding.left + chartWidth}`;
  }).join("");
  const axisLabels = axisTicks.map((value) => {
    const y = point(value, 0)[1] + 6;
    return `<text class="chart-axis-label" x="${axisX + 10}" y="${y.toFixed(1)}">${formatter.usd(value)}</text>`;
  }).join("");
  const hoverPoints = points.map(([x, y], index) => {
    const value = values[index];
    return `
      <rect class="chart-hover-target" x="${(x - chartWidth / values.length / 2).toFixed(1)}" y="${padding.top}" width="${(chartWidth / values.length).toFixed(1)}" height="${chartHeight}" data-month="${months[index]}" data-usd="${formatter.usd(value)}" data-krw="${formatter.krw(krwPrice(value))}" data-x="${x.toFixed(1)}" data-y="${y.toFixed(1)}"></rect>
      <circle class="chart-point" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5"></circle>
    `;
  }).join("");

  els.yearChart.innerHTML = `
    <path class="chart-grid" d="${gridLines}" />
    <path class="chart-axis" d="M${axisX} ${padding.top}V${height - padding.bottom}" />
    ${axisLabels}
    <path class="chart-average" d="M${padding.left} ${avgY.toFixed(1)}H${padding.left + chartWidth}" />
    <path class="chart-area" d="${area}" />
    <path class="chart-line" d="${line}" />
    <circle class="chart-dot" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="8" />
    ${hoverPoints}
    <text class="chart-label" x="${padding.left}" y="306">${chartData.labels[0]}</text>
    <text class="chart-label" x="315" y="306">${chartData.labels[1]}</text>
    <text class="chart-label" x="${padding.left + chartWidth - 44}" y="306">${chartData.labels[2]}</text>
  `;

  els.yearChart.querySelectorAll(".chart-hover-target").forEach((target) => {
    target.addEventListener("mouseenter", () => showChartTooltip(target));
    target.addEventListener("mousemove", () => showChartTooltip(target));
    target.addEventListener("mouseleave", hideChartTooltip);
  });
}

function buildPointLabels(chartData) {
  // history.dates 기반 — hover 툴팁에 실제 날짜 표시
  if (Array.isArray(chartData.dates) && chartData.dates.length > 0) {
    return chartData.dates.map((iso) => {
      const d = new Date(iso);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });
  }
  // fallback (dates 없을 때)
  return chartData.values.map((_, index) => `${index + 1}`);
}

function showChartTooltip(target) {
  const svgRect = els.yearChart.getBoundingClientRect();
  const x = Number(target.dataset.x);
  const y = Number(target.dataset.y);
  const left = (x / 760) * svgRect.width;
  const top = (y / 320) * svgRect.height;

  els.chartTooltip.hidden = false;
  els.chartTooltip.style.left = `${left}px`;
  els.chartTooltip.style.top = `${top}px`;
  els.chartTooltip.innerHTML = `
    <strong>${target.dataset.month} · ${target.dataset.usd}</strong>
    <span>${target.dataset.krw}</span>
  `;
}

function hideChartTooltip() {
  els.chartTooltip.hidden = true;
}

// ===== 분석표 탭 — OCR + 계산 로직 =====

function setOcrStatus(message, kind = "info") {
  if (!message) {
    els.ocrStatus.hidden = true;
    els.ocrStatus.textContent = "";
    return;
  }
  els.ocrStatus.hidden = false;
  els.ocrStatus.className = `ocr-status ${kind}`;
  els.ocrStatus.textContent = message;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("파일 읽기 실패"));
    reader.readAsDataURL(file);
  });
}

// 큰 이미지를 캔버스로 리사이즈 (단변 maxDim 이하, JPEG 압축)
function resizeDataUrl(dataUrl, maxDim = 1920, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const longSide = Math.max(width, height);
      if (longSide > maxDim) {
        const scale = maxDim / longSide;
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("이미지 리사이즈 실패"));
    img.src = dataUrl;
  });
}

async function handleFileSelected(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setOcrStatus("이미지 파일만 업로드 가능합니다 (JPG, PNG, WEBP)", "error");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    setOcrStatus("이미지가 너무 큽니다 (10MB 이하)", "error");
    return;
  }
  try {
    let dataUrl = await fileToDataUrl(file);
    // Vercel POST body 제한(4.5MB) 회피 + OCR 속도 향상 — 1.5MB 초과 시 자동 리사이즈
    if (file.size > 1.5 * 1024 * 1024) {
      try {
        dataUrl = await resizeDataUrl(dataUrl, 1920, 0.85);
      } catch (e) {
        console.warn("리사이즈 실패, 원본 사용:", e);
      }
    }
    analysisState.imageDataUrl = dataUrl;
    els.previewImage.src = dataUrl;
    els.previewImage.hidden = false;
    els.uploadZone.hidden = true;
    els.cameraBtn.hidden = true;
    els.uploadOrDivider.hidden = true;
    els.runOcrBtn.disabled = false;
    els.clearUploadBtn.hidden = false;
    setOcrStatus("OCR 분석 실행 버튼을 눌러주세요", "info");
  } catch (e) {
    setOcrStatus(e.message, "error");
  }
}

function clearUpload() {
  analysisState.imageDataUrl = null;
  els.analysisFile.value = "";
  els.cameraInput.value = "";
  els.previewImage.src = "";
  els.previewImage.hidden = true;
  els.uploadZone.hidden = false;
  els.cameraBtn.hidden = false;
  els.uploadOrDivider.hidden = false;
  els.runOcrBtn.disabled = true;
  els.clearUploadBtn.hidden = true;
  setOcrStatus("");
}

function openOcrLoadingModal() {
  if (!els.ocrLoadingModal) return;
  els.ocrLoadingModal.hidden = false;
  els.ocrLoadingModal.classList.add("open");
}

function closeOcrLoadingModal() {
  if (!els.ocrLoadingModal) return;
  els.ocrLoadingModal.classList.remove("open");
  els.ocrLoadingModal.hidden = true;
}

async function runOcr() {
  if (!analysisState.imageDataUrl) return;
  els.runOcrBtn.disabled = true;
  setOcrStatus("비전 분석 중... (5~10초)", "info");
  openOcrLoadingModal();

  try {
    const res = await fetch("/api/ocr-analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: analysisState.imageDataUrl })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || `HTTP ${res.status}`);
    }
    const { targetTab } = applyExtractedData(data);
    if (targetTab) {
      setOcrStatus(`시료명에 "(${targetTab})" 감지 → 습식 ${targetTab} 탭에만 적용됨`, "success");
    } else {
      setOcrStatus("추출 완료. (A)/(B) 표기 없어 양쪽 탭에 동일 적용", "success");
    }
    closeOcrLoadingModal();
  } catch (e) {
    console.error("[OCR] 실패:", e);
    setOcrStatus(`OCR 실패: ${e.message}`, "error");
    closeOcrLoadingModal();
    // 사용자가 페이지 상단까지 스크롤 안 해도 보이도록 alert로 즉시 알림
    alert(`OCR 분석 실패\n\n${e.message}\n\nVercel 환경변수 ANTHROPIC_API_KEY 등록 및 Redeploy 확인 필요.`);
  } finally {
    els.runOcrBtn.disabled = false;
  }
}

// 시료명에서 (A) / (B) 패턴 감지 — 대소문자 무관
function detectSampleTab(sampleName) {
  if (!sampleName) return null;
  const s = sampleName.toUpperCase();
  const hasA = /\(\s*A\s*\)/.test(s);
  const hasB = /\(\s*B\s*\)/.test(s);
  if (hasA && !hasB) return "A";
  if (hasB && !hasA) return "B";
  return null;
}

function applyExtractedData(data) {
  // 1. 메타 정보 (공통)
  analysisState.meta = {
    sampleName: data.sample_name || "",
    reportNumber: data.report_number || "",
    testDate: data.test_date || "",
    issuer: data.issuer || "",
    confidence: data.confidence ?? null
  };
  els.exSample.value = analysisState.meta.sampleName;
  els.exReport.value = analysisState.meta.reportNumber;
  els.exDate.value = analysisState.meta.testDate;
  els.exIssuer.value = analysisState.meta.issuer;
  renderConfidence(analysisState.meta.confidence);

  // 2. 메탈 함량/수분 추출
  const metals = (data.metals || []).map((m) => ({
    name: m.name || "",
    symbol: m.symbol || "",
    content: m.content_percent ?? (m.content_mg_per_kg != null ? m.content_mg_per_kg / 10000 : null)
  }));
  const moisture = data.moisture_percent ?? null;

  // 3. 시료명에 (A)/(B) 표기 있으면 해당 탭만, 없으면 양쪽 탭에 동일 적용
  const targetTab = detectSampleTab(data.sample_name);

  const applyToTab = (tabId) => {
    const tab = analysisState.tabs[tabId];
    tab.metals = metals.map((m) => ({ ...m }));
    tab.moisture = moisture;
    tab.payRates = {};
    metals.forEach((m) => {
      if (m.symbol) tab.payRates[m.symbol] = 100;
    });
  };

  if (targetTab) {
    applyToTab(targetTab);
    renderCalcTable(targetTab);
    switchTab(targetTab);
  } else {
    applyToTab("A");
    applyToTab("B");
    renderCalcTable("A");
    renderCalcTable("B");
  }

  return { targetTab };
}

function renderConfidence(c) {
  if (c == null) {
    els.exConfidence.hidden = true;
    return;
  }
  els.exConfidence.hidden = false;
  const pct = Math.round(c * 100);
  els.exConfidence.textContent = `신뢰도 ${pct}%`;
  els.exConfidence.classList.remove("high", "mid", "low");
  els.exConfidence.classList.add(pct >= 90 ? "high" : pct >= 70 ? "mid" : "low");
}

// ===== 탭별 계산표 (메탈을 컬럼으로 표시) =====
function getCalcTable(tabId) {
  return tabId === "A" ? els.calcTableA : els.calcTableB;
}

function fmtUsd(v, frac = 2) {
  if (v == null || !Number.isFinite(v)) return "-";
  return "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: frac, maximumFractionDigits: frac });
}

function fmtPct(v, frac = 2) {
  if (v == null || !Number.isFinite(v)) return "-";
  return Number(v).toLocaleString("en-US", { minimumFractionDigits: frac, maximumFractionDigits: frac }) + "%";
}

function fmtKg(v) {
  if (v == null || !Number.isFinite(v)) return "-";
  return Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " kg";
}

function renderCalcTable(tabId) {
  const tab = analysisState.tabs[tabId];
  const table = getCalcTable(tabId);
  if (!table) return;

  const metals = tab.metals;
  const numCols = Math.max(metals.length, 1);

  // 헤더 (BM | Ni | Ti | ...)
  const thead = table.querySelector("thead tr");
  thead.innerHTML = `<th class="row-label">BM</th>` + metals.map((m, idx) =>
    `<th class="metal-header" data-metal-idx="${idx}">
       ${m.symbol || `M${idx + 1}`}
       <button class="metal-delete" type="button" data-metal-delete="${idx}" aria-label="메탈 삭제">×</button>
     </th>`
  ).join("");

  // 본문 행 (함량 / 수분 / 메탈 / 시세 / 지불률 / 금액)
  const rows = table.querySelectorAll("tbody tr");
  // 함량 (입력)
  rows[0].innerHTML = `<th>함량 (%)</th>` + metals.map((m, idx) =>
    `<td><input type="number" step="0.0001" min="0" data-field="content" data-metal-idx="${idx}" value="${m.content ?? ""}" /></td>`
  ).join("");
  // 수분 (입력) — 모든 메탈에 공통 (colspan)
  rows[1].innerHTML = `<th>수분 (%)</th>${metals.length === 0
    ? `<td><input type="number" step="0.01" min="0" max="100" data-field="moisture" value="${tab.moisture ?? ""}" /></td>`
    : `<td colspan="${numCols}"><input type="number" step="0.01" min="0" max="100" data-field="moisture" value="${tab.moisture ?? ""}" /></td>`
  }`;
  // 메탈 (자동 계산)
  rows[2].innerHTML = `<th>메탈 (kg)</th>` + metals.map((_, idx) =>
    `<td data-cell="metalKg" data-metal-idx="${idx}">-</td>`
  ).join("");
  // 시세 (자동 fetch)
  rows[3].innerHTML = `<th>시세 ($/kg)</th>` + metals.map((m, idx) => {
    const item = commodities.find((c) => c.symbol === m.symbol);
    const price = item?.usd ?? null;
    return `<td data-cell="price" data-metal-idx="${idx}">${price != null ? fmtUsd(price, 4) : `<span style="color:#dc2626">없음</span>`}</td>`;
  }).join("");
  // 지불률 (입력, 기본 100)
  rows[4].innerHTML = `<th>지불률 (%)</th>` + metals.map((m, idx) => {
    const rate = m.symbol ? (tab.payRates[m.symbol] ?? 100) : 100;
    return `<td><input type="number" step="0.01" min="0" max="100" data-field="payRate" data-metal-idx="${idx}" value="${rate}" /></td>`;
  }).join("");
  // 금액 (자동 계산)
  rows[5].innerHTML = `<th>금액 ($)</th>` + metals.map((_, idx) =>
    `<td data-cell="amount" data-metal-idx="${idx}">-</td>`
  ).join("");

  // 총액 셀 colspan
  const totalCell = table.querySelector(`tfoot .cell-total`);
  if (totalCell) totalCell.setAttribute("colspan", String(numCols));

  recalc(tabId);
}

function recalc(tabId) {
  const tab = analysisState.tabs[tabId];
  const table = getCalcTable(tabId);
  if (!table) return;

  const dryFactor = 1 - (Number(tab.moisture) || 0) / 100;
  const totalQty = Number(tab.totalQty) || 0;

  let totalUsd = 0;
  tab.metals.forEach((m, idx) => {
    const content = Number(m.content);
    const item = commodities.find((c) => c.symbol === m.symbol);
    const price = item?.usd ?? null;
    const payRate = Number(tab.payRates[m.symbol] ?? 100);

    const metalKg = Number.isFinite(content) ? totalQty * (content / 100) * dryFactor : null;
    const amount = (metalKg != null && price != null) ? metalKg * price * (payRate / 100) : null;
    if (amount != null) totalUsd += amount;

    const metalCell = table.querySelector(`td[data-cell="metalKg"][data-metal-idx="${idx}"]`);
    if (metalCell) metalCell.textContent = metalKg != null ? fmtKg(metalKg) : "-";
    const amtCell = table.querySelector(`td[data-cell="amount"][data-metal-idx="${idx}"]`);
    if (amtCell) amtCell.textContent = amount != null ? fmtUsd(amount) : "-";
  });

  // 총액
  const totalCell = table.querySelector(`td[data-cell="total"]`);
  if (totalCell) totalCell.textContent = fmtUsd(totalUsd);

  // 단가 ($/kg)
  const panel = table.closest(".calc-tab-panel");
  const usdPerKg = totalQty > 0 ? totalUsd / totalQty : 0;
  const krwPerKg = usdPerKg * exchangeRate;
  panel.querySelector(`[data-cell="usdPerKg"]`).textContent = totalQty > 0 ? "$" + usdPerKg.toFixed(2) : "-";
  panel.querySelector(`[data-cell="exchange"]`).textContent = `₩${exchangeRate.toLocaleString("ko-KR")}`;
  panel.querySelector(`[data-cell="krwPerKg"]`).textContent = totalQty > 0 ? formatter.krw(krwPerKg) : "-";
}

function onCalcTableInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const panel = target.closest(".calc-tab-panel");
  if (!panel) return;
  const tabId = panel.dataset.panel;
  const tab = analysisState.tabs[tabId];
  if (!tab) return;

  const field = target.dataset.field;
  const idxStr = target.dataset.metalIdx;

  if (field === "moisture") {
    tab.moisture = target.value === "" ? null : Number(target.value);
  } else if (field === "content" && idxStr != null) {
    const idx = Number(idxStr);
    if (tab.metals[idx]) {
      tab.metals[idx].content = target.value === "" ? null : Number(target.value);
    }
  } else if (field === "payRate" && idxStr != null) {
    const idx = Number(idxStr);
    const m = tab.metals[idx];
    if (m && m.symbol) {
      tab.payRates[m.symbol] = target.value === "" ? 0 : Number(target.value);
    }
  } else if (target.dataset.input === "totalQty") {
    tab.totalQty = target.value === "" ? 0 : Number(target.value);
  }
  recalc(tabId);
}

function onCalcMetalDelete(event) {
  const btn = event.target.closest("[data-metal-delete]");
  if (!btn) return;
  const panel = btn.closest(".calc-tab-panel");
  if (!panel) return;
  const tabId = panel.dataset.panel;
  const tab = analysisState.tabs[tabId];
  const idx = Number(btn.dataset.metalDelete);
  tab.metals.splice(idx, 1);
  renderCalcTable(tabId);
}

function onAddMetalClick(event) {
  const btn = event.target.closest("[data-add-metal]");
  if (!btn) return;
  const panel = btn.closest(".calc-tab-panel");
  if (!panel) return;
  const tabId = panel.dataset.panel;
  const tab = analysisState.tabs[tabId];
  tab.metals.push({ name: "", symbol: "", content: null });
  renderCalcTable(tabId);
}

// ===== 분석 저장 =====
function setSaveStatus(message, kind = "info") {
  if (!els.saveStatus) return;
  if (!message) {
    els.saveStatus.hidden = true;
    els.saveStatus.textContent = "";
    return;
  }
  els.saveStatus.hidden = false;
  els.saveStatus.className = `ocr-status ${kind}`;
  els.saveStatus.textContent = message;
}

function computeTabResults(tabId) {
  // 현재 화면에 표시된 계산 결과를 추출 (recalc과 동일 로직, 결과만 반환)
  const tab = analysisState.tabs[tabId];
  const dryFactor = 1 - (Number(tab.moisture) || 0) / 100;
  const totalQty = Number(tab.totalQty) || 0;
  let totalUsd = 0;
  const lines = [];
  tab.metals.forEach((m) => {
    const content = Number(m.content);
    const item = commodities.find((c) => c.symbol === m.symbol);
    const price = item?.usd ?? null;
    const payRate = Number(tab.payRates[m.symbol] ?? 100);
    const metalKg = Number.isFinite(content) ? totalQty * (content / 100) * dryFactor : null;
    const amount = (metalKg != null && price != null) ? metalKg * price * (payRate / 100) : null;
    if (amount != null) totalUsd += amount;
    lines.push({
      symbol: m.symbol,
      name: m.name,
      content,
      metalKg,
      price,
      payRate,
      amount
    });
  });
  const usdPerKg = totalQty > 0 ? totalUsd / totalQty : 0;
  const krwPerKg = usdPerKg * exchangeRate;
  return { lines, totalUsd, usdPerKg, krwPerKg };
}

function getPricesSnapshot() {
  // 양쪽 탭에 등장한 메탈 심볼별 현재 시세 저장
  const symbols = new Set();
  ["A", "B"].forEach((tabId) => {
    analysisState.tabs[tabId].metals.forEach((m) => {
      if (m.symbol) symbols.add(m.symbol);
    });
  });
  const snapshot = {};
  symbols.forEach((sym) => {
    const item = commodities.find((c) => c.symbol === sym);
    if (item?.usd != null) snapshot[sym] = item.usd;
  });
  return snapshot;
}

async function saveAnalysis() {
  els.saveAnalysisBtn.disabled = true;
  setSaveStatus("저장 중...", "info");
  try {
    const body = {
      sample_name: analysisState.meta.sampleName || null,
      report_number: analysisState.meta.reportNumber || null,
      test_date: analysisState.meta.testDate || null,
      issuer: analysisState.meta.issuer || null,
      ocr_confidence: analysisState.meta.confidence,
      exchange_rate_snapshot: exchangeRate,
      prices_snapshot: getPricesSnapshot(),
      tabs: {
        A: { ...analysisState.tabs.A, results: computeTabResults("A") },
        B: { ...analysisState.tabs.B, results: computeTabResults("B") }
      },
      notes: els.analysisNotes.value || null
    };
    const res = await fetch("/api/analysis/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || `HTTP ${res.status}`);
    }
    setSaveStatus("저장 완료!", "success");
    openSaveSuccessModal(data.id);
  } catch (e) {
    console.error("[save] 실패:", e);
    setSaveStatus(`저장 실패: ${e.message}`, "error");
  } finally {
    els.saveAnalysisBtn.disabled = false;
  }
}

function openSaveSuccessModal(id) {
  if (!els.saveSuccessModal) return;
  if (els.savedAnalysisId) els.savedAnalysisId.textContent = id || "-";
  els.saveSuccessModal.hidden = false;
  els.saveSuccessModal.classList.add("open");
}

function closeSaveSuccessModal() {
  if (!els.saveSuccessModal) return;
  els.saveSuccessModal.classList.remove("open");
  els.saveSuccessModal.hidden = true;
}

function switchTab(tabId) {
  if (!analysisState.tabs[tabId]) return;
  analysisState.activeTab = tabId;
  els.calcTabs.forEach((btn) => {
    const active = btn.dataset.tab === tabId;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
  els.calcPanels.forEach((panel) => {
    panel.hidden = panel.dataset.panel !== tabId;
  });
}

function setView(viewName) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === viewName);
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });
  // 재고 탭 진입 시 자동 로드
  if (viewName === "inventory") {
    loadInventory();
  }
}

// ===== 재고 (저장된 분석) =====
let inventoryLoaded = false;
let inventoryRecords = [];

function setInventoryStatus(message, kind = "info") {
  if (!els.inventoryStatus) return;
  els.inventoryStatus.textContent = message || "";
  els.inventoryStatus.className = "inventory-status" + (kind === "error" ? " error" : "");
}

async function loadInventory() {
  setInventoryStatus("불러오는 중...");
  try {
    const res = await fetch("/api/analysis/list?limit=100");
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
    inventoryRecords = data.records || [];
    inventoryLoaded = true;
    renderInventoryList(inventoryRecords);
    setInventoryStatus(`총 ${data.total ?? inventoryRecords.length}건`);
  } catch (e) {
    console.error("[inventory] 실패:", e);
    setInventoryStatus(`불러오기 실패: ${e.message}`, "error");
    els.inventoryRows.innerHTML = `<tr><td colspan="7" class="empty-cell">불러오기 실패</td></tr>`;
  }
}

function renderInventoryList(records) {
  if (!records.length) {
    els.inventoryRows.innerHTML = `<tr><td colspan="7" class="empty-cell">저장된 분석이 없습니다. 분석표 탭에서 "재고로 반영하기"를 눌러보세요.</td></tr>`;
    return;
  }
  els.inventoryRows.innerHTML = "";
  records.forEach((rec) => {
    const tr = document.createElement("tr");
    tr.dataset.id = rec.id;
    const date = rec.created_at ? new Date(rec.created_at) : null;
    const dateStr = date ? `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` : "-";
    const a = rec.tabs?.A?.results;
    const b = rec.tabs?.B?.results;
    const aKrw = a?.krwPerKg != null ? formatter.krw(a.krwPerKg) : "-";
    const bKrw = b?.krwPerKg != null ? formatter.krw(b.krwPerKg) : "-";
    const notes = (rec.notes || "").substring(0, 20) + (rec.notes?.length > 20 ? "..." : "");
    const status = rec.erp_status || "draft";
    tr.innerHTML = `
      <td>${dateStr}</td>
      <td><strong>${rec.sample_name || "-"}</strong></td>
      <td>${rec.report_number || "-"}</td>
      <td class="num">${aKrw}</td>
      <td class="num">${bKrw}</td>
      <td>${notes || "-"}</td>
      <td><span class="erp-status-pill ${status}">${status}</span></td>
    `;
    tr.addEventListener("click", () => showInventoryDetail(rec));
    els.inventoryRows.appendChild(tr);
  });
}

function showInventoryDetail(rec) {
  if (!els.inventoryDetailModal) return;
  els.inventoryDetailTitle.textContent = rec.sample_name || "분석 상세";

  const date = rec.created_at ? new Date(rec.created_at) : null;
  const dateStr = date ? date.toLocaleString("ko-KR") : "-";

  const fmtUsd = (v) => v != null && Number.isFinite(v) ? "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-";
  const fmtKrw = (v) => v != null && Number.isFinite(v) ? formatter.krw(v) : "-";

  const renderTab = (tabKey, tabData) => {
    if (!tabData) return "";
    const metals = tabData.metals || [];
    const results = tabData.results || {};
    const moisture = tabData.moisture ?? "-";
    const totalQty = tabData.totalQty ?? "-";
    const metalRows = metals.map((m) => {
      const payRate = tabData.payRates?.[m.symbol] ?? 100;
      return `<tr>
        <td>${m.name || m.symbol || "-"}</td>
        <td>${m.content != null ? Number(m.content).toFixed(4) + "%" : "-"}</td>
        <td>${payRate.toFixed?.(1) ?? payRate}%</td>
      </tr>`;
    }).join("");
    return `
      <div class="detail-tab-block">
        <h3>습식 ${tabKey}</h3>
        <table>
          <thead><tr><th>메탈</th><th>함량</th><th>지불률</th></tr></thead>
          <tbody>${metalRows || `<tr><td colspan="3" style="text-align:center;color:#9ca3af">메탈 없음</td></tr>`}</tbody>
        </table>
        <div style="margin-top:8px;font-size:12px;color:#6b7280">수분 ${moisture}% · 총수량 ${totalQty}kg</div>
        <div class="detail-summary">
          <div class="detail-summary-card"><span>총액</span><strong>${fmtUsd(results.totalUsd)}</strong></div>
          <div class="detail-summary-card"><span>단가 $/kg</span><strong>${results.usdPerKg != null ? "$" + Number(results.usdPerKg).toFixed(2) : "-"}</strong></div>
          <div class="detail-summary-card"><span>단가 ₩/kg</span><strong>${fmtKrw(results.krwPerKg)}</strong></div>
        </div>
      </div>
    `;
  };

  els.inventoryDetailBody.innerHTML = `
    <div class="inventory-detail-body">
      <dl class="detail-meta">
        <dt>저장일시</dt><dd>${dateStr}</dd>
        <dt>성적서번호</dt><dd>${rec.report_number || "-"}</dd>
        <dt>시험완료일</dt><dd>${rec.test_date || "-"}</dd>
        <dt>발급기관</dt><dd>${rec.issuer || "-"}</dd>
        <dt>저장시점 환율</dt><dd>₩${rec.exchange_rate_snapshot?.toLocaleString("ko-KR") || "-"}</dd>
        <dt>상태</dt><dd><span class="erp-status-pill ${rec.erp_status || "draft"}">${rec.erp_status || "draft"}</span></dd>
      </dl>
      ${renderTab("A", rec.tabs?.A)}
      ${renderTab("B", rec.tabs?.B)}
      ${rec.notes ? `<div class="detail-notes"><strong>메모</strong><br/>${rec.notes}</div>` : ""}
    </div>
  `;

  els.inventoryDetailModal.hidden = false;
  els.inventoryDetailModal.classList.add("open");
}

function closeInventoryDetail() {
  if (!els.inventoryDetailModal) return;
  els.inventoryDetailModal.classList.remove("open");
  els.inventoryDetailModal.hidden = true;
}

async function loadLivePrices({ forceRefresh = false } = {}) {
  try {
    const path = forceRefresh ? "/api/prices?refresh=1" : "/api/prices";
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.exchangeRate?.USD_KRW) {
      exchangeRate = data.exchangeRate.USD_KRW;
    }

    // 전월 라벨 갱신 (API 값 우선, 없으면 클라이언트 계산)
    if (Number.isFinite(data.prevMonth)) {
      prevMonth = data.prevMonth;
    }
    updateMonthlyAvgLabels();

    commodities = commodities.map((item) => {
      const live = data.prices?.[item.symbol];
      if (live && live.usd != null) {
        return {
          ...item,
          usd: live.usd,
          monthlyAvg: live.monthlyAvg ?? item.monthlyAvg,
          collected_at: live.collected_at ?? null,
          source: live.source,
          isLive: true,
          manual: false
        };
      }
      return {
        ...item,
        isLive: false,
        manual: Boolean(live?.manual),
        source: live?.source || item.source
      };
    });

    // '최종 업데이트(수집시간)' = 시스템이 마지막으로 자동 수집한 시각
    // API의 lastCollectionAt 우선, 폴백으로 종목별 collected_at 최대값
    const collectedAt = data.lastCollectionAt
      ? new Date(data.lastCollectionAt)
      : findLatestCollectedAt(data);
    updateTime(collectedAt || new Date());
    renderAll();
    return data;
  } catch (error) {
    console.warn("실시간 시세 로딩 실패, 목업 데이터 유지:", error);
    return null;
  }
}

async function refreshPrices() {
  const button = els.refreshPrices;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "갱신 중...";
  try {
    await loadLivePrices({ forceRefresh: true });
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function renderAll() {
  renderDashboard();
  renderPriceTable();
  renderCommoditySelect();
  renderDetail();
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelectorAll("[data-view-shortcut]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.viewShortcut));
});

els.priceSearch.addEventListener("input", renderPriceTable);
els.refreshPrices.addEventListener("click", refreshPrices);

document.querySelectorAll(".period-tabs button").forEach((button) => {
  button.addEventListener("click", () => {
    selectedPeriod = button.dataset.period;
    document.querySelectorAll(".period-tabs button").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    hideChartTooltip();
    renderDetail();
  });
});

// 분석표 탭 — 이벤트 바인딩
els.analysisFile.addEventListener("change", () => {
  handleFileSelected(els.analysisFile.files[0]);
});

// label 자체가 input을 여는 native 동작 — JS에서 click() 추가 호출 시 다이얼로그가 2번 뜸
els.uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  els.uploadZone.classList.add("dragover");
});
els.uploadZone.addEventListener("dragleave", () => {
  els.uploadZone.classList.remove("dragover");
});
els.uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  els.uploadZone.classList.remove("dragover");
  handleFileSelected(e.dataTransfer.files[0]);
});

els.runOcrBtn.addEventListener("click", runOcr);
els.clearUploadBtn.addEventListener("click", clearUpload);
els.cameraBtn.addEventListener("click", () => els.cameraInput.click());
els.cameraInput.addEventListener("change", () => {
  handleFileSelected(els.cameraInput.files[0]);
});

// 시료 메타 정보 input → state 반영
els.exSample.addEventListener("input", (e) => { analysisState.meta.sampleName = e.target.value; });
els.exReport.addEventListener("input", (e) => { analysisState.meta.reportNumber = e.target.value; });
els.exDate.addEventListener("input", (e) => { analysisState.meta.testDate = e.target.value; });
els.exIssuer.addEventListener("input", (e) => { analysisState.meta.issuer = e.target.value; });

// 탭 전환
els.calcTabs.forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// 계산표 input 변경 + 메탈 삭제 (탭 패널에 위임)
els.calcPanels.forEach((panel) => {
  panel.addEventListener("input", onCalcTableInput);
  panel.addEventListener("click", (e) => {
    onCalcMetalDelete(e);
    onAddMetalClick(e);
  });
});

// 저장 버튼 + 저장 완료 모달
if (els.saveAnalysisBtn) {
  els.saveAnalysisBtn.addEventListener("click", saveAnalysis);
}
if (els.saveSuccessClose) {
  els.saveSuccessClose.addEventListener("click", closeSaveSuccessModal);
}
if (els.saveSuccessModal) {
  els.saveSuccessModal.addEventListener("click", (event) => {
    if (event.target === els.saveSuccessModal) closeSaveSuccessModal();
  });
}

// 재고 탭 이벤트
if (els.refreshInventoryBtn) {
  els.refreshInventoryBtn.addEventListener("click", loadInventory);
}
if (els.inventoryDetailClose) {
  els.inventoryDetailClose.addEventListener("click", closeInventoryDetail);
}
if (els.inventoryDetailCloseLarge) {
  els.inventoryDetailCloseLarge.addEventListener("click", closeInventoryDetail);
}
if (els.inventoryDetailModal) {
  els.inventoryDetailModal.addEventListener("click", (event) => {
    if (event.target === els.inventoryDetailModal) closeInventoryDetail();
  });
}

els.addCommodityForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const usd = Number(els.newUsd.value);
  const monthlyAvg = Number(els.newAvg.value);
  const symbol = els.newSymbol.value.trim();

  commodities.push({
    symbol,
    name: els.newName.value.trim(),
    spec: "사용자 추가 항목",
    usd,
    monthlyAvg,
    unit: "USD/kg",
    source: "Manual",
    yearly: Array.from({ length: 12 }, (_, index) => {
      const ratio = 0.94 + index * 0.008;
      return Number((usd * ratio).toFixed(4));
    })
  });

  els.addCommodityForm.reset();
  renderAll();
  setView("prices");
});

// ─────────── 웰컴 모달 ───────────
function openWelcomeModal() {
  if (!els.welcomeModal) return;
  els.welcomeModal.hidden = false;
  els.welcomeModal.classList.add("open");
  document.body.style.overflow = "hidden"; // 배경 스크롤 잠금
}

function closeWelcomeModal() {
  if (!els.welcomeModal) return;
  els.welcomeModal.classList.remove("open");
  els.welcomeModal.hidden = true;
  document.body.style.overflow = "";
}

if (els.welcomeModalClose) {
  els.welcomeModalClose.addEventListener("click", closeWelcomeModal);
}
if (els.welcomeModalCloseLarge) {
  els.welcomeModalCloseLarge.addEventListener("click", closeWelcomeModal);
}
if (els.welcomeModal) {
  // 오버레이(패널 밖) 클릭 시 닫기
  els.welcomeModal.addEventListener("click", (event) => {
    if (event.target === els.welcomeModal) closeWelcomeModal();
  });
  // ESC 키
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.welcomeModal.hidden) closeWelcomeModal();
  });
}

// ===== Focus 모드 (단가/분석 원터치 UX) =====
function enterFocusMode(tab = "prices") {
  document.body.classList.add("focus-mode");
  document.body.setAttribute("data-focus-tab", tab);
  document.querySelectorAll(".focus-tab").forEach((btn) => {
    const active = btn.dataset.focusTarget === tab;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
  setView(tab); // "prices" 또는 "analysis"
  window.scrollTo({ top: 0 });
}

function exitFocusMode() {
  document.body.classList.remove("focus-mode");
  document.body.removeAttribute("data-focus-tab");
  setView("dashboard");
  window.scrollTo({ top: 0 });
}

// focus-bar 탭 클릭
document.querySelectorAll(".focus-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.focusTarget;
    if (target) enterFocusMode(target);
  });
});

// focus X 닫기
const focusCloseBtn = document.querySelector("#focusCloseBtn");
if (focusCloseBtn) {
  focusCloseBtn.addEventListener("click", exitFocusMode);
}

// 일반 모드에서 focus 재진입 버튼 (topbar + 사이드바)
const focusEnterBtn = document.querySelector("#focusEnterBtn");
if (focusEnterBtn) {
  focusEnterBtn.addEventListener("click", () => enterFocusMode("prices"));
}
const sideFocusEnterBtn = document.querySelector("#sideFocusEnterBtn");
if (sideFocusEnterBtn) {
  sideFocusEnterBtn.addEventListener("click", () => enterFocusMode("prices"));
}

updateTime();
updateMonthlyAvgLabels();
renderAll();
renderCalcTable("A");
renderCalcTable("B");
loadLivePrices();

// 초기 진입 = focus 모드 + 단가 테이블 (body class는 HTML에서 default 설정)
setView("prices");
