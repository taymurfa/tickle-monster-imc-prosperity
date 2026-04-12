# Prosperity Dashboard

Static browser dashboard for IMC tutorial-round strategy simulation and analysis. Runs entirely client-side with Pyodide and is compatible with GitHub Pages.

## Current Architecture

Core files in this folder:

- index.html: layout and controls
- styles.css: styling and responsive layout
- app.js: UI logic, chart rendering, filtering, exports, timeline interactions
- backtest_engine.py: in-browser backtest simulator and metrics engine

## Data and Strategy Inputs

By default, the dashboard loads files from ../Mitchell:

- prices_round_0_day_-2.csv
- prices_round_0_day_-1.csv
- trades_round_0_day_-2.csv
- trades_round_0_day_-1.csv
- SampleStrategy.py (default strategy)

You can replace the strategy at runtime by dragging and dropping a .py file.

## What The Dashboard Includes

The page is a single continuous workspace with two sections:

1. Overview section

- Portfolio PnL chart
- Product charts (auto-scaled)
- Recent simulated fills table
- CSV exports for fills and equity views

2. Analysis section

- Analysis Filters:
  - Product
  - Side
  - Min Fill Qty
  - Price View (Raw, Price-Mid, Price-Fair/Ref)
  - Timeline Sort (Time, PnL Impact)
  - Book View (Auto, Standard Price, Fixed Edge View)
- Event Timeline chips for quick timestamp navigation
- Top of Book + Fills chart with synchronized selection
- Position + Product PnL chart with synchronized selection
- Timestamp Inspector with depth snapshot and at-time activity
- Strategy State viewer using traderData per timestamp
- Filtered Fills table with edge calculation
- Missed Opportunity Diagnostics table

## Matching and Limits

Trade matching modes are supported exactly as configured in the UI:

- all
- worse
- none

Current default is none.

Per-product limits are configurable in the sidebar and passed into the simulation engine.

## Fixed Product Visualization (EMERALDS)

The Top of Book chart supports adaptive visualization for fixed-like products:

- Auto mode detects fixed-like behavior and switches to Fixed Edge View
- Fixed Edge View shows values as edge vs fair value (cleaner than raw price stripes)
- Standard Price mode can be forced manually

This is intended to make fixed products like EMERALDS more interpretable while preserving a standard view for variable products.

## Backtest Payload (Engine Output)

run_dashboard_backtest returns JSON with:

- points
- fills
- market_trades
- state_logs
- metrics
- matching_mode
- limits_override

Points include depth fields used by analysis:

- best_bid, best_ask
- bid_prices, bid_volumes
- ask_prices, ask_volumes
- realized_pnl, product_mtm_pnl, portfolio_mtm_pnl

## Metrics

Metrics currently displayed:

- Final PnL
- Max Drawdown (absolute and percent)
- Sharpe Ratio
- Annualized Sharpe
- Sortino Ratio
- Calmar Ratio

## Running Locally

Run from repository root:

```powershell
Set-Location "c:\Users\mitch\OneDrive - purdue.edu\Other\IP4\Github Repos\tickle-monster-imc-prosperity-1"
python -m http.server 8000
```

Open:

- http://localhost:8000/dashboard/

## Deploying on GitHub Pages

1. Push to GitHub.
2. In repository settings, open Pages.
3. Source: Deploy from a branch.
4. Branch: main.
5. Folder: /(root).
6. Open https://<your-user>.github.io/<repo>/dashboard/

## Notes and Caveats

- Browser execution means strategy code runs client-side in your tab.
- The dashboard is based on available CSV snapshots and trade logs, not full exchange queue state.
- L2/L3 depth visibility depends on data availability in each timestamp.

## Troubleshooting

- Blank page: verify server is running and URL ends with /dashboard/.
- Strategy load issues: ensure Trader class exists and run returns (orders, conversions, traderData).
- Pyodide load issues: hard refresh and rerun simulation.
