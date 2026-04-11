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
  metrics: {},
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
    lastResult = parsed;
    renderPortfolioChart(parsed.points);
    renderProductCharts(parsed.points, parsed.fills);
    renderMetrics(parsed.metrics);
    renderFillsTable(parsed.fills);

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
  dom.runButton.addEventListener("click", runSimulation);

  try {
    await Promise.all([initializePyodide(), loadDefaultStrategy()]);
  } catch (error) {
    console.error(error);
    setStatus(`Initialization error: ${error.message || error}`, true);
  }
}

main();
