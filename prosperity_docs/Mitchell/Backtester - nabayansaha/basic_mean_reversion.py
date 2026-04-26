import json
import math
from typing import Dict, List

from datamodel import Order, OrderDepth, TradingState


class Trader:
    POSITION_LIMITS = {
        "EMERALDS": 80,
        "TOMATOES": 80,
    }

    PARAMS = {
        "EMERALDS": {
            "window": 6,
            "fallback_fair": 10000.0,
            "take_width": 1.0,
            "make_width": 2.0,
            "inventory_skew": 0.15,
            "quote_size": 12,
        },
        "TOMATOES": {
            "window": 12,
            "fallback_fair": 4993.0,
            "take_width": 1.5,
            "make_width": 2.0,
            "inventory_skew": 0.10,
            "quote_size": 10,
        },
    }

    def load_history(self, trader_data: str) -> Dict[str, List[float]]:
        if not trader_data:
            return {}

        try:
            payload = json.loads(trader_data)
            raw_history = payload.get("mid_prices", {})
            return {
                product: [float(price) for price in prices]
                for product, prices in raw_history.items()
                if isinstance(prices, list)
            }
        except (json.JSONDecodeError, TypeError, ValueError):
            return {}

    def save_history(self, history: Dict[str, List[float]]) -> str:
        return json.dumps({"mid_prices": history}, separators=(",", ":"))

    def get_fair_value(self, product: str, mid_price: float, history: Dict[str, List[float]]) -> float:
        params = self.PARAMS.get(
            product,
            {
                "window": 10,
                "fallback_fair": mid_price,
            },
        )

        series = history.setdefault(product, [])
        series.append(mid_price)
        history[product] = series[-params["window"] :]

        if product == "EMERALDS":
            return params["fallback_fair"]

        return sum(history[product]) / len(history[product]) if history[product] else params["fallback_fair"]

    def take_orders(
        self,
        product: str,
        order_depth: OrderDepth,
        fair_value: float,
        take_width: float,
        position: int,
        limit: int,
    ) -> tuple[list[Order], int]:
        orders: list[Order] = []
        current_position = position

        for ask_price, ask_volume in sorted(order_depth.sell_orders.items()):
            available_to_buy = limit - current_position
            if available_to_buy <= 0:
                break

            ask_quantity = -ask_volume
            should_buy = ask_price <= fair_value - take_width or (current_position < 0 and ask_price <= fair_value)
            if should_buy:
                quantity = min(available_to_buy, ask_quantity)
                if quantity > 0:
                    orders.append(Order(product, ask_price, quantity))
                    current_position += quantity

        for bid_price, bid_volume in sorted(order_depth.buy_orders.items(), reverse=True):
            available_to_sell = limit + current_position
            if available_to_sell <= 0:
                break

            should_sell = bid_price >= fair_value + take_width or (current_position > 0 and bid_price >= fair_value)
            if should_sell:
                quantity = min(available_to_sell, bid_volume)
                if quantity > 0:
                    orders.append(Order(product, bid_price, -quantity))
                    current_position -= quantity

        return orders, current_position

    def make_orders(
        self,
        product: str,
        order_depth: OrderDepth,
        fair_value: float,
        position: int,
        limit: int,
        quote_size: int,
        make_width: float,
    ) -> list[Order]:
        if not order_depth.buy_orders or not order_depth.sell_orders:
            return []

        best_bid = max(order_depth.buy_orders)
        best_ask = min(order_depth.sell_orders)

        bid_quote = min(best_bid + 1, math.floor(fair_value - make_width))
        ask_quote = max(best_ask - 1, math.ceil(fair_value + make_width))

        if bid_quote >= ask_quote:
            bid_quote = best_bid
            ask_quote = best_ask

        buy_size = min(quote_size, limit - position)
        sell_size = min(quote_size, limit + position)

        if position < 0:
            buy_size = min(limit - position, quote_size + min(-position, quote_size))
        elif position > 0:
            sell_size = min(limit + position, quote_size + min(position, quote_size))

        orders: list[Order] = []
        if buy_size > 0:
            orders.append(Order(product, bid_quote, buy_size))
        if sell_size > 0:
            orders.append(Order(product, ask_quote, -sell_size))

        return orders

    def run(self, state: TradingState):
        history = self.load_history(state.traderData)
        result: dict[str, list[Order]] = {}

        for product, order_depth in state.order_depths.items():
            if product not in self.PARAMS:
                result[product] = []
                continue

            params = self.PARAMS[product]

            if not order_depth.buy_orders or not order_depth.sell_orders:
                result[product] = []
                continue

            best_bid = max(order_depth.buy_orders)
            best_ask = min(order_depth.sell_orders)
            mid_price = (best_bid + best_ask) / 2
            base_fair_value = self.get_fair_value(product, mid_price, history)

            position = state.position.get(product, 0)
            adjusted_fair_value = base_fair_value - position * params["inventory_skew"]
            limit = self.POSITION_LIMITS.get(product, 50)

            orders, projected_position = self.take_orders(
                product=product,
                order_depth=order_depth,
                fair_value=adjusted_fair_value,
                take_width=params["take_width"],
                position=position,
                limit=limit,
            )

            orders.extend(
                self.make_orders(
                    product=product,
                    order_depth=order_depth,
                    fair_value=adjusted_fair_value,
                    position=projected_position,
                    limit=limit,
                    quote_size=params["quote_size"],
                    make_width=params["make_width"],
                )
            )

            result[product] = orders

        return result, 0, self.save_history(history)
