"""
IMC Prosperity Round 3 strategy scaffold.

Current mode: HP-only baseline.

Backtest workflow:
1. HP only: ENABLE_HP = True, every other strategy layer False.
2. HP + passive VFE stats: keep ENABLE_VFE False and inspect vfe_stats/debug logs.
3. HP + very conservative VFE: set ENABLE_VFE True after HP PnL is acceptable.
4. HP + one ATM voucher: set ENABLE_VOUCHERS/ENABLE_RELATIVE_VALUE True and restrict
   ACTIVE_VOUCHERS to one near-ATM strike.
5. HP + all vouchers with relative value only.
6. Only then consider ENABLE_OPTION_MODEL or ENABLE_PID.

The point of this file is to make each layer independently testable. Prefer no
trade over a bad trade.
"""

import json
import math
from typing import Any, Dict, List, Optional, Tuple

try:
    from datamodel import Order, OrderDepth, TradingState
except ImportError:
    from prosperity4bt.datamodel import Order, OrderDepth, TradingState


# ---------------------------------------------------------------------------
# Feature toggles
# ---------------------------------------------------------------------------

ENABLE_HP = False
ENABLE_VFE = True
ENABLE_VOUCHERS = True
ENABLE_PID = False
ENABLE_OPTION_MODEL = False
ENABLE_RELATIVE_VALUE = False
ENABLE_DEBUG_LOGS = True


# ---------------------------------------------------------------------------
# Product config
# ---------------------------------------------------------------------------

HP = "HYDROGEL_PACK"
VFE = "VELVETFRUIT_EXTRACT"

POSITION_LIMITS: Dict[str, int] = {
    HP: 200,
    VFE: 200,
    "VEV_4000": 300,
    "VEV_4500": 300,
    "VEV_5000": 300,
    "VEV_5100": 300,
    "VEV_5200": 300,
    "VEV_5300": 300,
    "VEV_5400": 300,
    "VEV_5500": 300,
    "VEV_6000": 300,
    "VEV_6500": 300,
}

VOUCHER_STRIKES: Dict[str, int] = {
    "VEV_4000": 4000,
    "VEV_4500": 4500,
    "VEV_5000": 5000,
    "VEV_5100": 5100,
    "VEV_5200": 5200,
    "VEV_5300": 5300,
    "VEV_5400": 5400,
    "VEV_5500": 5500,
    "VEV_6000": 6000,
    "VEV_6500": 6500,
}
VOUCHER_LIST: List[str] = list(VOUCHER_STRIKES.keys())
# Skip VEV_4000/4500 (wide spreads, low edge) and VEV_6000/6500 (locked at 0.5).
ACTIVE_VOUCHERS: List[str] = ["VEV_5000", "VEV_5100", "VEV_5200", "VEV_5300", "VEV_5400", "VEV_5500"]


# ---------------------------------------------------------------------------
# Tunable parameters
# ---------------------------------------------------------------------------

HP_EMA_ALPHA = 0.03
HP_TRADE_THRESHOLD = 6.0
HP_SPREAD_BUFFER_FRAC = 0.50
HP_INVENTORY_PENALTY = 0.02
HP_MAX_ORDER_SIZE = 8
HP_PRACTICAL_CAP = 140
HP_STRONG_EDGE = 12.0
HP_INVENTORY_THROTTLE_START = 100
HP_EXTEND_EDGE_PENALTY = 0.04
HP_REDUCE_EDGE_DISCOUNT = 0.03

VFE_EMA_ALPHA = 0.05
VFE_VOL_WINDOW = 80
VFE_SOFT_CAP = 200                  # full position limit
VFE_QUOTE_SIZE = 8                  # V7: base size 5 -> 8 (more fills per cycle)
VFE_IMBALANCE_GATE = 0.0
VFE_QUOTE_OFFSET = 0
VFE_SKEW_COEFF = 0.015

# Gated-aggression layer.
VFE_AGG_IMBALANCE_THRESHOLD = 0.5   # V11: 0.4 -> 0.5 (sweep showed +234 PnL at 0.5 vs 0.4)
VFE_AGG_SIZE = 4                    # V12: 3 -> 4 (smooth gradient, all 3 days positive)
VFE_AGG_DISABLE_AT = 150            # raised in line with bigger soft cap

# V6: contrarian inventory size scaling.
# The reduce-inventory side scales UP with |pos| -- forces faster cycle completion.
# The extend-inventory side scales DOWN -- avoids piling onto a heavy position.
VFE_REDUCE_SIZE_GAIN = 0.10         # +1 unit per 10 |pos|
VFE_REDUCE_SIZE_CAP = 20            # max scaled-up size on the reduce side
VFE_EXTEND_SIZE_FLOOR = 2           # minimum size on the extending side
VFE_EXTEND_TAPER_AT = 30            # |pos| where extend side starts shrinking
VFE_EXTEND_TAPER_END = 120          # |pos| where extend side reaches the floor

# Voucher strategy: empirical premium MM + monotonicity arb.
# Approach: fair_voucher = max(VFE_mid - K, 0) + EMA(market_premium).
# Trade vouchers using V12-style queue-behind + AGG framework around this fair.

VOUCHER_PREMIUM_EMA_ALPHA = 0.02      # slow EMA -- premium is sticky per strike
VOUCHER_TAKER_EDGE = 4.0              # take if market price diverges from fair by this much
VOUCHER_QUOTE_SIZE = 5                # base passive quote size
VOUCHER_AGG_SIZE = 3                  # inside-spread AGG quote size
VOUCHER_AGG_IMB_THRESHOLD = 0.5       # like VFE V12: imbalance threshold for AGG
VOUCHER_SOFT_CAP = 100                # per-voucher position soft cap (limit is 300)
VOUCHER_SKEW_COEFF = 0.05             # linear inventory skew per voucher
VOUCHER_MIN_QUOTE_PRICE = 1           # don't place buy quotes below this
VOUCHER_MONO_ARB_EDGE = 3             # monotonicity arb: trigger if higher_bid - lower_ask > this

MAX_DEBUG_LOGS = 80
MAX_HISTORY = 120


# ---------------------------------------------------------------------------
# Book and state helpers
# ---------------------------------------------------------------------------

def get_best_bid_ask(order_depth: OrderDepth) -> Optional[Tuple[int, int, int, int]]:
    if not order_depth.buy_orders or not order_depth.sell_orders:
        return None
    best_bid = max(order_depth.buy_orders)
    best_ask = min(order_depth.sell_orders)
    bid_vol = order_depth.buy_orders[best_bid]
    ask_vol = -order_depth.sell_orders[best_ask]
    return best_bid, bid_vol, best_ask, ask_vol


def get_midprice(order_depth: OrderDepth) -> Optional[float]:
    bba = get_best_bid_ask(order_depth)
    if bba is None:
        return None
    best_bid, _bid_vol, best_ask, _ask_vol = bba
    return (best_bid + best_ask) / 2.0


def get_microprice(order_depth: OrderDepth) -> Optional[float]:
    bba = get_best_bid_ask(order_depth)
    if bba is None:
        return None
    best_bid, bid_vol, best_ask, ask_vol = bba
    total = bid_vol + ask_vol
    if total <= 0:
        return (best_bid + best_ask) / 2.0
    return (best_bid * ask_vol + best_ask * bid_vol) / total


def update_ema(
    product: str,
    value: float,
    alpha: float,
    ema_values: Optional[Dict[str, Optional[float]]] = None,
) -> float:
    store = ema_values if ema_values is not None else {}
    prev = store.get(product)
    fair = value if prev is None else alpha * value + (1.0 - alpha) * prev
    store[product] = fair
    return fair


def update_rolling_vol(
    product: str,
    price: float,
    history: Optional[Dict[str, List[float]]] = None,
    window: int = VFE_VOL_WINDOW,
) -> float:
    store = history if history is not None else {}
    values = store.setdefault(product, [])
    values.append(price)
    if len(values) > max(window, MAX_HISTORY):
        del values[: len(values) - max(window, MAX_HISTORY)]
    recent = values[-window:]
    if len(recent) < 3:
        return 0.0
    diffs = [recent[i] - recent[i - 1] for i in range(1, len(recent))]
    if len(diffs) < 2:
        return 0.0
    mean = sum(diffs) / len(diffs)
    var = sum((x - mean) ** 2 for x in diffs) / len(diffs)
    return math.sqrt(var)


def position_safe_buy_size(
    product: str,
    desired_size: int,
    position: int,
    limit: int,
    practical_cap: int,
) -> int:
    if desired_size <= 0:
        return 0
    cap = min(limit, practical_cap)
    if position >= cap:
        return 0
    room = min(limit - position, cap - position)
    scale = max(0.0, 1.0 - max(0, position) / max(1, cap))
    return max(0, min(desired_size, room, max(1, int(desired_size * scale))))


def position_safe_sell_size(
    product: str,
    desired_size: int,
    position: int,
    limit: int,
    practical_cap: int,
) -> int:
    if desired_size <= 0:
        return 0
    cap = min(limit, practical_cap)
    if position <= -cap:
        return 0
    room = min(limit + position, cap + position)
    scale = max(0.0, 1.0 - max(0, -position) / max(1, cap))
    return max(0, min(desired_size, room, max(1, int(desired_size * scale))))


def inventory_adjusted_fair(fair: float, position: int, penalty: float) -> float:
    return fair - penalty * position


def inventory_throttled_thresholds(
    base_threshold: float,
    spread: int,
    position: int,
    throttle_start: int,
) -> Tuple[float, float]:
    spread_buffer = HP_SPREAD_BUFFER_FRAC * spread
    excess = max(0, abs(position) - throttle_start)
    buy_threshold = base_threshold + spread_buffer
    sell_threshold = base_threshold + spread_buffer

    if position > 0:
        buy_threshold += excess * HP_EXTEND_EDGE_PENALTY
        sell_threshold = max(1.0, sell_threshold - excess * HP_REDUCE_EDGE_DISCOUNT)
    elif position < 0:
        sell_threshold += excess * HP_EXTEND_EDGE_PENALTY
        buy_threshold = max(1.0, buy_threshold - excess * HP_REDUCE_EDGE_DISCOUNT)

    return buy_threshold, sell_threshold


def order_book_imbalance(order_depth: OrderDepth) -> Optional[float]:
    bba = get_best_bid_ask(order_depth)
    if bba is None:
        return None
    _bid, bid_vol, _ask, ask_vol = bba
    total = bid_vol + ask_vol
    if total <= 0:
        return 0.0
    return (bid_vol - ask_vol) / total


def load_state(blob: str) -> Dict[str, Any]:
    default = {
        "ema": {},
        "history": {},
        "debug_logs": [],
        "vfe_stats": {},
        "day_index": 0,
        "last_ts": -1,
    }
    if not blob:
        return default
    try:
        loaded = json.loads(blob)
    except (TypeError, ValueError):
        return default
    if not isinstance(loaded, dict):
        return default
    default.update({k: loaded.get(k, default[k]) for k in default})
    if not isinstance(default["ema"], dict):
        default["ema"] = {}
    if not isinstance(default["history"], dict):
        default["history"] = {}
    if not isinstance(default["debug_logs"], list):
        default["debug_logs"] = []
    if not isinstance(default["vfe_stats"], dict):
        default["vfe_stats"] = {}
    return default


def save_state(state: Dict[str, Any]) -> str:
    state["debug_logs"] = state.get("debug_logs", [])[-MAX_DEBUG_LOGS:]
    return json.dumps(state, separators=(",", ":"))


def log_decision(
    state: Dict[str, Any],
    timestamp: int,
    product: str,
    fair: Optional[float],
    best_bid: Optional[int],
    best_ask: Optional[int],
    edge: Optional[float],
    position: int,
    order_size: int,
    reason: str,
) -> None:
    if not ENABLE_DEBUG_LOGS:
        return
    logs = state.setdefault("debug_logs", [])
    logs.append(
        {
            "ts": timestamp,
            "product": product,
            "fair": round(fair, 3) if fair is not None else None,
            "best_bid": best_bid,
            "best_ask": best_ask,
            "edge": round(edge, 3) if edge is not None else None,
            "position": position,
            "order_size": order_size,
            "reason": reason,
        }
    )
    if len(logs) > MAX_DEBUG_LOGS:
        del logs[: len(logs) - MAX_DEBUG_LOGS]


def update_day_counter(state: Dict[str, Any], timestamp: int) -> None:
    last_ts = state.get("last_ts", -1)
    if last_ts >= 0 and timestamp + 50_000 < last_ts:
        state["day_index"] = int(state.get("day_index", 0)) + 1
    state["last_ts"] = timestamp


# ---------------------------------------------------------------------------
# Strategy layers
# ---------------------------------------------------------------------------

def hp_orders(state: Dict[str, Any], trading_state: TradingState) -> List[Order]:
    depth = trading_state.order_depths.get(HP)
    if depth is None:
        return []
    bba = get_best_bid_ask(depth)
    observed = get_midprice(depth)
    if bba is None or observed is None:
        return []

    best_bid, _bid_vol, best_ask, _ask_vol = bba
    spread = max(0, best_ask - best_bid)
    fair = update_ema(HP, observed, HP_EMA_ALPHA, state["ema"])
    position = trading_state.position.get(HP, 0)
    adjusted = inventory_adjusted_fair(fair, position, HP_INVENTORY_PENALTY)
    buy_threshold, sell_threshold = inventory_throttled_thresholds(
        HP_TRADE_THRESHOLD,
        spread,
        position,
        HP_INVENTORY_THROTTLE_START,
    )

    orders: List[Order] = []
    buy_edge = adjusted - best_ask
    sell_edge = best_bid - adjusted

    if buy_edge > buy_threshold and position < 0.70 * POSITION_LIMITS[HP]:
        desired = HP_MAX_ORDER_SIZE
        if buy_edge >= HP_STRONG_EDGE:
            desired = min(2 * HP_MAX_ORDER_SIZE, 16)
        size = position_safe_buy_size(HP, desired, position, POSITION_LIMITS[HP], HP_PRACTICAL_CAP)
        log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, buy_edge, position, size, "HP_BUY_large_discount")
        if size > 0:
            orders.append(Order(HP, best_ask, size))
    elif sell_edge > sell_threshold and position > -0.70 * POSITION_LIMITS[HP]:
        desired = HP_MAX_ORDER_SIZE
        if sell_edge >= HP_STRONG_EDGE:
            desired = min(2 * HP_MAX_ORDER_SIZE, 16)
        size = position_safe_sell_size(HP, desired, position, POSITION_LIMITS[HP], HP_PRACTICAL_CAP)
        log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, sell_edge, position, -size, "HP_SELL_large_premium")
        if size > 0:
            orders.append(Order(HP, best_bid, -size))
    else:
        edge = buy_edge if buy_edge >= sell_edge else sell_edge
        log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, edge, position, 0, "HP_NO_TRADE_edge_or_inventory")

    return orders


def update_vfe_stats(state: Dict[str, Any], trading_state: TradingState) -> Optional[float]:
    """Microprice-EMA fair value for VFE. Always runs so vouchers/HP can read it."""
    depth = trading_state.order_depths.get(VFE)
    if depth is None:
        return None
    bba = get_best_bid_ask(depth)
    micro = get_microprice(depth)
    mid = get_midprice(depth)
    if bba is None or micro is None or mid is None:
        return None
    best_bid, _bid_vol, best_ask, _ask_vol = bba
    fair = update_ema(VFE, micro, VFE_EMA_ALPHA, state["ema"])
    vol = update_rolling_vol(VFE, mid, state["history"], VFE_VOL_WINDOW)
    imbalance = order_book_imbalance(depth)
    state["vfe_stats"] = {
        "mid": round(mid, 3),
        "micro": round(micro, 3),
        "ema_fair": round(fair, 3),
        "rolling_vol": round(vol, 5),
        "imbalance": round(imbalance, 5) if imbalance is not None else None,
    }
    return fair


def vfe_orders(state: Dict[str, Any], trading_state: TradingState, fair: float) -> List[Order]:
    """V6: V5 + contrarian inventory size scaling + cap raised to 200.

    V2 baseline preserved: no taker, queue-behind quotes, imbalance gate, linear skew.
    V5 layer preserved: inside-spread aggression on strong imbalance (threshold 0.5).

    V6 additions:
    - SOFT_CAP raised 100 -> 200 (full limit). Prior caps never bound; bigger room
      lets contrarian scaling push position further per cycle.
    - Contrarian size scaling on the top-of-book quotes:
        * "Reduce side" (the one that flattens inventory) scales up linearly with |pos|.
          Base 5, gain 0.10 -> at |pos|=50 size=10, |pos|=100 size=15, capped at 20.
        * "Extend side" tapers from base 5 down to floor 2 between |pos|=30..120.
      Rationale: PnL is driven by mean-reversion cycles. Scaling up on the reduce
      side accelerates each cycle's completion; tapering the extend side avoids
      piling onto a heavy position.
    """
    if not ENABLE_VFE:
        return []
    depth = trading_state.order_depths.get(VFE)
    bba = get_best_bid_ask(depth) if depth is not None else None
    if depth is None or bba is None:
        return []
    best_bid, bid_vol, best_ask, ask_vol = bba

    position = trading_state.position.get(VFE, 0)
    soft = VFE_SOFT_CAP
    abs_pos = abs(position)

    total_vol = bid_vol + ask_vol
    imb = (bid_vol - ask_vol) / total_vol if total_vol > 0 else 0.0

    skew = position * VFE_SKEW_COEFF

    can_buy = position < soft
    can_sell = position > -soft
    bid_ok = imb >= -VFE_IMBALANCE_GATE
    ask_ok = imb <= VFE_IMBALANCE_GATE

    # ---- Contrarian size scaling ----
    # When long (pos > 0): bid extends, ask reduces.
    # When short (pos < 0): ask extends, bid reduces.
    reduce_size = min(VFE_REDUCE_SIZE_CAP,
                      int(round(VFE_QUOTE_SIZE + VFE_REDUCE_SIZE_GAIN * abs_pos)))
    if abs_pos <= VFE_EXTEND_TAPER_AT:
        extend_size = VFE_QUOTE_SIZE
    elif abs_pos >= VFE_EXTEND_TAPER_END:
        extend_size = VFE_EXTEND_SIZE_FLOOR
    else:
        frac = (abs_pos - VFE_EXTEND_TAPER_AT) / float(VFE_EXTEND_TAPER_END - VFE_EXTEND_TAPER_AT)
        extend_size = int(round(VFE_QUOTE_SIZE - frac * (VFE_QUOTE_SIZE - VFE_EXTEND_SIZE_FLOOR)))
        extend_size = max(VFE_EXTEND_SIZE_FLOOR, extend_size)

    if position > 0:
        bid_size_base = extend_size   # buying extends a long
        ask_size_base = reduce_size   # selling reduces a long
    elif position < 0:
        bid_size_base = reduce_size   # buying reduces a short
        ask_size_base = extend_size   # selling extends a short
    else:
        bid_size_base = ask_size_base = VFE_QUOTE_SIZE

    orders: List[Order] = []
    spread = best_ask - best_bid

    # ---- Top-of-book passive quotes ----
    if can_buy and bid_ok:
        adj_bid = int(round(best_bid - max(0, skew)))
        adj_bid = min(adj_bid, best_ask - 1)
        room = soft - position
        size = min(bid_size_base, max(0, room))
        if size > 0:
            orders.append(Order(VFE, adj_bid, size))
            log_decision(state, trading_state.timestamp, VFE, fair, best_bid, best_ask, imb, position, size, "VFE_V6_BID_TOB")

    if can_sell and ask_ok:
        adj_ask = int(round(best_ask - min(0, skew)))
        adj_ask = max(adj_ask, best_bid + 1)
        room = soft + position
        size = min(ask_size_base, max(0, room))
        if size > 0:
            orders.append(Order(VFE, adj_ask, -size))
            log_decision(state, trading_state.timestamp, VFE, fair, best_bid, best_ask, imb, position, -size, "VFE_V6_ASK_TOB")

    # ---- Gated-aggression inside-spread layer ----
    if spread >= 2:
        if imb > VFE_AGG_IMBALANCE_THRESHOLD and position < VFE_AGG_DISABLE_AT and can_buy:
            agg_bid_px = best_bid + 1
            room = soft - position
            agg_size = min(VFE_AGG_SIZE, max(0, room))
            if agg_size > 0 and agg_bid_px < best_ask:
                orders.append(Order(VFE, agg_bid_px, agg_size))
                log_decision(state, trading_state.timestamp, VFE, fair, best_bid, best_ask, imb, position, agg_size, "VFE_V6_BID_AGG")

        if imb < -VFE_AGG_IMBALANCE_THRESHOLD and position > -VFE_AGG_DISABLE_AT and can_sell:
            agg_ask_px = best_ask - 1
            room = soft + position
            agg_size = min(VFE_AGG_SIZE, max(0, room))
            if agg_size > 0 and agg_ask_px > best_bid:
                orders.append(Order(VFE, agg_ask_px, -agg_size))
                log_decision(state, trading_state.timestamp, VFE, fair, best_bid, best_ask, imb, position, -agg_size, "VFE_V6_ASK_AGG")

    return orders


def option_model_fair(vfe_fair: float, strike: int, vol: float, tte_days: float) -> float:
    if not ENABLE_OPTION_MODEL:
        return max(vfe_fair - strike, 0.0)
    intrinsic = max(vfe_fair - strike, 0.0)
    return intrinsic + 0.5 * vol * math.sqrt(max(tte_days, 0.0))


def voucher_orders(state: Dict[str, Any], trading_state: TradingState, vfe_mid: Optional[float]) -> Dict[str, List[Order]]:
    """Voucher market making with empirical premium fair value.

    For each active voucher:
      intrinsic = max(VFE_mid - strike, 0)
      premium_ema = EMA(market_mid - intrinsic)  -- per strike, slow alpha
      fair = intrinsic + premium_ema

    Then market-make using V12-style logic:
      - Take aggressively if market price diverges from fair by VOUCHER_TAKER_EDGE
      - Quote passively at best_bid/best_ask (queue behind)
      - Inside-spread AGG when imbalance is strong
      - Linear inventory skew, soft cap
    """
    if not ENABLE_VOUCHERS or vfe_mid is None:
        return {}

    orders: Dict[str, List[Order]] = {}
    premiums = state.setdefault("voucher_premium_ema", {})
    fairs: Dict[str, float] = {}

    for product in ACTIVE_VOUCHERS:
        depth = trading_state.order_depths.get(product)
        bba = get_best_bid_ask(depth) if depth is not None else None
        if bba is None:
            continue
        best_bid, bid_vol, best_ask, ask_vol = bba
        market_mid = (best_bid + best_ask) / 2.0
        strike = VOUCHER_STRIKES[product]
        intrinsic = max(vfe_mid - strike, 0.0)
        observed_premium = market_mid - intrinsic

        # Update EMA premium for this strike
        prev = premiums.get(product)
        if prev is None:
            prem_ema = observed_premium
        else:
            prem_ema = VOUCHER_PREMIUM_EMA_ALPHA * observed_premium + (1 - VOUCHER_PREMIUM_EMA_ALPHA) * prev
        premiums[product] = prem_ema

        fair = intrinsic + prem_ema
        fairs[product] = fair

        position = trading_state.position.get(product, 0)
        limit = POSITION_LIMITS[product]
        soft = VOUCHER_SOFT_CAP

        total = bid_vol + ask_vol
        imb = (bid_vol - ask_vol) / total if total > 0 else 0.0
        skew = position * VOUCHER_SKEW_COEFF

        can_buy = position < soft
        can_sell = position > -soft

        product_orders: List[Order] = []
        spread = best_ask - best_bid

        # ---- Aggressive take if market is far from fair ----
        if best_ask < fair - VOUCHER_TAKER_EDGE and can_buy:
            size = min(VOUCHER_QUOTE_SIZE, ask_vol, max(0, soft - position))
            if size > 0:
                product_orders.append(Order(product, best_ask, size))
                log_decision(state, trading_state.timestamp, product, fair, best_bid, best_ask, fair - best_ask, position, size, "VEV_TAKE_BUY")
        elif best_bid > fair + VOUCHER_TAKER_EDGE and can_sell:
            size = min(VOUCHER_QUOTE_SIZE, bid_vol, max(0, soft + position))
            if size > 0:
                product_orders.append(Order(product, best_bid, -size))
                log_decision(state, trading_state.timestamp, product, fair, best_bid, best_ask, best_bid - fair, position, -size, "VEV_TAKE_SELL")

        # ---- Passive quotes at best bid/ask, queue behind ----
        else:
            if can_buy:
                bid_px = max(VOUCHER_MIN_QUOTE_PRICE, int(round(best_bid - max(0, skew))))
                bid_px = min(bid_px, best_ask - 1)
                size = min(VOUCHER_QUOTE_SIZE, max(0, soft - position))
                if size > 0 and bid_px >= VOUCHER_MIN_QUOTE_PRICE:
                    product_orders.append(Order(product, bid_px, size))
                    log_decision(state, trading_state.timestamp, product, fair, best_bid, best_ask, imb, position, size, "VEV_QUOTE_BID")
            if can_sell:
                ask_px = int(round(best_ask - min(0, skew)))
                ask_px = max(ask_px, best_bid + 1)
                size = min(VOUCHER_QUOTE_SIZE, max(0, soft + position))
                if size > 0:
                    product_orders.append(Order(product, ask_px, -size))
                    log_decision(state, trading_state.timestamp, product, fair, best_bid, best_ask, imb, position, -size, "VEV_QUOTE_ASK")

        # ---- Inside-spread AGG layer ----
        if spread >= 2:
            if imb > VOUCHER_AGG_IMB_THRESHOLD and can_buy:
                agg_px = best_bid + 1
                size = min(VOUCHER_AGG_SIZE, max(0, soft - position))
                if size > 0 and agg_px < best_ask:
                    product_orders.append(Order(product, agg_px, size))
                    log_decision(state, trading_state.timestamp, product, fair, best_bid, best_ask, imb, position, size, "VEV_AGG_BID")
            if imb < -VOUCHER_AGG_IMB_THRESHOLD and can_sell:
                agg_px = best_ask - 1
                size = min(VOUCHER_AGG_SIZE, max(0, soft + position))
                if size > 0 and agg_px > best_bid:
                    product_orders.append(Order(product, agg_px, -size))
                    log_decision(state, trading_state.timestamp, product, fair, best_bid, best_ask, imb, position, -size, "VEV_AGG_ASK")

        if product_orders:
            orders[product] = product_orders

    # ---- Cross-strike monotonicity arbitrage ----
    # Lower-strike call must be at least as expensive as higher-strike call.
    # If market shows higher_bid > lower_ask + VOUCHER_MONO_ARB_EDGE, free trade.
    quotes = []
    for product in ACTIVE_VOUCHERS:
        depth = trading_state.order_depths.get(product)
        bba = get_best_bid_ask(depth) if depth is not None else None
        if bba is None:
            continue
        best_bid, _bv, best_ask, _av = bba
        quotes.append((VOUCHER_STRIKES[product], product, best_bid, best_ask))
    quotes.sort()

    for lower, higher in zip(quotes, quotes[1:]):
        _ls, lp, lbid, lask = lower
        _hs, hp, hbid, hask = higher
        violation = hbid - lask
        if violation <= VOUCHER_MONO_ARB_EDGE:
            continue
        lpos = trading_state.position.get(lp, 0)
        hpos = trading_state.position.get(hp, 0)
        l_room = max(0, VOUCHER_SOFT_CAP - lpos)
        h_room = max(0, VOUCHER_SOFT_CAP + hpos)
        size = min(VOUCHER_QUOTE_SIZE, l_room, h_room)
        if size <= 0:
            continue
        orders.setdefault(lp, []).append(Order(lp, lask, size))
        orders.setdefault(hp, []).append(Order(hp, hbid, -size))
        log_decision(state, trading_state.timestamp, lp, None, lbid, lask, violation, lpos, size, "VEV_MONO_ARB_BUY")
        log_decision(state, trading_state.timestamp, hp, None, hbid, hask, violation, hpos, -size, "VEV_MONO_ARB_SELL")

    return orders


class Trader:
    def run(self, state: TradingState) -> Tuple[Dict[str, List[Order]], int, str]:
        persistent = load_state(state.traderData)
        update_day_counter(persistent, state.timestamp)
        tte_days = max(0.0, 5.0 - persistent.get("day_index", 0) - state.timestamp / 1_000_000.0)
        _ = tte_days  # Kept for later option-model experiments.

        result: Dict[str, List[Order]] = {}

        if ENABLE_HP:
            orders = hp_orders(persistent, state)
            if orders:
                result[HP] = orders

        vfe_fair = update_vfe_stats(persistent, state)
        vfe_order_list = vfe_orders(persistent, state, vfe_fair) if vfe_fair is not None else []
        if vfe_order_list:
            result[VFE] = vfe_order_list

        # Voucher MM uses VFE mid (not EMA fair) for intrinsic value -- avoids EMA lag.
        vfe_depth = state.order_depths.get(VFE)
        vfe_mid = get_midprice(vfe_depth) if vfe_depth is not None else None
        vev_orders = voucher_orders(persistent, state, vfe_mid)
        for product, plist in vev_orders.items():
            if plist:
                result.setdefault(product, []).extend(plist)

        # PID and absolute option pricing intentionally remain disabled until
        # the HP-only baseline is profitable and stable.
        if ENABLE_PID:
            log_decision(persistent, state.timestamp, "PID", None, None, None, None, 0, 0, "PID_DISABLED_PLACEHOLDER")

        return result, 0, save_state(persistent)
