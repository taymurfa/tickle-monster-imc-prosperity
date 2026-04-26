// worker.js - Background Backtest Engine
importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js");

let pyodide;
let engineCode;

async function init() {
  pyodide = await loadPyodide();
  // Load necessary packages
  // We don't need many as the engine uses standard libs
}

const initPromise = init();

self.onmessage = async (e) => {
  await initPromise;
  const { type, strategy, fileMap, matchingMode, limitsOverride, engine } = e.data;

  if (type === "run") {
    try {
      // 1. Define the engine if provided (or first run)
      if (engine) {
        // Run engine code once to define run_dashboard_backtest and datamodel
        await pyodide.runPythonAsync(engine);
      }

      // 2. Prepare the execution variables
      pyodide.globals.set("strategy_code", strategy);
      pyodide.globals.set("file_map_json", JSON.stringify(fileMap));
      pyodide.globals.set("matching_mode", matchingMode);
      pyodide.globals.set("limits_override_json", JSON.stringify(limitsOverride));

      const progressCallback = (completed, total) => {
        self.postMessage({ type: "progress", completed: Number(completed), total: Number(total) });
      };
      pyodide.globals.set("dashboard_progress_callback", progressCallback);

      // 3. Execute the backtest call
      // Note: run_dashboard_backtest is already defined in the global scope from step 1
      const resultJson = await pyodide.runPythonAsync(`
await run_dashboard_backtest(
    strategy_code, 
    file_map_json, 
    matching_mode, 
    limits_override_json,
    progress_callback=dashboard_progress_callback
)
      `);

      self.postMessage({ type: "result", result: resultJson });
    } catch (err) {
      self.postMessage({ type: "error", error: err.message });
    }
  }
};
