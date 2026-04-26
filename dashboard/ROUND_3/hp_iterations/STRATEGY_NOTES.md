# HP Iteration Strategy Notes

These notes describe the current Hydrogel Pack strategy stack and the overfitting checks to apply before trusting a new version.

## Current Baselines

| Version | Purpose | PnL (`none`) | Fills | Day PnL |
| --- | --- | ---: | ---: | --- |
| `R3_V38.py` | Core confidence-scaled HP mean reversion | 1450 | 39 | `{0: 324, 1: 534, 2: 592}` |
| `R3_V40.py` | V38 + selective post-profit re-entry | 2415 | 67 | `{0: 156, 1: 978, 2: 1281}` |
| `R3_V41.py` | V40 + protected late-day cleanup | 2691 | 69 | `{0: 462, 1: 976, 2: 1253}` |
| `R3_V42.py` | Locked cleaned version of V41 | 2691 | 69 | `{0: 462, 1: 976, 2: 1253}` |

## Strategy Stack

### 1. Core HP Mean Reversion (`R3_V38`)

Hypothesis:
Hydrogel Pack repeatedly overshoots intraday and mean-reverts. We should buy only when price is meaningfully cheap versus an EMA-based fair value, then exit after a stronger over-fair recovery.

General rules:
- Use EMA fair value and residual z-score rather than fixed price levels.
- Require confidence from cheapness, edge, fresh market signals, and short-term stabilization.
- Sweep only a few ask levels, and only when deeper asks still have acceptable edge.
- Sell in small chunks after recovery instead of dumping immediately.
- Avoid shorts for now.

Overfit risk:
- Exit threshold tuning is based on the observed rebound behavior.
- Sweep depth and edge threshold can become too tailored if repeatedly adjusted by one chart.

### 2. Selective Re-Entry (`R3_V40`)

Hypothesis:
After one profitable mean-reversion cycle completes, the same day often offers additional smaller cycles. Re-entry should be allowed only after the strategy has already proven the day is mean-reverting profitably.

General rules:
- Only re-enter while flat.
- Only re-enter after at least one completed profitable HP cycle that day.
- Require strong confidence, cheap z-score, and positive edge.
- Keep re-entry size small.
- Do not open new re-entry probes late in the day.

Why this is less overfit than the broad V39 probe:
- It does not buy every falling-knife setup.
- It requires prior realized evidence that the current day is paying mean reversion.
- It is framed around a repeatable regime condition, not a specific timestamp.

Overfit risk:
- The exact confidence, z-score, edge, and no-new-entry cutoff values may still be fitted.

### 3. Protected Late Cleanup (`R3_V41`)

Hypothesis:
Small leftover long inventory near the end of the day should be flattened if it can be sold without violating the no-loss sell guard. Carrying tiny residual inventory adds unnecessary close risk.

General rules:
- Only clean up long inventory after the late-day cutoff.
- Only sell at or above the protected minimum sell price.
- Do not force loss-taking just to flatten.

Overfit risk:
- The exact cleanup timestamp can be fitted. Treat it as a generic end-of-day risk-control parameter, not a market-timing signal.

### 4. Locked HP-Only Version (`R3_V42`)

Hypothesis:
The useful structure is now stable enough to lock into a clean HP-only submission file. V42 should preserve V41 behavior while removing inactive VFE, voucher, PID, and option-model execution paths from the locked strategy.

General rules:
- Only HYDROGEL_PACK is traded.
- VFE and vouchers are intentionally excluded from this version.
- Strategy comments should explain the economic reason for each active layer.
- Any future VFE/voucher work should start in a separate version rather than adding hidden complexity to V42.

Overfit risk:
- V42 itself should not tune new thresholds. If V42 PnL differs materially from V41, treat that as a cleanup bug rather than an improvement.

## Overfitting Guardrails

Before promoting a new version:
- It should improve more than one day, or improve total PnL without making one day catastrophically worse.
- It should not depend on exact historical timestamps except broad end-of-day risk control.
- It should be explainable using fair value, z-score, confidence, inventory, and cycle state.
- It should still be tested with `matching_mode=none`.
- It should not increase fills purely by trading shallow edges.
- It should preserve the no-loss sell guard unless we deliberately test stop-loss behavior.

## Recommended Next Tests

1. Sensitivity around re-entry thresholds:
   - `HP_REENTRY_MAX_Z`: `-1.5`, `-1.75`, `-2.0`
   - `HP_REENTRY_MIN_EDGE`: `3`, `4`, `5`
   - `HP_REENTRY_ORDER_SIZE`: `4`, `6`, `8`

2. Replace exact late cutoff with a broader rule:
   - Keep `875000` for now, but validate nearby values like `850000` and `900000`.

3. Add partial-exit ladder:
   - Exit some inventory at current V38/V41 threshold.
   - Hold remaining inventory for stronger extension.

4. Add VFE only as a filter:
   - If VFE strongly confirms rebound, allow re-entry.
   - If VFE is sharply falling, block HP re-entry.
