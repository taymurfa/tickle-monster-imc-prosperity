# Round 1 Strategy Context — IMC Prosperity 4

## Products & Limits

| Product | Limit | Character | Strategy |
|---|---|---|---|
| `INTARIAN_PEPPER_ROOT` | ±80 | Stable / steady | Market-making |
| `ASH_COATED_OSMIUM` | ±80 | Volatile / may have hidden pattern | Mean-reversion (baseline) |

---

## Strategy Design

### INTARIAN_PEPPER_ROOT — Market-Making

Fair value is estimated via a short EMA (α=0.3) of midprice, falling back to the raw midprice when history is too short. The algo aggressively takes liquidity whenever the best ask is below fair or the best bid is above fair (including position unwind at fair). Passive quotes use the "penny inside the spread" formula from the tutorial's SampleStrategy, preserving a minimum edge floor.

Inventory is managed via:
- **Skew**: `adj_fair = fair - position × 0.15` shifts quotes to lean toward reducing inventory
- **Soft cap**: quote size scales linearly from full (≤50 units position) to zero (at 80)
- **Unwind boost**: the side that reduces position gets double the base quote size

### ASH_COATED_OSMIUM — Mean-Reversion

The algo maintains a rolling midprice history (60 ticks) and computes:
- **EMA fair value** (α=0.15) — slower than IPR because this product is noisier
- **Rolling std** over the last 20 ticks
- **Z-score** = (mid − fair) / std

Trading rules:
- `z < −1.5` → buy aggressively (sweep asks up to fair)
- `z > +1.5` → sell aggressively (sweep bids down to fair)
- `|z| < 0.5` → reduce/close existing position (accept 1 tick slippage)
- `0.5 ≤ |z| ≤ 1.5` + wide spread → post passive quotes biased in signal direction

Inventory penalty: effective z is penalised by `position × 0.02`, discouraging extreme positions.

---

## Parameters to Tune First

| Priority | Parameter | Current | Why |
|---|---|---|---|
| 1 | `ACO_ENTRY_THRESHOLD` | 1.5 | Controls how extreme z must be to trade. Too low → overtrading, too high → missing moves |
| 2 | `ACO_EXIT_THRESHOLD` | 0.5 | Controls when to flatten. Too tight → premature exits, too loose → gives back PnL |
| 3 | `ACO_EMA_ALPHA` | 0.15 | Slower = smoother fair, faster = more reactive. Should match ACO's volatility regime |
| 4 | `ACO_ZSCORE_LOOKBACK` | 20 | The std window. Shorter = more responsive, longer = more stable |
| 5 | `IPR_EMA_ALPHA` | 0.3 | If IPR is truly stable, this can be very slow (0.1). If it drifts, keep it reactive |
| 6 | `IPR_MAKE_WIDTH` | 2.0 | Wider = more edge per fill, fewer fills. Check the bot spread to calibrate |
| 7 | `ACO_INVENTORY_PENALTY` | 0.02 | Tune to prevent the algo from hitting ±80 too often |
| 8 | `ACO_AGGRESS_SIZE` | 15 | Limits max units per aggressive take. Larger = more PnL per signal but more risk |

---

## Detecting ACO's Behaviour from Historical Data

Once you have price data from Round 1, run these checks:

### Is it mean-reverting?
- Compute the autocorrelation of returns at lag-1. **Negative** autocorrelation → mean-reverting.
- Run an ADF test on the price series. If stationary → mean-reverting.
- Plot z-score histogram: if it's normally distributed and mean-zero, the z-score strategy is valid.

### Is it trending?
- Positive lag-1 autocorrelation → momentum / trending.
- If price keeps breaking through ±2σ bands without reverting, it's trending.
- In this case: flip the strategy to trend-following (buy when z > threshold, sell when z < threshold).

### Is it cyclical?
- Run an FFT or periodogram on the midprice series.
- If there are strong peaks at specific frequencies, there's a hidden cycle.
- You can then build a phase-based strategy: buy at cycle troughs, sell at peaks.

### Quick diagnostic script
```python
import numpy as np
rets = np.diff(prices)
autocorr_1 = np.corrcoef(rets[:-1], rets[1:])[0, 1]
print(f"Lag-1 autocorrelation: {autocorr_1:.4f}")
# < -0.1: likely mean-reverting
# > +0.1: likely trending
# ~ 0.0:  random walk, market-making only
```

---

## File Map

```
round1/
├── trader.py               # Round 1 strategy — submit this
└── STRATEGY_CONTEXT.md     # This file
```
