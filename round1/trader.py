"""
IMC Prosperity 4 — Round 1 Trader (baseline v1)
Products : INTARIAN_PEPPER_ROOT  (stable, market-making)
           ASH_COATED_OSMIUM     (volatile, mean-reversion)
Limits   : 80 each

Strategy overview
─────────────────
INTARIAN_PEPPER_ROOT  — Classic market-making on a low-vol stable product.
  • Fair value estimated via a short EMA of midprice (falls back to current
    midprice when history is short).
  • Aggressively takes liquidity when best ask < fair or best bid > fair.
  • Posts passive quotes one tick inside the spread with a minimum edge floor.
  • Inventory-aware skew: if long, ask more aggressively and bid less
    aggressively (and vice versa when short).
  • Soft inventory cap reduces quote sizes as position grows, preventing
    the algo from sitting at ±80.

ASH_COATED_OSMIUM  — Signal-driven mean-reversion baseline.
  • Maintains a rolling midprice window.
  • Computes EMA fair value, rolling standard deviation, and z-score.
  • Buys when z < -entry_threshold, sells when z > +entry_threshold.
  • Reduces/exits positions when z returns toward zero (exit_threshold).
  • Optionally posts passive quotes when the spread is wide and a mild
    signal is present.
  • Inventory penalty discourages accumulating near the position limit.
"""

import json
import math
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Datamodel import — compatible with both Prosperity submission and local
# backtester (prosperity4bt).
# ---------------------------------------------------------------------------
try:
    from datamodel import Order, OrderDepth, TradingState
except ImportError:
    from prosperity4bt.datamodel import Order, OrderDepth, TradingState


# ═══════════════════════════════════════════════════════════════════════════
#  CONFIGURATION — all tuneable knobs live here
# ═══════════════════════════════════════════════════════════════════════════

POSITION_LIMITS: Dict[str, int] = {
    "INTARIAN_PEPPER_ROOT": 80,
    "ASH_COATED_OSMIUM":    80,
}

# --- INTARIAN_PEPPER_ROOT (stable market-making) ---------------------------
IPR_EMA_ALPHA        = 0.3      # EMA smoothing for fair value (higher = more reactive)
IPR_TAKE_WIDTH       = 1.0      # aggress if ask < fair - width  or  bid > fair + width
IPR_MAKE_WIDTH       = 2.0      # minimum edge preserved on passive quotes
IPR_INVENTORY_SKEW   = 0.15     # fair value shifts 0.15 ticks per unit of position
IPR_QUOTE_SIZE       = 12       # base passive quote size
IPR_SOFT_CAP         = 50       # start scaling down aggressiveness above this
IPR_HISTORY_LEN      = 30       # max midprice history retained

# --- ASH_COATED_OSMIUM (volatile mean-reversion) --------------------------
ACO_EMA_ALPHA        = 0.15     # EMA smoothing for fair value
ACO_ZSCORE_LOOKBACK  = 20       # rolling window for std / z-score
ACO_ENTRY_THRESHOLD  = 1.5      # |z| above this → enter a position
ACO_EXIT_THRESHOLD   = 0.5      # |z| below this → close / reduce position
ACO_PASSIVE_Z_MIN    = 0.5      # passive quotes when |z| between this and entry
ACO_PASSIVE_Z_MAX    = 1.5      # (same as entry threshold by default)
ACO_MIN_SPREAD       = 3.0      # only post passive quotes if spread ≥ this
ACO_PASSIVE_OFFSET   = 1        # ticks inside best bid/ask for passive quotes
ACO_MAKE_WIDTH       = 2.0      # minimum edge preserved on passive quotes
ACO_INVENTORY_SKEW   = 0.20     # fair value shift per unit of position
ACO_INVENTORY_PENALTY = 0.02    # z-score penalty per unit position (discourages extremes)
ACO_QUOTE_SIZE       = 10       # base passive quote size
ACO_SOFT_CAP         = 50       # start scaling down above this
ACO_HISTORY_LEN      = 60       # max midprice history retained
ACO_AGGRESS_SIZE     = 15       # max units per aggressive take


# ═══════════════════════════════════════════════════════════════════════════
#  HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

def get_best_bid_ask(order_depth: OrderDepth) -> Optional[Tuple[int, int]]:
    """Return (best_bid, best_ask) or None if book is empty on either side."""
    if not order_depth.buy_orders or not order_depth.sell_orders:
        return None
    return max(order_depth.buy_orders), min(order_depth.sell_orders)


def compute_midprice(order_depth: OrderDepth) -> Optional[float]:
    """Return midprice from the order book, or None if one side is missing."""
    bba = get_best_bid_ask(order_depth)
    if bba is None:
        return None
    return (bba[0] + bba[1]) / 2.0


def update_price_history(
    state_dict: dict, product: str, mid: float, max_len: int
) -> List[float]:
    """Append midprice to rolling history, trim to max_len, and return it."""
    series = state_dict.setdefault(product, [])
    series.append(mid)
    if len(series) > max_len:
        state_dict[product] = series[-max_len:]
    return state_dict[product]


def compute_ema(values: List[float], alpha: float) -> float:
    """Exponential moving average with a fixed alpha (not span-based)."""
    if not values:
        return 0.0
    ema_val = values[0]
    for v in values[1:]:
        ema_val = alpha * v + (1 - alpha) * ema_val
    return ema_val


def compute_std(values: List[float], lookback: int) -> float:
    """Rolling standard deviation over the last `lookback` values."""
    window = values[-lookback:] if len(values) >= lookback else values
    if len(window) < 2:
        return 0.0
    mean = sum(window) / len(window)
    var = sum((v - mean) ** 2 for v in window) / len(window)
    return math.sqrt(var)


def compute_zscore(values: List[float], lookback: int, fair: float) -> float:
    """Z-score = (current midprice - EMA fair) / rolling std."""
    std = compute_std(values, lookback)
    if std < 1e-9:
        return 0.0
    return (values[-1] - fair) / std


def soft_scale(position: int, soft_cap: int, limit: int) -> float:
    """
    Returns a scaling factor [0, 1] for quote aggressiveness.
    Below soft_cap: 1.0 (full aggression).
    Above soft_cap: linearly ramps to 0 at the position limit.
    """
    abs_pos = abs(position)
    if abs_pos <= soft_cap:
        return 1.0
    if abs_pos >= limit:
        return 0.0
    return (limit - abs_pos) / (limit - soft_cap)


def clamp_order_qty(qty: int, position: int, limit: int) -> int:
    """Clamp order quantity so that resulting position stays within limits.
    qty > 0 = buy, qty < 0 = sell."""
    if qty > 0:
        return min(qty, limit - position)
    else:
        return max(qty, -(limit + position))


# ═══════════════════════════════════════════════════════════════════════════
#  INTARIAN_PEPPER_ROOT — stable-product market-making
# ═══════════════════════════════════════════════════════════════════════════

def market_take_stable_product(
    product: str,
    order_depth: OrderDepth,
    fair: float,
    take_width: float,
    position: int,
    limit: int,
) -> Tuple[List[Order], int]:
    """
    Aggressively take liquidity:
      • Buy if ask < fair - take_width (mispriced)
      • Sell if bid > fair + take_width (mispriced)
      • Also unwind: buy back at fair when short, sell at fair when long.
    Returns (orders, projected_position).
    """
    orders: List[Order] = []
    pos = position

    # Buy cheap asks
    for ask_px in sorted(order_depth.sell_orders):
        room = limit - pos
        if room <= 0:
            break
        vol = -order_depth.sell_orders[ask_px]  # sell_orders have negative qty
        if ask_px <= fair - take_width or (pos < 0 and ask_px <= fair):
            fill = min(room, vol)
            if fill > 0:
                orders.append(Order(product, ask_px, fill))
                pos += fill

    # Sell expensive bids
    for bid_px in sorted(order_depth.buy_orders, reverse=True):
        room = limit + pos
        if room <= 0:
            break
        vol = order_depth.buy_orders[bid_px]
        if bid_px >= fair + take_width or (pos > 0 and bid_px >= fair):
            fill = min(room, vol)
            if fill > 0:
                orders.append(Order(product, bid_px, -fill))
                pos -= fill

    return orders, pos


def quote_stable_product(
    product: str,
    order_depth: OrderDepth,
    fair: float,
    position: int,
    limit: int,
    quote_size: int,
    make_width: float,
    soft_cap: int,
) -> List[Order]:
    """
    Post passive quotes using the penny-inside-spread formula:
      bid = min(best_bid + 1, floor(fair - make_width))
      ask = max(best_ask - 1, ceil(fair + make_width))

    Quote sizes are:
      • Boosted on the unwind side (e.g., sell more when long)
      • Scaled down by soft_scale when abs(position) is high
    """
    bba = get_best_bid_ask(order_depth)
    if bba is None:
        return []
    best_bid, best_ask = bba

    bid_px = min(best_bid + 1, math.floor(fair - make_width))
    ask_px = max(best_ask - 1, math.ceil(fair + make_width))

    # If inverted, fall back to resting on the bot quotes
    if bid_px >= ask_px:
        bid_px = best_bid
        ask_px = best_ask

    # --- Quote sizing with inventory awareness ---
    scale = soft_scale(position, soft_cap, limit)

    buy_size = min(int(quote_size * scale), limit - position)
    sell_size = min(int(quote_size * scale), limit + position)

    # Boost on unwind side
    if position < 0:
        buy_size = min(limit - position, quote_size + min(-position, quote_size))
    elif position > 0:
        sell_size = min(limit + position, quote_size + min(position, quote_size))

    orders: List[Order] = []
    if buy_size > 0:
        orders.append(Order(product, bid_px, buy_size))
    if sell_size > 0:
        orders.append(Order(product, ask_px, -sell_size))

    return orders


# ═══════════════════════════════════════════════════════════════════════════
#  ASH_COATED_OSMIUM — signal-based mean-reversion
# ═══════════════════════════════════════════════════════════════════════════

def trade_mean_reversion_product(
    product: str,
    order_depth: OrderDepth,
    fair: float,
    zscore: float,
    position: int,
    limit: int,
) -> Tuple[List[Order], int]:
    """
    Mean-reversion signal trading:
      • z < -entry: buy  (price is cheap relative to fair)
      • z > +entry: sell (price is rich relative to fair)
      • |z| < exit: reduce/close position (signal faded)

    Also applies an inventory penalty: adjusts effective z to discourage
    accumulating near position limits.

    Returns (orders, projected_position).
    """
    orders: List[Order] = []
    pos = position

    # Inventory penalty pushes z toward zero as position grows
    adj_z = zscore - position * ACO_INVENTORY_PENALTY

    # ---- Entry: aggressive takes ----
    if adj_z < -ACO_ENTRY_THRESHOLD:
        # Buy signal — sweep cheap asks
        for ask_px in sorted(order_depth.sell_orders):
            room = limit - pos
            if room <= 0:
                break
            vol = -order_depth.sell_orders[ask_px]
            if ask_px <= fair:
                fill = min(room, vol, ACO_AGGRESS_SIZE)
                if fill > 0:
                    orders.append(Order(product, ask_px, fill))
                    pos += fill

    elif adj_z > ACO_ENTRY_THRESHOLD:
        # Sell signal — sweep expensive bids
        for bid_px in sorted(order_depth.buy_orders, reverse=True):
            room = limit + pos
            if room <= 0:
                break
            vol = order_depth.buy_orders[bid_px]
            if bid_px >= fair:
                fill = min(room, vol, ACO_AGGRESS_SIZE)
                if fill > 0:
                    orders.append(Order(product, bid_px, -fill))
                    pos -= fill

    # ---- Exit: reduce when z-score reverts toward zero ----
    elif abs(adj_z) < ACO_EXIT_THRESHOLD:
        if pos > 0:
            # Long position, z is near zero → sell to flatten
            for bid_px in sorted(order_depth.buy_orders, reverse=True):
                if pos <= 0:
                    break
                vol = order_depth.buy_orders[bid_px]
                if bid_px >= fair - 1:  # accept 1 tick of slippage to exit
                    fill = min(pos, vol)
                    if fill > 0:
                        orders.append(Order(product, bid_px, -fill))
                        pos -= fill

        elif pos < 0:
            # Short position, z is near zero → buy to flatten
            for ask_px in sorted(order_depth.sell_orders):
                if pos >= 0:
                    break
                vol = -order_depth.sell_orders[ask_px]
                if ask_px <= fair + 1:  # accept 1 tick of slippage to exit
                    fill = min(-pos, vol)
                    if fill > 0:
                        orders.append(Order(product, ask_px, fill))
                        pos += fill

    return orders, pos


def passive_quotes_volatile(
    product: str,
    order_depth: OrderDepth,
    fair: float,
    zscore: float,
    position: int,
    limit: int,
) -> List[Order]:
    """
    Post passive quotes on the volatile product when:
      • Spread is wide enough (≥ ACO_MIN_SPREAD)
      • Signal strength is moderate (ACO_PASSIVE_Z_MIN ≤ |z| ≤ ACO_PASSIVE_Z_MAX)

    Quotes are biased in the direction of the signal to earn edge while
    expressing a mild directional view.
    """
    bba = get_best_bid_ask(order_depth)
    if bba is None:
        return []
    best_bid, best_ask = bba
    spread = best_ask - best_bid

    if spread < ACO_MIN_SPREAD:
        return []

    abs_z = abs(zscore)
    if abs_z < ACO_PASSIVE_Z_MIN or abs_z > ACO_PASSIVE_Z_MAX:
        return []

    orders: List[Order] = []
    scale = soft_scale(position, ACO_SOFT_CAP, limit)
    base_size = max(1, int(ACO_QUOTE_SIZE * scale))

    # Penny inside the spread, but preserve minimum edge
    bid_px = min(best_bid + ACO_PASSIVE_OFFSET, math.floor(fair - ACO_MAKE_WIDTH))
    ask_px = max(best_ask - ACO_PASSIVE_OFFSET, math.ceil(fair + ACO_MAKE_WIDTH))

    if bid_px >= ask_px:
        return []

    buy_size = min(base_size, limit - position)
    sell_size = min(base_size, limit + position)

    # Skew: if signal says buy (z < 0), post a larger bid / smaller ask
    if zscore < 0:
        buy_size = min(buy_size + 3, limit - position)
        sell_size = max(sell_size - 3, 0)
    elif zscore > 0:
        sell_size = min(sell_size + 3, limit + position)
        buy_size = max(buy_size - 3, 0)

    if buy_size > 0:
        orders.append(Order(product, bid_px, buy_size))
    if sell_size > 0:
        orders.append(Order(product, ask_px, -sell_size))

    return orders


# ═══════════════════════════════════════════════════════════════════════════
#  STATE PERSISTENCE
# ═══════════════════════════════════════════════════════════════════════════

def load_state(trader_data: str) -> dict:
    """Deserialise persistent state from traderData JSON string."""
    if not trader_data:
        return {"mid_prices": {}}
    try:
        payload = json.loads(trader_data)
        # Ensure mid_prices exists and contains proper float lists
        mp = payload.get("mid_prices", {})
        cleaned = {
            product: [float(p) for p in prices]
            for product, prices in mp.items()
            if isinstance(prices, list)
        }
        payload["mid_prices"] = cleaned
        return payload
    except (json.JSONDecodeError, TypeError, ValueError):
        return {"mid_prices": {}}


def save_state(state_dict: dict) -> str:
    """Serialise persistent state to compact JSON."""
    return json.dumps(state_dict, separators=(",", ":"))


# ═══════════════════════════════════════════════════════════════════════════
#  LOGGING
# ═══════════════════════════════════════════════════════════════════════════

def log_product(
    product: str,
    position: int,
    fair: float,
    mid: float,
    num_orders: int,
    extra: str = "",
):
    """Minimal per-product logging line."""
    tag = product[:3]  # IPR or ASH
    msg = f"[{tag}] pos={position:+4d}  fair={fair:.1f}  mid={mid:.1f}  orders={num_orders}"
    if extra:
        msg += f"  {extra}"
    print(msg)


# ═══════════════════════════════════════════════════════════════════════════
#  MAIN TRADER CLASS
# ═══════════════════════════════════════════════════════════════════════════

class Trader:

    def run(self, state: TradingState):
        persistent = load_state(state.traderData)
        mid_prices = persistent.setdefault("mid_prices", {})
        result: Dict[str, List[Order]] = {}

        for product in state.order_depths:
            order_depth = state.order_depths[product]

            if product not in POSITION_LIMITS:
                result[product] = []
                continue

            mid = compute_midprice(order_depth)
            if mid is None:
                result[product] = []
                continue

            position = state.position.get(product, 0)
            limit = POSITION_LIMITS[product]

            # ──────────────────────────────────────────────────────────
            # INTARIAN_PEPPER_ROOT — stable market-making
            # ──────────────────────────────────────────────────────────
            if product == "INTARIAN_PEPPER_ROOT":
                history = update_price_history(
                    mid_prices, product, mid, IPR_HISTORY_LEN
                )

                # Fair value: EMA of midprice history (or current mid if short)
                if len(history) >= 3:
                    fair = compute_ema(history, IPR_EMA_ALPHA)
                else:
                    fair = mid

                # Inventory skew shifts fair value
                adj_fair = fair - position * IPR_INVENTORY_SKEW

                # 1) Aggressive takes
                orders, proj_pos = market_take_stable_product(
                    product, order_depth, adj_fair,
                    IPR_TAKE_WIDTH, position, limit,
                )

                # 2) Passive quotes using projected position
                orders.extend(quote_stable_product(
                    product, order_depth, adj_fair,
                    proj_pos, limit,
                    IPR_QUOTE_SIZE, IPR_MAKE_WIDTH, IPR_SOFT_CAP,
                ))

                log_product(product, position, adj_fair, mid, len(orders))
                result[product] = orders

            # ──────────────────────────────────────────────────────────
            # ASH_COATED_OSMIUM — volatile mean-reversion
            # ──────────────────────────────────────────────────────────
            elif product == "ASH_COATED_OSMIUM":
                history = update_price_history(
                    mid_prices, product, mid, ACO_HISTORY_LEN
                )

                # Fair value via EMA
                fair = compute_ema(history, ACO_EMA_ALPHA)

                # Z-score (need enough history for meaningful stats)
                if len(history) >= max(5, ACO_ZSCORE_LOOKBACK // 2):
                    zscore = compute_zscore(history, ACO_ZSCORE_LOOKBACK, fair)
                else:
                    zscore = 0.0

                # Inventory-skewed fair for passive quotes
                adj_fair = fair - position * ACO_INVENTORY_SKEW

                # 1) Signal-driven aggressive trading
                orders, proj_pos = trade_mean_reversion_product(
                    product, order_depth, adj_fair,
                    zscore, position, limit,
                )

                # 2) Passive quotes when signal is moderate
                orders.extend(passive_quotes_volatile(
                    product, order_depth, adj_fair,
                    zscore, proj_pos, limit,
                ))

                log_product(
                    product, position, adj_fair, mid, len(orders),
                    extra=f"z={zscore:+.2f} std={compute_std(history, ACO_ZSCORE_LOOKBACK):.1f}",
                )
                result[product] = orders

        # Return format: (orders_dict, conversions, traderData)
        return result, 0, save_state(persistent)
