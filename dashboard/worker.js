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
      // 1. Load the engine if not already loaded
      if (engine) {
        engineCode = engine;
      }

      // 2. Prepare the python environment
      pyodide.globals.set("strategy_code", strategy);
      pyodide.globals.set("file_map_json", JSON.stringify(fileMap));
      pyodide.globals.set("matching_mode", matchingMode);
      pyodide.globals.set("limits_override_json", JSON.stringify(limitsOverride));

      const progressCallback = (completed, total) => {
        self.postMessage({ type: "progress", completed, total });
      };
      pyodide.globals.set("progress_callback", progressCallback);

      // 3. Execute the backtest
      const resultJson = await pyodide.runPythonAsync(`
import asyncio
from datamodel import *
# engine is injected into the global scope
${engineCode}

async def run():
    return await run_dashboard_backtest(
        strategy_code, 
        file_map_json, 
        matching_mode, 
        limits_override_json,
        progress_callback=progress_callback
    )

asyncio.run(run())
      `);

      self.postMessage({ type: "result", result: resultJson });
    } catch (err) {
      self.postMessage({ type: "error", error: err.message });
    }
  }
};
