# SampleStrategy Usage Guide

This folder now contains a basic mean-reversion strategy for the Prosperity tutorial round:

- `SampleStrategy.py` — the trading algorithm
- `Backtester - nabayansaha/` — the attached local backtester

## What the strategy does

- Trades `EMERALDS` around a stable fair value near `10000`
- Trades `TOMATOES` using a short rolling mean of recent prices
- Buys when the market looks cheap and sells when it looks expensive
- Respects the tutorial round position limits of `80` for both products

---

## Quick start (Windows PowerShell)

### 1) Activate the virtual environment

```powershell
& "c:/Users/mitch/OneDrive - purdue.edu/Other/IP4/TUTORIAL_ROUND_1/.venv/Scripts/Activate.ps1"
```

### 2) Change into the backtester folder

```powershell
Set-Location "c:\Users\mitch\OneDrive - purdue.edu\Other\IP4\TUTORIAL_ROUND_1\Backtester - nabayansaha"
```

### 3) Run the strategy on tutorial round 0

```powershell
& "c:/Users/mitch/OneDrive - purdue.edu/Other/IP4/TUTORIAL_ROUND_1/.venv/Scripts/python.exe" -m prosperity4bt "..\SampleStrategy.py" 0 --merge-pnl --no-out
```

---

## Common arguments

| Argument | Meaning | Example |
|---|---|---|
| `0` | Run all available tutorial round 0 days | `... "..\SampleStrategy.py" 0` |
| `0--1` | Run only day `-1` of round 0 | `... "..\SampleStrategy.py" 0--1` |
| `0--2` | Run only day `-2` of round 0 | `... "..\SampleStrategy.py" 0--2` |
| `--merge-pnl` | Show merged profit across all selected days | `... 0 --merge-pnl` |
| `--no-out` | Skip writing the JSON/log output file | `... 0 --no-out` |
| `--out result.log` | Save output to a custom file | `... 0 --out result.log` |
| `--print` | Print trader logs while running | `... 0 --print` |
| `--vis` | Open results in the visualizer | `... 0 --vis` |
| `--limit EMERALDS:80` | Override a position limit if needed | `... 0 --limit EMERALDS:80 --limit TOMATOES:80` |

---

## Useful run examples

### Run all tutorial data

```powershell
& "c:/Users/mitch/OneDrive - purdue.edu/Other/IP4/TUTORIAL_ROUND_1/.venv/Scripts/python.exe" -m prosperity4bt "..\SampleStrategy.py" 0 --merge-pnl --no-out
```

### Run just one day

```powershell
& "c:/Users/mitch/OneDrive - purdue.edu/Other/IP4/TUTORIAL_ROUND_1/.venv/Scripts/python.exe" -m prosperity4bt "..\SampleStrategy.py" 0--1 --no-out
```

### Debug with printed logs

```powershell
& "c:/Users/mitch/OneDrive - purdue.edu/Other/IP4/TUTORIAL_ROUND_1/.venv/Scripts/python.exe" -m prosperity4bt "..\SampleStrategy.py" 0 --print
```

---

## Submission note

If you want to upload to the Prosperity simulator, the file you would submit is:

- `SampleStrategy.py`

The local backtester folder is only for testing.
