const DATA_FILES = [
  "prices_round_0_day_-2.csv",
  "prices_round_0_day_-1.csv",
  "trades_round_0_day_-2.csv",
  "trades_round_0_day_-1.csv",
];

const DATA_BASE_PATH = "../Mitchell";
const DEFAULT_STRATEGY_PATH = "../Mitchell/SampleStrategy.py";

const dom = {
  tabOverviewBtn: document.getElementById("tabOverviewBtn"),
  tabAnalysisBtn: document.getElementById("tabAnalysisBtn"),
  overviewTab: document.getElementById("overviewTab"),
  analysisTab: document.getElementById("analysisTab"),
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
  analysisEventStrip: document.getElementById("analysisEventStrip"),
  analysisEventSummary: document.getElementById("analysisEventSummary"),
  analysisBookChart: document.getElementById("analysisBookChart"),
  analysisPositionChart: document.getElementById("analysisPositionChart"),
  analysisSelectedTs: document.getElementById("analysisSelectedTs"),
  analysisTimestampDetail: document.getElementById("analysisTimestampDetail"),
  analysisStateDetail: document.getElementById("analysisStateDetail"),
  analysisFillsTableBody: document.querySelector("#analysisFillsTable tbody"),
  analysisMissedTableBody: document.querySelector("#analysisMissedTable tbody"),
  analysisMissedCount: document.getElementById("analysisMissedCount"),
  tradeCount: document.getElementById("tradeCount"),
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

const analysisState = {
  activeTab: "overview",
  product: "ALL",
  side: "ALL",
  minQty: 0,
  normalize: "raw",
  selectedKey: null,
  bookRows: [],
  positionRows: [],
  timelineEvents: [],
  pointLookup: new Map(),
  activeResult: null,
};

const FIXED_VALUE_PRODUCTS = {
  EMERALDS: 10000,
};

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
  const tickCount = 10;
  const x = rows.map((_, idx) => idx);
  if (rows.length === 0) {
    return { x, tickVals: [], tickText: [] };
  }

  const stride = Math.max(1, Math.floor(rows.length / tickCount));
  const tickVals = [];
  const tickText = [];
  for (let i = 0; i < rows.length; i += stride) {
    tickVals.push(i);
    tickText.push(`D${rows[i].day} T${rows[i].timestamp}`);
  }
  if (tickVals[tickVals.length - 1] !== rows.length - 1) {
    tickVals.push(rows.length - 1);
    tickText.push(`D${rows[rows.length - 1].day} T${rows[rows.length - 1].timestamp}`);
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

function setTab(tabName) {
  const showOverview = tabName === "overview";
  analysisState.activeTab = showOverview ? "overview" : "analysis";

  dom.tabOverviewBtn.classList.toggle("active", showOverview);
  dom.tabAnalysisBtn.classList.toggle("active", !showOverview);
  dom.tabOverviewBtn.setAttribute("aria-selected", String(showOverview));
  dom.tabAnalysisBtn.setAttribute("aria-selected", String(!showOverview));

  dom.overviewTab.classList.toggle("active", showOverview);
  dom.analysisTab.classList.toggle("active", !showOverview);
  dom.analysisTab.setAttribute("aria-hidden", String(showOverview));
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

  const combined = [...pnlEvents.slice(0, 5), ...missed.slice(0, 5), ...tradeEvents.slice(0, 5)]
    .sort(sortByDayThenTs);

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
  dom.analysisEventSummary.textContent = `${events.length} markers`;
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

  const traces = [
    {
      type: "scatter",
      mode: "lines",
      name: "PnL",
      x: axis.x,
      y: yValues,
      line: { color: "#111827", width: 2 },
      customdata: rows.map((r) => `D${r.day} T${r.timestamp}`),
      hovertemplate: "%{customdata}<br>PnL=%{y:.2f}<extra></extra>",
    },
  ];

  Plotly.newPlot(
    dom.portfolioChart,
    traces,
    {
      margin: { l: 60, r: 20, t: 10, b: 36 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(255,255,255,0.78)",
      xaxis: {
        title: "Time Index",
        tickvals: axis.tickVals,
        ticktext: axis.tickText,
        showgrid: true,
        gridcolor: "rgba(15,118,110,0.08)",
      },
      yaxis: {
        title: "PnL",
        range: computeRange(yValues),
        tickformat: ",.0f",
        showgrid: true,
        gridcolor: "rgba(15,118,110,0.09)",
      },
    },
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
  const productPoints = getProductPoints(result.points, product);
  analysisState.bookRows = productPoints;

  const axis = buildTimeAxis(productPoints);
  const indexByKey = new Map(productPoints.map((p, idx) => [parseKey(p), idx]));
  const selected = selectedRowFromPoints(productPoints);
  const selectedIndex = selected ? indexByKey.get(parseKey(selected)) : null;

  const productFills = getFilteredAnalysisFills(result.fills, product);
  const fillX = [];
  const normalizedFillY = [];
  const fillText = [];
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

  const marketTrades = (result.market_trades || [])
    .filter((t) => t.product === product)
    .filter((t) => {
      const key = `${t.day}|${t.timestamp}`;
      return indexByKey.has(key);
    });

  const marketX = marketTrades.map((t) => indexByKey.get(`${t.day}|${t.timestamp}`));
  const marketY = marketTrades.map((t) => {
    const point = analysisState.pointLookup.get(`${product}|${t.day}|${t.timestamp}`) || null;
    return normalizePrice(product, point, t.price);
  });

  const getLevel = (point, side, level) => {
    const prices = side === "bid" ? point.bid_prices : point.ask_prices;
    if (!prices || prices.length <= level) {
      return null;
    }
    return normalizePrice(product, point, prices[level]);
  };

  const bidL1 = productPoints.map((p) => getLevel(p, "bid", 0));
  const bidL2 = productPoints.map((p) => getLevel(p, "bid", 1));
  const bidL3 = productPoints.map((p) => getLevel(p, "bid", 2));
  const askL1 = productPoints.map((p) => getLevel(p, "ask", 0));
  const askL2 = productPoints.map((p) => getLevel(p, "ask", 1));
  const askL3 = productPoints.map((p) => getLevel(p, "ask", 2));

  const levelMeta = (point, side, level) => {
    const volumes = side === "bid" ? point.bid_volumes : point.ask_volumes;
    const qty = volumes && volumes.length > level ? volumes[level] : null;
    return `D${point.day} T${point.timestamp} q=${qty == null ? "n/a" : qty}`;
  };

  const traces = [
    {
      type: "scatter",
      mode: "lines",
      name: "Bid L1",
      x: axis.x,
      y: bidL1,
      line: { color: "#2563eb", width: 2 },
      customdata: productPoints.map((p) => levelMeta(p, "bid", 0)),
      hovertemplate: "%{customdata}<br>Bid L1=%{y:.2f}<extra></extra>",
    },
    {
      type: "scatter",
      mode: "lines",
      name: "Bid L2",
      x: axis.x,
      y: bidL2,
      line: { color: "#60a5fa", width: 1.5, dash: "dot" },
      customdata: productPoints.map((p) => levelMeta(p, "bid", 1)),
      hovertemplate: "%{customdata}<br>Bid L2=%{y:.2f}<extra></extra>",
    },
    {
      type: "scatter",
      mode: "lines",
      name: "Bid L3",
      x: axis.x,
      y: bidL3,
      line: { color: "#93c5fd", width: 1.5, dash: "dash" },
      customdata: productPoints.map((p) => levelMeta(p, "bid", 2)),
      hovertemplate: "%{customdata}<br>Bid L3=%{y:.2f}<extra></extra>",
    },
    {
      type: "scatter",
      mode: "lines",
      name: "Ask L1",
      x: axis.x,
      y: askL1,
      line: { color: "#dc2626", width: 2 },
      customdata: productPoints.map((p) => levelMeta(p, "ask", 0)),
      hovertemplate: "%{customdata}<br>Ask L1=%{y:.2f}<extra></extra>",
    },
    {
      type: "scatter",
      mode: "lines",
      name: "Ask L2",
      x: axis.x,
      y: askL2,
      line: { color: "#f87171", width: 1.5, dash: "dot" },
      customdata: productPoints.map((p) => levelMeta(p, "ask", 1)),
      hovertemplate: "%{customdata}<br>Ask L2=%{y:.2f}<extra></extra>",
    },
    {
      type: "scatter",
      mode: "lines",
      name: "Ask L3",
      x: axis.x,
      y: askL3,
      line: { color: "#fca5a5", width: 1.5, dash: "dash" },
      customdata: productPoints.map((p) => levelMeta(p, "ask", 2)),
      hovertemplate: "%{customdata}<br>Ask L3=%{y:.2f}<extra></extra>",
    },
    {
      type: "scatter",
      mode: "markers",
      name: "Own Fills",
      x: fillX,
      y: normalizedFillY,
      text: fillText,
      marker: {
        size: productFills.map((f) => Math.max(7, Math.min(16, f.quantity + 5))),
        color: productFills.map((f) => (f.side === "BUY" ? "#16a34a" : "#dc2626")),
        line: { color: "#111827", width: 0.5 },
      },
      hovertemplate: "%{text}<br>Fill=%{y:.2f}<extra></extra>",
    },
    {
      type: "scatter",
      mode: "markers",
      name: "Market Trades",
      x: marketX,
      y: marketY,
      marker: { size: 5, color: "#6b7280", opacity: 0.6 },
      hovertemplate: "Market Trade=%{y:.2f}<extra></extra>",
    },
  ];

  Plotly.newPlot(
    dom.analysisBookChart,
    traces,
    {
      margin: { l: 56, r: 20, t: 10, b: 36 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(255,255,255,0.78)",
      legend: { orientation: "h", y: 1.12 },
      xaxis: {
        title: "Time Index",
        tickvals: axis.tickVals,
        ticktext: axis.tickText,
        showgrid: true,
        gridcolor: "rgba(15,118,110,0.08)",
      },
      yaxis: {
        title: getPriceAxisTitle(product),
        range: computeRange([
          ...bidL1,
          ...bidL2,
          ...bidL3,
          ...askL1,
          ...askL2,
          ...askL3,
          ...normalizedFillY,
          ...marketY,
        ]),
        tickformat: analysisState.normalize === "raw" ? ",.0f" : ",.2f",
        showgrid: true,
        gridcolor: "rgba(15,118,110,0.09)",
      },
      shapes: buildSelectionShape(selectedIndex),
    },
    { responsive: true, displaylogo: false }
  );

  if (typeof dom.analysisBookChart.removeAllListeners === "function") {
    dom.analysisBookChart.removeAllListeners("plotly_click");
    dom.analysisBookChart.removeAllListeners("plotly_hover");
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
        type: "scatter",
        mode: "lines",
        name: "Position",
        x: axis.x,
        y: productPoints.map((p) => p.position),
        line: { color: "#7c3aed", width: 2 },
        customdata: productPoints.map((p) => `D${p.day} T${p.timestamp}`),
        hovertemplate: "%{customdata}<br>Position=%{y}<extra></extra>",
        yaxis: "y1",
      },
      {
        type: "scatter",
        mode: "lines",
        name: "Product PnL",
        x: axis.x,
        y: stitched.map((p) => p.stitchedValue),
        line: { color: "#111827", width: 2, dash: "dot" },
        customdata: stitched.map((p) => `D${p.day} T${p.timestamp}`),
        hovertemplate: "%{customdata}<br>PnL=%{y:.2f}<extra></extra>",
        yaxis: "y2",
      },
    ],
    {
      margin: { l: 56, r: 56, t: 10, b: 36 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(255,255,255,0.78)",
      legend: { orientation: "h", y: 1.12 },
      xaxis: {
        title: "Time Index",
        tickvals: axis.tickVals,
        ticktext: axis.tickText,
        showgrid: true,
        gridcolor: "rgba(15,118,110,0.08)",
      },
      yaxis: {
        title: "Position",
        range: computeRange(productPoints.map((p) => p.position)),
        showgrid: true,
        gridcolor: "rgba(15,118,110,0.09)",
      },
      yaxis2: {
        title: "PnL",
        range: computeRange(stitched.map((p) => p.stitchedValue)),
        overlaying: "y",
        side: "right",
        showgrid: false,
      },
      shapes: buildSelectionShape(selectedIndex),
    },
    { responsive: true, displaylogo: false }
  );

  if (typeof dom.analysisPositionChart.removeAllListeners === "function") {
    dom.analysisPositionChart.removeAllListeners("plotly_click");
    dom.analysisPositionChart.removeAllListeners("plotly_hover");
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

  const ownByKeySide = new Map();
  for (const fill of result.fills.filter((f) => f.product === product)) {
    const key = `${fill.day}|${fill.timestamp}|${fill.side}`;
    ownByKeySide.set(key, (ownByKeySide.get(key) || 0) + fill.quantity);
  }

  const events = [];
  for (const trade of (result.market_trades || []).filter((t) => t.product === product)) {
    const point = analysisState.pointLookup.get(`${product}|${trade.day}|${trade.timestamp}`) || null;
    if (!point) {
      continue;
    }

    const buyCross = point.best_bid != null && trade.price <= point.best_bid;
    const sellCross = point.best_ask != null && trade.price >= point.best_ask;
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

    const ownKey = `${trade.day}|${trade.timestamp}|${side}`;
    const ownQty = ownByKeySide.get(ownKey) || 0;
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
        line: { color: "#111827", width: 1.5, dash: "dot" },
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
        line: { color: "#b45309", width: 2 },
        customdata: productPoints.map((p) => `D${p.day} T${p.timestamp}`),
        hovertemplate: "%{customdata}<br>Mid Price=%{y:.2f}<extra></extra>",
        yaxis: "y1",
      });
    }

    Plotly.newPlot(
      plotTarget,
      traces,
      {
        margin: { l: 56, r: 56, t: 8, b: 36 },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(255,255,255,0.78)",
        legend: { orientation: "h", y: 1.12 },
        xaxis: {
          title: "Time Index",
          tickvals: axis.tickVals,
          ticktext: axis.tickText,
          showgrid: true,
          gridcolor: "rgba(15,118,110,0.08)",
        },
        yaxis: {
          title: isFixedValueProduct ? "Fair Value / Fill Price" : "Price",
          range: computeRange(isFixedValueProduct ? [...fillY, fairValue] : productPoints.map((p) => p.mid_price)),
          tickformat: ",.0f",
          showgrid: true,
          gridcolor: "rgba(15,118,110,0.09)",
        },
        yaxis2: {
          title: "PnL",
          range: computeRange(mtmValues),
          tickformat: ",.0f",
          overlaying: "y",
          side: "right",
          showgrid: false,
        },
      },
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
    lastResult = parsed;
    renderPortfolioChart(parsed.points);
    renderProductCharts(parsed.points, parsed.fills);
    renderMetrics(parsed.metrics);
    renderFillsTable(parsed.fills);
    renderAnalysis(parsed);

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

function wireTabs() {
  dom.tabOverviewBtn.addEventListener("click", () => setTab("overview"));
  dom.tabAnalysisBtn.addEventListener("click", () => setTab("analysis"));
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

async function main() {
  renderDataFiles();
  wireFileInputs();
  wireExportButtons();
  wireTabs();
  wireAnalysisControls();
  setTab("overview");
  dom.runButton.addEventListener("click", runSimulation);

  try {
    await Promise.all([initializePyodide(), loadDefaultStrategy()]);
  } catch (error) {
    console.error(error);
    setStatus(`Initialization error: ${error.message || error}`, true);
  }
}

main();
