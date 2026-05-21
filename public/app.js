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

let commodities = [
  {
    symbol: "Co",
    name: "Co(코발트)",
    spec: "99.8% Min",
    usd: 56.25,
    monthlyAvg: 55.99,
    unit: "USD/kg",
    source: "Fastmarkets",
    yearly: [48.3, 49.1, 51.8, 50.6, 53.2, 54.4, 52.8, 55.1, 56.0, 54.9, 55.7, 56.25]
  },
  {
    symbol: "Li",
    name: "Li(리튬)",
    spec: "Li2CO3 Lithium Carbonate",
    usd: 22.64,
    monthlyAvg: 19.78,
    unit: "USD/kg",
    source: "Fastmarkets",
    yearly: [17.8, 18.1, 18.9, 19.4, 18.7, 20.2, 21.1, 20.5, 21.8, 22.0, 22.4, 22.64]
  },
  {
    symbol: "Ni",
    name: "Ni(니켈)",
    spec: "LME Nickel",
    usd: 18.8,
    monthlyAvg: 18.00575,
    unit: "USD/kg",
    source: "LME",
    yearly: [17.4, 17.1, 16.9, 17.6, 18.2, 18.0, 18.4, 17.8, 18.6, 18.9, 18.3, 18.8]
  },
  {
    symbol: "Mn",
    name: "Mn(망간)",
    spec: "Ferro 75% Min",
    usd: 1.10648,
    monthlyAvg: 1.13042,
    unit: "USD/kg",
    source: "Custom API",
    yearly: [1.2, 1.18, 1.16, 1.15, 1.12, 1.14, 1.13, 1.11, 1.1, 1.12, 1.09, 1.10648]
  },
  {
    symbol: "Cu",
    name: "Cu(구리)",
    spec: "LME Copper",
    usd: 13.41,
    monthlyAvg: 12.89138,
    unit: "USD/kg",
    source: "LME",
    yearly: [10.82, 11.05, 10.9, 11.7, 11.55, 12.0, 12.18, 12.42, 12.34, 12.88, 13.05, 13.41]
  },
  {
    symbol: "Al",
    name: "Al(알루미늄)",
    spec: "LME Aluminium",
    usd: 3.665,
    monthlyAvg: 3.60063,
    unit: "USD/kg",
    source: "LME",
    yearly: [3.2, 3.18, 3.23, 3.31, 3.4, 3.48, 3.51, 3.44, 3.58, 3.6, 3.62, 3.665]
  },
  {
    symbol: "Sn",
    name: "Sn(주석)",
    spec: "LME Tin",
    usd: 52.8,
    monthlyAvg: 48.94175,
    unit: "USD/kg",
    source: "LME",
    yearly: [45.2, 44.8, 46.0, 47.5, 46.8, 49.1, 50.2, 48.9, 51.0, 52.4, 51.8, 52.8]
  },
  {
    symbol: "W",
    name: "W(텅스텐)",
    spec: "WC Carbide 99.8% Min",
    usd: 253.57,
    monthlyAvg: 338.53,
    unit: "USD/kg",
    source: "Custom API",
    yearly: [356, 348, 341, 338, 330, 318, 305, 294, 281, 270, 262, 253.57]
  }
];

const sampleAnalysis = [
  { symbol: "Co", recognized: "Cobalt 99.8", content: "8.2%", weightKg: 120, confidence: 0.96 },
  { symbol: "Ni", recognized: "Nickel", content: "14.5%", weightKg: 210, confidence: 0.94 },
  { symbol: "Li", recognized: "Li2CO3", content: "확인필요", weightKg: 32, confidence: 0.61 },
  { symbol: "Cu", recognized: "Copper", content: "3.4%", weightKg: 85, confidence: 0.91 },
  { symbol: "Al", recognized: "Aluminium", content: "6.1%", weightKg: 140, confidence: 0.89 }
];

const viewTitles = {
  dashboard: "대시보드",
  prices: "시세표",
  detail: "상세 차트",
  analysis: "분석표 자동정리",
  settings: "설정"
};

const els = {
  pageTitle: document.querySelector("#pageTitle"),
  updatedAt: document.querySelector("#updatedAt"),
  exchangeRate: document.querySelector("#exchangeRate"),
  topGain: document.querySelector("#topGain"),
  topLoss: document.querySelector("#topLoss"),
  commodityCards: document.querySelector("#commodityCards"),
  priceRows: document.querySelector("#priceRows"),
  priceSearch: document.querySelector("#priceSearch"),
  refreshPrices: document.querySelector("#refreshPrices"),
  commoditySelect: document.querySelector("#commoditySelect"),
  detailName: document.querySelector("#detailName"),
  detailUsd: document.querySelector("#detailUsd"),
  detailKrw: document.querySelector("#detailKrw"),
  yearHigh: document.querySelector("#yearHigh"),
  yearLow: document.querySelector("#yearLow"),
  yearAvg: document.querySelector("#yearAvg"),
  yearChart: document.querySelector("#yearChart"),
  chartTooltip: document.querySelector("#chartTooltip"),
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
  return ((item.usd - item.monthlyAvg) / item.monthlyAvg) * 100;
}

function krwPrice(usd) {
  return usd * exchangeRate;
}

function updateTime() {
  els.updatedAt.textContent = new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
}

function renderDashboard() {
  const ranked = [...commodities].sort((a, b) => changePercent(b) - changePercent(a));
  const gain = ranked[0];
  const loss = ranked[ranked.length - 1];

  els.exchangeRate.textContent = formatter.krw(exchangeRate);
  els.topGain.textContent = `${gain.symbol} ${formatter.percent(changePercent(gain))}`;
  els.topLoss.textContent = `${loss.symbol} ${formatter.percent(changePercent(loss))}`;

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
      els.commoditySelect.value = card.dataset.symbol;
      renderDetail();
      setView("detail");
    });
  });
}

function renderPriceTable() {
  const query = els.priceSearch.value.trim().toLowerCase();
  const filtered = commodities.filter((item) => {
    return [item.symbol, item.name, item.spec].join(" ").toLowerCase().includes(query);
  });

  els.priceRows.innerHTML = filtered.map((item) => {
    const change = changePercent(item);
    const direction = change >= 0 ? "up" : "down";
    return `
      <tr class="clickable-row" data-symbol="${item.symbol}">
        <td><strong>${item.symbol}</strong><br><small>${item.name} · ${item.spec}</small></td>
        <td>${formatter.usd(item.usd)}</td>
        <td class="avg-cell">${formatter.usd(item.monthlyAvg)}</td>
        <td>${formatter.krw(krwPrice(item.usd))}</td>
        <td>${formatter.krw(krwPrice(item.monthlyAvg))}</td>
        <td><span class="change ${direction}">${formatter.percent(change)}</span></td>
      </tr>
    `;
  }).join("");

  document.querySelectorAll("#priceRows .clickable-row").forEach((row) => {
    row.addEventListener("click", () => {
      els.commoditySelect.value = row.dataset.symbol;
      renderDetail();
      setView("detail");
    });
  });
}

function renderCommoditySelect() {
  els.commoditySelect.innerHTML = commodities.map((item) => {
    return `<option value="${item.symbol}">${item.name} - ${item.spec}</option>`;
  }).join("");
  els.commoditySelect.value = "Cu";
}

function renderDetail() {
  const selected = commodities.find((item) => item.symbol === els.commoditySelect.value) || commodities[0];
  const chartData = buildPeriodData(selected, selectedPeriod);
  const values = chartData.values;
  const high = Math.max(...values);
  const low = Math.min(...values);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;

  els.detailName.textContent = `${selected.name} · ${selected.unit} · ${selected.source}`;
  els.detailUsd.textContent = formatter.usd(selected.usd);
  els.detailKrw.textContent = `${formatter.krw(krwPrice(selected.usd))} · 월평균 대비 ${formatter.percent(changePercent(selected))}`;
  els.yearHigh.textContent = formatter.usd(high);
  els.yearLow.textContent = formatter.usd(low);
  els.yearAvg.textContent = formatter.usd(avg);

  drawYearChart(chartData, avg);
}

function buildPeriodData(item, period) {
  if (period === "1M") {
    const start = item.yearly[item.yearly.length - 2];
    const end = item.usd;
    const values = Array.from({ length: 30 }, (_, index) => {
      const progress = index / 29;
      const wave = Math.sin(index * 0.9) * end * 0.006;
      return Number((start + (end - start) * progress + wave).toFixed(5));
    });

    return {
      period,
      values,
      labels: ["1일", "15일", "30일"]
    };
  }

  if (period === "3M") {
    const base = item.yearly.slice(-4);
    const values = Array.from({ length: 13 }, (_, index) => {
      const segment = Math.min(Math.floor(index / 4), 2);
      const local = (index % 4) / 4;
      const start = base[segment];
      const end = base[segment + 1];
      const wave = Math.cos(index * 0.8) * end * 0.004;
      return Number((start + (end - start) * local + wave).toFixed(5));
    });

    return {
      period,
      values,
      labels: ["3개월 전", "6주 전", "현재"]
    };
  }

  return {
    period,
    values: item.yearly,
    labels: ["6월", "12월", "5월"]
  };
}

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
    const x = padding.left + (chartWidth / (values.length - 1)) * index;
    const y = padding.top + chartHeight - ((value - min) / (max - min)) * chartHeight;
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
  if (chartData.period === "1M") {
    return chartData.values.map((_, index) => `${index + 1}일`);
  }

  if (chartData.period === "3M") {
    return chartData.values.map((_, index) => `${index + 1}주`);
  }

  return ["6월", "7월", "8월", "9월", "10월", "11월", "12월", "1월", "2월", "3월", "4월", "5월"];
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
  els.pageTitle.textContent = viewTitles[viewName] || "Metal Watch";
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

    commodities = commodities.map((item) => {
      const live = data.prices?.[item.symbol];
      if (live && live.usd != null) {
        return {
          ...item,
          usd: live.usd,
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

    updateTime();
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
els.commoditySelect.addEventListener("change", renderDetail);

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

updateTime();
renderAll();
renderAnalysis();
loadLivePrices();
