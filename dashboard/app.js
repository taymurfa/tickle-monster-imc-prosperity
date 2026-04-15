const DATA_FILES = [
  "prices_round_0_day_-2.csv",
  "prices_round_0_day_-1.csv",
  "trades_round_0_day_-2.csv",
  "trades_round_0_day_-1.csv",
];

const DATA_BASE_PATH = "../Mitchell";
const DEFAULT_STRATEGY_PATH = "../Mitchell/SampleStrategy.py";

const dom = {
  dataFileList: document.getElementById("dataFileList"),
  strategyInput: document.getElementById("strategyInput"),
  dropZone: document.getElementById("dropZone"),
  strategyMeta: document.getElementById("strategyMeta"),
  status: document.getElementById("status"),
  runButton: document.getElementById("runButton"),
  matchingMode: document.getElementById("matchingMode"),
  emeraldLimit: document.getElementById("emeraldLimit"),
  tomatoLimit: document.getElementById("tomatoLimit"),
  portfolioChart: document.getElementById("portfolioChart"),
  productCharts: document.getElementById("productCharts"),
  exportFillsCsv: document.getElementById("exportFillsCsv"),
  exportEquityCsv: document.getElementById("exportEquityCsv"),
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
let lastResult = {
  points: [],
  fills: [],
  market_trades: [],
  state_logs: [],
  metrics: {},
};

// ── multi-run comparison ─────────────────────────────────────────────────────
const savedRuns = [];
const RUN_PALETTE = ["#0891b2", "#7c3aed", "#d97706", "#16a34a", "#dc2626", "#db2777"];

// ── performance / downsampling ────────────────────────────────────────────────
let performanceMode = "full";

// ── indicator overlay ─────────────────────────────────────────────────────────
const overlayState = {
  enabledKeys: new Set(),
  availableKeys: [],
};
const INDICATOR_COLORS = ["#0891b2", "#7c3aed", "#b45309", "#16a34a", "#dc2626", "#6b7280", "#0f766e", "#d97706"];

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
};

const FIXED_VALUE_PRODUCTS = {
  EMERALDS: 10000,
};

// ── centralised Plotly dark-theme layout defaults ────────────────────────────
const CHART_BG   = "rgba(0,0,0,0)";
const PLOT_BG    = "#1A1A22";
const GRID_COLOR = "rgba(255,255,255,0.05)";
const FONT_COLOR = "#8E8E9E";
const SPIKE_COLOR = "#00C805";

function baseLayout(extra = {}) {
  return {
    paper_bgcolor: CHART_BG,
    plot_bgcolor:  PLOT_BG,
    font: { color: FONT_COLOR, family: "IBM Plex Mono, monospace", size: 11 },
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
      tickfont: { size: 10 },
    },
    yaxis: {
      showgrid: true,
      gridcolor: GRID_COLOR,
      zeroline: false,
      color: FONT_COLOR,
      tickfont: { size: 10 },
    },
    ...extra,
  };
}

// ── performance: downsample points, always keeping points that have fills ────
function samplePoints(points, fills, mode) {
  if (mode === "full" || points.length <= 500) {
    return points;
  }
  const step = mode === "medium" ? 2 : 5;
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
  if (direction === "aggressiveBuy") return "#dc2626";
  if (direction === "aggressiveSell") return "#2563eb";
  return "#9ca3af";
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
    if (statusEl) statusEl.textContent = "No numeric fields in traderData JSON";
    if (dom.indicatorChart) dom.indicatorChart.style.display = "none";
    return;
  }
  if (statusEl) statusEl.textContent = `${overlayState.availableKeys.length} fields available`;

  for (const [i, key] of overlayState.availableKeys.entries()) {
    const color = INDICATOR_COLORS[i % INDICATOR_COLORS.length];
    const label = document.createElement("label");
    label.className = "toggle-label";
    label.style.borderColor = color;
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.key = key;
    cb.checked = overlayState.enabledKeys.has(key);
    cb.style.accentColor = color;
    cb.addEventListener("change", () => {
      if (cb.checked) overlayState.enabledKeys.add(key);
      else overlayState.enabledKeys.delete(key);
      renderIndicatorChart(result);
    });
    label.appendChild(cb);
    label.append(` ${key}`);
    container.appendChild(label);
  }

  renderIndicatorChart(result);
}

function renderIndicatorChart(result) {
  const chartEl = dom.indicatorChart;
  if (!chartEl) return;

  const enabledKeys = [...overlayState.enabledKeys];
  if (enabledKeys.length === 0) {
    chartEl.style.display = "none";
    if (chartEl._hasPlot) { Plotly.purge(chartEl); chartEl._hasPlot = false; }
    return;
  }

  chartEl.style.display = "";
  const fields = extractIndicatorFields(result.state_logs || []);
  const productPoints = getProductPoints(result.points, analysisState.product);
  const indexByKey = new Map(productPoints.map((p, idx) => [parseKey(p), idx]));
  const axis = buildTimeAxis(productPoints);

  const traces = enabledKeys.map((key, i) => {
    const series = fields.get(key) || [];
    const color = INDICATOR_COLORS[i % INDICATOR_COLORS.length];
    const pts = series.filter((pt) => indexByKey.has(`${pt.day}|${pt.timestamp}`));
    return {
      type: "scatter",
      mode: "lines",
      name: key,
      x: pts.map((pt) => indexByKey.get(`${pt.day}|${pt.timestamp}`)),
      y: pts.map((pt) => pt.value),
      line: { color, width: 1.8 },
      hovertemplate: `${key}=%{y:.4f}<extra></extra>`,
    };
  });

  const allY = traces.flatMap((t) => t.y);

  Plotly.newPlot(
    chartEl,
    traces,
    baseLayout({
      legend: { orientation: "h", y: 1.14, font: { size: 10, color: FONT_COLOR }, bgcolor: "rgba(0,0,0,0)" },
      xaxis: { title: "Time", tickvals: axis.tickVals, ticktext: axis.tickText, showgrid: true, gridcolor: GRID_COLOR, color: FONT_COLOR, tickfont: { size: 10 } },
      yaxis: { title: "Indicator", range: computeRange(allY), showgrid: true, gridcolor: GRID_COLOR, color: FONT_COLOR, tickfont: { size: 10 } },
    }),
    { responsive: true, displaylogo: false }
  );
  chartEl._hasPlot = true;
}

// ── multi-run comparison ──────────────────────────────────────────────────────
function pinCurrentRun() {
  if (!lastResult.points || lastResult.points.length === 0) {
    setStatus("No run to pin — run a simulation first.", true);
    return;
  }
  const label = (dom.runLabel?.value || "").trim() || `Run ${savedRuns.length + 1}`;
  const color = RUN_PALETTE[savedRuns.length % RUN_PALETTE.length];
  savedRuns.push({ label, color, points: lastResult.points, fills: lastResult.fills, metrics: lastResult.metrics });
  if (dom.runLabel) dom.runLabel.value = "";
  renderSavedRunsList();
  renderPortfolioChart(lastResult.points);
  setStatus(`Pinned run: "${label}"`);
}

function renderSavedRunsList() {
  const list = dom.savedRunsList;
  if (!list) return;
  list.innerHTML = "";
  if (savedRuns.length === 0) return;
  for (let i = 0; i < savedRuns.length; i++) {
    const run = savedRuns[i];
    const li = document.createElement("li");
    li.className = "saved-run-item";
    li.innerHTML = `
      <span class="run-dot" style="background:${run.color}"></span>
      <span style="flex:1">${run.label}</span>
      <span style="color:var(--muted);font-size:0.75rem">${fmtNumber(run.metrics?.final_pnl ?? 0, 0)} PnL</span>
      <button class="btn small-btn" data-idx="${i}" style="padding:2px 7px;font-size:0.72rem">✕</button>
    `;
    li.querySelector("button").addEventListener("click", () => {
      savedRuns.splice(i, 1);
      renderSavedRunsList();
      renderPortfolioChart(lastResult.points);
    });
    list.appendChild(li);
  }
}

// ── synthetic / spread view ───────────────────────────────────────────────────
function computeSyntheticSeries(formula, points) {
  const products = [...new Set(points.map((p) => p.product))];
  const tsMap = new Map();
  for (const pt of points) {
    const key = `${pt.day}|${pt.timestamp}`;
    if (!tsMap.has(key)) tsMap.set(key, { day: pt.day, timestamp: pt.timestamp });
    tsMap.get(key)[pt.product] = pt.mid_price;
  }

  const result = [];
  for (const [, vars] of tsMap) {
    let expr = formula;
    let valid = true;
    for (const product of products) {
      if (expr.includes(product)) {
        const val = vars[product];
        if (val === undefined) { valid = false; break; }
        expr = expr.replaceAll(product, String(val));
      }
    }
    if (!valid) continue;
    try {
      // eslint-disable-next-line no-new-func
      const val = new Function(`return (${expr})`)();
      if (Number.isFinite(val)) {
        result.push({ day: vars.day, timestamp: vars.timestamp, value: val });
      }
    } catch { /* invalid formula at this point */ }
  }
  return result.sort(sortByDayThenTs);
}

function renderSyntheticChart(formula, points) {
  const chartEl = dom.syntheticChart;
  if (!chartEl) return;

  if (!formula.trim() || points.length === 0) {
    chartEl.style.display = "none";
    return;
  }

  const series = computeSyntheticSeries(formula, points);
  if (series.length === 0) {
    chartEl.style.display = "none";
    setStatus("Synthetic: formula produced no data. Check product names.", true);
    return;
  }

  const stitched = stitchSeriesByDay(series.map((s) => ({ ...s, sv: s.value })), "sv");
  const axis = buildTimeAxis(series);
  const useZscore = document.getElementById("syntheticZscore")?.checked;
  const showEvents = document.getElementById("syntheticShowEvents")?.checked;

  let yVals = stitched.map((s) => s.stitchedValue);
  if (useZscore) yVals = computeZscore(yVals);

  chartEl.style.display = "";
  const traces = [{
    type: "scatter", mode: "lines",
    name: useZscore ? `z(${formula})` : formula,
    x: axis.x, y: yVals,
    line: { color: "#00C805", width: 2 },
    hovertemplate: `val=%{y:.4f}<extra></extra>`,
  }];

  const shapes = [];
  // Zero line for z-score
  if (useZscore) {
    shapes.push({ type: "line", xref: "paper", yref: "y", x0: 0, x1: 1, y0: 0, y1: 0, line: { color: "rgba(0,200,5,0.25)", width: 1, dash: "dot" } });
  }

  // Feature 7: spread event markers
  if (showEvents) {
    const events = findSpreadEvents(yVals);
    const evX = events.map(e => e.idx);
    const evY = events.map(e => yVals[e.idx]);
    const evText = events.map(e => e.type);
    traces.push({
      type: "scatter", mode: "markers", name: "Events",
      x: evX, y: evY, text: evText,
      marker: { size: 9, color: "#FF4B4B", symbol: "diamond" },
      hovertemplate: "%{text}<br>val=%{y:.4f}<extra></extra>",
    });
  }

  Plotly.newPlot(
    chartEl,
    traces,
    baseLayout({
      legend: { orientation: "h", y: 1.14, font: { size: 10, color: FONT_COLOR }, bgcolor: "rgba(0,0,0,0)" },
      xaxis: { title: "Time", tickvals: axis.tickVals, ticktext: axis.tickText, showgrid: true, gridcolor: GRID_COLOR, color: FONT_COLOR, tickfont: { size: 10 } },
      yaxis: { title: useZscore ? "Z-score" : "Value", range: computeRange(yVals), showgrid: true, gridcolor: GRID_COLOR, color: FONT_COLOR, tickfont: { size: 10 } },
      shapes,
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

async function fetchText(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Could not load ${path}: HTTP ${response.status}`);
  }
  return response.text();
}

async function loadDefaultStrategy() {
  strategyCode = await fetchText(DEFAULT_STRATEGY_PATH);
  dom.strategyMeta.textContent = `Using bundled strategy: ${DEFAULT_STRATEGY_PATH}`;
}

function setStatus(message, isError = false) {
  dom.status.textContent = message;
  dom.status.style.color = isError ? "#9b2226" : "";
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
  const emerald = Number.parseInt(dom.emeraldLimit.value, 10);
  const tomatoes = Number.parseInt(dom.tomatoLimit.value, 10);

  return {
    EMERALDS: Number.isFinite(emerald) && emerald > 0 ? emerald : 80,
    TOMATOES: Number.isFinite(tomatoes) && tomatoes > 0 ? tomatoes : 80,
  };
}

function inferReferencePrice(product, point) {
  // Feature 4: custom traderData field normalization
  if (analysisState.normalize.startsWith("field:")) {
    const key = analysisState.normalize.slice(6);
    const logs = analysisState.activeResult?.state_logs || [];
    const log = logs.find(s => s.day === point.day && s.timestamp === point.timestamp);
    if (log?.trader_data) {
      try {
        const parsed = JSON.parse(log.trader_data);
        if (typeof parsed[key] === "number") return parsed[key];
      } catch {}
    }
    return point?.mid_price ?? null;
  }
  const fair = FIXED_VALUE_PRODUCTS[product];
  if (Number.isFinite(fair)) return fair;
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
  if (analysisState.normalize === "raw") return "Price";
  if (analysisState.normalize === "mid") return "Price − Mid";
  if (analysisState.normalize.startsWith("field:")) return `Price − ${analysisState.normalize.slice(6)}`;
  const hasFair = Number.isFinite(FIXED_VALUE_PRODUCTS[product]);
  return hasFair ? "Price − Fair Value" : "Price − Reference";
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

  const combined = [...pnlEvents.slice(0, 7), ...missed.slice(0, 7), ...tradeEvents.slice(0, 7)];

  if (analysisState.timelineSort === "pnl") {
    combined.sort((a, b) => b.score - a.score);
  } else {
    combined.sort(sortByDayThenTs);
  }

  const dedup = [];
  const seen = new Set();
  for (const event of combined) {
    const dedupKey = `${event.kind}|${event.key}`;
    if (seen.has(dedupKey)) {
      continue;
    }
    seen.add(dedupKey);
    dedup.push(event);
  }
  return dedup;
}

function renderTimelineEvents(result) {
  if (!dom.analysisEventStrip || !dom.analysisEventSummary) {
    return;
  }

  const events = buildTimelineEvents(result);
  analysisState.timelineEvents = events;
  const sortLabel = analysisState.timelineSort === "pnl" ? "PnL" : "Time";
  dom.analysisEventSummary.textContent = `${events.length} markers (${sortLabel})`;
  dom.analysisEventStrip.innerHTML = "";

  if (events.length === 0) {
    const empty = document.createElement("span");
    empty.className = "status";
    empty.textContent = "No notable events for current filters.";
    dom.analysisEventStrip.appendChild(empty);
    return;
  }

  for (const event of events) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `analysis-event-chip ${event.kind}`;
    chip.dataset.key = event.key;
    chip.textContent = `D${event.day} T${event.timestamp} ${event.label}`;
    dom.analysisEventStrip.appendChild(chip);
  }

  updateTimelineChipSelection();
}

function selectTimestampByIndex(rows, index) {
  selectTimestampFromIndex(rows, index);
  if (!analysisState.activeResult) {
    return;
  }
  renderAnalysisInspector(analysisState.activeResult);
  renderAnalysisFillsTable(analysisState.activeResult);
  renderMissedOpportunities(analysisState.activeResult);
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

function renderPortfolioChart(points) {
  const tracker = new Map();
  for (const point of points) {
    tracker.set(parseKey(point), {
      day: point.day,
      timestamp: point.timestamp,
      value: point.portfolio_mtm_pnl,
    });
  }

  const rows = stitchSeriesByDay([...tracker.values()].sort(sortByDayThenTs), "value");
  const axis = buildTimeAxis(rows);
  const yValues = rows.map((r) => r.stitchedValue);

  // Primary trace (current run)
  const traces = [
    {
      type: "scatter",
      mode: "lines",
      name: "Current",
      x: axis.x,
      y: yValues,
      line: { color: "#00C805", width: 2 },
      customdata: rows.map((r) => `D${r.day} T${r.timestamp}`),
      hovertemplate: "%{customdata}<br>PnL=%{y:.2f}<extra></extra>",
    },
  ];

  // Pinned runs overlaid as faded traces (normalised to same length scale)
  for (const run of savedRuns) {
    const runTracker = new Map();
    for (const pt of run.points) {
      runTracker.set(parseKey(pt), { day: pt.day, timestamp: pt.timestamp, value: pt.portfolio_mtm_pnl });
    }
    const runRows = stitchSeriesByDay([...runTracker.values()].sort(sortByDayThenTs), "value");
    // normalise x to same 0-N scale as current run for visual comparison
    const scaleRatio = rows.length > 1 ? (rows.length - 1) / Math.max(runRows.length - 1, 1) : 1;
    traces.push({
      type: "scatter",
      mode: "lines",
      name: run.label,
      x: runRows.map((_, i) => i * scaleRatio),
      y: runRows.map((r) => r.stitchedValue),
      line: { color: run.color, width: 1.5, dash: "dot" },
      opacity: 0.65,
      hovertemplate: `${run.label}<br>PnL=%{y:.2f}<extra></extra>`,
    });
  }

  Plotly.newPlot(
    dom.portfolioChart,
    traces,
    baseLayout({
      margin: { l: 56, r: 20, t: savedRuns.length > 0 ? 28 : 8, b: 36 },
      legend: savedRuns.length > 0
        ? { orientation: "h", y: 1.14, font: { size: 10, color: FONT_COLOR }, bgcolor: "rgba(0,0,0,0)" }
        : { visible: false },
      xaxis: { title: "Time", tickvals: axis.tickVals, ticktext: axis.tickText, showgrid: true, gridcolor: GRID_COLOR, color: FONT_COLOR, tickfont: { size: 10 } },
      yaxis: { title: "PnL", range: computeRange(yValues), tickformat: ",.0f", showgrid: true, gridcolor: GRID_COLOR, color: FONT_COLOR, tickfont: { size: 10 } },
    }),
    { responsive: true, displaylogo: false }
  );
}

function buildAnalysisOptions(points) {
  const products = [...new Set(points.map((p) => p.product))].sort();
  const productExists = products.includes(analysisState.product);

  if (!productExists) {
    analysisState.product = products[0] || "ALL";
  }

  dom.analysisProduct.innerHTML = "";
  for (const product of products) {
    const option = document.createElement("option");
    option.value = product;
    option.textContent = product;
    if (product === analysisState.product) {
      option.selected = true;
    }
    dom.analysisProduct.appendChild(option);
  }
}

function getProductPoints(points, product) {
  return points.filter((p) => p.product === product).sort(sortByDayThenTs);
}

function getFilteredAnalysisFills(fills, product) {
  const side = analysisState.side;
  const minQty = Number.isFinite(analysisState.minQty) ? analysisState.minQty : 0;

  return fills
    .filter((f) => f.product === product)
    .filter((f) => side === "ALL" || f.side === side)
    .filter((f) => f.quantity >= minQty)
    .sort(sortByDayThenTs);
}

function updateAnalysisPointLookup(points) {
  analysisState.pointLookup = new Map();
  for (const point of points) {
    analysisState.pointLookup.set(parseProductKey(point), point);
  }
}

function pointForFill(fill) {
  return analysisState.pointLookup.get(`${fill.product}|${fill.day}|${fill.timestamp}`) || null;
}

function selectedRowFromPoints(rows) {
  if (rows.length === 0) {
    return null;
  }
  if (!analysisState.selectedKey) {
    return rows[rows.length - 1];
  }
  return rows.find((r) => parseKey(r) === analysisState.selectedKey) || rows[rows.length - 1];
}

function selectTimestampFromIndex(rows, index) {
  if (index == null || index < 0 || index >= rows.length) {
    return;
  }
  analysisState.selectedKey = parseKey(rows[index]);
}

function buildSelectionShape(index, yref = "paper") {
  if (index == null || index < 0) {
    return [];
  }
  return [
    {
      type: "line",
      xref: "x",
      yref,
      x0: index,
      x1: index,
      y0: 0,
      y1: yref === "paper" ? 1 : 0,
      line: { color: "#0f766e", width: 1.5, dash: "dot" },
    },
  ];
}

function renderAnalysisBookChart(result) {
  const product = analysisState.product;
  const rawProductPoints = getProductPoints(result.points, product);
  // Feature 5: downsampling — preserve fill timestamps
  const productFillsForSampling = getFilteredAnalysisFills(result.fills, product);
  const productPoints = samplePoints(rawProductPoints, productFillsForSampling, performanceMode);
  analysisState.bookRows = productPoints;

  const resolvedBookMode = resolveBookViewMode(product, productPoints);
  if (dom.analysisBookMode) {
    dom.analysisBookMode.textContent = resolvedBookMode === "fixed" ? "Mode: Fixed Edge View" : "Mode: Standard Price View";
  }
  const yAxisTitle = resolvedBookMode === "fixed" ? "Edge vs Fair Value" : getPriceAxisTitle(product);

  const axis = buildTimeAxis(productPoints);
  const indexByKey = new Map(productPoints.map((p, idx) => [parseKey(p), idx]));
  const selected = selectedRowFromPoints(productPoints);
  const selectedIndex = selected ? indexByKey.get(parseKey(selected)) : null;

  const productFills = getFilteredAnalysisFills(result.fills, product);
  const fillX = [];
  let normalizedFillY = [];
  const fillText = [];
  // Feature 2: honour showOwnFills toggle
  if (analysisState.showOwnFills) {
    for (const fill of productFills) {
      const idx = indexByKey.get(parseFillKey(fill));
      if (idx === undefined) {
        continue;
      }
      const point = pointForFill(fill);
      const normalizedPrice = normalizePrice(product, point, fill.price);
      if (normalizedPrice == null) {
        continue;
      }
      fillX.push(idx);
      normalizedFillY.push(normalizedPrice);
      fillText.push(`${fill.side} q=${fill.quantity}`);
    }
  }

  // Feature 2: filter market trades by size bucket, trader ID; classify if requested
  const marketTrades = (result.market_trades || [])
    .filter((t) => t.product === product)
    .filter((t) => indexByKey.has(`${t.day}|${t.timestamp}`))
    .filter((t) => sizeBucketMatch(t.quantity, analysisState.sizeBucket))
    .filter((t) => analysisState.traderId === "ALL" || t.buyer === analysisState.traderId || t.seller === analysisState.traderId);

  const marketX = marketTrades.map((t) => indexByKey.get(`${t.day}|${t.timestamp}`));
  let marketY = marketTrades.map((t) => {
    const point = analysisState.pointLookup.get(`${product}|${t.day}|${t.timestamp}`) || null;
    return normalizePrice(product, point, t.price);
  });
  // Build per-trade colours for classification mode
  const marketColors = marketTrades.map((t) => {
    if (!analysisState.classifyTrades) return "#6b7280";
    const point = analysisState.pointLookup.get(`${product}|${t.day}|${t.timestamp}`) || null;
    return tradeClassificationColor(classifyTradeDirection(t, point));
  });
  const marketText = marketTrades.map((t) => {
    if (!analysisState.classifyTrades) return `q=${t.quantity}`;
    const point = analysisState.pointLookup.get(`${product}|${t.day}|${t.timestamp}`) || null;
    return `${classifyTradeDirection(t, point)} q=${t.quantity}`;
  });

  const getLevelPrice = (point, side, level) => {
    const prices = side === "bid" ? point.bid_prices : point.ask_prices;
    if (!prices || prices.length <= level) {
      if (level === 0) {
        const fallback = side === "bid" ? point.best_bid : point.best_ask;
        return normalizePrice(product, point, fallback);
      }
      return null;
    }
    return normalizePrice(product, point, prices[level]);
  };

  let midSeries = productPoints.map((p) => normalizePrice(product, p, p.mid_price));
  let bidL1 = productPoints.map((p) => getLevelPrice(p, "bid", 0));
  let askL1 = productPoints.map((p) => getLevelPrice(p, "ask", 0));
  let bidL2 = productPoints.map((p) => getLevelPrice(p, "bid", 1));
  let bidL3 = productPoints.map((p) => getLevelPrice(p, "bid", 2));
  let askL2 = productPoints.map((p) => getLevelPrice(p, "ask", 1));
  let askL3 = productPoints.map((p) => getLevelPrice(p, "ask", 2));

  if (resolvedBookMode === "fixed") {
    const fair = inferReferencePrice(product, productPoints[0]);
    const toEdge = (value) => {
      if (!Number.isFinite(value) || !Number.isFinite(fair)) {
        return null;
      }
      return value - fair;
    };

    marketY = marketY.map(toEdge);
    midSeries = midSeries.map(toEdge);
    bidL1 = bidL1.map(toEdge);
    askL1 = askL1.map(toEdge);
    bidL2 = bidL2.map(toEdge);
    bidL3 = bidL3.map(toEdge);
    askL2 = askL2.map(toEdge);
    askL3 = askL3.map(toEdge);
    normalizedFillY = normalizedFillY.map(toEdge);
  }

  const hasDepthL2 = bidL2.some((v) => v != null) || askL2.some((v) => v != null);
  const hasDepthL3 = bidL3.some((v) => v != null) || askL3.some((v) => v != null);

  const traces = [
    {
      type: "scatter",
      mode: resolvedBookMode === "fixed" ? "markers" : "lines",
      name: "Bid",
      x: axis.x, y: bidL1,
      line: { color: "#4F8EF7", width: 1.8 },
      marker: { color: "#4F8EF7", size: resolvedBookMode === "fixed" ? 4 : 0, opacity: 0.7 },
      customdata: productPoints.map((p) => `D${p.day} T${p.timestamp}`),
      hovertemplate: "%{customdata}<br>Bid=%{y:.2f}<extra></extra>",
    },
    {
      type: "scatter",
      mode: resolvedBookMode === "fixed" ? "markers" : "lines",
      name: "Ask",
      x: axis.x, y: askL1,
      line: { color: "#FF4B4B", width: 1.8 },
      marker: { color: "#FF4B4B", size: resolvedBookMode === "fixed" ? 4 : 0, opacity: 0.7 },
      customdata: productPoints.map((p) => `D${p.day} T${p.timestamp}`),
      hovertemplate: "%{customdata}<br>Ask=%{y:.2f}<extra></extra>",
    },
    {
      type: "scatter",
      mode: resolvedBookMode === "fixed" ? "markers" : "lines",
      name: "Mid",
      x: axis.x, y: midSeries,
      line: { color: "#8E8E9E", width: 1.2, dash: "dot" },
      marker: { color: "#8E8E9E", size: resolvedBookMode === "fixed" ? 3 : 0, opacity: 0.5 },
      customdata: productPoints.map((p) => `D${p.day} T${p.timestamp}`),
      hovertemplate: "%{customdata}<br>Mid=%{y:.2f}<extra></extra>",
    },
    {
      type: "scatter",
      mode: "markers",
      name: "Fills",
      x: fillX, y: normalizedFillY, text: fillText,
      marker: {
        size: productFills.map((f) => Math.max(7, Math.min(16, f.quantity + 5))),
        color: productFills.map((f) => (f.side === "BUY" ? "#00C805" : "#FF4B4B")),
        line: { color: "rgba(0,0,0,0.4)", width: 0.5 },
      },
      hovertemplate: "%{text}<br>Price=%{y:.2f}<extra></extra>",
    },
    {
      type: "scatter",
      mode: "markers",
      name: "Market Trades",
      x: analysisState.showMarketTrades ? marketX : [],
      y: analysisState.showMarketTrades ? marketY : [],
      text: marketText,
      marker: {
        size: 5,
        color: analysisState.classifyTrades ? marketColors : "#6b7280",
        opacity: 0.72,
      },
      hovertemplate: resolvedBookMode === "fixed"
        ? "%{text}<br>Edge=%{y:.2f}<extra></extra>"
        : "%{text}<br>Price=%{y:.2f}<extra></extra>",
    },
  ];

  if (hasDepthL2) {
    traces.push(
      {
        type: "scatter",
        mode: "lines",
        name: "Bid L2",
        x: axis.x,
        y: bidL2,
        line: { color: "#60a5fa", width: 1.2, dash: "dash" },
        visible: "legendonly",
      },
      {
        type: "scatter",
        mode: "lines",
        name: "Ask L2",
        x: axis.x,
        y: askL2,
        line: { color: "#f87171", width: 1.2, dash: "dash" },
        visible: "legendonly",
      }
    );
  }

  if (hasDepthL3) {
    traces.push(
      {
        type: "scatter",
        mode: "lines",
        name: "Bid L3",
        x: axis.x,
        y: bidL3,
        line: { color: "#93c5fd", width: 1, dash: "dot" },
        visible: "legendonly",
      },
      {
        type: "scatter",
        mode: "lines",
        name: "Ask L3",
        x: axis.x,
        y: askL3,
        line: { color: "#fca5a5", width: 1, dash: "dot" },
        visible: "legendonly",
      }
    );
  }

  Plotly.newPlot(
    dom.analysisBookChart,
    traces,
    baseLayout({
      margin: { l: 56, r: 56, t: 8, b: 36 },
      legend: { orientation: "h", y: 1.14, font: { size: 10, color: FONT_COLOR }, bgcolor: "rgba(0,0,0,0)" },
      xaxis: {
        title: "Time", tickvals: axis.tickVals, ticktext: axis.tickText,
        showgrid: true, gridcolor: GRID_COLOR, color: FONT_COLOR, tickfont: { size: 10 },
        showspikes: true, spikemode: "across", spikesnap: "cursor",
        spikecolor: SPIKE_COLOR, spikethickness: 1,
      },
      yaxis: {
        title: yAxisTitle,
        range: computeRange([...midSeries, ...bidL1, ...askL1, ...bidL2, ...askL2, ...bidL3, ...askL3, ...normalizedFillY, ...marketY]),
        tickformat: resolvedBookMode === "fixed" ? ",.2f" : (analysisState.normalize === "raw" ? ",.0f" : ",.2f"),
        showgrid: true, gridcolor: GRID_COLOR, color: FONT_COLOR, tickfont: { size: 10 },
      },
      shapes: [
        ...buildSelectionShape(selectedIndex),
        ...(resolvedBookMode === "fixed" ? [{ type: "line", xref: "paper", yref: "y", x0: 0, x1: 1, y0: 0, y1: 0, line: { color: "rgba(0,200,5,0.25)", width: 1, dash: "dot" } }] : []),
      ],
    }),
    { responsive: true, displaylogo: false }
  );

  if (typeof dom.analysisBookChart.removeAllListeners === "function") {
    dom.analysisBookChart.removeAllListeners("plotly_click");
    dom.analysisBookChart.removeAllListeners("plotly_hover");
    dom.analysisBookChart.removeAllListeners("plotly_unhover");
  }
  dom.analysisBookChart.on("plotly_click", (event) => {
    if (!event || !event.points || event.points.length === 0) {
      return;
    }
    const idx = Number(event.points[0].x);
    selectTimestampByIndex(productPoints, idx);
  });
  dom.analysisBookChart.on("plotly_hover", (event) => {
    if (!event || !event.points || event.points.length === 0) {
      return;
    }
    const idx = Number(event.points[0].x);
    selectTimestampByIndex(productPoints, idx);
  });
  dom.analysisBookChart.on("plotly_unhover", () => {
    applySelectionCrosshair();
  });
}

function renderAnalysisPositionChart(result) {
  const product = analysisState.product;
  const productPoints = getProductPoints(result.points, product);
  analysisState.positionRows = productPoints;
  const stitched = stitchSeriesByDay(
    productPoints.map((p) => ({ ...p, mtmSeries: p.product_mtm_pnl })),
    "mtmSeries"
  );
  const axis = buildTimeAxis(productPoints);
  const indexByKey = new Map(productPoints.map((p, idx) => [parseKey(p), idx]));
  const selected = selectedRowFromPoints(productPoints);
  const selectedIndex = selected ? indexByKey.get(parseKey(selected)) : null;

  Plotly.newPlot(
    dom.analysisPositionChart,
    [
      {
        type: "scatter", mode: "lines", name: "Position",
        x: axis.x, y: productPoints.map((p) => p.position),
        line: { color: "#00C805", width: 2 },
        customdata: productPoints.map((p) => `D${p.day} T${p.timestamp}`),
        hovertemplate: "%{customdata}<br>Pos=%{y}<extra></extra>",
        yaxis: "y1",
      },
      {
        type: "scatter", mode: "lines", name: "PnL",
        x: axis.x, y: stitched.map((p) => p.stitchedValue),
        line: { color: "#4F8EF7", width: 1.8, dash: "dot" },
        customdata: stitched.map((p) => `D${p.day} T${p.timestamp}`),
        hovertemplate: "%{customdata}<br>PnL=%{y:.2f}<extra></extra>",
        yaxis: "y2",
      },
    ],
    baseLayout({
      margin: { l: 56, r: 56, t: 8, b: 36 },
      legend: { orientation: "h", y: 1.14, font: { size: 10, color: FONT_COLOR }, bgcolor: "rgba(0,0,0,0)" },
      xaxis: {
        title: "Time", tickvals: axis.tickVals, ticktext: axis.tickText,
        showgrid: true, gridcolor: GRID_COLOR, color: FONT_COLOR, tickfont: { size: 10 },
        showspikes: true, spikemode: "across", spikesnap: "cursor", spikecolor: SPIKE_COLOR, spikethickness: 1,
      },
      yaxis: { title: "Position", range: computeRange(productPoints.map((p) => p.position)), showgrid: true, gridcolor: GRID_COLOR, color: FONT_COLOR, tickfont: { size: 10 } },
      yaxis2: { title: "PnL", range: computeRange(stitched.map((p) => p.stitchedValue)), overlaying: "y", side: "right", showgrid: false, color: FONT_COLOR, tickfont: { size: 10 } },
      shapes: buildSelectionShape(selectedIndex),
    }),
    { responsive: true, displaylogo: false }
  );

  if (typeof dom.analysisPositionChart.removeAllListeners === "function") {
    dom.analysisPositionChart.removeAllListeners("plotly_click");
    dom.analysisPositionChart.removeAllListeners("plotly_hover");
    dom.analysisPositionChart.removeAllListeners("plotly_unhover");
  }
  dom.analysisPositionChart.on("plotly_click", (event) => {
    if (!event || !event.points || event.points.length === 0) {
      return;
    }
    const idx = Number(event.points[0].x);
    selectTimestampByIndex(productPoints, idx);
  });
  dom.analysisPositionChart.on("plotly_hover", (event) => {
    if (!event || !event.points || event.points.length === 0) {
      return;
    }
    const idx = Number(event.points[0].x);
    selectTimestampByIndex(productPoints, idx);
  });
  dom.analysisPositionChart.on("plotly_unhover", () => {
    applySelectionCrosshair();
  });
}

function renderAnalysisInspector(result) {
  const product = analysisState.product;
  const productPoints = getProductPoints(result.points, product);
  const selected = selectedRowFromPoints(productPoints);

  if (!selected) {
    dom.analysisSelectedTs.textContent = "Selected: none";
    dom.analysisTimestampDetail.textContent = "No points available for analysis.";
    dom.analysisStateDetail.textContent = "No traderData captured yet.";
    return;
  }

  analysisState.selectedKey = parseKey(selected);
  dom.analysisSelectedTs.textContent = `Selected: D${selected.day} T${selected.timestamp}`;

  const fillsAtTs = result.fills.filter(
    (f) => f.product === product && f.day === selected.day && f.timestamp === selected.timestamp
  );
  const marketAtTs = (result.market_trades || []).filter(
    (t) => t.product === product && t.day === selected.day && t.timestamp === selected.timestamp
  );

  const detail = {
    product,
    day: selected.day,
    timestamp: selected.timestamp,
    best_bid: selected.best_bid,
    best_ask: selected.best_ask,
    spread: (selected.best_ask ?? 0) - (selected.best_bid ?? 0),
    mid_price: selected.mid_price,
    bid_levels: (selected.bid_prices || []).map((px, i) => ({ price: px, qty: (selected.bid_volumes || [])[i] ?? null })),
    ask_levels: (selected.ask_prices || []).map((px, i) => ({ price: px, qty: (selected.ask_volumes || [])[i] ?? null })),
    position: selected.position,
    realized_pnl: Number(selected.realized_pnl).toFixed(2),
    product_mtm_pnl: Number(selected.product_mtm_pnl).toFixed(2),
    own_fills_count: fillsAtTs.length,
    market_trades_count: marketAtTs.length,
    own_fills: fillsAtTs,
    market_trades: marketAtTs,
  };

  dom.analysisTimestampDetail.textContent = JSON.stringify(detail, null, 2);

  const stateLog = (result.state_logs || []).find(
    (s) => s.day === selected.day && s.timestamp === selected.timestamp
  );
  dom.analysisStateDetail.textContent = formatTraderData(stateLog ? stateLog.trader_data : "");
}

function renderAnalysisFillsTable(result) {
  const product = analysisState.product;
  const rows = getFilteredAnalysisFills(result.fills, product).slice(-180).reverse();

  dom.analysisFillsTableBody.innerHTML = "";
  for (const fill of rows) {
    const point = pointForFill(fill);
    const mid = point ? Number(point.mid_price) : null;
    const edge = mid == null ? null : fill.side === "BUY" ? mid - fill.price : fill.price - mid;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fill.seq}</td>
      <td>${fill.day}</td>
      <td>${fill.timestamp}</td>
      <td>${fill.product}</td>
      <td>${fill.side}</td>
      <td>${fill.price}</td>
      <td>${fill.quantity}</td>
      <td>${edge == null ? "n/a" : fmtNumber(edge, 2)}</td>
    `;
    dom.analysisFillsTableBody.appendChild(tr);
  }
}

function computeMissedOpportunities(result) {
  const product = analysisState.product;
  const sideFilter = analysisState.side;
  const minQty = Number.isFinite(analysisState.minQty) ? analysisState.minQty : 0;
  const nearTouchTolerance = 1;

  const ownByKeySidePrice = new Map();
  for (const fill of result.fills.filter((f) => f.product === product)) {
    const key = `${fill.day}|${fill.timestamp}|${fill.side}|${fill.price}`;
    ownByKeySidePrice.set(key, (ownByKeySidePrice.get(key) || 0) + fill.quantity);
  }

  const events = [];
  for (const trade of (result.market_trades || []).filter((t) => t.product === product)) {
    const point = analysisState.pointLookup.get(`${product}|${trade.day}|${trade.timestamp}`) || null;
    if (!point) {
      continue;
    }

    const buyCross = point.best_bid != null && trade.price <= (point.best_bid + nearTouchTolerance);
    const sellCross = point.best_ask != null && trade.price >= (point.best_ask - nearTouchTolerance);
    if (!buyCross && !sellCross) {
      continue;
    }

    const side = buyCross ? "BUY" : "SELL";
    if (sideFilter !== "ALL" && sideFilter !== side) {
      continue;
    }

    if (trade.quantity < minQty) {
      continue;
    }

    const ownKey = `${trade.day}|${trade.timestamp}|${side}|${trade.price}`;
    const ownQty = ownByKeySidePrice.get(ownKey) || 0;
    const missedQty = Math.max(0, trade.quantity - ownQty);
    if (missedQty <= 0) {
      continue;
    }

    const edge = side === "BUY"
      ? (point.best_bid - trade.price)
      : (trade.price - point.best_ask);

    events.push({
      day: trade.day,
      timestamp: trade.timestamp,
      product,
      side,
      trade_price: trade.price,
      trade_qty: trade.quantity,
      own_qty: ownQty,
      missed_qty: missedQty,
      edge_vs_touch: edge,
    });
  }

  return events.sort(sortByDayThenTs);
}

function renderMissedOpportunities(result) {
  if (!dom.analysisMissedTableBody || !dom.analysisMissedCount) {
    return;
  }

  const events = computeMissedOpportunities(result);
  dom.analysisMissedCount.textContent = `${events.length} events`;
  dom.analysisMissedTableBody.innerHTML = "";

  if (events.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="9">No missed opportunities for current filters and product.</td>
    `;
    dom.analysisMissedTableBody.appendChild(tr);
    return;
  }

  for (const event of events.slice(-180).reverse()) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${event.day}</td>
      <td>${event.timestamp}</td>
      <td>${event.product}</td>
      <td>${event.side}</td>
      <td>${event.trade_price}</td>
      <td>${event.trade_qty}</td>
      <td>${event.own_qty}</td>
      <td>${event.missed_qty}</td>
      <td>${fmtNumber(event.edge_vs_touch, 2)}</td>
    `;
    dom.analysisMissedTableBody.appendChild(tr);
  }
}

function renderAnalysis(result) {
  if (!result || !result.points || result.points.length === 0) {
    return;
  }

  analysisState.activeResult = result;

  updateAnalysisPointLookup(result.points);
  buildAnalysisOptions(result.points);
  renderTimelineEvents(result);
  renderAnalysisBookChart(result);
  renderAnalysisPositionChart(result);
  renderAnalysisInspector(result);
  renderAnalysisFillsTable(result);
  renderMissedOpportunities(result);
  applySelectionCrosshair();
  // Feature 1: rebuild indicator overlays whenever product/result changes
  buildIndicatorCheckboxes(result);
}

function renderProductCharts(points, fills) {
  dom.productCharts.innerHTML = "";
  const products = [...new Set(points.map((p) => p.product))].sort();

  for (const product of products) {
    const productPoints = points.filter((p) => p.product === product).sort(sortByDayThenTs);
    const productFills = fills.filter((f) => f.product === product).sort(sortByDayThenTs);
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
    const mtmValues = stitchedProductPoints.map((p) => p.stitchedValue);
    const fillX = productFills.map((f) => indexByKey.get(parseFillKey(f))).filter((idx) => idx !== undefined);
    const fillY = productFills
      .map((f) => {
        const idx = indexByKey.get(parseFillKey(f));
        return idx === undefined ? null : f.price;
      })
      .filter((v) => v !== null);

    const card = document.createElement("div");
    card.className = "product-chart-item";

    const title = document.createElement("h3");
    title.className = "product-chart-title";
    title.textContent = product;
    card.appendChild(title);

    const plotTarget = document.createElement("div");
    plotTarget.className = "product-chart";
    card.appendChild(plotTarget);
    dom.productCharts.appendChild(card);

    const traces = [
      {
        type: "scatter",
        mode: "markers",
        name: `${product} Fills`,
        x: fillX,
        y: fillY,
        marker: {
          size: productFills.map((f) => Math.max(7, Math.min(16, f.quantity + 5))),
          color: productFills.map((f) => (f.side === "BUY" ? "#16a34a" : "#dc2626")),
          opacity: 0.85,
          line: { color: "#111827", width: 0.5 },
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
        line: { color: "#4F8EF7", width: 1.5, dash: "dot" },
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
        line: { color: "#0f766e", width: 2, dash: "dash" },
        customdata: productPoints.map((p) => `D${p.day} T${p.timestamp}`),
        hovertemplate: "%{customdata}<br>Fair Value=%{y:.0f}<extra></extra>",
        yaxis: "y1",
      });
    } else {
      traces.unshift({
        type: "scatter",
        mode: "lines",
        name: `${product} Mid Price`,
        x: axis.x,
        y: productPoints.map((p) => p.mid_price),
        line: { color: "#8E8E9E", width: 1.8 },
        customdata: productPoints.map((p) => `D${p.day} T${p.timestamp}`),
        hovertemplate: "%{customdata}<br>Mid=%{y:.2f}<extra></extra>",
        yaxis: "y1",
      });
    }

    Plotly.newPlot(
      plotTarget,
      traces,
      baseLayout({
        margin: { l: 56, r: 56, t: 6, b: 32 },
        legend: { orientation: "h", y: 1.14, font: { size: 10, color: FONT_COLOR }, bgcolor: "rgba(0,0,0,0)" },
        xaxis: { title: "Time", tickvals: axis.tickVals, ticktext: axis.tickText, showgrid: true, gridcolor: GRID_COLOR, color: FONT_COLOR, tickfont: { size: 10 } },
        yaxis: {
          title: isFixedValueProduct ? "Price" : "Price",
          range: computeRange(isFixedValueProduct ? [...fillY, fairValue] : productPoints.map((p) => p.mid_price)),
          tickformat: ",.0f", showgrid: true, gridcolor: GRID_COLOR, color: FONT_COLOR, tickfont: { size: 10 },
        },
        yaxis2: { title: "PnL", range: computeRange(mtmValues), tickformat: ",.0f", overlaying: "y", side: "right", showgrid: false, color: FONT_COLOR, tickfont: { size: 10 } },
      }),
      { responsive: true, displaylogo: false }
    );
  }
}

function renderMetrics(metrics) {
  dom.metrics.finalPnl.textContent = fmtNumber(metrics.final_pnl, 0);
  const ddPct = metrics.max_drawdown_pct == null ? "n/a" : `${fmtNumber(metrics.max_drawdown_pct * 100, 2)}%`;
  dom.metrics.maxDd.textContent = `${fmtNumber(metrics.max_drawdown_abs, 0)} (${ddPct})`;
  dom.metrics.sharpe.textContent = fmtNumber(metrics.sharpe, 4);
  dom.metrics.annSharpe.textContent = fmtNumber(metrics.annualized_sharpe, 4);
  dom.metrics.sortino.textContent = fmtNumber(metrics.sortino, 4);
  dom.metrics.calmar.textContent = fmtNumber(metrics.calmar, 4);
}

function renderFillsTable(fills) {
  dom.fillsTableBody.innerHTML = "";
  const rows = fills.slice(-120).reverse();

  for (const fill of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fill.seq}</td>
      <td>${fill.day}</td>
      <td>${fill.timestamp}</td>
      <td>${fill.product}</td>
      <td>${fill.side}</td>
      <td>${fill.price}</td>
      <td>${fill.quantity}</td>
      <td>${fill.position}</td>
      <td>${fmtNumber(fill.realized_pnl, 0)}</td>
    `;
    dom.fillsTableBody.appendChild(tr);
  }

  dom.tradeCount.textContent = `Trades: ${fills.length}`;
}

async function loadDatasetTexts() {
  const entries = await Promise.all(
    DATA_FILES.map(async (file) => [file, await fetchText(`${DATA_BASE_PATH}/${file}`)])
  );
  return Object.fromEntries(entries);
}

async function runSimulation() {
  dom.runButton.disabled = true;
  setStatus("Loading datasets...");

  try {
    const fileMap = await loadDatasetTexts();
    setStatus("Running strategy and matching orders...");

    const matchingMode = dom.matchingMode.value;
    const limits = getSelectedLimits();

    pyodide.globals.set("_strategy_code", strategyCode);
    pyodide.globals.set("_dataset_json", JSON.stringify(fileMap));
    pyodide.globals.set("_matching_mode", matchingMode);
    pyodide.globals.set("_limits_json", JSON.stringify(limits));

    const rawResult = await pyodide.runPythonAsync(
      "result = run_dashboard_backtest(_strategy_code, _dataset_json, _matching_mode, _limits_json)\nresult"
    );

    const parsed = JSON.parse(rawResult);
    parsed.market_trades = parsed.market_trades || [];
    parsed.state_logs = parsed.state_logs || [];

    // Feature 5: inject proxy metrics into state_logs before rendering
    computeAndInjectProxyMetrics(parsed);

    lastResult = parsed;
    invalidateSeriesCache();

    // Feature 3: store run for comparison
    const runLabel = (dom.runLabel?.value || "").trim() || `Run ${runCounter + 1}`;
    storeRun(parsed, runLabel);

    renderPortfolioChart(parsed.points);
    renderProductCharts(parsed.points, parsed.fills);
    renderMetrics(parsed.metrics);
    renderFillsTable(parsed.fills);
    renderAnalysis(parsed);

    // Feature 2: populate trader ID filter
    buildTraderIdFilter(parsed.market_trades);
    // Feature 4: populate normalize-by-field options
    buildNormalizeOptions(parsed.state_logs);

    setStatus(`Done. Processed ${parsed.points.length} points and ${parsed.fills.length} simulated fills.`);
  } catch (error) {
    console.error(error);
    setStatus(`Simulation failed: ${error.message || error}`, true);
  } finally {
    dom.runButton.disabled = false;
  }
}

async function initializePyodide() {
  setStatus("Booting Pyodide runtime...");
  pyodide = await loadPyodide({
    stdout: () => {},
    stderr: (msg) => console.error(msg),
  });

  const engineCode = await fetchText("./backtest_engine.py");
  await pyodide.runPythonAsync(engineCode);
  setStatus("Ready. Choose or drop a strategy, then run simulation.");
}

function handleUploadedFile(file) {
  if (!file || !file.name.endsWith(".py")) {
    setStatus("Please provide a Python strategy file (.py).", true);
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    strategyCode = String(reader.result || "");
    dom.strategyMeta.textContent = `Loaded custom strategy: ${file.name}`;
    setStatus("Custom strategy loaded. Click Run Simulation.");
  };
  reader.readAsText(file);
}

function wireFileInputs() {
  dom.strategyInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    handleUploadedFile(file);
  });

  dom.dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dom.dropZone.classList.add("dragover");
  });

  dom.dropZone.addEventListener("dragleave", () => {
    dom.dropZone.classList.remove("dragover");
  });

  dom.dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dom.dropZone.classList.remove("dragover");
    const [file] = event.dataTransfer.files;
    handleUploadedFile(file);
  });
}

function wireAnalysisControls() {
  dom.analysisProduct.addEventListener("change", () => {
    analysisState.product = dom.analysisProduct.value;
    analysisState.selectedKey = null;
    renderAnalysis(lastResult);
  });

  dom.analysisSide.addEventListener("change", () => {
    analysisState.side = dom.analysisSide.value;
    renderAnalysis(lastResult);
  });

  dom.analysisMinQty.addEventListener("input", () => {
    const value = Number.parseInt(dom.analysisMinQty.value, 10);
    analysisState.minQty = Number.isFinite(value) && value >= 0 ? value : 0;
    renderAnalysis(lastResult);
  });

  dom.analysisNormalize.addEventListener("change", () => {
    analysisState.normalize = dom.analysisNormalize.value;
    renderAnalysis(lastResult);
  });

  dom.analysisBookView.addEventListener("change", () => {
    analysisState.bookView = dom.analysisBookView.value;
    renderAnalysis(lastResult);
  });

  dom.analysisTimelineSort.addEventListener("change", () => {
    analysisState.timelineSort = dom.analysisTimelineSort.value;
    renderAnalysis(lastResult);
  });

  dom.analysisEventStrip.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (!target.classList.contains("analysis-event-chip")) {
      return;
    }
    const key = target.dataset.key;
    selectTimestampByKey(analysisState.bookRows, key);
  });

  // Feature 2: new trade-type / size-bucket controls
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
}

function wireCompareControls() {
  // Portfolio chart pin/clear (savedRuns overlay)
  if (dom.pinRunButton) {
    dom.pinRunButton.addEventListener("click", pinCurrentRun);
  }
  if (dom.clearPinnedRuns) {
    dom.clearPinnedRuns.addEventListener("click", () => {
      savedRuns.length = 0;
      renderSavedRunsList();
      renderPortfolioChart(lastResult.points);
      setStatus("Pinned runs cleared.");
    });
  }
  // Feature 3: Compare tab button
  const compareBtn = document.getElementById("compareRunsBtn");
  if (compareBtn) compareBtn.addEventListener("click", renderCompareView);
}

function wireSyntheticControls() {
  // Feature 6: synthetic / spread view
  if (dom.syntheticRun) {
    dom.syntheticRun.addEventListener("click", () => {
      const formula = dom.syntheticFormula?.value || "";
      renderSyntheticChart(formula, lastResult.points);
    });
  }
  if (dom.syntheticFormula) {
    dom.syntheticFormula.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        renderSyntheticChart(dom.syntheticFormula.value, lastResult.points);
      }
    });
  }

  // Feature 5: performance mode
  if (dom.performanceMode) {
    dom.performanceMode.addEventListener("change", () => {
      performanceMode = dom.performanceMode.value;
      renderAnalysis(lastResult);
    });
  }

  // Feature 2: trader ID filter
  const traderIdEl = document.getElementById("traderIdFilter");
  if (traderIdEl) {
    traderIdEl.addEventListener("change", () => {
      analysisState.traderId = traderIdEl.value;
      renderAnalysis(lastResult);
    });
  }
}

function wireExportButtons() {
  dom.exportFillsCsv.addEventListener("click", () => {
    if (lastResult.fills.length === 0) {
      setStatus("No fill data to export yet.", true);
      return;
    }

    const rows = lastResult.fills.map((f) => [
      f.seq,
      f.day,
      f.timestamp,
      f.product,
      f.side,
      f.price,
      f.quantity,
      f.position,
      f.realized_pnl,
    ]);

    downloadCsv(
      "fills_all.csv",
      ["seq", "day", "timestamp", "product", "side", "price", "quantity", "position", "realized_pnl"],
      rows,
    );
    setStatus("Fills CSV downloaded.");
  });

  dom.exportEquityCsv.addEventListener("click", () => {
    if (lastResult.points.length === 0) {
      setStatus("No equity data to export yet.", true);
      return;
    }

    const rows = lastResult.points.map((p) => [
      p.day,
      p.timestamp,
      p.product,
      p.mid_price,
      p.position,
      p.realized_pnl,
      p.product_mtm_pnl,
      p.portfolio_mtm_pnl,
    ]);

    downloadCsv(
      "equity_all.csv",
      ["day", "timestamp", "product", "mid_price", "position", "realized_pnl", "product_mtm_pnl", "portfolio_mtm_pnl"],
      rows,
    );
    setStatus("Equity CSV downloaded.");
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE 2: Trader ID extraction + filter
// ══════════════════════════════════════════════════════════════════════════════

function extractTraderIds(marketTrades) {
  const ids = new Set();
  for (const t of marketTrades) {
    if (t.buyer && t.buyer !== "SUBMISSION" && t.buyer !== "") ids.add(t.buyer);
    if (t.seller && t.seller !== "SUBMISSION" && t.seller !== "") ids.add(t.seller);
  }
  return [...ids].sort();
}

function buildTraderIdFilter(marketTrades) {
  const el = document.getElementById("traderIdFilter");
  if (!el) return;
  const current = el.value;
  const ids = extractTraderIds(marketTrades);
  el.innerHTML = `<option value="ALL">ALL traders</option>`;
  for (const id of ids) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = id;
    el.appendChild(opt);
  }
  if (ids.includes(current)) el.value = current;
  analysisState.traderId = "ALL";
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE 4: Dynamic "normalize by traderData field" options
// ══════════════════════════════════════════════════════════════════════════════

function buildNormalizeOptions(stateLogs) {
  const el = dom.analysisNormalize;
  if (!el) return;
  // Remove previously added dynamic options
  for (const opt of [...el.querySelectorAll("option[data-dynamic]")]) opt.remove();
  const fields = extractIndicatorFields(stateLogs);
  for (const key of fields.keys()) {
    if (key.startsWith("~")) continue; // skip proxy fields in normalize list
    const opt = document.createElement("option");
    opt.value = `field:${key}`;
    opt.textContent = `Price − ${key}`;
    opt.dataset.dynamic = "1";
    el.appendChild(opt);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE 5: Auto-computed proxy metrics (book imbalance, vol imbalance, spread)
// ══════════════════════════════════════════════════════════════════════════════

function computeAndInjectProxyMetrics(result) {
  const tradesByKey = new Map();
  for (const t of (result.market_trades || [])) {
    const key = `${t.day}|${t.timestamp}|${t.product}`;
    if (!tradesByKey.has(key)) tradesByKey.set(key, []);
    tradesByKey.get(key).push(t);
  }

  const existingByKey = new Map();
  for (const log of (result.state_logs || [])) {
    existingByKey.set(`${log.day}|${log.timestamp}`, log);
  }

  const proxyByTs = new Map();
  for (const pt of result.points) {
    const tsKey = `${pt.day}|${pt.timestamp}`;
    if (!proxyByTs.has(tsKey)) proxyByTs.set(tsKey, { day: pt.day, timestamp: pt.timestamp, fields: {} });
    const entry = proxyByTs.get(tsKey);

    const trades = tradesByKey.get(`${pt.day}|${pt.timestamp}|${pt.product}`) || [];
    const bid1v = (pt.bid_volumes || [])[0] || 0;
    const ask1v = (pt.ask_volumes || [])[0] || 0;
    const total = bid1v + ask1v;
    const pfx = pt.product.slice(0, 3).toLowerCase() + "_";

    if (pt.mid_price > 0 && pt.best_bid != null && pt.best_ask != null) {
      entry.fields[`~${pfx}spread_bps`] = Number(((pt.best_ask - pt.best_bid) / pt.mid_price * 10000).toFixed(2));
    }
    if (total > 0) {
      entry.fields[`~${pfx}book_imb`] = Number(((bid1v - ask1v) / total).toFixed(3));
    }
    const aggB = trades.filter(t => pt.best_ask != null && t.price >= pt.best_ask).reduce((s, t) => s + t.quantity, 0);
    const aggS = trades.filter(t => pt.best_bid != null && t.price <= pt.best_bid).reduce((s, t) => s + t.quantity, 0);
    const totalTrade = trades.reduce((s, t) => s + t.quantity, 0);
    if (totalTrade > 0) {
      entry.fields[`~${pfx}vol_imb`] = Number(((aggB - aggS) / totalTrade).toFixed(3));
    }
  }

  for (const [tsKey, proxy] of proxyByTs) {
    const existing = existingByKey.get(tsKey);
    let existingFields = {};
    if (existing?.trader_data) {
      try { existingFields = JSON.parse(existing.trader_data) || {}; } catch {}
    }
    const merged = { ...existingFields, ...proxy.fields };
    if (existing) {
      existing.trader_data = JSON.stringify(merged);
    } else {
      result.state_logs.push({ day: proxy.day, timestamp: proxy.timestamp, trader_data: JSON.stringify(merged) });
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE 3: Runs store + full Compare tab
// ══════════════════════════════════════════════════════════════════════════════

const runs = [];
let runCounter = 0;

function storeRun(result, label) {
  runCounter += 1;
  runs.push({ label: label || `Run ${runCounter}`, result, id: runCounter });
  buildRunSelectors();
}

function buildRunSelectors() {
  const selA = document.getElementById("compareRunA");
  const selB = document.getElementById("compareRunB");
  const selProd = document.getElementById("compareProduct");
  const hint = document.getElementById("compareHint");
  if (!selA || !selB) return;

  const prevA = selA.value;
  const prevB = selB.value;

  selA.innerHTML = "";
  selB.innerHTML = "";
  for (let i = 0; i < runs.length; i++) {
    for (const sel of [selA, selB]) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = runs[i].label;
      sel.appendChild(opt);
    }
  }
  // Restore or default selections
  selA.value = prevA !== "" && runs[Number(prevA)] ? prevA : runs.length - 1;
  selB.value = prevB !== "" && runs[Number(prevB)] ? prevB : Math.max(0, runs.length - 2);

  if (hint) hint.textContent = `${runs.length} run${runs.length === 1 ? "" : "s"} stored`;

  if (selProd && runs.length > 0) {
    const products = [...new Set(runs[runs.length - 1].result.points.map(p => p.product))].sort();
    selProd.innerHTML = `<option value="ALL">ALL</option>`;
    for (const p of products) {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      selProd.appendChild(opt);
    }
  }
}

function computeFillsDiff(runA, runB, product) {
  const filter = (fills) => product === "ALL" ? fills : fills.filter(f => f.product === product);
  const makeKey = (f) => `${f.day}|${f.timestamp}|${f.product}|${f.side}|${f.price}`;
  const fillsA = filter(runA.result.fills);
  const fillsB = filter(runB.result.fills);
  const keysB = new Set(fillsB.map(makeKey));
  const keysA = new Set(fillsA.map(makeKey));
  return {
    onlyA: fillsA.filter(f => !keysB.has(makeKey(f))),
    onlyB: fillsB.filter(f => !keysA.has(makeKey(f))),
  };
}

function computePnlDivergence(runA, runB, topN = 25) {
  const mapA = new Map(runA.result.points.map(pt => [parseKey(pt), pt.portfolio_mtm_pnl]));
  const mapB = new Map(runB.result.points.map(pt => [parseKey(pt), pt.portfolio_mtm_pnl]));
  const divergence = [];
  for (const [key, pA] of mapA) {
    const pB = mapB.get(key);
    if (pB !== undefined) {
      const delta = Math.abs(pA - pB);
      if (delta > 0) {
        const [day, timestamp] = key.split("|").map(Number);
        divergence.push({ day, timestamp, pnlA: pA, pnlB: pB, delta });
      }
    }
  }
  return divergence.sort((a, b) => b.delta - a.delta).slice(0, topN);
}

function renderCompareView() {
  const selA = document.getElementById("compareRunA");
  const selB = document.getElementById("compareRunB");
  const selProd = document.getElementById("compareProduct");
  if (!selA || !selB || runs.length < 2) {
    setStatus("Need at least 2 runs — run the simulation again with different settings.", true);
    return;
  }
  const idxA = Number(selA.value);
  const idxB = Number(selB.value);
  if (idxA === idxB) { setStatus("Select two different runs.", true); return; }

  const runA = runs[idxA];
  const runB = runs[idxB];
  const product = selProd?.value || "ALL";

  renderComparePnlChart(runA, runB);
  renderComparePositionChart(runA, runB, product);

  const { onlyA, onlyB } = computeFillsDiff(runA, runB, product);
  const countA = document.getElementById("fillsOnlyACount");
  const countB = document.getElementById("fillsOnlyBCount");
  if (countA) countA.textContent = `${onlyA.length} fills`;
  if (countB) countB.textContent = `${onlyB.length} fills`;
  renderFillsDiffRows("fillsOnlyATable", onlyA);
  renderFillsDiffRows("fillsOnlyBTable", onlyB);
  renderPnlDivergenceRows(computePnlDivergence(runA, runB));
}

function renderComparePnlChart(runA, runB) {
  const el = document.getElementById("comparePnlChart");
  if (!el) return;
  function getRows(run) {
    const tracker = new Map();
    for (const pt of run.result.points) tracker.set(parseKey(pt), { day: pt.day, timestamp: pt.timestamp, value: pt.portfolio_mtm_pnl });
    return stitchSeriesByDay([...tracker.values()].sort(sortByDayThenTs), "value");
  }
  const rowsA = getRows(runA);
  const rowsB = getRows(runB);
  const axisA = buildTimeAxis(rowsA);
  Plotly.newPlot(el, [
    { type: "scatter", mode: "lines", name: runA.label, x: axisA.x, y: rowsA.map(r => r.stitchedValue), line: { color: "#00C805", width: 2 }, hovertemplate: `${runA.label} PnL=%{y:.2f}<extra></extra>` },
    { type: "scatter", mode: "lines", name: runB.label, x: buildTimeAxis(rowsB).x, y: rowsB.map(r => r.stitchedValue), line: { color: "#4F8EF7", width: 2 }, hovertemplate: `${runB.label} PnL=%{y:.2f}<extra></extra>` },
  ], baseLayout({
    legend: { orientation: "h", y: 1.14, font: { size: 10, color: FONT_COLOR }, bgcolor: "rgba(0,0,0,0)" },
    xaxis: { title: "Time", tickvals: axisA.tickVals, ticktext: axisA.tickText, showgrid: true, gridcolor: GRID_COLOR, color: FONT_COLOR, tickfont: { size: 10 } },
    yaxis: { title: "PnL", tickformat: ",.0f", showgrid: true, gridcolor: GRID_COLOR, color: FONT_COLOR, tickfont: { size: 10 } },
  }), { responsive: true, displaylogo: false });
}

function renderComparePositionChart(runA, runB, product) {
  const el = document.getElementById("comparePositionChart");
  if (!el) return;
  const prod = product === "ALL" ? (runA.result.points[0]?.product || "") : product;
  const ptsA = getProductPoints(runA.result.points, prod);
  const ptsB = getProductPoints(runB.result.points, prod);
  const axisA = buildTimeAxis(ptsA);
  Plotly.newPlot(el, [
    { type: "scatter", mode: "lines", name: `${runA.label} Pos`, x: axisA.x, y: ptsA.map(p => p.position), line: { color: "#00C805", width: 2 }, hovertemplate: `${runA.label} Pos=%{y}<extra></extra>` },
    { type: "scatter", mode: "lines", name: `${runB.label} Pos`, x: buildTimeAxis(ptsB).x, y: ptsB.map(p => p.position), line: { color: "#4F8EF7", width: 2 }, hovertemplate: `${runB.label} Pos=%{y}<extra></extra>` },
  ], baseLayout({
    legend: { orientation: "h", y: 1.14, font: { size: 10, color: FONT_COLOR }, bgcolor: "rgba(0,0,0,0)" },
    xaxis: { title: "Time", tickvals: axisA.tickVals, ticktext: axisA.tickText, showgrid: true, gridcolor: GRID_COLOR, color: FONT_COLOR, tickfont: { size: 10 } },
    yaxis: { title: `${prod} Position`, showgrid: true, gridcolor: GRID_COLOR, color: FONT_COLOR, tickfont: { size: 10 } },
  }), { responsive: true, displaylogo: false });
}

function renderFillsDiffRows(tableId, fills) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const tbody = table.querySelector("tbody");
  tbody.innerHTML = "";
  for (const f of fills.slice(0, 200)) {
    const tr = document.createElement("tr");
    const col = f.side === "BUY" ? "color:#00C805" : "color:#FF4B4B";
    tr.innerHTML = `<td>${f.day}</td><td>${f.timestamp}</td><td>${f.product}</td><td style="${col}">${f.side}</td><td>${f.price}</td><td>${f.quantity}</td>`;
    tbody.appendChild(tr);
  }
}

function renderPnlDivergenceRows(divergence) {
  const table = document.getElementById("pnlDivergenceTable");
  if (!table) return;
  const tbody = table.querySelector("tbody");
  tbody.innerHTML = "";
  for (const d of divergence) {
    const aWins = d.pnlA > d.pnlB;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${d.day}</td><td>${d.timestamp}</td><td style="color:${aWins ? "#00C805" : "#FF4B4B"}">${fmtNumber(d.pnlA, 0)}</td><td style="color:${!aWins ? "#00C805" : "#FF4B4B"}">${fmtNumber(d.pnlB, 0)}</td><td style="color:#8E8E9E">${fmtNumber(d.delta, 0)}</td>`;
    tbody.appendChild(tr);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE 6: Series cache
// ══════════════════════════════════════════════════════════════════════════════

const _seriesCache = new Map();
let _cacheRunId = 0;

function invalidateSeriesCache() { _seriesCache.clear(); }
function seriesCacheGet(key) { return _seriesCache.get(key); }
function seriesCacheSet(key, val) { _seriesCache.set(key, val); return val; }

// ══════════════════════════════════════════════════════════════════════════════
// FEATURE 7: Z-score + spread events for synthetic view
// ══════════════════════════════════════════════════════════════════════════════

function computeZscore(values, window = 50) {
  return values.map((val, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    const mean = slice.reduce((s, v) => s + v, 0) / slice.length;
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / slice.length;
    const std = Math.sqrt(variance);
    return std === 0 ? 0 : (val - mean) / std;
  });
}

function findSpreadEvents(values, topN = 10) {
  // Find zero crossings and local extrema
  const events = [];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    const cur = values[i];
    if (prev !== null && cur !== null && prev * cur < 0) {
      events.push({ idx: i, type: "zero_cross", score: 1 });
    }
  }
  // Local extrema (simple peak/trough)
  for (let i = 1; i < values.length - 1; i++) {
    const prev = values[i - 1];
    const cur = values[i];
    const next = values[i + 1];
    if (prev !== null && cur !== null && next !== null) {
      if (cur > prev && cur > next) events.push({ idx: i, type: "peak", score: Math.abs(cur) });
      if (cur < prev && cur < next) events.push({ idx: i, type: "trough", score: Math.abs(cur) });
    }
  }
  return events.sort((a, b) => b.score - a.score).slice(0, topN);
}

// ══════════════════════════════════════════════════════════════════════════════
// Tab navigation
// ══════════════════════════════════════════════════════════════════════════════

function wireTabNavigation() {
  const tabBar = document.getElementById("tabBar");
  if (!tabBar) return;

  // Init: hide all except overview
  for (const id of ["analysisTab", "compareTab"]) {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  }

  tabBar.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (!btn || !btn.dataset.tab) return;
    const tabId = btn.dataset.tab;

    for (const b of tabBar.querySelectorAll(".tab-btn")) b.classList.remove("active");
    btn.classList.add("active");

    for (const id of ["overviewTab", "analysisTab", "compareTab"]) {
      const el = document.getElementById(id);
      if (el) el.style.display = id === tabId ? "" : "none";
    }

    // Trigger reflow of Plotly charts when tab becomes visible
    if (tabId === "compareTab" && runs.length >= 2) {
      window.dispatchEvent(new Event("resize"));
    }
  });
}

function initTooltips() {
  const tip = document.getElementById("globalTooltip");
  if (!tip) return;

  let hideTimer = null;

  function showTip(text, x, y) {
    clearTimeout(hideTimer);
    tip.textContent = text;
    tip.classList.add("visible");
    positionTip(x, y);
  }

  function hideTip() {
    hideTimer = setTimeout(() => tip.classList.remove("visible"), 80);
  }

  function positionTip(x, y) {
    const pad = 14;
    const tw = tip.offsetWidth || 200;
    const th = tip.offsetHeight || 60;
    const left = x + pad + tw > window.innerWidth ? x - tw - pad : x + pad;
    const top  = y + pad + th > window.innerHeight ? y - th - pad : y + pad;
    tip.style.left = left + "px";
    tip.style.top  = top  + "px";
  }

  document.addEventListener("mouseover", e => {
    const el = e.target.closest("[data-tip]");
    if (!el) { hideTip(); return; }
    showTip(el.dataset.tip, e.clientX, e.clientY);
  });

  document.addEventListener("mousemove", e => {
    if (!tip.classList.contains("visible")) return;
    positionTip(e.clientX, e.clientY);
  });

  document.addEventListener("mouseout", e => {
    const el = e.target.closest("[data-tip]");
    if (!el) return;
    const related = e.relatedTarget;
    if (!related || !el.contains(related)) hideTip();
  });
}

async function main() {
  renderDataFiles();
  wireFileInputs();
  wireExportButtons();
  wireAnalysisControls();
  wireCompareControls();
  wireSyntheticControls();
  wireTabNavigation();
  initTooltips();
  dom.runButton.addEventListener("click", runSimulation);

  try {
    await Promise.all([initializePyodide(), loadDefaultStrategy()]);
  } catch (error) {
    console.error(error);
    setStatus(`Initialization error: ${error.message || error}`, true);
  }
}

main();
