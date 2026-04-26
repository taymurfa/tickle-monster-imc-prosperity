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
    "EMERALDS": 80,
    "TOMATOES": 80,
    "ASH_COATED_OSMIUM": 80,
    "INTARIAN_PEPPER_ROOT": 80,
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


class ConversionObservation:
    def __init__(self, bidPrice: float, askPrice: float, transportFees: float, exportTariff: float, importTariff: float, sunlightIndex: float, humidityIndex: float):
        self.bidPrice = bidPrice
        self.askPrice = askPrice
        self.transportFees = transportFees
        self.exportTariff = exportTariff
        self.importTariff = importTariff
        self.sunlightIndex = sunlightIndex
        self.humidityIndex = humidityIndex


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
    __slots__ = ["symbol", "price", "quantity", "buyer", "seller", "timestamp"]
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


class PriceRow:
    __slots__ = ["day", "timestamp", "product", "bid_prices", "bid_volumes", "ask_prices", "ask_volumes", "mid_price", "observations"]
    def __init__(self, day: int, timestamp: int, product: str, bid_prices: list[int], bid_volumes: list[int], ask_prices: list[int], ask_volumes: list[int], mid_price: float, observations: dict[str, Any]):
        self.day = day
        self.timestamp = timestamp
        self.product = product
        self.bid_prices = bid_prices
        self.bid_volumes = bid_volumes
        self.ask_prices = ask_prices
        self.ask_volumes = ask_volumes
        self.mid_price = mid_price
        self.observations = observations


def parse_prices_csv(text: str) -> tuple[dict[int, dict[str, PriceRow]], list[str], int]:
    f = io.StringIO(text)
    reader = csv.reader(f, delimiter=";")
    try:
        header = next(reader)
    except StopIteration:
        return {}, [], 0
        
    col_idx = {col: i for i, col in enumerate(header)}
    
    # Pre-calculate indices for bid/ask prices/volumes
    bid_p_idx = [col_idx.get(f"bid_price_{i}") for i in range(1, 4)]
    bid_v_idx = [col_idx.get(f"bid_volume_{i}") for i in range(1, 4)]
    ask_p_idx = [col_idx.get(f"ask_price_{i}") for i in range(1, 4)]
    ask_v_idx = [col_idx.get(f"ask_volume_{i}") for i in range(1, 4)]
    
    # Round 2 / Observation columns
    obs_cols = ["SUNLIGHT", "HUMIDITY", "EXPORT_TARIFF", "IMPORT_TARIFF", "TRANSPORT_FEES"]
    obs_idx = {col: col_idx[col] for col in obs_cols if col in col_idx}
    
    ts_idx = col_idx["timestamp"]
    prod_idx = col_idx["product"]
    mid_idx = col_idx["mid_price"]
    day_idx = col_idx["day"]
    
    by_ts: dict[int, dict[str, PriceRow]] = {}
    products: set[str] = set()
    day_val = 0

    for row in reader:
        ts = int(row[ts_idx])
        product = row[prod_idx]
        day_val = int(row[day_idx])
        
        bid_prices = []
        bid_volumes = []
        for p_i, v_i in zip(bid_p_idx, bid_v_idx):
            if p_i is not None and p_i < len(row) and row[p_i]:
                bid_prices.append(int(float(row[p_i])))
                bid_volumes.append(int(float(row[v_i])))
            else:
                break

        ask_prices = []
        ask_volumes = []
        for p_i, v_i in zip(ask_p_idx, ask_v_idx):
            if p_i is not None and p_i < len(row) and row[p_i]:
                ask_prices.append(int(float(row[p_i])))
                ask_volumes.append(int(float(row[v_i])))
            else:
                break
        
        observations = {}
        for col, idx in obs_idx.items():
            if idx < len(row) and row[idx]:
                observations[col] = float(row[idx])

        entry = PriceRow(
            day=day_val,
            timestamp=ts,
            product=product,
            bid_prices=bid_prices,
            bid_volumes=bid_volumes,
            ask_prices=ask_prices,
            ask_volumes=ask_volumes,
            mid_price=float(row[mid_idx]),
            observations=observations,
        )

        if ts not in by_ts:
            by_ts[ts] = {}
        by_ts[ts][product] = entry
        products.add(product)

    return by_ts, sorted(products), day_val


def parse_trades_csv(text: str) -> dict[int, dict[str, list[Trade]]]:
    if not text.strip():
        return {}

    f = io.StringIO(text)
    reader = csv.reader(f, delimiter=";")
    try:
        header = next(reader)
    except StopIteration:
        return {}
        
    col_idx = {col: i for i, col in enumerate(header)}
    
    ts_idx = col_idx["timestamp"]
    sym_idx = col_idx["symbol"]
    prc_idx = col_idx["price"]
    qty_idx = col_idx["quantity"]
    buy_idx = col_idx.get("buyer")
    sel_idx = col_idx.get("seller")

    by_ts: dict[int, dict[str, list[Trade]]] = {}

    for row in reader:
        ts = int(row[ts_idx])
        symbol = row[sym_idx]
        trade = Trade(
            symbol=symbol,
            price=int(float(row[prc_idx])),
            quantity=int(float(row[qty_idx])),
            buyer=row[buy_idx] if buy_idx is not None and buy_idx < len(row) else "",
            seller=row[sel_idx] if sel_idx is not None and sel_idx < len(row) else "",
            timestamp=ts,
        )
        if ts not in by_ts:
            by_ts[ts] = {}
        if symbol not in by_ts[ts]:
            by_ts[ts][symbol] = []
        by_ts[ts][symbol].append(trade)

    return by_ts


def _register_datamodel_module() -> None:
    module = types.ModuleType("datamodel")
    module.Listing = Listing
    module.Observation = Observation
    module.ConversionObservation = ConversionObservation
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
    
    plain_obs = {}
    conv_obs = {}

    for product, row in prices_at_ts.items():
        depth = OrderDepth()
        depth.buy_orders = dict(zip(row.bid_prices, row.bid_volumes))
        depth.sell_orders = {p: -v for p, v in zip(row.ask_prices, row.ask_volumes)}
        state.order_depths[product] = depth
        
        # Round 2 Sunlight/Humidity logic
        if "SUNLIGHT" in row.observations:
            plain_obs["SUNLIGHT"] = int(row.observations["SUNLIGHT"])
        if "HUMIDITY" in row.observations:
            plain_obs["HUMIDITY"] = int(row.observations["HUMIDITY"])
            
        # Conversion Observations (ORCHIDS)
        if product == "ORCHIDS" and "EXPORT_TARIFF" in row.observations:
            conv_obs["ORCHIDS"] = ConversionObservation(
                bidPrice=row.bid_prices[0] if row.bid_prices else 0.0,
                askPrice=row.ask_prices[0] if row.ask_prices else 0.0,
                transportFees=row.observations.get("TRANSPORT_FEES", 0.0),
                exportTariff=row.observations.get("EXPORT_TARIFF", 0.0),
                importTariff=row.observations.get("IMPORT_TARIFF", 0.0),
                sunlightIndex=row.observations.get("SUNLIGHT", 0.0),
                humidityIndex=row.observations.get("HUMIDITY", 0.0)
            )

    state.observations = Observation(plain_obs, conv_obs)


def _enforce_limits(
    state: TradingState,
    orders: dict[str, list[Order]],
    limits_override: Optional[dict[str, int]] = None,
) -> None:
    pass


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
    
    sell_prices = sorted(depth.sell_orders.keys())
    for price in sell_prices:
        if price > order.price:
            break
            
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

    buy_prices = sorted(depth.buy_orders.keys(), reverse=True)
    for price in buy_prices:
        if price < order.price:
            break
            
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


def _fills_to_own_trades(fills: list[dict[str, Any]]) -> list[Trade]:
    own_trades: list[Trade] = []
    for fill in fills:
        side = str(fill.get("side") or "").upper()
        product = str(fill.get("product") or "")
        price = int(fill.get("price") or 0)
        quantity = int(fill.get("quantity") or 0)
        timestamp = int(fill.get("timestamp") or 0)
        if not product or price <= 0 or quantity <= 0:
            continue
        own_trades.append(
            Trade(
                symbol=product,
                price=price,
                quantity=quantity,
                buyer="SUBMISSION" if side == "BUY" else "",
                seller="SUBMISSION" if side == "SELL" else "",
                timestamp=timestamp,
            )
        )
    return own_trades


def _compute_metrics(day_equity_paths: list[list[float]]) -> dict[str, float | None]:
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

    stitched_final = sum(day_levels[-1] for day_levels in day_equity_paths if day_levels)
    final_pnl = stitched_final

    day_end_equity: list[float] = []
    cum = 0.0
    for day_levels in day_equity_paths:
        if day_levels:
            cum += day_levels[-1]
            day_end_equity.append(cum)

    dd_samples: list[float] = []
    offset = 0.0
    for day_levels in day_equity_paths:
        if not day_levels: continue
        n = len(day_levels)
        indices = sorted(set([int(round(i * (n - 1) / 10)) for i in range(11)]))
        for idx in indices: dd_samples.append(offset + day_levels[idx])
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

    day_returns = [day_end_equity[0]] + [day_end_equity[i] - day_end_equity[i - 1] for i in range(1, len(day_end_equity))]

    sharpe = sortino = ann_sharpe = None
    if len(day_returns) >= 2:
        stdev_val = statistics.stdev(day_returns)
        mean_ret  = statistics.mean(day_returns)
        if stdev_val != 0:
            sharpe = mean_ret / stdev_val
            ann_sharpe = sharpe * math.sqrt(252)
        downside_sq = sum((min(0.0, r)) ** 2 for r in day_returns)
        downside = math.sqrt(downside_sq / len(day_returns))
        if downside != 0: sortino = mean_ret / downside

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
        if value is None: safe[key] = None
        elif isinstance(value, (int, float)) and math.isfinite(float(value)): safe[key] = float(value)
        else: safe[key] = None
    return safe


def _state_log_payload(trader_data: str) -> str:
    if not isinstance(trader_data, str) or len(trader_data) > MAX_STATE_LOG_CHARS: return ""
    return trader_data


def _parse_limits_override(limits_override_json: str) -> dict[str, int]:
    if not limits_override_json: return {}
    loaded = json.loads(limits_override_json)
    if not isinstance(loaded, dict): raise ValueError("limits override must be a JSON object")
    parsed: dict[str, int] = {}
    for k, v in loaded.items():
        iv = int(v)
        if iv > 0: parsed[str(k)] = iv
    return parsed


def _extract_day_from_name(name: str) -> int:
    match = re.search(r"day_(-?\d+)\.csv$", name)
    if not match: raise ValueError(f"Could not extract day from filename: {name}")
    return int(match.group(1))


def _build_datasets(file_map: dict[str, str]) -> list[dict[str, Any]]:
    price_keys = sorted([k for k in file_map if k.startswith("prices_round_")], key=_extract_day_from_name)
    trade_keys = sorted([k for k in file_map if k.startswith("trades_round_")], key=_extract_day_from_name)
    price_by_day = {_extract_day_from_name(k): k for k in price_keys}
    trade_by_day = {_extract_day_from_name(k): k for k in trade_keys}
    common_days = sorted(set(price_by_day) & set(trade_by_day))
    if not common_days: raise ValueError("No matching prices/trades day pairs found")
    return [{"prices": parse_prices_csv(file_map[price_by_day[day]]), "trades": parse_trades_csv(file_map[trade_by_day[day]])} for day in common_days]


async def run_dashboard_backtest(
    strategy_code: str,
    file_map_json: str,
    matching_mode: str = "none",
    limits_override_json: str = "{}",
    progress_callback=None,
    progress_every: int = 200,
) -> str:
    import asyncio
    _register_datamodel_module()
    if matching_mode not in {"all", "worse", "none"}: raise ValueError("Invalid matching_mode")
    limits_override = _parse_limits_override(limits_override_json)

    namespace: dict[str, Any] = {}
    exec(strategy_code, namespace)
    trader_cls = namespace.get("Trader")
    if trader_cls is None: raise ValueError("Strategy must define a Trader class")

    trader = trader_cls()
    file_map = json.loads(file_map_json)
    datasets = _build_datasets(file_map)

    all_points = []
    portfolio_points = []
    all_fills = []
    all_market_trades = []
    state_logs = []
    day_equity_paths = []
    fill_seq = 0
    persistent_trader_data = ""

    total_ticks = sum(len(ds["prices"][0]) for ds in datasets)
    completed_ticks = 0
    if progress_callback: progress_callback(0, total_ticks)

    for dataset in datasets:
        prices_by_ts, products, day_num = dataset["prices"]
        trades_by_ts = dataset["trades"]
        dataset_listings = {p: Listing(p, p, 1) for p in products}
        
        state = TradingState(persistent_trader_data, 0, dataset_listings, {}, {}, {}, {}, Observation({}, {}))
        profit_loss = {p: 0.0 for p in products}
        day_equity = []
        previous_market_trades = {}
        previous_own_trades = {}

        for ts in sorted(prices_by_ts.keys()):
            prices_at_ts = prices_by_ts[ts]
            state.timestamp = ts
            _prepare_state(state, prices_at_ts)
            state.market_trades = previous_market_trades
            state.own_trades = previous_own_trades

            output = trader.run(state)
            orders, conversions, trader_data = output
            persistent_trader_data = trader_data if isinstance(trader_data, str) else ""
            state.traderData = persistent_trader_data

            if (completed_ticks % 50) == 0:
                state_logs.append({"day": day_num, "timestamp": ts, "trader_data": _state_log_payload(state.traderData)})

            # ── Handle Conversions (Round 2 ARBITRAGE) ─────────────────────
            if conversions and isinstance(conversions, (int, float)) and conversions != 0:
                # Typically conversions applies to ORCHIDS
                prod = "ORCHIDS"
                if prod in products:
                    row = prices_at_ts[prod]
                    obs = state.observations.conversionObservations.get(prod)
                    if obs:
                        qty = int(conversions)
                        # Position update
                        old_pos = state.position.get(prod, 0)
                        state.position[prod] = old_pos + qty
                        
                        # Realized PnL update (Arbitrage calculation)
                        # Selling to conversion: qty is negative, we get bidPrice - tariffs
                        # Buying from conversion: qty is positive, we pay askPrice + tariffs
                        if qty > 0: # Buying
                            cost = (obs.askPrice + obs.importTariff + obs.transportFees) * qty
                            profit_loss[prod] -= cost
                        else: # Selling
                            proceeds = (obs.bidPrice - obs.exportTariff - obs.transportFees) * abs(qty)
                            profit_loss[prod] += proceeds

            tick_filled_products = set()
            tick_own_trades = {}
            current_tick_market_trades = trades_by_ts.get(ts, {})

            for product in products:
                raw_market_trades = current_tick_market_trades.get(product, [])
                for t in raw_market_trades:
                    all_market_trades.append({"day": day_num, "timestamp": ts, "product": product, "price": t.price, "quantity": t.quantity, "buyer": t.buyer, "seller": t.seller})
                
                market_shadow = [{"price": t.price, "buy_qty": t.quantity, "sell_qty": t.quantity} for t in raw_market_trades]

                product_orders = orders.get(product, [])
                for order in product_orders:
                    if order.quantity > 0:
                        fills, fill_seq = _match_buy_order(state, product, order, market_shadow, profit_loss, fill_seq, day_num, matching_mode, limits_override)
                    else:
                        fills, fill_seq = _match_sell_order(state, product, order, market_shadow, profit_loss, fill_seq, day_num, matching_mode, limits_override)
                    
                    if fills:
                        tick_filled_products.add(product)
                        all_fills.extend(fills)
                        own_fills = _fills_to_own_trades(fills)
                        tick_own_trades.setdefault(product, []).extend(own_fills)

            previous_market_trades = current_tick_market_trades
            previous_own_trades = tick_own_trades

            portfolio_pnl = 0.0
            for product in products:
                row = prices_at_ts[product]
                portfolio_pnl += profit_loss[product] + state.position.get(product, 0) * row.mid_price

            day_equity.append(portfolio_pnl)
            portfolio_points.append({"day": day_num, "timestamp": ts, "portfolio_mtm_pnl": portfolio_pnl})
            
            if (completed_ticks % PRODUCT_POINT_STRIDE) == 0 or tick_filled_products:
                keep_all = (completed_ticks % PRODUCT_POINT_STRIDE) == 0
                for product in products:
                    if keep_all or product in tick_filled_products:
                        row = prices_at_ts[product]
                        pos = state.position.get(product, 0)
                        all_points.append({
                            "day": day_num, "timestamp": ts, "product": product, "mid_price": row.mid_price,
                            "best_bid": row.bid_prices[0] if row.bid_prices else None, "best_ask": row.ask_prices[0] if row.ask_prices else None,
                            "bid_prices": row.bid_prices, "bid_volumes": row.bid_volumes, "ask_prices": row.ask_prices, "ask_volumes": row.ask_volumes,
                            "position": pos, "realized_pnl": profit_loss[product], "product_mtm_pnl": profit_loss[product] + pos * row.mid_price, "portfolio_mtm_pnl": portfolio_pnl,
                        })

            completed_ticks += 1
            if completed_ticks % progress_every == 0:
                if progress_callback: progress_callback(completed_ticks, total_ticks)
                await asyncio.sleep(0)

        day_equity_paths.append(day_equity)

    metrics = _json_safe_metrics(_compute_metrics(day_equity_paths))
    return json.dumps({
        "portfolio_points": portfolio_points, "points": all_points, "fills": all_fills, "market_trades": all_market_trades,
        "state_logs": state_logs, "metrics": metrics, "matching_mode": matching_mode, "limits_override": limits_override,
    })
