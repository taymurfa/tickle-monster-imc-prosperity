from datamodel import Order, TradingState
from typing import Any, Dict, List, Optional
import json
import math


PEPPER = "INTARIAN_PEPPER_ROOT"
OSMIUM = "ASH_COATED_OSMIUM"

LIMITS: Dict[str, int] = {
    PEPPER: 80,
    OSMIUM: 80,
}

# Pepper Root: simple long-bias accumulator with minimal adaptation.
PEPPER_DRIFT_PER_TICK = 0.001
PEPPER_TWO_SIDED_ALPHA = 0.10
PEPPER_ONE_SIDED_ALPHA = 0.03
PEPPER_SPREAD_ALPHA = 0.25
PEPPER_SPREAD_GUESS = 12.0
PEPPER_ACTIVE_EDGE = 0.5
PEPPER_PASSIVE_EDGE = 2.5
PEPPER_DIP_TRIGGER = 2.0
PEPPER_DIP_EXTRA_EDGE = 0.75
PEPPER_DIP_TAKE_BONUS = 6
PEPPER_SOFT_LONG_LIMIT = 58
PEPPER_HARD_LONG_LIMIT = 72

# Osmium: anchored mean reversion with a live fair around the 10_000 prior.
OSMIUM_ANCHOR = 10_000.0
OSMIUM_EMA_ALPHA = 0.25
OSMIUM_TAKE_EDGE = 1.5
OSMIUM_PASSIVE_EDGE = 2.5
OSMIUM_POSITION_SKEW = 0.08
OSMIUM_BASE_QUOTE_SIZE = 16
OSMIUM_RELIEF_THRESHOLD = 40
OSMIUM_RELIEF_EDGE = 0.5
OSMIUM_INFORMATIVE_SPREAD = 6.0
OSMIUM_INFORMATIVE_LIVE_WEIGHT = 0.72
OSMIUM_WEAK_LIVE_WEIGHT = 0.38


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


class Trader:
    def run(self, state: TradingState) -> tuple:
        data = self._load_state(state.traderData)
        result: Dict[str, List[Order]] = {}

        if PEPPER in state.order_depths:
            pepper_state = self._get_product_state(data, "p")
            result[PEPPER], data["p"] = self._trade_pepper(state, pepper_state)

        if OSMIUM in state.order_depths:
            osmium_state = self._get_product_state(data, "o")
            result[OSMIUM], data["o"] = self._trade_osmium(state, osmium_state)

        return result, 0, json.dumps(data, separators=(",", ":"))

    def _trade_pepper(self, state: TradingState, product_state: Dict[str, Any]) -> tuple[List[Order], Dict[str, Any]]:
        product = PEPPER
        order_depth = state.order_depths[product]
        position = state.position.get(product, 0)
        limit = LIMITS[product]
        book = self._book_snapshot(order_depth)

        reference, next_state = self._update_pepper_reference(product_state, state.timestamp, book)

        orders: List[Order] = []
        tracker = {"buy": 0, "sell": 0}

        live_position = self._live_position(position, tracker)
        buy_threshold = reference + PEPPER_ACTIVE_EDGE
        take_size = self._pepper_take_size(live_position)
        best_ask = book["best_ask"]

        if best_ask is not None and best_ask <= reference - PEPPER_DIP_TRIGGER:
            buy_threshold += PEPPER_DIP_EXTRA_EDGE
            take_size += self._pepper_dip_take_bonus(live_position)

        if live_position >= PEPPER_SOFT_LONG_LIMIT:
            buy_threshold = min(buy_threshold, reference)
        if live_position >= PEPPER_HARD_LONG_LIMIT:
            buy_threshold = reference - 1.0
        self._take_asks(
            product,
            order_depth,
            buy_threshold,
            position,
            limit,
            tracker,
            orders,
            take_size,
        )

        live_position = self._live_position(position, tracker)
        self._post_pepper_bid(book, reference, position, limit, tracker, orders, live_position)

        return orders, next_state

    def _trade_osmium(self, state: TradingState, product_state: Dict[str, Any]) -> tuple[List[Order], Dict[str, Any]]:
        product = OSMIUM
        order_depth = state.order_depths[product]
        position = state.position.get(product, 0)
        limit = LIMITS[product]
        book = self._book_snapshot(order_depth)
        trade_ref = self._trade_reference(state, product)

        fair, next_state = self._update_osmium_fair(product_state, book, trade_ref)

        orders: List[Order] = []
        tracker = {"buy": 0, "sell": 0}

        buy_threshold = fair - OSMIUM_TAKE_EDGE
        sell_threshold = fair + OSMIUM_TAKE_EDGE

        if position <= -OSMIUM_RELIEF_THRESHOLD:
            buy_threshold = fair + OSMIUM_RELIEF_EDGE
        if position >= OSMIUM_RELIEF_THRESHOLD:
            sell_threshold = fair - OSMIUM_RELIEF_EDGE

        self._take_asks(product, order_depth, buy_threshold, position, limit, tracker, orders)
        self._take_bids(product, order_depth, sell_threshold, position, limit, tracker, orders)

        live_position = self._live_position(position, tracker)
        self._inventory_relief(
            product,
            book,
            fair,
            position,
            live_position,
            limit,
            tracker,
            orders,
            OSMIUM_RELIEF_THRESHOLD,
            OSMIUM_RELIEF_EDGE,
            OSMIUM_BASE_QUOTE_SIZE,
        )

        live_position = self._live_position(position, tracker)
        reservation_fair = fair - live_position * OSMIUM_POSITION_SKEW
        buy_size, sell_size = self._quote_sizes(live_position, OSMIUM_BASE_QUOTE_SIZE)
        self._post_quotes(
            product,
            fair,
            reservation_fair,
            book,
            position,
            limit,
            tracker,
            orders,
            OSMIUM_PASSIVE_EDGE,
            buy_size,
            sell_size,
        )

        return orders, next_state

    def _update_pepper_reference(
        self,
        product_state: Dict[str, Any],
        timestamp: int,
        book: Dict[str, Optional[float]],
    ) -> tuple[float, Dict[str, Any]]:
        last_spread = self._safe_float(product_state.get("sp"), PEPPER_SPREAD_GUESS)
        spread = max(2.0, last_spread)
        if book["spread"] is not None:
            spread = (1.0 - PEPPER_SPREAD_ALPHA) * spread + PEPPER_SPREAD_ALPHA * book["spread"]

        if book["best_bid"] is not None and book["best_ask"] is not None:
            observed = book["mid"] if book["mid"] is not None else book["micro"]
            alpha = PEPPER_TWO_SIDED_ALPHA
        elif book["best_ask"] is not None:
            observed = float(book["best_ask"]) - spread / 2.0
            alpha = PEPPER_ONE_SIDED_ALPHA
        elif book["best_bid"] is not None:
            observed = float(book["best_bid"]) + spread / 2.0
            alpha = PEPPER_ONE_SIDED_ALPHA
        else:
            observed = None
            alpha = 0.0

        last_reference = self._safe_float(product_state.get("r"), observed if observed is not None else 0.0)
        last_timestamp = int(product_state.get("t", timestamp))
        dt = max(1, timestamp - last_timestamp)
        drifted_reference = last_reference + PEPPER_DRIFT_PER_TICK * dt

        if observed is None:
            reference = drifted_reference
        elif last_reference == 0.0:
            reference = observed
        else:
            reference = drifted_reference + alpha * (observed - drifted_reference)

        reference = round(reference, 4)
        next_state = {
            "r": reference,
            "sp": round(spread, 4),
            "t": int(timestamp),
        }
        return reference, next_state

    def _update_osmium_fair(
        self,
        product_state: Dict[str, Any],
        book: Dict[str, Optional[float]],
        trade_ref: Optional[float],
    ) -> tuple[float, Dict[str, Any]]:
        micro = book["micro"]
        mid = book["mid"]
        reference = micro if micro is not None else mid
        last_ema = self._safe_float(product_state.get("e"), OSMIUM_ANCHOR)
        last_fair = self._safe_float(product_state.get("f"), OSMIUM_ANCHOR)

        if reference is None:
            ema = last_ema
        else:
            ema = (1.0 - OSMIUM_EMA_ALPHA) * last_ema + OSMIUM_EMA_ALPHA * reference

        if micro is not None and mid is not None:
            live_book = 0.65 * micro + 0.35 * mid
        elif reference is not None:
            live_book = reference
        else:
            live_book = ema

        if trade_ref is not None:
            live_component = 0.80 * live_book + 0.20 * trade_ref
        else:
            live_component = 0.85 * live_book + 0.15 * ema

        informative_book = (
            book["best_bid"] is not None
            and book["best_ask"] is not None
            and book["spread"] is not None
            and book["spread"] <= OSMIUM_INFORMATIVE_SPREAD
        )
        live_weight = OSMIUM_INFORMATIVE_LIVE_WEIGHT if informative_book else OSMIUM_WEAK_LIVE_WEIGHT

        fair = (1.0 - live_weight) * OSMIUM_ANCHOR + live_weight * live_component
        fair = _clamp(fair, OSMIUM_ANCHOR - 30.0, OSMIUM_ANCHOR + 30.0)

        if reference is None and trade_ref is None:
            fair = last_fair

        fair = round(fair, 4)
        next_state = {
            "e": round(ema, 4),
            "f": fair,
        }
        return fair, next_state

    def _book_snapshot(self, order_depth: Any) -> Dict[str, Optional[float]]:
        buy_orders = getattr(order_depth, "buy_orders", {}) or {}
        sell_orders = getattr(order_depth, "sell_orders", {}) or {}

        best_bid = max(buy_orders) if buy_orders else None
        best_ask = min(sell_orders) if sell_orders else None

        if best_bid is not None and best_ask is not None:
            mid = (best_bid + best_ask) / 2.0
            bid_volume = max(0, int(buy_orders.get(best_bid, 0)))
            ask_volume = max(0, int(-sell_orders.get(best_ask, 0)))
            if bid_volume > 0 and ask_volume > 0:
                micro = (best_bid * ask_volume + best_ask * bid_volume) / (bid_volume + ask_volume)
            else:
                micro = mid
        elif best_bid is not None:
            mid = float(best_bid)
            micro = mid
        elif best_ask is not None:
            mid = float(best_ask)
            micro = mid
        else:
            mid = None
            micro = None

        spread = None
        if best_bid is not None and best_ask is not None:
            spread = best_ask - best_bid

        return {
            "best_bid": best_bid,
            "best_ask": best_ask,
            "mid": mid,
            "micro": micro,
            "spread": spread,
        }

    def _trade_reference(self, state: TradingState, product: str) -> Optional[float]:
        market_trades = getattr(state, "market_trades", {}) or {}
        trades = market_trades.get(product, [])
        total_qty = 0
        total_notional = 0.0

        for trade in trades:
            price = getattr(trade, "price", None)
            quantity = abs(int(getattr(trade, "quantity", 0)))
            if price is None or quantity <= 0:
                continue
            total_qty += quantity
            total_notional += float(price) * quantity

        if total_qty == 0:
            return None

        return total_notional / total_qty

    def _post_pepper_bid(
        self,
        book: Dict[str, Optional[float]],
        reference: float,
        position: int,
        limit: int,
        tracker: Dict[str, int],
        orders: List[Order],
        live_position: int,
    ) -> None:
        if live_position >= PEPPER_HARD_LONG_LIMIT:
            return
        if book["best_bid"] is None and book["best_ask"] is None:
            return

        desired_bid = reference - PEPPER_PASSIVE_EDGE
        if live_position >= PEPPER_SOFT_LONG_LIMIT:
            desired_bid -= 1.0
        bid_price = self._passive_bid_price(desired_bid, book["best_bid"], book["best_ask"])
        if bid_price is None:
            return

        quantity = min(self._pepper_bid_size(live_position), self._buy_capacity(position, limit, tracker))
        self._append_order(PEPPER, bid_price, quantity, position, limit, tracker, orders)

    def _pepper_take_size(self, live_position: int) -> int:
        if live_position < 0:
            return 22
        if live_position < 20:
            return 14
        if live_position < 40:
            return 10
        if live_position < PEPPER_SOFT_LONG_LIMIT:
            return 6
        if live_position < PEPPER_HARD_LONG_LIMIT:
            return 3
        return 0

    def _pepper_bid_size(self, live_position: int) -> int:
        if live_position < 0:
            return 16
        if live_position < 20:
            return 10
        if live_position < 40:
            return 6
        if live_position < PEPPER_SOFT_LONG_LIMIT:
            return 4
        if live_position < PEPPER_HARD_LONG_LIMIT:
            return 2
        return 0

    def _pepper_dip_take_bonus(self, live_position: int) -> int:
        if live_position < 20:
            return PEPPER_DIP_TAKE_BONUS
        if live_position < 40:
            return 4
        if live_position < PEPPER_SOFT_LONG_LIMIT:
            return 2
        return 0

    def _take_asks(
        self,
        product: str,
        order_depth: Any,
        max_price: float,
        position: int,
        limit: int,
        tracker: Dict[str, int],
        orders: List[Order],
        max_total: Optional[int] = None,
    ) -> None:
        remaining = None if max_total is None else max(0, int(max_total))
        for ask_price in sorted((getattr(order_depth, "sell_orders", {}) or {}).keys()):
            if ask_price > max_price:
                break
            if remaining is not None and remaining <= 0:
                break
            available = max(0, int(-(order_depth.sell_orders.get(ask_price, 0))))
            if available <= 0:
                continue
            quantity = min(available, self._buy_capacity(position, limit, tracker))
            if remaining is not None:
                quantity = min(quantity, remaining)
            self._append_order(product, ask_price, quantity, position, limit, tracker, orders)
            if remaining is not None:
                remaining -= quantity
            if self._buy_capacity(position, limit, tracker) <= 0:
                break

    def _take_bids(
        self,
        product: str,
        order_depth: Any,
        min_price: float,
        position: int,
        limit: int,
        tracker: Dict[str, int],
        orders: List[Order],
    ) -> None:
        for bid_price in sorted((getattr(order_depth, "buy_orders", {}) or {}).keys(), reverse=True):
            if bid_price < min_price:
                break
            available = max(0, int(order_depth.buy_orders.get(bid_price, 0)))
            if available <= 0:
                continue
            quantity = min(available, self._sell_capacity(position, limit, tracker))
            self._append_order(product, bid_price, -quantity, position, limit, tracker, orders)
            if self._sell_capacity(position, limit, tracker) <= 0:
                break

    def _inventory_relief(
        self,
        product: str,
        book: Dict[str, Optional[float]],
        fair: float,
        position: int,
        live_position: int,
        limit: int,
        tracker: Dict[str, int],
        orders: List[Order],
        threshold: int,
        edge: float,
        clip_size: int,
    ) -> None:
        if live_position > threshold and book["best_bid"] is not None and book["best_bid"] >= fair - edge:
            quantity = min(live_position - threshold, clip_size, self._sell_capacity(position, limit, tracker))
            self._append_order(product, int(book["best_bid"]), -quantity, position, limit, tracker, orders)

        if live_position < -threshold and book["best_ask"] is not None and book["best_ask"] <= fair + edge:
            quantity = min((-live_position) - threshold, clip_size, self._buy_capacity(position, limit, tracker))
            self._append_order(product, int(book["best_ask"]), quantity, position, limit, tracker, orders)

    def _post_quotes(
        self,
        product: str,
        fair: float,
        reservation_fair: float,
        book: Dict[str, Optional[float]],
        position: int,
        limit: int,
        tracker: Dict[str, int],
        orders: List[Order],
        passive_edge: float,
        buy_size: int,
        sell_size: int,
    ) -> None:
        desired_bid = reservation_fair - passive_edge
        desired_ask = reservation_fair + passive_edge
        bid_price = self._passive_bid_price(desired_bid, book["best_bid"], book["best_ask"])
        ask_price = self._passive_ask_price(desired_ask, book["best_bid"], book["best_ask"])

        if bid_price is not None and ask_price is not None and bid_price >= ask_price:
            if self._live_position(position, tracker) > 0:
                bid_price = None
            elif self._live_position(position, tracker) < 0:
                ask_price = None
            else:
                bid_price = int(math.floor(min(desired_bid, fair - 1.0)))
                ask_price = int(math.ceil(max(desired_ask, fair + 1.0)))
                if bid_price >= ask_price:
                    bid_price = None
                    ask_price = None

        live_position = self._live_position(position, tracker)
        if bid_price is not None and buy_size > 0:
            should_quote_bid = bid_price < fair or live_position < 0
            if should_quote_bid:
                quantity = min(buy_size, self._buy_capacity(position, limit, tracker))
                self._append_order(product, bid_price, quantity, position, limit, tracker, orders)

        live_position = self._live_position(position, tracker)
        if ask_price is not None and sell_size > 0:
            should_quote_ask = ask_price > fair or live_position > 0
            if should_quote_ask:
                quantity = min(sell_size, self._sell_capacity(position, limit, tracker))
                self._append_order(product, ask_price, -quantity, position, limit, tracker, orders)

    def _passive_bid_price(
        self,
        desired_bid: float,
        best_bid: Optional[float],
        best_ask: Optional[float],
    ) -> Optional[int]:
        price = int(math.floor(desired_bid))
        if best_bid is not None:
            price = min(price, int(best_bid) + 1)
        if best_ask is not None:
            price = min(price, int(best_ask) - 1)
        return price if best_ask is None or price < best_ask else None

    def _passive_ask_price(
        self,
        desired_ask: float,
        best_bid: Optional[float],
        best_ask: Optional[float],
    ) -> Optional[int]:
        price = int(math.ceil(desired_ask))
        if best_ask is not None:
            price = max(price, int(best_ask) - 1)
        if best_bid is not None:
            price = max(price, int(best_bid) + 1)
        return price if best_bid is None or price > best_bid else None

    def _quote_sizes(self, live_position: int, base_size: int) -> tuple[int, int]:
        offset = abs(live_position) // 8
        if live_position > 0:
            buy_size = max(4, base_size - offset)
            sell_size = min(base_size + offset, base_size * 2)
        elif live_position < 0:
            buy_size = min(base_size + offset, base_size * 2)
            sell_size = max(4, base_size - offset)
        else:
            buy_size = base_size
            sell_size = base_size
        return buy_size, sell_size

    def _append_order(
        self,
        product: str,
        price: int,
        quantity: int,
        position: int,
        limit: int,
        tracker: Dict[str, int],
        orders: List[Order],
    ) -> None:
        quantity = int(quantity)
        price = int(price)

        if quantity > 0:
            quantity = min(quantity, self._buy_capacity(position, limit, tracker))
            if quantity <= 0:
                return
            tracker["buy"] += quantity
        elif quantity < 0:
            sell_quantity = min(-quantity, self._sell_capacity(position, limit, tracker))
            if sell_quantity <= 0:
                return
            quantity = -sell_quantity
            tracker["sell"] += sell_quantity
        else:
            return

        orders.append(Order(product, price, quantity))

    def _buy_capacity(self, position: int, limit: int, tracker: Dict[str, int]) -> int:
        return max(0, limit - (position + tracker["buy"]))

    def _sell_capacity(self, position: int, limit: int, tracker: Dict[str, int]) -> int:
        return max(0, limit + (position - tracker["sell"]))

    def _live_position(self, position: int, tracker: Dict[str, int]) -> int:
        return position + tracker["buy"] - tracker["sell"]

    def _load_state(self, raw_state: str) -> Dict[str, Any]:
        if not raw_state:
            return {}
        try:
            data = json.loads(raw_state)
        except (TypeError, ValueError, json.JSONDecodeError):
            return {}
        return data if isinstance(data, dict) else {}

    def _get_product_state(self, data: Dict[str, Any], key: str) -> Dict[str, Any]:
        value = data.get(key, {})
        return value if isinstance(value, dict) else {}

    def _safe_float(self, value: Any, default: float) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return float(default)
