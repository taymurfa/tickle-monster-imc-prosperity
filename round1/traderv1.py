"""
IMC Prosperity — Round 1 Submission
=====================================

Products
--------
INTARIAN_PEPPER_ROOT — strongly trending (+1,000/day, slope 0.001/tick).
    Strategy: momentum.  Max out long at start of each day, sell at end.

ASH_COATED_OSMIUM — mean-reverting, anchored near 10,000.
    Strategy: market-make around fair value 10,000, same as EMERALDS in tutorial.

!! BEFORE SUBMITTING !!
  1. Confirm POSITION_LIMIT values against the official Round 1 problem statement.
  2. Confirm exact product name strings (case-sensitive on the platform).
  3. Confirm BUY_WINDOW / SELL_WINDOW — assumes 1,000,000 ticks/day based on
     training data.  If the live round uses a different day length, adjust.
  4. ASH_COATED_OSMIUM fair value assumed = 10,000.  Glance at early ticks on
     live day 1 to confirm before trusting this.
"""

from datamodel import Order, TradingState
from typing import Dict, List
import json

# ── Position limits ───────────────────────────────────────────────────────────
# !! VERIFY THESE against the official problem statement before submitting !!
LIMITS: Dict[str, int] = {
    "INTARIAN_PEPPER_ROOT": 80,
    "ASH_COATED_OSMIUM":    80,
}

# ── INTARIAN_PEPPER_ROOT config ───────────────────────────────────────────────
# Trend: fair_value = 9999.99 + 0.001 * global_timestamp  (R² = 0.999994)
# Rise: ~1,000 per day.  Buy aggressively at day open, sell at day close.
PEPPER_BUY_WINDOW  = 100_000   # first 10% of day  (ticks 0 – 99,999)
PEPPER_SELL_WINDOW = 100_000   # last  10% of day  (ticks 900,000 – 999,899)
DAY_LENGTH         = 1_000_000 # ticks per day in training data

# ── ASH_COATED_OSMIUM config ──────────────────────────────────────────────────
# Mean-reverting around 10,000.  Market-make ±7 ticks with inventory skew.
OSMIUM_FAIR         = 10_000
OSMIUM_EDGE         = 7
OSMIUM_SKEW_DIVISOR = 6


class Trader:

    def run(self, state: TradingState) -> tuple:
        # Deserialize persistent state (survives across timestamps AND days)
        data: dict = json.loads(state.traderData) if state.traderData else {}

        # ── Day counter ───────────────────────────────────────────────────────
        # state.timestamp resets to 0 at the start of each new day.
        # We detect the rollover and increment day_num.
        prev_ts  = data.get("prev_ts", -1)
        day_num  = data.get("day_num",  0)

        if state.timestamp < prev_ts:
            day_num += 1

        result: Dict[str, List[Order]] = {}

        if "INTARIAN_PEPPER_ROOT" in state.order_depths:
            result["INTARIAN_PEPPER_ROOT"] = self._trade_pepper(state)

        if "ASH_COATED_OSMIUM" in state.order_depths:
            result["ASH_COATED_OSMIUM"] = self._trade_osmium(state)

        data["prev_ts"] = state.timestamp
        data["day_num"] = day_num

        return result, 0, json.dumps(data)

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

    # ── ASH_COATED_OSMIUM ─────────────────────────────────────────────────────

    def _trade_osmium(self, state: TradingState) -> List[Order]:
        orders: List[Order] = []
        od    = state.order_depths["ASH_COATED_OSMIUM"]
        pos   = state.position.get("ASH_COATED_OSMIUM", 0)
        limit = LIMITS["ASH_COATED_OSMIUM"]
        fair  = OSMIUM_FAIR

        # 1. Lift any ask strictly below fair value (free edge)
        buy_cap = limit - pos
        for ask_px in sorted(od.sell_orders.keys()):
            if ask_px >= fair or buy_cap <= 0:
                break
            qty = min(-od.sell_orders[ask_px], buy_cap)
            orders.append(Order("ASH_COATED_OSMIUM", ask_px, qty))
            buy_cap -= qty
            pos     += qty

        # 2. Hit any bid strictly above fair value (free edge)
        sell_cap = limit + pos
        for bid_px in sorted(od.buy_orders.keys(), reverse=True):
            if bid_px <= fair or sell_cap <= 0:
                break
            qty = min(od.buy_orders[bid_px], sell_cap)
            orders.append(Order("ASH_COATED_OSMIUM", bid_px, -qty))
            sell_cap -= qty
            pos      -= qty

        # 3. Passive market-make 1 tick inside resident bots with inventory skew
        skew      = -(pos // OSMIUM_SKEW_DIVISOR)
        bid_price = fair - OSMIUM_EDGE + skew
        ask_price = fair + OSMIUM_EDGE + skew

        buy_cap  = limit - pos
        sell_cap = limit + pos

        if buy_cap > 0:
            orders.append(Order("ASH_COATED_OSMIUM", bid_price,  buy_cap))
        if sell_cap > 0:
            orders.append(Order("ASH_COATED_OSMIUM", ask_price, -sell_cap))

        return orders
