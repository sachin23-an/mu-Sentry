export enum AlertLevel {
  Info     = 'info',
  Warning  = 'warning',
  Critical = 'critical',
  Anomaly  = 'anomaly',
}

export interface Alert {
  id:          string;
  timestamp:   number;
  level:       AlertLevel;
  message:     string;
  strategyId?: string;
}

export interface PnlPoint {
  time:  number;
  value: number;
}

export interface DrawdownPoint {
  time:     number;
  drawdown: number;
}

export interface RegimePoint {
  time:       number;
  regime:     string;
  confidence: number;
  hurst:      number;
}

// ── Strategy ────────────────────────────────────────────────
export interface Strategy {
  id:                 string;
  name:               string;
  pnl:                number;
  pnlHistory:         PnlPoint[];
  backtestPnlHistory: PnlPoint[];
  drawdownHistory:    DrawdownPoint[];
  latency:            number;
  riskFactor:         number;
  slippage:           number;
  fees:               number;
  orderRate:          number;
  sharpeRatio:        number;
  sortino:            number;       // NEW — Sortino ratio
  winRate:            number;
  profitFactor:       number;
  var95:              number;
  beta:               number;
  maxDrawdown:        number;
  calmarRatio:        number;
  benchmarkAlpha:     number;       // NEW
  regime:             string;       // NEW — current regime for this symbol
  activeStrategy:     string;       // NEW — MOMENTUM | MEAN_REVERSION | HYBRID
  status:             'active' | 'tripped';
}

// ── Regime ──────────────────────────────────────────────────
export interface RegimeState {
  current:        string;           // TRENDING | MEAN_REVERTING | UNCERTAIN
  confidence:     number;           // 0–100
  realized_vol:   number;           // annualized %
  vol_percentile: number;           // 0–100
  momentum_score: number;
  switches_today: number;
  regime_history: RegimePoint[];
}

// ── Portfolio ────────────────────────────────────────────────
export interface PortfolioState {
  total_equity:       number;
  total_return_pct:   number;
  equity_history:     { time: number; value: number; benchmark: number }[];
  momentum_weight:    number;       // 0–1
  meanrev_weight:     number;       // 0–1
  active_strategy:    string;       // MOMENTUM | MEAN_REVERSION | HYBRID
}

// ── Backtest ─────────────────────────────────────────────────
export interface BacktestMetrics {
  sharpe:          number;
  sortino:         number;
  calmar:          number;
  ann_return:      number;
  ann_vol:         number;
  max_drawdown:    number;
  max_dd_duration: number;
  win_rate:        number;
  profit_factor:   number;
  num_trades:      number;
  total_return:    number;
}

export interface BacktestState {
  status:     string;               // PENDING | RUNNING | COMPLETE | NO_DATA
  insample:   { momentum: BacktestMetrics; meanrev: BacktestMetrics; switching: BacktestMetrics; benchmark: BacktestMetrics };
  outsample:  { momentum: BacktestMetrics; meanrev: BacktestMetrics; switching: BacktestMetrics; benchmark: BacktestMetrics };
  regime_stats: {
    trending_pct:           number;
    meanrev_pct:            number;
    momentum_in_trending:   number;
    momentum_in_meanrev:    number;
    meanrev_in_trending:    number;
    meanrev_in_meanrev:     number;
  };
  research_conclusion: string;
  data_period:         string;
  equity_curves:       {
    insample_times:       string[];
    insample_momentum:    number[];
    insample_meanrev:     number[];
    insample_switching:   number[];
    insample_benchmark:   number[];
    outsample_times:      string[];
    outsample_momentum:   number[];
    outsample_meanrev:    number[];
    outsample_switching:  number[];
    outsample_benchmark:  number[];
  };
}

// ── Infrastructure ───────────────────────────────────────────
export enum InfrastructureState {
  Nominal  = 'NOMINAL',
  Degraded = 'DEGRADED',
  Down     = 'DOWN',
}

export interface InfrastructureHealth {
  exchangeConnectivity: InfrastructureState;
  marketDataFeedA:      InfrastructureState;
  marketDataFeedB:      InfrastructureState;
  dbWriteLatency:       number;
}

export interface LatencyDataPoint {
  time:    number;
  latency: number;
}