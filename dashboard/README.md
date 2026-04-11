# Prosperity Dashboard (GitHub Pages)

The dashboard in this folder is a static browser app that:

- loads the four tutorial CSV files from `../Mitchell`
- accepts uploaded Python strategy files (`.py`)
- runs backtests in-browser with Pyodide
- supports backtester-style trade matching modes: `all`, `worse`, `none`
- supports visible per-product position limit overrides
- visualizes order flow, equity, position, and product MTM series
- exports fills and equity views as CSV

## Is It One File?

No. It is a multi-file static app centered in this folder:

- `index.html`
- `styles.css`
- `app.js`
- `backtest_engine.py`

## Data Inputs

Loaded from `../Mitchell`:

- `prices_round_0_day_-2.csv`
- `prices_round_0_day_-1.csv`
- `trades_round_0_day_-2.csv`
- `trades_round_0_day_-1.csv`
- default strategy: `SampleStrategy.py`

## Run Locally (Exact Commands)

Because browsers block `file://` fetches, run a local static server.

```powershell
Set-Location "c:\Users\mitch\OneDrive - purdue.edu\Other\IP4\Github Repos\tickle-monster-imc-prosperity-1"
python -m http.server 8000
```

Open in Chrome:

- `http://localhost:8000/dashboard/`

## Deploy on GitHub Pages (UI Path)

1. Push repository changes to GitHub.
2. Open your repository in GitHub.
3. Go to `Settings` -> `Pages`.
4. Under `Build and deployment`:
5. Set `Source` to `Deploy from a branch`.
6. Select branch `main` (or your chosen branch).
7. Select folder `/ (root)`.
8. Click `Save`.
9. Wait for deployment status to turn green.
10. Open: `https://<your-user>.github.io/<repo>/dashboard/`

## Coherence Notes

- Matching logic follows backtester semantics:
  - `all`: match market trades at equal or better prices
  - `worse`: match only strictly worse prices (skip equal)
  - `none`: skip market-trade matching
- Limit logic is coherent with cancellation + per-fill clamping behavior.
- Metrics include final PnL, max drawdown, Sharpe, annualized Sharpe, Sortino, Calmar.

## Troubleshooting

- If the page is blank: verify server is running on port `8000` and URL includes `/dashboard/`.
- If strategy fails to run: ensure the file defines class `Trader` with method `run(self, state)` returning `(orders, conversions, traderData)`.
- If Pyodide fails to load: hard refresh (`Ctrl+F5`) and retry.
