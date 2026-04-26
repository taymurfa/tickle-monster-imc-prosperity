"""
IMC Prosperity Round 3 strategy scaffold.

Current mode: HP-only predictive mean-reversion.

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

ENABLE_HP = True
ENABLE_VFE = False
ENABLE_VOUCHERS = False
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
ACTIVE_VOUCHERS: List[str] = ["VEV_5500"]


# ---------------------------------------------------------------------------
# Tunable parameters
# ---------------------------------------------------------------------------

HP_EMA_ALPHA = 0.03
HP_FAST_EMA_ALPHA = 0.14
HP_RETURN_EMA_ALPHA = 0.22
HP_TRADE_THRESHOLD = 5.0
HP_SPREAD_BUFFER_FRAC = 0.40
HP_INVENTORY_PENALTY = 0.02
HP_MAX_ORDER_SIZE = 12
HP_PRACTICAL_CAP = 160
HP_STRONG_EDGE = 10.0
HP_INVENTORY_THROTTLE_START = 100
HP_EXTEND_EDGE_PENALTY = 0.04
HP_REDUCE_EDGE_DISCOUNT = 0.03
HP_FAST_REVERSION_WEIGHT = 0.10
HP_RETURN_WEIGHT = 0.25
HP_MICROPRICE_WEIGHT = 0.15
HP_IMBALANCE_WEIGHT = 0.08
HP_PREDICTION_CLAMP = 4.0
HP_RESID_WINDOW = 80
HP_MIN_RESID_STD = 1.0
HP_ENTRY_Z = 1.75
HP_STRONG_Z = 2.35
HP_BOLLINGER_MULT = 1.75
HP_MOMENTUM_BLOCK = 0.35
HP_EXIT_Z = 0.35
HP_EXIT_ORDER_SIZE = 8
HP_MARKET_SIGNAL_ENABLED = True
HP_SIGNAL_QTY = 5
HP_SIGNAL_EXTREME_TOL = 1.0
HP_SIGNAL_MAX_AGE = 55
HP_SIGNAL_ENTRY_Z = 0.0
HP_SIGNAL_EDGE = 0.5
HP_SIGNAL_ORDER_SIZE = 4
HP_SIGNAL_ONLY = True
HP_SIGNAL_CLUSTER_MIN = 2
HP_ENABLE_BEARISH_SIGNAL = False
HP_PASSIVE_SIGNAL_ORDERS = True
HP_PASSIVE_JOIN_OFFSET = 1
HP_PASSIVE_MAX_NEGATIVE_EDGE = -2.0
HP_PASSIVE_ORDER_SIZE = 6
HP_SIGNAL_CROSS_MAX_AGE = 3
HP_SIGNAL_CROSS_MIN_EDGE = -1.0
HP_SIGNAL_CROSS_ORDER_SIZE = 3
HP_BAD_BUY_QTYS = (3, 4)
HP_BAD_CLUSTER_MIN = 2
HP_BAD_CLUSTER_MAX_AGE = 35
HP_SIGNAL_MAX_RICH_Z = 0.75
HP_SIGNAL_MIN_CHEAP_Z = -1.25

VFE_EMA_ALPHA = 0.03
VFE_VOL_WINDOW = 80
VFE_TRADE_THRESHOLD = 8.0
VFE_INVENTORY_PENALTY = 0.02
VFE_MAX_ORDER_SIZE = 5
VFE_PRACTICAL_CAP = 140

VOUCHER_MAX_ORDER_SIZE = 5
VOUCHER_PRACTICAL_CAP = 80
VOUCHER_RELATIVE_EDGE = 8.0
VOUCHER_MIN_PRICE = 2

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


def update_rolling_std(
    product: str,
    value: float,
    history: Optional[Dict[str, List[float]]] = None,
    window: int = HP_RESID_WINDOW,
) -> float:
    store = history if history is not None else {}
    values = store.setdefault(product, [])
    values.append(value)
    if len(values) > max(window, MAX_HISTORY):
        del values[: len(values) - max(window, MAX_HISTORY)]
    recent = values[-window:]
    if len(recent) < 3:
        return 0.0
    mean = sum(recent) / len(recent)
    var = sum((x - mean) ** 2 for x in recent) / len(recent)
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


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def hp_prediction_fair(
    state: Dict[str, Any],
    observed_mid: float,
    micro: Optional[float],
    imbalance: Optional[float],
    spread: int,
) -> Tuple[float, Dict[str, float]]:
    slow_fair = update_ema(HP, observed_mid, HP_EMA_ALPHA, state["ema"])
    fast_fair = update_ema(f"{HP}_FAST", observed_mid, HP_FAST_EMA_ALPHA, state["ema"])

    prev_mid = state.setdefault("last_mid", {}).get(HP)
    raw_return = 0.0 if prev_mid is None else observed_mid - float(prev_mid)
    state["last_mid"][HP] = observed_mid
    return_ema = update_ema(f"{HP}_RETURN", raw_return, HP_RETURN_EMA_ALPHA, state["ema"])

    fast_gap = fast_fair - slow_fair
    micro_gap = 0.0 if micro is None else micro - observed_mid
    imbalance_gap = 0.0 if imbalance is None else imbalance * max(1, spread)

    predicted_move = (
        HP_FAST_REVERSION_WEIGHT * fast_gap
        + HP_RETURN_WEIGHT * return_ema
        + HP_MICROPRICE_WEIGHT * micro_gap
        + HP_IMBALANCE_WEIGHT * imbalance_gap
    )
    predicted_move = clamp(predicted_move, -HP_PREDICTION_CLAMP, HP_PREDICTION_CLAMP)
    predicted_fair = slow_fair + predicted_move
    stats = {
        "slow_fair": slow_fair,
        "fast_fair": fast_fair,
        "return_ema": return_ema,
        "micro_gap": micro_gap,
        "imbalance": 0.0 if imbalance is None else imbalance,
        "predicted_move": predicted_move,
        "predicted_fair": predicted_fair,
    }
    state["hp_prediction"] = {key: round(value, 4) for key, value in stats.items()}
    return predicted_fair, stats


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
        "last_mid": {},
        "debug_logs": [],
        "vfe_stats": {},
        "hp_prediction": {},
        "hp_market_signal": {},
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
    if not isinstance(default["last_mid"], dict):
        default["last_mid"] = {}
    if not isinstance(default["debug_logs"], list):
        default["debug_logs"] = []
    if not isinstance(default["vfe_stats"], dict):
        default["vfe_stats"] = {}
    if not isinstance(default["hp_prediction"], dict):
        default["hp_prediction"] = {}
    if not isinstance(default["hp_market_signal"], dict):
        default["hp_market_signal"] = {}
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

def hp_trade_direction(price: float, best_bid: int, best_ask: int) -> str:
    if price >= best_ask:
        return "BUY"
    if price <= best_bid:
        return "SELL"
    return "MID"


def update_hp_market_signal(
    state: Dict[str, Any],
    trading_state: TradingState,
    observed_mid: float,
    best_bid: int,
    best_ask: int,
) -> Dict[str, Any]:
    signal = state.setdefault("hp_market_signal", {})
    day = int(state.get("day_index", 0))
    if signal.get("day") != day:
        signal.clear()
        signal["day"] = day
        signal["low"] = observed_mid
        signal["high"] = observed_mid
        signal["active"] = 0
        signal["age"] = HP_SIGNAL_MAX_AGE + 1

    low = float(signal.get("low", observed_mid))
    high = float(signal.get("high", observed_mid))
    active = int(signal.get("active", 0))
    age = int(signal.get("age", HP_SIGNAL_MAX_AGE + 1)) + 1
    anchor = signal.get("anchor")

    if active > 0 and anchor is not None and observed_mid < float(anchor) - HP_SIGNAL_EXTREME_TOL:
        active = 0
    elif active < 0 and anchor is not None and observed_mid > float(anchor) + HP_SIGNAL_EXTREME_TOL:
        active = 0
    if age > HP_SIGNAL_MAX_AGE:
        active = 0

    prev_mid = signal.get("last_mid")
    ref_bid = int(signal.get("last_bid", best_bid))
    ref_ask = int(signal.get("last_ask", best_ask))
    bull_cluster = max(0, int(signal.get("bull_cluster", 0)) - 1)
    bear_cluster = max(0, int(signal.get("bear_cluster", 0)) - 1)
    bad_buy_cluster = max(0, int(signal.get("bad_buy_cluster", 0)) - 1)
    bad_buy_age = int(signal.get("bad_buy_age", HP_BAD_CLUSTER_MAX_AGE + 1)) + 1
    market_trades = trading_state.market_trades.get(HP, []) if trading_state.market_trades else []
    trade_key = "|".join(
        f"{getattr(t, 'timestamp', trading_state.timestamp)}:{getattr(t, 'price', 0)}:{getattr(t, 'quantity', 0)}"
        for t in market_trades
    )
    if market_trades and trade_key != signal.get("last_trade_key"):
        near_low = prev_mid is not None and float(prev_mid) <= low + HP_SIGNAL_EXTREME_TOL
        near_high = prev_mid is not None and float(prev_mid) >= high - HP_SIGNAL_EXTREME_TOL
        qty5_buys = 0
        qty5_sells = 0
        bad_buys = 0
        for trade in market_trades:
            qty = abs(int(getattr(trade, "quantity", 0) or 0))
            price = float(getattr(trade, "price", 0) or 0)
            direction = hp_trade_direction(price, ref_bid, ref_ask)
            if qty == HP_SIGNAL_QTY:
                if direction == "BUY":
                    qty5_buys += 1
                elif direction == "SELL":
                    qty5_sells += 1
            elif qty in HP_BAD_BUY_QTYS and direction == "BUY":
                bad_buys += 1

        # Olivia-style fingerprint: same-sized public trade at a daily extreme,
        # with direction matching the expected informed behavior.
        if qty5_buys >= 1 and near_low:
            active = 1
            age = 0
            anchor = float(prev_mid)
        elif HP_ENABLE_BEARISH_SIGNAL and qty5_sells >= 1 and near_high:
            active = -1
            age = 0
            anchor = float(prev_mid)

        # A small cluster of the same quantity is also useful in our HP data.
        bull_cluster += qty5_buys
        bear_cluster += qty5_sells
        bad_buy_cluster += bad_buys
        if bad_buy_cluster >= HP_BAD_CLUSTER_MIN:
            bad_buy_age = 0
            if active > 0:
                active = 0
        if bull_cluster >= HP_SIGNAL_CLUSTER_MIN and active >= 0:
            active = 1
            age = 0
            anchor = float(prev_mid if prev_mid is not None else observed_mid)
        elif HP_ENABLE_BEARISH_SIGNAL and bear_cluster >= HP_SIGNAL_CLUSTER_MIN and active <= 0:
            active = -1
            age = 0
            anchor = float(prev_mid if prev_mid is not None else observed_mid)
        signal["bull_cluster"] = bull_cluster
        signal["bear_cluster"] = bear_cluster
        signal["bad_buy_cluster"] = bad_buy_cluster
        signal["bad_buy_age"] = bad_buy_age
        signal["last_trade_key"] = trade_key

    low = min(low, observed_mid)
    high = max(high, observed_mid)
    signal.update({
        "day": day,
        "low": round(low, 4),
        "high": round(high, 4),
        "last_mid": round(observed_mid, 4),
        "last_bid": best_bid,
        "last_ask": best_ask,
        "active": active,
        "age": age,
        "anchor": anchor,
        "bull_cluster": bull_cluster,
        "bear_cluster": bear_cluster,
        "bad_buy_cluster": bad_buy_cluster,
        "bad_buy_age": bad_buy_age,
    })
    return signal


def hp_signal_skip_reason(
    side: str,
    signal_active: int,
    signal_age: int,
    edge: float,
    position: int,
) -> str:
    return (
        f"HP_SIGNAL_SKIP_{side}"
        f"_flow={signal_active}"
        f"_age={signal_age}"
        f"_edge={edge:.2f}"
        f"_pos={position}"
    )


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
    micro = get_microprice(depth)
    imbalance = order_book_imbalance(depth)
    fair, prediction = hp_prediction_fair(state, observed, micro, imbalance, spread)
    position = trading_state.position.get(HP, 0)
    adjusted = inventory_adjusted_fair(fair, position, HP_INVENTORY_PENALTY)
    residual = observed - adjusted
    rolling_std = max(
        HP_MIN_RESID_STD,
        update_rolling_std(f"{HP}_RESID", residual, state["history"], HP_RESID_WINDOW),
    )
    buy_threshold, sell_threshold = inventory_throttled_thresholds(
        HP_TRADE_THRESHOLD,
        spread,
        position,
        HP_INVENTORY_THROTTLE_START,
    )

    orders: List[Order] = []
    buy_edge = adjusted - best_ask
    sell_edge = best_bid - adjusted
    buy_z = (best_ask - adjusted) / rolling_std
    sell_z = (best_bid - adjusted) / rolling_std
    lower_band = adjusted - HP_BOLLINGER_MULT * rolling_std
    upper_band = adjusted + HP_BOLLINGER_MULT * rolling_std
    return_ema = prediction["return_ema"]
    buy_momentum_ok = return_ema >= -HP_MOMENTUM_BLOCK
    sell_momentum_ok = return_ema <= HP_MOMENTUM_BLOCK
    market_signal = update_hp_market_signal(state, trading_state, observed, best_bid, best_ask) if HP_MARKET_SIGNAL_ENABLED else {}
    signal_active = int(market_signal.get("active", 0) or 0)
    signal_age = int(market_signal.get("age", HP_SIGNAL_MAX_AGE + 1) or 0)
    bad_buy_age = int(market_signal.get("bad_buy_age", HP_BAD_CLUSTER_MAX_AGE + 1) or 0)
    bullish_flow = signal_active > 0 and signal_age <= HP_SIGNAL_MAX_AGE
    bearish_flow = signal_active < 0 and signal_age <= HP_SIGNAL_MAX_AGE
    bad_buy_active = bad_buy_age <= HP_BAD_CLUSTER_MAX_AGE
    mean_reversion_ok = buy_z <= HP_SIGNAL_MAX_RICH_Z
    mean_reversion_good = buy_z <= HP_SIGNAL_MIN_CHEAP_Z
    signal_label = f"flow={signal_active}_age={signal_age}_bad_buy_age={bad_buy_age}"
    long_exit = position > 0 and (sell_z >= -HP_EXIT_Z or (bearish_flow and sell_edge > -HP_SIGNAL_EDGE))
    short_exit = position < 0 and (buy_z <= HP_EXIT_Z or (bullish_flow and buy_edge > -HP_SIGNAL_EDGE))

    if long_exit:
        desired = min(HP_EXIT_ORDER_SIZE, position)
        size = position_safe_sell_size(HP, desired, position, POSITION_LIMITS[HP], HP_PRACTICAL_CAP)
        size = min(size, position)
        reason = f"HP_EXIT_LONG_resid_z={sell_z:.2f}_std={rolling_std:.2f}_{signal_label}_ret_ema={return_ema:.2f}_pred_move={prediction['predicted_move']:.2f}"
        log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, sell_edge, position, -size, reason)
        if size > 0:
            orders.append(Order(HP, best_bid, -size))
    elif short_exit:
        desired = min(HP_EXIT_ORDER_SIZE, -position)
        size = position_safe_buy_size(HP, desired, position, POSITION_LIMITS[HP], HP_PRACTICAL_CAP)
        size = min(size, -position)
        reason = f"HP_EXIT_SHORT_resid_z={buy_z:.2f}_std={rolling_std:.2f}_{signal_label}_ret_ema={return_ema:.2f}_pred_move={prediction['predicted_move']:.2f}"
        log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, buy_edge, position, size, reason)
        if size > 0:
            orders.append(Order(HP, best_ask, size))
    elif HP_PASSIVE_SIGNAL_ORDERS and bullish_flow and not bad_buy_active and mean_reversion_ok and position < 0.60 * POSITION_LIMITS[HP]:
        passive_price = min(best_ask - 1, best_bid + HP_PASSIVE_JOIN_OFFSET)
        passive_edge = adjusted - passive_price
        should_cross = signal_age <= HP_SIGNAL_CROSS_MAX_AGE and mean_reversion_good and buy_edge >= HP_SIGNAL_CROSS_MIN_EDGE
        order_price = best_ask if should_cross else int(passive_price)
        order_edge = buy_edge if should_cross else passive_edge
        desired = HP_SIGNAL_CROSS_ORDER_SIZE if should_cross else HP_PASSIVE_ORDER_SIZE
        size = position_safe_buy_size(HP, desired, position, POSITION_LIMITS[HP], HP_PRACTICAL_CAP)
        if order_edge >= HP_PASSIVE_MAX_NEGATIVE_EDGE and size > 0:
            mode = "cross" if should_cross else "inside"
            reason = f"HP_BUY_{mode}_signal_resid_z={buy_z:.2f}_std={rolling_std:.2f}_{signal_label}_edge={order_edge:.2f}_ret_ema={return_ema:.2f}"
            log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, order_edge, position, size, reason)
            orders.append(Order(HP, int(order_price), size))
        else:
            reason = hp_signal_skip_reason("BUY", signal_active, signal_age, order_edge, position)
            log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, order_edge, position, 0, reason)
    elif bullish_flow and not bad_buy_active and mean_reversion_ok and buy_edge > HP_SIGNAL_EDGE and position < 0.60 * POSITION_LIMITS[HP]:
        desired = HP_SIGNAL_ORDER_SIZE
        size = position_safe_buy_size(HP, desired, position, POSITION_LIMITS[HP], HP_PRACTICAL_CAP)
        reason = f"HP_BUY_signal_only_resid_z={buy_z:.2f}_std={rolling_std:.2f}_{signal_label}_edge={buy_edge:.2f}_ret_ema={return_ema:.2f}"
        log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, buy_edge, position, size, reason)
        if size > 0:
            orders.append(Order(HP, best_ask, size))
    elif HP_PASSIVE_SIGNAL_ORDERS and HP_ENABLE_BEARISH_SIGNAL and bearish_flow and position > -0.60 * POSITION_LIMITS[HP]:
        passive_price = max(best_bid + 1, best_ask - HP_PASSIVE_JOIN_OFFSET)
        passive_edge = passive_price - adjusted
        desired = HP_PASSIVE_ORDER_SIZE
        size = position_safe_sell_size(HP, desired, position, POSITION_LIMITS[HP], HP_PRACTICAL_CAP)
        if passive_edge >= HP_PASSIVE_MAX_NEGATIVE_EDGE and size > 0:
            reason = f"HP_SELL_passive_signal_resid_z={sell_z:.2f}_std={rolling_std:.2f}_{signal_label}_edge={passive_edge:.2f}_ret_ema={return_ema:.2f}"
            log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, passive_edge, position, -size, reason)
            orders.append(Order(HP, int(passive_price), -size))
        else:
            reason = hp_signal_skip_reason("SELL", signal_active, signal_age, passive_edge, position)
            log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, passive_edge, position, 0, reason)
    elif HP_ENABLE_BEARISH_SIGNAL and bearish_flow and sell_edge > HP_SIGNAL_EDGE and position > -0.60 * POSITION_LIMITS[HP]:
        desired = HP_SIGNAL_ORDER_SIZE
        size = position_safe_sell_size(HP, desired, position, POSITION_LIMITS[HP], HP_PRACTICAL_CAP)
        reason = f"HP_SELL_signal_only_resid_z={sell_z:.2f}_std={rolling_std:.2f}_{signal_label}_edge={sell_edge:.2f}_ret_ema={return_ema:.2f}"
        log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, sell_edge, position, -size, reason)
        if size > 0:
            orders.append(Order(HP, best_bid, -size))
    elif not HP_SIGNAL_ONLY and best_ask < lower_band and buy_z <= -HP_ENTRY_Z and buy_momentum_ok and buy_edge > buy_threshold and position < 0.70 * POSITION_LIMITS[HP]:
        desired = HP_MAX_ORDER_SIZE
        if buy_edge >= HP_STRONG_EDGE or buy_z <= -HP_STRONG_Z:
            desired = min(2 * HP_MAX_ORDER_SIZE, 24)
        size = position_safe_buy_size(HP, desired, position, POSITION_LIMITS[HP], HP_PRACTICAL_CAP)
        reason = f"HP_BUY_resid_z={buy_z:.2f}_std={rolling_std:.2f}_{signal_label}_ret_ema={return_ema:.2f}_pred_move={prediction['predicted_move']:.2f}"
        log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, buy_edge, position, size, reason)
        if size > 0:
            orders.append(Order(HP, best_ask, size))
    elif not HP_SIGNAL_ONLY and best_bid > upper_band and sell_z >= HP_ENTRY_Z and sell_momentum_ok and sell_edge > sell_threshold and position > -0.70 * POSITION_LIMITS[HP]:
        desired = HP_MAX_ORDER_SIZE
        if sell_edge >= HP_STRONG_EDGE or sell_z >= HP_STRONG_Z:
            desired = min(2 * HP_MAX_ORDER_SIZE, 24)
        size = position_safe_sell_size(HP, desired, position, POSITION_LIMITS[HP], HP_PRACTICAL_CAP)
        reason = f"HP_SELL_resid_z={sell_z:.2f}_std={rolling_std:.2f}_{signal_label}_ret_ema={return_ema:.2f}_pred_move={prediction['predicted_move']:.2f}"
        log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, sell_edge, position, -size, reason)
        if size > 0:
            orders.append(Order(HP, best_bid, -size))
    else:
        edge = buy_edge if buy_edge >= sell_edge else sell_edge
        z = buy_z if buy_edge >= sell_edge else sell_z
        reason = f"HP_NO_TRADE_resid_z={z:.2f}_std={rolling_std:.2f}_{signal_label}_ret_ema={return_ema:.2f}_pred_move={prediction['predicted_move']:.2f}"
        log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, edge, position, 0, reason)

    return orders


def update_vfe_stats(state: Dict[str, Any], trading_state: TradingState) -> Optional[float]:
    depth = trading_state.order_depths.get(VFE)
    if depth is None:
        return None
    bba = get_best_bid_ask(depth)
    mid = get_midprice(depth)
    if bba is None or mid is None:
        return None
    best_bid, _bid_vol, best_ask, _ask_vol = bba
    fair = update_ema(VFE, mid, VFE_EMA_ALPHA, state["ema"])
    vol = update_rolling_vol(VFE, mid, state["history"], VFE_VOL_WINDOW)
    imbalance = order_book_imbalance(depth)
    state["vfe_stats"] = {
        "mid": round(mid, 3),
        "ema_fair": round(fair, 3),
        "rolling_vol": round(vol, 5),
        "imbalance": round(imbalance, 5) if imbalance is not None else None,
    }
    log_decision(
        state,
        trading_state.timestamp,
        VFE,
        fair,
        best_bid,
        best_ask,
        None,
        trading_state.position.get(VFE, 0),
        0,
        "VFE_STATS_ONLY",
    )
    return fair


def conservative_vfe_orders(state: Dict[str, Any], trading_state: TradingState, fair: float) -> List[Order]:
    if not ENABLE_VFE:
        return []
    depth = trading_state.order_depths.get(VFE)
    bba = get_best_bid_ask(depth) if depth is not None else None
    if depth is None or bba is None:
        return []
    best_bid, _bid_vol, best_ask, _ask_vol = bba
    position = trading_state.position.get(VFE, 0)
    adjusted = inventory_adjusted_fair(fair, position, VFE_INVENTORY_PENALTY)
    spread = max(0, best_ask - best_bid)
    threshold = VFE_TRADE_THRESHOLD + 0.5 * spread
    buy_edge = adjusted - best_ask
    sell_edge = best_bid - adjusted
    if buy_edge > threshold and position <= 0:
        size = position_safe_buy_size(VFE, VFE_MAX_ORDER_SIZE, position, POSITION_LIMITS[VFE], VFE_PRACTICAL_CAP)
        log_decision(state, trading_state.timestamp, VFE, adjusted, best_bid, best_ask, buy_edge, position, size, "VFE_BUY_conservative")
        return [Order(VFE, best_ask, size)] if size > 0 else []
    if sell_edge > threshold and position >= 0:
        size = position_safe_sell_size(VFE, VFE_MAX_ORDER_SIZE, position, POSITION_LIMITS[VFE], VFE_PRACTICAL_CAP)
        log_decision(state, trading_state.timestamp, VFE, adjusted, best_bid, best_ask, sell_edge, position, -size, "VFE_SELL_conservative")
        return [Order(VFE, best_bid, -size)] if size > 0 else []
    return []


def option_model_fair(vfe_fair: float, strike: int, vol: float, tte_days: float) -> float:
    if not ENABLE_OPTION_MODEL:
        return max(vfe_fair - strike, 0.0)
    intrinsic = max(vfe_fair - strike, 0.0)
    return intrinsic + 0.5 * vol * math.sqrt(max(tte_days, 0.0))


def voucher_relative_value_orders(state: Dict[str, Any], trading_state: TradingState, vfe_fair: Optional[float]) -> Dict[str, List[Order]]:
    if not ENABLE_VOUCHERS or not ENABLE_RELATIVE_VALUE or vfe_fair is None:
        return {}

    # Disabled by default. When enabled, this only handles obvious monotonicity
    # violations between adjacent listed calls with a large safety margin.
    quotes = []
    for product in ACTIVE_VOUCHERS:
        depth = trading_state.order_depths.get(product)
        bba = get_best_bid_ask(depth) if depth is not None else None
        if bba is None:
            continue
        best_bid, _bid_vol, best_ask, _ask_vol = bba
        mid = (best_bid + best_ask) / 2.0
        quotes.append((VOUCHER_STRIKES[product], product, best_bid, best_ask, mid))
    quotes.sort()

    orders: Dict[str, List[Order]] = {}
    for lower, higher in zip(quotes, quotes[1:]):
        lower_strike, lower_product, lower_bid, lower_ask, lower_mid = lower
        higher_strike, higher_product, higher_bid, higher_ask, higher_mid = higher
        near_atm = abs(lower_strike - vfe_fair) < 600 or abs(higher_strike - vfe_fair) < 600
        violation = higher_bid - lower_ask
        if not near_atm or violation <= VOUCHER_RELATIVE_EDGE or lower_ask < VOUCHER_MIN_PRICE:
            continue
        lower_pos = trading_state.position.get(lower_product, 0)
        higher_pos = trading_state.position.get(higher_product, 0)
        buy_size = position_safe_buy_size(lower_product, VOUCHER_MAX_ORDER_SIZE, lower_pos, POSITION_LIMITS[lower_product], VOUCHER_PRACTICAL_CAP)
        sell_size = position_safe_sell_size(higher_product, VOUCHER_MAX_ORDER_SIZE, higher_pos, POSITION_LIMITS[higher_product], VOUCHER_PRACTICAL_CAP)
        size = min(buy_size, sell_size)
        if size <= 0:
            continue
        orders.setdefault(lower_product, []).append(Order(lower_product, lower_ask, size))
        orders.setdefault(higher_product, []).append(Order(higher_product, higher_bid, -size))
        log_decision(state, trading_state.timestamp, lower_product, lower_mid, lower_bid, lower_ask, violation, lower_pos, size, "VOUCHER_BUY_monotonicity")
        log_decision(state, trading_state.timestamp, higher_product, higher_mid, higher_bid, higher_ask, violation, higher_pos, -size, "VOUCHER_SELL_monotonicity")
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
        vfe_orders = conservative_vfe_orders(persistent, state, vfe_fair) if vfe_fair is not None else []
        if vfe_orders:
            result[VFE] = vfe_orders

        voucher_orders = voucher_relative_value_orders(persistent, state, vfe_fair)
        for product, orders in voucher_orders.items():
            if orders:
                result.setdefault(product, []).extend(orders)

        # PID and absolute option pricing intentionally remain disabled until
        # the HP-only baseline is profitable and stable.
        if ENABLE_PID:
            log_decision(persistent, state.timestamp, "PID", None, None, None, None, 0, 0, "PID_DISABLED_PLACEHOLDER")

        return result, 0, save_state(persistent)
