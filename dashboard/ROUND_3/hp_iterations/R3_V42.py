"""
IMC Prosperity Round 3 locked HP strategy.

Current mode: HP-only confidence-scaled mean reversion with selective re-entry
and protected late-day cleanup.

Strategy layers:
1. Estimate HP fair value from EMA/microprice/short-term return.
2. Buy HP only when residual z-score, edge, and market-presence confidence agree.
3. After one profitable cycle, allow small flat re-entry probes on later cheap setups.
4. Sell only through protected exits, so normal exits do not realize a loss.
5. Near the end of a session, flatten leftover long inventory only if the no-loss
   guard still allows the sale.

VFE, vouchers, PID, and absolute option pricing are intentionally not traded in
this locked HP version.
"""

import json
import math
from typing import Any, Dict, List, Optional, Tuple

try:
    from datamodel import Order, OrderDepth, TradingState
except ImportError:
    from prosperity4bt.datamodel import Order, OrderDepth, TradingState


# ---------------------------------------------------------------------------
# Feature toggles. V42 is intentionally HP-only; non-HP layers remain disabled.
# ---------------------------------------------------------------------------

ENABLE_HP = True
ENABLE_DEBUG_LOGS = True


# ---------------------------------------------------------------------------
# Product config
# ---------------------------------------------------------------------------

HP = "HYDROGEL_PACK"

POSITION_LIMITS: Dict[str, int] = {
    HP: 200,
}


# ---------------------------------------------------------------------------
# Tunable parameters
# ---------------------------------------------------------------------------

# Fair-value model and residual normalization.
HP_EMA_ALPHA = 0.03
HP_FAST_EMA_ALPHA = 0.14
HP_RETURN_EMA_ALPHA = 0.22
HP_TRADE_THRESHOLD = 4.5
HP_SPREAD_BUFFER_FRAC = 0.40
HP_INVENTORY_PENALTY = 0.02
HP_MAX_ORDER_SIZE = 8
HP_PRACTICAL_CAP = 160
HP_STRONG_EDGE = 12.0
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

# Core entry and exit thresholds. `HP_EXIT_Z` is intentionally negative:
# exits wait for a clearer over-fair move instead of selling immediately at fair.
HP_ENTRY_Z = 1.50
HP_STRONG_Z = 2.00
HP_BOLLINGER_MULT = 1.30
HP_MOMENTUM_BLOCK = 0.20
HP_EXIT_Z = -1.50
HP_EXIT_ORDER_SIZE = 4

# Market-trade fingerprint inputs. These create confidence; they do not blindly
# trigger trades on every visible market print.
HP_MARKET_SIGNAL_ENABLED = True
HP_SIGNAL_QTY = 5
HP_SIGNAL_EXTREME_TOL = 1.0
HP_SIGNAL_MAX_AGE = 90
HP_SIGNAL_ENTRY_Z = 0.0
HP_SIGNAL_EDGE = 0.5
HP_SIGNAL_ORDER_SIZE = 4
HP_SIGNAL_ONLY = False
HP_SIGNAL_CLUSTER_MIN = 2
HP_ENABLE_BEARISH_SIGNAL = False
HP_PASSIVE_SIGNAL_ORDERS = False
HP_PASSIVE_JOIN_OFFSET = 2
HP_PASSIVE_MAX_NEGATIVE_EDGE = -3.0
HP_PASSIVE_ORDER_SIZE = 8
HP_SIGNAL_CROSS_MAX_AGE = 8
HP_SIGNAL_CROSS_MIN_EDGE = -2.0
HP_SIGNAL_CROSS_ORDER_SIZE = 4
HP_BAD_BUY_QTYS = (3, 4)
HP_BAD_CLUSTER_MIN = 3
HP_BAD_CLUSTER_MAX_AGE = 12
HP_SIGNAL_MAX_RICH_Z = 0.50
HP_SIGNAL_MIN_CHEAP_Z = 0.00
HP_BULLISH_EXIT_OVERRIDE_MAX_POS = 160
HP_BULLISH_EXIT_OVERRIDE_MAX_Z = 3.50
HP_LONG_ADD_CAP = 160
HP_LONG_REDUCE_SIZE = 4
HP_DOWNTICK_QTYS = (3, 4, 5)
HP_DOWNTICK_CLUSTER_MIN = 2
HP_DOWNTICK_MAX_AGE = 45
HP_DOWNTICK_MIN_Z = 0.50
HP_SECONDARY_BUY_QTY = 6
HP_COMBO_MAX_AGE = 45
HP_CAPITULATION_SELL_CLUSTER_MIN = 2
HP_CAPITULATION_MAX_AGE = 45
HP_CAPITULATION_CHEAP_Z = -1.0

# Core long-entry sizing.
HP_COPY_TRADE_MODE = True
HP_COPY_LONG_CAP = 160
HP_COPY_ORDER_SIZE = 6
HP_COPY_CROSS_MAX_AGE = 35
HP_COPY_MAX_RICH_Z = 0.50
HP_COPY_MIN_EDGE = -3.0
HP_COPY_BAD_BLOCK_AGE = 8

# Disabled experimental net-flow layer. It is still calculated for diagnostics,
# but V42 does not trade on net flow alone.
HP_NET_FLOW_ENABLED = False
HP_NET_FLOW_MAX_WINDOW = 100
HP_NET_FLOW_POSITIVE_50 = 10
HP_NET_FLOW_POSITIVE_100 = 10
HP_NET_BUY_VOLUME_50 = 10
HP_NET_FLOW_NEGATIVE_10 = -5
HP_NET_FLOW_NEGATIVE_25 = -10
HP_NET_SELL_VOLUME_50 = 15
HP_NET_FLOW_CHEAP_Z = -1.0
HP_NET_FLOW_MAX_RICH_Z = 0.50
HP_NET_FLOW_EXTREME_POSITIVE_25 = 15
HP_NET_FLOW_EXTREME_POSITIVE_50 = 20
HP_NET_FLOW_EXTREME_NEGATIVE_50 = -20
HP_NET_SELL_VOLUME_EXTREME_50 = 20
HP_NET_ORDER_SIZE = 2
HP_NET_CONTRARIAN_ORDER_SIZE = 2
HP_NET_LONG_CAP = 25

# Disabled aggressive-extreme layer. V42 uses confidence-scored entries instead.
HP_AGGRESSIVE_EXTREME_MODE = False
HP_AGGRESSIVE_TROUGH_TARGET = 60
HP_AGGRESSIVE_TROUGH_MAX_AGE = 45
HP_AGGRESSIVE_TROUGH_MAX_RICH_Z = 2.25
HP_AGGRESSIVE_TROUGH_MIN_EDGE = -10.0
HP_AGGRESSIVE_PEAK_MAX_AGE = 45
HP_AGGRESSIVE_PEAK_MIN_SELL_Z = 0.35
HP_AGGRESSIVE_PEAK_MIN_EDGE = -10.0
HP_NO_LOSS_SELL_ENABLED = True
HP_MIN_SELL_PROFIT_TICKS = 1

# Staged targets convert stronger conditions into larger allowable exposure.
HP_STAGED_ENTRY_MODE = True
HP_TROUGH_STAGE_1_TARGET = 40
HP_TROUGH_STAGE_2_TARGET = 90
HP_TROUGH_STAGE_3_TARGET = 140
HP_TROUGH_FULL_TARGET = 160
HP_STAGE_2_RETURN_EMA = -0.05
HP_STAGE_3_RETURN_EMA = 0.00
HP_FULL_STAGE_RETURN_EMA = 0.10
HP_UNDERWATER_LOCKOUT_TICKS = 8
HP_HARD_INVALIDATION_TICKS = 15
HP_HARD_INVALIDATION_MIN_POS = 80
HP_HARD_INVALIDATION_REDUCE_SIZE = 6
HP_HARD_INVALIDATION_ALLOW_LOSS = False

# Confidence score controls how much volume we are willing to cross for.
HP_CONFIDENCE_SCALING = True
HP_CONF_WEAK_SCORE = 4
HP_CONF_GOOD_SCORE = 6
HP_CONF_STRONG_SCORE = 8
HP_CONF_MAX_SCORE = 10
HP_CONF_WEAK_TARGET = 80
HP_CONF_GOOD_TARGET = 120
HP_CONF_STRONG_TARGET = 160
HP_CONF_MAX_TARGET = 180
HP_CONF_WEAK_ORDER = 8
HP_CONF_GOOD_ORDER = 16
HP_CONF_STRONG_ORDER = 30
HP_CONF_MAX_ORDER = 40
HP_CONF_SWEEP_ENABLED = True
HP_CONF_SWEEP_MIN_SCORE = 6
HP_CONF_SWEEP_MIN_EDGE = -1.0
HP_CONF_SWEEP_GOOD_LEVELS = 2
HP_CONF_SWEEP_STRONG_LEVELS = 3

# Re-entry is deliberately not a generic falling-knife probe. It only activates
# after the strategy has already completed one profitable HP cycle that day.
HP_REENTRY_PROBE_ENABLED = True
HP_REENTRY_MIN_COMPLETED_CYCLES = 1
HP_REENTRY_MIN_CONFIDENCE = 8
HP_REENTRY_MAX_Z = -1.75
HP_REENTRY_MIN_EDGE = 4.0
HP_REENTRY_MAX_NEGATIVE_RETURN = -1.75
HP_REENTRY_ORDER_SIZE = 6
HP_REENTRY_CAP = 24
HP_REENTRY_MIN_DELAY = 10000
HP_REENTRY_NO_NEW_AFTER_TS = 875000

# End-of-session risk control. This can only sell if the no-loss guard allows it.
HP_LATE_CLEANUP_ENABLED = True
HP_LATE_CLEANUP_TS = 875000

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
    window: int = 80,
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


def rolling_sum(values: List[int], window: int) -> int:
    if not values:
        return 0
    return int(sum(values[-window:]))


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
        "hp_prediction": {},
        "hp_market_signal": {},
        "hp_seen_own_trade_keys": [],
        "hp_last_buy_price": None,
        "hp_last_buy_ts": None,
        "hp_prev_position": 0,
        "hp_cycle_entry_price": None,
        "hp_completed_profit_cycles": 0,
        "hp_last_profit_cycle_ts": None,
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
    if not isinstance(default["hp_prediction"], dict):
        default["hp_prediction"] = {}
    if not isinstance(default["hp_market_signal"], dict):
        default["hp_market_signal"] = {}
    if not isinstance(default["hp_seen_own_trade_keys"], list):
        default["hp_seen_own_trade_keys"] = []
    if not isinstance(default.get("hp_completed_profit_cycles"), int):
        default["hp_completed_profit_cycles"] = 0
    return default


def save_state(state: Dict[str, Any]) -> str:
    state["debug_logs"] = state.get("debug_logs", [])[-MAX_DEBUG_LOGS:]
    state["hp_seen_own_trade_keys"] = state.get("hp_seen_own_trade_keys", [])[-200:]
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
        state["hp_cycle_entry_price"] = None
        state["hp_completed_profit_cycles"] = 0
        state["hp_last_profit_cycle_ts"] = None
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


def hp_signed_trade_qty(price: float, qty: int, best_bid: int, best_ask: int) -> int:
    direction = hp_trade_direction(price, best_bid, best_ask)
    if direction == "BUY":
        return qty
    if direction == "SELL":
        return -qty
    mid = (best_bid + best_ask) / 2.0
    if price > mid:
        return qty
    if price < mid:
        return -qty
    return 0


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
        signal["net_flow_history"] = []
        signal["buy_flow_history"] = []
        signal["sell_flow_history"] = []

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
    downtick_cluster = max(0, int(signal.get("downtick_cluster", 0)) - 1)
    downtick_age = int(signal.get("downtick_age", HP_DOWNTICK_MAX_AGE + 1)) + 1
    qty6_buy_cluster = max(0, int(signal.get("qty6_buy_cluster", 0)) - 1)
    combo_age = int(signal.get("combo_age", HP_COMBO_MAX_AGE + 1)) + 1
    capitulation_age = int(signal.get("capitulation_age", HP_CAPITULATION_MAX_AGE + 1)) + 1
    peak_sell_age = int(signal.get("peak_sell_age", HP_AGGRESSIVE_PEAK_MAX_AGE + 1)) + 1
    net_flow_history = signal.get("net_flow_history", [])
    buy_flow_history = signal.get("buy_flow_history", [])
    sell_flow_history = signal.get("sell_flow_history", [])
    if not isinstance(net_flow_history, list):
        net_flow_history = []
    if not isinstance(buy_flow_history, list):
        buy_flow_history = []
    if not isinstance(sell_flow_history, list):
        sell_flow_history = []
    market_trades = trading_state.market_trades.get(HP, []) if trading_state.market_trades else []
    trade_key = "|".join(
        f"{getattr(t, 'timestamp', trading_state.timestamp)}:{getattr(t, 'price', 0)}:{getattr(t, 'quantity', 0)}"
        for t in market_trades
    )
    tick_net_flow = 0
    tick_buy_flow = 0
    tick_sell_flow = 0
    if market_trades and trade_key != signal.get("last_trade_key"):
        near_low = prev_mid is not None and float(prev_mid) <= low + HP_SIGNAL_EXTREME_TOL
        near_high = prev_mid is not None and float(prev_mid) >= high - HP_SIGNAL_EXTREME_TOL
        qty5_buys = 0
        qty5_sells = 0
        bad_buys = 0
        downtick_sells = 0
        qty6_buys = 0
        for trade in market_trades:
            qty = abs(int(getattr(trade, "quantity", 0) or 0))
            price = float(getattr(trade, "price", 0) or 0)
            direction = hp_trade_direction(price, ref_bid, ref_ask)
            signed_qty = hp_signed_trade_qty(price, qty, ref_bid, ref_ask)
            tick_net_flow += signed_qty
            if signed_qty > 0:
                tick_buy_flow += signed_qty
            elif signed_qty < 0:
                tick_sell_flow += -signed_qty
            if qty == HP_SIGNAL_QTY:
                if direction == "BUY":
                    qty5_buys += 1
                elif direction == "SELL":
                    qty5_sells += 1
            elif qty in HP_BAD_BUY_QTYS and direction == "BUY":
                bad_buys += 1
            if qty in HP_DOWNTICK_QTYS and direction == "SELL":
                downtick_sells += 1
            if qty == HP_SECONDARY_BUY_QTY and direction == "BUY":
                qty6_buys += 1

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
        downtick_cluster += downtick_sells
        qty6_buy_cluster += qty6_buys
        if downtick_cluster >= HP_DOWNTICK_CLUSTER_MIN:
            downtick_age = 0
        if bad_buy_cluster >= HP_BAD_CLUSTER_MIN:
            bad_buy_age = 0
            if active > 0:
                active = 0
        if bull_cluster >= HP_SIGNAL_CLUSTER_MIN and active >= 0:
            active = 1
            age = 0
            anchor = float(prev_mid if prev_mid is not None else observed_mid)
        elif bull_cluster >= 1 and qty6_buy_cluster >= 1 and bad_buy_cluster < HP_BAD_CLUSTER_MIN:
            active = 1
            combo_age = 0
            anchor = float(prev_mid if prev_mid is not None else observed_mid)
        if bear_cluster >= HP_CAPITULATION_SELL_CLUSTER_MIN:
            capitulation_age = 0
        if qty5_sells >= 1 and near_high:
            peak_sell_age = 0
        elif bear_cluster >= HP_SIGNAL_CLUSTER_MIN and near_high:
            peak_sell_age = 0
        elif HP_ENABLE_BEARISH_SIGNAL and bear_cluster >= HP_SIGNAL_CLUSTER_MIN and active <= 0:
            active = -1
            age = 0
            anchor = float(prev_mid if prev_mid is not None else observed_mid)
        signal["bull_cluster"] = bull_cluster
        signal["bear_cluster"] = bear_cluster
        signal["bad_buy_cluster"] = bad_buy_cluster
        signal["bad_buy_age"] = bad_buy_age
        signal["downtick_cluster"] = downtick_cluster
        signal["downtick_age"] = downtick_age
        signal["qty6_buy_cluster"] = qty6_buy_cluster
        signal["combo_age"] = combo_age
        signal["capitulation_age"] = capitulation_age
        signal["peak_sell_age"] = peak_sell_age
        signal["last_trade_key"] = trade_key

    if signal.get("last_flow_ts") != trading_state.timestamp:
        net_flow_history.append(tick_net_flow)
        buy_flow_history.append(tick_buy_flow)
        sell_flow_history.append(tick_sell_flow)
        if len(net_flow_history) > HP_NET_FLOW_MAX_WINDOW:
            del net_flow_history[: len(net_flow_history) - HP_NET_FLOW_MAX_WINDOW]
        if len(buy_flow_history) > HP_NET_FLOW_MAX_WINDOW:
            del buy_flow_history[: len(buy_flow_history) - HP_NET_FLOW_MAX_WINDOW]
        if len(sell_flow_history) > HP_NET_FLOW_MAX_WINDOW:
            del sell_flow_history[: len(sell_flow_history) - HP_NET_FLOW_MAX_WINDOW]
        signal["last_flow_ts"] = trading_state.timestamp

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
        "downtick_cluster": downtick_cluster,
        "downtick_age": downtick_age,
        "qty6_buy_cluster": qty6_buy_cluster,
        "combo_age": combo_age,
        "capitulation_age": capitulation_age,
        "peak_sell_age": peak_sell_age,
        "net_flow_history": net_flow_history,
        "buy_flow_history": buy_flow_history,
        "sell_flow_history": sell_flow_history,
        "net10": rolling_sum(net_flow_history, 10),
        "net25": rolling_sum(net_flow_history, 25),
        "net50": rolling_sum(net_flow_history, 50),
        "net100": rolling_sum(net_flow_history, 100),
        "buy50": rolling_sum(buy_flow_history, 50),
        "buy100": rolling_sum(buy_flow_history, 100),
        "sell10": rolling_sum(sell_flow_history, 10),
        "sell25": rolling_sum(sell_flow_history, 25),
        "sell50": rolling_sum(sell_flow_history, 50),
        "sell100": rolling_sum(sell_flow_history, 100),
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


def hp_own_trade_side(trade: Any) -> Optional[str]:
    buyer = str(getattr(trade, "buyer", "") or "").upper()
    seller = str(getattr(trade, "seller", "") or "").upper()
    if buyer == "SUBMISSION":
        return "BUY"
    if seller == "SUBMISSION":
        return "SELL"
    return None


def update_hp_entry_tracker(state: Dict[str, Any], trading_state: TradingState, position: int) -> None:
    # IMC exposes our prior fills through state.own_trades. The tracker keeps
    # the last buy price for the no-loss sell guard and counts completed
    # profitable cycles for the selective re-entry layer.
    prev_position = int(state.get("hp_prev_position", 0) or 0)
    position_delta = position - prev_position
    fallback_side: Optional[str] = None
    if position_delta > 0:
        fallback_side = "BUY"
    elif position_delta < 0:
        fallback_side = "SELL"
    seen_list = state.setdefault("hp_seen_own_trade_keys", [])
    if not isinstance(seen_list, list):
        seen_list = []
        state["hp_seen_own_trade_keys"] = seen_list
    seen = set(str(x) for x in seen_list[-200:])
    own_trades = trading_state.own_trades.get(HP, []) if getattr(trading_state, "own_trades", None) else []
    for trade in own_trades:
        price = int(getattr(trade, "price", 0) or 0)
        qty = abs(int(getattr(trade, "quantity", 0) or 0))
        ts = int(getattr(trade, "timestamp", trading_state.timestamp) or 0)
        side = hp_own_trade_side(trade)
        if side is None:
            side = fallback_side
        key = f"{ts}:{side}:{price}:{qty}:{getattr(trade, 'buyer', '')}:{getattr(trade, 'seller', '')}"
        if side is None or key in seen or qty <= 0 or price <= 0:
            continue
        seen.add(key)
        seen_list.append(key)
        if side == "BUY":
            state["hp_last_buy_price"] = price
            state["hp_last_buy_ts"] = ts
            if state.get("hp_cycle_entry_price") is None:
                state["hp_cycle_entry_price"] = price
        elif side == "SELL" and position <= 0:
            entry = state.get("hp_cycle_entry_price")
            if entry is not None and price > float(entry) + HP_MIN_SELL_PROFIT_TICKS:
                state["hp_completed_profit_cycles"] = int(state.get("hp_completed_profit_cycles", 0) or 0) + 1
                state["hp_last_profit_cycle_ts"] = ts
            state["hp_last_buy_price"] = None
            state["hp_last_buy_ts"] = None
            state["hp_cycle_entry_price"] = None
    if position <= 0:
        state["hp_last_buy_price"] = None
        state["hp_last_buy_ts"] = None
        state["hp_cycle_entry_price"] = None
    state["hp_prev_position"] = position


def hp_min_sell_price(state: Dict[str, Any]) -> Optional[int]:
    # Normal exits should not realize a loss. Hard invalidation can still be
    # tested separately, but V42 keeps that disabled for ordinary trading.
    if not HP_NO_LOSS_SELL_ENABLED:
        return None
    last_buy = state.get("hp_last_buy_price")
    if last_buy is None:
        return None
    return int(math.ceil(float(last_buy) + HP_MIN_SELL_PROFIT_TICKS))


def hp_protected_sell_price(state: Dict[str, Any], desired_price: int) -> Tuple[int, bool, Optional[int]]:
    min_price = hp_min_sell_price(state)
    if min_price is None or desired_price >= min_price:
        return desired_price, False, min_price
    return min_price, True, min_price


def hp_staged_trough_target(
    buy_z: float,
    return_ema: float,
    net10: int,
    net50: int,
    bullish_flow: bool,
    secondary_bullish_flow: bool,
    capitulation_bullish_flow: bool,
    net_contrarian_flow: bool,
) -> int:
    if not HP_STAGED_ENTRY_MODE:
        return min(POSITION_LIMITS[HP], HP_AGGRESSIVE_TROUGH_TARGET)

    target = HP_TROUGH_STAGE_1_TARGET
    if return_ema >= HP_STAGE_2_RETURN_EMA or net10 > 0 or bullish_flow or secondary_bullish_flow:
        target = HP_TROUGH_STAGE_2_TARGET
    if (
        return_ema >= HP_STAGE_3_RETURN_EMA
        and net50 >= 0
        and (bullish_flow or secondary_bullish_flow or capitulation_bullish_flow or net_contrarian_flow)
    ):
        target = HP_TROUGH_STAGE_3_TARGET
    if return_ema >= HP_FULL_STAGE_RETURN_EMA and net50 >= 5 and buy_z <= HP_NET_FLOW_CHEAP_Z:
        target = HP_TROUGH_FULL_TARGET
    return min(POSITION_LIMITS[HP], target)


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
    update_hp_entry_tracker(state, trading_state, position)
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
    min_sell_price = hp_min_sell_price(state)
    lower_band = adjusted - HP_BOLLINGER_MULT * rolling_std
    upper_band = adjusted + HP_BOLLINGER_MULT * rolling_std
    return_ema = prediction["return_ema"]
    buy_momentum_ok = return_ema >= -HP_MOMENTUM_BLOCK
    sell_momentum_ok = return_ema <= HP_MOMENTUM_BLOCK
    market_signal = update_hp_market_signal(state, trading_state, observed, best_bid, best_ask) if HP_MARKET_SIGNAL_ENABLED else {}
    signal_active = int(market_signal.get("active", 0) or 0)
    signal_age = int(market_signal.get("age", HP_SIGNAL_MAX_AGE + 1) or 0)
    bad_buy_age = int(market_signal.get("bad_buy_age", HP_BAD_CLUSTER_MAX_AGE + 1) or 0)
    downtick_age = int(market_signal.get("downtick_age", HP_DOWNTICK_MAX_AGE + 1) or 0)
    combo_age = int(market_signal.get("combo_age", HP_COMBO_MAX_AGE + 1) or 0)
    capitulation_age = int(market_signal.get("capitulation_age", HP_CAPITULATION_MAX_AGE + 1) or 0)
    peak_sell_age = int(market_signal.get("peak_sell_age", HP_AGGRESSIVE_PEAK_MAX_AGE + 1) or 0)
    net10 = int(market_signal.get("net10", 0) or 0)
    net25 = int(market_signal.get("net25", 0) or 0)
    net50 = int(market_signal.get("net50", 0) or 0)
    net100 = int(market_signal.get("net100", 0) or 0)
    buy50 = int(market_signal.get("buy50", 0) or 0)
    sell10 = int(market_signal.get("sell10", 0) or 0)
    sell25 = int(market_signal.get("sell25", 0) or 0)
    sell50 = int(market_signal.get("sell50", 0) or 0)
    bullish_flow = signal_active > 0 and signal_age <= HP_SIGNAL_MAX_AGE
    bearish_flow = signal_active < 0 and signal_age <= HP_SIGNAL_MAX_AGE
    bad_buy_active = bad_buy_age <= HP_BAD_CLUSTER_MAX_AGE
    market_downtick = downtick_age <= HP_DOWNTICK_MAX_AGE
    secondary_bullish_flow = combo_age <= HP_COMBO_MAX_AGE
    capitulation_bullish_flow = capitulation_age <= HP_CAPITULATION_MAX_AGE and buy_z <= HP_CAPITULATION_CHEAP_Z
    net_momentum_flow = (
        HP_NET_FLOW_ENABLED
        and buy_z <= HP_NET_FLOW_MAX_RICH_Z
        and (
            net50 >= HP_NET_FLOW_POSITIVE_50
            or net100 >= HP_NET_FLOW_POSITIVE_100
            or (buy50 >= HP_NET_BUY_VOLUME_50 and net50 > 0)
        )
    )
    net_contrarian_flow = (
        HP_NET_FLOW_ENABLED
        and buy_z <= HP_NET_FLOW_CHEAP_Z
        and (
            net10 <= HP_NET_FLOW_NEGATIVE_10
            or net25 <= HP_NET_FLOW_NEGATIVE_25
            or sell50 >= HP_NET_SELL_VOLUME_50
        )
    )
    net_exhaustion_block = (
        HP_NET_FLOW_ENABLED
        and (
            net25 >= HP_NET_FLOW_EXTREME_POSITIVE_25
            or net50 >= HP_NET_FLOW_EXTREME_POSITIVE_50
            or net50 <= HP_NET_FLOW_EXTREME_NEGATIVE_50
            or sell50 >= HP_NET_SELL_VOLUME_EXTREME_50
        )
    )
    net_bullish_flow = (net_momentum_flow or net_contrarian_flow) and not net_exhaustion_block
    copy_bad_block = bad_buy_age <= HP_COPY_BAD_BLOCK_AGE and not net_contrarian_flow
    last_buy_price = state.get("hp_last_buy_price")
    underwater_ticks = 0.0 if last_buy_price is None else float(last_buy_price) - observed
    underwater_buy_lockout = position > 0 and underwater_ticks >= HP_UNDERWATER_LOCKOUT_TICKS
    hard_invalidation = (
        position >= HP_HARD_INVALIDATION_MIN_POS
        and underwater_ticks >= HP_HARD_INVALIDATION_TICKS
        and (return_ema < -HP_MOMENTUM_BLOCK or net_exhaustion_block or market_downtick)
    )
    new_buy_block = underwater_buy_lockout or hard_invalidation
    staged_trough_target = hp_staged_trough_target(
        buy_z,
        return_ema,
        net10,
        net50,
        bullish_flow,
        secondary_bullish_flow,
        capitulation_bullish_flow,
        net_contrarian_flow,
    )
    buy_confidence = 0
    if buy_z <= 0.50:
        buy_confidence += 1
    if buy_z <= 0.00:
        buy_confidence += 1
    if buy_z <= -0.50:
        buy_confidence += 1
    if buy_z <= -1.00:
        buy_confidence += 1
    if buy_z <= -1.50:
        buy_confidence += 1
    if buy_edge >= -1.0:
        buy_confidence += 1
    if buy_edge >= 2.0:
        buy_confidence += 1
    if buy_edge >= 5.0:
        buy_confidence += 1
    if bullish_flow:
        buy_confidence += 2 if signal_age <= 20 else 1
    if secondary_bullish_flow:
        buy_confidence += 1
    if capitulation_bullish_flow:
        buy_confidence += 2
    if net_bullish_flow:
        buy_confidence += 1
    if return_ema >= 0.0:
        buy_confidence += 1
    if return_ema >= 0.10:
        buy_confidence += 1
    if prediction["predicted_move"] >= 0.0:
        buy_confidence += 1
    if copy_bad_block:
        buy_confidence -= 3
    if bad_buy_active:
        buy_confidence -= 2
    if net_exhaustion_block:
        buy_confidence -= 4
    if underwater_buy_lockout:
        buy_confidence -= 3
    if market_downtick and return_ema < 0:
        buy_confidence -= 2
    if position >= 120:
        buy_confidence -= 1
    if position >= 160:
        buy_confidence -= 2
    buy_confidence = max(0, buy_confidence)

    confidence_target = staged_trough_target
    confidence_order_size = HP_COPY_ORDER_SIZE
    if HP_CONFIDENCE_SCALING:
        if buy_confidence >= HP_CONF_MAX_SCORE:
            confidence_target = HP_CONF_MAX_TARGET
            confidence_order_size = HP_CONF_MAX_ORDER
        elif buy_confidence >= HP_CONF_STRONG_SCORE:
            confidence_target = HP_CONF_STRONG_TARGET
            confidence_order_size = HP_CONF_STRONG_ORDER
        elif buy_confidence >= HP_CONF_GOOD_SCORE:
            confidence_target = HP_CONF_GOOD_TARGET
            confidence_order_size = HP_CONF_GOOD_ORDER
        elif buy_confidence >= HP_CONF_WEAK_SCORE:
            confidence_target = HP_CONF_WEAK_TARGET
            confidence_order_size = HP_CONF_WEAK_ORDER
        else:
            confidence_order_size = HP_COPY_ORDER_SIZE
        confidence_target = min(POSITION_LIMITS[HP], max(staged_trough_target, confidence_target))

    buy_order_price = best_ask
    buy_order_edge = buy_edge
    if HP_CONF_SWEEP_ENABLED and buy_confidence >= HP_CONF_SWEEP_MIN_SCORE:
        max_levels = HP_CONF_SWEEP_STRONG_LEVELS if buy_confidence >= HP_CONF_STRONG_SCORE else HP_CONF_SWEEP_GOOD_LEVELS
        affordable_asks = [
            price
            for price in sorted(depth.sell_orders)
            if adjusted - price >= HP_CONF_SWEEP_MIN_EDGE
        ]
        if affordable_asks:
            buy_order_price = affordable_asks[min(max_levels - 1, len(affordable_asks) - 1)]
            buy_order_edge = adjusted - buy_order_price

    aggressive_peak_sell_signal = (
        HP_AGGRESSIVE_EXTREME_MODE
        and position > 0
        and peak_sell_age <= HP_AGGRESSIVE_PEAK_MAX_AGE
        and sell_z >= HP_AGGRESSIVE_PEAK_MIN_SELL_Z
        and sell_edge >= HP_AGGRESSIVE_PEAK_MIN_EDGE
    )
    aggressive_trough_buy_signal = (
        HP_AGGRESSIVE_EXTREME_MODE
        and position < staged_trough_target
        and not new_buy_block
        and not net_exhaustion_block
        and not copy_bad_block
        and buy_z <= HP_AGGRESSIVE_TROUGH_MAX_RICH_Z
        and buy_edge >= HP_AGGRESSIVE_TROUGH_MIN_EDGE
        and (
            (bullish_flow and signal_age <= HP_AGGRESSIVE_TROUGH_MAX_AGE)
            or (secondary_bullish_flow and combo_age <= HP_AGGRESSIVE_TROUGH_MAX_AGE)
            or capitulation_bullish_flow
            or net_contrarian_flow
        )
    )
    copy_bullish_flow = (
        bullish_flow
        or secondary_bullish_flow
        or capitulation_bullish_flow
        or net_bullish_flow
    )
    copy_signal_age = min(
        signal_age if bullish_flow else HP_COPY_CROSS_MAX_AGE + 1,
        combo_age if secondary_bullish_flow else HP_COPY_CROSS_MAX_AGE + 1,
        capitulation_age if capitulation_bullish_flow else HP_COPY_CROSS_MAX_AGE + 1,
        0 if net_bullish_flow else HP_COPY_CROSS_MAX_AGE + 1,
    )
    copy_long_cap = (
        HP_NET_LONG_CAP
        if net_bullish_flow and not (bullish_flow or secondary_bullish_flow or capitulation_bullish_flow)
        else HP_COPY_LONG_CAP
    )
    if HP_STAGED_ENTRY_MODE:
        copy_long_cap = min(copy_long_cap, staged_trough_target)
    if HP_CONFIDENCE_SCALING and buy_confidence >= HP_CONF_WEAK_SCORE:
        copy_long_cap = min(POSITION_LIMITS[HP], max(copy_long_cap, confidence_target))
    passive_long_add_cap = min(HP_LONG_ADD_CAP, staged_trough_target) if HP_STAGED_ENTRY_MODE else HP_LONG_ADD_CAP
    if HP_CONFIDENCE_SCALING and buy_confidence >= HP_CONF_WEAK_SCORE:
        passive_long_add_cap = min(POSITION_LIMITS[HP], max(passive_long_add_cap, confidence_target))
    # Core entry: buy only when market-presence signals, cheapness, edge, and
    # confidence agree. This is the main V38/V42 entry layer.
    core_entry_signal = (
        HP_COPY_TRADE_MODE
        and copy_bullish_flow
        and not copy_bad_block
        and not net_exhaustion_block
        and not new_buy_block
        and copy_signal_age <= HP_COPY_CROSS_MAX_AGE
        and buy_z <= HP_COPY_MAX_RICH_Z
        and buy_edge >= HP_COPY_MIN_EDGE
        and buy_confidence >= HP_CONF_WEAK_SCORE
        and position < copy_long_cap
    )
    mean_reversion_ok = buy_z <= HP_SIGNAL_MAX_RICH_Z
    mean_reversion_good = buy_z <= HP_SIGNAL_MIN_CHEAP_Z
    upward_mean_reversion = (
        (bullish_flow or secondary_bullish_flow or capitulation_bullish_flow or net_bullish_flow)
        and not bad_buy_active
        and not new_buy_block
        and buy_z <= HP_SIGNAL_MAX_RICH_Z
    )
    completed_profit_cycles = int(state.get("hp_completed_profit_cycles", 0) or 0)
    last_profit_cycle_ts = state.get("hp_last_profit_cycle_ts")
    reentry_delay_ok = (
        last_profit_cycle_ts is not None
        and trading_state.timestamp - int(last_profit_cycle_ts) >= HP_REENTRY_MIN_DELAY
    )
    # Re-entry probe: only after a profitable completed cycle while flat. This
    # targets repeat mean-reversion days without enabling broad falling-knife buys.
    reentry_probe_signal = (
        HP_REENTRY_PROBE_ENABLED
        and position == 0
        and completed_profit_cycles >= HP_REENTRY_MIN_COMPLETED_CYCLES
        and reentry_delay_ok
        and trading_state.timestamp <= HP_REENTRY_NO_NEW_AFTER_TS
        and not net_exhaustion_block
        and buy_confidence >= HP_REENTRY_MIN_CONFIDENCE
        and buy_z <= HP_REENTRY_MAX_Z
        and buy_edge >= HP_REENTRY_MIN_EDGE
        and return_ema >= HP_REENTRY_MAX_NEGATIVE_RETURN
    )
    downward_mean_reversion = market_downtick and sell_z >= HP_DOWNTICK_MIN_Z
    signal_label = (
        f"flow={signal_active}_age={signal_age}_combo_age={combo_age}"
        f"_cap_age={capitulation_age}_peak_sell_age={peak_sell_age}"
        f"_bad_buy_age={bad_buy_age}_down_age={downtick_age}"
        f"_net10={net10}_net25={net25}_net50={net50}_net100={net100}"
        f"_buy50={buy50}_sell10={sell10}_sell25={sell25}_sell50={sell50}"
        f"_net_mom={int(net_momentum_flow)}_net_contra={int(net_contrarian_flow)}"
        f"_net_block={int(net_exhaustion_block)}"
        f"_aggr_trough={int(aggressive_trough_buy_signal)}_aggr_peak={int(aggressive_peak_sell_signal)}"
        f"_stage_target={staged_trough_target}_uw={underwater_ticks:.1f}"
        f"_buy_lockout={int(underwater_buy_lockout)}_hard_invalid={int(hard_invalidation)}"
        f"_conf={buy_confidence}_conf_target={confidence_target}_conf_order={confidence_order_size}"
        f"_cycles={completed_profit_cycles}_reentry={int(reentry_probe_signal)}"
        f"_min_sell={min_sell_price}"
    )
    bullish_exit_override = (
        (bullish_flow or net_bullish_flow)
        and not bad_buy_active
        and position < HP_BULLISH_EXIT_OVERRIDE_MAX_POS
        and sell_z < HP_BULLISH_EXIT_OVERRIDE_MAX_Z
    )
    # Exit signal: unwind gradually after the rebound has moved clearly over fair.
    exit_signal = position > 0 and not bullish_exit_override and (sell_z >= -HP_EXIT_Z or (bearish_flow and sell_edge > -HP_SIGNAL_EDGE))
    # V42 does not open shorts; this remains defensive in case state ever
    # arrives short from external conditions.
    short_exit = position < 0 and (buy_z <= HP_EXIT_Z or (bullish_flow and buy_edge > -HP_SIGNAL_EDGE))
    # Late cleanup is risk control, not a market-timing signal.
    late_cleanup_signal = (
        HP_LATE_CLEANUP_ENABLED
        and position > 0
        and trading_state.timestamp >= HP_LATE_CLEANUP_TS
        and best_bid >= (min_sell_price if min_sell_price is not None else best_bid)
    )

    if hard_invalidation:
        desired = min(HP_HARD_INVALIDATION_REDUCE_SIZE, max(0, position - HP_TROUGH_STAGE_1_TARGET))
        size = position_safe_sell_size(HP, desired, position, POSITION_LIMITS[HP], POSITION_LIMITS[HP])
        size = min(size, position)
        if HP_HARD_INVALIDATION_ALLOW_LOSS:
            sell_price = best_bid
            protected = False
        else:
            sell_price, protected, _min_sell = hp_protected_sell_price(state, best_bid)
        order_edge = sell_price - adjusted
        reason = f"HP_HARD_INVALIDATION_REDUCE_uw={underwater_ticks:.1f}_sell_z={sell_z:.2f}_std={rolling_std:.2f}_{signal_label}_edge={order_edge:.2f}_protected={int(protected)}_ret_ema={return_ema:.2f}"
        log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, order_edge, position, -size, reason)
        if size > 0:
            orders.append(Order(HP, sell_price, -size))
    elif aggressive_peak_sell_signal:
        desired = position
        size = position_safe_sell_size(HP, desired, position, POSITION_LIMITS[HP], POSITION_LIMITS[HP])
        size = min(size, position)
        sell_price, protected, _min_sell = hp_protected_sell_price(state, best_bid)
        order_edge = sell_price - adjusted
        reason = f"HP_AGGRESSIVE_PEAK_DUMP_sell_z={sell_z:.2f}_std={rolling_std:.2f}_{signal_label}_edge={order_edge:.2f}_protected={int(protected)}_ret_ema={return_ema:.2f}"
        log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, order_edge, position, -size, reason)
        if size > 0:
            orders.append(Order(HP, sell_price, -size))
    elif late_cleanup_signal:
        desired = position
        size = position_safe_sell_size(HP, desired, position, POSITION_LIMITS[HP], POSITION_LIMITS[HP])
        size = min(size, position)
        sell_price, protected, _min_sell = hp_protected_sell_price(state, best_bid)
        order_edge = sell_price - adjusted
        reason = f"HP_LATE_CLEANUP_FLATTEN_sell_z={sell_z:.2f}_std={rolling_std:.2f}_{signal_label}_edge={order_edge:.2f}_protected={int(protected)}_ret_ema={return_ema:.2f}"
        log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, order_edge, position, -size, reason)
        if size > 0:
            orders.append(Order(HP, sell_price, -size))
    elif aggressive_trough_buy_signal:
        target = staged_trough_target
        desired = max(0, target - position)
        size = position_safe_buy_size(HP, desired, position, POSITION_LIMITS[HP], target)
        reason = f"HP_STAGED_TROUGH_BUY_TARGET_{target}_z={buy_z:.2f}_std={rolling_std:.2f}_{signal_label}_edge={buy_order_edge:.2f}_ret_ema={return_ema:.2f}_buy_px={buy_order_price}"
        log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, buy_order_edge, position, size, reason)
        if size > 0:
            orders.append(Order(HP, buy_order_price, size))
    elif core_entry_signal:
        if net_contrarian_flow:
            desired = HP_NET_CONTRARIAN_ORDER_SIZE
        elif net_momentum_flow and not (bullish_flow or secondary_bullish_flow or capitulation_bullish_flow):
            desired = HP_NET_ORDER_SIZE
        else:
            desired = HP_COPY_ORDER_SIZE
        if capitulation_bullish_flow or (mean_reversion_good and not net_momentum_flow):
            desired = int(HP_COPY_ORDER_SIZE * 1.5)
        desired = max(desired, confidence_order_size)
        size = position_safe_buy_size(HP, desired, position, POSITION_LIMITS[HP], copy_long_cap)
        reason = f"HP_CORE_ENTRY_BUY_signal_z={buy_z:.2f}_std={rolling_std:.2f}_copy_age={copy_signal_age}_{signal_label}_edge={buy_order_edge:.2f}_ret_ema={return_ema:.2f}_buy_px={buy_order_price}"
        log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, buy_order_edge, position, size, reason)
        if size > 0:
            orders.append(Order(HP, buy_order_price, size))
    elif position > 0 and downward_mean_reversion and not copy_bullish_flow:
        desired = min(HP_LONG_REDUCE_SIZE, position)
        size = position_safe_sell_size(HP, desired, position, POSITION_LIMITS[HP], HP_PRACTICAL_CAP)
        size = min(size, position)
        sell_price, protected, _min_sell = hp_protected_sell_price(state, best_bid)
        order_edge = sell_price - adjusted
        reason = f"HP_REDUCE_LONG_down_reversion_sell_z={sell_z:.2f}_std={rolling_std:.2f}_{signal_label}_edge={order_edge:.2f}_protected={int(protected)}_ret_ema={return_ema:.2f}"
        log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, order_edge, position, -size, reason)
        if size > 0:
            orders.append(Order(HP, sell_price, -size))
    elif exit_signal:
        desired = min(HP_EXIT_ORDER_SIZE, position)
        size = position_safe_sell_size(HP, desired, position, POSITION_LIMITS[HP], HP_PRACTICAL_CAP)
        size = min(size, position)
        sell_price, protected, _min_sell = hp_protected_sell_price(state, best_bid)
        order_edge = sell_price - adjusted
        reason = f"HP_EXIT_LONG_resid_z={sell_z:.2f}_std={rolling_std:.2f}_{signal_label}_edge={order_edge:.2f}_protected={int(protected)}_ret_ema={return_ema:.2f}_pred_move={prediction['predicted_move']:.2f}"
        log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, order_edge, position, -size, reason)
        if size > 0:
            orders.append(Order(HP, sell_price, -size))
    elif short_exit:
        desired = min(HP_EXIT_ORDER_SIZE, -position)
        size = position_safe_buy_size(HP, desired, position, POSITION_LIMITS[HP], HP_PRACTICAL_CAP)
        size = min(size, -position)
        reason = f"HP_EXIT_SHORT_resid_z={buy_z:.2f}_std={rolling_std:.2f}_{signal_label}_ret_ema={return_ema:.2f}_pred_move={prediction['predicted_move']:.2f}"
        log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, buy_edge, position, size, reason)
        if size > 0:
            orders.append(Order(HP, best_ask, size))
    elif reentry_probe_signal:
        desired = HP_REENTRY_ORDER_SIZE
        size = position_safe_buy_size(HP, desired, position, POSITION_LIMITS[HP], HP_REENTRY_CAP)
        reason = f"HP_REENTRY_PROBE_BUY_z={buy_z:.2f}_std={rolling_std:.2f}_{signal_label}_edge={buy_order_edge:.2f}_ret_ema={return_ema:.2f}_pred_move={prediction['predicted_move']:.2f}_buy_px={buy_order_price}"
        log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, buy_order_edge, position, size, reason)
        if size > 0:
            orders.append(Order(HP, buy_order_price, size))
    elif HP_PASSIVE_SIGNAL_ORDERS and upward_mean_reversion and position < passive_long_add_cap:
        passive_price = min(best_ask - 1, best_bid + HP_PASSIVE_JOIN_OFFSET)
        passive_edge = adjusted - passive_price
        should_cross = signal_age <= HP_SIGNAL_CROSS_MAX_AGE and mean_reversion_good and buy_edge >= HP_SIGNAL_CROSS_MIN_EDGE
        order_price = best_ask if should_cross else int(passive_price)
        order_edge = buy_edge if should_cross else passive_edge
        desired = HP_SIGNAL_CROSS_ORDER_SIZE if should_cross else HP_PASSIVE_ORDER_SIZE
        size = position_safe_buy_size(HP, desired, position, POSITION_LIMITS[HP], passive_long_add_cap)
        if order_edge >= HP_PASSIVE_MAX_NEGATIVE_EDGE and size > 0:
            mode = "cross" if should_cross else "inside"
            reason = f"HP_BUY_{mode}_signal_resid_z={buy_z:.2f}_std={rolling_std:.2f}_{signal_label}_edge={order_edge:.2f}_ret_ema={return_ema:.2f}"
            log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, order_edge, position, size, reason)
            orders.append(Order(HP, int(order_price), size))
        else:
            reason = hp_signal_skip_reason("BUY", signal_active, signal_age, order_edge, position)
            log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, order_edge, position, 0, reason)
    elif upward_mean_reversion and buy_edge > HP_SIGNAL_EDGE and position < passive_long_add_cap:
        desired = HP_SIGNAL_ORDER_SIZE
        size = position_safe_buy_size(HP, desired, position, POSITION_LIMITS[HP], passive_long_add_cap)
        reason = f"HP_BUY_signal_only_resid_z={buy_z:.2f}_std={rolling_std:.2f}_{signal_label}_edge={buy_order_edge:.2f}_ret_ema={return_ema:.2f}_buy_px={buy_order_price}"
        log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, buy_order_edge, position, size, reason)
        if size > 0:
            orders.append(Order(HP, buy_order_price, size))
    elif HP_PASSIVE_SIGNAL_ORDERS and HP_ENABLE_BEARISH_SIGNAL and bearish_flow and position > -0.60 * POSITION_LIMITS[HP]:
        passive_price = max(best_bid + 1, best_ask - HP_PASSIVE_JOIN_OFFSET)
        order_price, protected, _min_sell = hp_protected_sell_price(state, int(passive_price))
        passive_edge = order_price - adjusted
        desired = HP_PASSIVE_ORDER_SIZE
        size = position_safe_sell_size(HP, desired, position, POSITION_LIMITS[HP], HP_PRACTICAL_CAP)
        if passive_edge >= HP_PASSIVE_MAX_NEGATIVE_EDGE and size > 0:
            reason = f"HP_SELL_passive_signal_resid_z={sell_z:.2f}_std={rolling_std:.2f}_{signal_label}_edge={passive_edge:.2f}_protected={int(protected)}_ret_ema={return_ema:.2f}"
            log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, passive_edge, position, -size, reason)
            orders.append(Order(HP, order_price, -size))
        else:
            reason = hp_signal_skip_reason("SELL", signal_active, signal_age, passive_edge, position)
            log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, passive_edge, position, 0, reason)
    elif HP_ENABLE_BEARISH_SIGNAL and bearish_flow and sell_edge > HP_SIGNAL_EDGE and position > -0.60 * POSITION_LIMITS[HP]:
        desired = HP_SIGNAL_ORDER_SIZE
        size = position_safe_sell_size(HP, desired, position, POSITION_LIMITS[HP], HP_PRACTICAL_CAP)
        sell_price, protected, _min_sell = hp_protected_sell_price(state, best_bid)
        order_edge = sell_price - adjusted
        reason = f"HP_SELL_signal_only_resid_z={sell_z:.2f}_std={rolling_std:.2f}_{signal_label}_edge={order_edge:.2f}_protected={int(protected)}_ret_ema={return_ema:.2f}"
        log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, order_edge, position, -size, reason)
        if size > 0:
            orders.append(Order(HP, sell_price, -size))
    elif not HP_SIGNAL_ONLY and not new_buy_block and best_ask < lower_band and buy_z <= -HP_ENTRY_Z and buy_momentum_ok and buy_edge > buy_threshold and position < min(0.70 * POSITION_LIMITS[HP], passive_long_add_cap):
        desired = max(HP_MAX_ORDER_SIZE, confidence_order_size if buy_confidence >= HP_CONF_WEAK_SCORE else HP_MAX_ORDER_SIZE)
        if buy_edge >= HP_STRONG_EDGE or buy_z <= -HP_STRONG_Z:
            desired = max(desired, min(2 * HP_MAX_ORDER_SIZE, 16))
        size = position_safe_buy_size(HP, desired, position, POSITION_LIMITS[HP], passive_long_add_cap)
        reason = f"HP_BUY_resid_z={buy_z:.2f}_std={rolling_std:.2f}_{signal_label}_edge={buy_order_edge:.2f}_ret_ema={return_ema:.2f}_pred_move={prediction['predicted_move']:.2f}_buy_px={buy_order_price}"
        log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, buy_order_edge, position, size, reason)
        if size > 0:
            orders.append(Order(HP, buy_order_price, size))
    elif not HP_SIGNAL_ONLY and best_bid > upper_band and sell_z >= HP_ENTRY_Z and sell_momentum_ok and sell_edge > sell_threshold and position > 0:
        desired = min(HP_MAX_ORDER_SIZE, position)
        if sell_edge >= HP_STRONG_EDGE or sell_z >= HP_STRONG_Z:
            desired = min(2 * HP_MAX_ORDER_SIZE, 12, position)
        size = position_safe_sell_size(HP, desired, position, POSITION_LIMITS[HP], HP_PRACTICAL_CAP)
        size = min(size, position)
        sell_price, protected, _min_sell = hp_protected_sell_price(state, best_bid)
        order_edge = sell_price - adjusted
        reason = f"HP_SELL_resid_z={sell_z:.2f}_std={rolling_std:.2f}_{signal_label}_edge={order_edge:.2f}_protected={int(protected)}_ret_ema={return_ema:.2f}_pred_move={prediction['predicted_move']:.2f}"
        log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, order_edge, position, -size, reason)
        if size > 0:
            orders.append(Order(HP, sell_price, -size))
    else:
        edge = buy_edge if buy_edge >= sell_edge else sell_edge
        z = buy_z if buy_edge >= sell_edge else sell_z
        reason = f"HP_NO_TRADE_resid_z={z:.2f}_std={rolling_std:.2f}_{signal_label}_ret_ema={return_ema:.2f}_pred_move={prediction['predicted_move']:.2f}"
        log_decision(state, trading_state.timestamp, HP, adjusted, best_bid, best_ask, edge, position, 0, reason)

    return orders

class Trader:
    def run(self, state: TradingState) -> Tuple[Dict[str, List[Order]], int, str]:
        persistent = load_state(state.traderData)
        update_day_counter(persistent, state.timestamp)
        result: Dict[str, List[Order]] = {}

        if ENABLE_HP:
            orders = hp_orders(persistent, state)
            if orders:
                result[HP] = orders

        return result, 0, save_state(persistent)
