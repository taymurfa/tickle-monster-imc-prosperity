"""Quick CLI: run a Round 3 iteration through the dashboard backtester and print PnL.

Usage:
    python dashboard/run_pnl.py R3_V25           # looks in dashboard/ROUND_3/hp_iterations/
    python dashboard/run_pnl.py VFE_V11          # looks in VFE iteration folders
    python dashboard/run_pnl.py path/to/file.py   # explicit path
"""
import asyncio
import json
import os
import sys

DASHBOARD_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(DASHBOARD_DIR, ".."))
sys.path.insert(0, DASHBOARD_DIR)
DATA_DIR = os.path.join(DASHBOARD_DIR, "ROUND_3", "ROUND3")

from backtest_engine import run_dashboard_backtest


SEARCH_DIRS = [
    os.path.join(DASHBOARD_DIR, "ROUND_3", "hp_iterations"),
    os.path.join(REPO_ROOT, "round3", "vfe_iterations"),
    os.path.join(DASHBOARD_DIR, "ROUND_3", "vfe_iterations"),
]


def resolve_strategy_path(arg: str) -> str:
    if os.path.isfile(arg):
        return os.path.abspath(arg)
    suffixes = [arg, arg + ".py"] if not arg.endswith(".py") else [arg]
    for d in SEARCH_DIRS:
        for s in suffixes:
            candidate = os.path.join(d, s)
            if os.path.isfile(candidate):
                return os.path.abspath(candidate)
    raise FileNotFoundError(f"Strategy file not found: {arg}")


def main(strategy_arg: str, matching_mode: str = "none") -> None:
    strategy_path = resolve_strategy_path(strategy_arg)
    with open(strategy_path, "r", encoding="utf-8") as f:
        strategy_code = f.read()

    file_map = {}
    for day in (0, 1, 2):
        for kind in ("prices", "trades"):
            name = f"{kind}_round_3_day_{day}.csv"
            with open(os.path.join(DATA_DIR, name), "r", encoding="utf-8") as f:
                file_map[name] = f.read()

    payload_str = asyncio.run(run_dashboard_backtest(
        strategy_code=strategy_code,
        file_map_json=json.dumps(file_map),
        matching_mode=matching_mode,
    ))
    payload = json.loads(payload_str)
    metrics = payload["metrics"]
    fills = payload["fills"]
    portfolio = payload["portfolio_points"]

    # Per-day PnL: portfolio_points has a "day" field
    per_day = {}
    for p in portfolio:
        d = p.get("day")
        per_day.setdefault(d, []).append(p["portfolio_mtm_pnl"])
    per_day_final = {d: pts[-1] for d, pts in sorted(per_day.items())}
    final_pnl = sum(per_day_final.values()) if per_day_final else None

    def fmt(x):
        return f"{x:.2f}" if isinstance(x, (int, float)) else str(x)

    print(f"Strategy: {os.path.basename(strategy_path)}")
    print(f"Matching: {matching_mode}")
    print(f"Final PnL:   {fmt(final_pnl)}")
    print(f"Sharpe(ann): {fmt(metrics.get('annualized_sharpe'))}")
    print(f"Max DD:      {fmt(metrics.get('max_drawdown_abs'))}")
    print(f"Sortino:     {fmt(metrics.get('sortino'))}")
    print(f"Calmar:      {fmt(metrics.get('calmar'))}")
    print(f"Fills:       {len(fills)}")
    print(f"Per-day PnL: { {d: round(v,2) for d,v in per_day_final.items()} }")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python run_pnl.py <strategy.py> [matching_mode]")
        sys.exit(1)
    arg = sys.argv[1]
    mm = sys.argv[2] if len(sys.argv) > 2 else "none"
    main(arg, mm)
