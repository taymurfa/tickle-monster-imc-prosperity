# Round 3 VFE + VEV Strategy Context

## Current champion: VFE_VEV_V2

**PnL 13,564 | Sharpe 157 | Max DD 1,158 | Fills 878**
**Per-day:** d0 = 4,739 | d1 = 3,996 | d2 = 4,829 (all 3 days positive)

## Products in scope

| Product | Limit | Strategy | Notes |
|---|---|---|---|
| `VELVETFRUIT_EXTRACT` (VFE) | ±200 | Microprice MM + AGG layer | Mean-reverting, lag-1 autocorr ≈ −0.15 |
| `VEV_5000`..`VEV_5500` | ±300 each | Empirical premium MM | Active strikes, MM'd |
| `VEV_4000`, `VEV_4500` | ±300 each | Skipped | Wide spreads (15–21 ticks), low edge |
| `VEV_6000`, `VEV_6500` | ±300 each | Skipped | Mid locked at 0.5, no edge |
| `HYDROGEL_PACK` (HP) | ±200 | Disabled | `ENABLE_HP = False` |

## VFE strategy (V12 logic, unchanged)

V12 was found through 11 numbered iterations + 30+ parameter sweeps. The matching engine has a structural ceiling — most fills come implicitly from bot-queue exhaustion. Final design:

1. **No taker.** Spread is 5 ticks; lag-1 autocorr 0.15 isn't enough to overcome the spread cost.
2. **Top-of-book passive quotes** at `best_bid` and `best_ask` — queue behind the bot.
3. **Imbalance gate at 0.0** — post both sides when book is balanced.
4. **AGG layer** at `best_bid+1` / `best_ask-1` when |imb| > 0.5, size 4. Inside-spread fills capture the +0.28 corr between imb and next-tick return.
5. **Linear inventory skew** at coef 0.015 — protects against runaway inventory at extreme positions.
6. **Contrarian size scaling** — when long, ask side scales up (reduce side); bid side tapers down. Encourages cycle completion in the natural ~150–250 tick OU mean-reversion cycle.
7. **Soft cap 200** (full limit) — never binds in practice; position rarely exceeds 50.

### Key VFE params

| Param | Value | Notes |
|---|---|---|
| `VFE_QUOTE_SIZE` | 8 | Base TOB size; flat above 8 |
| `VFE_AGG_SIZE` | 4 | Smooth gradient up to 15; 4 keeps all 3 days positive |
| `VFE_AGG_IMBALANCE_THRESHOLD` | 0.5 | Optimum from sweep (+234 over 0.4) |
| `VFE_IMBALANCE_GATE` | 0.0 | Post both sides; tightening hurts |
| `VFE_SKEW_COEFF` | 0.015 | Sweet spot — lower inflates DD, higher kills fills |
| `VFE_REDUCE_SIZE_GAIN` | 0.10 | Mostly inert (position rarely high enough) |
| `VFE_SOFT_CAP` | 200 | Full limit; never binds |

## VEV strategy (empirical premium MM)

Per Discord guidance: skip Black-Scholes, use empirical premium per strike. Each strike has a stable typical premium that captures time value + vol implicitly.

### How it works

For each active voucher (5000, 5100, 5200, 5300, 5400, 5500):

1. Compute `intrinsic = max(VFE_mid - strike, 0)`
2. Maintain per-strike `premium_ema` (alpha=0.02, ~50-tick half-life)
3. `fair_voucher = intrinsic + premium_ema`
4. **Take aggressively** if market deviates from fair by `VOUCHER_TAKER_EDGE` (currently dead lever — never fires; market never deviates that far at top of book)
5. **Quote passively** at `best_bid` and `best_ask` (queue behind, like VFE)
6. **AGG layer** at `best_bid+1` / `best_ask-1` when |imb| > 0.25
7. **Linear inventory skew** at coef 0.015

### Cross-strike monotonicity arbitrage

Lower-strike call must be ≥ higher-strike call. If `higher_bid > lower_ask + 3`, free trade:
- Buy lower-strike (cheap) at `lower_ask`
- Sell higher-strike (expensive) at `higher_bid`

### Key VEV params

| Param | Value | Notes |
|---|---|---|
| `VOUCHER_PREMIUM_EMA_ALPHA` | 0.02 | Flat in sweep; 0.005–0.05 all give same PnL |
| `VOUCHER_TAKER_EDGE` | 4.0 | Dead lever (never fires) |
| `VOUCHER_QUOTE_SIZE` | 5 | Flat above 5 (matching engine ceiling) |
| `VOUCHER_AGG_SIZE` | 3 | Flat above 3 |
| `VOUCHER_AGG_IMB_THRESHOLD` | 0.25 | V2: 0.5 → 0.25 (+60 PnL, smooth plateau 0.10–0.30) |
| `VOUCHER_SOFT_CAP` | 100 | Never binds (limit is 300) |
| `VOUCHER_SKEW_COEFF` | 0.015 | V2: 0.05 → 0.015 (+1131 PnL, Sharpe 157, all days up) |
| `VOUCHER_MONO_ARB_EDGE` | 3 | Free monotonicity arb threshold |

### Why empirical premium and not Black-Scholes

- IMC's option market isn't continuously priced; expiry only matters at the round 7 final settlement
- Insufficient data to estimate IV reliably
- Empirical premium per strike captures time value + vol + market biases all at once
- Each strike has a stable mean premium with std ≈ 5–7 ticks (from Day 0 data analysis):
  - VEV_5200/5300 (near ATM): premium ≈ 47, std ≈ 6
  - VEV_5400: premium ≈ 18, std ≈ 3
  - VEV_5500 (OTM): premium ≈ 8, std ≈ 1.3
  - Premiums DRIFT day-to-day as TTE shrinks (8→7→6 days across days 0/1/2)

## Iteration history

### VFE-only iterations

| Version | Change | PnL | Sharpe |
|---|---|---|---|
| V1 | Microprice MM with quadratic skew (R1 OSMIUM port) | −95,842 | — |
| V2 | Passive-only, queue-behind, imbalance gate | +8,222 | 43.7 |
| V3 | Bigger size + looser gate | +8,039 | 22.2 |
| V4 | V2 + L2 quotes + taper (no L2 fills happened) | +8,222 | 43.7 |
| V5 | V2 + AGG inside-spread quotes (size 3, threshold 0.4) | +8,765 | 69.2 |
| V6 | V5 + contrarian size scaling, cap 200 | +9,642 | 50.0 |
| V7 | V6 + base size 8, AGG threshold 0.4 | +10,785 | 83.9 |
| V8 | V7 + base size 12 (matching engine ceiling found) | +10,785 | 83.9 |
| V9 | V7 + AGG size 8 (also flat) | +10,785 | 83.9 |
| V10 | V7 + behind-the-bot layer (no fills) | +10,785 | 83.9 |
| V11 | V7 + AGG threshold 0.5 | +11,019 | 69.4 |
| **V12** | V11 + AGG size 4 | **+11,323** | **77.9** |

### Voucher iterations

| Version | Change | PnL | Sharpe |
|---|---|---|---|
| VFE_VEV_V1 | V12 + voucher MM with empirical premium | +12,373 | 118.4 |
| **VFE_VEV_V2** | V1 + AGG threshold 0.25 + SKEW 0.015 | **+13,564** | **157.0** |

## Key learnings

1. **The matching engine has a hard ceiling.** Many parameter changes produce identical results because the engine never trades at the affected price levels (e.g., behind-the-bot, deep AGG, sizes above ~5). Only changes to *price location* (e.g., AGG inside spread) and *gating* (when to fire) actually move PnL.

2. **VFE is fill-rate-limited, not size-limited.** V8/V9/V10 all returned identical PnL despite progressively larger sizes. The bot-queue exhaustion is the bottleneck.

3. **Cycle-driven PnL.** VFE position oscillates ±50 in ~150–250 tick cycles. Each cycle harvests roughly the same PnL regardless of size. Contrarian skew accelerates cycle completion.

4. **Vouchers add Sharpe disproportionately.** Voucher fills capture more PnL per fill (~25 vs ~10 for VFE) because voucher prices have higher per-tick variance.

5. **Discord advice was right:** empirical premium beats theoretical pricing for this market.

## Tooling

- `dashboard/run_pnl.py <strategy_file>` — single-run CLI backtest
- `dashboard/sweep.py` — parameter sweep tool (edit BASE_FILE and SCENARIOS)
- All runs use `matching_mode="all"` to match dashboard defaults
- Backtest takes ~30s per run; sweeps of 5 scenarios = ~3 minutes

## Open levers

Tested and rejected (V12-era):
- VFE smoothed imbalance, wide-spread-only AGG, bot-queue-thin gate, daily reset, trade-flow gate

Untested on vouchers:
- Per-strike SKEW_COEFF tuning (currently single global value)
- Adding VEV_4500 to active list (deep ITM, wide spread)
- Vega-aware (delta-sensitive) inventory caps
- Cross-product hedging (voucher position offset by VFE)

## Files

- `VFE_V12.py` — VFE-only optimum
- `VFE_VEV_V1.py` — initial voucher integration
- `VFE_VEV_V2.py` — current champion (locked in)
- Versions V1–V11 retained for history; V13+ removed (rejected ideas)
