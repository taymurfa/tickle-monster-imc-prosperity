from datamodel import Order, TradingState
import json

HYDROGEL_PACK = "HYDROGEL_PACK"
VELVETFRUIT_EXTRACT = "VELVETFRUIT_EXTRACT"
VOUCHERS = [
    "VEV_4000",
    "VEV_4500",
    "VEV_5000",
    "VEV_5100",
    "VEV_5200",
    "VEV_5300",
    "VEV_5400",
    "VEV_5500",
    "VEV_6000",
    "VEV_6500",
]


class Trader:
    def bid(self) -> int:
        # Round 3 has no MAF, but keeping this method allows reuse in Round 2 testing.
        return 0

    def run(self, state: TradingState):
        # Starter template for Round 3 dashboard runs.
        # Add per-product logic and return orders as you iterate.
        orders: dict[str, list[Order]] = {}

        for product in [HYDROGEL_PACK, VELVETFRUIT_EXTRACT, *VOUCHERS]:
            if product in state.order_depths:
                orders[product] = []

        trader_data = json.dumps({"note": "round3_starter"}, separators=(",", ":"))
        conversions = 0
        return orders, conversions, trader_data
