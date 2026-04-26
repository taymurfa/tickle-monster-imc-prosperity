from __future__ import annotations

import csv
import io
import json
import math
import re
import statistics
import sys
import types
from dataclasses import dataclass
from typing import Any, Optional

DEFAULT_LIMIT = 50
PRODUCT_POINT_STRIDE = 10
MAX_STATE_LOG_CHARS = 20_000
LIMITS = {
    "HYDROGEL_PACK": 200,
    "VELVETFRUIT_EXTRACT": 200,
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


class Listing:
    def __init__(self, symbol: str, product: str, denomination: int):
        self.symbol = symbol
        self.product = product
        self.denomination = denomination


class Observation:
    def __init__(self, plainValueObservations: dict[str, int], conversionObservations: dict[str, Any]):
        self.plainValueObservations = plainValueObservations
        self.conversionObservations = conversionObservations


class Order:
    def __init__(self, symbol: str, price: int, quantity: int):
        self.symbol = symbol
        self.price = price
        self.quantity = quantity


class OrderDepth:
    def __init__(self):
        self.buy_orders: dict[int, int] = {}
        self.sell_orders: dict[int, int] = {}


class Trade:
    def __init__(self, symbol: str, price: int, quantity: int, buyer: str = "", seller: str = "", timestamp: int = 0):
        self.symbol = symbol
        self.price = price
        self.quantity = quantity
        self.buyer = buyer
        self.seller = seller
        self.timestamp = timestamp


class TradingState:
    def __init__(
        self,
        traderData: str,
        timestamp: int,
        listings: dict[str, Listing],
        order_depths: dict[str, OrderDepth],
        own_trades: dict[str, list[Trade]],
        market_trades: dict[str, list[Trade]],
        position: dict[str, int],
        observations: Observation,
    ):
        self.traderData = traderData
        self.timestamp = timestamp
        self.listings = listings
        self.order_depths = order_depths
        self.own_trades = own_trades
        self.market_trades = market_trades
        self.position = position
        self.observations = observations


@dataclass
class PriceRow:
    day: int
    timestamp: int
    product: str
    bid_prices: list[int]
    bid_volumes: list[int]
    ask_prices: list[int]
    ask_volumes: list[int]
    mid_price: float


def _get_values(row: dict[str, str], prefix: str) -> tuple[list[int], list[int]]:
    prices: list[int] = []
    volumes: list[int] = []
    for i in range(1, 4):
        p = row.get(f"{prefix}_price_{i}", "")
        v = row.get(f"{prefix}_volume_{i}", "")
        if p == "" or v == "":
            continue
        prices.append(int(float(p)))
        volumes.append(int(float(v)))
    return prices, volumes


def parse_prices_csv(text: str) -> tuple[dict[int, dict[str, PriceRow]], list[str], int]:
    rows = csv.DictReader(io.StringIO(text), delimiter=";")
    by_ts: dict[int, dict[str, PriceRow]] = {}
    products: set[str] = set()
    day_val = 0

    for row in rows:
        day_val = int(row["day"])
        ts = int(row["timestamp"])
        product = row["product"]
        bid_prices, bid_volumes = _get_values(row, "bid")
        ask_prices, ask_volumes = _get_values(row, "ask")
        entry = PriceRow(
            day=day_val,
            timestamp=ts,
            product=product,
            bid_prices=bid_prices,
            bid_volumes=bid_volumes,
            ask_prices=ask_prices,
            ask_volumes=ask_volumes,
            mid_price=float(row["mid_price"]),
        )

        by_ts.setdefault(ts, {})[product] = entry
        products.add(product)

    return by_ts, sorted(products), day_val


def parse_trades_csv(text: str) -> dict[int, dict[str, list[Trade]]]:
    if not text.strip():
        return {}

    rows = csv.DictReader(io.StringIO(text), delimiter=";")
    by_ts: dict[int, dict[str, list[Trade]]] = {}

    for row in rows:
        ts = int(row["timestamp"])
        symbol = row["symbol"]
        trade = Trade(
            symbol=symbol,
            price=int(float(row["price"])),
            quantity=int(float(row["quantity"])),
            buyer=row.get("buyer") or "",
            seller=row.get("seller") or "",
            timestamp=ts,
        )
        by_ts.setdefault(ts, {}).setdefault(symbol, []).append(trade)

    return by_ts


def _register_datamodel_module() -> None:
    module = types.ModuleType("datamodel")
    module.Listing = Listing
    module.Observation = Observation
    module.Order = Order
    module.OrderDepth = OrderDepth
    module.Trade = Trade
    module.TradingState = TradingState
    module.Symbol = str

    sys.modules["datamodel"] = module
    pkg = types.ModuleType("prosperity4bt")
    sys.modules["prosperity4bt"] = pkg
    sys.modules["prosperity4bt.datamodel"] = module


def _get_limit(symbol: str, overrides: Optional[dict[str, int]] = None) -> int:
    if overrides is not None and symbol in overrides:
        return overrides[symbol]
    return LIMITS.get(symbol, DEFAULT_LIMIT)


def _prepare_state(state: TradingState, prices_at_ts: dict[str, PriceRow]) -> None:
    state.order_depths = {}
    state.listings = {}

    for product, row in prices_at_ts.items():
        depth = OrderDepth()
        for p, v in zip(row.bid_prices, row.bid_volumes):
            depth.buy_orders[p] = v
        for p, v in zip(row.ask_prices, row.ask_volumes):
            depth.sell_orders[p] = -v

        state.order_depths[product] = depth
        state.listings[product] = Listing(product, product, 1)

    state.observations = Observation({}, {})


def _enforce_limits(
    state: TradingState,
    products: list[str],
    orders: dict[str, list[Order]],
    limits_override: Optional[dict[str, int]] = None,
) -> None:
    for product in products:
        product_orders = orders.get(product, [])
        if not product_orders:
            continue

        position = state.position.get(product, 0)
        lim = _get_limit(product, limits_override)
        total_long = sum(o.quantity for o in product_orders if o.quantity > 0)
        total_short = sum(abs(o.quantity) for o in product_orders if o.quantity < 0)

        if position + total_long > lim or position - total_short < -lim:
            orders.pop(product, None)


def _match_buy_order(
    state: TradingState,
    product: str,
    order: Order,
    market_trades: list[dict[str, Any]],
    profit_loss: dict[str, float],
    fill_seq_start: int,
    day: int,
    matching_mode: str,
    limits_override: Optional[dict[str, int]] = None,
) -> tuple[list[dict[str, Any]], int]:
    fills: list[dict[str, Any]] = []
    depth = state.order_depths[product]
    fill_seq = fill_seq_start

    for price in sorted([p for p in depth.sell_orders.keys() if p <= order.price]):
        lim = _get_limit(product, limits_override)
        pos = state.position.get(product, 0)
        max_buy = max(0, lim - pos)
        volume = min(order.quantity, abs(depth.sell_orders[price]), max_buy)
        if volume <= 0:
            continue

        state.position[product] = pos + volume
        profit_loss[product] -= price * volume

        depth.sell_orders[price] += volume
        if depth.sell_orders[price] == 0:
            depth.sell_orders.pop(price)

        fill_seq += 1
        fills.append(
            {
                "seq": fill_seq,
                "day": day,
                "timestamp": state.timestamp,
                "product": product,
                "side": "BUY",
                "price": price,
                "quantity": volume,
                "position": state.position[product],
                "realized_pnl": profit_loss[product],
                "fill_type": "taker",
            }
        )

        order.quantity -= volume
        if order.quantity == 0:
            return fills, fill_seq

    if matching_mode == "none":
        return fills, fill_seq

    for mt in market_trades:
        if (
            mt["sell_qty"] <= 0
            or mt["price"] > order.price
            or (mt["price"] == order.price and matching_mode == "worse")
        ):
            continue

        lim = _get_limit(product, limits_override)
        pos = state.position.get(product, 0)
        max_buy = max(0, lim - pos)
        volume = min(order.quantity, mt["sell_qty"], max_buy)
        if volume <= 0:
            continue

        state.position[product] = pos + volume
        profit_loss[product] -= order.price * volume
        mt["sell_qty"] -= volume

        fill_seq += 1
        fills.append(
            {
                "seq": fill_seq,
                "day": day,
                "timestamp": state.timestamp,
                "product": product,
                "side": "BUY",
                "price": order.price,
                "quantity": volume,
                "position": state.position[product],
                "realized_pnl": profit_loss[product],
                "fill_type": "maker",
            }
        )

        order.quantity -= volume
        if order.quantity == 0:
            return fills, fill_seq

    return fills, fill_seq


def _match_sell_order(
    state: TradingState,
    product: str,
    order: Order,
    market_trades: list[dict[str, Any]],
    profit_loss: dict[str, float],
    fill_seq_start: int,
    day: int,
    matching_mode: str,
    limits_override: Optional[dict[str, int]] = None,
) -> tuple[list[dict[str, Any]], int]:
    fills: list[dict[str, Any]] = []
    depth = state.order_depths[product]
    fill_seq = fill_seq_start

    for price in sorted([p for p in depth.buy_orders.keys() if p >= order.price], reverse=True):
        lim = _get_limit(product, limits_override)
        pos = state.position.get(product, 0)
        max_sell = max(0, pos + lim)
        volume = min(abs(order.quantity), depth.buy_orders[price], max_sell)
        if volume <= 0:
            continue

        state.position[product] = pos - volume
        profit_loss[product] += price * volume

        depth.buy_orders[price] -= volume
        if depth.buy_orders[price] == 0:
            depth.buy_orders.pop(price)

        fill_seq += 1
        fills.append(
            {
                "seq": fill_seq,
                "day": day,
                "timestamp": state.timestamp,
                "product": product,
                "side": "SELL",
                "price": price,
                "quantity": volume,
                "position": state.position[product],
                "realized_pnl": profit_loss[product],
                "fill_type": "taker",
            }
        )

        order.quantity += volume
        if order.quantity == 0:
            return fills, fill_seq

    if matching_mode == "none":
        return fills, fill_seq

    for mt in market_trades:
        if (
            mt["buy_qty"] <= 0
            or mt["price"] < order.price
            or (mt["price"] == order.price and matching_mode == "worse")
        ):
            continue

        lim = _get_limit(product, limits_override)
        pos = state.position.get(product, 0)
        max_sell = max(0, pos + lim)
        volume = min(abs(order.quantity), mt["buy_qty"], max_sell)
        if volume <= 0:
            continue

        state.position[product] = pos - volume
        profit_loss[product] += order.price * volume
        mt["buy_qty"] -= volume

        fill_seq += 1
        fills.append(
            {
                "seq": fill_seq,
                "day": day,
                "timestamp": state.timestamp,
                "product": product,
                "side": "SELL",
                "price": order.price,
                "quantity": volume,
                "position": state.position[product],
                "realized_pnl": profit_loss[product],
                "fill_type": "maker",
            }
        )

        order.quantity += volume
        if order.quantity == 0:
            return fills, fill_seq

    return fills, fill_seq


def _compute_metrics(day_equity_paths: list[list[float]]) -> dict[str, float | None]:
    """Compute metrics from per-tick MTM equity paths.

    final_pnl  = MTM at last tick = realized cash + pos * final_mid
                 (equivalent to competition liquidation score).
    max_dd_abs = drawdown measured only at *day-end* equity values to avoid
                 penalising intraday inventory float (positions are held to
                 period end, so mid-day MTM dips are not realised losses).
    sharpe     = mean / std of *incremental* daily PnL (not cumulative levels).
    """
    if not day_equity_paths or not any(day_equity_paths):
        return {
            "final_pnl": 0.0,
            "max_drawdown_abs": 0.0,
            "max_drawdown_pct": None,
            "sharpe": None,
            "annualized_sharpe": None,
            "sortino": None,
            "calmar": None,
        }

    # Stitched full curve (MTM) — used only for final_pnl
    stitched_final = 0.0
    for day_levels in day_equity_paths:
        if day_levels:
            stitched_final += day_levels[-1]
    final_pnl = stitched_final

    # Cumulative day-end equity (used for Sharpe / Sortino returns)
    day_end_equity: list[float] = []
    cum = 0.0
    for day_levels in day_equity_paths:
        if day_levels:
            cum += day_levels[-1]
            day_end_equity.append(cum)

    # MaxDD sampled at every 1/10th of each day (10 evenly-spaced points per day).
    # This captures meaningful intraday swings without penalising every noisy tick.
    dd_samples: list[float] = []
    offset = 0.0
    for day_levels in day_equity_paths:
        if not day_levels:
            continue
        n = len(day_levels)
        # Pick indices: 0, n//10, 2*n//10, ..., 9*n//10, n-1  (always include last)
        indices = sorted(set(
            [int(round(i * (n - 1) / 10)) for i in range(11)]
        ))
        for idx in indices:
            dd_samples.append(offset + day_levels[idx])
        offset += day_levels[-1]

    hwm = dd_samples[0]
    max_dd_abs = 0.0
    max_dd_pct: float | None = None
    for e in dd_samples:
        hwm = max(hwm, e)
        dd = hwm - e
        max_dd_abs = max(max_dd_abs, dd)
        if hwm > 0:
            pct = dd / hwm
            max_dd_pct = pct if max_dd_pct is None else max(max_dd_pct, pct)

    # Incremental daily PnL for Sharpe / Sortino
    # day_returns[0] = how much was made on day 0
    # day_returns[i] = day_end_equity[i] - day_end_equity[i-1]  for i > 0
    day_returns = [day_end_equity[0]] + [
        day_end_equity[i] - day_end_equity[i - 1]
        for i in range(1, len(day_end_equity))
    ]

    sharpe = None
    sortino = None
    ann_sharpe = None
    if len(day_returns) >= 2:
        stdev_val = statistics.stdev(day_returns)
        mean_ret  = statistics.mean(day_returns)
        if stdev_val != 0:
            sharpe     = mean_ret / stdev_val
            ann_sharpe = sharpe * math.sqrt(252)

        downside_sq = sum((min(0.0, r)) ** 2 for r in day_returns)
        downside = math.sqrt(downside_sq / len(day_returns))
        if downside == 0:
            sortino = math.inf if mean_ret > 0 else None
        else:
            sortino = mean_ret / downside

    calmar = final_pnl / max_dd_abs if max_dd_abs > 0 else None

    return {
        "final_pnl": final_pnl,
        "max_drawdown_abs": max_dd_abs,
        "max_drawdown_pct": max_dd_pct,
        "sharpe": sharpe,
        "annualized_sharpe": ann_sharpe,
        "sortino": sortino,
        "calmar": calmar,
    }


def _json_safe_metrics(metrics: dict[str, float | None]) -> dict[str, float | None]:
    safe: dict[str, float | None] = {}
    for key, value in metrics.items():
        if value is None:
            safe[key] = None
        elif isinstance(value, (int, float)) and math.isfinite(float(value)):
            safe[key] = float(value)
        else:
            safe[key] = None
    return safe


def _state_log_payload(trader_data: str) -> str:
    if not isinstance(trader_data, str):
        return ""
    if len(trader_data) > MAX_STATE_LOG_CHARS:
        return ""
    return trader_data


def _parse_limits_override(limits_override_json: str) -> dict[str, int]:
    if not limits_override_json:
        return {}

    loaded = json.loads(limits_override_json)
    if not isinstance(loaded, dict):
        raise ValueError("limits override must be a JSON object")

    parsed: dict[str, int] = {}
    for k, v in loaded.items():
        if not isinstance(k, str):
            continue
        iv = int(v)
        if iv <= 0:
            continue
        parsed[k] = iv

    return parsed


def _extract_day_from_name(name: str) -> int:
    match = re.search(r"day_(-?\d+)\.csv$", name)
    if not match:
        raise ValueError(f"Could not extract day from filename: {name}")
    return int(match.group(1))


def _build_datasets(file_map: dict[str, str]) -> list[dict[str, Any]]:
    price_keys = sorted(
        [key for key in file_map if key.startswith("prices_round_")],
        key=_extract_day_from_name,
    )
    trade_keys = sorted(
        [key for key in file_map if key.startswith("trades_round_")],
        key=_extract_day_from_name,
    )

    price_by_day = {_extract_day_from_name(key): key for key in price_keys}
    trade_by_day = {_extract_day_from_name(key): key for key in trade_keys}
    common_days = sorted(set(price_by_day) & set(trade_by_day))

    if not common_days:
        raise ValueError("No matching prices/trades day pairs found in file_map")

    return [
        {
            "prices": parse_prices_csv(file_map[price_by_day[day]]),
            "trades": parse_trades_csv(file_map[trade_by_day[day]]),
        }
        for day in common_days
    ]


async def run_dashboard_backtest(
    strategy_code: str,
    file_map_json: str,
    matching_mode: str = "none",
    limits_override_json: str = "{}",
    progress_callback=None,
    progress_every: int = 200,
) -> str:
    """Async because the browser needs control back periodically to repaint
    the progress bar. Yields to the JS event loop every `progress_every` ticks."""
    import asyncio  # local: only needed when running in Pyodide
    _register_datamodel_module()

    if matching_mode not in {"all", "worse", "none"}:
        raise ValueError("matching_mode must be one of: all, worse, none")

    limits_override = _parse_limits_override(limits_override_json)

    namespace: dict[str, Any] = {}
    exec(strategy_code, namespace)
    trader_cls = namespace.get("Trader")
    if trader_cls is None:
        raise ValueError("Strategy file must define a Trader class")

    trader = trader_cls()
    file_map = json.loads(file_map_json)
    datasets = _build_datasets(file_map)

    all_points: list[dict[str, Any]] = []
    portfolio_points: list[dict[str, Any]] = []
    all_fills: list[dict[str, Any]] = []
    all_market_trades: list[dict[str, Any]] = []
    state_logs: list[dict[str, Any]] = []
    day_equity_paths: list[list[float]] = []

    fill_seq = 0

    # ── progress bookkeeping ─────────────────────────────────────────────────
    total_ticks = sum(len(ds["prices"][0]) for ds in datasets)
    completed_ticks = 0
    if progress_callback is not None:
        try:
            progress_callback(0, total_ticks)
        except Exception:
            pass  # never let UI errors abort a backtest

    for _ds_idx, dataset in enumerate(datasets):
        prices_by_ts, products, day_num = dataset["prices"]
        trades_by_ts = dataset["trades"]

        state = TradingState(
            traderData="",
            timestamp=0,
            listings={},
            order_depths={},
            own_trades={},
            market_trades={},
            position={},
            observations=Observation({}, {}),
        )

        profit_loss = {p: 0.0 for p in products}
        day_equity: list[float] = []
        previous_market_trades: dict[str, list[Trade]] = {}

        for ts in sorted(prices_by_ts.keys()):
            prices_at_ts = prices_by_ts[ts]
            state.timestamp = ts
            _prepare_state(state, prices_at_ts)
            # Strategies should only see market trades that were already public
            # before this decision point. Current-tick trades are still reserved
            # for order matching below.
            state.market_trades = previous_market_trades

            output = trader.run(state)
            if not isinstance(output, tuple) or len(output) != 3:
                raise ValueError("Trader.run must return (orders, conversions, traderData)")

            orders, _conversions, trader_data = output
            if not isinstance(orders, dict):
                raise ValueError("Trader orders must be dict[Symbol, list[Order]]")
            state.traderData = trader_data if isinstance(trader_data, str) else ""
            # Sample state logs: keep every 50th tick to bound JSON payload size.
            # Indicator overlays read these — sampling preserves shape across 600 logs/day.
            if (completed_ticks % 50) == 0:
                state_logs.append(
                    {
                        "day": day_num,
                        "timestamp": ts,
                        "trader_data": _state_log_payload(state.traderData),
                    }
                )

            _enforce_limits(state, products, orders, limits_override)

            tick_filled_products: set[str] = set()
            for product in products:
                raw_market_trades = trades_by_ts.get(ts, {}).get(product, [])
                for t in raw_market_trades:
                    all_market_trades.append(
                        {
                            "day": day_num,
                            "timestamp": ts,
                            "product": product,
                            "price": t.price,
                            "quantity": t.quantity,
                            "buyer": t.buyer,
                            "seller": t.seller,
                        }
                    )

                market_shadow = [
                    {
                        "price": t.price,
                        "buy_qty": t.quantity,
                        "sell_qty": t.quantity,
                    }
                    for t in raw_market_trades
                ]

                for order in orders.get(product, []):
                    if not isinstance(order.symbol, str) or not isinstance(order.price, int) or not isinstance(order.quantity, int):
                        raise ValueError("Order fields must be (str, int, int)")

                    if order.quantity > 0:
                        fills, fill_seq = _match_buy_order(
                            state=state,
                            product=product,
                            order=order,
                            market_trades=market_shadow,
                            profit_loss=profit_loss,
                            fill_seq_start=fill_seq,
                            day=day_num,
                            matching_mode=matching_mode,
                            limits_override=limits_override,
                        )
                        if fills:
                            tick_filled_products.add(product)
                        all_fills.extend(fills)
                    elif order.quantity < 0:
                        fills, fill_seq = _match_sell_order(
                            state=state,
                            product=product,
                            order=order,
                            market_trades=market_shadow,
                            profit_loss=profit_loss,
                            fill_seq_start=fill_seq,
                            day=day_num,
                            matching_mode=matching_mode,
                            limits_override=limits_override,
                        )
                        if fills:
                            tick_filled_products.add(product)
                        all_fills.extend(fills)

            previous_market_trades = {
                product: list(trades_by_ts.get(ts, {}).get(product, []))
                for product in products
            }

            portfolio_pnl = 0.0
            tick_points: list[dict[str, Any]] = []
            for product in products:
                row = prices_at_ts[product]
                pos = state.position.get(product, 0)
                mtm = profit_loss[product] + pos * row.mid_price
                portfolio_pnl += mtm

                tick_points.append(
                    {
                        "day": day_num,
                        "timestamp": ts,
                        "product": product,
                        "mid_price": row.mid_price,
                        "best_bid": row.bid_prices[0] if row.bid_prices else None,
                        "best_ask": row.ask_prices[0] if row.ask_prices else None,
                        "bid_prices": row.bid_prices,
                        "bid_volumes": row.bid_volumes,
                        "ask_prices": row.ask_prices,
                        "ask_volumes": row.ask_volumes,
                        "position": pos,
                        "realized_pnl": profit_loss[product],
                        "product_mtm_pnl": mtm,
                        "portfolio_mtm_pnl": None,
                    }
                )

            day_equity.append(portfolio_pnl)
            portfolio_points.append(
                {
                    "day": day_num,
                    "timestamp": ts,
                    "portfolio_mtm_pnl": portfolio_pnl,
                }
            )
            keep_product_snapshot = (completed_ticks % PRODUCT_POINT_STRIDE) == 0
            for point in tick_points:
                point["portfolio_mtm_pnl"] = portfolio_pnl
                if keep_product_snapshot or point["product"] in tick_filled_products:
                    all_points.append(point)

            # ── progress + yield to the JS event loop ─────────────────────
            completed_ticks += 1
            if completed_ticks % progress_every == 0:
                if progress_callback is not None:
                    try:
                        progress_callback(completed_ticks, total_ticks)
                    except Exception:
                        pass
                # asyncio.sleep(0) hands control back to the browser so it
                # can repaint; without this the UI stays frozen for the
                # whole backtest.
                await asyncio.sleep(0)

        day_equity_paths.append(day_equity)

    if progress_callback is not None:
        try:
            progress_callback(total_ticks, total_ticks)
        except Exception:
            pass

    metrics = _json_safe_metrics(_compute_metrics(day_equity_paths))
    payload = {
        "portfolio_points": portfolio_points,
        "points": all_points,
        "fills": all_fills,
        "market_trades": all_market_trades,
        "state_logs": state_logs,
        "metrics": metrics,
        "matching_mode": matching_mode,
        "limits_override": limits_override,
    }
    return json.dumps(payload)
