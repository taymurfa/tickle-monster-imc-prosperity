"""
IMC Prosperity 4 - Tutorial Round Trader (v4)
Products : EMERALDS, TOMATOES
Limits   : 80 each

=== Why SampleStrategy outperformed our v3 by ~4x ===

The core issue across all our versions was quoting too close to fair value,
which captures almost no edge per fill.

SampleStrategy's make_orders formula:
    bid = min(best_bid + 1, floor(fair - make_width))
    ask = max(best_ask - 1, ceil(fair + make_width))

This "penny the best quote but preserve at least make_width of edge" approach:

EMERALDS (fair=10000, make_width=2, bots at 9992/10008):
  bid = min(9993, 9998) = 9993  → 7 ticks of edge per fill
  ask = max(10007, 10002) = 10007 → 7 ticks of edge per fill
  Our v3: bid=9999/ask=10001 → only 1 tick of edge per fill
  Same fill probability, 7x less PnL per fill = disaster.

TOMATOES (fair~5006, make_width=2, bots at 4999/5013):
  bid = min(5000, 5004) = 5000  → penny inside bot, ~6-tick edge
  ask = max(5012, 5008) = 5012  → penny inside bot, ~6-tick edge
  Our v3 (with A-S, 1-tick spread): 5005/5007 → 1-tick edge, 6x less PnL

Additional SampleStrategy wins:
  - Position-unwind logic: if short, buy back at fair (no extra edge needed)
  - Inventory skew applied to fair BEFORE computing take AND make levels
  - Bounded quote_size (12/10 units), not blasting full 80 units every tick

v4 adopts SampleStrategy's core structure verbatim for EMERALDS.
For TOMATOES we keep our regime-detection/trend-blocking logic (which
correctly prevented the -1419 drawdown in run 67195) but use SampleStrategy's
pennying make_width formula instead of the A-S tight spread.
"""

import json
import math
from typing import Dict, List, Tuple, Optional

try:
    from datamodel import Order, OrderDepth, TradingState
except ImportError:
    from prosperity4bt.datamodel import Order, OrderDepth, TradingState


# ---------------------------------------------------------------------------
# Parameters (tuned from log analysis)
# ---------------------------------------------------------------------------

POSITION_LIMITS: Dict[str, int] = {
    "EMERALDS": 80,
    "TOMATOES": 80,
}

PARAMS: Dict[str, dict] = {
    "EMERALDS": {
        "fair":           10000.0,  # constant — confirmed from all runs
        "take_width":     1.0,      # aggress if ask < fair-1 or bid > fair+1
        "make_width":     2.0,      # passive edge floor (penny inside bot spread)
        "inventory_skew": 0.15,     # ticks of fair adj per unit of position
        "quote_size":     12,       # units per passive quote
        "window":         6,        # price history window (unused for EMERALDS)
    },
    "TOMATOES": {
        "fair":           None,     # dynamic — computed from rolling window
        "fallback_fair":  4993.0,   # used before history fills
        "take_width":     1.5,
        "make_width":     2.0,
        "inventory_skew": 0.10,
        "quote_size":     10,
        "window":         12,       # rolling window for fair value
        # Regime params (our addition to prevent trending drawdowns)
        "ema_fast":       8,
        "ema_slow":       21,
        "atr_window":     15,
        "trend_threshold":0.15,     # trend_strength above this = block new trend-side positions
        "trend_edge_mul": 10.0,     # extra ticks of edge per unit of trend_strength
    },
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def ema(prices: List[float], n: int) -> float:
    if not prices:
        return 0.0
    k = 2.0 / (n + 1)
    e = prices[0]
    for p in prices[1:]:
        e = p * k + e * (1 - k)
    return e


def load_history(trader_data: str) -> Dict[str, List[float]]:
    if not trader_data:
        return {}
    try:
        payload = json.loads(trader_data)
        raw = payload.get("mid_prices", {})
        return {
            product: [float(p) for p in prices]
            for product, prices in raw.items()
            if isinstance(prices, list)
        }
    except (json.JSONDecodeError, TypeError, ValueError):
        return {}


def save_history(history: Dict[str, List[float]]) -> str:
    return json.dumps({"mid_prices": history}, separators=(",", ":"))


def get_fair_value(product: str, mid: float, history: Dict[str, List[float]]) -> float:
    """Update price history and return fair value for the product."""
    p = PARAMS[product]
    series = history.setdefault(product, [])
    series.append(mid)
    history[product] = series[-p["window"]:]

    if product == "EMERALDS":
        return p["fair"]

    # TOMATOES: rolling average, fallback until window fills
    return sum(history[product]) / len(history[product]) if history[product] else p["fallback_fair"]


def regime_info(prices: List[float], fast: int, slow: int, atr_win: int) -> dict:
    """Detect trending regime via EMA slope / ATR."""
    if len(prices) < slow + 2:
        return {"slope": 0.0, "trend_strength": 0.0}
    fast_now  = ema(prices, fast)
    fast_prev = ema(prices[:-1], fast)
    slope     = fast_now - fast_prev
    diffs = [abs(prices[-i] - prices[-i - 1]) for i in range(1, min(atr_win, len(prices)))]
    atr   = sum(diffs) / len(diffs) if diffs else 1.0
    return {"slope": slope, "trend_strength": abs(slope) / max(atr, 0.01)}


# ---------------------------------------------------------------------------
# Order generation
# ---------------------------------------------------------------------------

def take_orders(
    product: str,
    order_depth: OrderDepth,
    fair_value: float,
    take_width: float,
    position: int,
    limit: int,
) -> Tuple[List[Order], int]:
    """
    Aggress against mispriced resting bot orders.
    Also unwinds position when price reaches fair (no edge required).
    Returns (orders, projected_position).
    """
    orders: List[Order] = []
    pos = position

    # Buy cheap asks
    for ask_px in sorted(order_depth.sell_orders):
        available = limit - pos
        if available <= 0:
            break
        qty = -order_depth.sell_orders[ask_px]
        # Take if: mispriced OR we're short and ask is at/below fair (unwind)
        if ask_px <= fair_value - take_width or (pos < 0 and ask_px <= fair_value):
            fill = min(available, qty)
            if fill > 0:
                orders.append(Order(product, ask_px, fill))
                pos += fill

    # Sell expensive bids
    for bid_px in sorted(order_depth.buy_orders, reverse=True):
        available = limit + pos
        if available <= 0:
            break
        qty = order_depth.buy_orders[bid_px]
        # Take if: mispriced OR we're long and bid is at/above fair (unwind)
        if bid_px >= fair_value + take_width or (pos > 0 and bid_px >= fair_value):
            fill = min(available, qty)
            if fill > 0:
                orders.append(Order(product, bid_px, -fill))
                pos -= fill

    return orders, pos


def make_orders(
    product: str,
    order_depth: OrderDepth,
    fair_value: float,
    position: int,
    limit: int,
    quote_size: int,
    make_width: float,
) -> List[Order]:
    """
    Post passive quotes using the SampleStrategy pennying formula:
      bid = min(best_bid + 1, floor(fair - make_width))
      ask = max(best_ask - 1, ceil(fair + make_width))

    This ensures we are always 1 tick better than the best bot quote
    while capturing at least make_width ticks of edge vs fair.

    Quote size is boosted when position needs unwinding.
    """
    if not order_depth.buy_orders or not order_depth.sell_orders:
        return []

    best_bid = max(order_depth.buy_orders)
    best_ask = min(order_depth.sell_orders)

    bid_quote = min(best_bid + 1, math.floor(fair_value - make_width))
    ask_quote = max(best_ask - 1, math.ceil(fair_value + make_width))

    # Fallback: if spread inverted, just use bot quotes
    if bid_quote >= ask_quote:
        bid_quote = best_bid
        ask_quote = best_ask

    # Boost quote size on the unwind side when we have inventory
    buy_size  = min(quote_size, limit - position)
    sell_size = min(quote_size, limit + position)

    if position < 0:
        buy_size  = min(limit - position, quote_size + min(-position, quote_size))
    elif position > 0:
        sell_size = min(limit + position, quote_size + min(position, quote_size))

    orders: List[Order] = []
    if buy_size > 0:
        orders.append(Order(product, bid_quote, buy_size))
    if sell_size > 0:
        orders.append(Order(product, ask_quote, -sell_size))

    return orders


# ---------------------------------------------------------------------------
# Main Trader class
# ---------------------------------------------------------------------------

class Trader:

    def bid(self) -> int:
        """Stub for Algorithmic Round 2; ignored in all other rounds."""
        return 15

    def run(self, state: TradingState):
        history = load_history(state.traderData)
        result: Dict[str, List[Order]] = {}

        for product, order_depth in state.order_depths.items():
            if product not in PARAMS:
                result[product] = []
                continue

            if not order_depth.buy_orders or not order_depth.sell_orders:
                result[product] = []
                continue

            p         = PARAMS[product]
            best_bid  = max(order_depth.buy_orders)
            best_ask  = min(order_depth.sell_orders)
            mid       = (best_bid + best_ask) / 2.0
            base_fair = get_fair_value(product, mid, history)
            position  = state.position.get(product, 0)
            limit     = POSITION_LIMITS[product]

            # Inventory-skewed fair value (shared by take and make)
            adj_fair = base_fair - position * p["inventory_skew"]

            # ----------------------------------------------------------------
            # TOMATOES: apply trend regime filter before generating orders
            # Blocks new positions in the trending direction to prevent the
            # large drawdowns seen in run 67195 (-1419 PnL on TOMATOES).
            # ----------------------------------------------------------------
            take_width = p["take_width"]

            if product == "TOMATOES":
                prices = history.get(product, [])
                if len(prices) >= p["ema_slow"] + 2:
                    reg = regime_info(
                        prices,
                        p["ema_fast"],
                        p["ema_slow"],
                        p["atr_window"],
                    )
                    slope = reg["slope"]
                    ts    = reg["trend_strength"]

                    if ts > p["trend_threshold"]:
                        # Widen take_width in trend direction to stop knife-catching
                        take_width += ts * p["trend_edge_mul"]

                        # Also shift adj_fair further in unwind direction
                        # (makes passive quotes push us toward flat faster)
                        if slope < 0:
                            # Downtrend: raise adj_fair so we sell more eagerly
                            adj_fair += ts * 3
                        else:
                            # Uptrend: lower adj_fair so we buy more eagerly
                            adj_fair -= ts * 3

            # ----------------------------------------------------------------
            # Generate orders: take first, then make with projected position
            # ----------------------------------------------------------------
            orders, projected_pos = take_orders(
                product=product,
                order_depth=order_depth,
                fair_value=adj_fair,
                take_width=take_width,
                position=position,
                limit=limit,
            )

            orders.extend(make_orders(
                product=product,
                order_depth=order_depth,
                fair_value=adj_fair,
                position=projected_pos,
                limit=limit,
                quote_size=p["quote_size"],
                make_width=p["make_width"],
            ))

            result[product] = orders

        return result, 0, save_history(history)
