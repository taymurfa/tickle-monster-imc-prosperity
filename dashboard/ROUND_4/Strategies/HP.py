"""
Round 4 HYDROGEL_PACK simplified baseline.

This file is intentionally HP-only. It replaces the Round 3 copy-trade stack
with a small EMA/z-score mean-reversion strategy that is easy to audit:

1. Estimate fair value from an EMA of the live midprice.
2. Normalize the mid-vs-fair residual with a rolling z-score.
3. Buy clear cheap dislocations only.
4. Sell only to reduce/flatten long inventory.
5. Persist compact debug logs explaining every decision.
"""

import json
import math
from typing import Any, Dict, List, Optional, Tuple

try:
    from datamodel import Order, OrderDepth, Trade, TradingState
except ImportError:
    from prosperity4bt.datamodel import Order, OrderDepth, Trade, TradingState


HP = "HYDROGEL_PACK"

POSITION_LIMIT = 200
PRACTICAL_CAP = 160

EMA_ALPHA = 0.03
INVENTORY_PENALTY = 0.02
RESIDUAL_WINDOW = 80
MIN_RESIDUAL_STD = 1.0

BASE_THRESHOLD = 4.5
SPREAD_BUFFER_FRAC = 0.40
BUY_Z = -1.50
SELL_Z = 1.25

BASE_ORDER_SIZE = 8
STRONG_ORDER_SIZE = 16
STRONG_Z = 2.25
STRONG_EDGE = 14.0

LATE_FLATTEN_TS = 875_000
INVALIDATION_MAX_UNDERWATER_TICKS = 12.0
INVALIDATION_MIN_POSITION = 40
INVALIDATION_REDUCE_SIZE = 8
MAX_DEBUG_LOGS = 100
MAX_HISTORY = 120


def get_best_bid_ask(order_depth: OrderDepth) -> Optional[Tuple[int, int, int, int]]:
    if not order_depth.buy_orders or not order_depth.sell_orders:
        return None
    best_bid = max(order_depth.buy_orders)
    best_ask = min(order_depth.sell_orders)
    bid_vol = int(order_depth.buy_orders[best_bid])
    ask_vol = int(-order_depth.sell_orders[best_ask])
    return best_bid, bid_vol, best_ask, ask_vol


def get_midprice(order_depth: OrderDepth) -> Optional[float]:
    bba = get_best_bid_ask(order_depth)
    if bba is None:
        return None
    best_bid, _bid_vol, best_ask, _ask_vol = bba
    return (best_bid + best_ask) / 2.0


def update_ema(state: Dict[str, Any], product: str, value: float, alpha: float) -> float:
    ema = state.setdefault("ema", {})
    prev = ema.get(product)
    current = value if prev is None else alpha * value + (1.0 - alpha) * float(prev)
    ema[product] = current
    return current


def rolling_z_score(state: Dict[str, Any], product: str, residual: float) -> Tuple[float, float]:
    history = state.setdefault("residual_history", {}).setdefault(product, [])
    history.append(residual)
    if len(history) > MAX_HISTORY:
        del history[: len(history) - MAX_HISTORY]

    recent = history[-RESIDUAL_WINDOW:]
    if len(recent) < 5:
        return 0.0, MIN_RESIDUAL_STD

    mean = sum(recent) / len(recent)
    var = sum((x - mean) ** 2 for x in recent) / len(recent)
    std = max(MIN_RESIDUAL_STD, math.sqrt(var))
    return (residual - mean) / std, std


def inventory_adjusted_fair(fair: float, position: int) -> float:
    return fair - INVENTORY_PENALTY * position


def position_safe_buy_size(desired_size: int, position: int, practical_cap: int = PRACTICAL_CAP) -> int:
    if desired_size <= 0 or position >= practical_cap:
        return 0
    room = min(POSITION_LIMIT - position, practical_cap - position)
    scale = max(0.20, 1.0 - max(0, position) / max(1, practical_cap))
    return max(0, min(desired_size, room, max(1, int(desired_size * scale))))


def position_safe_sell_size(desired_size: int, position: int) -> int:
    if desired_size <= 0 or position <= 0:
        return 0
    return max(0, min(desired_size, position, POSITION_LIMIT + position))


def load_state(blob: str) -> Dict[str, Any]:
    default = {
        "ema": {},
        "residual_history": {},
        "debug_logs": [],
        "last_ts": -1,
        "day_index": 0,
        "hp_avg_entry": None,
        "hp_open_qty": 0,
        "seen_trade_keys": [],
    }
    if not blob:
        return default
    try:
        loaded = json.loads(blob)
    except (TypeError, ValueError):
        return default
    if not isinstance(loaded, dict):
        return default
    default.update({key: loaded.get(key, default[key]) for key in default})
    if not isinstance(default["ema"], dict):
        default["ema"] = {}
    if not isinstance(default["residual_history"], dict):
        default["residual_history"] = {}
    if not isinstance(default["debug_logs"], list):
        default["debug_logs"] = []
    if not isinstance(default["seen_trade_keys"], list):
        default["seen_trade_keys"] = []
    if not isinstance(default["hp_open_qty"], int):
        default["hp_open_qty"] = 0
    return default


def save_state(state: Dict[str, Any]) -> str:
    state["debug_logs"] = state.get("debug_logs", [])[-MAX_DEBUG_LOGS:]
    state["seen_trade_keys"] = state.get("seen_trade_keys", [])[-200:]
    for values in state.get("residual_history", {}).values():
        if isinstance(values, list) and len(values) > MAX_HISTORY:
            del values[: len(values) - MAX_HISTORY]
    return json.dumps(state, separators=(",", ":"))


def update_day_counter(state: Dict[str, Any], timestamp: int) -> None:
    last_ts = int(state.get("last_ts", -1))
    if last_ts >= 0 and timestamp + 50_000 < last_ts:
        state["day_index"] = int(state.get("day_index", 0)) + 1
        state["hp_avg_entry"] = None
        state["hp_open_qty"] = 0
    state["last_ts"] = timestamp


def log_decision(
    state: Dict[str, Any],
    timestamp: int,
    fair: Optional[float],
    adjusted_fair: Optional[float],
    best_bid: Optional[int],
    best_ask: Optional[int],
    z_score: Optional[float],
    edge: Optional[float],
    position: int,
    order_size: int,
    reason: str,
) -> None:
    logs = state.setdefault("debug_logs", [])
    logs.append(
        {
            "ts": timestamp,
            "product": HP,
            "fair": round(fair, 3) if fair is not None else None,
            "adjusted_fair": round(adjusted_fair, 3) if adjusted_fair is not None else None,
            "best_bid": best_bid,
            "best_ask": best_ask,
            "z": round(z_score, 3) if z_score is not None else None,
            "edge": round(edge, 3) if edge is not None else None,
            "position": position,
            "order_size": order_size,
            "reason": reason,
        }
    )
    if len(logs) > MAX_DEBUG_LOGS:
        del logs[: len(logs) - MAX_DEBUG_LOGS]


def trade_key(trade: Trade) -> str:
    return f"{getattr(trade, 'timestamp', 0)}|{trade.symbol}|{trade.price}|{trade.quantity}|{trade.buyer}|{trade.seller}"


def update_avg_entry_from_own_trades(state: Dict[str, Any], trading_state: TradingState) -> None:
    seen = set(state.setdefault("seen_trade_keys", []))
    avg_entry = state.get("hp_avg_entry")
    open_qty = int(state.get("hp_open_qty", 0) or 0)

    for trade in trading_state.own_trades.get(HP, []):
        key = trade_key(trade)
        if key in seen:
            continue
        seen.add(key)
        qty = int(trade.quantity)
        price = float(trade.price)
        is_buy = str(getattr(trade, "buyer", "")).upper() == "SUBMISSION"
        is_sell = str(getattr(trade, "seller", "")).upper() == "SUBMISSION"

        if is_buy:
            if open_qty <= 0 or avg_entry is None:
                avg_entry = price
                open_qty = qty
            else:
                avg_entry = (float(avg_entry) * open_qty + price * qty) / (open_qty + qty)
                open_qty += qty
        elif is_sell:
            open_qty = max(0, open_qty - qty)
            if open_qty == 0:
                avg_entry = None

    state["seen_trade_keys"] = list(seen)[-200:]
    state["hp_avg_entry"] = avg_entry
    state["hp_open_qty"] = open_qty


def choose_buy_size(z_score: float, edge: float, position: int) -> int:
    desired = BASE_ORDER_SIZE
    if z_score <= -STRONG_Z or edge >= STRONG_EDGE:
        desired = STRONG_ORDER_SIZE
    return position_safe_buy_size(desired, position)


def hp_orders(state: Dict[str, Any], trading_state: TradingState) -> List[Order]:
    depth = trading_state.order_depths.get(HP)
    if depth is None:
        return []

    bba = get_best_bid_ask(depth)
    mid = get_midprice(depth)
    position = int(trading_state.position.get(HP, 0))
    if bba is None or mid is None:
        log_decision(state, trading_state.timestamp, None, None, None, None, None, None, position, 0, "HP_NO_BOOK")
        return []

    best_bid, bid_vol, best_ask, ask_vol = bba
    spread = best_ask - best_bid
    fair = update_ema(state, HP, mid, EMA_ALPHA)
    adjusted_fair = inventory_adjusted_fair(fair, position)
    residual = mid - fair
    z_score, residual_std = rolling_z_score(state, HP, residual)

    spread_buffer = SPREAD_BUFFER_FRAC * spread
    threshold = BASE_THRESHOLD + spread_buffer
    buy_edge = adjusted_fair - best_ask
    sell_edge = best_bid - adjusted_fair

    avg_entry = state.get("hp_avg_entry")
    underwater_ticks = 0.0
    if avg_entry is not None and position > 0:
        underwater_ticks = max(0.0, float(avg_entry) - best_bid)

    orders: List[Order] = []

    late_flatten = trading_state.timestamp >= LATE_FLATTEN_TS and position > 0
    invalidation = (
        position >= INVALIDATION_MIN_POSITION
        and underwater_ticks >= INVALIDATION_MAX_UNDERWATER_TICKS
        and z_score > -0.25
    )
    sell_signal = position > 0 and (
        sell_edge > threshold
        and z_score >= SELL_Z
    )
    buy_signal = (
        position < PRACTICAL_CAP
        and best_ask < adjusted_fair - threshold
        and z_score <= BUY_Z
        and buy_edge > threshold
    )

    if late_flatten:
        desired = position
        size = position_safe_sell_size(desired, position)
        reason = (
            f"HP_LATE_FLATTEN z={z_score:.2f} std={residual_std:.2f} "
            f"sell_edge={sell_edge:.2f} avg_entry={avg_entry}"
        )
        log_decision(state, trading_state.timestamp, fair, adjusted_fair, best_bid, best_ask, z_score, sell_edge, position, -size, reason)
        if size > 0:
            orders.append(Order(HP, best_bid, -size))
    elif invalidation:
        desired = min(INVALIDATION_REDUCE_SIZE, position)
        size = position_safe_sell_size(desired, position)
        reason = (
            f"HP_INVALIDATION_REDUCE underwater={underwater_ticks:.2f} "
            f"z={z_score:.2f} std={residual_std:.2f} avg_entry={avg_entry}"
        )
        log_decision(state, trading_state.timestamp, fair, adjusted_fair, best_bid, best_ask, z_score, sell_edge, position, -size, reason)
        if size > 0:
            orders.append(Order(HP, best_bid, -size))
    elif sell_signal:
        desired = STRONG_ORDER_SIZE if (z_score >= STRONG_Z or sell_edge >= STRONG_EDGE) else BASE_ORDER_SIZE
        size = position_safe_sell_size(desired, position)
        reason = f"HP_SELL_MEAN_REVERSION z={z_score:.2f} std={residual_std:.2f} edge={sell_edge:.2f}"
        log_decision(state, trading_state.timestamp, fair, adjusted_fair, best_bid, best_ask, z_score, sell_edge, position, -size, reason)
        if size > 0:
            orders.append(Order(HP, best_bid, -size))
    elif buy_signal:
        size = choose_buy_size(z_score, buy_edge, position)
        size = min(size, ask_vol)
        reason = f"HP_BUY_MEAN_REVERSION z={z_score:.2f} std={residual_std:.2f} edge={buy_edge:.2f}"
        log_decision(state, trading_state.timestamp, fair, adjusted_fair, best_bid, best_ask, z_score, buy_edge, position, size, reason)
        if size > 0:
            orders.append(Order(HP, best_ask, size))
    else:
        edge = buy_edge if abs(buy_edge) >= abs(sell_edge) else sell_edge
        reason = (
            f"HP_NO_TRADE z={z_score:.2f} std={residual_std:.2f} "
            f"buy_edge={buy_edge:.2f} sell_edge={sell_edge:.2f} threshold={threshold:.2f} "
            f"avg_entry={avg_entry}"
        )
        log_decision(state, trading_state.timestamp, fair, adjusted_fair, best_bid, best_ask, z_score, edge, position, 0, reason)

    return orders


class Trader:
    def run(self, state: TradingState):
        persistent = load_state(state.traderData)
        update_day_counter(persistent, state.timestamp)
        update_avg_entry_from_own_trades(persistent, state)

        orders = hp_orders(persistent, state)
        result: Dict[str, List[Order]] = {}
        if orders:
            result[HP] = orders

        return result, 0, save_state(persistent)
