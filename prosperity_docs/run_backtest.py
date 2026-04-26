"""
Backtest runner for ROUND1/trader.py using the tutorial's fill engine.
Run from the repo root:

    python ROUND1/run_backtest.py
    python ROUND1/run_backtest.py --verbose
"""
import sys
import os

# Make tutorial infrastructure importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "TUTORIAL_ROUND_1"))

from backtest import run_backtest, print_report
from trader import Trader, LIMITS

ROUND1 = os.path.dirname(__file__)

PRICE_FILES = [
    os.path.join(ROUND1, "prices_round_1_day_-2.csv"),
    os.path.join(ROUND1, "prices_round_1_day_-1.csv"),
    os.path.join(ROUND1, "prices_round_1_day_0.csv"),
]
TRADE_FILES = [
    os.path.join(ROUND1, "trades_round_1_day_-2.csv"),
    os.path.join(ROUND1, "trades_round_1_day_-1.csv"),
    os.path.join(ROUND1, "trades_round_1_day_0.csv"),
]

if __name__ == "__main__":
    verbose = "--verbose" in sys.argv or "-v" in sys.argv
    trader  = Trader()
    history = run_backtest(trader, PRICE_FILES, TRADE_FILES, LIMITS, verbose=verbose)
    print_report(history, LIMITS)
