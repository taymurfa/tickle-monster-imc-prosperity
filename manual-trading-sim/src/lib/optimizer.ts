// ─────────────────────────────────────────────────────────────────────────────
// Brute-force optimizer — iterates candidate prices × volumes, ranks by PnL
// ─────────────────────────────────────────────────────────────────────────────

import { ProductConfig, UserOrder, AuctionResult, simulateAuction } from './auction';

export interface CandidateOrder {
  price: number;
  volume: number;
  result: AuctionResult;
}

/**
 * Search for the best buy order for a given product.
 *
 * Price candidates: all book bid/ask prices ± 1, plus resale value.
 * Volume candidates: volumeStep to maxVolume in steps of volumeStep.
 *
 * Ranking (deterministic):
 *   1. Highest PnL
 *   2. Highest filled quantity (more certainty)
 *   3. Lowest cost (conservative)
 *   4. Lowest price (less aggressive)
 *
 * Deduplication: if multiple volumes produce identical (price, fill, pnl),
 * keep only the lowest volume needed to achieve that result.
 */
export function optimizeOrder(
  product: ProductConfig,
  maxVolume = 150_000,
  volumeStep = 1_000,
  topN = 8
): CandidateOrder[] {
  const { bids, asks, resaleValue } = product;

  // Build price candidate set
  const priceSet = new Set<number>();
  bids.forEach(l => priceSet.add(l.price));
  asks.forEach(l => { if (l.volume > 0) priceSet.add(l.price); });
  priceSet.add(resaleValue);
  // ±1 neighbours help discover edge thresholds
  [...priceSet].forEach(p => { priceSet.add(p + 1); priceSet.add(p - 1); });

  const prices = [...priceSet].filter(p => p > 0).sort((a, b) => a - b);

  // Build volume candidates
  const volumes: number[] = [];
  for (let v = volumeStep; v <= maxVolume; v += volumeStep) volumes.push(v);

  // Simulate all combinations
  const all: CandidateOrder[] = [];
  for (const price of prices) {
    for (const volume of volumes) {
      const order: UserOrder = { side: 'buy', price, volume };
      const result = simulateAuction(product, order);
      // Skip clearly worthless orders (no fill)
      if (result.userFilledQty === 0) continue;
      all.push({ price, volume, result });
    }
  }

  // Sort by ranking criteria
  all.sort((a, b) => {
    if (b.result.pnl !== a.result.pnl) return b.result.pnl - a.result.pnl;
    if (b.result.userFilledQty !== a.result.userFilledQty)
      return b.result.userFilledQty - a.result.userFilledQty;
    if (a.result.cost !== b.result.cost) return a.result.cost - b.result.cost;
    return a.price - b.price;
  });

  // Deduplicate: same (price, fill, pnl) → keep lowest volume
  const seen = new Map<string, CandidateOrder>();
  for (const c of all) {
    const key = `${c.price}:${c.result.userFilledQty}:${c.result.pnl.toFixed(2)}`;
    if (!seen.has(key)) seen.set(key, c);
  }

  return [...seen.values()].slice(0, topN);
}
