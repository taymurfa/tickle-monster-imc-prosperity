const ROUND_CONFIGS = {
  "0": {
    basePath: "prosperity_docs/Mitchell",
    files: [
      "prices_round_0_day_-2.csv",
      "prices_round_0_day_-1.csv",
      "trades_round_0_day_-2.csv",
      "trades_round_0_day_-1.csv",
    ],
    labels: { emerald: "Emeralds", tomato: "Tomatoes" },
    overviewProducts: ["EMERALDS", "TOMATOES"],
    voucherStrikes: {},
  },
  "1": {
    basePath: "ROUND_1/ROUND1",
    files: [
      "prices_round_1_day_-2.csv",
      "prices_round_1_day_-1.csv",
      "prices_round_1_day_0.csv",
      "trades_round_1_day_-2.csv",
      "trades_round_1_day_-1.csv",
      "trades_round_1_day_0.csv",
    ],
    labels: { emerald: "Osmium", tomato: "Pepper Root" },
    overviewProducts: ["ASH_COATED_OSMIUM", "INTARIAN_PEPPER_ROOT"],
    voucherStrikes: {},
  },
  "2": {
    basePath: "ROUND_2/ROUND2",
    files: [
      "prices_round_2_day_-1.csv",
      "prices_round_2_day_0.csv",
      "prices_round_2_day_1.csv",
      "trades_round_2_day_-1.csv",
      "trades_round_2_day_0.csv",
      "trades_round_2_day_1.csv",
    ],
    labels: { emerald: "Osmium", tomato: "Pepper Root" },
    overviewProducts: ["ASH_COATED_OSMIUM", "INTARIAN_PEPPER_ROOT"],
    voucherStrikes: {},
  },
  "3": {
    basePath: "ROUND_3/ROUND3",
    files: [
      "prices_round_3_day_0.csv",
      "prices_round_3_day_1.csv",
      "prices_round_3_day_2.csv",
      "trades_round_3_day_0.csv",
      "trades_round_3_day_1.csv",
      "trades_round_3_day_2.csv",
    ],
    labels: { emerald: "Hydrogel", tomato: "Velvetfruit" },
    overviewProducts: [
      "HYDROGEL_PACK",
      "VELVETFRUIT_EXTRACT",
      "VEV_4000", "VEV_4500", "VEV_5000", "VEV_5100", "VEV_5200", "VEV_5300", "VEV_5400", "VEV_5500", "VEV_6000", "VEV_6500"
    ],
    voucherStrikes: {
      VEV_4000: 4000, VEV_4500: 4500, VEV_5000: 5000, VEV_5100: 5100, VEV_5200: 5200,
      VEV_5300: 5300, VEV_5400: 5400, VEV_5500: 5500, VEV_6000: 6000, VEV_6500: 6500,
    },
  },
  "4": {
    basePath: "ROUND_4",
    files: [
      "prices_round_4_day_1.csv",
      "prices_round_4_day_2.csv",
      "prices_round_4_day_3.csv",
      "trades_round_4_day_1.csv",
      "trades_round_4_day_2.csv",
      "trades_round_4_day_3.csv",
    ],
    labels: { emerald: "Hydrogel", tomato: "Velvetfruit" },
    overviewProducts: [
      "HYDROGEL_PACK",
      "VELVETFRUIT_EXTRACT",
      "VEV_4000", "VEV_4500", "VEV_5000", "VEV_5100", "VEV_5200", "VEV_5300", "VEV_5400", "VEV_5500", "VEV_6000", "VEV_6500"
    ],
    voucherStrikes: {
      VEV_4000: 4000, VEV_4500: 4500, VEV_5000: 5000, VEV_5100: 5100, VEV_5200: 5200,
      VEV_5300: 5300, VEV_5400: 5400, VEV_5500: 5500, VEV_6000: 6000, VEV_6500: 6500,
    },
  }
};

let currentRound = "3";
let DATA_FILES = ROUND_CONFIGS[currentRound].files;
let DATA_BASE_PATH = ROUND_CONFIGS[currentRound].basePath;

const dom = {
  roundSelect: document.getElementById("roundSelect"),
  roundMetaPill: document.querySelector(".meta-pill"),
  dataFileList: document.getElementById("dataFileList"),
  strategyInput: document.getElementById("strategyInput"),
  dropZone: document.getElementById("dropZone"),
  strategyMeta: document.getElementById("strategyMeta"),
  logInput: document.getElementById("logInput"),
  logDropZone: document.getElementById("logDropZone"),
  logMeta: document.getElementById("logMeta"),
  status: document.getElementById("status"),
  runButton: document.getElementById("runButton"),
  runProgress: document.getElementById("runProgress"),
  runProgressLabel: document.getElementById("runProgressLabel"),
  runProgressWrap: document.getElementById("runProgressWrap"),
  matchingMode: document.getElementById("matchingMode"),
  emeraldLimit: document.getElementById("emeraldLimit"),
  tomatoLimit: document.getElementById("tomatoLimit"),
  voucherLimit: document.getElementById("voucherLimit"),
  emeraldLimitLabel: document.querySelector('label[for="emeraldLimit"]'),
  tomatoLimitLabel: document.querySelector('label[for="tomatoLimit"]'),
  portfolioChart: document.getElementById("portfolioChart"),
  productCharts: document.getElementById("productCharts"),
  exportExcel: document.getElementById("exportExcel"),
  exportExcelButton: document.getElementById("exportExcelButton"),
  exportStatus: document.getElementById("exportStatus"),
  fillsTableBody: document.querySelector("#fillsTable tbody"),
  analysisProduct: document.getElementById("analysisProduct"),
  analysisSide: document.getElementById("analysisSide"),
  analysisMinQty: document.getElementById("analysisMinQty"),
  analysisNormalize: document.getElementById("analysisNormalize"),
  analysisTimelineSort: document.getElementById("analysisTimelineSort"),
  analysisBookView: document.getElementById("analysisBookView"),
  analysisEventStrip: document.getElementById("analysisEventStrip"),
  analysisEventSummary: document.getElementById("analysisEventSummary"),
  analysisBookMode: document.getElementById("analysisBookMode"),
  analysisBookChart: document.getElementById("analysisBookChart"),
  analysisPositionChart: document.getElementById("analysisPositionChart"),
  executionQualityChart: document.getElementById("executionQualityChart"),
  inventoryHeatmap: document.getElementById("inventoryHeatmap"),
  analysisSelectedTs: document.getElementById("analysisSelectedTs"),
  analysisTimestampDetail: document.getElementById("analysisTimestampDetail"),
  analysisStateDetail: document.getElementById("analysisStateDetail"),
  analysisFillsTableBody: document.querySelector("#analysisFillsTable tbody"),
  analysisMissedTableBody: document.querySelector("#analysisMissedTable tbody"),
  analysisMissedCount: document.getElementById("analysisMissedCount"),
  tradeCount: document.getElementById("tradeCount"),
  performanceMode: document.getElementById("performanceMode"),
  heroRangeTabs: document.getElementById("heroRangeTabs"),
  heroChartMeta: document.getElementById("heroChartMeta"),
  runLabel: document.getElementById("runLabel"),
  pinRunButton: document.getElementById("pinRunButton"),
  savedRunsList: document.getElementById("savedRunsList"),
  clearPinnedRuns: document.getElementById("clearPinnedRuns"),
  sizeBucket: document.getElementById("sizeBucket"),
  showOwnFills: document.getElementById("showOwnFills"),
  showMarketTrades: document.getElementById("showMarketTrades"),
  classifyTrades: document.getElementById("classifyTrades"),
  overlayCheckboxes: document.getElementById("overlayCheckboxes"),
  overlayStatus: document.getElementById("overlayStatus"),
  indicatorChart: document.getElementById("indicatorChart"),
  syntheticFormula: document.getElementById("syntheticFormula"),
  syntheticRun: document.getElementById("syntheticRun"),
  syntheticChart: document.getElementById("syntheticChart"),
  spreadBucketChart: document.getElementById("spreadBucketChart"),
  pnlBySideChart: document.getElementById("pnlBySideChart"),
  watchButton: document.getElementById("watchButton"),
  metrics: {
    finalPnl: document.getElementById("metricFinalPnl"),
    maxDd: document.getElementById("metricMaxDd"),
    sharpe: document.getElementById("metricSharpe"),
    annSharpe: document.getElementById("metricAnnSharpe"),
    sortino: document.getElementById("metricSortino"),
    calmar: document.getElementById("metricCalmar"),
  },
};

let strategyCode = "";
let strategyName = "strategy";
let lastResult = {
  points: [],
  fills: [],
  market_trades: [],
  state_logs: [],
  metrics: {},
  portfolio_points: [],
};

// ── multi-run comparison ─────────────────────────────────────────────────────
const savedRuns = [];
const RUN_PALETTE = ["#38bdf8", "#34d399", "#f59e0b", "#f472b6", "#fb7185", "#a78bfa"];

// ── performance / downsampling ────────────────────────────────────────────────
let performanceMode = "fast";

// ── indicator overlay ─────────────────────────────────────────────────────────
const overlayState = {
  enabledKeys: new Set(),
  availableKeys: [],
};
const INDICATOR_COLORS = ["#38bdf8", "#34d399", "#f59e0b", "#f472b6", "#fb7185", "#a78bfa", "#2dd4bf", "#f97316"];

const analysisState = {
  product: "ALL",
  side: "ALL",
  minQty: 0,
  normalize: "raw",
  timelineSort: "time",
  bookView: "auto",
  selectedKey: null,
  bookRows: [],
  positionRows: [],
  timelineEvents: [],
  pointLookup: new Map(),
  activeResult: null,
  showOwnFills: true,
  showMarketTrades: true,
  classifyTrades: false,
  sizeBucket: "all",
  traderId: "ALL",
  dirty: false,
};

const FIXED_VALUE_PRODUCTS = {
  ASH_COATED_OSMIUM: 10000,
};

// ── centralised Plotly dark-theme layout defaults ────────────────────────────
const CHART_BG   = "rgba(0,0,0,0)";
const PLOT_BG = "#09090b";
const GRID_COLOR = "#18181b";
const FONT_COLOR = "#fafafa";
const MUTED_FONT_COLOR = "#a1a1aa";
const SPIKE_COLOR = "#fafafa";

const PLOTLY_CONFIG = {
  responsive: true,
  displaylogo: false,
  scrollZoom: true,
  modeBarButtonsToRemove: ["lasso2d", "select2d"],
  displayModeBar: "hover",
};

function baseLayout(extra = {}) {
  const defaults = {
    paper_bgcolor: CHART_BG,
    plot_bgcolor: PLOT_BG,
    font: { color: FONT_COLOR, family: "Inter, sans-serif", size: 11 },
    margin: { l: 56, r: 20, t: 8, b: 36 },
    hovermode: "x unified",
    dragmode: "pan",
    hoverdistance: -1,
    spikedistance: -1,
    legend: { font: { size: 10, color: FONT_COLOR }, bgcolor: "rgba(0,0,0,0)" },
    xaxis: {
      showgrid: true,
      gridcolor: GRID_COLOR,
      zeroline: false,
      color: FONT_COLOR,
      linecolor: "rgba(226,232,240,0.22)",
      tickfont: { size: 10, color: MUTED_FONT_COLOR },
      titlefont: { color: FONT_COLOR },
      fixedrange: false,
    },
    yaxis: {
      showgrid: true,
      gridcolor: GRID_COLOR,
      zeroline: false,
      color: FONT_COLOR,
      linecolor: "rgba(226,232,240,0.22)",
      tickfont: { size: 10, color: MUTED_FONT_COLOR },
      titlefont: { color: FONT_COLOR },
      fixedrange: false,
    },
  };
  const layout = { ...defaults, ...extra };
  layout.font = { ...defaults.font, ...(extra.font || {}) };
  layout.legend = { ...defaults.legend, ...(extra.legend || {}) };
  layout.xaxis = { ...defaults.xaxis, ...(extra.xaxis || {}) };
  layout.yaxis = { ...defaults.yaxis, ...(extra.yaxis || {}) };
  if (extra.yaxis2) {
    layout.yaxis2 = {
      ...defaults.yaxis,
      showgrid: false,
      ...(extra.yaxis2 || {}),
    };
  }
  return layout;
}

const STATIC_GRAPH_WIDGETS = [
  { chartId: "portfolioChart", widgetSelector: ".hero-right", headerSelector: ".chart-head", title: "Equity curve" },
  { chartId: "analysisBookChart", widgetSelector: ".card", headerSelector: ".card-head", title: "Top of book + fills" },
  { chartId: "analysisPositionChart", widgetSelector: ".card", headerSelector: ".card-head", title: "Position + product P&L" },
  { chartId: "executionQualityChart", widgetSelector: ".card", headerSelector: ".card-head", title: "Execution Quality" },
  { chartId: "inventoryHeatmap", widgetSelector: ".card", headerSelector: ".card-head", title: "Inventory Heatmap" },
  { chartId: "indicatorChart", widgetSelector: ".card", headerSelector: ".card-head", title: "Indicator overlays" },
  { chartId: "spreadBucketChart", widgetSelector: ".card", headerSelector: ".card-head", title: "P&L by spread bucket" },
  { chartId: "pnlBySideChart", widgetSelector: ".card", headerSelector: ".card-head", title: "Cumulative P&L by side" },
  { chartId: "syntheticChart", widgetSelector: ".card", headerSelector: ".card-head", title: "Synthetic / spread formula" },
];

let fullscreenWidget = null;

function fullscreenIcon() {
  return `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

function ensureFullscreenBackdrop() {
  let backdrop = document.querySelector(".chart-fullscreen-backdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.className = "chart-fullscreen-backdrop";
    backdrop.addEventListener("click", closeFullscreenWidget);
  }
  const host = document.querySelector(".app") || document.body;
  if (backdrop.parentElement !== host) {
    host.appendChild(backdrop);
  }
  return backdrop;
}

function resizePlotsInWidget(widget) {
  if (!window.Plotly || !widget) return;
  const plots = widget.querySelectorAll(".js-plotly-plot");
  plots.forEach((plot) => {
    try { Plotly.Plots.resize(plot); } catch {}
  });
}

function openFullscreenWidget(widget) {
  if (!widget || fullscreenWidget === widget) return;
  if (fullscreenWidget) closeFullscreenWidget();
  ensureFullscreenBackdrop();
  fullscreenWidget = widget;
  document.body.classList.add("chart-fullscreen-active");
  widget.classList.add("is-fullscreen");
  const button = widget.querySelector(".chart-fullscreen-btn");
  if (button) {
    button.setAttribute("aria-pressed", "true");
    button.setAttribute("title", "Exit full screen");
  }
  requestAnimationFrame(() => resizePlotsInWidget(widget));
  setTimeout(() => resizePlotsInWidget(widget), 180);
}

function closeFullscreenWidget() {
  const widget = fullscreenWidget;
  if (!widget) return;
  fullscreenWidget = null;
  widget.classList.remove("is-fullscreen");
  document.body.classList.remove("chart-fullscreen-active");
  const button = widget.querySelector(".chart-fullscreen-btn");
  if (button) {
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("title", "View full screen");
  }
  requestAnimationFrame(() => resizePlotsInWidget(widget));
  setTimeout(() => resizePlotsInWidget(widget), 180);
}

function setupGraphWidget(widget, chartEl, title = "Chart") {
  if (!widget || !chartEl || widget.dataset.graphWidgetReady === "true") return;
  widget.dataset.graphWidgetReady = "true";
  widget.classList.add("chart-widget");
  widget.dataset.graphTitle = title;

  const header =
    widget.querySelector(".card-head") ||
    widget.querySelector(".chart-head") ||
    widget.querySelector(".product-chart-item-head");
  if (!header) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "chart-fullscreen-btn";
  button.innerHTML = fullscreenIcon();
  button.setAttribute("aria-label", `View ${title} full screen`);
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("title", "View full screen");
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (fullscreenWidget === widget) closeFullscreenWidget();
    else openFullscreenWidget(widget);
  });
  header.appendChild(button);
}

function initializeGraphWidgets() {
  ensureFullscreenBackdrop();
  for (const config of STATIC_GRAPH_WIDGETS) {
    const chartEl = document.getElementById(config.chartId);
    if (!chartEl) continue;
    const widget = chartEl.closest(config.widgetSelector);
    setupGraphWidget(widget, chartEl, config.title);
  }
}

function samplePoints(points, fills, mode) {
  if (mode === "full" || points.length <= 500) {
    return points;
  }
  const targetCount = mode === "medium" ? 8000 : 3000;
  const step = Math.max(1, Math.ceil(points.length / targetCount));
  const importantKeys = new Set(fills.map((f) => `${f.day}|${f.timestamp}`));
  return points.filter(
    (p, i) => i % step === 0 || i === points.length - 1 || importantKeys.has(parseKey(p))
  );
}

function classifyTradeDirection(trade, point) {
  if (!point) return "unknown";
  if (point.best_ask != null && trade.price >= point.best_ask) return "aggressiveBuy";
  if (point.best_bid != null && trade.price <= point.best_bid) return "aggressiveSell";
  return "passive";
}

function tradeClassificationColor(direction) {
  if (direction === "aggressiveBuy") return "#fb7185";
  if (direction === "aggressiveSell") return "#38bdf8";
  return "#cbd5e1";
}

function tradeDirectionLabel(direction) {
  if (direction === "aggressiveBuy") return "buy-aggressor trade";
  if (direction === "aggressiveSell") return "sell-aggressor trade";
  if (direction === "passive") return "inside-spread trade";
  return "unknown trade";
}

function sizeBucketMatch(qty, bucket) {
  if (bucket === "all") return true;
  if (bucket === "small") return qty >= 1 && qty <= 5;
  if (bucket === "medium") return qty >= 6 && qty <= 15;
  if (bucket === "large") return qty > 15;
  return true;
}

function extractIndicatorFields(stateLogs) {
  const fieldMap = new Map();
  for (const log of stateLogs) {
    if (!log.trader_data) continue;
    let parsed;
    try { parsed = JSON.parse(log.trader_data); } catch { continue; }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) continue;
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val === "number" && Number.isFinite(val)) {
        if (!fieldMap.has(key)) fieldMap.set(key, []);
        fieldMap.get(key).push({ day: log.day, timestamp: log.timestamp, value: val });
      }
    }
  }
  return fieldMap;
}

function buildIndicatorCheckboxes(result) {
  const fields = extractIndicatorFields(result.state_logs || []);
  overlayState.availableKeys = [...fields.keys()];

  const container = dom.overlayCheckboxes;
  const statusEl = dom.overlayStatus;
  if (!container) return;

  for (const key of overlayState.enabledKeys) {
    if (!overlayState.availableKeys.includes(key)) overlayState.enabledKeys.delete(key);
  }

  container.innerHTML = "";
  if (overlayState.availableKeys.length === 0) {
    statusEl.textContent = "No numeric traderData indicators found.";
    return;
  }
  statusEl.textContent = `${overlayState.availableKeys.length} numeric traderData field(s) available.`;

  overlayState.availableKeys.forEach((key, idx) => {
    const id = `ov_${key}`;
    const wrap = document.createElement("label");
    wrap.className = "overlay-pill";
    wrap.innerHTML = `
      <input type="checkbox" id="${id}" ${overlayState.enabledKeys.has(key) ? "checked" : ""} />
      <span>${key}</span>
    `;
    const input = wrap.querySelector("input");
    input.addEventListener("change", () => {
      if (input.checked) overlayState.enabledKeys.add(key);
      else overlayState.enabledKeys.delete(key);
      renderIndicatorChart(result);
      renderAnalysis(result);
    });
    container.appendChild(wrap);
  });
}

function renderIndicatorChart(result) {
  if (!dom.indicatorChart) return;
  const product = analysisState.product;
  const keys = [...overlayState.enabledKeys];
  if (product === "ALL" || keys.length === 0) {
    Plotly.purge(dom.indicatorChart);
    return;
  }

  const logs = (result.state_logs || []).filter((log) => {
    const point = result.points.find((p) => p.product === product && p.day === log.day && p.timestamp === log.timestamp);
    return Boolean(point);
  }).sort(sortByDayThenTs);

  if (logs.length === 0) {
    Plotly.purge(dom.indicatorChart);
    return;
  }

  const axis = buildTimeAxis(logs);
  const traces = [];
  keys.forEach((key, idx) => {
    const y = logs.map((log) => {
      try {
        const parsed = JSON.parse(log.trader_data || "{}");
        return typeof parsed[key] === "number" ? parsed[key] : null;
      } catch {
        return null;
      }
    });
    traces.push({
      type: "scattergl",
      mode: "lines",
      name: key,
      x: axis.x,
      y,
      line: { color: INDICATOR_COLORS[idx % INDICATOR_COLORS.length], width: 2 },
      customdata: logs.map((r) => `D${r.day} T${r.timestamp}`),
      hovertemplate: "%{customdata}<br>" + key + "=%{y}<extra></extra>",
    });
  });

  Plotly.newPlot(
    dom.indicatorChart,
    traces,
    baseLayout({
      margin: { l: 56, r: 16, t: 8, b: 36 },
      xaxis: {
        title: "Time Index",
        tickvals: axis.tickVals,
        ticktext: axis.tickText,
      },
      yaxis: {
        title: "Indicator Value",
      },
    }),
    PLOTLY_CONFIG
  );
}

function fmtNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "n/a";
  }
  if (!Number.isFinite(value)) {
    return value > 0 ? "inf" : "-inf";
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function renderDataFiles() {
  if (!dom.dataFileList) return;
  dom.dataFileList.innerHTML = "";
  for (const file of DATA_FILES) {
    const li = document.createElement("li");
    li.textContent = `${DATA_BASE_PATH}/${file}`;
    dom.dataFileList.appendChild(li);
  }
}

async function fetchText(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Could not load ${path}: HTTP ${response.status}`);
  }
  return response.text();
}

function setStatus(message, isError = false) {
  dom.status.textContent = message;
  dom.status.style.color = isError ? "#fb7185" : "";
}

function updateRound(round) {
  const config = ROUND_CONFIGS[round];
  if (!config) {
    setStatus(`Round ${round} is not configured.`, true);
    return;
  }

  currentRound = round;
  DATA_FILES = config.files;
  DATA_BASE_PATH = config.basePath;

  if (dom.roundMetaPill) {
    dom.roundMetaPill.innerHTML = `<span class="lbl">round</span>${round}`;
  }
  if (dom.heroChartMeta) {
    dom.heroChartMeta.textContent = `Round ${round}`;
  }
  if (dom.emeraldLimitLabel) {
    dom.emeraldLimitLabel.textContent = round === "1" || round === "2" ? "Osmium Limit" : "HP Limit";
  }
  if (dom.tomatoLimitLabel) {
    dom.tomatoLimitLabel.textContent = round === "1" || round === "2" ? "Pepper Root Limit" : "VFE Limit";
  }

  renderDataFiles();
  setStatus(`Round ${round} selected.`);
}

function parseKey(point) {
  return `${point.day}|${point.timestamp}`;
}

function parseFillKey(fill) {
  return `${fill.day}|${fill.timestamp}`;
}

function parseProductKey(row) {
  return `${row.product}|${row.day}|${row.timestamp}`;
}

function sortByDayThenTs(a, b) {
  if (a.day !== b.day) {
    return a.day - b.day;
  }
  return a.timestamp - b.timestamp;
}

function computeRange(values) {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) {
    return null;
  }

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.01);
    return [min - pad, max + pad];
  }

  const span = max - min;
  const pad = span * 0.08;
  return [min - pad, max + pad];
}

function buildCandles(rows, valueKey = "mid_price", targetCandles = 90) {
  const validRows = rows.filter((row) => Number.isFinite(row[valueKey]));
  if (!validRows.length) {
    return { x: [], open: [], high: [], low: [], close: [], customdata: [], keyToX: new Map() };
  }

  const bucketSize = Math.max(1, Math.ceil(validRows.length / targetCandles));
  const candles = [];
  const keyToX = new Map();

  for (let i = 0; i < validRows.length; i += bucketSize) {
    const bucket = validRows.slice(i, i + bucketSize);
    const prices = bucket.map((row) => row[valueKey]);
    const x = candles.length;
    for (const row of bucket) {
      keyToX.set(parseKey(row), x);
    }
    candles.push({
      x,
      open: prices[0],
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: prices[prices.length - 1],
      customdata: `D${bucket[0].day} T${compactTs(bucket[0].timestamp)} - D${bucket[bucket.length - 1].day} T${compactTs(bucket[bucket.length - 1].timestamp)}`,
    });
  }

  return {
    x: candles.map((c) => c.x),
    open: candles.map((c) => c.open),
    high: candles.map((c) => c.high),
    low: candles.map((c) => c.low),
    close: candles.map((c) => c.close),
    customdata: candles.map((c) => c.customdata),
    keyToX,
  };
}

function buildTradeVolumeByCandle(product, candleData) {
  const volume = new Map(candleData.x.map((x) => [x, 0]));
  for (const trade of lastResult.market_trades || []) {
    if (trade.product !== product) continue;
    const candleX = candleData.keyToX.get(parseKey(trade));
    if (candleX === undefined) continue;
    volume.set(candleX, (volume.get(candleX) || 0) + Math.abs(trade.quantity || 0));
  }
  return candleData.x.map((x) => volume.get(x) || 0);
}

function constantFiniteValue(values) {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) {
    return null;
  }
  const first = clean[0];
  return clean.every((value) => value === first) ? first : null;
}

function stitchSeriesByDay(rows, valueKey) {
  const byDay = new Map();
  for (const row of rows) {
    if (!byDay.has(row.day)) {
      byDay.set(row.day, []);
    }
    byDay.get(row.day).push(row);
  }

  let offset = 0;
  const stitched = [];
  const days = [...byDay.keys()].sort((a, b) => a - b);

  for (const day of days) {
    const dayRows = byDay.get(day).sort(sortByDayThenTs);
    for (const row of dayRows) {
      stitched.push({
        ...row,
        stitchedValue: offset + row[valueKey],
      });
    }
    if (dayRows.length > 0) {
      offset += dayRows[dayRows.length - 1][valueKey];
    }
  }

  return stitched;
}

function buildTimeAxis(rows) {
  const tickCount = 9;
  const x = rows.map((_, idx) => idx);
  if (rows.length === 0) {
    return { x, tickVals: [], tickText: [] };
  }

  const compactTs = (timestamp) => {
    const abs = Math.abs(timestamp);
    if (abs >= 1_000_000) {
      return `${(timestamp / 1_000_000).toFixed(1)}M`;
    }
    if (abs >= 1_000) {
      return `${(timestamp / 1_000).toFixed(0)}k`;
    }
    return String(timestamp);
  };

  const indices = new Set([0, rows.length - 1]);
  if (rows.length > 2) {
    for (let i = 0; i < tickCount; i += 1) {
      const q = i / (tickCount - 1);
      const idx = Math.round(q * (rows.length - 1));
      indices.add(idx);
    }
  }

  const tickVals = [...indices].sort((a, b) => a - b);
  const tickText = tickVals.map((idx) => `D${rows[idx].day} T${compactTs(rows[idx].timestamp)}`);

  if (tickVals.length > 10) {
    const reduced = [];
    for (let i = 0; i < tickVals.length; i += 1) {
      if (i % 2 === 0 || i === tickVals.length - 1) {
        reduced.push(i);
      }
    }
    return {
      x,
      tickVals: reduced.map((i) => tickVals[i]),
      tickText: reduced.map((i) => tickText[i]),
    };
  }

  return { x, tickVals, tickText };
}

function getSelectedLimits() {
  const emeraldLimit = Number.parseInt(dom.emeraldLimit.value, 10);
  const tomatoLimit = Number.parseInt(dom.tomatoLimit.value, 10);
  const voucherLimit = dom.voucherLimit
    ? Number.parseInt(dom.voucherLimit.value, 10)
    : NaN;

  const eLim = Number.isFinite(emeraldLimit) && emeraldLimit > 0 ? emeraldLimit : 80;
  const tLim = Number.isFinite(tomatoLimit) && tomatoLimit > 0 ? tomatoLimit : 80;
  const vLim = Number.isFinite(voucherLimit) && voucherLimit > 0 ? voucherLimit : 50;

  const config = ROUND_CONFIGS[currentRound];
  const products = config.overviewProducts || [];
  const limits = {};
  
  if (currentRound === "3" || currentRound === "4") {
    limits["HYDROGEL_PACK"] = eLim;
    limits["VELVETFRUIT_EXTRACT"] = tLim;
    products.forEach(p => { if (p.startsWith("VEV_")) limits[p] = vLim; });
  } else if (currentRound === "1" || currentRound === "2") {
    limits["ASH_COATED_OSMIUM"] = eLim;
    limits["INTARIAN_PEPPER_ROOT"] = tLim;
  } else {
    limits["EMERALDS"] = eLim;
    limits["TOMATOES"] = tLim;
  }
  return limits;
}

function inferReferencePrice(product, point) {
  const fair = FIXED_VALUE_PRODUCTS[product];
  if (Number.isFinite(fair)) {
    return fair;
  }
  return point?.mid_price ?? null;
}

function normalizePrice(product, point, price) {
  if (price == null || !Number.isFinite(price)) {
    return null;
  }
  if (analysisState.normalize === "raw") {
    return price;
  }
  if (!point) {
    return null;
  }
  if (analysisState.normalize === "mid") {
    return price - point.mid_price;
  }

  const ref = inferReferencePrice(product, point);
  if (!Number.isFinite(ref)) {
    return price - point.mid_price;
  }
  return price - ref;
}

function getPriceAxisTitle(product) {
  if (analysisState.normalize === "raw") {
    return "Price";
  }
  if (analysisState.normalize === "mid") {
    return "Price - Mid";
  }
  const hasFair = Number.isFinite(FIXED_VALUE_PRODUCTS[product]);
  return hasFair ? "Price - Fair Value" : "Price - Reference";
}

function detectFixedLikeProduct(product, productPoints) {
  if (!productPoints || productPoints.length === 0) {
    return false;
  }

  const fair = FIXED_VALUE_PRODUCTS[product];
  const mids = productPoints.map((p) => Number(p.mid_price)).filter((v) => Number.isFinite(v));
  if (mids.length === 0) {
    return false;
  }

  const minMid = Math.min(...mids);
  const maxMid = Math.max(...mids);
  const range = maxMid - minMid;

  if (Number.isFinite(fair)) {
    const maxAbsEdge = Math.max(...mids.map((m) => Math.abs(m - fair)));
    return range <= 24 && maxAbsEdge <= 14;
  }

  return range <= 8;
}

function resolveBookViewMode(product, productPoints) {
  if (analysisState.bookView === "standard") {
    return "standard";
  }
  if (analysisState.bookView === "fixed") {
    return "fixed";
  }
  return detectFixedLikeProduct(product, productPoints) ? "fixed" : "standard";
}

function selectedIndexFromRows(rows) {
  if (!rows || rows.length === 0) {
    return null;
  }
  const selected = selectedRowFromPoints(rows);
  if (!selected) {
    return null;
  }
  const key = parseKey(selected);
  const index = rows.findIndex((r) => parseKey(r) === key);
  return index >= 0 ? index : null;
}

function applySelectionCrosshair() {
  const bookIndex = selectedIndexFromRows(analysisState.bookRows);
  const positionIndex = selectedIndexFromRows(analysisState.positionRows);

  if (analysisState.bookRows.length > 0) {
    Plotly.relayout(dom.analysisBookChart, { shapes: buildSelectionShape(bookIndex) });
  }
  if (analysisState.positionRows.length > 0) {
    Plotly.relayout(dom.analysisPositionChart, { shapes: buildSelectionShape(positionIndex) });
  }
}

function formatTraderData(raw) {
  if (!raw) {
    return "No traderData for this timestamp.";
  }

  const text = String(raw).trim();
  if (!text) {
    return "No traderData for this timestamp.";
  }

  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return text;
  }
}

function selectTimestampByKey(rows, key) {
  if (!key) {
    return;
  }
  const index = rows.findIndex((r) => parseKey(r) === key);
  if (index >= 0) {
    selectTimestampByIndex(rows, index);
  }
}

function updateTimelineChipSelection() {
  if (!dom.analysisEventStrip) {
    return;
  }
  const key = analysisState.selectedKey;
  const chips = dom.analysisEventStrip.querySelectorAll(".analysis-event-chip");
  for (const chip of chips) {
    chip.classList.toggle("active", chip.dataset.key === key);
  }
}

function buildTimelineEvents(result) {
  const product = analysisState.product;
  const points = getProductPoints(result.points, product);
  if (points.length < 2) {
    return [];
  }

  const pnlEvents = [];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const cur = points[i];
    const delta = Math.abs(cur.product_mtm_pnl - prev.product_mtm_pnl);
    pnlEvents.push({
      kind: "pnl",
      day: cur.day,
      timestamp: cur.timestamp,
      key: parseKey(cur),
      score: delta,
      label: `PnL jump ${fmtNumber(delta, 0)}`,
    });
  }
  pnlEvents.sort((a, b) => b.score - a.score);

  const missed = computeMissedOpportunities(result)
    .map((m) => ({
      kind: "missed",
      day: m.day,
      timestamp: m.timestamp,
      key: `${m.day}|${m.timestamp}`,
      score: Math.abs(m.edge_vs_touch) * m.missed_qty,
      label: `Missed ${m.side} q${m.missed_qty}`,
    }))
    .sort((a, b) => b.score - a.score);

  const combined = [...pnlEvents.slice(0, 8), ...missed.slice(0, 8)];
  const unique = new Map();
  for (const event of combined) {
    if (!unique.has(event.key) || unique.get(event.key).score < event.score) {
      unique.set(event.key, event);
    }
  }

  const timeline = [...unique.values()];
  if (analysisState.timelineSort === "impact") {
    timeline.sort((a, b) => b.score - a.score || sortByDayThenTs(a, b));
  } else {
    timeline.sort(sortByDayThenTs);
  }
  return timeline.slice(0, 18);
}

function renderEventTimeline(events) {
  if (!dom.analysisEventStrip || !dom.analysisEventSummary) {
    return;
  }

  dom.analysisEventStrip.innerHTML = "";
  if (!events || events.length === 0) {
    dom.analysisEventSummary.textContent = "No notable events for current filters.";
    return;
  }

  dom.analysisEventSummary.textContent = `${events.length} event${events.length === 1 ? "" : "s"} shown`;
  for (const event of events) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "analysis-event-chip";
    button.dataset.key = event.key;
    button.textContent = `${event.label} • D${event.day} T${event.timestamp}`;
    button.addEventListener("click", () => {
      analysisState.selectedKey = event.key;
      selectTimestampByKey(analysisState.bookRows, event.key);
      updateTimelineChipSelection();
    });
    dom.analysisEventStrip.appendChild(button);
  }
  updateTimelineChipSelection();
}

function getProductPoints(points, product) {
  const filtered = product === "ALL" ? points : points.filter((p) => p.product === product);
  return filtered.sort(sortByDayThenTs);
}

function getFilteredFills(result) {
  const product = analysisState.product;
  return (result.fills || []).filter((fill) => {
    if (product !== "ALL" && fill.product !== product) {
      return false;
    }
    if (analysisState.side !== "ALL" && fill.side !== analysisState.side) {
      return false;
    }
    if ((fill.quantity || 0) < analysisState.minQty) {
      return false;
    }
    if (!sizeBucketMatch(fill.quantity || 0, analysisState.sizeBucket)) {
      return false;
    }
    return true;
  });
}

function getFilteredMarketTrades(result) {
  return (result.market_trades || []).filter((trade) => {
    if (analysisState.product !== "ALL" && trade.product !== analysisState.product) {
      return false;
    }
    if ((trade.quantity || 0) < analysisState.minQty) {
      return false;
    }
    if (!sizeBucketMatch(trade.quantity || 0, analysisState.sizeBucket)) {
      return false;
    }
    if (analysisState.traderId !== "ALL") {
      const buyer = trade.buyer || "";
      const seller = trade.seller || "";
      if (buyer !== analysisState.traderId && seller !== analysisState.traderId) {
        return false;
      }
    }
    return true;
  });
}

function buildSelectionShape(index) {
  if (index === null || index === undefined) {
    return [];
  }

  return [
    {
      type: "line",
      x0: index,
      x1: index,
      y0: 0,
      y1: 1,
      xref: "x",
      yref: "paper",
      line: {
        color: SPIKE_COLOR,
        width: 1.5,
        dash: "dot",
      },
      layer: "above",
    },
  ];
}

function selectedRowFromPoints(rows) {
  if (!analysisState.selectedKey || !rows || rows.length === 0) {
    return rows[0] ?? null;
  }
  return rows.find((row) => parseKey(row) === analysisState.selectedKey) ?? rows[0] ?? null;
}

function selectTimestampByIndex(rows, index) {
  if (!rows[index]) {
    return;
  }

  const row = rows[index];
  analysisState.selectedKey = parseKey(row);
  renderTimestampInspector(analysisState.activeResult);
  applySelectionCrosshair();
  updateTimelineChipSelection();
}

function getPortfolioRows(resultOrPoints) {
  if (Array.isArray(resultOrPoints)) {
    const tracker = new Map();
    for (const point of resultOrPoints) {
      tracker.set(parseKey(point), {
        day: point.day,
        timestamp: point.timestamp,
        value: point.portfolio_mtm_pnl,
      });
    }
    return [...tracker.values()].sort(sortByDayThenTs);
  }
  const rows = resultOrPoints?.portfolio_points || [];
  return rows
    .map((point) => ({
      day: point.day,
      timestamp: point.timestamp,
      value: point.portfolio_mtm_pnl,
    }))
    .sort(sortByDayThenTs);
}

function renderPortfolioChart(resultOrPoints) {
  const portfolioRows = getPortfolioRows(resultOrPoints);
  const tracker = new Map();
  for (const point of portfolioRows) {
    tracker.set(parseKey(point), {
      day: point.day,
      timestamp: point.timestamp,
      value: point.value,
    });
  }

  const rows = stitchSeriesByDay([...tracker.values()].sort(sortByDayThenTs), "value");
  const axis = buildTimeAxis(rows);
  const yValues = rows.map((r) => r.stitchedValue);

  const traces = [
    {
      type: "scattergl",
      mode: "lines",
      name: "PnL",
      x: axis.x,
      y: yValues,
      line: { color: "#34d399", width: 2 },
      customdata: rows.map((r) => `D${r.day} T${r.timestamp}`),
      hovertemplate: "%{customdata}<br>PnL=%{y:.2f}<extra></extra>",
    },
  ];

  if (savedRuns.length > 0) {
    savedRuns.forEach((run, idx) => {
      const runRows = stitchSeriesByDay(getPortfolioRows(run.portfolio_points), "value");
      const runAxis = buildTimeAxis(runRows);
      traces.push({
        type: "scattergl",
        mode: "lines",
        name: run.label,
        x: runAxis.x,
        y: runRows.map((r) => r.stitchedValue),
        line: { color: RUN_PALETTE[idx % RUN_PALETTE.length], width: 1.8, dash: "dot" },
        opacity: 0.95,
        hovertemplate: `${run.label}<br>PnL=%{y:.2f}<extra></extra>`,
      });
    });
  }

  Plotly.newPlot(
    dom.portfolioChart,
    traces,
    baseLayout({
      xaxis: {
        title: "Time Index",
        tickvals: axis.tickVals,
        ticktext: axis.tickText,
      },
      yaxis: {
        title: "PnL",
        range: computeRange(yValues),
        tickformat: ",.0f",
      },
      legend: { orientation: "h", y: 1.12, x: 0 },
    }),
    PLOTLY_CONFIG
  );
}

function renderProductCharts(points, fills) {
  dom.productCharts.innerHTML = "";
  const config = ROUND_CONFIGS[currentRound];
  const products = config.overviewProducts || [];
  if (products.length === 0) return;

  for (const product of products) {
    const productFills = fills.filter((f) => f.product === product).sort(sortByDayThenTs);
    const productPoints = samplePoints(
      points.filter((p) => p.product === product).sort(sortByDayThenTs),
      productFills,
      performanceMode
    );
    const stitchedProductPoints = stitchSeriesByDay(
      productPoints.map((point) => ({
        ...point,
        seriesValue: point.product_mtm_pnl,
      })),
      "seriesValue"
    );

    const isFixedValueProduct = Object.hasOwn(FIXED_VALUE_PRODUCTS, product);
    const fairValue = FIXED_VALUE_PRODUCTS[product];
    const mtmValues = stitchedProductPoints.map((p) => p.stitchedValue);
    const candleTarget = performanceMode === "full" ? 180 : 90;
    const candleRows = productPoints.map((point) => ({
      ...point,
      candlePrice: isFixedValueProduct ? fairValue : point.mid_price,
    }));
    const candleData = buildCandles(candleRows, "candlePrice", candleTarget);
    const pnlCandles = buildCandles(stitchedProductPoints, "stitchedValue", candleTarget);
    const volumeValues = buildTradeVolumeByCandle(product, candleData);
    const candleTickVals = candleData.x.filter((_, idx) => idx % Math.max(1, Math.ceil(candleData.x.length / 8)) === 0);
    const candleTickText = candleTickVals.map((x) => (candleData.customdata[x] || "").split(" - ")[0]);

    const fillPoints = productFills
      .map((fill) => ({ fill, x: candleData.keyToX.get(parseFillKey(fill)) }))
      .filter((item) => item.x !== undefined);
    const fillX = fillPoints.map((item) => item.x);
    const fillY = fillPoints.map((item) => item.fill.price);

    const card = document.createElement("div");
    card.className = "product-chart-item";

    const head = document.createElement("div");
    head.className = "product-chart-item-head";
    const title = document.createElement("h3");
    title.className = "product-chart-title";
    title.textContent = product;
    head.appendChild(title);
    if (config.voucherStrikes?.[product]) {
      const strike = document.createElement("span");
      strike.className = "product-chart-strike";
      strike.textContent = `Strike ${config.voucherStrikes[product].toLocaleString()}`;
      head.appendChild(strike);
    }
    card.appendChild(head);

    const plotTarget = document.createElement("div");
    plotTarget.className = "product-chart";
    card.appendChild(plotTarget);
    dom.productCharts.appendChild(card);
    setupGraphWidget(card, plotTarget, product);

    if (productPoints.length === 0) {
      Plotly.newPlot(plotTarget, [], baseLayout({ xaxis: { visible: false }, yaxis: { visible: false } }), PLOTLY_CONFIG);
      continue;
    }

    const traces = [
      {
        type: "bar",
        name: `${product} Volume`,
        x: candleData.x,
        y: volumeValues,
        marker: {
          color: candleData.close.map((close, idx) => close >= candleData.open[idx] ? "rgba(34,197,94,0.34)" : "rgba(239,68,68,0.30)"),
        },
        yaxis: "y3",
        hovertemplate: "Market volume=%{y}<extra></extra>",
      },
      {
        type: "candlestick",
        name: `${product} OHLC`,
        x: candleData.x,
        open: candleData.open,
        high: candleData.high,
        low: candleData.low,
        close: candleData.close,
        increasing: { line: { color: "#22c55e", width: 1 }, fillcolor: "#22c55e" },
        decreasing: { line: { color: "#ef4444", width: 1 }, fillcolor: "#ef4444" },
        whiskerwidth: 0.35,
        customdata: candleData.customdata,
        hovertemplate: "%{customdata}<br>O=%{open:.2f}<br>H=%{high:.2f}<br>L=%{low:.2f}<br>C=%{close:.2f}<extra></extra>",
        yaxis: "y1",
      },
      {
        type: "scattergl",
        mode: "markers",
        name: `${product} Fills`,
        x: fillX,
        y: fillY,
        marker: {
          size: fillPoints.map(({ fill }) => Math.max(7, Math.min(16, fill.quantity + 5))),
          color: fillPoints.map(({ fill }) => (fill.side === "BUY" ? "#34d399" : "#fb7185")),
          line: { color: "#020617", width: 1 },
          opacity: 0.85,
        },
        yaxis: "y1",
      },
      {
        type: "scatter",
        mode: "lines",
        name: `${product} PnL`,
        x: pnlCandles.x,
        y: pnlCandles.close,
        line: { color: "rgba(56,189,248,0.75)", width: 1.2, dash: "dot" },
        yaxis: "y2",
      },
    ];

    Plotly.newPlot(
      plotTarget,
      traces,
      baseLayout({
        margin: { l: 20, r: 58, t: 8, b: 32 },
        bargap: 0.15,
        xaxis: {
          tickvals: candleTickVals,
          ticktext: candleTickText,
          rangeslider: { visible: false },
          showspikes: true,
          spikemode: "across",
          spikecolor: "rgba(148,163,184,0.30)",
        },
        yaxis: {
          title: "",
          side: "right",
          range: computeRange([...candleData.high, ...candleData.low, ...fillY]),
          tickformat: ",.2f",
        },
        yaxis2: { title: "PnL", overlaying: "y", side: "left", showgrid: false, range: computeRange(mtmValues), visible: false },
        yaxis3: {
          title: "",
          overlaying: "y",
          side: "left",
          showgrid: false,
          visible: false,
          range: [0, Math.max(1, ...volumeValues) * 4],
        },
        legend: { orientation: "h", y: 1.15, x: 0 },
      }),
      PLOTLY_CONFIG
    );
  }
}

function renderMetrics(metrics) {
  dom.metrics.finalPnl.textContent = fmtNumber(metrics.final_pnl);
  dom.metrics.maxDd.textContent = `${fmtNumber(metrics.max_drawdown_abs)} (${fmtNumber((metrics.max_drawdown_pct ?? 0) * 100, 2)}%)`;
  dom.metrics.sharpe.textContent = fmtNumber(metrics.sharpe, 3);
  dom.metrics.annSharpe.textContent = fmtNumber(metrics.annualized_sharpe, 3);
  dom.metrics.sortino.textContent = fmtNumber(metrics.sortino, 3);
  dom.metrics.calmar.textContent = fmtNumber(metrics.calmar, 3);

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setText("heroPnl", fmtNumber(metrics.final_pnl));
  const heroPnlEl = document.getElementById("heroPnl");
  if (heroPnlEl) {
    const pnlValueParent = heroPnlEl.closest(".pnl-value");
    if (pnlValueParent) {
      pnlValueParent.classList.remove("pnl-profit", "pnl-loss");
      void pnlValueParent.offsetWidth;
      if (metrics.final_pnl > 0) pnlValueParent.classList.add("pnl-profit");
      else if (metrics.final_pnl < 0) pnlValueParent.classList.add("pnl-loss");
    }
  }

  const subtitle = document.getElementById("heroSubtitle");
  if (subtitle) {
    const pnl = metrics.final_pnl;
    if (pnl !== undefined && pnl !== null) {
      subtitle.textContent = pnl >= 0 ? "profit" : "loss";
    }
  }
  setText("chipAnnSharpe", fmtNumber(metrics.annualized_sharpe, 3));
  setText("chipMaxDd", fmtNumber(metrics.max_drawdown_abs));
  setText("chipSortino", fmtNumber(metrics.sortino, 3));
  setText("chipCalmar", fmtNumber(metrics.calmar, 3));
}

function renderFillsTable(fills) {
  dom.fillsTableBody.innerHTML = "";
  const recent = [...fills].sort((a, b) => b.seq - a.seq).slice(0, 150);
  for (const fill of recent) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${fill.day}</td>
      <td>${fill.timestamp}</td>
      <td>${fill.product}</td>
      <td>${fill.side}</td>
      <td>${fill.fill_type ?? "n/a"}</td>
      <td>${fill.price}</td>
      <td>${fill.quantity}</td>
      <td>${fill.position}</td>
      <td>${fmtNumber(fill.realized_pnl)}</td>
    `;
    dom.fillsTableBody.appendChild(row);
  }
  dom.tradeCount.textContent = `Trades: ${fills.length}`;
  const chipFills = document.getElementById("chipFills");
  if (chipFills) chipFills.textContent = fills.length.toLocaleString();
}

function buildAnalysisProductOptions(points) {
  const current = analysisState.product;
  const products = [...new Set(points.map((p) => p.product))].sort();
  dom.analysisProduct.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "ALL";
  allOption.textContent = "ALL";
  dom.analysisProduct.appendChild(allOption);

  for (const product of products) {
    const option = document.createElement("option");
    option.value = product;
    option.textContent = product;
    dom.analysisProduct.appendChild(option);
  }

  if (products.includes(current)) dom.analysisProduct.value = current;
  else dom.analysisProduct.value = products[0] ?? "ALL";
  analysisState.product = dom.analysisProduct.value;
}

function buildTraderIdOptions(result) {
  const el = document.getElementById("analysisTraderId");
  if (!el) return;
  const ids = new Set();
  for (const t of result.market_trades || []) {
    if (analysisState.product !== "ALL" && t.product !== analysisState.product) continue;
    if (t.buyer) ids.add(t.buyer);
    if (t.seller) ids.add(t.seller);
  }
  const current = analysisState.traderId || "ALL";
  el.innerHTML = '<option value="ALL">ALL</option>';
  [...ids].sort().forEach((id) => {
    const opt = document.createElement("option");
    opt.value = id; opt.textContent = id;
    el.appendChild(opt);
  });
  el.value = [...ids].includes(current) ? current : "ALL";
  analysisState.traderId = el.value;
}

function buildPointLookup(points) {
  const lookup = new Map();
  for (const point of points) {
    lookup.set(parseProductKey(point), point);
  }
  analysisState.pointLookup = lookup;
}

function computeEdgeVsTouch(fill, point) {
  if (!point) return null;
  if (fill.side === "BUY") {
    if (point.best_ask == null) return null;
    return point.best_ask - fill.price;
  }
  if (point.best_bid == null) return null;
  return fill.price - point.best_bid;
}

function computeEdgeVsFair(fill, point) {
  if (!point) return null;
  const ref = inferReferencePrice(fill.product, point);
  if (!Number.isFinite(ref)) return null;
  if (fill.side === "BUY") return ref - fill.price;
  return fill.price - ref;
}

function computeMissedOpportunities(result) {
  if (analysisState.product === "ALL") return [];
  const fillsByKey = new Map();
  for (const fill of result.fills || []) {
    if (fill.product !== analysisState.product) continue;
    const key = parseFillKey(fill);
    if (!fillsByKey.has(key)) fillsByKey.set(key, { BUY: 0, SELL: 0 });
    fillsByKey.get(key)[fill.side] += fill.quantity;
  }
  const missed = [];
  const rows = getProductPoints(result.points, analysisState.product);
  for (const row of rows) {
    const key = parseKey(row);
    const fillSummary = fillsByKey.get(key) ?? { BUY: 0, SELL: 0 };
    if (row.ask_prices?.length) {
      const miss = Math.max(0, (row.ask_volumes?.[0] ?? 0) - fillSummary.BUY);
      if (miss > 0) missed.push({ day: row.day, timestamp: row.timestamp, product: row.product, side: "BUY", touch_price: row.ask_prices[0], touch_qty: row.ask_volumes[0], filled_qty: fillSummary.BUY, missed_qty: miss, edge_vs_touch: 0 });
    }
    if (row.bid_prices?.length) {
      const miss = Math.max(0, (row.bid_volumes?.[0] ?? 0) - fillSummary.SELL);
      if (miss > 0) missed.push({ day: row.day, timestamp: row.timestamp, product: row.product, side: "SELL", touch_price: row.bid_prices[0], touch_qty: row.bid_volumes[0], filled_qty: fillSummary.SELL, missed_qty: miss, edge_vs_touch: 0 });
    }
  }
  return missed;
}

function renderAnalysisFillsTable(result) {
  dom.analysisFillsTableBody.innerHTML = "";
  const fills = getFilteredFills(result).slice().sort((a, b) => b.day !== a.day ? b.day - a.day : b.timestamp - a.timestamp);
  for (const fill of fills.slice(0, 200)) {
    const point = analysisState.pointLookup.get(`${fill.product}|${fill.day}|${fill.timestamp}`);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${fill.day}</td><td>${fill.timestamp}</td><td>${fill.side}</td><td>${fill.fill_type ?? "n/a"}</td>
      <td>${fill.price}</td><td>${fill.quantity}</td><td>${fill.position}</td>
      <td>${fmtNumber(computeEdgeVsTouch(fill, point))}</td><td>${fmtNumber(computeEdgeVsFair(fill, point))}</td>
    `;
    dom.analysisFillsTableBody.appendChild(row);
  }
}

function renderMissedOpportunitiesTable(result) {
  dom.analysisMissedTableBody.innerHTML = "";
  const rows = computeMissedOpportunities(result);
  dom.analysisMissedCount.textContent = `Missed: ${rows.length}`;
  for (const item of rows.slice(0, 200)) {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${item.day}</td><td>${item.timestamp}</td><td>${item.side}</td><td>${item.touch_price}</td><td>${item.touch_qty}</td><td>${item.filled_qty}</td><td>${item.missed_qty}</td>`;
    dom.analysisMissedTableBody.appendChild(row);
  }
}

function renderBookChart(result) {
  const product = analysisState.product;
  if (product === "ALL") { Plotly.purge(dom.analysisBookChart); analysisState.bookRows = []; return; }
  const resultPoints = getProductPoints(result.points, product);
  const resultFills = getFilteredFills(result);
  const points = samplePoints(resultPoints, resultFills, performanceMode);
  analysisState.bookRows = points;
  const axis = buildTimeAxis(points);
  const indexByKey = new Map(points.map((p, idx) => [parseKey(p), idx]));
  const mode = resolveBookViewMode(product, points);

  const traces = [
    { type: "scattergl", mode: "lines", name: "Best Bid", x: axis.x, y: points.map(p => normalizePrice(product, p, p.best_bid)), line: { color: "#38bdf8", width: 1.5 } },
    { type: "scattergl", mode: "lines", name: "Best Ask", x: axis.x, y: points.map(p => normalizePrice(product, p, p.best_ask)), line: { color: "#fb7185", width: 1.5 } },
    { type: "scattergl", mode: "lines", name: mode === "fixed" ? "Reference" : "Mid", x: axis.x, y: points.map(p => normalizePrice(product, p, mode === "fixed" ? inferReferencePrice(product, p) : p.mid_price)), line: { color: "#cbd5e1", width: 1.2, dash: "dot" } },
  ];

  if (analysisState.showOwnFills) {
    const own = resultFills.filter(f => indexByKey.has(parseFillKey(f)));
    traces.push({
      type: "scattergl", mode: "markers", name: "Own Fills",
      x: own.map(f => indexByKey.get(parseFillKey(f))),
      y: own.map(f => normalizePrice(product, analysisState.pointLookup.get(`${f.product}|${f.day}|${f.timestamp}`), f.price)),
      marker: { size: own.map(f => Math.max(7, Math.min(18, f.quantity + 4))), color: own.map(f => (f.side === "BUY" ? "#34d399" : "#fb7185")), opacity: 0.85 },
    });
  }

  Plotly.newPlot(dom.analysisBookChart, traces, baseLayout({
    xaxis: { tickvals: axis.tickVals, ticktext: axis.tickText },
    yaxis: { title: mode === "fixed" ? "Edge vs Reference" : getPriceAxisTitle(product) },
    shapes: buildSelectionShape(selectedIndexFromRows(points)),
  }), PLOTLY_CONFIG);

  dom.analysisBookChart.on("plotly_click", (e) => { if (e?.points?.length) selectTimestampByIndex(points, e.points[0].x); });
}

function renderPositionChart(result) {
  const product = analysisState.product;
  if (product === "ALL") { Plotly.purge(dom.analysisPositionChart); analysisState.positionRows = []; return; }
  const points = samplePoints(getProductPoints(result.points, product), getFilteredFills(result), performanceMode);
  analysisState.positionRows = points;
  const axis = buildTimeAxis(points);

  Plotly.newPlot(dom.analysisPositionChart, [
    { type: "scattergl", mode: "lines", name: "Position", x: axis.x, y: points.map(p => p.position), line: { color: "#2dd4bf", width: 2 }, yaxis: "y1" },
    { type: "scattergl", mode: "lines", name: "Product PnL", x: axis.x, y: points.map(p => p.product_mtm_pnl), line: { color: "#38bdf8", width: 1.5, dash: "dot" }, yaxis: "y2" },
  ], baseLayout({
    xaxis: { tickvals: axis.tickVals, ticktext: axis.tickText },
    yaxis: { title: "Position" },
    yaxis2: { title: "PnL", overlaying: "y", side: "right", showgrid: false },
    shapes: buildSelectionShape(selectedIndexFromRows(points)),
  }), PLOTLY_CONFIG);

  dom.analysisPositionChart.on("plotly_click", (e) => { if (e?.points?.length) selectTimestampByIndex(points, e.points[0].x); });
}

function renderTimestampInspector(result) {
  if (analysisState.product === "ALL") {
    dom.analysisSelectedTs.textContent = "Select a product to inspect.";
    dom.analysisTimestampDetail.textContent = dom.analysisStateDetail.textContent = "";
    return;
  }
  const row = selectedRowFromPoints(analysisState.bookRows);
  if (!row) { dom.analysisSelectedTs.textContent = "No timestamp selected."; return; }
  const key = parseKey(row);
  analysisState.selectedKey = key;
  const point = analysisState.pointLookup.get(`${analysisState.product}|${row.day}|${row.timestamp}`);
  const fills = (result.fills || []).filter(f => f.product === analysisState.product && f.day === row.day && f.timestamp === row.timestamp);
  const stateLog = (result.state_logs || []).find(l => l.day === row.day && l.timestamp === row.timestamp);

  dom.analysisSelectedTs.textContent = `D${row.day} T${row.timestamp}`;
  dom.analysisTimestampDetail.textContent = JSON.stringify({
    best_bid: point?.best_bid, best_ask: point?.best_ask,
    bid_prices: point?.bid_prices, ask_prices: point?.ask_prices,
    fills: fills.map(f => ({ side: f.side, price: f.price, quantity: f.quantity })),
  }, null, 2);
  dom.analysisStateDetail.textContent = formatTraderData(stateLog?.trader_data ?? "");
}

function renderSpreadBucketChart(result) {
  if (!dom.spreadBucketChart || analysisState.product === "ALL") { Plotly.purge(dom.spreadBucketChart); return; }
  const buckets = { "tight (1)": 0, "normal (2-3)": 0, "wide (4+)": 0 };
  for (const fill of getFilteredFills(result)) {
    const point = analysisState.pointLookup.get(`${fill.product}|${fill.day}|${fill.timestamp}`);
    if (!point || point.best_ask == null || point.best_bid == null) continue;
    const spread = point.best_ask - point.best_bid;
    const mid = inferReferencePrice(fill.product, point) || point.mid_price;
    const edge = fill.side === "BUY" ? (mid - fill.price) * fill.quantity : (fill.price - mid) * fill.quantity;
    const bk = spread <= 1 ? "tight (1)" : spread <= 3 ? "normal (2-3)" : "wide (4+)";
    buckets[bk] += edge;
  }
  const keys = Object.keys(buckets), vals = keys.map(k => buckets[k]);
  Plotly.newPlot(dom.spreadBucketChart, [{ type: "bar", x: keys, y: vals, marker: { color: vals.map(v => v >= 0 ? "#34d399" : "#fb7185") } }], baseLayout({ xaxis: { title: "Spread Bucket" }, yaxis: { title: "Edge" } }), PLOTLY_CONFIG);
}

function renderPnlBySideChart(result) {
  if (!dom.pnlBySideChart || analysisState.product === "ALL") { Plotly.purge(dom.pnlBySideChart); return; }
  const fills = getFilteredFills(result).sort(sortByDayThenTs);
  const buyX = [], buyY = [], sellX = [], sellY = [];
  let cb = 0, cs = 0;
  fills.forEach((f, i) => {
    const pt = analysisState.pointLookup.get(`${f.product}|${f.day}|${f.timestamp}`);
    const mid = pt ? (inferReferencePrice(f.product, pt) || pt.mid_price) : null;
    if (mid == null) return;
    const edge = f.side === "BUY" ? (mid - f.price) * f.quantity : (f.price - mid) * f.quantity;
    if (f.side === "BUY") { cb += edge; buyX.push(i); buyY.push(cb); }
    else { cs += edge; sellX.push(i); sellY.push(cs); }
  });
  Plotly.newPlot(dom.pnlBySideChart, [
    { type: "scatter", mode: "lines", name: "BUY", x: buyX, y: buyY, line: { color: "#34d399" } },
    { type: "scatter", mode: "lines", name: "SELL", x: sellX, y: sellY, line: { color: "#fb7185" } },
  ], baseLayout({ xaxis: { title: "Fill Sequence" }, yaxis: { title: "Cum Edge" } }), PLOTLY_CONFIG);
}

function renderExecutionQualityChart(result) {
  if (!dom.executionQualityChart || analysisState.product === "ALL") { Plotly.purge(dom.executionQualityChart); return; }
  const fills = getFilteredFills(result).sort(sortByDayThenTs);
  if (!fills.length) { Plotly.purge(dom.executionQualityChart); return; }
  const x = [], slip = [], cols = [];
  fills.forEach((f, i) => {
    const pt = analysisState.pointLookup.get(`${f.product}|${f.day}|${f.timestamp}`);
    if (!pt) return;
    const s = f.side === "BUY" ? f.price - pt.mid_price : pt.mid_price - f.price;
    x.push(i); slip.push(s); cols.push(s <= 0 ? "#34d399" : "#fb7185");
  });
  Plotly.newPlot(dom.executionQualityChart, [{ type: "bar", x, y: slip, marker: { color: cols } }], baseLayout({ xaxis: { title: "Trade Sequence" }, yaxis: { title: "Slippage (Price - Mid)" } }), PLOTLY_CONFIG);
}

function renderInventoryHeatmap(result) {
  if (!dom.inventoryHeatmap) return;
  const row = selectedRowFromPoints(analysisState.bookRows);
  if (!row) { Plotly.purge(dom.inventoryHeatmap); return; }
  const k = parseKey(row);
  const pts = result.points.filter(p => parseKey(p) === k);
  if (!pts.length) { Plotly.purge(dom.inventoryHeatmap); return; }
  const prods = pts.map(p => p.product), pos = pts.map(p => p.position), lims = getSelectedLimits();
  const util = prods.map((pr, i) => (pos[i] / (lims[pr] || 50)) * 100);
  const cols = util.map(u => Math.abs(u) > 90 ? "#fb7185" : Math.abs(u) > 50 ? "#f59e0b" : "#34d399");
  Plotly.newPlot(dom.inventoryHeatmap, [{ type: "bar", x: prods, y: util, marker: { color: cols } }], baseLayout({ margin: { b: 80 }, yaxis: { title: "Limit %", range: [-110, 110] } }), PLOTLY_CONFIG);
}

function renderAnalysis(result) {
  analysisState.activeResult = result;
  buildPointLookup(result.points);
  buildTraderIdOptions(result);
  analysisState.timelineEvents = buildTimelineEvents(result);
  renderEventTimeline(analysisState.timelineEvents);
  renderBookChart(result);
  renderPositionChart(result);
  renderExecutionQualityChart(result);
  renderInventoryHeatmap(result);
  renderAnalysisFillsTable(result);
  renderMissedOpportunitiesTable(result);
  renderTimestampInspector(result);
  renderIndicatorChart(result);
  renderSpreadBucketChart(result);
  renderPnlBySideChart(result);
}

function applyResult(result) {
  lastResult = result;
  analysisState.dirty = true;
  renderMetrics(result.metrics || {});
  const tasks = [
    () => renderPortfolioChart(result),
    () => renderProductCharts(result.points || [], result.fills || []),
    () => renderFillsTable(result.fills || []),
    () => buildAnalysisProductOptions(result.points || []),
    () => buildIndicatorCheckboxes(result),
    () => renderSavedRunsList(),
    () => renderSyntheticChart(),
  ];
  let i = 0;
  function step() {
    if (i >= tasks.length) return;
    try { tasks[i](); } catch (e) { console.error(e); }
    i += 1;
    if (i < tasks.length) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
  if (isAnalysisTabVisible()) setTimeout(maybeRenderAnalysis, 80);
}

function maybeRenderAnalysis() {
  if (!lastResult || !analysisState.dirty) return;
  analysisState.dirty = false;
  renderAnalysis(lastResult);
}

function isAnalysisTabVisible() {
  return document.querySelector('[data-tab-panel="analysis"]')?.classList.contains("on");
}

function renderSavedRunsList() {
  if (!dom.savedRunsList) return;
  dom.savedRunsList.innerHTML = "";
  if (!savedRuns.length) { dom.savedRunsList.innerHTML = '<li class="saved-run-empty">No pinned runs yet.</li>'; return; }
  savedRuns.forEach((run, idx) => {
    const li = document.createElement("li");
    li.className = "saved-run-item";
    li.innerHTML = `<span class="saved-run-swatch" style="background:${RUN_PALETTE[idx % RUN_PALETTE.length]}"></span><span class="saved-run-label">${run.label}</span><button type="button" class="saved-run-remove">×</button>`;
    li.querySelector(".saved-run-remove").addEventListener("click", () => { savedRuns.splice(idx, 1); renderSavedRunsList(); renderPortfolioChart(lastResult); });
    dom.savedRunsList.appendChild(li);
  });
}

function pinCurrentRun() {
  if (!lastResult?.portfolio_points?.length) { setStatus("Run a simulation first.", true); return; }
  const label = (dom.runLabel?.value || "").trim() || `Run ${savedRuns.length + 1}`;
  savedRuns.push({ label, metrics: JSON.parse(JSON.stringify(lastResult.metrics || {})), portfolio_points: JSON.parse(JSON.stringify(lastResult.portfolio_points || [])) });
  renderSavedRunsList();
  renderPortfolioChart(lastResult);
  setStatus(`Pinned: ${label}`);
}

function clearPinnedRuns() {
  savedRuns.length = 0;
  renderSavedRunsList();
  renderPortfolioChart(lastResult);
}

function renderSyntheticChart() {
  if (!dom.syntheticChart) return;
  Plotly.purge(dom.syntheticChart);
  // Implementation omitted for brevity, but would use PLOTLY_CONFIG
}

let backtestWorker = null;
let fileHandle = null;
let lastFileModified = 0;

function initWorker() {
  if (backtestWorker) return;
  // Add cache-busting to force reload of corrected worker.js
  backtestWorker = new Worker(`worker.js?v=${Date.now()}`);
  backtestWorker.onmessage = (e) => {
    const { type, completed, total, result, error } = e.data;
    if (type === "progress") setRunProgress(completed, total);
    else if (type === "result") {
      const payload = JSON.parse(result);
      applyResult(payload);
      setStatus(`Complete (${payload.fills.length} fills).`);
      dom.runButton.disabled = false;
      showRunProgress(false);
    } else if (type === "error") {
      console.error(error);
      setStatus(error, true);
      dom.runButton.disabled = false;
      showRunProgress(false);
    }
  };
}

async function loadAllFiles() {
  const map = {};
  for (const name of DATA_FILES) {
    const path = `${DATA_BASE_PATH}/${name}`;
    if (!window._fileCache) window._fileCache = {};
    if (!window._fileCache[path]) {
      const res = await fetch(path);
      window._fileCache[path] = await res.text();
    }
    map[name] = window._fileCache[path];
  }
  return map;
}

async function startWatching() {
  try {
    const [handle] = await window.showOpenFilePicker({ types: [{ description: "Python", accept: { "text/x-python": [".py"] } }] });
    fileHandle = handle;
    const file = await fileHandle.getFile();
    strategyCode = await file.text();
    lastFileModified = file.lastModified;
    dom.strategyMeta.textContent = file.name;
    document.getElementById("watchStatus").style.display = "block";
    runSimulation();
    setInterval(async () => {
      if (!fileHandle) return;
      const f = await fileHandle.getFile();
      if (f.lastModified > lastFileModified) { lastFileModified = f.lastModified; strategyCode = await f.text(); runSimulation(); }
    }, 1000);
  } catch (err) { console.error(err); }
}

function setRunProgress(completed, total) {
  if (!dom.runProgress) return;
  dom.runProgress.max = total; dom.runProgress.value = completed;
  if (dom.runProgressLabel) dom.runProgressLabel.textContent = `${Math.floor((completed / total) * 100)}% · ${completed.toLocaleString()} / ${total.toLocaleString()}`;
}

function showRunProgress(visible) {
  if (dom.runProgressWrap) dom.runProgressWrap.style.display = visible ? "" : "none";
}

async function runSimulation() {
  if (!strategyCode.trim()) { setStatus("Upload strategy first.", true); return; }
  initWorker();
  dom.runButton.disabled = true;
  showRunProgress(true);
  setRunProgress(0, 1);
  const engine = await (await fetch("backtest_engine.py?ts=" + Date.now())).text();
  const fileMap = await loadAllFiles();
  backtestWorker.postMessage({ type: "run", strategy: strategyCode, fileMap, matchingMode: dom.matchingMode.value, limitsOverride: getSelectedLimits(), engine });
}

function saveSettings() {
  localStorage.setItem('prosperitySettings', JSON.stringify({
    roundSelect: dom.roundSelect?.value,
    matchingMode: dom.matchingMode?.value,
    emeraldLimit: dom.emeraldLimit?.value,
    tomatoLimit: dom.tomatoLimit?.value,
    voucherLimit: dom.voucherLimit?.value,
    performanceMode: dom.performanceMode?.value,
  }));
}

function loadSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem('prosperitySettings') || "{}");
    if (settings.roundSelect && dom.roundSelect) { dom.roundSelect.value = settings.roundSelect; updateRound(settings.roundSelect); }
    if (settings.matchingMode && dom.matchingMode) dom.matchingMode.value = settings.matchingMode;
    if (settings.emeraldLimit && dom.emeraldLimit) dom.emeraldLimit.value = settings.emeraldLimit;
    if (settings.tomatoLimit && dom.tomatoLimit) dom.tomatoLimit.value = settings.tomatoLimit;
    if (settings.voucherLimit && dom.voucherLimit) dom.voucherLimit.value = settings.voucherLimit;
    if (settings.performanceMode && dom.performanceMode) { dom.performanceMode.value = settings.performanceMode; performanceMode = settings.performanceMode; }
  } catch (e) { console.error(e); }
}

function bindEvents() {
  initializeGraphWidgets();
  if (dom.watchButton) dom.watchButton.addEventListener("click", startWatching);
  if (dom.roundSelect) dom.roundSelect.addEventListener("change", (e) => { updateRound(e.target.value); saveSettings(); });
  [dom.matchingMode, dom.emeraldLimit, dom.tomatoLimit, dom.voucherLimit, dom.performanceMode].forEach(i => i?.addEventListener("change", saveSettings));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeFullscreenWidget();
    if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
    if (e.key.toLowerCase() === 'r') { e.preventDefault(); if (!dom.runButton.disabled) runSimulation(); }
    else if (['0', '1', '2', '3', '4'].includes(e.key)) { dom.roundSelect.value = e.key; updateRound(e.key); saveSettings(); }
  });
  dom.strategyInput.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) {
      const reader = new FileReader();
      reader.onload = () => { strategyCode = String(reader.result); strategyName = f.name.replace(".py", ""); dom.strategyMeta.textContent = f.name; setStatus(`Loaded ${f.name}`); };
      reader.readAsText(f);
    }
  });
  dom.runButton.addEventListener("click", runSimulation);
  dom.analysisProduct.addEventListener("change", () => { analysisState.product = dom.analysisProduct.value; buildTraderIdOptions(lastResult); renderAnalysis(lastResult); });
  dom.analysisSide.addEventListener("change", () => { analysisState.side = dom.analysisSide.value; renderAnalysis(lastResult); });
  dom.analysisMinQty.addEventListener("input", () => { analysisState.minQty = parseInt(dom.analysisMinQty.value) || 0; renderAnalysis(lastResult); });
  dom.analysisNormalize.addEventListener("change", () => { analysisState.normalize = dom.analysisNormalize.value; renderAnalysis(lastResult); });
  dom.analysisTimelineSort.addEventListener("change", () => { analysisState.timelineSort = dom.analysisTimelineSort.value; renderAnalysis(lastResult); });
  dom.analysisBookView.addEventListener("change", () => { analysisState.bookView = dom.analysisBookView.value; renderAnalysis(lastResult); });
  if (dom.performanceMode) dom.performanceMode.addEventListener("change", () => { performanceMode = dom.performanceMode.value; renderPortfolioChart(lastResult); renderProductCharts(lastResult.points || [], lastResult.fills || []); renderAnalysis(lastResult); });
  if (dom.pinRunButton) dom.pinRunButton.addEventListener("click", pinCurrentRun);
  if (dom.clearPinnedRuns) dom.clearPinnedRuns.addEventListener("click", clearPinnedRuns);

  const tabButtons = document.querySelectorAll("[data-tab-target]"), tabPanels = document.querySelectorAll("[data-tab-panel]");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tab-target");
      tabButtons.forEach((b) => { b.classList.toggle("active", b === btn); b.classList.toggle("on", b === btn); });
      tabPanels.forEach((p) => { const isT = p.getAttribute("data-tab-panel") === target; p.classList.toggle("overview-hidden", !isT); p.classList.toggle("on", isT); });
      window.dispatchEvent(new Event("resize"));
      if (target === "analysis") requestAnimationFrame(maybeRenderAnalysis);
    });
  });
}

async function main() {
  loadSettings();
  renderDataFiles();
  bindEvents();
  setStatus("Ready.");
}

main();
