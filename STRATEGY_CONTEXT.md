# Strategy Context — IMC Prosperity 4 Tutorial Round

## Overview

This document captures the full context of our current trading strategy (`trader.py` v4): what we learned, why decisions were made, and what to improve next.

---

## Products & Limits

| Product | Position Limit | Character |
|---|---|---|
| `EMERALDS` | ±80 | Stable — fair value is a constant 10,000 |
| `TOMATOES` | ±80 | Volatile — fair value drifts, prone to sustained trends |

---

## Run History

| Run | Version | EMERALDS PnL | TOMATOES PnL | Total |
|---|---|---|---|---|
| 67195 | v1 (SMA) | 317 | 340 | **657** |
| 67245 | v2 (EMA + A-S) | 446 | 0 | **446** ← regression |
| — | v3 (A-S cap fix) | (not yet run) | (not yet run) | — |
| — | v4 (current) | (not yet run) | (not yet run) | — |
| Reference | SampleStrategy (Mitchell) | ~1,400 est. | ~1,400 est. | **~2,800** |

---

## What We Learned From Each Run

### Run 67195 (v1 — SMA)
- EMERALDS fair value is exactly **10,000**, bots always quote `9992 / 10008`.
- TOMATOES drifted from `5,006 → 4,977` in a sustained downtrend.
- SMA(60) lagged 3–5 ticks → algo kept buying into the fall → accumulated max long → **−1,419 drawdown**.
- TOMATOES ended at 0 position but with 340 PnL (recovered).

### Run 67245 (v2 — Dual EMA + Avellaneda-Stoikov)
- TOMATOES: **0 trades, 0 PnL** — complete regression.
- Bug: A-S cap logic `our_bid = min(our_bid, bot_bid)` forced quotes to the exact same price as bots → no queue priority → never filled.
- EMERALDS improved to 446 but still only 2.4% efficient.
- Root cause of EMERALDS inefficiency: passive quotes at `9999/10001` (1-tick edge) vs SampleStrategy's `9993/10007` (7-tick edge). Same fill frequency, 7x less profit per fill.

### SampleStrategy (Mitchell) Analysis
Key insight: the `make_orders` pennying formula:
```
bid = min(best_bid + 1, floor(fair - make_width))
ask = max(best_ask - 1, ceil(fair + make_width))
```
This places quotes **1 tick better than the best bot** while guaranteeing at least `make_width` ticks of edge vs fair. For EMERALDS with `make_width=2`: quotes land at `9993/10007` = 7 ticks of edge each side.

Additional advantages:
- **Position-unwind aggression**: if short, buy at fair (no extra edge needed); if long, sell at fair.
- **Bounded quote size** with unwind boost: default 12 units, doubled on unwind side.
- **Inventory skew applied before both take and make**: `adj_fair = base_fair - position × skew`.

---

## Current Strategy (v4)

### Architecture

```
run()
 ├─ load_history()          # deserialise rolling price history from traderData
 ├─ for each product:
 │   ├─ get_fair_value()    # EMERALDS: hardcoded 10000; TOMATOES: rolling avg
 │   ├─ adj_fair = base_fair - position × inventory_skew
 │   ├─ [TOMATOES only] regime_info() → widen take_width if trending
 │   ├─ take_orders()       # aggress mispriced bot quotes + unwind logic
 │   └─ make_orders()       # penny inside bot spread, preserve make_width edge
 └─ save_history()          # serialise price history to traderData JSON
```

### Parameters

```python
PARAMS = {
    "EMERALDS": {
        "fair":           10000.0,   # constant — never moves
        "take_width":     1.0,       # aggress if ask < fair-1 or bid > fair+1
        "make_width":     2.0,       # passive quotes: at least 2 ticks from fair
        "inventory_skew": 0.15,      # adj_fair shifts 0.15 ticks per unit of position
        "quote_size":     12,        # units per passive quote (boosted when unwinding)
        "window":         6,
    },
    "TOMATOES": {
        "fallback_fair":  4993.0,    # used before rolling window fills
        "take_width":     1.5,
        "make_width":     2.0,
        "inventory_skew": 0.10,
        "quote_size":     10,
        "window":         12,        # rolling avg window for fair value
        # Regime protection (prevents trending drawdowns):
        "ema_fast":       8,
        "ema_slow":       21,
        "atr_window":     15,
        "trend_threshold":0.15,      # EMA slope/ATR > this = trending
        "trend_edge_mul": 10.0,      # extra ticks of take_width per unit trend_strength
    },
}
```

### EMERALDS Logic

**Fair value:** Hardcoded at `10,000`. Confirmed constant across all runs — bots never quote outside the `9992/10008` range.

**Passive quotes (make_orders):**
- `bid = min(9993, floor(10000 - 2)) = 9993` — 1 tick better than bot bid, 7-tick edge
- `ask = max(10007, ceil(10000 + 2)) = 10007` — 1 tick better than bot ask, 7-tick edge

**Aggressive (take_orders):**
- Buy if `ask ≤ 9999` (fair − take_width). Bots normally ask at `10008`, so this rarely fires.
- Fires when bot occasionally touches `10000` on the ask side.
- Also buys at fair with no edge when short (position unwind).

### TOMATOES Logic

**Fair value:** Rolling mean of last 12 mid-prices. Tracks the ~13-tick drift in price better than SMA(60) while not being too noisy.

**Passive quotes (make_orders):**
- `bid = min(bot_bid + 1, floor(fair - 2))` — penny inside bot bid, ~6-tick edge
- `ask = max(bot_ask - 1, ceil(fair + 2))` — penny inside bot ask, ~6-tick edge

**Regime protection (our addition vs SampleStrategy):**
1. Compute EMA(8) slope normalised by ATR(15) → `trend_strength`
2. If `trend_strength > 0.15` (trending):
   - Widen `take_width += trend_strength × 10` — stops buying into downtrends
   - Shift `adj_fair` by ±`trend_strength × 3` in unwind direction — passive quotes lean toward reducing position
3. This prevented the −1,419 drawdown from run 67195.

**Position unwind:**
- If short: buy back at `adj_fair` (no edge requirement)
- If long: sell at `adj_fair` (no edge requirement)

---

## Known Issues / Things to Try Next

### High Priority
1. **Verify TOMATOES fills with v4** — v3's cap fix should have resolved the 0-trade issue, but v4 is untested. Confirm TOMATOES generates passive fills in the first run.
2. **EMERALDS take_orders rarely fires** — bots ask at `10008`, we aggress at `≤ 9999`. Only fires on rare bot touches at `10000`. Consider if this is worth changing.

### Medium Priority
3. **TOMATOES fallback fair** — `4993.0` is below the observed market mid of `~5006`. Until 12 ticks of history accumulate, fair value is wrong. Consider starting with a mid-price observation before using the rolling avg.
4. **Trend detection tuning** — `trend_threshold=0.15` and `trend_edge_mul=10.0` were set analytically, not backtested. Use the backtester in `Mitchell/Backtester - nabayansaha/` to optimise.
5. **quote_size** — Currently 12 (EMERALDS) and 10 (TOMATOES). The bot spreads have ~12 units at level 1, so we roughly match available liquidity. Could experiment with larger sizes to capture more when bots do cross.

### Low Priority
6. **TOMATOES make_width** — At `2.0`, our asks land at `best_ask - 1 = ~5012`. This is 1 tick inside the bot's `5013`. If we widen to `3.0`, we'd land at `5010` — deeper inside the spread, potentially fewer fills but more edge each. Worth backtesting.
7. **Per-round parameter updates** — Once Round 1 begins on April 14, new products will be introduced. This file and `trader.py` will need updating with new product names, fair values, and position limits.

---

## Book Structure Reference

### EMERALDS (constant)
```
bid3: 9990  (~28 vol)
bid2: 9992  (~14 vol)
bid1: 9992  (~12 vol)   ← occasionally 10000 (1.5% of ticks)
────────────────────── fair = 10000
ask1: 10008 (~12 vol)   ← occasionally 10000 (1.5% of ticks)
ask2: 10010 (~28 vol)
```
Spread: 16 ticks. Our quotes at `9993 / 10007`.

### TOMATOES (typical)
```
bid2: ~4998 (~21 vol)
bid1: ~4999 (~6 vol)
────────────────────── fair ≈ 5006 (drifts ~4975–5009 over session)
ask1: ~5013 (~6 vol)
ask2: ~5015 (~21 vol)
```
Spread: ~13–14 ticks. Our quotes at `~5000 / ~5012`.

---

## File Map

```
tickle-monster-imc-prosperity/
├── trader.py                          # Current strategy (v4) — submit this
├── STRATEGY_CONTEXT.md                # This file
├── Prosperity Information             # Full competition rules & API docs
├── Prosperity Documents.zip           # Original docs archive
├── prosperity_docs/
│   └── Prosperity IMC 4/
│       ├── About.docx
│       ├── Python Algorithm.docx
│       └── Tutorial Round.docx
└── Mitchell/
    ├── SampleStrategy.py              # Reference strategy (~4x our v2 PnL)
    ├── Documentation.txt              # Prosperity API reference
    ├── prices_round_0_day_-1.csv      # Historical price data
    ├── prices_round_0_day_-2.csv
    ├── trades_round_0_day_-1.csv      # Historical trade data
    ├── trades_round_0_day_-2.csv
    └── Backtester - nabayansaha/      # Local backtesting framework
        └── prosperity4bt/
```

---

## Round Schedule

| Round | Opens | Closes |
|---|---|---|
| Tutorial | Now | 14 Apr 2026 12:00 CEST |
| Round 1 | 14 Apr 12:00 | 17 Apr 12:00 |
| Round 2 | 17 Apr 12:00 | 20 Apr 12:00 |
| Intermission | 20 Apr | 24 Apr |
| Round 3 | 24 Apr 12:00 | 26 Apr 12:00 |
| Round 4 | 26 Apr 12:00 | 28 Apr 12:00 |
| Round 5 | 28 Apr 12:00 | 30 Apr 12:00 |

Goal: ≥ 200,000 XIRECs by end of Round 2 to qualify for Phase 2.
