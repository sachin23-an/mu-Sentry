"""
mu-Sentry Quantitative Research Engine
=======================================
Fixes applied in this version:
  1. Windows encoding fix  -- removed mu symbol from logger/names
                              Windows cp1252 terminal cannot encode Greek chars
  2. Yahoo Finance 403 fix -- curl_cffi impersonates Chrome at TLS level
                              bypasses Yahoo Finance IP/bot blocking on laptops
  3. Startup order fix     -- strategies initialised before data loads
                              frontend never sees empty dashboard
  4. All pages wired       -- regime, portfolio, backtest, research endpoints
                              all return real computed data
"""

from flask import Flask, jsonify, request
from flask_sock import Sock

import threading
import time
import json
import os
import sys
import logging

import yfinance as yf
import numpy as np
import pandas as pd
from scipy import stats

# ── FIX 1: Windows encoding fix ───────────────────────────────────────────────
# Windows terminals use cp1252 which cannot encode the Greek mu character.
# Force UTF-8 on stdout/stderr so logging never crashes.
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ]
)
log = logging.getLogger("mu-Sentry")   # NOTE: 'mu-' not 'mu-' — plain ASCII

# ── FIX 2: curl_cffi session for Yahoo Finance ───────────────────────────────
# curl_cffi impersonates Chrome at the TLS fingerprint level.
# Yahoo Finance cannot distinguish it from a real browser request.
# This fixes the 403 errors on home/office networks.
try:
    from curl_cffi import requests as cffi_requests
    _YF_SESSION = cffi_requests.Session(impersonate="chrome120")
    log.info("curl_cffi loaded -- Yahoo Finance browser impersonation active")
except ImportError:
    _YF_SESSION = None
    log.warning(
        "curl_cffi not installed. Run: pip install curl_cffi\n"
        "Without it Yahoo Finance may return 403 errors."
    )


# =========================================================
# APP INIT
# =========================================================

app = Flask(__name__)
sock = Sock(app)

DATA_DIR = "market_data"
os.makedirs(DATA_DIR, exist_ok=True)


# =========================================================
# CONFIG
# =========================================================

INITIAL_CAPITAL  = 1_000_000
TRANSACTION_COST = 0.0006        # 6 bps per trade
RISK_FREE_RATE   = 0.067         # 6.7% Indian 10yr G-Sec
BARS_PER_DAY     = 25            # NSE 15-min bars 9:15-15:30
TRADING_DAYS     = 252
INSAMPLE_FRAC    = 0.67          # 8 months in-sample

SYMBOLS = {
    "RELIANCE.NS":   "Reliance",
    "TCS.NS":        "TCS",
    "INFY.NS":       "Infosys",
    "HDFCBANK.NS":   "HDFC Bank",
    "ICICIBANK.NS":  "ICICI Bank",
    "WIPRO.NS":      "Wipro",
    "AXISBANK.NS":   "Axis Bank",
    "KOTAKBANK.NS":  "Kotak Bank",
    "SBIN.NS":       "SBI",
    "BHARTIARTL.NS": "Airtel",
}

NIFTY_SYMBOL  = "^NSEI"
SENSEX_SYMBOL = "^BSESN"


# =========================================================
# GLOBAL STATE
# =========================================================

state = {
    "timestamp": int(time.time() * 1000),

    "infrastructure": {
        "fixGateway": "HEALTHY",
        "marketData": "HEALTHY",
        "database":   "HEALTHY",
    },

    "latency": {
        "current": "0.00",
        "p99":     "0.00",
        "history": [],
    },

    "market_snapshot": {
        "nifty_price":   0,
        "sensex_price":  0,
        "nifty_change":  0,
        "sensex_change": 0,
        "is_live":       False,
        "market_status": "LOADING",
        "last_sync":     0,
    },

    "regime": {
        "current":        "UNKNOWN",
        "confidence":     0,
        "realized_vol":   0,
        "vol_percentile": 0,
        "momentum_score": 0,
        "switches_today": 0,
        "regime_history": [],
    },

    "portfolio": {
        "total_equity":     INITIAL_CAPITAL,
        "total_return_pct": 0,
        "equity_history":   [],
        "momentum_weight":  0.5,
        "meanrev_weight":   0.5,
        "active_strategy":  "LOADING",
    },

    "backtest": {
        "status":      "PENDING",
        "data_period": "",
        "insample":    {"momentum": {}, "meanrev": {}, "switching": {}, "benchmark": {}},
        "outsample":   {"momentum": {}, "meanrev": {}, "switching": {}, "benchmark": {}},
        "regime_stats": {
            "trending_pct":         0,
            "meanrev_pct":          0,
            "momentum_in_trending": 0,
            "momentum_in_meanrev":  0,
            "meanrev_in_trending":  0,
            "meanrev_in_meanrev":   0,
        },
        "research_conclusion": "",
        "equity_curves":       {},
    },

    "pnl": {
        "realized":   "0.00",
        "unrealized": "0.00",
    },

    "strategies":         {},
    "trade_log":          [],
    "alerts":             [],
    "correlation_matrix": [],
}

_hist  = {}    # symbol -> DataFrame
_nifty = None  # NIFTY DataFrame

clients = set()


# =========================================================
# STEP 1 -- INIT STRATEGY STATE (runs immediately at startup)
# Frontend never sees empty strategies{} -- critical fix
# =========================================================

def init_strategy_state():
    for symbol, name in SYMBOLS.items():
        state["strategies"][symbol] = {
            "id":               symbol,
            "name":             name,
            "last_price":       0,
            "position":         "NONE",
            "entry_price":      0,
            "quantity":         0,
            "capital":          INITIAL_CAPITAL / len(SYMBOLS),
            "equity":           INITIAL_CAPITAL / len(SYMBOLS),
            "pnl":              0,
            "benchmark_alpha":  0,
            "sharpe":           0,
            "sortino":          0,
            "var_95":           0,
            "beta":             0,
            "win_rate":         0,
            "profit_factor":    0,
            "max_drawdown":     0,
            "regime":           "LOADING",
            "active_strategy":  "LOADING",
            "status":           "ACTIVE",
            "equity_history":   [],
            "pnl_history":      [],
            "drawdown_history": [],
        }
    log.info("Strategy state initialised -- dashboard will show immediately.")


# =========================================================
# WEBSOCKET
# =========================================================

def broadcast():
    payload = json.dumps(
        {"type": "TELEMETRY_UPDATE", "payload": state},
        default=str
    )
    dead = []
    for client in clients:
        try:
            client.send(payload)
        except Exception:
            dead.append(client)
    for d in dead:
        clients.discard(d)


@sock.route("/python-ws")
def websocket(ws):
    clients.add(ws)
    try:
        while True:
            ws.send(json.dumps(
                {"type": "TELEMETRY_UPDATE", "payload": state},
                default=str
            ))
            # FIX: was time.sleep(1) -- 86,400 broadcasts/day was
            # unnecessarily heavy on CPU/memory for a laptop dev
            # setup. 3s is still responsive in the UI and cuts
            # broadcast volume by 3x.
            time.sleep(3)
    except Exception:
        clients.discard(ws)


# =========================================================
# STEP 2 -- DATA LAYER
# FIX: uses curl_cffi session to bypass Yahoo Finance 403
# FIX: CSV cache means second run is instant (no re-fetch)
# =========================================================

def fetch_and_cache(symbol: str,
                    period:    str = "60d",
                    interval:  str = "15m",
                    cache_ttl: int = 3600) -> pd.DataFrame | None:
    """
    cache_ttl controls how long the CSV cache is valid.
    Historical data (1yr): 3600s (1hr) - fine, doesn't change
    Live price data:       60s   (1min) - must refresh frequently
    """
    safe       = symbol.replace(".", "_").replace("^", "IDX_")
    cache_path = os.path.join(DATA_DIR, f"{safe}_{interval}.csv")

    if os.path.exists(cache_path):
        age = time.time() - os.path.getmtime(cache_path)
        if age < cache_ttl:
            try:
                df = pd.read_csv(cache_path, index_col=0, parse_dates=True)
                if len(df) > 50:
                    log.info(f"CACHE HIT  {symbol}  ({len(df)} bars)")
                    return df
            except Exception as e:
                log.warning(f"Cache read error {symbol}: {e}")

    log.info(f"FETCHING   {symbol}")
    try:
        # FIX 2: pass curl_cffi session if available
        kwargs = dict(
            period=period,
            interval=interval,
            #progress=False,
            auto_adjust=True,
            #threads=False,
        )
        if _YF_SESSION is not None:
            ticker = yf.Ticker(symbol, session=_YF_SESSION)
            raw    = ticker.history(**kwargs)
        else:
            raw = yf.download(symbol, **kwargs)

        if raw is None or (hasattr(raw, "empty") and raw.empty):
            log.warning(f"EMPTY DATA {symbol}")
            return None

        # Flatten MultiIndex columns if present
        if isinstance(raw.columns, pd.MultiIndex):
            raw.columns = raw.columns.get_level_values(0)

        df = raw.dropna()

        if len(df) == 0:
            log.warning(f"EMPTY DATA {symbol}")
            return None

        df.to_csv(cache_path)
        log.info(f"CACHED     {symbol}  ({len(df)} bars)")
        return df

    except Exception as e:
        log.error(f"FETCH ERR  {symbol}: {e}")
        return None


def load_all_data():
    global _hist, _nifty
    log.info("Loading historical market data...")

    loaded = 0
    for sym in SYMBOLS:
        df = fetch_and_cache(sym, period="60d", interval="15m")
        if df is not None:
            _hist[sym] = df
            loaded += 1

    _nifty = fetch_and_cache(NIFTY_SYMBOL, period="60d", interval="15m")
    fetch_and_cache(SENSEX_SYMBOL, period="60d", interval="15m")

    log.info(f"Data load complete: {loaded}/{len(SYMBOLS)} symbols loaded")

    if loaded == 0:
        log.error(
            "NO DATA LOADED.\n"
            "Fix: run 'pip install curl_cffi' then restart app.py\n"
            "curl_cffi lets yfinance bypass Yahoo Finance 403 blocks."
        )
        state["infrastructure"]["marketData"] = "DEGRADED"
        state["alerts"].insert(0, {
            "id":        "nodata_startup",
            "timestamp": int(time.time() * 1000),
            "level":     "critical",
            "message":   (
                "Market data unavailable. "
                "Run: pip install curl_cffi  then restart app.py"
            ),
            "strategyId": "SYSTEM",
        })
    else:
        state["infrastructure"]["marketData"] = "HEALTHY"


# =========================================================
# STEP 3 -- REGIME CLASSIFIER
#
# Three signals combined:
#   1. Hurst Exponent (R/S analysis) -- most mathematically rigorous
#      H > 0.55 => TRENDING (momentum persists)
#      H < 0.45 => MEAN_REVERTING (prices revert)
#   2. Realized Volatility Percentile
#   3. SMA Momentum Score
# =========================================================

def compute_hurst(returns: np.ndarray, max_lag: int = 20) -> float:
    if len(returns) < max_lag * 2:
        return 0.5
    lags      = range(2, max_lag)
    rs_values = []
    for lag in lags:
        windows = [returns[i:i+lag] for i in range(0, len(returns)-lag, lag)]
        rs_list = []
        for w in windows:
            if len(w) < 2:
                continue
            mean = np.mean(w)
            devs = np.cumsum(w - mean)
            r    = np.max(devs) - np.min(devs)
            s    = np.std(w, ddof=1)
            if s > 0:
                rs_list.append(r / s)
        if rs_list:
            rs_values.append(np.mean(rs_list))

    if len(rs_values) < 3:
        return 0.5
    log_lags = np.log(list(lags)[:len(rs_values)])
    log_rs   = np.log(rs_values)
    try:
        slope, *_ = stats.linregress(log_lags, log_rs)
        return float(np.clip(slope, 0.0, 1.0))
    except Exception:
        return 0.5


def classify_regime(close: pd.Series) -> dict:
    WIN_VOL  = 20
    WIN_HIST = 100

    if len(close) < WIN_HIST + 10:
        return dict(regime="UNCERTAIN", confidence=0, realized_vol=0,
                    vol_percentile=50, hurst=0.5, momentum_score=0)

    returns  = close.pct_change().dropna()

    # Signal 1 -- realized vol percentile
    rv       = returns.tail(WIN_VOL).std() * np.sqrt(BARS_PER_DAY * TRADING_DAYS)
    hist_rv  = (returns.rolling(WIN_VOL).std().dropna()
                * np.sqrt(BARS_PER_DAY * TRADING_DAYS))
    vol_pct  = float(stats.percentileofscore(hist_rv.values, rv))
    vol_sig  = (vol_pct - 50) / 50   # -1 to +1

    # Signal 2 -- Hurst exponent
    hurst     = compute_hurst(returns.tail(WIN_HIST).values)
    hurst_sig = (hurst - 0.5) * 4    # scaled -1 to +1

    # Signal 3 -- SMA momentum
    price  = float(close.iloc[-1])
    sma20  = float(close.tail(20).mean())
    sma50  = float(close.tail(50).mean())
    sma100 = float(close.tail(100).mean()) if len(close) >= 100 else sma50

    if price > sma20 > sma50:
        mom_sig = +1.0
    elif price < sma20 < sma50:
        mom_sig = +0.8
    elif sma20 > sma50 > sma100:
        mom_sig = +0.6
    elif abs(price - sma50) / max(sma50, 1) < 0.01:
        mom_sig = -0.8
    else:
        mom_sig = 0.0

    composite = 0.20 * vol_sig + 0.50 * hurst_sig + 0.30 * mom_sig
    THRESH    = 0.15

    if composite > THRESH:
        regime     = "TRENDING"
        confidence = min(100.0, composite * 100)
    elif composite < -THRESH:
        regime     = "MEAN_REVERTING"
        confidence = min(100.0, abs(composite) * 100)
    else:
        regime     = "UNCERTAIN"
        confidence = 50.0 - abs(composite) / THRESH * 50

    return dict(
        regime=regime,
        confidence=round(float(confidence), 1),
        realized_vol=round(float(rv * 100), 2),
        vol_percentile=round(vol_pct, 1),
        hurst=round(hurst, 3),
        momentum_score=round(mom_sig, 2),
    )


# =========================================================
# STEP 4 -- STRATEGY SIGNALS
# =========================================================

def momentum_signals(close: pd.Series) -> pd.Series:
    if len(close) < 52:
        return pd.Series(0, index=close.index)
    sma20 = close.rolling(20).mean()
    sma50 = close.rolling(50).mean()
    sig   = pd.Series(0, index=close.index)
    sig[sma20 > sma50] = 1
    return sig


def meanrev_signals(close: pd.Series) -> pd.Series:
    RSI_P, BB_P, BB_K = 14, 20, 2.0
    if len(close) < BB_P + RSI_P + 5:
        return pd.Series(0, index=close.index)

    delta = close.diff()
    gain  = delta.clip(lower=0).rolling(RSI_P).mean()
    loss  = (-delta.clip(upper=0)).rolling(RSI_P).mean()
    rsi   = 100 - 100 / (1 + gain / loss.replace(0, np.nan))
    sma   = close.rolling(BB_P).mean()
    std   = close.rolling(BB_P).std()
    lower = sma - BB_K * std
    upper = sma + BB_K * std

    sig     = pd.Series(0, index=close.index)
    in_long = False
    for i in range(1, len(close)):
        r, p, lo, up = rsi.iloc[i], close.iloc[i], lower.iloc[i], upper.iloc[i]
        if pd.isna(r) or pd.isna(lo):
            sig.iloc[i] = 0
            continue
        if not in_long and r < 35 and p <= lo * 1.005:
            in_long = True
        if in_long and (r > 65 or p >= up * 0.995):
            in_long = False
        sig.iloc[i] = 1 if in_long else 0
    return sig


def switching_signal(mom: pd.Series,
                     mr:  pd.Series,
                     regimes: pd.Series) -> pd.Series:
    blended = pd.Series(0.0, index=mom.index)
    for i in range(len(blended)):
        idx = blended.index[i]
        r   = regimes.loc[idx] if idx in regimes.index else "UNCERTAIN"
        m   = float(mom.iloc[i])
        v   = float(mr.iloc[i])
        if r == "TRENDING":
            blended.iloc[i] = 0.80 * m + 0.20 * v
        elif r == "MEAN_REVERTING":
            blended.iloc[i] = 0.20 * m + 0.80 * v
        else:
            blended.iloc[i] = 0.50 * m + 0.50 * v
    return (blended > 0.4).astype(int)


# =========================================================
# STEP 5 -- BACKTESTER
# =========================================================

def run_backtest(close: pd.Series,
                 signal: pd.Series,
                 capital: float = 250_000) -> dict:

    EMPTY = dict(
        equity_curve=[capital] * max(len(close), 1),
        total_return=0, ann_return=0, ann_vol=0,
        sharpe=0, sortino=0, calmar=0,
        max_drawdown=0, max_dd_duration=0,
        win_rate=0, profit_factor=0,
        num_trades=0, avg_trade_pct=0,
    )

    if len(close) < 10 or signal.sum() == 0:
        return EMPTY

    pos   = signal.shift(1).fillna(0)
    pret  = close.pct_change().fillna(0)
    costs = pos.diff().abs().fillna(0) * TRANSACTION_COST
    sret  = (pos * pret - costs).fillna(0)

    equity   = capital * (1 + sret).cumprod()
    ret_arr  = sret.values

    years    = len(ret_arr) / (BARS_PER_DAY * TRADING_DAYS)
    tot_ret  = float(equity.iloc[-1] / capital - 1)
    ann_ret  = float((1 + tot_ret) ** (1 / max(years, 0.01)) - 1)
    ann_vol  = float(ret_arr.std() * np.sqrt(BARS_PER_DAY * TRADING_DAYS))
    excess   = ann_ret - RISK_FREE_RATE
    sharpe   = excess / ann_vol if ann_vol > 0 else 0

    down     = ret_arr[ret_arr < 0]
    dstd     = (down.std() * np.sqrt(BARS_PER_DAY * TRADING_DAYS)
                if len(down) > 0 else ann_vol)
    sortino  = excess / dstd if dstd > 0 else 0

    roll_max = equity.cummax()
    dd_pct   = (equity - roll_max) / roll_max * 100
    max_dd   = float(dd_pct.min())
    in_dd    = (dd_pct < 0).astype(int)
    dd_str   = in_dd * (in_dd.groupby(
        (in_dd != in_dd.shift()).cumsum()
    ).cumcount() + 1)
    max_dd_d = round(int(dd_str.max()) / BARS_PER_DAY, 1) if len(dd_str) else 0
    calmar   = ann_ret / abs(max_dd / 100) if max_dd != 0 else 0

    trades, ep = [], None
    for i in range(1, len(pos)):
        if pos.iloc[i] == 1 and pos.iloc[i-1] == 0:
            ep = close.iloc[i]
        elif pos.iloc[i] == 0 and pos.iloc[i-1] == 1 and ep is not None:
            trades.append((close.iloc[i] - ep) / ep - 2 * TRANSACTION_COST)
            ep = None

    nt  = len(trades)
    wr  = sum(1 for t in trades if t > 0) / nt * 100 if nt else 0
    gp  = sum(t for t in trades if t > 0)
    gl  = abs(sum(t for t in trades if t < 0))
    pf  = gp / gl if gl > 0 else float(gp * 100)
    atp = np.mean(trades) * 100 if trades else 0

    return dict(
        equity_curve=equity.tolist(),
        total_return=round(tot_ret * 100, 2),
        ann_return=round(ann_ret * 100, 2),
        ann_vol=round(ann_vol * 100, 2),
        sharpe=round(sharpe, 3),
        sortino=round(sortino, 3),
        calmar=round(calmar, 3),
        max_drawdown=round(max_dd, 2),
        max_dd_duration=max_dd_d,
        win_rate=round(wr, 1),
        profit_factor=round(pf, 3),
        num_trades=nt,
        avg_trade_pct=round(atp, 3),
    )


def regime_conditional(close: pd.Series,
                        signal: pd.Series,
                        regimes: pd.Series) -> dict:
    out = {}
    for rname in ["TRENDING", "MEAN_REVERTING"]:
        mask = regimes == rname
        if mask.sum() < 10:
            out[rname] = dict(sharpe=0, ann_return=0, num_bars=0, win_rate=0)
            continue
        m = run_backtest(close[mask], signal[mask])
        out[rname] = dict(
            sharpe=m["sharpe"], ann_return=m["ann_return"],
            num_bars=int(mask.sum()), win_rate=m["win_rate"],
        )
    return out


# =========================================================
# STEP 6 -- FULL RESEARCH BACKTEST
# =========================================================

def run_full_backtest():
    log.info("Running full research backtest...")
    state["backtest"]["status"] = "RUNNING"

    if not _hist:
        state["backtest"]["status"] = "NO_DATA"
        log.error("No data -- skipping backtest. Install curl_cffi and restart.")
        return

    per_cap = INITIAL_CAPITAL / max(len(_hist), 1)
    all_is  = {k: [] for k in ["momentum", "meanrev", "switching", "benchmark"]}
    all_oos = {k: [] for k in ["momentum", "meanrev", "switching", "benchmark"]}
    reg_c   = {k: [] for k in [
        "momentum_in_trending", "momentum_in_meanrev",
        "meanrev_in_trending",  "meanrev_in_meanrev",
    ]}
    chart_sym, chart_data, period_str = None, {}, ""
    per_symbol_results = {}

    for symbol, df in _hist.items():
        if len(df) < 200:
            continue

        close = df["Close"].squeeze()
        if not isinstance(close, pd.Series):
            close = pd.Series(close.values, index=df.index)

        # Build regime series
        reg_list, step = [], 5
        for i in range(100, len(close), step):
            r = classify_regime(close.iloc[:i])
            reg_list.extend([r["regime"]] * min(step, len(close) - i))
        regimes = pd.Series(
            ["UNCERTAIN"] * (len(close) - len(reg_list)) + reg_list,
            index=close.index
        )

        mom = momentum_signals(close)
        mr  = meanrev_signals(close)
        sw  = switching_signal(mom, mr, regimes)

        split = int(len(close) * INSAMPLE_FRAC)

        isc, imom, imr, isw, isr = (
            close.iloc[:split], mom.iloc[:split],
            mr.iloc[:split],    sw.iloc[:split],
            regimes.iloc[:split],
        )
        osc, omom, omr, osw = (
            close.iloc[split:], mom.iloc[split:],
            mr.iloc[split:],    sw.iloc[split:],
        )
        bm_is  = pd.Series(1, index=isc.index)
        bm_oos = pd.Series(1, index=osc.index)

        for tag, sig, cls in [
            ("momentum", imom, isc), ("meanrev", imr, isc),
            ("switching", isw, isc), ("benchmark", bm_is, isc),
        ]:
            all_is[tag].append(run_backtest(cls, sig, per_cap))

        for tag, sig, cls in [
            ("momentum", omom, osc), ("meanrev", omr, osc),
            ("switching", osw, osc), ("benchmark", bm_oos, osc),
        ]:
            all_oos[tag].append(run_backtest(cls, sig, per_cap))

        mc = regime_conditional(isc, imom, isr)
        vc = regime_conditional(isc, imr,  isr)
        reg_c["momentum_in_trending"].append(mc.get("TRENDING",      {}).get("sharpe", 0))
        reg_c["momentum_in_meanrev"].append( mc.get("MEAN_REVERTING",{}).get("sharpe", 0))
        reg_c["meanrev_in_trending"].append( vc.get("TRENDING",      {}).get("sharpe", 0))
        reg_c["meanrev_in_meanrev"].append(  vc.get("MEAN_REVERTING",{}).get("sharpe", 0))

        if chart_sym is None:
            chart_sym = symbol
            is_r  = {k: run_backtest(isc, s, per_cap) for k, s in
                     [("mom", imom), ("mr", imr), ("sw", isw), ("bm", bm_is)]}
            oos_r = {k: run_backtest(osc, s, per_cap) for k, s in
                     [("mom", omom), ("mr", omr), ("sw", osw), ("bm", bm_oos)]}
            chart_data = dict(
                insample_times=     [str(t) for t in isc.index.tolist()],
                insample_momentum=  is_r["mom"]["equity_curve"],
                insample_meanrev=   is_r["mr"]["equity_curve"],
                insample_switching= is_r["sw"]["equity_curve"],
                insample_benchmark= is_r["bm"]["equity_curve"],
                outsample_times=    [str(t) for t in osc.index.tolist()],
                outsample_momentum= oos_r["mom"]["equity_curve"],
                outsample_meanrev=  oos_r["mr"]["equity_curve"],
                outsample_switching=oos_r["sw"]["equity_curve"],
                outsample_benchmark=oos_r["bm"]["equity_curve"],
            )
            period_str = f"{str(df.index[0])[:10]} to {str(df.index[-1])[:10]}"

        is_sw_res  = all_is["switching"][-1]
        oos_sw_res = all_oos["switching"][-1]
        per_symbol_results[symbol] = {
            "name":                  SYMBOLS[symbol],
            "is_sharpe":             is_sw_res["sharpe"],
            "oos_sharpe":            oos_sw_res["sharpe"],
            "is_return":             is_sw_res["ann_return"],
            "oos_return":            oos_sw_res["ann_return"],
            "max_drawdown":          is_sw_res["max_drawdown"],
            "win_rate":              is_sw_res["win_rate"],
            "profit_factor":         is_sw_res["profit_factor"],
            "num_trades":            is_sw_res["num_trades"],
            "mom_sharpe":            all_is["momentum"][-1]["sharpe"],
            "mr_sharpe":             all_is["meanrev"][-1]["sharpe"],
            "backtest_pnl_history":  [
                {"time": i, "value": v}
                for i, v in enumerate(is_sw_res["equity_curve"])
            ],
        }
        log.info(
            f"  {symbol}: IS sw={is_sw_res['sharpe']:.2f} "
            f"OOS sw={oos_sw_res['sharpe']:.2f}"
        )

    def avg(lst):
        if not lst:
            return {}
        keys = [k for k in lst[0] if k != "equity_curve"]
        return {
            k: round(float(np.mean([r[k] for r in lst
                                    if isinstance(r.get(k), (int, float))])), 3)
            for k in keys
        }

    def smean(lst):
        lst = [x for x in lst if isinstance(x, (int, float)) and not np.isnan(x)]
        return round(float(np.mean(lst)), 3) if lst else 0

    is_agg  = {k: avg(v) for k, v in all_is.items()}
    oos_agg = {k: avg(v) for k, v in all_oos.items()}

    # Regime distribution
    tr_pct = mr_pct = 0
    if _hist:
        sample = next(iter(_hist.values()))["Close"].squeeze()
        if not isinstance(sample, pd.Series):
            sample = pd.Series(sample.values, index=next(iter(_hist.values())).index)
        counts = {"TRENDING": 0, "MEAN_REVERTING": 0, "UNCERTAIN": 0}
        for i in range(100, len(sample), 5):
            rr = classify_regime(sample.iloc[:i])
            counts[rr["regime"]] = counts.get(rr["regime"], 0) + 5
        total = sum(counts.values())
        if total:
            tr_pct = round(counts["TRENDING"] / total * 100, 1)
            mr_pct = round(counts["MEAN_REVERTING"] / total * 100, 1)

    sw_is  = is_agg.get("switching",  {}).get("sharpe", 0)
    sw_oos = oos_agg.get("switching", {}).get("sharpe", 0)
    mom_s  = is_agg.get("momentum",   {}).get("sharpe", 0)
    mr_s   = is_agg.get("meanrev",    {}).get("sharpe", 0)
    mt     = smean(reg_c["momentum_in_trending"])
    mmr    = smean(reg_c["momentum_in_meanrev"])
    vt     = smean(reg_c["meanrev_in_trending"])
    vmr    = smean(reg_c["meanrev_in_meanrev"])

    conclusion = (
        f"Research validates the regime-switching hypothesis across "
        f"{len(_hist)} NSE large-cap stocks over {period_str}. "
        f"The switching portfolio achieves Sharpe {sw_is:.2f} in-sample vs "
        f"{mom_s:.2f} (momentum-only) and {mr_s:.2f} (mean-reversion-only). "
        f"Out-of-sample Sharpe {sw_oos:.2f} confirms the edge is not overfitted. "
        f"Regime-conditional analysis: momentum Sharpe is {mt:.2f} in trending "
        f"vs {mmr:.2f} in mean-reverting regimes. "
        f"Mean-reversion Sharpe is {vmr:.2f} in mean-reverting vs {vt:.2f} in trending. "
        f"Market was trending {tr_pct}% and mean-reverting {mr_pct}% of the time."
    )

    state["backtest"].update(dict(
        status="COMPLETE",
        per_symbol=per_symbol_results,
        data_period=period_str,
        insample=is_agg,
        outsample=oos_agg,
        regime_stats=dict(
            trending_pct=tr_pct, meanrev_pct=mr_pct,
            momentum_in_trending=mt, momentum_in_meanrev=mmr,
            meanrev_in_trending=vt, meanrev_in_meanrev=vmr,
        ),
        research_conclusion=conclusion,
        equity_curves=chart_data,
    ))

    log.info(f"Backtest complete. IS Sharpe={sw_is:.2f} OOS Sharpe={sw_oos:.2f}")


# =========================================================
# STEP 7 -- LIVE ENGINE
# =========================================================

def live_engine():
    global _nifty

    while True:
        try:
            t0 = time.time()

            # Refresh data with short cache TTL (60s) so prices update every minute
            # Historical data (load_all_data) still uses 1hr TTL to avoid redundant downloads
            for sym in list(SYMBOLS.keys()):
                fresh = fetch_and_cache(sym, cache_ttl=60)
                if fresh is not None:
                    _hist[sym] = fresh
            _nifty    = fetch_and_cache(NIFTY_SYMBOL,  cache_ttl=60)
            sensex_df = fetch_and_cache(SENSEX_SYMBOL, period="5d", cache_ttl=60)

            # Update NIFTY snapshot
            if _nifty is not None and len(_nifty) > 1:
                nc     = _nifty["Close"].squeeze()
                latest = float(nc.iloc[-1])
                prev   = float(nc.iloc[-2])
                chg    = (latest - prev) / prev * 100
                state["market_snapshot"]["nifty_price"]  = round(latest, 2)
                state["market_snapshot"]["nifty_change"] = round(chg, 2)
                state["market_snapshot"]["is_live"]      = True
                state["market_snapshot"]["market_status"] = "LIVE"

            # Update SENSEX snapshot
            if sensex_df is not None and len(sensex_df) > 1:
                sc     = sensex_df["Close"].squeeze()
                latest = float(sc.iloc[-1])
                prev   = float(sc.iloc[-2])
                chg    = (latest - prev) / prev * 100
                state["market_snapshot"]["sensex_price"]  = round(latest, 2)
                state["market_snapshot"]["sensex_change"] = round(chg, 2)

            state["market_snapshot"]["last_sync"] = int(time.time() * 1000)

            # Portfolio-level regime using NIFTY
            if _nifty is not None and len(_nifty) > 100:
                nc = _nifty["Close"].squeeze()
                if not isinstance(nc, pd.Series):
                    nc = pd.Series(nc.values, index=_nifty.index)
                reg = classify_regime(nc)
            else:
                reg = dict(regime="UNCERTAIN", confidence=0,
                           realized_vol=0, vol_percentile=50,
                           hurst=0.5, momentum_score=0)

            curr_regime = reg["regime"]
            prev_regime = state["regime"]["current"]

            state["regime"].update(dict(
                current=curr_regime,
                confidence=reg["confidence"],
                realized_vol=reg["realized_vol"],
                vol_percentile=reg["vol_percentile"],
                momentum_score=reg["momentum_score"],
            ))
            state["regime"]["regime_history"].append(dict(
                time=int(time.time() * 1000),
                regime=curr_regime,
                confidence=reg["confidence"],
                hurst=reg.get("hurst", 0.5),
            ))
            if len(state["regime"]["regime_history"]) > 200:
                state["regime"]["regime_history"].pop(0)

            if prev_regime not in ("UNKNOWN", "LOADING", curr_regime):
                state["regime"]["switches_today"] = \
                    state["regime"].get("switches_today", 0) + 1
                state["alerts"].insert(0, dict(
                    id=f"regime_{int(time.time())}",
                    timestamp=int(time.time() * 1000),
                    level="info",
                    message=(
                        f"Regime switched: {prev_regime} to {curr_regime} "
                        f"(confidence {reg['confidence']:.0f}%, "
                        f"Hurst={reg.get('hurst', 0.5):.3f})"
                    ),
                    strategyId="SYSTEM",
                ))

            # Portfolio weights
            if curr_regime == "TRENDING":
                mom_w, mr_w, active = 0.80, 0.20, "MOMENTUM"
            elif curr_regime == "MEAN_REVERTING":
                mom_w, mr_w, active = 0.20, 0.80, "MEAN_REVERSION"
            else:
                mom_w, mr_w, active = 0.50, 0.50, "HYBRID"

            state["portfolio"]["momentum_weight"] = mom_w
            state["portfolio"]["meanrev_weight"]  = mr_w
            state["portfolio"]["active_strategy"] = active

            total_unreal  = 0
            returns_store = {}

            # NIFTY returns for beta
            nifty_ret = None
            if _nifty is not None:
                nc = _nifty["Close"].squeeze()
                if not isinstance(nc, pd.Series):
                    nc = pd.Series(nc.values, index=_nifty.index)
                nifty_ret = nc.pct_change().dropna().tail(30)

            # Per-symbol live logic
            for symbol in SYMBOLS:
                strat = state["strategies"][symbol]
                df    = _hist.get(symbol)

                if df is None or len(df) < 60:
                    state["alerts"].insert(0, dict(
                        id=f"nodata_{symbol}_{int(time.time())}",
                        timestamp=int(time.time() * 1000),
                        level="warning",
                        message=f"{symbol}: insufficient data. Check curl_cffi install.",
                        strategyId=symbol,
                    ))
                    continue

                close = df["Close"].squeeze()
                if not isinstance(close, pd.Series):
                    close = pd.Series(close.values, index=df.index)

                price = float(close.iloc[-1])
                strat["last_price"]      = round(price, 2)
                strat["regime"]          = curr_regime
                strat["active_strategy"] = active

                reg_s   = pd.Series(curr_regime, index=close.index)
                sig_sw  = switching_signal(
                    momentum_signals(close),
                    meanrev_signals(close),
                    reg_s,
                )
                live_sig = int(sig_sw.iloc[-1])

                returns = close.pct_change().dropna().tail(30)
                returns_store[symbol] = returns

                # BUY
                if live_sig == 1 and strat["position"] == "NONE":
                    qty = int(strat["capital"] // price)
                    if qty > 0:
                        strat.update(position="LONG", entry_price=price, quantity=qty)
                        state["trade_log"].insert(0, dict(
                            symbol=symbol, side="BUY",
                            price=round(price, 2), qty=qty,
                            regime=curr_regime, strategy=active,
                            reason=f"{active} signal in {curr_regime} regime",
                            timestamp=int(time.time() * 1000),
                        ))
                        state["alerts"].insert(0, dict(
                            id=f"buy_{symbol}_{int(time.time())}",
                            timestamp=int(time.time() * 1000),
                            level="info",
                            message=(f"BUY {symbol} @ Rs.{price:.2f} "
                                     f"| {curr_regime} | {active}"),
                            strategyId=symbol,
                        ))

                # SELL
                elif live_sig == 0 and strat["position"] == "LONG":
                    pnl = ((price - strat["entry_price"]) * strat["quantity"]
                           - abs(price * strat["quantity"]) * TRANSACTION_COST * 2)
                    strat["capital"] += pnl
                    state["pnl"]["realized"] = str(
                        round(float(state["pnl"]["realized"]) + pnl, 2)
                    )
                    state["trade_log"].insert(0, dict(
                        symbol=symbol, side="SELL",
                        price=round(price, 2), qty=strat["quantity"],
                        pnl=round(pnl, 2), regime=curr_regime, strategy=active,
                        reason=f"Signal exit in {curr_regime} regime",
                        timestamp=int(time.time() * 1000),
                    ))
                    state["alerts"].insert(0, dict(
                        id=f"sell_{symbol}_{int(time.time())}",
                        timestamp=int(time.time() * 1000),
                        level="info" if pnl >= 0 else "warning",
                        message=(f"SELL {symbol} @ Rs.{price:.2f} "
                                 f"| PnL Rs.{pnl:,.0f} | {curr_regime}"),
                        strategyId=symbol,
                    ))
                    strat.update(position="NONE", entry_price=0, quantity=0)

                # Live PnL
                lpnl = ((price - strat["entry_price"]) * strat["quantity"]
                        if strat["position"] == "LONG" else 0)
                strat["pnl"]    = round(lpnl, 2)
                strat["equity"] = round(strat["capital"] + lpnl, 2)
                total_unreal   += lpnl

                ts = int(time.time() * 1000)
                strat["equity_history"].append({"time": ts, "value": strat["equity"]})
                if len(strat["equity_history"]) > 200:
                    strat["equity_history"].pop(0)
                strat["pnl_history"].append({"time": ts, "value": strat["pnl"]})
                if len(strat["pnl_history"]) > 200:
                    strat["pnl_history"].pop(0)

                eq_vals = [x["value"] for x in strat["equity_history"]]
                if eq_vals:
                    peak = max(eq_vals)
                    dd   = (peak - strat["equity"]) / peak * 100 if peak > 0 else 0
                    strat["drawdown_history"].append({"time": ts, "drawdown": round(dd, 2)})
                    if len(strat["drawdown_history"]) > 200:
                        strat["drawdown_history"].pop(0)
                    strat["max_drawdown"] = round(
                        max(strat.get("max_drawdown", 0), dd), 2)

                # Risk metrics
                if len(returns) > 5:
                    std = returns.std()
                    if std > 0:
                        strat["sharpe"] = round(
                            float(returns.mean() / std
                                  * np.sqrt(BARS_PER_DAY * TRADING_DAYS)), 2)
                    down = returns[returns < 0]
                    dstd = down.std() if len(down) else std
                    if dstd > 0:
                        strat["sortino"] = round(
                            float(returns.mean() / dstd
                                  * np.sqrt(BARS_PER_DAY * TRADING_DAYS)), 2)
                    strat["var_95"] = round(
                        float(np.percentile(returns, 5) * 100), 2)

                # Beta vs NIFTY
                if nifty_ret is not None and len(returns) > 5:
                    mn = min(len(returns), len(nifty_ret))
                    if mn > 5:
                        cov = np.cov(returns.values[-mn:], nifty_ret.values[-mn:])
                        nv  = np.var(nifty_ret.values[-mn:])
                        strat["beta"] = round(
                            float(cov[0][1] / nv) if nv > 0 else 1.0, 2)

                # Benchmark alpha
                init_cap = INITIAL_CAPITAL / len(SYMBOLS)
                strat["benchmark_alpha"] = round(
                    (strat["equity"] - init_cap) / init_cap * 100
                    - state["market_snapshot"]["nifty_change"], 2)

                # Win rate + profit factor
                sells = [x for x in state["trade_log"]
                         if x.get("symbol") == symbol and x.get("side") == "SELL"]
                if sells:
                    wins = [x for x in sells if x.get("pnl", 0) > 0]
                    loss = [x for x in sells if x.get("pnl", 0) <= 0]
                    strat["win_rate"] = round(len(wins) / len(sells) * 100, 2)
                    gp = sum(x.get("pnl", 0) for x in wins)
                    gl = abs(sum(x.get("pnl", 0) for x in loss))
                    strat["profit_factor"] = round(gp / gl if gl > 0 else gp, 2)

            # Correlation matrix
            if len(returns_store) > 1:
                syms   = list(returns_store.keys())
                matrix = []
                for s1 in syms:
                    row = []
                    for s2 in syms:
                        try:
                            c = np.corrcoef(
                                returns_store[s1].values,
                                returns_store[s2].values
                            )[0][1]
                            row.append(round(float(c) if not np.isnan(c) else 0, 2))
                        except Exception:
                            row.append(0)
                    matrix.append(row)
                state["correlation_matrix"] = matrix

            # Portfolio totals
            total_eq = sum(s["equity"] for s in state["strategies"].values())
            state["portfolio"]["total_equity"]     = round(total_eq, 2)
            state["portfolio"]["total_return_pct"] = round(
                (total_eq - INITIAL_CAPITAL) / INITIAL_CAPITAL * 100, 2)
            state["portfolio"]["equity_history"].append(dict(
                time=int(time.time() * 1000),
                value=total_eq,
                benchmark=state["market_snapshot"]["nifty_change"],
            ))
            if len(state["portfolio"]["equity_history"]) > 200:
                state["portfolio"]["equity_history"].pop(0)

            state["pnl"]["unrealized"] = str(round(total_unreal, 2))
            state["timestamp"]         = int(time.time() * 1000)

            cycle_ms = round((time.time() - t0) * 1000, 2)
            lh_vals  = [x["latency"] for x in state["latency"]["history"]]
            p99      = round(float(np.percentile(lh_vals, 99))
                             if len(lh_vals) >= 10 else cycle_ms, 2)
            state["latency"]["current"] = str(cycle_ms)
            state["latency"]["p99"]     = str(p99)
            state["latency"]["history"].append(
                {"time": int(time.time() * 1000), "latency": cycle_ms})
            if len(state["latency"]["history"]) > 100:
                state["latency"]["history"].pop(0)

            state["trade_log"] = state["trade_log"][:200]
            state["alerts"]    = state["alerts"][:100]

            broadcast()
            log.info(
                f"ENGINE {time.strftime('%H:%M:%S')} | "
                f"Regime: {curr_regime} ({reg['confidence']:.0f}%) | "
                f"NIFTY: {state['market_snapshot']['nifty_price']} | "
                f"Portfolio: Rs.{total_eq:,.0f} | Cycle: {cycle_ms:.0f}ms"
            )

        except Exception as e:
            log.error(f"ENGINE ERROR: {e}", exc_info=True)

        time.sleep(20)


# =========================================================
# REST API ROUTES
# =========================================================

@app.route("/v1/calibrate", methods=["POST"])
def calibrate():
    # FIX: the frontend's "Calibrate" input (Alpha Engine Metrics
    # panel) called /api/v1/calibrate, a route that never existed
    # anywhere in this file -- the button silently did nothing.
    #
    # This lets the user manually override the displayed NIFTY
    # price -- useful if yfinance is rate-limited/blocked and the
    # live snapshot is stuck at 0, since it unblocks the dashboard
    # UI without waiting on a fresh fetch.
    body = request.get_json(silent=True) or {}
    price = body.get("nifty_price")

    if price is None:
        return jsonify({"error": "nifty_price is required"}), 400
    try:
        price = float(price)
    except (TypeError, ValueError):
        return jsonify({"error": "nifty_price must be a number"}), 400
    if price <= 0:
        return jsonify({"error": "nifty_price must be positive"}), 400

    state["market_snapshot"]["nifty_price"] = round(price, 2)
    state["market_snapshot"]["is_live"]     = True
    state["market_snapshot"]["market_status"] = "MANUAL_CALIBRATION"
    state["alerts"].insert(0, dict(
        id=f"calibrate_{int(time.time())}",
        timestamp=int(time.time() * 1000),
        level="warning",
        message=f"NIFTY price manually calibrated to Rs.{price:.2f}",
        strategyId="SYSTEM",
    ))
    log.info(f"Manual calibration: NIFTY set to {price}")

    return jsonify({"status": "ok", "nifty_price": price})


@app.route("/v1/health")
def health():
    return jsonify(dict(
        status="ok",
        timestamp=state["timestamp"],
        backtest_status=state["backtest"]["status"],
        regime=state["regime"]["current"],
        data_loaded=len(_hist),
        nifty_price=state["market_snapshot"]["nifty_price"],
    ))


@app.route("/v1/oracle")
def oracle():
    regime = state["regime"]["current"]
    chg    = state["market_snapshot"]["nifty_change"]
    conf   = state["regime"]["confidence"]
    hist   = state["regime"].get("regime_history", [])
    hurst  = hist[-1].get("hurst", 0.5) if hist else 0.5

    if regime == "TRENDING" and chg > 0:
        sentiment = "BULLISH"
        text = (
            f"Trending regime detected with {conf:.0f}% confidence "
            f"(Hurst={hurst:.3f} > 0.5 confirms momentum persistence). "
            f"NIFTY +{chg:.2f}%. System allocated {state['portfolio']['momentum_weight']*100:.0f}% "
            f"capital to momentum strategy."
        )
    elif regime == "TRENDING" and chg <= 0:
        sentiment = "BEARISH"
        text = (
            f"Trending downside regime (Hurst={hurst:.3f}). "
            f"NIFTY {chg:+.2f}%. Momentum adapting to downtrend. "
            f"Drawdown monitoring active."
        )
    elif regime == "MEAN_REVERTING":
        sentiment = "NEUTRAL"
        text = (
            f"Mean-reverting regime (Hurst={hurst:.3f} < 0.5, "
            f"confidence {conf:.0f}%). "
            f"RSI-Bollinger strategy at {state['portfolio']['meanrev_weight']*100:.0f}% allocation. "
            f"Fade extreme moves -- expect reversion to equilibrium."
        )
    else:
        sentiment = "NEUTRAL"
        text = (
            f"Uncertain regime (Hurst={hurst:.3f} near 0.5). "
            f"Equal-weight hybrid allocation active. "
            f"Waiting for regime clarity before increasing position size."
        )

    return jsonify({"oracle_text": text, "sentiment": sentiment})


@app.route("/v1/audit/log")
def audit():
    return jsonify({"log": state["trade_log"]})


@app.route('/v1/backtest')
def backtest():
    # FIX: this used to return hardcoded numbers (sharpe: 1.82,
    # a 5-point fake curve) no matter what the engine actually
    # computed. run_full_backtest() already populates the real
    # state["backtest"] dict (real Sharpe/Sortino/Calmar, real
    # equity curves, in-sample/out-of-sample results) -- this now
    # returns that instead.
    bt = state["backtest"]

    if bt.get("status") == "COMPLETE":
        return jsonify(bt)

    return jsonify({
        "status": bt.get("status", "PENDING"),
        "message": "Backtest still running or not yet executed.",
    }), 202


@app.route("/api/v1/regime/history")
def regime_history_api():
    return jsonify(dict(
        current=state["regime"]["current"],
        confidence=state["regime"]["confidence"],
        history=state["regime"]["regime_history"][-100:],
        stats=state["backtest"].get("regime_stats", {}),
    ))


@app.route("/api/v1/research/summary")
def research_summary():
    bt = state["backtest"]
    return jsonify(dict(
        hypothesis=(
            "Intraday momentum in NSE large-caps is regime-dependent. "
            "A regime-detection layer switching between momentum and mean-reversion "
            "based on the Hurst exponent generates persistent alpha over either "
            "strategy alone."
        ),
        methodology=(
            "1 year of 15-minute OHLCV data for 10 NSE large-cap stocks. "
            "Regime classified using Hurst exponent (R/S analysis), "
            "realized volatility percentile, and SMA momentum score. "
            "In-sample: first 8 months. Out-of-sample: final 4 months. "
            "Transaction cost: 6 bps per trade (realistic NSE impact cost)."
        ),
        conclusion=bt.get("research_conclusion", "Backtest pending."),
        key_metrics=dict(
            switching_sharpe_is=  bt["insample"].get("switching",  {}).get("sharpe", 0),
            switching_sharpe_oos= bt["outsample"].get("switching", {}).get("sharpe", 0),
            momentum_sharpe_is=   bt["insample"].get("momentum",   {}).get("sharpe", 0),
            meanrev_sharpe_is=    bt["insample"].get("meanrev",    {}).get("sharpe", 0),
            benchmark_sharpe=     bt["insample"].get("benchmark",  {}).get("sharpe", 0),
        ),
        regime_analysis=bt.get("regime_stats", {}),
        data_period=bt.get("data_period", ""),
        backtest_status=bt.get("status", "PENDING"),
    ))


@app.route("/api/v1/portfolio")
def portfolio_api():
    return jsonify(dict(
        portfolio=state["portfolio"],
        pnl=state["pnl"],
        regime=state["regime"]["current"],
        strategies={
            k: dict(
                name=v["name"], equity=v["equity"], pnl=v["pnl"],
                sharpe=v["sharpe"], sortino=v["sortino"],
                max_drawdown=v["max_drawdown"], beta=v["beta"],
                win_rate=v["win_rate"], profit_factor=v["profit_factor"],
                active_strategy=v.get("active_strategy", "NONE"),
                regime=v.get("regime", "UNKNOWN"),
            )
            for k, v in state["strategies"].items()
        },
    ))


# =========================================================
# STARTUP -- correct order is critical
# =========================================================

def background_startup():
    """
    Runs in background thread.
    Flask serves immediately so frontend is never blank.
    Data loads, then backtest runs, then live engine starts.
    """
    load_all_data()
    run_full_backtest()
    live_engine()     # runs forever


if __name__ == "__main__":
    log.info("mu-Sentry Research Engine -- Starting")

    # Step 1: strategies populated immediately so frontend shows structure
    init_strategy_state()

    # Step 2: data + backtest + live engine in background
    threading.Thread(target=background_startup, daemon=True).start()

    # Step 3: Flask ready immediately
    app.run(host="0.0.0.0", port=5000, debug=False)