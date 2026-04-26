"""
IMC Prosperity — Round 1 Submission (INTARIAN_PEPPER_ROOT only)
================================================================

INTARIAN_PEPPER_ROOT — strongly trending (+1,000/day, slope 0.001/tick).
    Strategy: momentum.  Max out long at start of each day, sell at end.

!! BEFORE SUBMITTING !!
  1. Confirm POSITION_LIMIT value against the official Round 1 problem statement.
  2. Confirm exact product name string (case-sensitive on the platform).
  3. Confirm BUY_WINDOW / SELL_WINDOW — assumes 1,000,000 ticks/day based on
     training data.  If the live round uses a different day length, adjust.
"""

from datamodel import Order, TradingState
from typing import Dict, List
import json

# ── Position limits ───────────────────────────────────────────────────────────
# !! VERIFY THESE against the official problem statement before submitting !!
LIMITS: Dict[str, int] = {
    "INTARIAN_PEPPER_ROOT": 80,
}

# ── INTARIAN_PEPPER_ROOT config ───────────────────────────────────────────────
# Trend: fair_value = 9999.99 + 0.001 * global_timestamp  (R² = 0.999994)
# Rise: ~1,000 per day.  Buy aggressively at day open, sell at day close.
PEPPER_BUY_WINDOW  = 100_000   # first 10% of day  (ticks 0 – 99,999)
PEPPER_SELL_WINDOW = 100_000   # last  10% of day  (ticks 900,000 – 999,899)
DAY_LENGTH         = 1_000_000 # ticks per day in training data


class Trader:

    def run(self, state: TradingState) -> tuple:
        result: Dict[str, List[Order]] = {}

        if "INTARIAN_PEPPER_ROOT" in state.order_depths:
            result["INTARIAN_PEPPER_ROOT"] = self._trade_pepper(state)

        return result, 0, ""

    # ── INTARIAN_PEPPER_ROOT ──────────────────────────────────────────────────

    def _trade_pepper(self, state: TradingState) -> List[Order]:
        orders: List[Order] = []
        od    = state.order_depths["INTARIAN_PEPPER_ROOT"]
        pos   = state.position.get("INTARIAN_PEPPER_ROOT", 0)
        limit = LIMITS["INTARIAN_PEPPER_ROOT"]
        ts    = state.timestamp

        in_buy_window  = ts < PEPPER_BUY_WINDOW
        in_sell_window = ts >= DAY_LENGTH - PEPPER_SELL_WINDOW

        if in_buy_window and pos < limit:
            # Aggressively lift all asks up to position limit
            buy_cap = limit - pos
            for ask_px in sorted(od.sell_orders.keys()):
                if buy_cap <= 0:
                    break
                qty = min(-od.sell_orders[ask_px], buy_cap)
                orders.append(Order("INTARIAN_PEPPER_ROOT", ask_px, qty))
                buy_cap -= qty

        elif in_sell_window and pos > 0:
            # Aggressively hit all bids to flatten position
            sell_cap = pos
            for bid_px in sorted(od.buy_orders.keys(), reverse=True):
                if sell_cap <= 0:
                    break
                qty = min(od.buy_orders[bid_px], sell_cap)
                orders.append(Order("INTARIAN_PEPPER_ROOT", bid_px, -qty))
                sell_cap -= qty

        # Middle of day: hold, do nothing

        return orders
