// ─────────────────────────────────────────────────────────────────────────────
// Auction Engine — pure functions, no side effects
// ─────────────────────────────────────────────────────────────────────────────

export interface BookLevel {
  price: number;
  volume: number;
}

export interface ProductConfig {
  symbol: string;
  name: string;
  bids: BookLevel[];        // existing resting bids
  asks: BookLevel[];        // existing resting asks
  resaleValue: number;      // fixed buyback price after auction
  buyFeePerUnit: number;    // fee charged on each unit bought
  sellFeePerUnit: number;   // fee charged on each unit sold (at buyback)
}

export interface UserOrder {
  side: 'buy';
  price: number;
  volume: number;
}

export interface AuctionResult {
  clearingPrice: number | null;
  userFilledQty: number;
  totalMatchedQty: number;
  avgExecutionPrice: number | null;
  marketable: boolean;       // true when user's price >= clearingPrice
  cost: number;              // userFilledQty * clearingPrice
  resaleProceeds: number;    // userFilledQty * resaleValue
  fees: number;              // total (buy + sell) fees
  pnl: number;               // resaleProceeds - cost - fees
}

// ─────────────────────────────────────────────────────────────────────────────
// Main simulation entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simulate a uniform-price call auction.
 *
 * CLEARING PRICE SELECTION
 * ─────────────────────────
 * For every candidate price p (union of all book bid/ask prices and user price):
 *   - executable_demand(p) = Σ bid_volume where bid_price >= p  (book + user)
 *   - executable_supply(p) = Σ ask_volume where ask_price <= p  (book only)
 *   - matched(p)           = min(demand, supply)
 *
 * The clearing price maximises matched(p).
 * TIE-BREAK: higher price wins (per the challenge spec).
 *
 * USER FILL (price-time priority within the clearing price level)
 * ────────────────────────────────────────────────────────────────
 * All supply at clearingPrice is allocated first to buyers above clearingPrice,
 * then to resting book bids AT clearingPrice (they arrived before the user),
 * then to the user's order.
 *
 *   remaining = executableSupply - volumeStrictlyAboveClearing - restingAtClearing
 *   userFill  = min(userVolume, max(0, remaining))
 *
 * EXECUTION PRICE
 * ───────────────
 * All fills execute at the single clearing price (uniform-price auction).
 */
export function simulateAuction(
  product: ProductConfig,
  userOrder: UserOrder
): AuctionResult {
  const { bids, asks, resaleValue, buyFeePerUnit, sellFeePerUnit } = product;

  // 1. Gather candidate clearing prices
  const candidates = new Set<number>();
  bids.forEach(l => { if (l.volume > 0) candidates.add(l.price); });
  asks.forEach(l => { if (l.volume > 0) candidates.add(l.price); });
  candidates.add(userOrder.price);

  // 2. Find clearing price
  let clearingPrice: number | null = null;
  let bestMatched = 0;

  for (const p of candidates) {
    const demand =
      bids.reduce((s, l) => l.price >= p ? s + l.volume : s, 0) +
      (userOrder.price >= p ? userOrder.volume : 0);

    const supply =
      asks.reduce((s, l) => l.price <= p && l.volume > 0 ? s + l.volume : s, 0);

    const matched = Math.min(demand, supply);

    // Prefer higher price on ties (challenge rule)
    if (matched > bestMatched ||
        (matched === bestMatched && matched > 0 && p > (clearingPrice ?? -Infinity))) {
      bestMatched = matched;
      clearingPrice = p;
    }
  }

  // 3. No clearing (no crossing)
  if (clearingPrice === null || bestMatched === 0) {
    return emptyResult();
  }

  // 4. Is the user's order marketable?
  const marketable = userOrder.price >= clearingPrice;
  if (!marketable) {
    return { ...emptyResult(), clearingPrice, totalMatchedQty: bestMatched, marketable: false };
  }

  // 5. User fill via price-time priority
  const executableSupply = asks.reduce(
    (s, l) => l.price <= clearingPrice! && l.volume > 0 ? s + l.volume : s, 0
  );
  // Book bids STRICTLY above clearing price fill before same-price bids
  const volumeAbove = bids.reduce(
    (s, l) => l.price > clearingPrice! ? s + l.volume : s, 0
  );
  // Resting book bids AT clearing price have time priority over the user
  const restingAtClearing = bids.reduce(
    (s, l) => l.price === clearingPrice ? s + l.volume : s, 0
  );

  const remainingForUser = Math.max(0, executableSupply - volumeAbove - restingAtClearing);
  const userFilledQty = Math.min(userOrder.volume, remainingForUser);

  // 6. PnL
  const cost = userFilledQty * clearingPrice;
  const resaleProceeds = userFilledQty * resaleValue;
  const fees = userFilledQty * (buyFeePerUnit + sellFeePerUnit);
  const pnl = resaleProceeds - cost - fees;

  return {
    clearingPrice,
    userFilledQty,
    totalMatchedQty: bestMatched,
    avgExecutionPrice: userFilledQty > 0 ? clearingPrice : null,
    marketable: true,
    cost,
    resaleProceeds,
    fees,
    pnl,
  };
}

function emptyResult(): AuctionResult {
  return {
    clearingPrice: null,
    userFilledQty: 0,
    totalMatchedQty: 0,
    avgExecutionPrice: null,
    marketable: false,
    cost: 0,
    resaleProceeds: 0,
    fees: 0,
    pnl: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build cumulative depth arrays for charting
// ─────────────────────────────────────────────────────────────────────────────

export interface DepthPoint {
  price: number;
  cumVolume: number;
}

/** Cumulative supply: S(p) = sum of asks with ask_price <= p */
export function buildSupplyCurve(asks: BookLevel[]): DepthPoint[] {
  const sorted = [...asks].filter(l => l.volume > 0).sort((a, b) => a.price - b.price);
  const points: DepthPoint[] = [];
  let cum = 0;
  for (const ask of sorted) {
    points.push({ price: ask.price, cumVolume: cum });   // before this level
    cum += ask.volume;
    points.push({ price: ask.price, cumVolume: cum });   // after jump
  }
  return points;
}

/** Cumulative demand: D(p) = sum of bids with bid_price >= p (includes user order) */
export function buildDemandCurve(bids: BookLevel[], userOrder: UserOrder | null): DepthPoint[] {
  // Merge user order into bids for the demand curve display
  const merged = new Map<number, number>();
  for (const b of bids) merged.set(b.price, (merged.get(b.price) ?? 0) + b.volume);
  if (userOrder) merged.set(userOrder.price, (merged.get(userOrder.price) ?? 0) + userOrder.volume);

  const sorted = [...merged.entries()].sort((a, b) => b[0] - a[0]); // high → low

  const points: DepthPoint[] = [];
  let cum = 0;
  for (const [price, vol] of sorted) {
    points.push({ price, cumVolume: cum });   // before this level
    cum += vol;
    points.push({ price, cumVolume: cum });   // after jump
  }
  return points;
}
