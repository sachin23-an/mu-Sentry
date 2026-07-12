# μ-Sentry: Adaptive Market Regime & Strategy Allocation Engine

A full-stack quantitative research platform that detects market regime
(trending vs. mean-reverting) on NSE large-cap stocks and dynamically
allocates capital between a momentum strategy and a mean-reversion
strategy based on that regime. It streams live telemetry to a React
dashboard over WebSocket and includes a backtesting engine with
realistic transaction costs and in-sample/out-of-sample validation.

This is a research framework for testing regime-adaptive strategies —
not a live trading system. Market data is 15-minute bars from Yahoo
Finance (`yfinance`), not an institutional feed, and execution is
simulated, not live.

## What It Does

1. **Regime Detection** — combines three independent signals into a
   composite score:
   - Hurst exponent (rescaled-range / R-S analysis) — measures trend
     persistence vs. mean reversion
   - Realized volatility percentile (20-bar window vs. rolling history)
   - SMA momentum score (price vs. SMA20/SMA50/SMA100)
2. **Strategy Allocation** — blends a momentum strategy (SMA 20/50
   crossover) with a mean-reversion strategy (RSI + Bollinger Bands)
   based on the detected regime:
   - `TRENDING` → 80% momentum / 20% mean-reversion
   - `MEAN_REVERTING` → 20% momentum / 80% mean-reversion
   - `UNCERTAIN` → 50/50 blend
3. **Backtesting** — real Sharpe/Sortino/Calmar ratios, max drawdown,
   win rate, and profit factor, computed with a 6 bps transaction cost
   per trade and a chronological in-sample/out-of-sample split (no
   look-ahead).
4. **Real-time Telemetry** — Flask backend broadcasts live state
   (regime, portfolio, PnL, alerts) over WebSocket every few seconds to
   a React dashboard.

## Architecture

```
Browser
  │  http://localhost:3000
  ▼
Express Gateway (server.ts)
  │  proxies /api, /v1, /python-ws
  ▼
Flask Backend (backend/app.py)  ── yfinance ── NSE market data (15m bars)
  │
  ├── compute_hurst()        R/S analysis
  ├── classify_regime()      composite regime score
  ├── momentum_signals()     SMA 20/50 crossover
  ├── meanrev_signals()      RSI + Bollinger Bands
  ├── switching_signal()     regime-weighted blend
  └── run_backtest()         Sharpe/Sortino/Calmar, real costs
```

- **Frontend:** React 19 + TypeScript + Recharts, WebSocket client in
  `context/TelemetryContext.tsx`
- **Gateway:** Express (`server.ts`) — dev mode uses Vite middleware
  with hot reload, production serves the static build
- **Backend:** Python / Flask + `flask-sock` for WebSocket, `pandas` /
  `numpy` / `scipy` for the actual math

## Quick Start

```bash
# 1. Install JS dependencies
npm install

# 2. Install Python dependencies
pip install -r backend/requirements.txt

# 3. Run frontend + backend together
npm run dev

# 4. Open the dashboard
open http://localhost:3000
```

`npm run dev` starts the Express/Vite gateway on port 3000 and the
Flask backend on port 5000 concurrently. The gateway proxies API,
`/v1/*`, and WebSocket traffic to the backend, so the browser only
ever talks to port 3000.

For a production-style run:

```bash
npm run build
npm start
```

## Core Algorithms

| Function | File | What it does |
|---|---|---|
| `compute_hurst()` | `backend/app.py` | R/S analysis; H > 0.5 = trending, H < 0.5 = mean-reverting |
| `classify_regime()` | `backend/app.py` | Weighted composite of vol percentile, Hurst, and momentum → TRENDING / MEAN_REVERTING / UNCERTAIN |
| `momentum_signals()` | `backend/app.py` | SMA 20/50 crossover |
| `meanrev_signals()` | `backend/app.py` | RSI < 35 and price at/below lower Bollinger Band |
| `switching_signal()` | `backend/app.py` | Regime-weighted blend of the two strategies |
| `run_backtest()` | `backend/app.py` | Sharpe, Sortino, Calmar, max drawdown, win rate, profit factor with transaction costs |
| `run_full_backtest()` | `backend/app.py` | Runs the above per-symbol with in-sample/out-of-sample split and regime-conditional performance |

## Key Files

| File | Purpose |
|---|---|
| `backend/app.py` | Main engine: data fetch, regime classification, backtesting, WebSocket broadcast |
| `server.ts` | Express gateway — proxies API/WebSocket traffic to Flask in dev and prod |
| `context/TelemetryContext.tsx` | WebSocket client, keeps live backend state in React context |
| `hooks/useTradingData.ts` | Maps raw telemetry into typed data for the dashboard components |
| `components/Dashboard.tsx` | Main dashboard: strategy panels, regime state, PnL, event feed |
| `components/MarketOracle.tsx` | Live rule-based commentary generated from current regime/Hurst state (`/v1/oracle`) |
| `types.ts` | Shared TypeScript types for telemetry, strategies, regime, and backtest state |

## Honest Limitations

- Market data is 15-minute bars from `yfinance`, not tick-level or an
  institutional feed.
- This is paper/backtest simulation on historical + delayed data, not
  a live-trading system.
- The in-sample/out-of-sample split is chronological but the test
  window is limited by how much history `yfinance` reliably returns —
  treat backtest results as indicative, not a guarantee of live
  performance.

## Companion Projects

- **[The Complexity Trap](https://github.com/sachin23-an/the-complexity-trap)** — working paper on cost-robustness across strategy complexity; μ-Sentry's regime-adaptive approach is a direct extension of that paper's findings.
- **[Backtesting Engine](https://github.com/sachin23-an/backtesting-engine)** — standalone vectorised backtesting framework.

## Roadmap

- [ ] Time-series module (ARIMA/GARCH) for volatility forecasting
- [ ] Options pricer (Black-Scholes + Greeks) for derivatives-aware sizing
- [ ] Order book imbalance signals for shorter-horizon regime detection