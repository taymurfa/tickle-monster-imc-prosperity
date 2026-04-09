"""
IMC Prosperity 4 - Tutorial Round Trader  (v2)
Products : EMERALDS, TOMATOES
Limits   : 80 each

=== What we learned from run 67195 (PnL = 657.78) ===

EMERALDS (final PnL 317):
  - True fair value is exactly 10 000. Bots quote 9992 / 10008 every tick.
  - Our SMA-based fair started at 10 000 but we were only trading passively.
  - Fix: Hard-code fair = 10 000. Aggressively cross at 9992 (buy) / 10008
    (sell) because any fill at those prices earns 8 ticks of edge.

TOMATOES (final PnL 340, worst drawdown -1419):
  - Price drifted from 5006 → 4977 (a -29 tick sustained trend).
  - SMA(60) lagged 3-5 ticks → algo kept thinking price was "cheap" and
    accumulated a +80 long while price was falling = catastrophic.
  - Market spread is ~13-14 ticks (e.g. bid=4983, ask=4997).
  - Fix:
      1. Replace SMA with fast EMA(8) + slow EMA(21) dual system.
      2. Regime detection via EMA slope + ATR; block new longs in downtrend.
      3. Avellaneda-Stoikov inventory-skewed reservation price so passive
         quotes always push position toward zero.
      4. Z-score position target with /4 divisor to cap accumulation.
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

EMERALDS_FAIR = 10_000   # Hardcoded: bots always quote 9992/10008 around this


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
    """Exponential moving average of last n prices (full-list version)."""
    if not prices:
        return 0.0
    k = 2.0 / (n + 1)
    e = prices[0]
    for p in prices[1:]:
        e = p * k + e * (1 - k)
    return e


def rolling_variance(prices: List[float], window: int) -> float:
    """Population variance over last `window` prices."""
    w = prices[-window:] if len(prices) >= window else prices
    if len(w) < 2:
        return 1.0
    mu = sum(w) / len(w)
    return sum((p - mu) ** 2 for p in w) / len(w)


def rolling_std(prices: List[float], window: int) -> float:
    return math.sqrt(rolling_variance(prices, window))


def zscore(price: float, prices: List[float], window: int = 20) -> float:
    """Z-score of price vs rolling mean/std."""
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
    EMERALDS fair value = 10 000 (constant from data).
    Bots quote 9992 bid / 10008 ask every tick.
    Strategy:
      - Buy everything offered at 9992 (8-tick edge vs fair).
      - Sell everything bid at 10008 (8-tick edge vs fair).
      - Post passive quotes just inside: bid at 9993, ask at 10007.
    """
    symbol = "EMERALDS"
    limit  = POSITION_LIMITS[symbol]
    fair   = EMERALDS_FAIR
    orders: List[Order] = []

    max_buy  = limit - position   # room to go more long
    max_sell = limit + position   # room to go more short

    # --- Aggressive: hit mispriced resting orders ---
    for ask_px in sorted(od.sell_orders):
        vol = -od.sell_orders[ask_px]          # make positive
        if ask_px <= fair - 6 and max_buy > 0: # anything ≤9994 is a deal
            qty = min(vol, max_buy)
            orders.append(Order(symbol, ask_px, qty))
            max_buy -= qty

    for bid_px in sorted(od.buy_orders, reverse=True):
        vol = od.buy_orders[bid_px]
        if bid_px >= fair + 6 and max_sell > 0: # anything ≥10006 is a deal
            qty = min(vol, max_sell)
            orders.append(Order(symbol, bid_px, -qty))
            max_sell -= qty

    # --- Passive: post inside the bot spread ---
    # Skew slightly toward zero inventory to avoid being one-sided
    inv_skew = int(position / limit * 2)  # -2 to +2 ticks
    if max_buy > 0:
        orders.append(Order(symbol, fair - 3 - inv_skew, max_buy))
    if max_sell > 0:
        orders.append(Order(symbol, fair + 3 - inv_skew, -max_sell))

    return orders


# ---------------------------------------------------------------------------
# TOMATOES strategy
# ---------------------------------------------------------------------------

def regime_slope(prices: List[float], fast: int = 8, slow: int = 21, atr_win: int = 15) -> dict:
    """
    Returns dict:
      slope         : ticks/tick EMA change (signed)
      trend_strength: |slope| / ATR  (0 = flat, >0.15 = trending)
      trending      : bool
    """
    if len(prices) < slow + 2:
        return {"slope": 0.0, "trend_strength": 0.0, "trending": False}

    fast_now  = ema(prices, fast)
    fast_prev = ema(prices[:-1], fast)
    slope     = fast_now - fast_prev

    diffs = [abs(prices[-i] - prices[-i - 1]) for i in range(1, min(atr_win, len(prices)))]
    atr   = sum(diffs) / len(diffs) if diffs else 1.0
    ts    = abs(slope) / max(atr, 0.01)

    return {"slope": slope, "trend_strength": ts, "trending": ts > 0.15}


def as_quotes(
    symbol: str,
    od: OrderDepth,
    position: int,
    limit: int,
    prices: List[float],
    gamma: float = 0.005,
    kappa: float = 1.5,
) -> List[Order]:
    """
    Avellaneda-Stoikov inspired passive quotes with inventory skew.

    reservation = mid - position * gamma * sigma²
    half_spread  = gamma * sigma² + 1/kappa

    When long: reservation < mid → ask shaded down (we sell more easily),
               bid shaded down (we're not eager to buy more).
    """
    orders: List[Order] = []
    bid_px, _ = best_bid(od)
    ask_px, _ = best_ask(od)
    if bid_px is None or ask_px is None:
        return orders

    mid   = (bid_px + ask_px) / 2.0
    var   = rolling_variance(prices, 20) if len(prices) >= 5 else 1.0
    sigma2 = max(var, 0.5)

    reservation  = mid - position * gamma * sigma2
    half_spread  = max(1.0, gamma * sigma2 + 1.0 / kappa)

    our_bid = round(reservation - half_spread)
    our_ask = round(reservation + half_spread)

    max_buy  = limit - position
    max_sell = limit + position

    # Don't cross the market
    our_bid = min(our_bid, bid_px)
    our_ask = max(our_ask, ask_px)

    if max_buy > 0:
        orders.append(Order(symbol, our_bid, max_buy))
    if max_sell > 0:
        orders.append(Order(symbol, our_ask, -max_sell))

    return orders


def trade_tomatoes(od: OrderDepth, position: int, prices: List[float]) -> List[Order]:
    """
    TOMATOES: volatile, ~13-tick bot spread, prone to sustained trends.

    1. Compute dual-EMA fair value (fast=EMA8, slow=EMA21).
    2. Detect regime (trending vs ranging).
    3. Compute Z-score position target (soft cap on accumulation).
       In a downtrend: clamp target ≤ 0 (don't go long into the fall).
       In an uptrend:  clamp target ≥ 0 (don't go short into the rise).
    4. Aggress only if delta-to-target > 5 AND regime allows AND edge > threshold.
    5. Always post A-S skewed passive quotes to bleed inventory toward zero.
    """
    symbol = "TOMATOES"
    limit  = POSITION_LIMITS[symbol]
    orders: List[Order] = []

    if len(prices) < 5:
        # Not enough history: just post wide passive quotes
        return as_quotes(symbol, od, position, limit, prices)

    # --- 1. Dual-EMA fair value ---
    fast_ema = ema(prices, 8)
    slow_ema = ema(prices, 21) if len(prices) >= 21 else fast_ema
    bias     = fast_ema - slow_ema              # + = price above slow; - = downtrend
    w        = min(abs(bias) / 3.0, 1.0)       # weight: 0=ranging, 1=strong trend
    fair     = (1 - w) * slow_ema + w * fast_ema

    # --- 2. Regime ---
    reg   = regime_slope(prices)
    slope = reg["slope"]
    ts    = reg["trend_strength"]

    # --- 3. Z-score position target ---
    z       = zscore(prices[-1], prices, window=20)
    # z=-4 → target=+80, z=+4 → target=-80 (soft scale)
    frac    = max(-1.0, min(1.0, -z / 4.0))
    target  = int(frac * limit)

    # Block adding inventory in the direction of the trend
    if slope < 0 and ts > 0.15:
        target = min(target, 0)    # downtrend: don't go long
    elif slope > 0 and ts > 0.15:
        target = max(target, 0)    # uptrend: don't go short

    # --- 4. Aggressive fill to close gap to target ---
    delta = target - position

    # Adaptive edge: require larger mispricing to trade in trending markets
    base_edge = 2.0
    edge = base_edge + ts * 10.0   # e.g. ts=0.3 → edge=5 ticks

    bid_px, bid_vol = best_bid(od)
    ask_px, ask_vol = best_ask(od)

    if delta > 5 and ask_px is not None:
        if ask_px < fair - edge:
            max_buy = limit - position
            qty = min(delta, max_buy, abs(ask_vol))
            if qty > 0:
                orders.append(Order(symbol, ask_px, qty))

    elif delta < -5 and bid_px is not None:
        if bid_px > fair + edge:
            max_sell = limit + position
            qty = min(-delta, max_sell, bid_vol)
            if qty > 0:
                orders.append(Order(symbol, bid_px, -qty))

    # --- 5. Passive A-S quotes (always present, inventory-skewed) ---
    # Recalculate remaining capacity after aggressive orders
    executed_buy  = sum(o.quantity for o in orders if o.quantity > 0)
    executed_sell = sum(-o.quantity for o in orders if o.quantity < 0)
    net_pos       = position + executed_buy - executed_sell

    passive = as_quotes(symbol, od, net_pos, limit, prices, gamma=0.005, kappa=1.5)
    orders.extend(passive)

    return orders


# ---------------------------------------------------------------------------
# Main Trader class
# ---------------------------------------------------------------------------

class Trader:

    def bid(self) -> int:
        """Required stub for Algorithmic Round 2; ignored otherwise."""
        return 15

    def run(self, state: TradingState):
        """
        Called every iteration.
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
                f"mid={mp} orders={result.get(product, [])}"
            )

        traderData = jsonpickle.encode(ps)
        return result, conversions, traderData
