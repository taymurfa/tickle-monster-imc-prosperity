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
  analysisSelectedTs: document.getElementById("analysisSelectedTs"),
  analysisTimestampDetail: document.getElementById("analysisTimestampDetail"),
  analysisStateDetail: document.getElementById("analysisStateDetail"),
  analysisFillsTableBody: document.querySelector("#analysisFillsTable tbody"),
  analysisMissedTableBody: document.querySelector("#analysisMissedTable tbody"),
  analysisMissedCount: document.getElementById("analysisMissedCount"),
  tradeCount: document.getElementById("tradeCount"),
  performanceMode: document.getElementById("performanceMode"),
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
  metrics: {
    finalPnl: document.getElementById("metricFinalPnl"),
    maxDd: document.getElementById("metricMaxDd"),
    sharpe: document.getElementById("metricSharpe"),
    annSharpe: document.getElementById("metricAnnSharpe"),
    sortino: document.getElementById("metricSortino"),
    calmar: document.getElementById("metricCalmar"),
  },
};

let pyodide;
let strategyCode = "";
let strategyName = "strategy";
let lastResult = {
  points: [],
  fills: [],
  market_trades: [],
  state_logs: [],
  metrics: {},
};

// ── multi-run comparison ─────────────────────────────────────────────────────
const savedRuns = [];
const RUN_PALETTE = ["#38bdf8", "#34d399", "#f59e0b", "#f472b6", "#fb7185", "#a78bfa"];
const VOUCHER_STRIKES = {
  VEV_4000: 4000,
  VEV_4500: 4500,
  VEV_5000: 5000,
  VEV_5100: 5100,
  VEV_5200: 5200,
  VEV_5300: 5300,
  VEV_5400: 5400,
  VEV_5500: 5500,
  VEV_6000: 6000,
  VEV_6500: 6500,
};
const VOUCHER_PRODUCTS = Object.keys(VOUCHER_STRIKES);
const ROUND3_OVERVIEW_PRODUCTS = [
  "HYDROGEL_PACK",
  "VELVETFRUIT_EXTRACT",
  ...VOUCHER_PRODUCTS,
];

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
  // feature: rich trade filtering
  showOwnFills: true,
  showMarketTrades: true,
  classifyTrades: false,
  sizeBucket: "all",
  traderId: "ALL",
  // lazy-render flag: analysis charts are heavy; render only when user views the tab
  dirty: false,
};

const FIXED_VALUE_PRODUCTS = {
  ASH_COATED_OSMIUM: 10000,
};

// ── centralised Plotly dark-theme layout defaults ────────────────────────────
const CHART_BG   = "rgba(0,0,0,0)";
const PLOT_BG    = "#171A20";
const GRID_COLOR = "rgba(226,232,240,0.13)";
const FONT_COLOR = "#D6DEE8";
const MUTED_FONT_COLOR = "#9AA8B8";
const SPIKE_COLOR = "#38BDF8";

function baseLayout(extra = {}) {
  const defaults = {
    paper_bgcolor: CHART_BG,
    plot_bgcolor:  PLOT_BG,
    font: { color: FONT_COLOR, family: "JetBrains Mono, monospace", size: 11 },
    margin: { l: 56, r: 20, t: 8, b: 36 },
    hovermode: "x unified",
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
    },
    yaxis: {
      showgrid: true,
      gridcolor: GRID_COLOR,
      zeroline: false,
      color: FONT_COLOR,
      linecolor: "rgba(226,232,240,0.22)",
      tickfont: { size: 10, color: MUTED_FONT_COLOR },
      titlefont: { color: FONT_COLOR },
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

// ── performance: downsample points, always keeping points that have fills ────
// Adaptive: caps the post-sample count so Plotly doesn't choke on a large
// product set (e.g. Round 3's 12 products × 30k ticks each).
function samplePoints(points, fills, mode) {
  if (mode === "full" || points.length <= 500) {
    return points;
  }
  // Target post-sample size, per render call
  const targetCount = mode === "medium" ? 8000 : 3000;
  const step = Math.max(1, Math.ceil(points.length / targetCount));
  const importantKeys = new Set(fills.map((f) => `${f.day}|${f.timestamp}`));
  return points.filter(
    (p, i) => i % step === 0 || i === points.length - 1 || importantKeys.has(parseKey(p))
  );
}

// ── trade classification ──────────────────────────────────────────────────────
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

// ── size bucket filter ────────────────────────────────────────────────────────
function sizeBucketMatch(qty, bucket) {
  if (bucket === "all") return true;
  if (bucket === "small") return qty >= 1 && qty <= 5;
  if (bucket === "medium") return qty >= 6 && qty <= 15;
  if (bucket === "large") return qty > 15;
  return true;
}

// ── indicator overlay: extract numeric keys from traderData JSON ──────────────
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

  // Remove keys that no longer exist
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
        showgrid: true,
        gridcolor: GRID_COLOR,
        zeroline: false,
        color: FONT_COLOR,
      },
      yaxis: {
        title: "Indicator Value",
        showgrid: true,
        gridcolor: GRID_COLOR,
        zeroline: false,
        color: FONT_COLOR,
      },
    }),
    { responsive: true, displaylogo: false }
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
  dom.dataFileList.innerHTML = "";
  for (const file of DATA_FILES) {
    const li = document.createElement("li");
    li.textContent = `${DATA_BASE_PATH}/${file}`;
    dom.dataFileList.appendChild(li);
  }
}

function applyRoundThreeLabels() {
  // Labels are now set in HTML directly (compact "HP Limit" / "VFE Limit")
  // to fit the sidebar width. Kept as a no-op so existing call sites work.
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
  const hydrogelPack = Number.parseInt(dom.emeraldLimit.value, 10);
  const velvetfruitExtract = Number.parseInt(dom.tomatoLimit.value, 10);
  const voucher = dom.voucherLimit
    ? Number.parseInt(dom.voucherLimit.value, 10)
    : NaN;

  const hpLim = Number.isFinite(hydrogelPack) && hydrogelPack > 0 ? hydrogelPack : 200;
  const vfeLim = Number.isFinite(velvetfruitExtract) && velvetfruitExtract > 0 ? velvetfruitExtract : 200;
  const vevLim = Number.isFinite(voucher) && voucher > 0 ? voucher : 300;

  return {
    HYDROGEL_PACK: hpLim,
    VELVETFRUIT_EXTRACT: vfeLim,
    VEV_4000: vevLim, VEV_4500: vevLim, VEV_5000: vevLim, VEV_5100: vevLim,
    VEV_5200: vevLim, VEV_5300: vevLim, VEV_5400: vevLim, VEV_5500: vevLim,
    VEV_6000: vevLim, VEV_6500: vevLim,
  };
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

  const tradeAgg = new Map();
  for (const trade of (result.market_trades || []).filter((t) => t.product === product)) {
    const key = `${trade.day}|${trade.timestamp}`;
    tradeAgg.set(key, (tradeAgg.get(key) || 0) + trade.quantity);
  }
  const tradeEvents = [...tradeAgg.entries()]
    .map(([key, qty]) => {
      const [day, timestamp] = key.split("|").map((v) => Number(v));
      return {
        kind: "trade",
        day,
        timestamp,
        key,
        score: qty,
        label: `Market vol q${qty}`,
      };
    })
    .sort((a, b) => b.score - a.score);

  const combined = [...pnlEvents.slice(0, 8), ...missed.slice(0, 8), ...tradeEvents.slice(0, 8)];
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
  const resultPoints = getProductPoints(result.points, analysisState.product);
  const pointLookup = new Map(resultPoints.map((p) => [parseProductKey(p), p]));

  return (result.fills || []).filter((fill) => {
    if (analysisState.product !== "ALL" && fill.product !== analysisState.product) {
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
    return pointLookup.has(`${fill.product}|${fill.day}|${fill.timestamp}`);
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

function csvEscape(value) {
  if (value == null) {
    return "";
  }
  const text = String(value);
  if (text.includes(",") || text.includes("\n") || text.includes('"')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadCsv(filename, headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }

  const blob = new Blob([`${lines.join("\n")}\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
      const runRows = stitchSeriesByDay(getPortfolioRows(run.result), "value");
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
      margin: { l: 56, r: 20, t: 8, b: 36 },
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
      legend: { orientation: "h", y: 1.08, x: 0 },
    }),
    { responsive: true, displaylogo: false }
  );
}

function renderProductCharts(points, fills) {
  dom.productCharts.innerHTML = "";
  // Round 3 overview is a fixed product surface: HP, VFE, then every voucher
  // strike. Fills are not a good proxy for whether an option chart matters.
  const allProducts = [...new Set(points.map((p) => p.product))];
  const availableProducts = new Set(allProducts);
  const products = ROUND3_OVERVIEW_PRODUCTS.filter(
    (product) => availableProducts.has(product) || VOUCHER_STRIKES[product]
  );
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

    const axis = buildTimeAxis(productPoints);
    const indexByKey = new Map(productPoints.map((p, idx) => [parseKey(p), idx]));

    const isFixedValueProduct = Object.hasOwn(FIXED_VALUE_PRODUCTS, product);
    const fairValue = FIXED_VALUE_PRODUCTS[product];
    const priceValues = isFixedValueProduct ? productFills.map((f) => f.price) : productPoints.map((p) => p.mid_price);
    const bidValues = productPoints.map((p) => p.best_bid);
    const askValues = productPoints.map((p) => p.best_ask);
    const mtmValues = stitchedProductPoints.map((p) => p.stitchedValue);
    const constantPrice = constantFiniteValue(priceValues);
    const constantPnl = constantFiniteValue(mtmValues);
    const constantBid = constantFiniteValue(bidValues);
    const constantAsk = constantFiniteValue(askValues);
    const isConstantMarket = !isFixedValueProduct
      && constantPrice !== null
      && constantPnl !== null
      && productPoints.length > 0;
    const fillX = productFills.map((f) => indexByKey.get(parseFillKey(f))).filter((idx) => idx !== undefined);
    const fillY = productFills
      .map((f) => {
        const idx = indexByKey.get(parseFillKey(f));
        return idx === undefined ? null : f.price;
      })
      .filter((v) => v !== null);

    const card = document.createElement("div");
    card.className = "product-chart-item";

    const head = document.createElement("div");
    head.className = "product-chart-item-head";
    const title = document.createElement("h3");
    title.className = "product-chart-title";
    title.textContent = product;
    head.appendChild(title);
    if (VOUCHER_STRIKES[product]) {
      const strike = document.createElement("span");
      strike.className = "product-chart-strike";
      strike.textContent = `Strike ${VOUCHER_STRIKES[product].toLocaleString()}`;
      head.appendChild(strike);
    }
    if (isConstantMarket) {
      const note = document.createElement("span");
      note.className = "product-chart-note";
      note.textContent = constantBid !== null && constantAsk !== null
        ? `Constant ${fmtNumber(constantBid)} x ${fmtNumber(constantAsk)}`
        : "Flat source data";
      head.appendChild(note);
    }
    card.appendChild(head);

    const plotTarget = document.createElement("div");
    plotTarget.className = "product-chart";
    card.appendChild(plotTarget);
    dom.productCharts.appendChild(card);
    setupGraphWidget(card, plotTarget, product);

    if (productPoints.length === 0) {
      Plotly.newPlot(
        plotTarget,
        [],
        baseLayout({
          xaxis: { visible: false },
          yaxis: { visible: false },
          annotations: [
            {
              text: "No market data found for this product",
              x: 0.5,
              y: 0.5,
              xref: "paper",
              yref: "paper",
              showarrow: false,
              font: { color: MUTED_FONT_COLOR, size: 12 },
            },
          ],
        }),
        { responsive: true, displaylogo: false }
      );
      continue;
    }

    const traces = [
      {
        type: "scatter",
        mode: "markers",
        name: `${product} Fills`,
        x: fillX,
        y: fillY,
        marker: {
          size: productFills.map((f) => Math.max(7, Math.min(16, f.quantity + 5))),
          color: productFills.map((f) => (f.side === "BUY" ? "#34d399" : "#fb7185")),
          opacity: 0.85,
          line: { color: "#0f1218", width: 0.5 },
        },
        hovertemplate: "Fill Price=%{y}<extra></extra>",
        yaxis: "y1",
      },
      {
        type: "scatter",
        mode: "lines",
        name: `${product} PnL`,
        x: axis.x,
        y: mtmValues,
        line: { color: "#38bdf8", width: 1.5, dash: "dot" },
        customdata: stitchedProductPoints.map((p) => `D${p.day} T${p.timestamp}`),
        hovertemplate: "%{customdata}<br>PnL=%{y:.2f}<extra></extra>",
        yaxis: "y2",
      },
    ];

    if (isFixedValueProduct) {
      traces.unshift({
        type: "scatter",
        mode: "lines",
        name: `${product} Fair Value`,
        x: axis.x,
        y: productPoints.map(() => fairValue),
        line: { color: "#2dd4bf", width: 2, dash: "dash" },
        customdata: productPoints.map((p) => `D${p.day} T${p.timestamp}`),
        hovertemplate: "%{customdata}<br>Fair Value=%{y:.0f}<extra></extra>",
        yaxis: "y1",
      });
    } else {
      const priceTraces = [{
        type: "scatter",
        mode: "lines",
        name: `${product} Mid Price`,
        x: axis.x,
        y: priceValues,
        line: { color: "#e2e8f0", width: 1.8 },
        customdata: productPoints.map((p) => `D${p.day} T${p.timestamp}`),
        hovertemplate: "%{customdata}<br>Mid=%{y:.2f}<extra></extra>",
        yaxis: "y1",
      }];

      if (VOUCHER_STRIKES[product]) {
        priceTraces.unshift({
          type: "scatter",
          mode: "lines",
          name: `${product} Best Bid`,
          x: axis.x,
          y: bidValues,
          line: { color: "#38bdf8", width: 1, dash: "dot" },
          customdata: productPoints.map((p) => `D${p.day} T${p.timestamp}`),
          hovertemplate: "%{customdata}<br>Bid=%{y:.2f}<extra></extra>",
          yaxis: "y1",
        });
        priceTraces.push({
          type: "scatter",
          mode: "lines",
          name: `${product} Best Ask`,
          x: axis.x,
          y: askValues,
          line: { color: "#fb7185", width: 1, dash: "dot" },
          customdata: productPoints.map((p) => `D${p.day} T${p.timestamp}`),
          hovertemplate: "%{customdata}<br>Ask=%{y:.2f}<extra></extra>",
          yaxis: "y1",
        });
      }

      traces.unshift(...priceTraces);
    }

    const priceRangeValues = VOUCHER_STRIKES[product]
      ? [...bidValues, ...priceValues, ...askValues, ...fillY]
      : [...priceValues, ...fillY];
    const annotations = isConstantMarket
      ? [
          {
            text: constantBid !== null && constantAsk !== null
              ? `Flat source quotes: bid ${fmtNumber(constantBid)}, ask ${fmtNumber(constantAsk)}, mid ${fmtNumber(constantPrice)}`
              : `Flat source data: price ${fmtNumber(constantPrice)}, PnL ${fmtNumber(constantPnl)}`,
            x: 0.5,
            y: 0.08,
            xref: "paper",
            yref: "paper",
            showarrow: false,
            font: { color: MUTED_FONT_COLOR, size: 11 },
            bgcolor: "rgba(15, 18, 24, 0.72)",
            bordercolor: "rgba(148, 163, 184, 0.2)",
            borderpad: 4,
          },
        ]
      : [];

    Plotly.newPlot(
      plotTarget,
      traces,
      baseLayout({
        margin: { l: 56, r: 56, t: 8, b: 36 },
        xaxis: {
          title: "Time Index",
          tickvals: axis.tickVals,
          ticktext: axis.tickText,
        },
        yaxis: {
          title: "Price",
          range: computeRange(priceRangeValues),
          side: "left",
        },
        yaxis2: {
          title: "PnL",
          overlaying: "y",
          side: "right",
          showgrid: false,
          range: computeRange(mtmValues),
          tickformat: ",.0f",
          color: FONT_COLOR,
        },
        annotations,
        legend: { orientation: "h", y: 1.08, x: 0 },
      }),
      { responsive: true, displaylogo: false }
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

  // Mirror key metrics into the hero chips on the Overview page.
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
      // trigger reflow to restart animation
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

  if (products.includes(current)) {
    dom.analysisProduct.value = current;
  } else {
    dom.analysisProduct.value = products[0] ?? "ALL";
  }
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
  el.innerHTML = "";
  const all = document.createElement("option");
  all.value = "ALL";
  all.textContent = "ALL";
  el.appendChild(all);
  [...ids].sort().forEach((id) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = id;
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
  if (!point) {
    return null;
  }
  if (fill.side === "BUY") {
    if (point.best_ask == null) {
      return null;
    }
    return point.best_ask - fill.price;
  }
  if (point.best_bid == null) {
    return null;
  }
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
  if (analysisState.product === "ALL") {
    return [];
  }

  const fillsByKey = new Map();
  for (const fill of result.fills || []) {
    if (fill.product !== analysisState.product) {
      continue;
    }
    const key = parseFillKey(fill);
    if (!fillsByKey.has(key)) {
      fillsByKey.set(key, { BUY: 0, SELL: 0 });
    }
    fillsByKey.get(key)[fill.side] += fill.quantity;
  }

  const missed = [];
  const rows = getProductPoints(result.points, analysisState.product);
  for (const row of rows) {
    const key = parseKey(row);
    const fillSummary = fillsByKey.get(key) ?? { BUY: 0, SELL: 0 };

    if (row.ask_prices && row.ask_prices.length > 0) {
      const bestAsk = row.ask_prices[0];
      const bestAskQty = Math.max(0, row.ask_volumes?.[0] ?? 0);
      const executed = fillSummary.BUY;
      const missedQty = Math.max(0, bestAskQty - executed);
      if (missedQty > 0) {
        missed.push({
          day: row.day,
          timestamp: row.timestamp,
          product: row.product,
          side: "BUY",
          touch_price: bestAsk,
          touch_qty: bestAskQty,
          filled_qty: executed,
          missed_qty: missedQty,
          edge_vs_touch: 0,
        });
      }
    }

    if (row.bid_prices && row.bid_prices.length > 0) {
      const bestBid = row.bid_prices[0];
      const bestBidQty = Math.max(0, row.bid_volumes?.[0] ?? 0);
      const executed = fillSummary.SELL;
      const missedQty = Math.max(0, bestBidQty - executed);
      if (missedQty > 0) {
        missed.push({
          day: row.day,
          timestamp: row.timestamp,
          product: row.product,
          side: "SELL",
          touch_price: bestBid,
          touch_qty: bestBidQty,
          filled_qty: executed,
          missed_qty: missedQty,
          edge_vs_touch: 0,
        });
      }
    }
  }

  return missed;
}

function renderAnalysisFillsTable(result) {
  dom.analysisFillsTableBody.innerHTML = "";
  const fills = getFilteredFills(result).slice().sort((a, b) => {
    if (b.day !== a.day) {
      return b.day - a.day;
    }
    return b.timestamp - a.timestamp;
  });

  for (const fill of fills.slice(0, 200)) {
    const point = analysisState.pointLookup.get(`${fill.product}|${fill.day}|${fill.timestamp}`);
    const edge = computeEdgeVsTouch(fill, point);
    const edgeMid = computeEdgeVsFair(fill, point);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${fill.day}</td>
      <td>${fill.timestamp}</td>
      <td>${fill.side}</td>
      <td>${fill.fill_type ?? "n/a"}</td>
      <td>${fill.price}</td>
      <td>${fill.quantity}</td>
      <td>${fill.position}</td>
      <td>${edge == null ? "n/a" : fmtNumber(edge, 2)}</td>
      <td>${edgeMid == null ? "n/a" : fmtNumber(edgeMid, 2)}</td>
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
    row.innerHTML = `
      <td>${item.day}</td>
      <td>${item.timestamp}</td>
      <td>${item.side}</td>
      <td>${item.touch_price}</td>
      <td>${item.touch_qty}</td>
      <td>${item.filled_qty}</td>
      <td>${item.missed_qty}</td>
    `;
    dom.analysisMissedTableBody.appendChild(row);
  }
}

function renderBookChart(result) {
  const product = analysisState.product;
  if (product === "ALL") {
    Plotly.purge(dom.analysisBookChart);
    analysisState.bookRows = [];
    return;
  }

  const resultPoints = getProductPoints(result.points, product);
  const resultFills = getFilteredFills(result);
  const resultMarketTrades = getFilteredMarketTrades(result);
  const points = samplePoints(resultPoints, resultFills, performanceMode);
  analysisState.bookRows = points;

  const axis = buildTimeAxis(points);
  const indexByKey = new Map(points.map((p, idx) => [parseKey(p), idx]));
  const mode = resolveBookViewMode(product, points);

  const bestBidY = points.map((point) => normalizePrice(product, point, point.best_bid));
  const bestAskY = points.map((point) => normalizePrice(product, point, point.best_ask));
  const midY = points.map((point) => normalizePrice(product, point, point.mid_price));

  const traces = [
    {
      type: "scattergl",
      mode: "lines",
      name: "Best Bid",
      x: axis.x,
      y: bestBidY,
      line: { color: "#38bdf8", width: 1.5 },
      customdata: points.map((r) => `D${r.day} T${r.timestamp}`),
      hovertemplate: "%{customdata}<br>Bid=%{y}<extra></extra>",
    },
    {
      type: "scattergl",
      mode: "lines",
      name: "Best Ask",
      x: axis.x,
      y: bestAskY,
      line: { color: "#fb7185", width: 1.5 },
      customdata: points.map((r) => `D${r.day} T${r.timestamp}`),
      hovertemplate: "%{customdata}<br>Ask=%{y}<extra></extra>",
    },
    {
      type: "scattergl",
      mode: "lines",
      name: mode === "fixed" ? "Reference" : "Mid",
      x: axis.x,
      y: mode === "fixed"
        ? points.map((point) => normalizePrice(product, point, inferReferencePrice(product, point)))
        : midY,
      line: { color: "#cbd5e1", width: 1.2, dash: "dot" },
      customdata: points.map((r) => `D${r.day} T${r.timestamp}`),
      hovertemplate: "%{customdata}<br>Ref=%{y}<extra></extra>",
    },
  ];

  if (analysisState.showOwnFills) {
    const ownFillRows = resultFills.filter((fill) => indexByKey.has(parseFillKey(fill)));
    traces.push({
      type: "scattergl",
      mode: "markers",
      name: "Own Fills",
      x: ownFillRows.map((fill) => indexByKey.get(parseFillKey(fill))),
      y: ownFillRows.map((fill) => {
        const point = analysisState.pointLookup.get(`${fill.product}|${fill.day}|${fill.timestamp}`);
        return normalizePrice(product, point, fill.price);
      }),
      marker: {
        size: ownFillRows.map((fill) => Math.max(7, Math.min(18, fill.quantity + 4))),
        color: ownFillRows.map((fill) => (fill.side === "BUY" ? "#34d399" : "#fb7185")),
        line: { color: "#0f1218", width: 0.5 },
        opacity: 0.85,
      },
      customdata: ownFillRows.map((fill) => `${fill.side} q${fill.quantity} @ ${fill.price}`),
      hovertemplate: "%{customdata}<extra></extra>",
    });
  }

  if (analysisState.showMarketTrades) {
    const marketRows = resultMarketTrades.filter((trade) => indexByKey.has(`${trade.day}|${trade.timestamp}`));
    traces.push({
      type: "scattergl",
      mode: "markers",
      name: analysisState.classifyTrades ? "Market Trades (Classified)" : "Market Trades",
      x: marketRows.map((trade) => indexByKey.get(`${trade.day}|${trade.timestamp}`)),
      y: marketRows.map((trade) => {
        const point = analysisState.pointLookup.get(`${trade.product}|${trade.day}|${trade.timestamp}`);
        return normalizePrice(product, point, trade.price);
      }),
      marker: {
        size: marketRows.map((trade) => Math.max(5, Math.min(16, trade.quantity + 3))),
        color: marketRows.map((trade) => {
          if (!analysisState.classifyTrades) return "#f59e0b";
          const point = analysisState.pointLookup.get(`${trade.product}|${trade.day}|${trade.timestamp}`);
          return tradeClassificationColor(classifyTradeDirection(trade, point));
        }),
        opacity: 0.75,
        symbol: "diamond",
      },
      customdata: marketRows.map((trade) => {
        const point = analysisState.pointLookup.get(`${trade.product}|${trade.day}|${trade.timestamp}`);
        const direction = tradeDirectionLabel(classifyTradeDirection(trade, point));
        const traderText = [trade.buyer, trade.seller].filter(Boolean).join(" / ");
        return `${direction} q${trade.quantity} @ ${trade.price}${traderText ? ` • ${traderText}` : ""}`;
      }),
      hovertemplate: "%{customdata}<extra></extra>",
    });
  }

  Plotly.newPlot(
    dom.analysisBookChart,
    traces,
    baseLayout({
      margin: { l: 56, r: 16, t: 8, b: 36 },
      xaxis: {
        title: "Time Index",
        tickvals: axis.tickVals,
        ticktext: axis.tickText,
      },
      yaxis: {
        title: mode === "fixed" ? "Edge vs Reference" : getPriceAxisTitle(product),
        range: computeRange([...bestBidY, ...bestAskY, ...midY]),
      },
      shapes: buildSelectionShape(selectedIndexFromRows(points)),
      legend: { orientation: "h", y: 1.08, x: 0 },
    }),
    { responsive: true, displaylogo: false }
  );

  dom.analysisBookChart.on("plotly_click", (event) => {
    if (!event?.points?.length) {
      return;
    }
    selectTimestampByIndex(points, event.points[0].x);
  });
}

function renderPositionChart(result) {
  const product = analysisState.product;
  if (product === "ALL") {
    Plotly.purge(dom.analysisPositionChart);
    analysisState.positionRows = [];
    return;
  }

  const points = samplePoints(
    getProductPoints(result.points, product),
    getFilteredFills(result),
    performanceMode
  );
  analysisState.positionRows = points;
  const axis = buildTimeAxis(points);

  const traces = [
    {
      type: "scattergl",
      mode: "lines",
      name: "Position",
      x: axis.x,
      y: points.map((point) => point.position),
      line: { color: "#2dd4bf", width: 2 },
      customdata: points.map((point) => `D${point.day} T${point.timestamp}`),
      hovertemplate: "%{customdata}<br>Position=%{y}<extra></extra>",
      yaxis: "y1",
    },
    {
      type: "scattergl",
      mode: "lines",
      name: "Product PnL",
      x: axis.x,
      y: points.map((point) => point.product_mtm_pnl),
      line: { color: "#38bdf8", width: 1.5, dash: "dot" },
      customdata: points.map((point) => `D${point.day} T${point.timestamp}`),
      hovertemplate: "%{customdata}<br>PnL=%{y:.2f}<extra></extra>",
      yaxis: "y2",
    },
  ];

  Plotly.newPlot(
    dom.analysisPositionChart,
    traces,
    baseLayout({
      margin: { l: 56, r: 56, t: 8, b: 36 },
      xaxis: {
        title: "Time Index",
        tickvals: axis.tickVals,
        ticktext: axis.tickText,
      },
      yaxis: {
        title: "Position",
        range: computeRange(points.map((point) => point.position)),
      },
      yaxis2: {
        title: "PnL",
        overlaying: "y",
        side: "right",
        showgrid: false,
        range: computeRange(points.map((point) => point.product_mtm_pnl)),
        tickformat: ",.0f",
        color: FONT_COLOR,
      },
      shapes: buildSelectionShape(selectedIndexFromRows(points)),
      legend: { orientation: "h", y: 1.08, x: 0 },
    }),
    { responsive: true, displaylogo: false }
  );

  dom.analysisPositionChart.on("plotly_click", (event) => {
    if (!event?.points?.length) {
      return;
    }
    selectTimestampByIndex(points, event.points[0].x);
  });
}

function renderTimestampInspector(result) {
  if (analysisState.product === "ALL") {
    dom.analysisSelectedTs.textContent = "Select a product to inspect timestamps.";
    dom.analysisTimestampDetail.textContent = "";
    dom.analysisStateDetail.textContent = "";
    return;
  }

  const row = selectedRowFromPoints(analysisState.bookRows);
  if (!row) {
    dom.analysisSelectedTs.textContent = "No timestamp selected.";
    dom.analysisTimestampDetail.textContent = "";
    dom.analysisStateDetail.textContent = "";
    return;
  }

  const key = parseKey(row);
  analysisState.selectedKey = key;
  const point = analysisState.pointLookup.get(`${analysisState.product}|${row.day}|${row.timestamp}`);
  const fills = (result.fills || []).filter(
    (fill) => fill.product === analysisState.product && fill.day === row.day && fill.timestamp === row.timestamp
  );
  const marketTrades = (result.market_trades || []).filter(
    (trade) => trade.product === analysisState.product && trade.day === row.day && trade.timestamp === row.timestamp
  );
  const stateLog = (result.state_logs || []).find(
    (log) => log.day === row.day && log.timestamp === row.timestamp
  );

  dom.analysisSelectedTs.textContent = `D${row.day} T${row.timestamp}`;
  dom.analysisTimestampDetail.textContent = JSON.stringify(
    {
      best_bid: point?.best_bid ?? null,
      best_ask: point?.best_ask ?? null,
      bid_prices: point?.bid_prices ?? [],
      bid_volumes: point?.bid_volumes ?? [],
      ask_prices: point?.ask_prices ?? [],
      ask_volumes: point?.ask_volumes ?? [],
      fills: fills.map((fill) => ({ side: fill.side, price: fill.price, quantity: fill.quantity })),
      market_trades: marketTrades.map((trade) => ({
        price: trade.price,
        quantity: trade.quantity,
        buyer: trade.buyer,
        seller: trade.seller,
      })),
    },
    null,
    2
  );

  dom.analysisStateDetail.textContent = formatTraderData(stateLog?.trader_data ?? "");
}

function renderSpreadBucketChart(result) {
  if (!dom.spreadBucketChart) return;
  const product = analysisState.product;
  if (product === "ALL") {
    Plotly.purge(dom.spreadBucketChart);
    return;
  }

  const fills = getFilteredFills(result);
  const buckets = { "tight (1)": 0, "normal (2-3)": 0, "wide (4+)": 0 };

  for (const fill of fills) {
    const point = analysisState.pointLookup.get(`${fill.product}|${fill.day}|${fill.timestamp}`);
    if (!point || point.best_ask == null || point.best_bid == null) continue;
    const spread = point.best_ask - point.best_bid;
    const ref = inferReferencePrice(fill.product, point);
    const mid = Number.isFinite(ref) ? ref : point.mid_price;
    const edgeContrib = fill.side === "BUY"
      ? (mid - fill.price) * fill.quantity
      : (fill.price - mid) * fill.quantity;
    let bucket;
    if (spread <= 1) bucket = "tight (1)";
    else if (spread <= 3) bucket = "normal (2-3)";
    else bucket = "wide (4+)";
    buckets[bucket] += edgeContrib;
  }

  const keys = Object.keys(buckets);
  const vals = keys.map((k) => buckets[k]);
  const colors = vals.map((v) => (v >= 0 ? "#34d399" : "#fb7185"));

  Plotly.newPlot(
    dom.spreadBucketChart,
    [{ type: "bar", x: keys, y: vals, marker: { color: colors } }],
    baseLayout({
      margin: { l: 56, r: 16, t: 8, b: 48 },
      xaxis: { title: "Spread Bucket" },
      yaxis: { title: "Edge Contribution (est.)", tickformat: ",.0f" },
      showlegend: false,
    }),
    { responsive: true, displaylogo: false }
  );
}

function renderPnlBySideChart(result) {
  if (!dom.pnlBySideChart) return;
  const product = analysisState.product;
  if (product === "ALL") {
    Plotly.purge(dom.pnlBySideChart);
    return;
  }

  const fills = getFilteredFills(result).sort(sortByDayThenTs);
  const buyX = [], buyY = [], sellX = [], sellY = [];
  let cumBuy = 0, cumSell = 0;
  let fillIdx = 0;

  for (const fill of fills) {
    const point = analysisState.pointLookup.get(`${fill.product}|${fill.day}|${fill.timestamp}`);
    const ref = point ? (inferReferencePrice(fill.product, point) || point.mid_price) : null;
    if (ref == null || !Number.isFinite(ref)) { fillIdx++; continue; }
    const edge = fill.side === "BUY"
      ? (ref - fill.price) * fill.quantity
      : (fill.price - ref) * fill.quantity;
    if (fill.side === "BUY") {
      cumBuy += edge;
      buyX.push(fillIdx);
      buyY.push(cumBuy);
    } else {
      cumSell += edge;
      sellX.push(fillIdx);
      sellY.push(cumSell);
    }
    fillIdx++;
  }

  Plotly.newPlot(
    dom.pnlBySideChart,
    [
      { type: "scatter", mode: "lines", name: "BUY fills", x: buyX, y: buyY, line: { color: "#34d399", width: 2 } },
      { type: "scatter", mode: "lines", name: "SELL fills", x: sellX, y: sellY, line: { color: "#fb7185", width: 2 } },
    ],
    baseLayout({
      margin: { l: 56, r: 16, t: 8, b: 36 },
      xaxis: { title: "Fill Sequence" },
      yaxis: { title: "Cumulative Edge vs Mid", tickformat: ",.0f" },
      legend: { orientation: "h", y: 1.08, x: 0 },
    }),
    { responsive: true, displaylogo: false }
  );
}

function renderExecutionQualityChart(result) {
  if (!dom.executionQualityChart) return;
  const product = analysisState.product;
  if (product === "ALL") {
    Plotly.purge(dom.executionQualityChart);
    return;
  }

  const fills = getFilteredFills(result).sort(sortByDayThenTs);
  if (fills.length === 0) {
    Plotly.purge(dom.executionQualityChart);
    return;
  }

  const x = [], slippage = [], colors = [];
  fills.forEach((f, i) => {
    const pt = analysisState.pointLookup.get(`${f.product}|${f.day}|${f.timestamp}`);
    if (!pt) return;
    const mid = pt.mid_price;
    const slip = f.side === "BUY" ? f.price - mid : mid - f.price;
    x.push(i);
    slippage.push(slip);
    colors.push(slip <= 0 ? "#34d399" : "#fb7185"); // green if filled at or better than mid
  });

  Plotly.newPlot(
    dom.executionQualityChart,
    [{
      type: "bar",
      x,
      y: slippage,
      marker: { color: colors },
      hovertemplate: "Fill %{x}<br>Slippage: %{y:.2f}<extra></extra>"
    }],
    baseLayout({
      margin: { l: 56, r: 16, t: 8, b: 36 },
      xaxis: { title: "Trade Sequence" },
      yaxis: { title: "Slippage (Price - Mid)" },
    }),
    { responsive: true, displaylogo: false }
  );
}

function renderInventoryHeatmap(result) {
  if (!dom.inventoryHeatmap) return;
  
  // Inventory heatmap is best viewed across all products for the selected TS
  const row = selectedRowFromPoints(analysisState.bookRows);
  if (!row) {
    Plotly.purge(dom.inventoryHeatmap);
    return;
  }

  const tsKey = parseKey(row);
  const pointsAtTs = result.points.filter(p => parseKey(p) === tsKey);
  if (pointsAtTs.length === 0) {
    Plotly.purge(dom.inventoryHeatmap);
    return;
  }

  const products = pointsAtTs.map(p => p.product);
  const positions = pointsAtTs.map(p => p.position);
  const limits = products.map(p => getSelectedLimits()[p] || 50);
  const utilization = positions.map((pos, i) => (pos / limits[i]) * 100);

  const colors = utilization.map(u => {
    const abs = Math.abs(u);
    if (abs > 90) return "#fb7185"; // danger
    if (abs > 50) return "#f59e0b"; // warning
    return "#34d399"; // healthy
  });

  Plotly.newPlot(
    dom.inventoryHeatmap,
    [{
      type: "bar",
      x: products,
      y: utilization,
      marker: { color: colors },
      hovertemplate: "%{x}<br>Limit Util: %{y:.1f}%<extra></extra>"
    }],
    baseLayout({
      margin: { l: 56, r: 16, t: 8, b: 80 }, // more bottom margin for product names
      xaxis: { title: "", tickangle: -45 },
      yaxis: { title: "Limit Utilization %", range: [-110, 110] },
    }),
    { responsive: true, displaylogo: false }
  );
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
  analysisState.dirty = true;     // mark analysis-tab content stale until viewed
  renderMetrics(result.metrics || {});
  // Render Overview-tab content immediately, but split across animation frames
  // so the browser can repaint between charts (avoids one giant blocking render).
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
  // Analysis tab is rendered on-demand via maybeRenderAnalysis() when user
  // activates that tab (see tab click handler). If user is already viewing
  // it, render now after the overview tasks finish.
  if (isAnalysisTabVisible()) {
    setTimeout(maybeRenderAnalysis, 80);
  }
}

function maybeRenderAnalysis() {
  if (!lastResult || !analysisState.dirty) return;
  analysisState.dirty = false;
  renderAnalysis(lastResult);
}

function isAnalysisTabVisible() {
  const panel = document.querySelector('[data-tab-panel="analysis"]');
  return !!panel && panel.classList.contains("on");
}

function renderSavedRunsList() {
  if (!dom.savedRunsList) return;
  dom.savedRunsList.innerHTML = "";
  if (savedRuns.length === 0) {
    const li = document.createElement("li");
    li.className = "saved-run-empty";
    li.textContent = "No pinned runs yet.";
    dom.savedRunsList.appendChild(li);
    return;
  }

  savedRuns.forEach((run, idx) => {
    const li = document.createElement("li");
    li.className = "saved-run-item";
    li.innerHTML = `
      <span class="saved-run-swatch" style="background:${RUN_PALETTE[idx % RUN_PALETTE.length]}"></span>
      <span class="saved-run-label">${run.label}</span>
      <button type="button" class="saved-run-remove">×</button>
    `;
    li.querySelector(".saved-run-remove").addEventListener("click", () => {
      savedRuns.splice(idx, 1);
      renderSavedRunsList();
      renderPortfolioChart(lastResult);
      renderSyntheticChart();
    });
    dom.savedRunsList.appendChild(li);
  });
}

function pinCurrentRun() {
  if (!lastResult || !lastResult.points || lastResult.points.length === 0) {
    setStatus("Run a simulation before pinning a run.", true);
    return;
  }

  const label = (dom.runLabel?.value || "").trim() || `Run ${savedRuns.length + 1}`;
  savedRuns.push({
    label,
    result: JSON.parse(JSON.stringify(lastResult)),
  });
  renderSavedRunsList();
  renderPortfolioChart(lastResult);
  renderSyntheticChart();
  setStatus(`Pinned run: ${label}`);
}

function clearPinnedRuns() {
  savedRuns.length = 0;
  renderSavedRunsList();
  renderPortfolioChart(lastResult);
  renderSyntheticChart();
}

function parseSyntheticFormula(formula, rowsByProduct) {
  const tokens = formula.match(/[A-Z_]+|\d+(?:\.\d+)?|[()+\-*/]/g);
  if (!tokens) {
    throw new Error("Formula is empty or invalid.");
  }

  const output = [];
  const operators = [];
  const precedence = { "+": 1, "-": 1, "*": 2, "/": 2 };

  const flushOperator = () => {
    output.push(operators.pop());
  };

  for (const token of tokens) {
    if (/^\d/.test(token) || rowsByProduct.has(token)) {
      output.push(token);
      continue;
    }
    if (token === "(") {
      operators.push(token);
      continue;
    }
    if (token === ")") {
      while (operators.length && operators[operators.length - 1] !== "(") {
        flushOperator();
      }
      if (operators.pop() !== "(") {
        throw new Error("Mismatched parentheses in formula.");
      }
      continue;
    }
    if (!["+", "-", "*", "/"].includes(token)) {
      throw new Error(`Unsupported token in formula: ${token}`);
    }
    while (
      operators.length &&
      operators[operators.length - 1] !== "(" &&
      precedence[operators[operators.length - 1]] >= precedence[token]
    ) {
      flushOperator();
    }
    operators.push(token);
  }

  while (operators.length) {
    const op = operators.pop();
    if (op === "(") {
      throw new Error("Mismatched parentheses in formula.");
    }
    output.push(op);
  }

  return output;
}

function evaluateSyntheticRpn(rpn, context) {
  const stack = [];
  for (const token of rpn) {
    if (token in context) {
      stack.push(context[token]);
      continue;
    }
    if (/^\d/.test(token)) {
      stack.push(Number(token));
      continue;
    }
    const b = stack.pop();
    const a = stack.pop();
    if (a == null || b == null) {
      throw new Error("Malformed formula.");
    }
    if (token === "+") stack.push(a + b);
    else if (token === "-") stack.push(a - b);
    else if (token === "*") stack.push(a * b);
    else if (token === "/") stack.push(b === 0 ? null : a / b);
  }
  if (stack.length !== 1) {
    throw new Error("Malformed formula.");
  }
  return stack[0];
}

function buildSyntheticSeries(result, formula) {
  const byProduct = new Map();
  for (const point of result.points || []) {
    if (!byProduct.has(point.product)) {
      byProduct.set(point.product, new Map());
    }
    byProduct.get(point.product).set(parseKey(point), point);
  }

  const productNames = new Set(byProduct.keys());
  const rpn = parseSyntheticFormula(formula, productNames);
  const allKeys = new Set();
  byProduct.forEach((map) => {
    map.forEach((_value, key) => allKeys.add(key));
  });

  const rows = [];
  [...allKeys].sort((a, b) => {
    const [dayA, tsA] = a.split("|").map(Number);
    const [dayB, tsB] = b.split("|").map(Number);
    return dayA !== dayB ? dayA - dayB : tsA - tsB;
  }).forEach((key) => {
    const samplePoint = [...byProduct.values()].map((map) => map.get(key)).find(Boolean);
    if (!samplePoint) return;

    const context = {};
    byProduct.forEach((map, product) => {
      const point = map.get(key);
      context[product] = point ? point.mid_price : 0;
    });

    const value = evaluateSyntheticRpn(rpn, context);
    if (value == null || !Number.isFinite(value)) return;

    rows.push({
      day: samplePoint.day,
      timestamp: samplePoint.timestamp,
      value,
    });
  });

  return rows;
}

function renderSyntheticChart() {
  if (!dom.syntheticChart) return;
  const formula = (dom.syntheticFormula?.value || "").trim();
  if (!formula) {
    Plotly.purge(dom.syntheticChart);
    return;
  }

  const runs = [{ label: "Current Run", result: lastResult }, ...savedRuns];
  const target = dom.syntheticRun?.value || "Current Run";
  const selected = runs.find((run) => run.label === target) || runs[0];
  if (!selected?.result?.points?.length) {
    Plotly.purge(dom.syntheticChart);
    return;
  }

  let rows;
  try {
    rows = buildSyntheticSeries(selected.result, formula);
  } catch (error) {
    Plotly.purge(dom.syntheticChart);
    return;
  }
  if (!rows.length) {
    Plotly.purge(dom.syntheticChart);
    return;
  }

  const axis = buildTimeAxis(rows);
  Plotly.newPlot(
    dom.syntheticChart,
    [
      {
        type: "scattergl",
        mode: "lines",
        name: formula,
        x: axis.x,
        y: rows.map((row) => row.value),
        line: { color: "#f59e0b", width: 2 },
        customdata: rows.map((row) => `D${row.day} T${row.timestamp}`),
        hovertemplate: "%{customdata}<br>Value=%{y:.4f}<extra></extra>",
      },
    ],
    baseLayout({
      margin: { l: 56, r: 16, t: 8, b: 36 },
      xaxis: {
        title: "Time Index",
        tickvals: axis.tickVals,
        ticktext: axis.tickText,
      },
      yaxis: {
        title: "Synthetic Value",
      },
    }),
    { responsive: true, displaylogo: false }
  );
}

function safeExportName(value) {
  return String(value || "prosperity")
    .replace(/\.[^.]+$/g, "")
    .replace(/[^a-z0-9._-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "prosperity";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return { mode: "download", name: filename };
}

async function saveWorkbookFile(workbook, filename, options = {}) {
  const { preferPicker = true } = options;
  const XLSX = window.XLSX;
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  if (preferPicker && window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "Excel workbook",
            accept: {
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { mode: "picker", name: handle.name || filename };
    } catch (error) {
      if (error?.name === "AbortError") {
        throw error;
      }
      return downloadBlob(blob, filename);
    }
  }

  return downloadBlob(blob, filename);
}

async function exportExcel(options = {}) {
  const { preferPicker = true } = options;
  if (!lastResult || !lastResult.points || lastResult.points.length === 0) {
    setStatus("Run a simulation before exporting.", true);
    return;
  }
  const XLSX = window.XLSX;
  if (!XLSX) {
    setStatus("SheetJS not loaded — check your internet connection.", true);
    return;
  }

  if (dom.exportExcel) dom.exportExcel.disabled = true;
  if (dom.exportExcelButton) dom.exportExcelButton.disabled = true;
  if (dom.exportStatus) dom.exportStatus.textContent = "Building…";

  try {
    const result = lastResult;
    const products = [...new Set(result.points.map((p) => p.product))].sort();
    const m = result.metrics || {};
    const limits = getSelectedLimits();

    // ── helpers ──────────────────────────────────────────────────────────────
    // "product|day|ts" -> point
    const ptLk = new Map(result.points.map((p) => [`${p.product}|${p.day}|${p.timestamp}`, p]));

    // sorted points per product for look-back / look-ahead
    const ptsByProd = new Map(products.map((pr) => [pr, getProductPoints(result.points, pr)]));

    const ref = (fill, pt) => FIXED_VALUE_PRODUCTS[fill.product] ?? pt?.mid_price ?? null;
    const edgeFair = (fill) => {
      const pt = ptLk.get(`${fill.product}|${fill.day}|${fill.timestamp}`);
      const r = ref(fill, pt);
      return Number.isFinite(r) ? (fill.side === "BUY" ? r - fill.price : fill.price - r) : null;
    };
    const edgeTouch = (fill) => {
      const pt = ptLk.get(`${fill.product}|${fill.day}|${fill.timestamp}`);
      if (!pt) return null;
      return fill.side === "BUY"
        ? (pt.best_ask != null ? pt.best_ask - fill.price : null)
        : (pt.best_bid != null ? fill.price - pt.best_bid : null);
    };
    const spread = (pt) => (pt?.best_ask != null && pt?.best_bid != null ? pt.best_ask - pt.best_bid : null);
    const spreadBucket = (s) => s == null ? "unknown" : s <= 1 ? "tight (1)" : s <= 3 ? "normal (2-3)" : "wide (4+)";
    const pct = (n, d) => (d > 0 ? +((n / d) * 100).toFixed(2) : null);
    const avg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const r2 = (v) => v != null ? +v.toFixed(2) : null;

    const wb = XLSX.utils.book_new();
    const addSheet = (name, rows, colWidths) => {
      const sheet = XLSX.utils.aoa_to_sheet(rows);
      if (colWidths) sheet["!cols"] = colWidths.map((w) => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, sheet, name);
    };

    // ── build missed-opps rows (reused in several tabs) ─────────────────────
    const moRows = [];
    for (const product of products) {
      const fByKey = new Map();
      for (const fill of result.fills) {
        if (fill.product !== product) continue;
        const k = `${fill.day}|${fill.timestamp}`;
        if (!fByKey.has(k)) fByKey.set(k, { BUY: 0, SELL: 0 });
        fByKey.get(k)[fill.side] += fill.quantity;
      }
      for (const row of (ptsByProd.get(product) || [])) {
        const k = `${row.day}|${row.timestamp}`;
        const fs = fByKey.get(k) ?? { BUY: 0, SELL: 0 };
        const sp = spread(row);
        if (row.ask_prices?.length) {
          const bAsk = row.ask_prices[0], bAskQ = Math.max(0, row.ask_volumes?.[0] ?? 0);
          const miss = Math.max(0, bAskQ - fs.BUY);
          if (miss > 0) moRows.push({ day: row.day, ts: row.timestamp, product, side: "BUY", touch_price: bAsk, touch_qty: bAskQ, filled_qty: fs.BUY, missed_qty: miss, spread: sp });
        }
        if (row.bid_prices?.length) {
          const bBid = row.bid_prices[0], bBidQ = Math.max(0, row.bid_volumes?.[0] ?? 0);
          const miss = Math.max(0, bBidQ - fs.SELL);
          if (miss > 0) moRows.push({ day: row.day, ts: row.timestamp, product, side: "SELL", touch_price: bBid, touch_qty: bBidQ, filled_qty: fs.SELL, missed_qty: miss, spread: sp });
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TAB 1 — README
    // ─────────────────────────────────────────────────────────────────────────
    addSheet("README", [
      ["Prosperity Backtest Output — Tab Guide"],
      [],
      ["Tab", "What it contains"],
      ["README", "This guide"],
      ["Summary", "Run config, key performance metrics, and a per-product headline"],
      ["Fills", "Every simulated fill with full context: maker/taker type, spread, book depth levels, edge vs touch price, edge vs fair/mid, and position at time of fill"],
      ["Equity_Curve", "Full timestep-by-timestep equity: mid price, spread, book depth, position, realized PnL, product MTM, portfolio MTM"],
      ["MarketTrades", "All observed market trades with buyer/seller IDs and a flag for whether they are near our own fill timestamps"],
      ["MissedOpps", "Every timestamp where the best bid/ask had available qty we didn't fill — how much we left on the table and the spread at that moment"],
      ["ProductSummary", "Per-product aggregate stats: turnover, fill counts by side and type, avg prices, edge totals, missed qty, position stats"],
      ["PnL_By_Side_And_Type", "Edge vs fair broken down by product × side (BUY/SELL) × fill_type (maker/taker) — key for identifying which leg is profitable"],
      ["Spread_Buckets", "Edge contribution by spread width bucket (tight/normal/wide) per product — shows whether we trade better in liquid or illiquid moments"],
      ["Position_Over_Time", "Position timeline per product with inventory-risk stats: time at limit, time long, time short, avg abs position, position-weighted mid"],
      ["Drawdown_Periods", "Identified drawdown periods in portfolio PnL with start, trough, recovery and duration"],
      ["Day_Breakdown", "Per-day performance: fills, volume, PnL, edge, turnover, market trade count"],
      ["Timestamp_Hotspots", "Top 50 timestamps by largest PnL swing (positive and negative) — useful for spotting regime changes or bad ticks"],
      ["Market_Trade_Patterns", "For each of our fills: market trade volume and direction in the 5 timestamps before and after — diagnoses whether market flow predicts fill quality"],
      ["Edge_Distribution", "Distribution of per-fill edge vs fair in buckets — shows the shape of our alpha and whether it is concentrated or spread"],
    ], [26, 90]);

    // ─────────────────────────────────────────────────────────────────────────
    // TAB 2 — Summary
    // ─────────────────────────────────────────────────────────────────────────
    const totalTurnover = result.fills.reduce((s, f) => s + f.price * f.quantity, 0);
    const makerFills = result.fills.filter((f) => f.fill_type === "maker");
    const takerFills = result.fills.filter((f) => f.fill_type === "taker");
    const totalEdgeAll = result.fills.reduce((s, f) => { const e = edgeFair(f); return s + (e != null ? e * f.quantity : 0); }, 0);

    const summaryRows = [
      ["Prosperity Dashboard — Backtest Output"],
      [],
      ["STRATEGY CONFIG"],
      ["Strategy File",       strategyName],
      ["Export Time",         new Date().toLocaleString()],
      ["Matching Mode",       dom.matchingMode.value],
      ...Object.entries(limits).map(([k, v]) => [`Position Limit: ${k}`, v]),
      [],
      ["PORTFOLIO METRICS"],
      ["Final PnL",                        r2(m.final_pnl)],
      ["Max Drawdown (abs)",               r2(m.max_drawdown_abs)],
      ["Max Drawdown (%)",                 m.max_drawdown_pct != null ? r2(m.max_drawdown_pct * 100) : null],
      ["Sharpe Ratio (daily)",             r2(m.sharpe)],
      ["Annualized Sharpe",                r2(m.annualized_sharpe)],
      ["Sortino Ratio",                    r2(m.sortino)],
      ["Calmar Ratio (PnL / MaxDD)",       r2(m.calmar)],
      [],
      ["ACTIVITY SUMMARY"],
      ["Total Fills",                      result.fills.length],
      ["Maker Fills",                      makerFills.length],
      ["Taker Fills",                      takerFills.length],
      ["Maker Fill %",                     pct(makerFills.length, result.fills.length)],
      ["Total Market Trades Observed",     result.market_trades.length],
      ["Total Turnover (price × qty)",     r2(totalTurnover)],
      ["Total Edge vs Fair (all fills)",   r2(totalEdgeAll)],
      ["Products Traded",                  products.join(", ")],
      [],
      ["PER-PRODUCT HEADLINE"],
      ["Product", "Final MTM PnL", "Total Fills", "Maker %", "Taker %", "Total Turnover", "Avg Edge/Fill vs Fair", "Total Missed Qty"],
      ...products.map((pr) => {
        const fills = result.fills.filter((f) => f.product === pr);
        const mk = fills.filter((f) => f.fill_type === "maker").length;
        const tk = fills.filter((f) => f.fill_type === "taker").length;
        const tv = fills.reduce((s, f) => s + f.price * f.quantity, 0);
        const edges = fills.map((f) => { const e = edgeFair(f); return e != null ? e * f.quantity : null; }).filter((v) => v != null);
        const lastPt = (ptsByProd.get(pr) || []).slice(-1)[0];
        const totalMissed = moRows.filter((r) => r.product === pr).reduce((s, r) => s + r.missed_qty, 0);
        return [pr, r2(lastPt?.product_mtm_pnl), fills.length, pct(mk, fills.length), pct(tk, fills.length), r2(tv), r2(avg(edges)), totalMissed];
      }),
    ];
    addSheet("Summary", summaryRows, [34, 16, 14, 10, 10, 18, 22, 18]);

    // ─────────────────────────────────────────────────────────────────────────
    // TAB 3 — Fills (full detail)
    // ─────────────────────────────────────────────────────────────────────────
    const fillHdr = [
      "seq", "day", "timestamp", "product", "side", "fill_type",
      "fill_price", "quantity", "position_after_fill", "realized_pnl_at_fill",
      "mid_price_at_fill", "best_bid_at_fill", "best_ask_at_fill", "spread_at_fill",
      "spread_bucket",
      "bid_lvl1_price", "bid_lvl1_qty", "bid_lvl2_price", "bid_lvl2_qty", "bid_lvl3_price", "bid_lvl3_qty",
      "ask_lvl1_price", "ask_lvl1_qty", "ask_lvl2_price", "ask_lvl2_qty", "ask_lvl3_price", "ask_lvl3_qty",
      "edge_vs_touch",  // positive = we beat the touch price (passive improvement)
      "edge_vs_fair",   // positive = filled at better than fair/mid
      "edge_vs_fair_x_qty",  // edge_vs_fair * qty = dollar contribution
      "pct_of_position_limit",  // abs(position) / limit
    ];
    const fillRows = result.fills.map((f) => {
      const pt = ptLk.get(`${f.product}|${f.day}|${f.timestamp}`);
      const sp = spread(pt);
      const ef = edgeFair(f);
      const lim = limits[f.product] ?? 50;
      return [
        f.seq, f.day, f.timestamp, f.product, f.side, f.fill_type ?? "unknown",
        f.price, f.quantity, f.position, r2(f.realized_pnl),
        pt?.mid_price ?? null, pt?.best_bid ?? null, pt?.best_ask ?? null, sp,
        spreadBucket(sp),
        pt?.bid_prices?.[0] ?? null, pt?.bid_volumes?.[0] ?? null,
        pt?.bid_prices?.[1] ?? null, pt?.bid_volumes?.[1] ?? null,
        pt?.bid_prices?.[2] ?? null, pt?.bid_volumes?.[2] ?? null,
        pt?.ask_prices?.[0] ?? null, pt?.ask_volumes?.[0] ?? null,
        pt?.ask_prices?.[1] ?? null, pt?.ask_volumes?.[1] ?? null,
        pt?.ask_prices?.[2] ?? null, pt?.ask_volumes?.[2] ?? null,
        r2(edgeTouch(f)),
        r2(ef),
        r2(ef != null ? ef * f.quantity : null),
        r2(pct(Math.abs(f.position), lim)),
      ];
    });
    addSheet("Fills", [fillHdr, ...fillRows],
      [6,6,12,26,6,10, 12,9,20,18, 16,14,14,14, 16,
       14,12,14,12,14,12, 14,12,14,12,14,12,
       14,14,20,20]);

    // ─────────────────────────────────────────────────────────────────────────
    // TAB 4 — Equity Curve
    // ─────────────────────────────────────────────────────────────────────────
    const eqHdr = [
      "day", "timestamp", "product",
      "mid_price", "best_bid", "best_ask", "spread",
      "bid_depth_total_qty", "ask_depth_total_qty",
      "position", "pct_of_limit",
      "realized_pnl", "product_mtm_pnl", "portfolio_mtm_pnl",
      "fills_this_ts", "mkt_trades_this_ts", "mkt_trade_volume_this_ts",
    ];
    const fillsByTs = new Map();
    for (const f of result.fills) {
      const k = `${f.product}|${f.day}|${f.timestamp}`;
      fillsByTs.set(k, (fillsByTs.get(k) || 0) + 1);
    }
    const mtByTs = new Map();
    for (const t of result.market_trades) {
      const k = `${t.product}|${t.day}|${t.timestamp}`;
      if (!mtByTs.has(k)) mtByTs.set(k, { count: 0, vol: 0 });
      mtByTs.get(k).count++;
      mtByTs.get(k).vol += t.quantity;
    }
    const eqRows = result.points.map((p) => {
      const sp = spread(p);
      const lim = limits[p.product] ?? 50;
      const k = `${p.product}|${p.day}|${p.timestamp}`;
      const mt = mtByTs.get(k) || { count: 0, vol: 0 };
      return [
        p.day, p.timestamp, p.product,
        p.mid_price, p.best_bid, p.best_ask, sp,
        (p.bid_volumes || []).reduce((s, v) => s + v, 0),
        (p.ask_volumes || []).reduce((s, v) => s + v, 0),
        p.position, r2(pct(Math.abs(p.position), lim)),
        r2(p.realized_pnl), r2(p.product_mtm_pnl), r2(p.portfolio_mtm_pnl),
        fillsByTs.get(k) || 0, mt.count, mt.vol,
      ];
    });
    addSheet("Equity_Curve", [eqHdr, ...eqRows],
      [6,12,26, 12,10,10,10, 18,18, 10,14, 14,16,18, 16,20,22]);

    // ─────────────────────────────────────────────────────────────────────────
    // TAB 5 — Market Trades
    // ─────────────────────────────────────────────────────────────────────────
    // flag rows where we also have own fills at the same timestamp
    const ownFillTsSet = new Set(result.fills.map((f) => `${f.product}|${f.day}|${f.timestamp}`));
    const mtHdr = ["day","timestamp","product","price","quantity","buyer","seller",
                   "mid_price_at_trade","spread_at_trade","trade_vs_mid","we_also_filled_this_ts",
                   "aggressor_side"]; // inferred: price >= ask -> aggressive buy
    const mtRows = result.market_trades.map((t) => {
      const pt = ptLk.get(`${t.product}|${t.day}|${t.timestamp}`);
      const mid = pt?.mid_price ?? null;
      const sp = spread(pt);
      const vs_mid = mid != null ? r2(t.price - mid) : null;
      const weAlso = ownFillTsSet.has(`${t.product}|${t.day}|${t.timestamp}`) ? 1 : 0;
      let agg = "unknown";
      if (pt?.best_ask != null && t.price >= pt.best_ask) agg = "aggressive_buy";
      else if (pt?.best_bid != null && t.price <= pt.best_bid) agg = "aggressive_sell";
      else agg = "passive";
      return [t.day, t.timestamp, t.product, t.price, t.quantity, t.buyer ?? "", t.seller ?? "",
              mid, sp, vs_mid, weAlso, agg];
    });
    addSheet("MarketTrades", [mtHdr, ...mtRows],
      [6,12,26,10,10,16,16, 16,12,14,22,16]);

    // ─────────────────────────────────────────────────────────────────────────
    // TAB 6 — Missed Opportunities
    // ─────────────────────────────────────────────────────────────────────────
    const moHdr = ["day","timestamp","product","side",
                   "touch_price","touch_qty","we_filled_qty","missed_qty",
                   "spread_at_ts","spread_bucket",
                   "implied_missed_edge_vs_fair"];
    const moExportRows = moRows.map((r) => {
      const pt = ptLk.get(`${r.product}|${r.day}|${r.ts}`);
      const fairRef = pt ? (FIXED_VALUE_PRODUCTS[r.product] ?? pt.mid_price) : null;
      const impliedEdge = fairRef != null ? (r.side === "BUY" ? fairRef - r.touch_price : r.touch_price - fairRef) * r.missed_qty : null;
      return [r.day, r.ts, r.product, r.side,
              r.touch_price, r.touch_qty, r.filled_qty, r.missed_qty,
              r.spread, spreadBucket(r.spread), r2(impliedEdge)];
    });
    addSheet("MissedOpps", [moHdr, ...moExportRows],
      [6,12,26,6, 12,10,12,12, 12,16, 24]);

    // ─────────────────────────────────────────────────────────────────────────
    // TAB 7 — Product Summary
    // ─────────────────────────────────────────────────────────────────────────
    const psumHdr = [
      "product",
      "total_fills", "buy_fills", "sell_fills",
      "maker_fills", "taker_fills", "maker_fill_pct",
      "total_buy_qty", "total_sell_qty", "net_qty_traded", "total_turnover",
      "avg_buy_price_wgtd", "avg_sell_price_wgtd",
      "final_position", "max_long_position", "max_short_position",
      "pct_timestamps_with_fills",
      "realized_pnl_final", "product_mtm_pnl_final",
      "total_edge_vs_fair", "avg_edge_per_fill_vs_fair",
      "total_edge_vs_touch", "avg_edge_per_fill_vs_touch",
      "total_missed_qty", "implied_missed_edge",
    ];
    const psumRows = products.map((pr) => {
      const fills = result.fills.filter((f) => f.product === pr);
      const buys = fills.filter((f) => f.side === "BUY");
      const sells = fills.filter((f) => f.side === "SELL");
      const mk = fills.filter((f) => f.fill_type === "maker");
      const buyVol = buys.reduce((s, f) => s + f.quantity, 0);
      const sellVol = sells.reduce((s, f) => s + f.quantity, 0);
      const avgBuy = buyVol > 0 ? r2(buys.reduce((s, f) => s + f.price * f.quantity, 0) / buyVol) : null;
      const avgSell = sellVol > 0 ? r2(sells.reduce((s, f) => s + f.price * f.quantity, 0) / sellVol) : null;
      const tv = fills.reduce((s, f) => s + f.price * f.quantity, 0);
      const pts = ptsByProd.get(pr) || [];
      const lastPt = pts.slice(-1)[0];
      const maxLong = Math.max(0, ...pts.map((p) => p.position));
      const maxShort = Math.min(0, ...pts.map((p) => p.position));
      const tsFillSet = new Set(fills.map((f) => `${f.day}|${f.timestamp}`));
      const pctTsWithFills = r2(pct(tsFillSet.size, pts.length));
      const edgesFair = fills.map((f) => { const e = edgeFair(f); return e != null ? e * f.quantity : null; }).filter((v) => v != null);
      const edgesTouch = fills.map((f) => { const e = edgeTouch(f); return e != null ? e * f.quantity : null; }).filter((v) => v != null);
      const totalEF = r2(edgesFair.reduce((s, v) => s + v, 0));
      const avgEF = r2(avg(edgesFair));
      const totalET = r2(edgesTouch.reduce((s, v) => s + v, 0));
      const avgET = r2(avg(edgesTouch));
      const prodMo = moRows.filter((r) => r.product === pr);
      const totalMissed = prodMo.reduce((s, r) => s + r.missed_qty, 0);
      const impliedMissedEdge = r2(prodMo.reduce((s, r) => {
        const pt = ptLk.get(`${r.product}|${r.day}|${r.ts}`);
        const fairRef = pt ? (FIXED_VALUE_PRODUCTS[pr] ?? pt.mid_price) : null;
        return fairRef != null ? s + (r.side === "BUY" ? fairRef - r.touch_price : r.touch_price - fairRef) * r.missed_qty : s;
      }, 0));
      return [
        pr,
        fills.length, buys.length, sells.length,
        mk.length, fills.length - mk.length, pct(mk.length, fills.length),
        buyVol, sellVol, buyVol - sellVol, r2(tv),
        avgBuy, avgSell,
        lastPt?.position ?? 0, maxLong, maxShort,
        pctTsWithFills,
        r2(lastPt?.realized_pnl), r2(lastPt?.product_mtm_pnl),
        totalEF, avgEF, totalET, avgET,
        totalMissed, impliedMissedEdge,
      ];
    });
    addSheet("ProductSummary", [psumHdr, ...psumRows],
      [26, 12,10,12, 12,12,14, 14,14,16,16, 20,20, 16,16,16, 24, 18,18, 18,22,18,22, 16,20]);

    // ─────────────────────────────────────────────────────────────────────────
    // TAB 8 — PnL by Side and Fill Type
    // ─────────────────────────────────────────────────────────────────────────
    const psHdr = [
      "product", "side", "fill_type",
      "fill_count", "total_qty", "avg_qty_per_fill",
      "avg_fill_price_wgtd",
      "total_edge_vs_fair", "avg_edge_per_fill_vs_fair", "win_rate_pct",
      "total_edge_vs_touch", "avg_edge_per_fill_vs_touch",
      "avg_spread_at_fill",
      "best_single_fill_edge", "worst_single_fill_edge",
    ];
    const psRows = [];
    for (const pr of products) {
      const groups = {};
      for (const f of result.fills.filter((f) => f.product === pr)) {
        const gk = `${f.side}|${f.fill_type ?? "unknown"}`;
        if (!groups[gk]) groups[gk] = { side: f.side, ft: f.fill_type ?? "unknown", fills: [] };
        groups[gk].fills.push(f);
      }
      for (const g of Object.values(groups)) {
        const fills = g.fills;
        const totalQty = fills.reduce((s, f) => s + f.quantity, 0);
        const wPrice = totalQty > 0 ? r2(fills.reduce((s, f) => s + f.price * f.quantity, 0) / totalQty) : null;
        const efList = fills.map((f) => { const e = edgeFair(f); return e != null ? { total: e * f.quantity, unit: e } : null; }).filter(Boolean);
        const etList = fills.map((f) => { const e = edgeTouch(f); return e != null ? e * f.quantity : null; }).filter((v) => v != null);
        const spList = fills.map((f) => spread(ptLk.get(`${f.product}|${f.day}|${f.timestamp}`))).filter((v) => v != null);
        const totalEF = r2(efList.reduce((s, v) => s + v.total, 0));
        const avgEF = r2(avg(efList.map((v) => v.total)));
        const wins = efList.filter((v) => v.total > 0).length;
        const winRate = r2(pct(wins, efList.length));
        const unitEdges = efList.map((v) => v.unit);
        psRows.push([
          pr, g.side, g.ft,
          fills.length, totalQty, r2(avg(fills.map((f) => f.quantity))),
          wPrice,
          totalEF, avgEF, winRate,
          r2(etList.reduce((s, v) => s + v, 0)), r2(avg(etList)),
          r2(avg(spList)),
          r2(unitEdges.length > 0 ? Math.max(...unitEdges) : null),
          r2(unitEdges.length > 0 ? Math.min(...unitEdges) : null),
        ]);
      }
    }
    addSheet("PnL_By_Side_And_Type", [psHdr, ...psRows],
      [26,6,12, 12,10,16, 20, 18,22,12, 18,22, 18, 22,22]);

    // ─────────────────────────────────────────────────────────────────────────
    // TAB 9 — Spread Buckets
    // ─────────────────────────────────────────────────────────────────────────
    const sbHdr = [
      "product", "spread_bucket", "fill_count", "fill_pct_of_product_total",
      "total_qty", "total_edge_vs_fair", "avg_edge_per_fill_vs_fair",
      "total_edge_vs_touch", "avg_edge_per_fill_vs_touch",
      "maker_fill_pct", "taker_fill_pct",
    ];
    const sbRows = [];
    const bucketOrder = ["tight (1)", "normal (2-3)", "wide (4+)", "unknown"];
    for (const pr of products) {
      const fills = result.fills.filter((f) => f.product === pr);
      const groups = {};
      for (const bk of bucketOrder) groups[bk] = [];
      for (const f of fills) {
        const pt = ptLk.get(`${f.product}|${f.day}|${f.timestamp}`);
        const bk = spreadBucket(spread(pt));
        (groups[bk] || (groups[bk] = [])).push(f);
      }
      for (const bk of bucketOrder) {
        const bFills = groups[bk] || [];
        if (bFills.length === 0) continue;
        const efList = bFills.map((f) => { const e = edgeFair(f); return e != null ? e * f.quantity : null; }).filter((v) => v != null);
        const etList = bFills.map((f) => { const e = edgeTouch(f); return e != null ? e * f.quantity : null; }).filter((v) => v != null);
        const mk = bFills.filter((f) => f.fill_type === "maker").length;
        sbRows.push([
          pr, bk, bFills.length, pct(bFills.length, fills.length),
          bFills.reduce((s, f) => s + f.quantity, 0),
          r2(efList.reduce((s, v) => s + v, 0)), r2(avg(efList)),
          r2(etList.reduce((s, v) => s + v, 0)), r2(avg(etList)),
          pct(mk, bFills.length), pct(bFills.length - mk, bFills.length),
        ]);
      }
    }
    addSheet("Spread_Buckets", [sbHdr, ...sbRows],
      [26,16,12,22, 12, 18,22, 18,22, 16,16]);

    // ─────────────────────────────────────────────────────────────────────────
    // TAB 10 — Position Over Time
    // ─────────────────────────────────────────────────────────────────────────
    const posHdr = [
      "product", "day", "timestamp",
      "position", "pct_of_limit",
      "mid_price", "position_x_mid_value",
      "spread", "had_fill_this_ts",
    ];
    const posRows = [];
    for (const pr of products) {
      const lim = limits[pr] ?? 50;
      for (const p of (ptsByProd.get(pr) || [])) {
        const fillHere = fillsByTs.get(`${pr}|${p.day}|${p.timestamp}`) ? 1 : 0;
        posRows.push([
          pr, p.day, p.timestamp,
          p.position, r2(pct(Math.abs(p.position), lim)),
          p.mid_price, r2(p.position * p.mid_price),
          spread(p), fillHere,
        ]);
      }
    }
    // append per-product inventory risk stats
    posRows.push([]);
    posRows.push(["INVENTORY RISK SUMMARY"]);
    posRows.push(["product","pct_time_long","pct_time_short","pct_time_flat","pct_time_at_limit","avg_abs_position","max_abs_position"]);
    for (const pr of products) {
      const lim = limits[pr] ?? 50;
      const pts = ptsByProd.get(pr) || [];
      const long = pts.filter((p) => p.position > 0).length;
      const short = pts.filter((p) => p.position < 0).length;
      const flat = pts.filter((p) => p.position === 0).length;
      const atLim = pts.filter((p) => Math.abs(p.position) >= lim * 0.9).length;
      const absList = pts.map((p) => Math.abs(p.position));
      posRows.push([
        pr, pct(long, pts.length), pct(short, pts.length), pct(flat, pts.length),
        pct(atLim, pts.length), r2(avg(absList)), Math.max(...absList),
      ]);
    }
    addSheet("Position_Over_Time", [posHdr, ...posRows],
      [26,6,12, 10,14, 12,20, 10,18]);

    // ─────────────────────────────────────────────────────────────────────────
    // TAB 11 — Drawdown Periods
    // ─────────────────────────────────────────────────────────────────────────
    // Build stitched portfolio PnL series
    const stitchedPf = stitchSeriesByDay(
      [...new Map(result.points.map((p) => [`${p.day}|${p.timestamp}`, p])).values()]
        .sort(sortByDayThenTs)
        .map((p) => ({ day: p.day, timestamp: p.timestamp, portfolio_mtm_pnl: p.portfolio_mtm_pnl })),
      "portfolio_mtm_pnl"
    );

    const ddHdr = ["drawdown_number","start_day","start_ts","peak_value","trough_day","trough_ts","trough_value","drawdown_abs","drawdown_pct","recovered_day","recovered_ts","duration_ticks"];
    const ddRows = [];
    let hwm = -Infinity, hwmIdx = 0, inDD = false, ddStart = null, ddPeak = null, ddTrough = null, ddTroughIdx = null, ddNum = 0;
    for (let i = 0; i < stitchedPf.length; i++) {
      const v = stitchedPf[i].stitchedValue;
      if (v > hwm) {
        if (inDD && ddTrough != null) {
          // recovery
          ddRows.push([
            ++ddNum,
            stitchedPf[hwmIdx].day, stitchedPf[hwmIdx].timestamp, r2(ddPeak),
            stitchedPf[ddTroughIdx].day, stitchedPf[ddTroughIdx].timestamp, r2(ddTrough),
            r2(ddPeak - ddTrough), r2(pct(ddPeak - ddTrough, Math.abs(ddPeak))),
            stitchedPf[i].day, stitchedPf[i].timestamp, i - hwmIdx,
          ]);
        }
        hwm = v; hwmIdx = i; inDD = false; ddPeak = v; ddTrough = null; ddTroughIdx = null;
      } else if (v < hwm) {
        inDD = true;
        if (ddTrough == null || v < ddTrough) { ddTrough = v; ddTroughIdx = i; }
      }
    }
    // open drawdown at end
    if (inDD && ddTrough != null) {
      ddRows.push([
        ++ddNum,
        stitchedPf[hwmIdx].day, stitchedPf[hwmIdx].timestamp, r2(ddPeak),
        stitchedPf[ddTroughIdx].day, stitchedPf[ddTroughIdx].timestamp, r2(ddTrough),
        r2(ddPeak - ddTrough), r2(pct(ddPeak - ddTrough, Math.abs(ddPeak))),
        "open", "open", stitchedPf.length - hwmIdx,
      ]);
    }
    addSheet("Drawdown_Periods", [ddHdr, ...ddRows],
      [18,10,12,14,12,12,14,16,16,14,14,16]);

    // ─────────────────────────────────────────────────────────────────────────
    // TAB 12 — Day Breakdown
    // ─────────────────────────────────────────────────────────────────────────
    const days = [...new Set(result.points.map((p) => p.day))].sort((a, b) => a - b);
    const dayHdr = [
      "day", "product",
      "start_pnl_mtm", "end_pnl_mtm", "day_pnl_delta",
      "fill_count", "maker_fills", "taker_fills",
      "buy_qty", "sell_qty", "turnover",
      "total_edge_vs_fair", "avg_edge_per_fill",
      "mkt_trade_count", "mkt_trade_volume",
      "missed_opportunities", "implied_missed_edge",
      "avg_spread", "avg_abs_position",
    ];
    const dayRows = [];
    for (const day of days) {
      for (const pr of products) {
        const pts = (ptsByProd.get(pr) || []).filter((p) => p.day === day).sort(sortByDayThenTs);
        if (pts.length === 0) continue;
        const fills = result.fills.filter((f) => f.product === pr && f.day === day);
        const mk = fills.filter((f) => f.fill_type === "maker").length;
        const buyQty = fills.filter((f) => f.side === "BUY").reduce((s, f) => s + f.quantity, 0);
        const sellQty = fills.filter((f) => f.side === "SELL").reduce((s, f) => s + f.quantity, 0);
        const tv = fills.reduce((s, f) => s + f.price * f.quantity, 0);
        const efList = fills.map((f) => { const e = edgeFair(f); return e != null ? e * f.quantity : null; }).filter((v) => v != null);
        const mts = result.market_trades.filter((t) => t.product === pr && t.day === day);
        const dayMo = moRows.filter((r) => r.product === pr && r.day === day);
        const implMissed = r2(dayMo.reduce((s, r) => {
          const pt = ptLk.get(`${r.product}|${r.day}|${r.ts}`);
          const fairRef = pt ? (FIXED_VALUE_PRODUCTS[pr] ?? pt.mid_price) : null;
          return fairRef != null ? s + (r.side === "BUY" ? fairRef - r.touch_price : r.touch_price - fairRef) * r.missed_qty : s;
        }, 0));
        const spreads = pts.map((p) => spread(p)).filter((v) => v != null);
        dayRows.push([
          day, pr,
          r2(pts[0].product_mtm_pnl), r2(pts.slice(-1)[0].product_mtm_pnl),
          r2(pts.slice(-1)[0].product_mtm_pnl - pts[0].product_mtm_pnl),
          fills.length, mk, fills.length - mk,
          buyQty, sellQty, r2(tv),
          r2(efList.reduce((s, v) => s + v, 0)), r2(avg(efList)),
          mts.length, mts.reduce((s, t) => s + t.quantity, 0),
          dayMo.length, implMissed,
          r2(avg(spreads)), r2(avg(pts.map((p) => Math.abs(p.position)))),
        ]);
      }
    }
    addSheet("Day_Breakdown", [dayHdr, ...dayRows],
      [6,26, 14,14,14, 12,12,12, 10,10,14, 18,18, 16,18, 20,20, 12,18]);

    // ─────────────────────────────────────────────────────────────────────────
    // TAB 13 — Timestamp Hotspots (top 50 best + worst PnL swings)
    // ─────────────────────────────────────────────────────────────────────────
    const pnlSwings = [];
    for (let i = 1; i < stitchedPf.length; i++) {
      const delta = stitchedPf[i].stitchedValue - stitchedPf[i - 1].stitchedValue;
      pnlSwings.push({ day: stitchedPf[i].day, ts: stitchedPf[i].timestamp, delta, value: stitchedPf[i].stitchedValue });
    }
    pnlSwings.sort((a, b) => b.delta - a.delta);
    const topN = 50;
    const hotspotHdr = ["rank", "direction", "day", "timestamp", "pnl_delta", "portfolio_pnl_at_ts",
                         "fill_count_this_ts", "mkt_trade_count_this_ts", "mkt_trade_volume_this_ts",
                         "products_with_fills"];
    const hotspotRows = [];
    const topGain = pnlSwings.slice(0, topN);
    const topLoss = pnlSwings.slice(-topN).reverse();
    [[topGain, "GAIN"], [topLoss, "LOSS"]].forEach(([list, dir]) => {
      list.forEach((row, i) => {
        const fillsHere = result.fills.filter((f) => f.day === row.day && f.timestamp === row.ts);
        const mtsHere = result.market_trades.filter((t) => t.day === row.day && t.timestamp === row.ts);
        hotspotRows.push([
          i + 1, dir, row.day, row.ts, r2(row.delta), r2(row.value),
          fillsHere.length, mtsHere.length, mtsHere.reduce((s, t) => s + t.quantity, 0),
          [...new Set(fillsHere.map((f) => f.product))].join(", "),
        ]);
      });
    });
    addSheet("Timestamp_Hotspots", [hotspotHdr, ...hotspotRows],
      [6,8,6,12,12,20, 18,22,22, 28]);

    // ─────────────────────────────────────────────────────────────────────────
    // TAB 14 — Market Trade Patterns (context around own fills)
    // ─────────────────────────────────────────────────────────────────────────
    // For each own fill: market activity in -5 to +5 timestamps
    const mtPatHdr = [
      "fill_seq", "day", "timestamp", "product", "side", "fill_type",
      "fill_price", "edge_vs_fair",
      "mkt_buy_vol_prev_5ts", "mkt_sell_vol_prev_5ts", "mkt_net_flow_prev_5ts",
      "mkt_trade_count_prev_5ts",
      "mkt_buy_vol_next_5ts", "mkt_sell_vol_next_5ts", "mkt_net_flow_next_5ts",
      "mkt_trade_count_next_5ts",
      "fill_aligned_with_mkt_flow",  // 1 if we bought when market was net buying (taker perspective)
    ];
    // build per-product ts index for look-around
    const mtPatRows = [];
    for (const pr of products) {
      const pts = ptsByProd.get(pr) || [];
      const tsIndex = new Map(pts.map((p, i) => [`${p.day}|${p.timestamp}`, i]));
      // market trades by ts key
      const mtByTsPr = new Map();
      for (const t of result.market_trades.filter((t) => t.product === pr)) {
        const k = `${t.day}|${t.timestamp}`;
        if (!mtByTsPr.has(k)) mtByTsPr.set(k, { buyVol: 0, sellVol: 0, count: 0 });
        const entry = mtByTsPr.get(k);
        // infer direction
        const pt = ptLk.get(`${t.product}|${t.day}|${t.timestamp}`);
        if (pt?.best_ask != null && t.price >= pt.best_ask) entry.buyVol += t.quantity;
        else if (pt?.best_bid != null && t.price <= pt.best_bid) entry.sellVol += t.quantity;
        else entry.buyVol += t.quantity / 2, entry.sellVol += t.quantity / 2;
        entry.count++;
      }
      const sumMktWindow = (fillIdx, before) => {
        let buyVol = 0, sellVol = 0, count = 0;
        const range = before
          ? Array.from({ length: 5 }, (_, i) => fillIdx - 5 + i)
          : Array.from({ length: 5 }, (_, i) => fillIdx + 1 + i);
        for (const idx of range) {
          if (idx < 0 || idx >= pts.length) continue;
          const k = `${pts[idx].day}|${pts[idx].timestamp}`;
          const mt = mtByTsPr.get(k);
          if (mt) { buyVol += mt.buyVol; sellVol += mt.sellVol; count += mt.count; }
        }
        return { buyVol: r2(buyVol), sellVol: r2(sellVol), net: r2(buyVol - sellVol), count };
      };
      for (const f of result.fills.filter((f) => f.product === pr)) {
        const tsKey = `${f.day}|${f.timestamp}`;
        const fillIdx = tsIndex.get(tsKey) ?? -1;
        if (fillIdx < 0) continue;
        const pre = sumMktWindow(fillIdx, true);
        const post = sumMktWindow(fillIdx, false);
        const aligned = (f.side === "BUY" && pre.net > 0) || (f.side === "SELL" && pre.net < 0) ? 1 : 0;
        mtPatRows.push([
          f.seq, f.day, f.timestamp, pr, f.side, f.fill_type ?? "",
          f.price, r2(edgeFair(f)),
          pre.buyVol, pre.sellVol, pre.net, pre.count,
          post.buyVol, post.sellVol, post.net, post.count,
          aligned,
        ]);
      }
    }
    addSheet("Market_Trade_Patterns", [mtPatHdr, ...mtPatRows],
      [8,6,12,26,6,10, 12,14, 20,20,20,22, 20,20,20,22, 28]);

    // ─────────────────────────────────────────────────────────────────────────
    // TAB 15 — Edge Distribution
    // ─────────────────────────────────────────────────────────────────────────
    const edgeDistHdr = ["product","side","edge_bucket","fill_count","total_qty","total_edge_contribution","pct_of_product_fills"];
    const edgeDistRows = [];
    const edgeBuckets = ["<-4","-4 to -2","-2 to -1","-1 to 0","0 to 1","1 to 2","2 to 4",">4"];
    const edgeBucketFn = (e) => {
      if (e == null) return "unknown";
      if (e < -4) return "<-4"; if (e < -2) return "-4 to -2"; if (e < -1) return "-2 to -1";
      if (e < 0) return "-1 to 0"; if (e < 1) return "0 to 1"; if (e < 2) return "1 to 2";
      if (e < 4) return "2 to 4"; return ">4";
    };
    for (const pr of products) {
      const fills = result.fills.filter((f) => f.product === pr);
      for (const side of ["BUY", "SELL"]) {
        const sideFills = fills.filter((f) => f.side === side);
        const groups = {};
        for (const bk of edgeBuckets) groups[bk] = [];
        for (const f of sideFills) {
          const bk = edgeBucketFn(edgeFair(f));
          (groups[bk] || (groups[bk] = [])).push(f);
        }
        for (const bk of edgeBuckets) {
          const bFills = groups[bk] || [];
          if (bFills.length === 0) continue;
          const efSum = bFills.reduce((s, f) => { const e = edgeFair(f); return s + (e != null ? e * f.quantity : 0); }, 0);
          edgeDistRows.push([
            pr, side, bk,
            bFills.length,
            bFills.reduce((s, f) => s + f.quantity, 0),
            r2(efSum),
            pct(bFills.length, sideFills.length),
          ]);
        }
      }
    }
    addSheet("Edge_Distribution", [edgeDistHdr, ...edgeDistRows],
      [26,6,12, 12,12,22,24]);

    // ─────────────────────────────────────────────────────────────────────────
    // Save in the browser. showSaveFilePicker opens a native Save As prompt
    // where supported; otherwise the browser downloads the workbook.
    // ─────────────────────────────────────────────────────────────────────────
    const sourceName = result.source?.filename || strategyName;
    const filename = `${safeExportName(sourceName)}_output.xlsx`;
    const saved = await saveWorkbookFile(wb, filename, { preferPicker });
    const sheetCount = wb.SheetNames.length;
    const action = saved.mode === "picker" ? "Saved" : "Downloaded";
    if (dom.exportStatus) dom.exportStatus.textContent = `${action} (${sheetCount} tabs) → ${saved.name}`;
    setStatus(`Excel ${saved.mode === "picker" ? "saved" : "downloaded"}: ${saved.name}`);
  } catch (err) {
    if (err?.name === "AbortError") {
      if (dom.exportStatus) dom.exportStatus.textContent = "Export canceled.";
      setStatus("Export canceled.");
    } else {
      console.error(err);
      if (dom.exportStatus) dom.exportStatus.textContent = `Failed: ${err.message}`;
      setStatus(`Export failed: ${err.message}`, true);
    }
  } finally {
    if (dom.exportExcel) dom.exportExcel.disabled = false;
    if (dom.exportExcelButton) dom.exportExcelButton.disabled = false;
  }
}

let backtestWorker = null;
let fileHandle = null;
let lastFileModified = 0;

function initWorker() {
  if (backtestWorker) return;
  backtestWorker = new Worker("worker.js");
  backtestWorker.onmessage = (e) => {
    const { type, completed, total, result, error } = e.data;
    if (type === "progress") {
      setRunProgress(completed, total);
    } else if (type === "result") {
      const payload = JSON.parse(result);
      applyResult(payload);
      updateSyntheticRunOptions();
      setStatus(`Simulation complete (${payload.fills.length} fills).`);
      if (dom.exportExcel?.checked) exportExcel({ preferPicker: false });
      dom.runButton.disabled = false;
      showRunProgress(false);
    } else if (type === "error") {
      console.error(error);
      let msg = error;
      const lines = msg.split('\n').map(l => l.trim()).filter(Boolean);
      const pythonError = lines.find(l => l.match(/^[a-zA-Z]+Error:/));
      if (pythonError) msg = `Python Crash: ${pythonError}`;
      setStatus(msg, true);
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
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: "Python Strategy", accept: { "text/x-python": [".py"] } }],
    });
    fileHandle = handle;
    const file = await fileHandle.getFile();
    strategyCode = await file.text();
    lastFileModified = file.lastModified;
    dom.strategyMeta.textContent = file.name;
    document.getElementById("watchStatus").style.display = "block";
    runSimulation();
    
    setInterval(async () => {
      if (!fileHandle) return;
      try {
        const f = await fileHandle.getFile();
        if (f.lastModified > lastFileModified) {
          lastFileModified = f.lastModified;
          strategyCode = await f.text();
          setStatus(`File changed: ${f.name}. Re-running...`);
          runSimulation();
        }
      } catch (e) { /* ignore permission issues on background poll */ }
    }, 1000);
  } catch (err) { console.error("Watch failed", err); }
}

async function runSimulation() {
  if (!strategyCode.trim()) {
    setStatus("Upload a strategy file or click 'Watch' before running.", true);
    return;
  }
  initWorker();
  dom.runButton.disabled = true;
  setStatus("Running in background...");
  showRunProgress(true);
  setRunProgress(0, 1);

  const engineCode = await (await fetch("backtest_engine.py?ts=" + Date.now())).text();
  const fileMap = await loadAllFiles();

  backtestWorker.postMessage({
    type: "run",
    strategy: strategyCode,
    fileMap,
    matchingMode: dom.matchingMode.value,
    limitsOverride: getSelectedLimits(),
    engine: engineCode
  });
}

function updateSyntheticRunOptions() {
  if (!dom.syntheticRun) return;
  const current = dom.syntheticRun.value || "Current Run";
  dom.syntheticRun.innerHTML = "";
  const runs = [{ label: "Current Run" }, ...savedRuns.map((run) => ({ label: run.label }))];
  runs.forEach((run) => {
    const option = document.createElement("option");
    option.value = run.label;
    option.textContent = run.label;
    dom.syntheticRun.appendChild(option);
  });
  dom.syntheticRun.value = runs.some((run) => run.label === current) ? current : "Current Run";
}

function splitLogSections(text) {
  const markers = ["Sandbox logs:", "Activities log:", "Trade History:"];
  const sections = {};
  for (const marker of markers) {
    const start = text.indexOf(marker);
    if (start < 0) continue;
    let end = text.length;
    for (const other of markers) {
      if (other === marker) continue;
      const idx = text.indexOf(other, start + marker.length);
      if (idx >= 0 && idx < end) end = idx;
    }
    sections[marker] = text.slice(start + marker.length, end).trim();
  }
  return sections;
}

function splitDelimitedLine(line, delimiter) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === delimiter && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function delimiterCount(line, delimiter) {
  return splitDelimitedLine(line, delimiter).length - 1;
}

function normalizeHeader(header) {
  return String(header || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseDelimitedTable(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const delimiters = [";", ",", "\t"];
  let headerIndex = -1;
  let delimiter = ";";
  let headers = [];
  for (let i = 0; i < lines.length; i++) {
    for (const candidate of delimiters) {
      if (delimiterCount(lines[i], candidate) < 2) continue;
      const parsedHeaders = splitDelimitedLine(lines[i], candidate).map(normalizeHeader);
      if (parsedHeaders.includes("timestamp") && (parsedHeaders.includes("product") || parsedHeaders.includes("symbol"))) {
        headerIndex = i;
        delimiter = candidate;
        headers = parsedHeaders;
        break;
      }
    }
    if (headerIndex >= 0) break;
  }
  if (headerIndex < 0) return [];

  const rows = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (delimiterCount(line, delimiter) < 1) break;
    const cells = splitDelimitedLine(line, delimiter);
    if (cells.length < headers.length) continue;
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = cells[idx]?.trim() ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function parseSemicolonTable(text) {
  return parseDelimitedTable(text);
}

function toNumber(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDepth(row, side, level) {
  return {
    price: toNumber(row[`${side}_price_${level}`]),
    volume: toNumber(row[`${side}_volume_${level}`]),
  };
}

function extractTradeHistory(section) {
  if (!section) return [];
  const start = section.indexOf("[");
  const end = section.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(section.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function computePortfolioMetrics(portfolioPoints) {
  const values = portfolioPoints.map((p) => p.portfolio_mtm_pnl).filter((v) => Number.isFinite(v));
  if (!values.length) {
    return {
      final_pnl: 0,
      max_drawdown_abs: 0,
      max_drawdown_pct: null,
      sharpe: null,
      annualized_sharpe: null,
      sortino: null,
      calmar: null,
    };
  }
  let hwm = values[0];
  let maxDd = 0;
  let maxDdPct = null;
  for (const value of values) {
    hwm = Math.max(hwm, value);
    const dd = hwm - value;
    maxDd = Math.max(maxDd, dd);
    if (hwm > 0) {
      const pct = dd / hwm;
      maxDdPct = maxDdPct == null ? pct : Math.max(maxDdPct, pct);
    }
  }
  const returns = values.slice(1).map((value, idx) => value - values[idx]);
  const mean = returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0;
  const variance = returns.length > 1
    ? returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1)
    : 0;
  const stdev = Math.sqrt(variance);
  const downside = returns.length
    ? Math.sqrt(returns.reduce((sum, value) => sum + Math.min(0, value) ** 2, 0) / returns.length)
    : 0;
  const sharpe = stdev > 0 ? mean / stdev : null;
  const finalPnl = values[values.length - 1];
  return {
    final_pnl: finalPnl,
    max_drawdown_abs: maxDd,
    max_drawdown_pct: maxDdPct,
    sharpe,
    annualized_sharpe: sharpe == null ? null : sharpe * Math.sqrt(252),
    sortino: downside > 0 ? mean / downside : null,
    calmar: maxDd > 0 ? finalPnl / maxDd : null,
  };
}

function parseImcBacktesterLog(text, filename = "uploaded log") {
  const sections = splitLogSections(text);
  const activityRows = parseSemicolonTable(sections["Activities log:"] || text);
  if (!activityRows.length) {
    throw new Error("Could not find an Activities log table in the uploaded file.");
  }

  const points = [];
  const portfolioByKey = new Map();
  for (const row of activityRows) {
    const day = toNumber(row.day) ?? 0;
    const timestamp = toNumber(row.timestamp);
    const product = row.product || row.symbol || row.Product;
    if (timestamp == null || !product) continue;

    const bidLevels = [1, 2, 3].map((level) => parseDepth(row, "bid", level)).filter((v) => v.price != null);
    const askLevels = [1, 2, 3].map((level) => parseDepth(row, "ask", level)).filter((v) => v.price != null);
    const pnl = toNumber(row.profit_and_loss) ?? toNumber(row.pnl) ?? 0;
    const point = {
      day,
      timestamp,
      product,
      mid_price: toNumber(row.mid_price),
      best_bid: bidLevels[0]?.price ?? null,
      best_ask: askLevels[0]?.price ?? null,
      bid_prices: bidLevels.map((v) => v.price),
      bid_volumes: bidLevels.map((v) => v.volume ?? 0),
      ask_prices: askLevels.map((v) => v.price),
      ask_volumes: askLevels.map((v) => v.volume ?? 0),
      position: toNumber(row.position) ?? 0,
      realized_pnl: pnl,
      product_mtm_pnl: pnl,
      portfolio_mtm_pnl: null,
    };
    points.push(point);
    const key = `${day}|${timestamp}`;
    portfolioByKey.set(key, {
      day,
      timestamp,
      portfolio_mtm_pnl: (portfolioByKey.get(key)?.portfolio_mtm_pnl || 0) + pnl,
    });
  }

  const portfolioPoints = [...portfolioByKey.values()].sort(sortByDayThenTs);
  const portfolioLookup = new Map(portfolioPoints.map((p) => [`${p.day}|${p.timestamp}`, p.portfolio_mtm_pnl]));
  points.forEach((point) => {
    point.portfolio_mtm_pnl = portfolioLookup.get(parseKey(point)) ?? null;
  });

  const positionByProduct = new Map();
  const fills = [];
  const marketTrades = extractTradeHistory(sections["Trade History:"]).map((trade, idx) => {
    const product = trade.symbol || trade.product || trade.Product || "";
    const day = toNumber(trade.day) ?? 0;
    const timestamp = toNumber(trade.timestamp) ?? 0;
    const quantity = Math.abs(toNumber(trade.quantity) ?? 0);
    const buyer = trade.buyer || "";
    const seller = trade.seller || "";
    const base = {
      day,
      timestamp,
      product,
      price: toNumber(trade.price) ?? 0,
      quantity,
      buyer,
      seller,
    };
    const ownSide = /SUBMISSION|SUBMITTED|YOU|ME/i.test(buyer)
      ? "BUY"
      : /SUBMISSION|SUBMITTED|YOU|ME/i.test(seller)
        ? "SELL"
        : null;
    if (ownSide && product) {
      const prevPosition = positionByProduct.get(product) || 0;
      const signedQty = ownSide === "BUY" ? quantity : -quantity;
      const position = prevPosition + signedQty;
      positionByProduct.set(product, position);
      fills.push({
        seq: idx,
        day,
        timestamp,
        product,
        side: ownSide,
        fill_type: "website_log",
        price: base.price,
        quantity,
        position,
        realized_pnl: null,
      });
    }
    return base;
  });

  return {
    portfolio_points: portfolioPoints,
    points,
    fills,
    market_trades: marketTrades,
    state_logs: [],
    metrics: computePortfolioMetrics(portfolioPoints),
    matching_mode: "website_log",
    limits_override: {},
    source: {
      type: "imc_backtester_log",
      filename,
    },
  };
}

function handleLogFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const result = parseImcBacktesterLog(String(reader.result || ""), file.name);
      applyResult(result);
      updateSyntheticRunOptions();
      if (dom.logMeta) dom.logMeta.textContent = `Loaded log: ${file.name}`;
      setStatus(`Loaded IMC log (${result.points.length.toLocaleString()} rows).`);
    } catch (error) {
      console.error(error);
      setStatus(error?.message || String(error), true);
      if (dom.logMeta) dom.logMeta.textContent = "Could not parse log";
    }
  };
  reader.onerror = () => setStatus(`Could not read ${file.name}`, true);
  reader.readAsText(file);
}

function handleStrategyFile(file) {
  if (!file) {
    return;
  }
  if (!file.name.endsWith(".py")) {
    setStatus("Please upload a Python strategy file (.py).", true);
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    strategyCode = String(reader.result || "");
    strategyName = file.name.replace(/\.py$/i, "");
    dom.strategyMeta.textContent = `Loaded strategy: ${file.name}`;
    setStatus(`Loaded ${file.name}`);
  };
  reader.onerror = () => setStatus(`Could not read ${file.name}`, true);
  reader.readAsText(file);
}

function updateRound(round) {
  currentRound = String(round);
  const config = ROUND_CONFIGS[currentRound];
  if (!config) return;

  DATA_FILES = config.files;
  DATA_BASE_PATH = config.basePath;

  // Update UI Labels
  if (dom.emeraldLimitLabel) dom.emeraldLimitLabel.textContent = `${config.labels.emerald} Limit`;
  if (dom.tomatoLimitLabel) dom.tomatoLimitLabel.textContent = `${config.labels.tomato} Limit`;
  
  if (dom.roundMetaPill) {
    dom.roundMetaPill.innerHTML = `<span class="lbl">round</span>${currentRound}`;
  }

  // Update Voucher Visibility
  if (dom.voucherLimit) {
    const isR3 = currentRound === "3";
    dom.voucherLimit.closest(".field").style.display = isR3 ? "" : "none";
  }

  renderDataFiles();
  setStatus(`Switched to Round ${currentRound}.`);
}

function saveSettings() {
  const settings = {
    roundSelect: dom.roundSelect?.value,
    matchingMode: dom.matchingMode?.value,
    emeraldLimit: dom.emeraldLimit?.value,
    tomatoLimit: dom.tomatoLimit?.value,
    voucherLimit: dom.voucherLimit?.value,
    performanceMode: dom.performanceMode?.value,
  };
  localStorage.setItem('prosperitySettings', JSON.stringify(settings));
}

function loadSettings() {
  try {
    const raw = localStorage.getItem('prosperitySettings');
    if (!raw) return;
    const settings = JSON.parse(raw);
    if (settings.roundSelect && dom.roundSelect) {
      dom.roundSelect.value = settings.roundSelect;
      updateRound(settings.roundSelect);
    }
    if (settings.matchingMode && dom.matchingMode) dom.matchingMode.value = settings.matchingMode;
    if (settings.emeraldLimit && dom.emeraldLimit) dom.emeraldLimit.value = settings.emeraldLimit;
    if (settings.tomatoLimit && dom.tomatoLimit) dom.tomatoLimit.value = settings.tomatoLimit;
    if (settings.voucherLimit && dom.voucherLimit) dom.voucherLimit.value = settings.voucherLimit;
    if (settings.performanceMode && dom.performanceMode) {
      dom.performanceMode.value = settings.performanceMode;
      performanceMode = settings.performanceMode;
    }
  } catch (e) {
    console.error("Failed to load settings", e);
  }
}

function bindEvents() {
  initializeGraphWidgets();
  
  if (dom.watchButton) {
    dom.watchButton.addEventListener("click", startWatching);
  }

  if (dom.roundSelect) {
    dom.roundSelect.addEventListener("change", (e) => {
      updateRound(e.target.value);
      saveSettings();
    });
  }
  
  // Save settings when limits/modes change
  const configInputs = [dom.matchingMode, dom.emeraldLimit, dom.tomatoLimit, dom.voucherLimit, dom.performanceMode];
  configInputs.forEach(input => {
    if (input) input.addEventListener("change", saveSettings);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeFullscreenWidget();
    
    // Ignore shortcuts if typing in an input
    if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA" || event.target.tagName === "SELECT") {
      return;
    }
    
    if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      if (!dom.runButton.disabled) runSimulation();
    } else if (['0', '1', '2', '3'].includes(event.key)) {
      if (dom.roundSelect && dom.roundSelect.value !== event.key) {
        dom.roundSelect.value = event.key;
        updateRound(event.key);
        saveSettings();
      }
    }
  });

  dom.strategyInput.addEventListener("change", (event) => {
    handleStrategyFile(event.target.files?.[0]);
  });

  dom.dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dom.dropZone.classList.add("dragover");
  });
  dom.dropZone.addEventListener("dragleave", () => dom.dropZone.classList.remove("dragover"));
  dom.dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dom.dropZone.classList.remove("dragover");
    handleStrategyFile(event.dataTransfer?.files?.[0]);
  });

  if (dom.logInput) {
    dom.logInput.addEventListener("change", (event) => {
      handleLogFile(event.target.files?.[0]);
    });
  }
  if (dom.logDropZone) {
    dom.logDropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      dom.logDropZone.classList.add("dragover");
    });
    dom.logDropZone.addEventListener("dragleave", () => dom.logDropZone.classList.remove("dragover"));
    dom.logDropZone.addEventListener("drop", (event) => {
      event.preventDefault();
      dom.logDropZone.classList.remove("dragover");
      handleLogFile(event.dataTransfer?.files?.[0]);
    });
  }

  dom.runButton.addEventListener("click", runSimulation);


  dom.analysisProduct.addEventListener("change", () => {
    analysisState.product = dom.analysisProduct.value;
    buildTraderIdOptions(lastResult);
    renderAnalysis(lastResult);
  });
  dom.analysisSide.addEventListener("change", () => {
    analysisState.side = dom.analysisSide.value;
    renderAnalysis(lastResult);
  });
  dom.analysisMinQty.addEventListener("input", () => {
    analysisState.minQty = Number.parseInt(dom.analysisMinQty.value, 10) || 0;
    renderAnalysis(lastResult);
  });
  dom.analysisNormalize.addEventListener("change", () => {
    analysisState.normalize = dom.analysisNormalize.value;
    renderAnalysis(lastResult);
  });
  dom.analysisTimelineSort.addEventListener("change", () => {
    analysisState.timelineSort = dom.analysisTimelineSort.value;
    renderAnalysis(lastResult);
  });
  dom.analysisBookView.addEventListener("change", () => {
    analysisState.bookView = dom.analysisBookView.value;
    renderAnalysis(lastResult);
  });
  if (dom.sizeBucket) {
    dom.sizeBucket.addEventListener("change", () => {
      analysisState.sizeBucket = dom.sizeBucket.value;
      renderAnalysis(lastResult);
    });
  }
  if (dom.showOwnFills) {
    dom.showOwnFills.addEventListener("change", () => {
      analysisState.showOwnFills = dom.showOwnFills.checked;
      renderAnalysis(lastResult);
    });
  }
  if (dom.showMarketTrades) {
    dom.showMarketTrades.addEventListener("change", () => {
      analysisState.showMarketTrades = dom.showMarketTrades.checked;
      renderAnalysis(lastResult);
    });
  }
  if (dom.classifyTrades) {
    dom.classifyTrades.addEventListener("change", () => {
      analysisState.classifyTrades = dom.classifyTrades.checked;
      renderAnalysis(lastResult);
    });
  }
  const traderIdEl = document.getElementById("analysisTraderId");
  if (traderIdEl) {
    traderIdEl.addEventListener("change", () => {
      analysisState.traderId = traderIdEl.value;
      renderAnalysis(lastResult);
    });
  }

  if (dom.performanceMode) {
    dom.performanceMode.addEventListener("change", () => {
      performanceMode = dom.performanceMode.value;
      renderPortfolioChart(lastResult);
      renderProductCharts(lastResult.points || [], lastResult.fills || []);
      renderAnalysis(lastResult);
    });
  }

  if (dom.pinRunButton) {
    dom.pinRunButton.addEventListener("click", pinCurrentRun);
  }
  if (dom.clearPinnedRuns) {
    dom.clearPinnedRuns.addEventListener("click", clearPinnedRuns);
  }

  if (dom.syntheticFormula) {
    dom.syntheticFormula.addEventListener("change", renderSyntheticChart);
    dom.syntheticFormula.addEventListener("keyup", (event) => {
      if (event.key === "Enter") renderSyntheticChart();
    });
  }
  if (dom.syntheticRun) {
    dom.syntheticRun.addEventListener("change", renderSyntheticChart);
  }
  if (dom.exportExcelButton) {
    dom.exportExcelButton.addEventListener("click", exportExcel);
  }

  const tabButtons = document.querySelectorAll("[data-tab-target]");
  const tabPanels = document.querySelectorAll("[data-tab-panel]");
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.getAttribute("data-tab-target");
      tabButtons.forEach((btn) => {
        const isActive = btn === button;
        btn.classList.toggle("active", isActive);
        btn.classList.toggle("on", isActive);
      });
      tabPanels.forEach((panel) => {
        const isTarget = panel.getAttribute("data-tab-panel") === target;
        panel.classList.toggle("overview-hidden", !isTarget);
        panel.classList.toggle("on", isTarget);
      });
      window.dispatchEvent(new Event("resize"));
      // Render Analysis lazily — only when user opens that tab.
      if (target === "analysis") {
        requestAnimationFrame(maybeRenderAnalysis);
      }
    });
  });
}

async function main() {
  loadSettings();
  renderDataFiles();
  applyRoundThreeLabels();
  bindEvents();
  updateSyntheticRunOptions();
  setStatus("Initializing Pyodide...");
  try {
    await ensurePyodide();
  } catch (error) {
    console.error(error);
    setStatus(error?.message || String(error), true);
    return;
  }
  dom.strategyMeta.textContent = "Drop a .py strategy file to begin.";
  setStatus("Ready.");
}

main();
