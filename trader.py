"""
IMC Prosperity 4 - Tutorial Round Trader (v3)
Products : EMERALDS, TOMATOES
Limits   : 80 each

=== What logs 67195 and 67245 taught us ===

Run 67195 (v1 SMA): EMERALDS=317, TOMATOES=340, Total=657
Run 67245 (v2 EMA+AS): EMERALDS=446, TOMATOES=0,   Total=446  ← regression!

--- EMERALDS ---
Book structure (constant):
  bid3=9990 (~28 vol), bid2=9992 (~14 vol), bid1=9992 (~12 vol) [rarely 10000]
  ask1=10008 (~12 vol), ask2=10010 (~28 vol)                   [rarely 10000]
  True fair value = 10000 (mid never deviates by more than 4 ticks)

What v2 did wrong:
  • Passive bid=9997, ask=10003 — only fills when a rare crossing bot
    happens to walk through (~29 times in 2000 ticks = 1.45%)
  • Aggressive edge = fair-6 = 9994; bots ask at 10008 → aggress never fires
  • Efficiency = 2.4% of theoretical max

Fix:
  • Post passive quotes as tight as possible inside the spread:
    bid=9999, ask=10001 (1 tick each side of fair)
  • This maximises fill probability when any bot crosses
  • Keep inventory skew to push position toward zero
  • Also try to aggress when bot asks at 10000 (rare but free edge)

--- TOMATOES ---
Book structure:
  bid1 ~5000 (~6 vol), bid2 ~4999 (~21 vol)
  ask1 ~5013 (~6 vol), ask2 ~5015 (~21 vol)
  Spread = ~13-14 ticks. Price drifts over the session.

What v2 did wrong (critical bug):
  • A-S code caps: our_bid = min(our_bid, bot_bid_px)
    This forces our quote DOWN to the bot's level (or below)
    Result: we post at the SAME price as bots → no priority → 0 fills
  • Similarly: our_ask = max(our_ask, bot_ask_px) forces us to bot ask level

Fix:
  • Post INSIDE the spread: bid between bot_bid+1 and bot_ask-1
  • Cap should be: bid < bot_ask (don't cross), ask > bot_bid (don't cross)
  • Keep all regime / Z-score / trend-block logic from v2 (it was correct)
  • Inventory skew pushes us toward zero passively
"""

from datamodel import OrderDepth, TradingState, Order
from typing import List, Dict, Optional, Tuple
import math
import jsonpickle


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

POSITION_LIMITS: Dict[str, int] = {
    "EMERALDS": 80,
    "TOMATOES": 80,
}

EMERALDS_FAIR = 10_000  # Stable, confirmed from data


# ---------------------------------------------------------------------------
# Book helpers
# ---------------------------------------------------------------------------

def best_bid(od: OrderDepth) -> Tuple[Optional[int], Optional[int]]:
    if not od.buy_orders:
        return None, None
    px = max(od.buy_orders)
    return px, od.buy_orders[px]


def best_ask(od: OrderDepth) -> Tuple[Optional[int], Optional[int]]:
    if not od.sell_orders:
        return None, None
    px = min(od.sell_orders)
    return px, od.sell_orders[px]


def mid_price(od: OrderDepth) -> Optional[float]:
    b, _ = best_bid(od)
    a, _ = best_ask(od)
    return (b + a) / 2.0 if b is not None and a is not None else None


# ---------------------------------------------------------------------------
# Math utilities
# ---------------------------------------------------------------------------

def ema(prices: List[float], n: int) -> float:
    if not prices:
        return 0.0
    k = 2.0 / (n + 1)
    e = prices[0]
    for p in prices[1:]:
        e = p * k + e * (1 - k)
    return e


def rolling_variance(prices: List[float], window: int) -> float:
    w = prices[-window:] if len(prices) >= window else prices
    if len(w) < 2:
        return 1.0
    mu = sum(w) / len(w)
    return sum((p - mu) ** 2 for p in w) / len(w)


def zscore(price: float, prices: List[float], window: int = 20) -> float:
    w = prices[-window:] if len(prices) >= window else prices
    if len(w) < 2:
        return 0.0
    mu = sum(w) / len(w)
    sd = math.sqrt(sum((p - mu) ** 2 for p in w) / len(w))
    if sd < 0.01:
        return 0.0
    return (price - mu) / sd


# ---------------------------------------------------------------------------
# Persistent state
# ---------------------------------------------------------------------------

class State:
    def __init__(self) -> None:
        self.history: Dict[str, List[float]] = {}

    def push(self, product: str, price: float, window: int = 100) -> None:
        buf = self.history.setdefault(product, [])
        buf.append(price)
        if len(buf) > window:
            buf.pop(0)

    def prices(self, product: str) -> List[float]:
        return self.history.get(product, [])


# ---------------------------------------------------------------------------
# EMERALDS strategy
# ---------------------------------------------------------------------------

def trade_emeralds(od: OrderDepth, position: int) -> List[Order]:
    """
    Fair value = 10,000 (constant).
    Bot spread: 9992 bid / 10008 ask (~16 ticks wide).
    Occasionally bot bid or ask touches 10000.

    Strategy:
    - Post passive quotes inside the spread, as tight as possible:
        bid = fair - 1 = 9999 (skewed down when long)
        ask = fair + 1 = 10001 (skewed up when short)
      Any bot that crosses the spread for any reason fills us at 1-tick edge.
    - If bot ever offers at 10000 (ask1=10000): buy aggresively, 8-tick edge.
    - If bot ever bids at 10000 (bid1=10000): sell aggressively, 8-tick edge.
    - Inventory skew: shift both quotes by (position/limit * 2) ticks to
      push position toward zero.
    """
    symbol = "EMERALDS"
    limit  = POSITION_LIMITS[symbol]
    fair   = EMERALDS_FAIR
    orders: List[Order] = []

    bid_px, bid_vol = best_bid(od)
    ask_px, ask_vol = best_ask(od)
    if bid_px is None or ask_px is None:
        return orders

    max_buy  = limit - position
    max_sell = limit + position

    # --- Aggressive: rare opportunity when bot touches fair value ---
    if ask_px <= fair and max_buy > 0:
        # Bot selling at or below fair — free edge
        vol = -od.sell_orders[ask_px]
        qty = min(vol, max_buy)
        orders.append(Order(symbol, ask_px, qty))
        max_buy -= qty

    if bid_px >= fair and max_sell > 0:
        # Bot buying at or above fair — free edge
        vol = bid_vol
        qty = min(vol, max_sell)
        orders.append(Order(symbol, bid_px, -qty))
        max_sell -= qty

    # --- Passive: quote 1 tick each side of fair, skewed by inventory ---
    # Skew: when long, lower both quotes to attract sellers / discourage buys
    inv_skew = round(position / limit * 3)  # -3 to +3 ticks

    our_bid = fair - 1 - inv_skew
    our_ask = fair + 1 - inv_skew

    # Safety: never cross the market (bid < ask)
    if our_bid >= ask_px:
        our_bid = ask_px - 1
    if our_ask <= bid_px:
        our_ask = bid_px + 1
    # Never quote outside the bot spread (no point)
    our_bid = max(our_bid, bid_px + 1)   # must beat bot bid to get priority
    our_ask = min(our_ask, ask_px - 1)   # must beat bot ask to get priority

    if our_bid < our_ask:  # valid spread
        if max_buy > 0:
            orders.append(Order(symbol, our_bid, max_buy))
        if max_sell > 0:
            orders.append(Order(symbol, our_ask, -max_sell))

    return orders


# ---------------------------------------------------------------------------
# TOMATOES strategy
# ---------------------------------------------------------------------------

def regime_slope(prices: List[float], fast: int = 8, slow: int = 21,
                 atr_win: int = 15) -> dict:
    if len(prices) < slow + 2:
        return {"slope": 0.0, "trend_strength": 0.0, "trending": False}
    fast_now  = ema(prices, fast)
    fast_prev = ema(prices[:-1], fast)
    slope     = fast_now - fast_prev
    diffs = [abs(prices[-i] - prices[-i - 1]) for i in range(1, min(atr_win, len(prices)))]
    atr   = sum(diffs) / len(diffs) if diffs else 1.0
    ts    = abs(slope) / max(atr, 0.01)
    return {"slope": slope, "trend_strength": ts, "trending": ts > 0.15}


def trade_tomatoes(od: OrderDepth, position: int, prices: List[float]) -> List[Order]:
    """
    TOMATOES: ~13-14 tick bot spread, volatile, prone to sustained trends.

    Core fix from v2 bug:
    - Post quotes INSIDE the spread (between bot_bid+1 and bot_ask-1).
    - Cap logic changed: bid must be < bot_ask (not <= bot_bid).
      This allows us to rest at e.g. 5006 inside the 4999/5013 spread.

    Strategy layers:
    1. Dual-EMA(8/21) fair value.
    2. Regime detection: block new longs in downtrend, shorts in uptrend.
    3. Z-score target position (caps accumulation).
    4. Aggressive fills toward target when edge is sufficient.
    5. Passive quotes inside spread, inventory-skewed.
    """
    symbol = "TOMATOES"
    limit  = POSITION_LIMITS[symbol]
    orders: List[Order] = []

    bid_px, bid_vol = best_bid(od)
    ask_px, ask_vol = best_ask(od)
    if bid_px is None or ask_px is None:
        return orders

    # --- 1. Dual-EMA fair value ---
    if len(prices) >= 5:
        fast_ema_val = ema(prices, 8)
        slow_ema_val = ema(prices, 21) if len(prices) >= 21 else fast_ema_val
        bias = fast_ema_val - slow_ema_val
        w    = min(abs(bias) / 3.0, 1.0)
        fair = (1 - w) * slow_ema_val + w * fast_ema_val
    else:
        fair = (bid_px + ask_px) / 2.0

    # --- 2. Regime ---
    reg   = regime_slope(prices) if len(prices) >= 10 else {"slope": 0.0, "trend_strength": 0.0, "trending": False}
    slope = reg["slope"]
    ts    = reg["trend_strength"]

    # --- 3. Z-score position target ---
    if len(prices) >= 5:
        z      = zscore(prices[-1], prices, window=20)
        frac   = max(-1.0, min(1.0, -z / 4.0))
        target = int(frac * limit)
    else:
        target = 0

    # Block accumulation in trending direction
    if slope < 0 and ts > 0.15:
        target = min(target, 0)   # downtrend: flat or short only
    elif slope > 0 and ts > 0.15:
        target = max(target, 0)   # uptrend: flat or long only

    max_buy  = limit - position
    max_sell = limit + position
    delta    = target - position

    # Adaptive edge: wider in trending markets to stop knife-catching
    base_edge = 2.0
    edge = base_edge + ts * 10.0

    # --- 4. Aggressive fills ---
    if delta > 5 and ask_px < fair - edge and max_buy > 0:
        qty = min(delta, max_buy, abs(ask_vol))
        if qty > 0:
            orders.append(Order(symbol, ask_px, qty))
            max_buy -= qty
            position += qty

    elif delta < -5 and bid_px > fair + edge and max_sell > 0:
        qty = min(-delta, max_sell, bid_vol)
        if qty > 0:
            orders.append(Order(symbol, bid_px, -qty))
            max_sell -= qty
            position -= qty

    # --- 5. Passive quotes inside the spread, inventory-skewed ---
    # Inventory skew: shift reservation price to push toward zero
    # At position=+80: skew = -8 ticks → ask becomes aggressive, bid retreats
    sigma2   = max(rolling_variance(prices, 20), 0.5) if len(prices) >= 5 else 1.0
    inv_skew = round(position / limit * 6)  # -6 to +6 ticks

    our_bid = round(fair - 1 - inv_skew)
    our_ask = round(fair + 1 - inv_skew)

    # CRITICAL FIX: cap to stay INSIDE the spread without crossing it
    # Bid must be strictly less than bot ask (don't cross)
    # Ask must be strictly greater than bot bid (don't cross)
    # But we WANT to be inside the spread, so bid > bot_bid and ask < bot_ask
    our_bid = min(our_bid, ask_px - 1)   # don't cross the ask
    our_ask = max(our_ask, bid_px + 1)   # don't cross the bid

    # Clamp to a valid spread
    if our_bid >= our_ask:
        mid = (bid_px + ask_px) // 2
        our_bid = mid - 1
        our_ask = mid + 1

    if max_buy > 0:
        orders.append(Order(symbol, our_bid, max_buy))
    if max_sell > 0:
        orders.append(Order(symbol, our_ask, -max_sell))

    return orders


# ---------------------------------------------------------------------------
# Main Trader class
# ---------------------------------------------------------------------------

class Trader:

    def bid(self) -> int:
        """Stub for Algorithmic Round 2; ignored in all other rounds."""
        return 15

    def run(self, state: TradingState):
        """
        Called every iteration by the Prosperity engine.
        Returns (orders, conversions, traderData).
        """
        ps: State = jsonpickle.decode(state.traderData) if state.traderData else State()

        result: Dict[str, List[Order]] = {}
        conversions = 0

        for product, od in state.order_depths.items():
            position = state.position.get(product, 0)
            mp = mid_price(od)

            if mp is not None:
                ps.push(product, mp)

            prices = ps.prices(product)

            if product == "EMERALDS":
                result[product] = trade_emeralds(od, position)
            elif product == "TOMATOES":
                result[product] = trade_tomatoes(od, position, prices)

            print(
                f"t={state.timestamp} {product} pos={position} "
                f"mid={mp} n_orders={len(result.get(product, []))}"
            )

        traderData = jsonpickle.encode(ps)
        return result, conversions, traderData
