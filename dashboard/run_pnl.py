"""Quick CLI: run any Prosperity 4 iteration through the dashboard backtester and print PnL.

Usage:
    python dashboard/run_pnl.py R3_V28           # Auto-detects Round 3
    python dashboard/run_pnl.py R1_Strategy     # Auto-detects Round 1
"""
import asyncio
import json
import os
import sys
import re

DASHBOARD_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(DASHBOARD_DIR, ".."))
sys.path.insert(0, DASHBOARD_DIR)

from backtest_engine import run_dashboard_backtest

# Map rounds to their data directories and file patterns
ROUND_MAP = {
    "0": {"path": "prosperity_docs/Mitchell", "days": (-2, -1), "prefix": "round_0"},
    "1": {"path": "dashboard/ROUND_1/ROUND1", "days": (-2, -1, 0), "prefix": "round_1"},
    "2": {"path": "dashboard/ROUND_2/ROUND2", "days": (-1, 0, 1), "prefix": "round_2"},
    "3": {"path": "dashboard/ROUND_3/ROUND3", "days": (0, 1, 2), "prefix": "round_3"},
    "4": {"path": "dashboard/ROUND_4", "days": (1, 2, 3), "prefix": "round_4"},
}

def resolve_strategy(arg: str) -> tuple[str, str]:
    if os.path.isfile(arg):
        path = os.path.abspath(arg)
    else:
        # Search common directories
        search_dirs = [
            os.path.join(DASHBOARD_DIR, "ROUND_3", "hp_iterations"),
            os.path.join(REPO_ROOT, "round3", "vfe_iterations"),
            os.path.join(DASHBOARD_DIR, "ROUND_3", "vfe_iterations"),
            os.path.join(DASHBOARD_DIR, "ROUND_4"),
            os.path.join(REPO_ROOT, "round1"),
            os.path.join(REPO_ROOT, "round2"),
        ]
        path = None
        for d in search_dirs:
            for s in [arg, arg + ".py"]:
                candidate = os.path.join(d, s)
                if os.path.isfile(candidate):
                    path = os.path.abspath(candidate)
                    break
            if path: break
    
    if not path:
        raise FileNotFoundError(f"Strategy not found: {arg}")
    
    with open(path, "r", encoding="utf-8") as f:
        code = f.read()
    
    # Detect round from filename (e.g., R3_V28 -> Round 3)
    round_num = "3" # Default
    match = re.search(r"R(\d)", os.path.basename(path), re.I)
    if match:
        round_num = match.group(1)
    
    return code, round_num, path

def main(strategy_arg: str, matching_mode: str = "none") -> None:
    try:
        strategy_code, round_num, strategy_path = resolve_strategy(strategy_arg)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

    r_cfg = ROUND_MAP.get(round_num, ROUND_MAP["3"])
    data_dir = os.path.join(REPO_ROOT, r_cfg["path"])
    
    file_map = {}
    for day in r_cfg["days"]:
        for kind in ("prices", "trades"):
            name = f"{kind}_{r_cfg['prefix']}_day_{day}.csv"
            f_path = os.path.join(data_dir, name)
            if os.path.exists(f_path):
                with open(f_path, "r", encoding="utf-8") as f:
                    file_map[name] = f.read()

    print(f"--- Running Simulation [Round {round_num}] ---")
    print(f"Strategy: {os.path.basename(strategy_path)}")
    print(f"Matching: {matching_mode}")
    
    payload_str = asyncio.run(run_dashboard_backtest(
        strategy_code=strategy_code,
        file_map_json=json.dumps(file_map),
        matching_mode=matching_mode,
    ))
    
    payload = json.loads(payload_str)
    metrics = payload["metrics"]
    portfolio = payload["portfolio_points"]

    # Calculate PnL by stitching day-ends
    per_day = {}
    for p in portfolio:
        d = p.get("day")
        per_day.setdefault(d, []).append(p["portfolio_mtm_pnl"])
    
    per_day_final = {d: pts[-1] for d, pts in sorted(per_day.items())}
    final_pnl = sum(per_day_final.values()) if per_day_final else 0

    print(f"Final PnL:   {final_pnl:,.2f}")
    print(f"Sharpe(ann): {metrics.get('annualized_sharpe', 0):.3f}")
    print(f"Max DD:      {metrics.get('max_drawdown_abs', 0):,.2f}")
    print(f"Fills:       {len(payload['fills'])}")
    print(f"Per-day PnL: { {d: round(v,2) for d,v in per_day_final.items()} }")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python run_pnl.py <strategy_name> [matching_mode]")
        sys.exit(1)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "none")
