"""
IMC Prosperity 4 - Tutorial Round Trader
Products: EMERALDS, TOMATOES
Position limits: EMERALDS=80, TOMATOES=80

Strategy:
  - EMERALDS: stable value -> tight market-making around a rolling fair value
  - TOMATOES: volatile     -> wider mean-reversion with momentum filter
"""

from datamodel import OrderDepth, TradingState, Order
from typing import List, Dict
import json
import jsonpickle


# ---------------------------------------------------------------------------
# Position limits (Tutorial Round)
# ---------------------------------------------------------------------------
POSITION_LIMITS: Dict[str, int] = {
    "EMERALDS": 80,
    "TOMATOES": 80,
}


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def best_bid(od: OrderDepth):
    """Highest bid price and its volume (positive int), or (None, None)."""
    if not od.buy_orders:
        return None, None
    price = max(od.buy_orders)
    return price, od.buy_orders[price]


def best_ask(od: OrderDepth):
    """Lowest ask price and its volume (negative int per spec), or (None, None)."""
    if not od.sell_orders:
        return None, None
    price = min(od.sell_orders)
    return price, od.sell_orders[price]


def mid_price(od: OrderDepth) -> float | None:
    bid, _ = best_bid(od)
    ask, _ = best_ask(od)
    if bid is None or ask is None:
        return None
    return (bid + ask) / 2.0


def vwap(od: OrderDepth) -> float | None:
    """Volume-weighted average price across the full visible book."""
    total_val, total_vol = 0.0, 0.0
    for price, vol in od.buy_orders.items():
        total_val += price * abs(vol)
        total_vol += abs(vol)
    for price, vol in od.sell_orders.items():
        total_val += price * abs(vol)
        total_vol += abs(vol)
    return total_val / total_vol if total_vol else None


# ---------------------------------------------------------------------------
# Persistent state (serialised via jsonpickle into traderData)
# ---------------------------------------------------------------------------

class State:
    def __init__(self):
        # rolling price history per product
        self.history: Dict[str, List[float]] = {}

    def push(self, product: str, price: float, window: int = 60) -> None:
        buf = self.history.setdefault(product, [])
        buf.append(price)
        if len(buf) > window:
            buf.pop(0)

    def sma(self, product: str) -> float | None:
        buf = self.history.get(product, [])
        return sum(buf) / len(buf) if buf else None

    def std(self, product: str) -> float:
        buf = self.history.get(product, [])
        if len(buf) < 2:
            return 0.0
        mu = sum(buf) / len(buf)
        return (sum((x - mu) ** 2 for x in buf) / len(buf)) ** 0.5


# ---------------------------------------------------------------------------
# Per-product strategy functions
# ---------------------------------------------------------------------------

def trade_emeralds(
    od: OrderDepth,
    position: int,
    fair: float,
) -> List[Order]:
    """
    EMERALDS are stable -> market-make tightly.
    - Take anything mispriced by more than 1 tick.
    - Post passive quotes 1 tick each side.
    """
    symbol = "EMERALDS"
    limit = POSITION_LIMITS[symbol]
    orders: List[Order] = []
    edge = 1          # ticks away from fair to aggress
    quote_spread = 2  # our passive quote offset from fair

    # --- aggressive fills ---
    max_buy  = limit - position
    max_sell = limit + position

    for ask_px in sorted(od.sell_orders):            # cheapest ask first
        vol = -od.sell_orders[ask_px]                # make positive
        if ask_px <= fair - edge and max_buy > 0:
            qty = min(vol, max_buy)
            orders.append(Order(symbol, ask_px, qty))
            max_buy -= qty

    for bid_px in sorted(od.buy_orders, reverse=True):  # highest bid first
        vol = od.buy_orders[bid_px]
        if bid_px >= fair + edge and max_sell > 0:
            qty = min(vol, max_sell)
            orders.append(Order(symbol, bid_px, -qty))
            max_sell -= qty

    # --- passive quotes ---
    if max_buy > 0:
        orders.append(Order(symbol, int(fair - quote_spread), max_buy))
    if max_sell > 0:
        orders.append(Order(symbol, int(fair + quote_spread), -max_sell))

    return orders


def trade_tomatoes(
    od: OrderDepth,
    position: int,
    fair: float,
    std: float,
) -> List[Order]:
    """
    TOMATOES are volatile -> mean-reversion with wider edge.
    - Aggress when price is >1 std from rolling mean.
    - Post passive quotes further out so we're not just run over.
    """
    symbol = "TOMATOES"
    limit = POSITION_LIMITS[symbol]
    orders: List[Order] = []

    # Use volatility-scaled edge, minimum 2 ticks
    edge = max(2.0, std * 0.5)
    quote_spread = max(4, int(std * 1.0))

    max_buy  = limit - position
    max_sell = limit + position

    # --- aggressive mean-reversion ---
    for ask_px in sorted(od.sell_orders):
        vol = -od.sell_orders[ask_px]
        if ask_px <= fair - edge and max_buy > 0:
            qty = min(vol, max_buy)
            orders.append(Order(symbol, ask_px, qty))
            max_buy -= qty

    for bid_px in sorted(od.buy_orders, reverse=True):
        vol = od.buy_orders[bid_px]
        if bid_px >= fair + edge and max_sell > 0:
            qty = min(vol, max_sell)
            orders.append(Order(symbol, bid_px, -qty))
            max_sell -= qty

    # --- passive quotes ---
    if max_buy > 0:
        orders.append(Order(symbol, int(fair - quote_spread), max_buy))
    if max_sell > 0:
        orders.append(Order(symbol, int(fair + quote_spread), -max_sell))

    return orders


# ---------------------------------------------------------------------------
# Main Trader class
# ---------------------------------------------------------------------------

class Trader:

    def bid(self):
        """Required for Algorithmic Round 2; ignored in all other rounds."""
        return 15

    def run(self, state: TradingState):
        """
        Called every iteration by the Prosperity engine.

        Returns:
            result      - dict[symbol -> list[Order]]
            conversions - int (0 = no conversion request)
            traderData  - str (persisted to next iteration)
        """
        # ---- restore persistent state ----
        ps: State = jsonpickle.decode(state.traderData) if state.traderData else State()

        result: Dict[str, List[Order]] = {}
        conversions = 0

        for product, od in state.order_depths.items():
            position = state.position.get(product, 0)

            # update price history
            mp = mid_price(od)
            if mp is not None:
                ps.push(product, mp)

            fair = ps.sma(product) or mp
            if fair is None:
                continue

            if product == "EMERALDS":
                result[product] = trade_emeralds(od, position, fair)

            elif product == "TOMATOES":
                std = ps.std(product)
                result[product] = trade_tomatoes(od, position, fair, std)

            # debug prints visible in the Prosperity log file
            print(
                f"t={state.timestamp} {product} pos={position} "
                f"fair={fair:.1f} orders={result.get(product, [])}"
            )

        traderData = jsonpickle.encode(ps)
        return result, conversions, traderData
