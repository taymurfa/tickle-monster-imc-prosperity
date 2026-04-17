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

# ── Osmium: mean-reverting market maker ─────────────────────────────────────
OSMIUM_SPREAD_OFFSET = 2.5    # ticks either side of reservation for passive quotes
OSMIUM_TAKER_EDGE    = 1.0    # take if price is this many ticks better than fair (selective)
OSMIUM_SKEW_COEFF    = 0.01   # minimal linear lean; quad term handles extremes
OSMIUM_SKEW_QUAD_MUL = 10.0   # quadratic skew multiplier
OSMIUM_QUOTE_SIZE    = 12     # units per passive chunk
OSMIUM_TAKE_SIZE     = 10     # max taker size per tick
OSMIUM_EMA_ALPHA     = 0.05   # EMA for fair value tracking
OSMIUM_INVENTORY_THROTTLE_THR = 60   # 75% of limit — tighten taker edge beyond here

# ── Pepper Root: directional trend-following accumulator ──────────────────────
# Price rises at a constant rate. Strategy: accumulate a large long position
# as cheaply as possible (prefer passive fills), hold it, capture the trend.
#
# Linear fair value model:
#   fair(t) = base_ema + TREND_SLOPE * timestamp
#   base_ema tracks implied_base = mid - TREND_SLOPE * ts (near-constant each day)
#
# Tiered accumulation:
#   pos < TAKER_THR           : take asks aggressively to build base position fast
#   TAKER_THR <= pos < TARGET : post passive bids at best_bid (earn the spread)
#   pos >= TARGET             : stop buying; hold and capture trend
#
# Opportunistic: sell to bots that overbid, buy from bots that underask.
PEPPER_TREND_SLOPE   = 0.001   # ticks per timestamp (observed across all 3 days)
PEPPER_BASE_EMA      = 0.002   # very slow EMA to track day intercept
PEPPER_TARGET_POS    = 79      # hold up to 79 long (1 below hard limit, no ping-pong)
PEPPER_TAKER_THR     = 60      # take aggressively below this; passive above
PEPPER_QUOTE_SIZE    = 15      # units per passive bid chunk
PEPPER_TAKER_SIZE    = 15      # units per aggressive taker fill
PEPPER_BAD_BID_EDGE  = 8.0     # sell if someone bids >= linear_fair + 8
PEPPER_BAD_ASK_EDGE  = 5.0     # buy if someone asks <= linear_fair - 5
PEPPER_EMERGENCY_THR = 80      # only emergency-sell if at hard position limit


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


class Trader:
    def run(self, state: TradingState) -> tuple:
        data = self._load_state(state.traderData)
        result: Dict[str, List[Order]] = {}

        if OSMIUM in state.order_depths:
            s = self._get_product_state(data, "o")
            result[OSMIUM], data["o"] = self._trade_osmium(
                state, s,
            )

        if PEPPER in state.order_depths:
            s = self._get_product_state(data, "p")
            result[PEPPER], data["p"] = self._trade_pepper(
                state, s,
            )

        return result, 0, json.dumps(data, separators=(",", ":"))

    # ─────────────────────────────────────────────────────────────────────────
    # Core per-product logic
    # ─────────────────────────────────────────────────────────────────────────

    def _trade_osmium(
        self,
        state: TradingState,
        product_state: Dict[str, Any],
    ) -> tuple[List[Order], Dict[str, Any]]:
        product = OSMIUM
        order_depth = state.order_depths[product]
        position = state.position.get(product, 0)
        limit = LIMITS[product]
        book = self._book_snapshot(order_depth)
        orders: List[Order] = []
        tracker = {"buy": 0, "sell": 0}

        # ── 1. Fair value via microprice EMA ──────────────────────────────────
        micro = book["micro"]
        last_ema = self._safe_float(product_state.get("e"), micro if micro is not None else 0.0)
        ema = ((1.0 - OSMIUM_EMA_ALPHA) * last_ema + OSMIUM_EMA_ALPHA * micro
               if micro is not None else last_ema)
        # Track last microprice in state
        next_state = {"e": round(ema, 4)}
        if ema == 0.0:
            return orders, next_state

        # ── 2. Quadratic skew reservation price ───────────────────────────────
        #    Linear skew for |pos| <= 50% limit.
        #    Quadratic adjustment added once |pos| exceeds 50% of limit.
        #    Formula: adj = sign(pos) * (pos/limit)^2 * OSMIUM_SKEW_QUAD_MUL
        linear_adj = position * OSMIUM_SKEW_COEFF
        ratio = position / limit  # in [-1, 1]
        quad_adj = math.copysign(ratio ** 2, position) * OSMIUM_SKEW_QUAD_MUL
        reservation = ema - linear_adj - quad_adj

        # ── 4. Taker leg (inventory-throttled edge) ───────────────────────────
        #    As position approaches ±OSMIUM_INVENTORY_THROTTLE_THR, it becomes
        #    more expensive to extend the position and cheaper to reduce it.
        excess = max(0, abs(position) - OSMIUM_INVENTORY_THROTTLE_THR)  # noqa: F821
        if position >= 0:
            buy_edge  = OSMIUM_TAKER_EDGE + excess * 0.5   # costly to go longer
            sell_edge = max(0.1, OSMIUM_TAKER_EDGE - excess * 0.3)  # easy to reduce
        else:
            sell_edge = OSMIUM_TAKER_EDGE + excess * 0.5   # costly to go shorter
            buy_edge  = max(0.1, OSMIUM_TAKER_EDGE - excess * 0.3)  # easy to reduce
        buy_threshold  = reservation - buy_edge
        sell_threshold = reservation + sell_edge
        self._take_asks(product, order_depth, buy_threshold,
                        position, limit, tracker, orders, OSMIUM_TAKE_SIZE)
        self._take_bids(product, order_depth, sell_threshold,
                        position, limit, tracker, orders, OSMIUM_TAKE_SIZE)

        # ── 5. Passive maker quotes (adaptive spread) ──────────────────────────
        adaptive_offset = 1.5 if (book["spread"] is not None and book["spread"] > 4) else OSMIUM_SPREAD_OFFSET
        bid_price = self._passive_bid_price(
            reservation - adaptive_offset, book["best_bid"], book["best_ask"])
        if bid_price is not None:
            qty = min(OSMIUM_QUOTE_SIZE, self._buy_capacity(position, limit, tracker))
            if qty > 0:
                self._append_order(product, bid_price, qty, position, limit, tracker, orders)

        ask_price = self._passive_ask_price(
            reservation + adaptive_offset, book["best_bid"], book["best_ask"])
        if ask_price is not None:
            qty = min(OSMIUM_QUOTE_SIZE, self._sell_capacity(position, limit, tracker))
            if qty > 0:
                self._append_order(product, ask_price, -qty, position, limit, tracker, orders)

        return orders, next_state

    def _trade_pepper(
        self,
        state: TradingState,
        product_state: Dict[str, Any],
    ) -> tuple[List[Order], Dict[str, Any]]:
        product = PEPPER
        order_depth = state.order_depths[product]
        position = state.position.get(product, 0)
        limit = LIMITS[product]
        book = self._book_snapshot(order_depth)
        orders: List[Order] = []
        tracker = {"buy": 0, "sell": 0}

        micro = book["micro"]
        ts = state.timestamp
        if micro is None or micro == 0.0:
            return orders, product_state

        # 1. Linear fair value: base_ema tracks daily intercept, projected forward
        implied_base = micro - PEPPER_TREND_SLOPE * ts
        last_base = self._safe_float(product_state.get("b"), implied_base)
        base_ema = (1.0 - PEPPER_BASE_EMA) * last_base + PEPPER_BASE_EMA * implied_base
        linear_fair = base_ema + PEPPER_TREND_SLOPE * ts
        next_state = {"b": round(base_ema, 4)}

        # 2. Emergency: only if we're at the hard position limit
        if position >= PEPPER_EMERGENCY_THR and book["best_bid"] is not None:
            relief = min(position - PEPPER_EMERGENCY_THR + 1,
                         self._sell_capacity(position, limit, tracker))
            if relief > 0:
                self._append_order(product, int(book["best_bid"]), -relief,
                                   position, limit, tracker, orders)
            return orders, next_state

        # 3. Opportunistic: take bad asks (bot underpricing) regardless of position
        if book["best_ask"] is not None and book["best_ask"] <= linear_fair - PEPPER_BAD_ASK_EDGE:
            qty = self._buy_capacity(position, limit, tracker)
            if qty > 0:
                self._append_order(product, int(book["best_ask"]), qty,
                                   position, limit, tracker, orders)

        # 4. Opportunistic: sell to bad bids (bot overpricing)
        if book["best_bid"] is not None and book["best_bid"] >= linear_fair + PEPPER_BAD_BID_EDGE:
            qty = self._sell_capacity(position, limit, tracker)
            if qty > 0:
                self._append_order(product, int(book["best_bid"]), -qty,
                                   position, limit, tracker, orders)

        # 5. Tiered accumulation toward target
        if position < PEPPER_TAKER_THR:
            # Below threshold: cross the spread to build base position fast
            if book["best_ask"] is not None:
                qty = min(PEPPER_TAKER_SIZE,
                          PEPPER_TARGET_POS - position,
                          self._buy_capacity(position, limit, tracker))
                if qty > 0:
                    self._append_order(product, int(book["best_ask"]), qty,
                                       position, limit, tracker, orders)
        elif position < PEPPER_TARGET_POS:
            # Above threshold but below target: passive bid at best_bid (earn spread)
            if book["best_bid"] is not None:
                qty = min(PEPPER_QUOTE_SIZE,
                          PEPPER_TARGET_POS - position,
                          self._buy_capacity(position, limit, tracker))
                if qty > 0:
                    self._append_order(product, int(book["best_bid"]), qty,
                                       position, limit, tracker, orders)

        return orders, next_state

    # ─────────────────────────────────────────────────────────────────────────
    # Order book helpers
    # ─────────────────────────────────────────────────────────────────────────

    def _book_snapshot(self, order_depth: Any) -> Dict[str, Optional[float]]:
        buy_orders  = getattr(order_depth, "buy_orders",  {}) or {}
        sell_orders = getattr(order_depth, "sell_orders", {}) or {}

        best_bid = max(buy_orders)  if buy_orders  else None
        best_ask = min(sell_orders) if sell_orders else None

        bid_vol = ask_vol = 0
        if best_bid is not None and best_ask is not None:
            mid     = (best_bid + best_ask) / 2.0
            bid_vol = max(0, int( buy_orders.get(best_bid, 0)))
            ask_vol = max(0, int(-sell_orders.get(best_ask, 0)))
            if bid_vol > 0 and ask_vol > 0:
                micro = (best_bid * ask_vol + best_ask * bid_vol) / (bid_vol + ask_vol)
            else:
                micro = mid
        elif best_bid is not None:
            mid = micro = float(best_bid)
        elif best_ask is not None:
            mid = micro = float(best_ask)
        else:
            mid = micro = None

        spread = (best_ask - best_bid) if (best_bid is not None and best_ask is not None) else None
        return {"best_bid": best_bid, "best_ask": best_ask,
                "mid": mid, "micro": micro, "spread": spread,
                "bid_vol": bid_vol, "ask_vol": ask_vol}

    def _take_asks(
        self,
        product: str,
        order_depth: Any,
        max_price: float,
        position: int,
        limit: int,
        tracker: Dict[str, int],
        orders: List[Order],
        max_total: int,
    ) -> None:
        remaining = max_total
        for ask_price in sorted((getattr(order_depth, "sell_orders", {}) or {}).keys()):
            if ask_price > max_price or remaining <= 0:
                break
            available = max(0, int(-(order_depth.sell_orders.get(ask_price, 0))))
            if available <= 0:
                continue
            qty = min(available, remaining, self._buy_capacity(position, limit, tracker))
            if qty <= 0:
                break
            self._append_order(product, ask_price, qty, position, limit, tracker, orders)
            remaining -= qty

    def _take_bids(
        self,
        product: str,
        order_depth: Any,
        min_price: float,
        position: int,
        limit: int,
        tracker: Dict[str, int],
        orders: List[Order],
        max_total: int,
    ) -> None:
        remaining = max_total
        for bid_price in sorted((getattr(order_depth, "buy_orders", {}) or {}).keys(), reverse=True):
            if bid_price < min_price or remaining <= 0:
                break
            available = max(0, int(order_depth.buy_orders.get(bid_price, 0)))
            if available <= 0:
                continue
            qty = min(available, remaining, self._sell_capacity(position, limit, tracker))
            if qty <= 0:
                break
            self._append_order(product, bid_price, -qty, position, limit, tracker, orders)
            remaining -= qty

    def _passive_bid_price(
        self,
        desired: float,
        best_bid: Optional[float],
        best_ask: Optional[float],
    ) -> Optional[int]:
        price = int(math.floor(desired))
        if best_bid is not None:
            price = min(price, int(best_bid) + 1)
        if best_ask is not None:
            price = min(price, int(best_ask) - 1)
        return price if (best_ask is None or price < best_ask) else None

    def _passive_ask_price(
        self,
        desired: float,
        best_bid: Optional[float],
        best_ask: Optional[float],
    ) -> Optional[int]:
        price = int(math.ceil(desired))
        if best_ask is not None:
            price = max(price, int(best_ask) - 1)
        if best_bid is not None:
            price = max(price, int(best_bid) + 1)
        return price if (best_bid is None or price > best_bid) else None

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
        price    = int(price)
        if quantity > 0:
            quantity = min(quantity, self._buy_capacity(position, limit, tracker))
            if quantity <= 0:
                return
            tracker["buy"] += quantity
        elif quantity < 0:
            sell_qty = min(-quantity, self._sell_capacity(position, limit, tracker))
            if sell_qty <= 0:
                return
            quantity = -sell_qty
            tracker["sell"] += sell_qty
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
        val = data.get(key, {})
        return val if isinstance(val, dict) else {}

    def _safe_float(self, value: Any, default: float) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return float(default)




