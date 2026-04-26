from datamodel import OrderDepth, TradingState, Order
from typing import List
import json

class Trader:
    def run(self, state: TradingState):
        """
        IMC Prosperity 4 - Round 4: "The More The Merrier"
        Now with Counterparty IDs!
        """
        result = {}
        conversions = 0

        # Log counterparty behavior (New in Round 4)
        for product, trades in state.market_trades.items():
            for trade in trades:
                # You can now identify who is buying and selling
                # print(f"TS {state.timestamp} | {product} | {trade.buyer} bought from {trade.seller} @ {trade.price}")
                pass

        # Rudimentary Market Making Placeholder
        for product in state.order_depths.keys():
            result[product] = []

        return result, conversions, state.traderData
