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

// 분석표 탭 상태 (이미지 + OCR 추출 + 지불률 + 계산 결과)
const analysisState = {
  imageDataUrl: null,
  extract: {
    metals: [],
    moisture: null,
    sampleName: "",
    reportNumber: "",
    testDate: "",
    issuer: "",
    confidence: null
  },
  payRates: {} // { symbol: 100 }
};

const els = {
  updatedAt: document.querySelector("#updatedAt"),
  exchangeRate: document.querySelector("#exchangeRate"),
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
  ocrStatus: document.querySelector("#ocrStatus"),
  exSample: document.querySelector("#exSample"),
  exReport: document.querySelector("#exReport"),
  exDate: document.querySelector("#exDate"),
  exIssuer: document.querySelector("#exIssuer"),
  exConfidence: document.querySelector("#exConfidence"),
  exMoisture: document.querySelector("#exMoisture"),
  extractMetalsRows: document.querySelector("#extractMetalsRows"),
  addMetalBtn: document.querySelector("#addMetalBtn"),
  totalQuantity: document.querySelector("#totalQuantity"),
  payRatesContainer: document.querySelector("#payRatesContainer"),
  calcExchange: document.querySelector("#calcExchange"),
  calculateBtn: document.querySelector("#calculateBtn"),
  resultRows: document.querySelector("#resultRows"),
  resultTotal: document.querySelector("#resultTotal"),
  resultUsdPerKg: document.querySelector("#resultUsdPerKg"),
  resultKrwPerKg: document.querySelector("#resultKrwPerKg"),
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

async function handleFileSelected(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setOcrStatus("이미지 파일만 업로드 가능합니다 (JPG, PNG, WEBP)", "error");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    setOcrStatus("이미지가 너무 큽니다 (5MB 이하 권장)", "error");
    return;
  }
  try {
    const dataUrl = await fileToDataUrl(file);
    analysisState.imageDataUrl = dataUrl;
    els.previewImage.src = dataUrl;
    els.previewImage.hidden = false;
    els.uploadHint.hidden = true;
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
  els.previewImage.src = "";
  els.previewImage.hidden = true;
  els.uploadHint.hidden = false;
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
  setOcrStatus("Claude Vision 분석 중... (5~10초)", "info");
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
    applyExtractedData(data);
    setOcrStatus("추출 완료. 결과를 확인하고 필요시 수정해주세요.", "success");
  } catch (e) {
    console.error("[OCR] 실패:", e);
    setOcrStatus(`OCR 실패: ${e.message}`, "error");
  } finally {
    els.runOcrBtn.disabled = false;
    closeOcrLoadingModal();
  }
}

function applyExtractedData(data) {
  analysisState.extract = {
    metals: (data.metals || []).map((m) => ({
      name: m.name || "",
      symbol: m.symbol || "",
      contentPercent: m.content_percent ?? (m.content_mg_per_kg != null ? m.content_mg_per_kg / 10000 : null),
      contentMgPerKg: m.content_mg_per_kg ?? (m.content_percent != null ? m.content_percent * 10000 : null)
    })),
    moisture: data.moisture_percent ?? null,
    sampleName: data.sample_name || "",
    reportNumber: data.report_number || "",
    testDate: data.test_date || "",
    issuer: data.issuer || "",
    confidence: data.confidence ?? null
  };

  els.exSample.value = analysisState.extract.sampleName;
  els.exReport.value = analysisState.extract.reportNumber;
  els.exDate.value = analysisState.extract.testDate;
  els.exIssuer.value = analysisState.extract.issuer;
  els.exMoisture.value = analysisState.extract.moisture ?? "";

  renderConfidence(analysisState.extract.confidence);
  renderExtractMetals();
  renderPayRates();
  els.calculateBtn.disabled = analysisState.extract.metals.length === 0;
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

function renderExtractMetals() {
  const rows = analysisState.extract.metals;
  if (!rows.length) {
    els.extractMetalsRows.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:14px">메탈 항목 없음 — 추가 버튼으로 입력</td></tr>`;
    return;
  }
  els.extractMetalsRows.innerHTML = "";
  rows.forEach((metal, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input data-idx="${idx}" data-field="name" type="text" value="${metal.name || ""}" /></td>
      <td><input data-idx="${idx}" data-field="symbol" type="text" value="${metal.symbol || ""}" style="text-transform:none" /></td>
      <td><input data-idx="${idx}" data-field="contentPercent" type="number" step="0.0001" value="${metal.contentPercent ?? ""}" /></td>
      <td><input data-idx="${idx}" data-field="contentMgPerKg" type="number" step="1" value="${metal.contentMgPerKg ?? ""}" /></td>
      <td><button class="delete-btn" data-delete-idx="${idx}" type="button" aria-label="삭제">×</button></td>
    `;
    els.extractMetalsRows.appendChild(tr);
  });
}

function onExtractInputChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const idx = Number(target.dataset.idx);
  const field = target.dataset.field;
  if (!Number.isFinite(idx) || !field) return;
  const metal = analysisState.extract.metals[idx];
  if (!metal) return;
  if (field === "contentPercent") {
    const v = target.value === "" ? null : Number(target.value);
    metal.contentPercent = v;
    metal.contentMgPerKg = v != null ? v * 10000 : null;
    const mgInput = els.extractMetalsRows.querySelector(`input[data-idx="${idx}"][data-field="contentMgPerKg"]`);
    if (mgInput) mgInput.value = metal.contentMgPerKg ?? "";
  } else if (field === "contentMgPerKg") {
    const v = target.value === "" ? null : Number(target.value);
    metal.contentMgPerKg = v;
    metal.contentPercent = v != null ? v / 10000 : null;
    const pInput = els.extractMetalsRows.querySelector(`input[data-idx="${idx}"][data-field="contentPercent"]`);
    if (pInput) pInput.value = metal.contentPercent ?? "";
  } else {
    metal[field] = target.value;
    if (field === "symbol") renderPayRates();
  }
}

function onExtractDeleteClick(event) {
  const btn = event.target.closest("button.delete-btn");
  if (!btn) return;
  const idx = Number(btn.dataset.deleteIdx);
  analysisState.extract.metals.splice(idx, 1);
  renderExtractMetals();
  renderPayRates();
  els.calculateBtn.disabled = analysisState.extract.metals.length === 0;
}

function addMetalRow() {
  analysisState.extract.metals.push({
    name: "",
    symbol: "",
    contentPercent: null,
    contentMgPerKg: null
  });
  renderExtractMetals();
  renderPayRates();
  els.calculateBtn.disabled = false;
}

function renderPayRates() {
  const metals = analysisState.extract.metals.filter((m) => m.symbol);
  if (!metals.length) {
    els.payRatesContainer.innerHTML = `<p class="small-note">OCR 추출 후 메탈별 지불률(%) 입력란이 자동 생성됩니다.</p>`;
    return;
  }
  els.payRatesContainer.innerHTML = "";
  metals.forEach((metal) => {
    if (analysisState.payRates[metal.symbol] == null) {
      analysisState.payRates[metal.symbol] = 100;
    }
    const row = document.createElement("div");
    row.className = "pay-rate-row";
    row.innerHTML = `
      <label>${metal.name || metal.symbol} (${metal.symbol}) 지불률</label>
      <input type="number" step="0.01" min="0" max="100" data-symbol="${metal.symbol}" value="${analysisState.payRates[metal.symbol]}" />
    `;
    els.payRatesContainer.appendChild(row);
  });
}

function onPayRateChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.dataset.symbol) return;
  const v = Number(target.value);
  if (Number.isFinite(v)) analysisState.payRates[target.dataset.symbol] = v;
}

function calculateAnalysis() {
  const totalQty = Number(els.totalQuantity.value);
  if (!Number.isFinite(totalQty) || totalQty <= 0) {
    setOcrStatus("총 수량을 입력해주세요", "error");
    return;
  }
  const moisture = Number(els.exMoisture.value) || 0;
  const dryFactor = 1 - moisture / 100;

  let total = 0;
  const rows = [];

  analysisState.extract.metals.forEach((metal) => {
    if (!metal.symbol || metal.contentPercent == null) return;
    const item = commodities.find((c) => c.symbol === metal.symbol);
    const usdPrice = item?.usd ?? null;
    const payRate = analysisState.payRates[metal.symbol] ?? 100;
    const metalKg = totalQty * (metal.contentPercent / 100) * dryFactor;
    const amount = usdPrice != null ? metalKg * usdPrice * (payRate / 100) : 0;
    total += amount;
    rows.push({
      symbol: metal.symbol,
      name: metal.name || metal.symbol,
      contentPercent: metal.contentPercent,
      metalKg,
      usdPrice,
      payRate,
      amount
    });
  });

  els.resultRows.innerHTML = rows.map((r) => `
    <tr>
      <td><strong>${r.name}</strong> <small style="color:#9ca3af">${r.symbol}</small></td>
      <td>${r.contentPercent.toFixed(4)}%</td>
      <td>${r.metalKg.toFixed(2)} kg</td>
      <td>${r.usdPrice != null ? `$${r.usdPrice.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}` : `<span style="color:#dc2626">시세 없음</span>`}</td>
      <td>${r.payRate.toFixed(1)}%</td>
      <td>${r.amount > 0 ? `$${r.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-"}</td>
    </tr>
  `).join("");

  const usdPerKg = totalQty > 0 ? total / totalQty : 0;
  const krwPerKg = usdPerKg * exchangeRate;

  els.resultTotal.textContent = `$${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  els.resultUsdPerKg.textContent = `$${usdPerKg.toFixed(2)}`;
  els.resultKrwPerKg.textContent = formatter.krw(krwPerKg);
  els.calcExchange.textContent = `₩${exchangeRate.toLocaleString("ko-KR")}`;
  setOcrStatus("계산 완료", "success");
}

function resetAnalysisResults() {
  els.resultRows.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:14px">"계산 실행" 버튼을 누르면 결과가 표시됩니다</td></tr>`;
  els.resultTotal.textContent = "-";
  els.resultUsdPerKg.textContent = "-";
  els.resultKrwPerKg.textContent = "-";
  els.calcExchange.textContent = `₩${exchangeRate.toLocaleString("ko-KR")}`;
}

function setView(viewName) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === viewName);
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });
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
els.addMetalBtn.addEventListener("click", addMetalRow);
els.calculateBtn.addEventListener("click", calculateAnalysis);
els.extractMetalsRows.addEventListener("input", onExtractInputChange);
els.extractMetalsRows.addEventListener("click", onExtractDeleteClick);
els.payRatesContainer.addEventListener("input", onPayRateChange);
els.exMoisture.addEventListener("input", (e) => {
  analysisState.extract.moisture = e.target.value === "" ? null : Number(e.target.value);
});
els.exSample.addEventListener("input", (e) => { analysisState.extract.sampleName = e.target.value; });
els.exReport.addEventListener("input", (e) => { analysisState.extract.reportNumber = e.target.value; });
els.exDate.addEventListener("input", (e) => { analysisState.extract.testDate = e.target.value; });
els.exIssuer.addEventListener("input", (e) => { analysisState.extract.issuer = e.target.value; });

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

updateTime();
updateMonthlyAvgLabels();
renderAll();
renderExtractMetals();
renderPayRates();
resetAnalysisResults();
loadLivePrices();

// 페이지 첫 진입 시 모달 표시 (대시보드 위에 오버레이)
openWelcomeModal();
