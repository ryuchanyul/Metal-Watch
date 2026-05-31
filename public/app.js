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
  }
];

const sampleAnalysis = [
  { symbol: "Co", recognized: "Cobalt 99.8", content: "8.2%", weightKg: 120, confidence: 0.96 },
  { symbol: "Ni", recognized: "Nickel", content: "14.5%", weightKg: 210, confidence: 0.94 },
  { symbol: "Li", recognized: "Li2CO3", content: "확인필요", weightKg: 32, confidence: 0.61 },
  { symbol: "Cu", recognized: "Copper", content: "3.4%", weightKg: 85, confidence: 0.91 },
  { symbol: "Al", recognized: "Aluminium", content: "6.1%", weightKg: 140, confidence: 0.89 }
];

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
  welcomePriceRows: document.querySelector("#welcomePriceRows"),
  welcomePrevMonthUsdHeader: document.querySelector("#welcomePrevMonthUsdHeader"),
  welcomePrevMonthKrwHeader: document.querySelector("#welcomePrevMonthKrwHeader"),
  analysisFile: document.querySelector("#analysisFile"),
  fileLabel: document.querySelector("#fileLabel"),
  runAnalysis: document.querySelector("#runAnalysis"),
  analysisTotal: document.querySelector("#analysisTotal"),
  analysisSummary: document.querySelector("#analysisSummary"),
  analysisRows: document.querySelector("#analysisRows"),
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
  const ranked = [...commodities].sort((a, b) => changePercent(b) - changePercent(a));
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
    const change = changePercent(item);
    const direction = change >= 0 ? "up" : "down";
    return `
      <tr class="clickable-row" data-symbol="${item.symbol}">
        <td><strong>${item.name.replace("(", " (")}</strong><br><small>${item.spec}</small></td>
        <td>${formatter.usd(item.usd)}</td>
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

function renderAnalysis(rows = []) {
  if (!rows.length) {
    els.analysisRows.innerHTML = `
      <tr>
        <td colspan="7">분석표 자동정리를 실행하면 인식 결과가 표시됩니다.</td>
      </tr>
    `;
    return;
  }

  let total = 0;
  els.analysisRows.innerHTML = rows.map((row) => {
    const item = commodities.find((commodity) => commodity.symbol === row.symbol);
    const amount = item ? krwPrice(item.usd) * row.weightKg : 0;
    const status = row.confidence >= 0.85 ? "ok" : "warn";
    total += status === "ok" ? amount : 0;

    return `
      <tr>
        <td><strong>${row.symbol}</strong></td>
        <td>${row.recognized}</td>
        <td>${row.content}</td>
        <td>${row.weightKg.toLocaleString("ko-KR")}kg</td>
        <td>${item ? formatter.krw(krwPrice(item.usd)) : "-"}</td>
        <td>${status === "ok" ? formatter.krw(amount) : "검토 필요"}</td>
        <td><span class="status-pill ${status}">${status === "ok" ? "확정" : "검토"}</span></td>
      </tr>
    `;
  }).join("");

  els.analysisTotal.textContent = formatter.krw(total);
  els.analysisSummary.textContent = `USD/KRW ${exchangeRate.toLocaleString("ko-KR")} 적용 · ${rows.length}개 항목 인식 · 검토 ${rows.filter((row) => row.confidence < 0.85).length}건`;
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

els.analysisFile.addEventListener("change", () => {
  const file = els.analysisFile.files[0];
  els.fileLabel.textContent = file ? file.name : "파일을 선택하거나 촬영하세요";
});

els.runAnalysis.addEventListener("click", () => renderAnalysis(sampleAnalysis));

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
renderAnalysis();
loadLivePrices();

// 페이지 첫 진입 시 모달 표시 (대시보드 위에 오버레이)
openWelcomeModal();
