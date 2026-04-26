"""
IMC Prosperity 4 — Round 3 Trader

Products
─────────────────────────────────────────────────────────────────────────────
HYDROGEL_PACK (HP)             — noisy mean-reverter; trade midprice deviations
VELVETFRUIT_EXTRACT (VFE)      — underlying for the VEV vouchers; light MM
VEV_*                          — vouchers (call options) on VFE with strikes
                                 4000, 4500, 5000, 5100, 5200, 5300, 5400,
                                 5500, 6000, 6500. TTE ≈ 5 days at start.

Strategy components
─────────────────────────────────────────────────────────────────────────────
HP:    EMA fair value + inventory-skewed mean-reversion takes & passive quotes.
VFE:   microprice + EMA fair, light market making. Anchors voucher pricing.
VEV_*: option_fair = max(VFE_fair − K, 0) + α · vol · sqrt(TTE)
       Trade only when |market − fair| > threshold.
       Cross-strike monotonicity check: lower-strike call ≥ higher-strike call.
       Net-delta accounting reduces trades that worsen aggregate exposure.

Datamodel import — supports both Prosperity submission and the local
prosperity4bt backtester.
"""

import json
import math
from typing import Any, Dict, List, Optional, Tuple

try:
    from datamodel import Order, OrderDepth, TradingState
except ImportError:
    from prosperity4bt.datamodel import Order, OrderDepth, TradingState


# ═══════════════════════════════════════════════════════════════════════════
#  CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

POSITION_LIMITS: Dict[str, int] = {
    "HYDROGEL_PACK":       200,
    "VELVETFRUIT_EXTRACT": 200,
    "VEV_4000": 300, "VEV_4500": 300, "VEV_5000": 300,
    "VEV_5100": 300, "VEV_5200": 300, "VEV_5300": 300,
    "VEV_5400": 300, "VEV_5500": 300, "VEV_6000": 300,
    "VEV_6500": 300,
}

VOUCHER_STRIKES: Dict[str, int] = {
    "VEV_4000": 4000, "VEV_4500": 4500, "VEV_5000": 5000,
    "VEV_5100": 5100, "VEV_5200": 5200, "VEV_5300": 5300,
    "VEV_5400": 5400, "VEV_5500": 5500, "VEV_6000": 6000,
    "VEV_6500": 6500,
}
VOUCHER_LIST: List[str] = list(VOUCHER_STRIKES.keys())

# ── HYDROGEL_PACK ────────────────────────────────────────────────────────────
HP_EMA_ALPHA           = 0.05    # slow EMA → stable fair value
HP_TAKE_THRESHOLD      = 1.5     # require this many ticks of edge to take
HP_MAKE_WIDTH          = 1.5     # min edge preserved on passive quotes
HP_INVENTORY_PENALTY   = 0.05    # ticks of fair-value shift per unit position
HP_QUOTE_SIZE          = 20      # base passive quote size
HP_AGGRESS_SIZE        = 25      # max units per aggressive take per side
HP_SOFT_CAP            = 140     # scale down quotes above this |position|
HP_HISTORY_LEN         = 50

# ── VELVETFRUIT_EXTRACT ──────────────────────────────────────────────────────
VFE_EMA_ALPHA          = 0.10    # moderate EMA → fair value tracks micro-flow
VFE_VOL_WINDOW         = 60      # rolling window for return-vol
VFE_TAKE_THRESHOLD     = 1.5
VFE_MAKE_WIDTH         = 1.5
VFE_INVENTORY_PENALTY  = 0.03
VFE_QUOTE_SIZE         = 15
VFE_AGGRESS_SIZE       = 20
VFE_SOFT_CAP           = 140
VFE_HISTORY_LEN        = 100

# ── VEV vouchers (options on VFE) ────────────────────────────────────────────
VOUCHER_TIME_VALUE_ALPHA   = 1.5      # multiplies vol·√TTE to get time value
VOUCHER_TTE_TOTAL_DAYS     = 5.0      # round 3 expiry horizon
VOUCHER_TAKE_THRESHOLD     = 2.0      # SeaShells of edge required
VOUCHER_MAKE_WIDTH         = 2.0
VOUCHER_INVENTORY_PENALTY  = 0.03
VOUCHER_QUOTE_SIZE         = 20
VOUCHER_AGGRESS_SIZE       = 25
VOUCHER_SOFT_CAP           = 220
# Net-delta budget (in VFE-units). Trades that push beyond this in the
# already-violated direction get suppressed.
NET_DELTA_BUDGET           = 250.0
# Minimum edge to bother trading deep-ITM/OTM strikes (no time value to mine)
DEAD_VOUCHER_PRICE_FLOOR   = 1.0      # skip vouchers trading below this


# ═══════════════════════════════════════════════════════════════════════════
#  BOOK / PRICE HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def get_best_bid_ask(order_depth: OrderDepth) -> Optional[Tuple[int, int, int, int]]:
    """Return (best_bid, bid_volume, best_ask, ask_volume) or None if one side empty."""
    if not order_depth.buy_orders or not order_depth.sell_orders:
        return None
    best_bid = max(order_depth.buy_orders)
    best_ask = min(order_depth.sell_orders)
    bid_vol = order_depth.buy_orders[best_bid]
    ask_vol = -order_depth.sell_orders[best_ask]   # sell qtys are negative
    return best_bid, bid_vol, best_ask, ask_vol


def midprice(order_depth: OrderDepth) -> Optional[float]:
    bba = get_best_bid_ask(order_depth)
    if bba is None:
        return None
    return (bba[0] + bba[2]) / 2.0


def microprice(order_depth: OrderDepth) -> Optional[float]:
    """Volume-weighted price: leans toward the side with smaller resting size,
    i.e. where the next print is more likely to land."""
    bba = get_best_bid_ask(order_depth)
    if bba is None:
        return None
    bid, bid_vol, ask, ask_vol = bba
    total = bid_vol + ask_vol
    if total <= 0:
        return (bid + ask) / 2.0
    # Smaller side gets more weight on price → micro pulls toward the thin side
    return (bid * ask_vol + ask * bid_vol) / total


# ═══════════════════════════════════════════════════════════════════════════
#  STATEFUL UPDATERS  (EMA, history, vol)
# ═══════════════════════════════════════════════════════════════════════════

def update_ema(prev: Optional[float], value: float, alpha: float) -> float:
    """EMA: when no prior, seed with the first observation."""
    if prev is None:
        return value
    return alpha * value + (1 - alpha) * prev


def push_history(state_list: List[float], value: float, max_len: int) -> List[float]:
    state_list.append(value)
    if len(state_list) > max_len:
        del state_list[: len(state_list) - max_len]
    return state_list


def rolling_volatility(history: List[float], window: int) -> float:
    """Stdev of first-difference returns over the trailing `window` samples.
    Returns 0 if too few samples."""
    if len(history) < 3:
        return 0.0
    sl = history[-window:] if len(history) >= window else history
    diffs = [sl[i] - sl[i - 1] for i in range(1, len(sl))]
    if len(diffs) < 2:
        return 0.0
    mean = sum(diffs) / len(diffs)
    var = sum((d - mean) ** 2 for d in diffs) / len(diffs)
    return math.sqrt(var)


# ═══════════════════════════════════════════════════════════════════════════
#  ORDER SIZING  (position-limit-safe)
# ═══════════════════════════════════════════════════════════════════════════

def soft_scale(position: int, soft_cap: int, limit: int) -> float:
    """Returns 1.0 below soft_cap, ramps linearly to 0 at the hard limit."""
    abs_pos = abs(position)
    if abs_pos <= soft_cap:
        return 1.0
    if abs_pos >= limit:
        return 0.0
    return (limit - abs_pos) / (limit - soft_cap)


def clamp_qty(qty: int, position: int, limit: int) -> int:
    """Truncate `qty` so that the resulting position stays in [-limit, +limit]."""
    if qty > 0:
        return max(0, min(qty, limit - position))
    if qty < 0:
        return min(0, max(qty, -(limit + position)))
    return 0


# ═══════════════════════════════════════════════════════════════════════════
#  HYDROGEL_PACK   (mean-reversion + light passive quoting)
# ═══════════════════════════════════════════════════════════════════════════

def trade_hydrogel_pack(
    order_depth: OrderDepth,
    fair: float,
    position: int,
    limit: int,
) -> Tuple[List[Order], int]:
    """
    Mean-revert HP around an inventory-adjusted fair value.
      • Take when ask is well below adj_fair, or bid well above adj_fair
      • Post passive quotes inside the spread with a minimum edge
      • Inventory penalty pushes adj_fair against your position so quotes
        widen on the side you're already loaded up on.
    """
    orders: List[Order] = []
    bba = get_best_bid_ask(order_depth)
    if bba is None:
        return orders, position

    best_bid, _bv, best_ask, _av = bba
    adj_fair = fair - position * HP_INVENTORY_PENALTY
    pos = position

    # ---- aggressive takes ----------------------------------------------------
    for ask_px in sorted(order_depth.sell_orders):
        room = limit - pos
        if room <= 0:
            break
        avail = -order_depth.sell_orders[ask_px]
        if ask_px <= adj_fair - HP_TAKE_THRESHOLD:
            fill = min(room, avail, HP_AGGRESS_SIZE)
            if fill > 0:
                orders.append(Order("HYDROGEL_PACK", ask_px, fill))
                pos += fill

    for bid_px in sorted(order_depth.buy_orders, reverse=True):
        room = limit + pos
        if room <= 0:
            break
        avail = order_depth.buy_orders[bid_px]
        if bid_px >= adj_fair + HP_TAKE_THRESHOLD:
            fill = min(room, avail, HP_AGGRESS_SIZE)
            if fill > 0:
                orders.append(Order("HYDROGEL_PACK", bid_px, -fill))
                pos -= fill

    # ---- passive quotes ------------------------------------------------------
    bid_quote = min(best_bid + 1, math.floor(adj_fair - HP_MAKE_WIDTH))
    ask_quote = max(best_ask - 1, math.ceil(adj_fair + HP_MAKE_WIDTH))
    if bid_quote >= ask_quote:                     # spread crossed → bail
        return orders, pos

    scale = soft_scale(pos, HP_SOFT_CAP, limit)
    base = max(1, int(HP_QUOTE_SIZE * scale))
    buy_size = clamp_qty(base, pos, limit)
    sell_size = clamp_qty(-base, pos, limit)

    if buy_size > 0:
        orders.append(Order("HYDROGEL_PACK", bid_quote, buy_size))
    if sell_size < 0:
        orders.append(Order("HYDROGEL_PACK", ask_quote, sell_size))

    return orders, pos


# ═══════════════════════════════════════════════════════════════════════════
#  VELVETFRUIT_EXTRACT   (microprice-anchored MM; serves as voucher anchor)
# ═══════════════════════════════════════════════════════════════════════════

def trade_velvetfruit_extract(
    order_depth: OrderDepth,
    fair: float,
    position: int,
    limit: int,
) -> Tuple[List[Order], int]:
    """Light market-making on VFE. The fair value is computed externally so
    the same value can anchor voucher pricing this tick."""
    orders: List[Order] = []
    bba = get_best_bid_ask(order_depth)
    if bba is None:
        return orders, position

    best_bid, _bv, best_ask, _av = bba
    adj_fair = fair - position * VFE_INVENTORY_PENALTY
    pos = position

    # ---- aggressive takes ----------------------------------------------------
    for ask_px in sorted(order_depth.sell_orders):
        room = limit - pos
        if room <= 0:
            break
        avail = -order_depth.sell_orders[ask_px]
        if ask_px <= adj_fair - VFE_TAKE_THRESHOLD:
            fill = min(room, avail, VFE_AGGRESS_SIZE)
            if fill > 0:
                orders.append(Order("VELVETFRUIT_EXTRACT", ask_px, fill))
                pos += fill

    for bid_px in sorted(order_depth.buy_orders, reverse=True):
        room = limit + pos
        if room <= 0:
            break
        avail = order_depth.buy_orders[bid_px]
        if bid_px >= adj_fair + VFE_TAKE_THRESHOLD:
            fill = min(room, avail, VFE_AGGRESS_SIZE)
            if fill > 0:
                orders.append(Order("VELVETFRUIT_EXTRACT", bid_px, -fill))
                pos -= fill

    # ---- passive quotes ------------------------------------------------------
    bid_quote = min(best_bid + 1, math.floor(adj_fair - VFE_MAKE_WIDTH))
    ask_quote = max(best_ask - 1, math.ceil(adj_fair + VFE_MAKE_WIDTH))
    if bid_quote >= ask_quote:
        return orders, pos

    scale = soft_scale(pos, VFE_SOFT_CAP, limit)
    base = max(1, int(VFE_QUOTE_SIZE * scale))
    buy_size = clamp_qty(base, pos, limit)
    sell_size = clamp_qty(-base, pos, limit)

    if buy_size > 0:
        orders.append(Order("VELVETFRUIT_EXTRACT", bid_quote, buy_size))
    if sell_size < 0:
        orders.append(Order("VELVETFRUIT_EXTRACT", ask_quote, sell_size))

    return orders, pos


# ═══════════════════════════════════════════════════════════════════════════
#  VEV VOUCHERS   (call-option pricing + delta accounting)
# ═══════════════════════════════════════════════════════════════════════════

def voucher_fair_value(
    vfe_fair: float,
    strike: int,
    tte_days: float,
    vol: float,
    alpha: float,
) -> float:
    """
    Simple call-option price: intrinsic + time value.
        intrinsic   = max(VFE - K, 0)
        time_value  = α · vol · √TTE
    Time value is largest at the money and shrinks as |VFE-K| grows.
    Here we discount time_value by an at-the-money kernel so far-OTM/ITM
    options correctly converge to ≈ intrinsic + 0.
    """
    intrinsic = max(vfe_fair - strike, 0.0)
    if vol <= 0 or tte_days <= 0:
        return intrinsic
    sigma_t = vol * math.sqrt(max(tte_days, 1e-6))
    if sigma_t <= 0:
        return intrinsic
    # Damping: how many "vol-distances" away from the strike are we?
    moneyness_dist = abs(vfe_fair - strike) / sigma_t
    # Smooth Gaussian-style kernel: 1 at the money, → 0 far away.
    damp = math.exp(-0.5 * moneyness_dist * moneyness_dist)
    time_value = alpha * sigma_t * damp
    return intrinsic + time_value


def voucher_delta(vfe_fair: float, strike: int, vol: float, tte_days: float) -> float:
    """Heuristic delta in [0, 1] using the same Gaussian moneyness kernel.
    Deep ITM → 1, ATM → 0.5, deep OTM → 0."""
    if vol <= 0 or tte_days <= 0:
        return 1.0 if vfe_fair > strike else 0.0
    sigma_t = vol * math.sqrt(max(tte_days, 1e-6))
    if sigma_t <= 0:
        return 1.0 if vfe_fair > strike else 0.0
    z = (vfe_fair - strike) / sigma_t
    # Smooth approximation of N(z) — good enough for inventory accounting.
    return 0.5 * (1.0 + math.tanh(z))


def trade_voucher(
    voucher: str,
    order_depth: OrderDepth,
    voucher_fair: float,
    position: int,
    limit: int,
    delta: float,
    net_delta_before: float,
) -> Tuple[List[Order], float]:
    """
    Trade a single voucher when its market price diverges from option_fair.
    Suppress trades that would push net delta further past the budget.
    Returns (orders, net_delta_change_from_these_orders).
    """
    orders: List[Order] = []
    bba = get_best_bid_ask(order_depth)
    if bba is None:
        return orders, 0.0

    best_bid, _bv, best_ask, _av = bba
    if best_ask < DEAD_VOUCHER_PRICE_FLOOR and voucher_fair < DEAD_VOUCHER_PRICE_FLOOR:
        return orders, 0.0   # everything too cheap to matter

    adj_fair = voucher_fair - position * VOUCHER_INVENTORY_PENALTY
    pos = position
    delta_change = 0.0

    def respects_delta_budget(qty: int) -> bool:
        """Block trades that worsen an already-overshot net delta."""
        projected = net_delta_before + delta_change + qty * delta
        if abs(projected) <= NET_DELTA_BUDGET:
            return True
        # Allow only if the new trade reduces |net delta|.
        return abs(projected) < abs(net_delta_before + delta_change)

    # ---- aggressive takes ----------------------------------------------------
    for ask_px in sorted(order_depth.sell_orders):
        room = limit - pos
        if room <= 0:
            break
        avail = -order_depth.sell_orders[ask_px]
        if ask_px <= adj_fair - VOUCHER_TAKE_THRESHOLD:
            fill = min(room, avail, VOUCHER_AGGRESS_SIZE)
            if fill > 0 and respects_delta_budget(fill):
                orders.append(Order(voucher, ask_px, fill))
                pos += fill
                delta_change += fill * delta

    for bid_px in sorted(order_depth.buy_orders, reverse=True):
        room = limit + pos
        if room <= 0:
            break
        avail = order_depth.buy_orders[bid_px]
        if bid_px >= adj_fair + VOUCHER_TAKE_THRESHOLD:
            fill = min(room, avail, VOUCHER_AGGRESS_SIZE)
            if fill > 0 and respects_delta_budget(-fill):
                orders.append(Order(voucher, bid_px, -fill))
                pos -= fill
                delta_change -= fill * delta

    # ---- passive quotes (only if there's room and price floor not violated)
    if voucher_fair >= DEAD_VOUCHER_PRICE_FLOOR:
        bid_quote = min(best_bid + 1, math.floor(adj_fair - VOUCHER_MAKE_WIDTH))
        ask_quote = max(best_ask - 1, math.ceil(adj_fair + VOUCHER_MAKE_WIDTH))
        if bid_quote < ask_quote and bid_quote >= 1:
            scale = soft_scale(pos, VOUCHER_SOFT_CAP, limit)
            base = max(1, int(VOUCHER_QUOTE_SIZE * scale))
            buy_size = clamp_qty(base, pos, limit)
            sell_size = clamp_qty(-base, pos, limit)
            if buy_size > 0 and respects_delta_budget(buy_size):
                orders.append(Order(voucher, bid_quote, buy_size))
            if sell_size < 0 and respects_delta_budget(sell_size):
                orders.append(Order(voucher, ask_quote, sell_size))

    return orders, delta_change


def enforce_strike_monotonicity(
    fair_values: Dict[str, float],
) -> Dict[str, float]:
    """
    Calls are monotonically non-increasing in strike: C(K1) ≥ C(K2) for K1 < K2.
    If our model violates this (rare but possible at strike boundaries), pull
    the violating value down to the next-lower-strike call's fair. This keeps
    cross-strike trades from chasing fake edge.
    """
    sorted_strikes = sorted(VOUCHER_STRIKES.items(), key=lambda kv: kv[1])
    smoothed = dict(fair_values)
    prev_fair: Optional[float] = None
    for voucher, _strike in sorted_strikes:
        f = smoothed.get(voucher)
        if f is None:
            continue
        if prev_fair is not None and f > prev_fair:
            smoothed[voucher] = prev_fair      # downgrade
        prev_fair = smoothed[voucher]
    return smoothed


# ═══════════════════════════════════════════════════════════════════════════
#  PERSISTENT STATE  (across run() invocations via traderData)
# ═══════════════════════════════════════════════════════════════════════════

def load_state(blob: str) -> dict:
    if not blob:
        return _empty_state()
    try:
        s = json.loads(blob)
    except (json.JSONDecodeError, TypeError, ValueError):
        return _empty_state()
    # tolerate older schemas
    base = _empty_state()
    base.update({k: s.get(k, base[k]) for k in base})
    if not isinstance(base["vfe_history"], list):
        base["vfe_history"] = []
    if not isinstance(base["hp_history"], list):
        base["hp_history"] = []
    return base


def _empty_state() -> dict:
    return {
        "hp_ema":        None,
        "hp_history":    [],
        "vfe_ema":       None,
        "vfe_history":   [],
        "day_index":     0,
        "last_ts":       -1,
    }


def save_state(state: dict) -> str:
    return json.dumps(state, separators=(",", ":"))


def update_day_counter(state: dict, current_ts: int) -> int:
    """Detect a new day when the timestamp resets to a small value below the
    previous one. Each Prosperity day is 1,000,000 timestamp units."""
    last = state.get("last_ts", -1)
    if last >= 0 and current_ts + 50_000 < last:        # wrap-around
        state["day_index"] = state.get("day_index", 0) + 1
    state["last_ts"] = current_ts
    return state["day_index"]


def remaining_tte_days(day_index: int, ts: int) -> float:
    """Time-to-expiry in days based on the day counter and within-day fraction."""
    elapsed = day_index + ts / 1_000_000.0
    return max(0.0, VOUCHER_TTE_TOTAL_DAYS - elapsed)


# ═══════════════════════════════════════════════════════════════════════════
#  MAIN TRADER CLASS
# ═══════════════════════════════════════════════════════════════════════════

class Trader:

    def run(self, state: TradingState) -> Tuple[Dict[str, List[Order]], int, str]:
        persistent = load_state(state.traderData)
        day_index = update_day_counter(persistent, state.timestamp)
        tte_days = remaining_tte_days(day_index, state.timestamp)

        result: Dict[str, List[Order]] = {}

        # ─── 1) HYDROGEL_PACK ────────────────────────────────────────────────
        hp_depth = state.order_depths.get("HYDROGEL_PACK")
        if hp_depth is not None:
            mid = midprice(hp_depth)
            if mid is not None:
                push_history(persistent["hp_history"], mid, HP_HISTORY_LEN)
                persistent["hp_ema"] = update_ema(
                    persistent["hp_ema"], mid, HP_EMA_ALPHA
                )
                hp_position = state.position.get("HYDROGEL_PACK", 0)
                hp_orders, _ = trade_hydrogel_pack(
                    hp_depth,
                    persistent["hp_ema"],
                    hp_position,
                    POSITION_LIMITS["HYDROGEL_PACK"],
                )
                if hp_orders:
                    result["HYDROGEL_PACK"] = hp_orders

        # ─── 2) VELVETFRUIT_EXTRACT (also used as voucher anchor) ────────────
        vfe_fair: Optional[float] = None
        vfe_vol = 0.0
        vfe_depth = state.order_depths.get("VELVETFRUIT_EXTRACT")
        if vfe_depth is not None:
            anchor_price = microprice(vfe_depth)         # micro > mid for MM
            if anchor_price is not None:
                push_history(persistent["vfe_history"], anchor_price, VFE_HISTORY_LEN)
                persistent["vfe_ema"] = update_ema(
                    persistent["vfe_ema"], anchor_price, VFE_EMA_ALPHA
                )
                vfe_fair = persistent["vfe_ema"]
                vfe_vol = rolling_volatility(
                    persistent["vfe_history"], VFE_VOL_WINDOW
                )
                vfe_position = state.position.get("VELVETFRUIT_EXTRACT", 0)
                vfe_orders, _ = trade_velvetfruit_extract(
                    vfe_depth,
                    vfe_fair,
                    vfe_position,
                    POSITION_LIMITS["VELVETFRUIT_EXTRACT"],
                )
                if vfe_orders:
                    result["VELVETFRUIT_EXTRACT"] = vfe_orders

        # ─── 3) VEV vouchers (need a valid VFE anchor) ───────────────────────
        if vfe_fair is not None:
            # Compute and smooth voucher fair values across strikes.
            voucher_fairs: Dict[str, float] = {}
            for voucher, strike in VOUCHER_STRIKES.items():
                voucher_fairs[voucher] = voucher_fair_value(
                    vfe_fair, strike, tte_days, vfe_vol, VOUCHER_TIME_VALUE_ALPHA
                )
            voucher_fairs = enforce_strike_monotonicity(voucher_fairs)

            # Seed net delta with current spot exposure (VFE itself is delta-1).
            net_delta = float(state.position.get("VELVETFRUIT_EXTRACT", 0))
            for voucher in VOUCHER_LIST:
                strike = VOUCHER_STRIKES[voucher]
                pos = state.position.get(voucher, 0)
                d = voucher_delta(vfe_fair, strike, vfe_vol, tte_days)
                net_delta += pos * d

            # Trade highest-edge strikes first (closest to ATM).
            ordered = sorted(
                VOUCHER_LIST,
                key=lambda v: abs(VOUCHER_STRIKES[v] - vfe_fair),
            )
            for voucher in ordered:
                depth = state.order_depths.get(voucher)
                if depth is None:
                    continue
                strike = VOUCHER_STRIKES[voucher]
                pos = state.position.get(voucher, 0)
                d = voucher_delta(vfe_fair, strike, vfe_vol, tte_days)
                voucher_orders, dd = trade_voucher(
                    voucher,
                    depth,
                    voucher_fairs[voucher],
                    pos,
                    POSITION_LIMITS[voucher],
                    d,
                    net_delta,
                )
                if voucher_orders:
                    result[voucher] = voucher_orders
                    net_delta += dd

        return result, 0, save_state(persistent)
