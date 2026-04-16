const DATA_FILES = [
  "prices_round_1_day_-2.csv",
  "prices_round_1_day_-1.csv",
  "prices_round_1_day_0.csv",
  "trades_round_1_day_-2.csv",
  "trades_round_1_day_-1.csv",
  "trades_round_1_day_0.csv",
];

const DATA_BASE_PATH = "../ROUND1";
const DEFAULT_STRATEGY_PATH = "../traderv1.py";

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
  emeraldLimitLabel: document.querySelector('label[for="emeraldLimit"]'),
  tomatoLimitLabel: document.querySelector('label[for="tomatoLimit"]'),
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
  ASH_COATED_OSMIUM: 10000,
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
      type: "scatter",
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

function applyRoundOneLabels() {
  if (dom.emeraldLimitLabel) {
    dom.emeraldLimitLabel.textContent = "INTARIAN_PEPPER_ROOT Limit";
  }
  if (dom.tomatoLimitLabel) {
    dom.tomatoLimitLabel.textContent = "ASH_COATED_OSMIUM Limit";
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
  const pepper = Number.parseInt(dom.emeraldLimit.value, 10);
  const osmium = Number.parseInt(dom.tomatoLimit.value, 10);

  return {
    INTARIAN_PEPPER_ROOT: Number.isFinite(pepper) && pepper > 0 ? pepper : 80,
    ASH_COATED_OSMIUM: Number.isFinite(osmium) && osmium > 0 ? osmium : 80,
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

  const traces = [
    {
      type: "scatter",
      mode: "lines",
      name: "PnL",
      x: axis.x,
      y: yValues,
      line: { color: "#00C805", width: 2 },
      customdata: rows.map((r) => `D${r.day} T${r.timestamp}`),
      hovertemplate: "%{customdata}<br>PnL=%{y:.2f}<extra></extra>",
    },
  ];

  if (savedRuns.length > 0) {
    savedRuns.forEach((run, idx) => {
      const runTracker = new Map();
      for (const point of run.result.points) {
        runTracker.set(parseKey(point), {
          day: point.day,
          timestamp: point.timestamp,
          value: point.portfolio_mtm_pnl,
        });
      }
      const runRows = stitchSeriesByDay([...runTracker.values()].sort(sortByDayThenTs), "value");
      const runAxis = buildTimeAxis(runRows);
      traces.push({
        type: "scatter",
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
        y: priceValues,
        line: { color: "#111827", width: 1.8 },
        customdata: productPoints.map((p) => `D${p.day} T${p.timestamp}`),
        hovertemplate: "%{customdata}<br>Mid=%{y:.2f}<extra></extra>",
        yaxis: "y1",
      });
    }

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
          range: computeRange([...priceValues, ...fillY]),
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
        legend: { orientation: "h", y: 1.08, x: 0 },
      }),
      { responsive: true, displaylogo: false }
    );
  }
}

function renderMetrics(metrics) {
  dom.metrics.finalPnl.textContent = fmtNumber(metrics.final_pnl);
  dom.metrics.maxDd.textContent = `${fmtNumber(metrics.max_drawdown)} (${fmtNumber(metrics.max_drawdown_pct, 2)}%)`;
  dom.metrics.sharpe.textContent = fmtNumber(metrics.sharpe, 3);
  dom.metrics.annSharpe.textContent = fmtNumber(metrics.annualized_sharpe, 3);
  dom.metrics.sortino.textContent = fmtNumber(metrics.sortino, 3);
  dom.metrics.calmar.textContent = fmtNumber(metrics.calmar, 3);
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
      <td>${fill.price}</td>
      <td>${fill.quantity}</td>
      <td>${fill.position}</td>
      <td>${fmtNumber(fill.realized_pnl)}</td>
    `;
    dom.fillsTableBody.appendChild(row);
  }
  dom.tradeCount.textContent = `Trades: ${fills.length}`;
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
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${fill.day}</td>
      <td>${fill.timestamp}</td>
      <td>${fill.side}</td>
      <td>${fill.price}</td>
      <td>${fill.quantity}</td>
      <td>${fill.position}</td>
      <td>${edge == null ? "n/a" : fmtNumber(edge, 2)}</td>
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
      type: "scatter",
      mode: "lines",
      name: "Best Bid",
      x: axis.x,
      y: bestBidY,
      line: { color: "#2563eb", width: 1.5 },
      customdata: points.map((r) => `D${r.day} T${r.timestamp}`),
      hovertemplate: "%{customdata}<br>Bid=%{y}<extra></extra>",
    },
    {
      type: "scatter",
      mode: "lines",
      name: "Best Ask",
      x: axis.x,
      y: bestAskY,
      line: { color: "#dc2626", width: 1.5 },
      customdata: points.map((r) => `D${r.day} T${r.timestamp}`),
      hovertemplate: "%{customdata}<br>Ask=%{y}<extra></extra>",
    },
    {
      type: "scatter",
      mode: "lines",
      name: mode === "fixed" ? "Reference" : "Mid",
      x: axis.x,
      y: mode === "fixed"
        ? points.map((point) => normalizePrice(product, point, inferReferencePrice(product, point)))
        : midY,
      line: { color: "#9ca3af", width: 1.2, dash: "dot" },
      customdata: points.map((r) => `D${r.day} T${r.timestamp}`),
      hovertemplate: "%{customdata}<br>Ref=%{y}<extra></extra>",
    },
  ];

  if (analysisState.showOwnFills) {
    const ownFillRows = resultFills.filter((fill) => indexByKey.has(parseFillKey(fill)));
    traces.push({
      type: "scatter",
      mode: "markers",
      name: "Own Fills",
      x: ownFillRows.map((fill) => indexByKey.get(parseFillKey(fill))),
      y: ownFillRows.map((fill) => {
        const point = analysisState.pointLookup.get(`${fill.product}|${fill.day}|${fill.timestamp}`);
        return normalizePrice(product, point, fill.price);
      }),
      marker: {
        size: ownFillRows.map((fill) => Math.max(7, Math.min(18, fill.quantity + 4))),
        color: ownFillRows.map((fill) => (fill.side === "BUY" ? "#16a34a" : "#dc2626")),
        line: { color: "#111827", width: 0.5 },
        opacity: 0.85,
      },
      customdata: ownFillRows.map((fill) => `${fill.side} q${fill.quantity} @ ${fill.price}`),
      hovertemplate: "%{customdata}<extra></extra>",
    });
  }

  if (analysisState.showMarketTrades) {
    const marketRows = resultMarketTrades.filter((trade) => indexByKey.has(`${trade.day}|${trade.timestamp}`));
    traces.push({
      type: "scatter",
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
        const direction = analysisState.classifyTrades ? classifyTradeDirection(trade, point) : "trade";
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

  const points = getProductPoints(result.points, product);
  analysisState.positionRows = points;
  const axis = buildTimeAxis(points);

  const traces = [
    {
      type: "scatter",
      mode: "lines",
      name: "Position",
      x: axis.x,
      y: points.map((point) => point.position),
      line: { color: "#0f766e", width: 2 },
      customdata: points.map((point) => `D${point.day} T${point.timestamp}`),
      hovertemplate: "%{customdata}<br>Position=%{y}<extra></extra>",
      yaxis: "y1",
    },
    {
      type: "scatter",
      mode: "lines",
      name: "Product PnL",
      x: axis.x,
      y: points.map((point) => point.product_mtm_pnl),
      line: { color: "#4F8EF7", width: 1.5, dash: "dot" },
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

function renderAnalysis(result) {
  analysisState.activeResult = result;
  buildPointLookup(result.points);
  buildTraderIdOptions(result);
  analysisState.timelineEvents = buildTimelineEvents(result);
  renderEventTimeline(analysisState.timelineEvents);
  renderBookChart(result);
  renderPositionChart(result);
  renderAnalysisFillsTable(result);
  renderMissedOpportunitiesTable(result);
  renderTimestampInspector(result);
  renderIndicatorChart(result);
}

function applyResult(result) {
  lastResult = result;
  renderMetrics(result.metrics || {});
  renderPortfolioChart(result.points || []);
  renderProductCharts(result.points || [], result.fills || []);
  renderFillsTable(result.fills || []);
  buildAnalysisProductOptions(result.points || []);
  buildIndicatorCheckboxes(result);
  renderAnalysis(result);
  renderSavedRunsList();
  renderSyntheticChart();
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
      renderPortfolioChart(lastResult.points || []);
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
  renderPortfolioChart(lastResult.points || []);
  renderSyntheticChart();
  setStatus(`Pinned run: ${label}`);
}

function clearPinnedRuns() {
  savedRuns.length = 0;
  renderSavedRunsList();
  renderPortfolioChart(lastResult.points || []);
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
        type: "scatter",
        mode: "lines",
        name: formula,
        x: axis.x,
        y: rows.map((row) => row.value),
        line: { color: "#d97706", width: 2 },
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

async function ensurePyodide() {
  if (pyodide) {
    return pyodide;
  }

  pyodide = await loadPyodide();
  const engineCode = await fetchText("backtest_engine.py");
  pyodide.runPython(engineCode);
  return pyodide;
}

async function runSimulation() {
  try {
    dom.runButton.disabled = true;
    setStatus("Running simulation...");

    const py = await ensurePyodide();
    const limits = getSelectedLimits();

    const fileEntries = await Promise.all(
      DATA_FILES.map(async (file) => [file, await fetchText(`${DATA_BASE_PATH}/${file}`)])
    );
    const fileMap = Object.fromEntries(fileEntries);

    py.globals.set("dashboard_strategy_code", strategyCode);
    py.globals.set("dashboard_file_map_json", JSON.stringify(fileMap));
    py.globals.set("dashboard_matching_mode", dom.matchingMode.value);
    py.globals.set("dashboard_limits_json", JSON.stringify(limits));

    const payloadText = py.runPython(`run_dashboard_backtest(
      strategy_code=dashboard_strategy_code,
      file_map_json=dashboard_file_map_json,
      matching_mode=dashboard_matching_mode,
      limits_override_json=dashboard_limits_json,
    )`);

    const payload = JSON.parse(payloadText);
    applyResult(payload);
    updateSyntheticRunOptions();
    setStatus(`Simulation complete (${payload.fills.length} fills).`);
  } catch (error) {
    console.error(error);
    setStatus(error?.message || String(error), true);
  } finally {
    dom.runButton.disabled = false;
  }
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
    dom.strategyMeta.textContent = `Loaded strategy: ${file.name}`;
    setStatus(`Loaded ${file.name}`);
  };
  reader.onerror = () => setStatus(`Could not read ${file.name}`, true);
  reader.readAsText(file);
}

function bindEvents() {
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

  dom.runButton.addEventListener("click", runSimulation);

  dom.exportFillsCsv.addEventListener("click", () => {
    downloadCsv(
      "fills.csv",
      ["seq", "day", "timestamp", "product", "side", "price", "quantity", "position", "realized_pnl"],
      (lastResult.fills || []).map((fill) => [
        fill.seq,
        fill.day,
        fill.timestamp,
        fill.product,
        fill.side,
        fill.price,
        fill.quantity,
        fill.position,
        fill.realized_pnl,
      ])
    );
  });

  dom.exportEquityCsv.addEventListener("click", () => {
    downloadCsv(
      "equity.csv",
      ["day", "timestamp", "product", "mid_price", "position", "realized_pnl", "product_mtm_pnl", "portfolio_mtm_pnl"],
      (lastResult.points || []).map((point) => [
        point.day,
        point.timestamp,
        point.product,
        point.mid_price,
        point.position,
        point.realized_pnl,
        point.product_mtm_pnl,
        point.portfolio_mtm_pnl,
      ])
    );
  });

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
      renderPortfolioChart(lastResult.points || []);
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

  const tabButtons = document.querySelectorAll("[data-tab-target]");
  const tabPanels = document.querySelectorAll("[data-tab-panel]");
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.getAttribute("data-tab-target");
      tabButtons.forEach((btn) => btn.classList.toggle("active", btn === button));
      tabPanels.forEach((panel) => panel.classList.toggle("overview-hidden", panel.getAttribute("data-tab-panel") !== target));
      window.dispatchEvent(new Event("resize"));
    });
  });
}

async function main() {
  renderDataFiles();
  applyRoundOneLabels();
  bindEvents();
  updateSyntheticRunOptions();
  setStatus("Initializing Pyodide...");
  try {
    await ensurePyodide();
    await loadDefaultStrategy();
    setStatus("Ready.");
  } catch (error) {
    console.error(error);
    setStatus(error?.message || String(error), true);
  }
}

main();
