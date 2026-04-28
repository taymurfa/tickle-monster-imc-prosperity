import json
from typing import Any, Dict, List, Optional, Tuple

try:
    from datamodel import Order, OrderDepth, TradingState
except ImportError:
    from prosperity4bt.datamodel import Order, OrderDepth, TradingState


LIMIT = 10
MAX_HISTORY = 1200

PEBBLE_CONFIG = {
    "PEBBLES_XL": {"window": 1000, "entry_low": 0.10, "entry_high": 0.90, "exit_low": 0.42, "exit_high": 0.58},
    "PEBBLES_M": {"window": 500, "entry_low": 0.10, "entry_high": 0.90, "exit_low": 0.42, "exit_high": 0.58},
    "PEBBLES_XS": {"window": 1000, "entry_low": 0.10, "entry_high": 0.90, "exit_low": 0.42, "exit_high": 0.58},
    "PEBBLES_S": {"window": 1000, "entry_low": 0.10, "entry_high": 0.90, "exit_low": 0.42, "exit_high": 0.58},
}


def load_state(blob: str) -> Dict[str, Any]:
    if not blob:
        return {}
    try:
        return json.loads(blob)
    except Exception:
        return {}


def save_state(state: Dict[str, Any]) -> str:
    histories = state.get("mid_history", {})
    for product, values in list(histories.items()):
        histories[product] = values[-MAX_HISTORY:]
    return json.dumps(state, separators=(",", ":"))


def best_bid_ask(depth: OrderDepth) -> Optional[Tuple[int, int, int, int]]:
    if not depth.buy_orders or not depth.sell_orders:
        return None
    best_bid = max(depth.buy_orders)
    best_ask = min(depth.sell_orders)
    return best_bid, int(depth.buy_orders[best_bid]), best_ask, int(-depth.sell_orders[best_ask])


def target_order(product: str, target: int, position: int, best_bid: int, best_ask: int) -> List[Order]:
    target = max(-LIMIT, min(LIMIT, target))
    delta = target - position
    if delta > 0:
        return [Order(product, best_ask, min(delta, LIMIT - position))]
    if delta < 0:
        return [Order(product, best_bid, -min(-delta, LIMIT + position))]
    return []


def pebble_target(product: str, position: int, mid: float, history: List[float]) -> int:
    cfg = PEBBLE_CONFIG[product]
    window = int(cfg["window"])
    if len(history) < window:
        return position

    recent = history[-window:]
    low = min(recent)
    high = max(recent)
    width = high - low
    if width <= 0:
        return position

    location = (mid - low) / width

    if location <= cfg["entry_low"]:
        return LIMIT
    if location >= cfg["entry_high"]:
        return -LIMIT

    if position > 0 and location >= cfg["exit_low"]:
        return 0
    if position < 0 and location <= cfg["exit_high"]:
        return 0

    return position


class Trader:
    def run(self, state: TradingState):
        data = load_state(state.traderData)
        histories = data.setdefault("mid_history", {})
        result: Dict[str, List[Order]] = {}

        for product in PEBBLE_CONFIG:
            depth = state.order_depths.get(product)
            if depth is None:
                continue
            bba = best_bid_ask(depth)
            if bba is None:
                continue

            best_bid, _, best_ask, _ = bba
            mid = (best_bid + best_ask) / 2.0
            history = histories.setdefault(product, [])

            position = int(state.position.get(product, 0))
            target = pebble_target(product, position, mid, history)
            orders = target_order(product, target, position, best_bid, best_ask)
            if orders:
                result[product] = orders

            history.append(mid)
            if len(history) > MAX_HISTORY:
                del history[: len(history) - MAX_HISTORY]

        return result, 0, save_state(data)
