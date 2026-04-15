// ─────────────────────────────────────────────────────────────────────────────
// Hardcoded stale order books for the "Intarian Welcome" manual challenge.
// Replace these with JSON/config later if books change between rounds.
// ─────────────────────────────────────────────────────────────────────────────

import { ProductConfig } from '../lib/auction';

export const DRYLAND_FLAX: ProductConfig = {
  symbol: 'DRYLAND_FLAX',
  name: 'Dryland Flax',
  bids: [
    { price: 30, volume: 30_000 },
    { price: 29, volume:  5_000 },
    { price: 28, volume: 12_000 },
    { price: 27, volume: 28_000 },
  ],
  asks: [
    { price: 28, volume: 40_000 },
    { price: 31, volume: 20_000 },
    { price: 32, volume: 20_000 },
    { price: 33, volume: 30_000 },
  ],
  resaleValue: 30,
  buyFeePerUnit: 0,
  sellFeePerUnit: 0,
};

export const EMBER_MUSHROOM: ProductConfig = {
  symbol: 'EMBER_MUSHROOM',
  name: 'Ember Mushroom',
  bids: [
    { price: 20, volume: 43_000 },
    { price: 19, volume: 17_000 },
    { price: 18, volume:  6_000 },
    { price: 17, volume:  5_000 },
    { price: 16, volume: 10_000 },
    { price: 15, volume:  5_000 },
    { price: 14, volume: 10_000 },
    { price: 13, volume:  7_000 },
  ],
  asks: [
    { price: 12, volume: 20_000 },
    { price: 13, volume: 25_000 },
    { price: 14, volume: 35_000 },
    { price: 15, volume:  6_000 },
    { price: 16, volume:  5_000 },
    { price: 17, volume:      0 },  // zero-volume level — ignored in matching
    { price: 18, volume: 10_000 },
    { price: 19, volume: 12_000 },
  ],
  resaleValue: 20,
  buyFeePerUnit: 0.05,
  sellFeePerUnit: 0.05,
};

export const ALL_PRODUCTS: ProductConfig[] = [DRYLAND_FLAX, EMBER_MUSHROOM];
