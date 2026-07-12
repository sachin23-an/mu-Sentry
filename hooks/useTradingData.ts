import { useState, useCallback, useMemo } from 'react';
import {
  Strategy,
  Alert,
  LatencyDataPoint,
  InfrastructureHealth,
  InfrastructureState,
  RegimeState,
  PortfolioState,
  BacktestState,
} from '../types';
import { useTelemetryContext } from '../context/TelemetryContext';

const useTradingData = () => {
  const [alerts]         = useState<Alert[]>([]);
  const [latencyData]    = useState<LatencyDataPoint[]>([]);
  const [infrastructure] = useState<InfrastructureHealth | null>(null);

  const { data: realTelemetry, isConnected: isRealConnected } =
    useTelemetryContext();

  // ── REST helpers ─────────────────────────────────────────────────────────

  const fetchDailyReport = async () => {
    try {
      const r = await fetch('/v1/audit/log');
      return await r.json();
    } catch {
      return { log: [] };
    }
  };

  const fetchOracle = async () => {
    try {
      const r = await fetch('/v1/oracle');
      return await r.json();
    } catch {
      return { oracle_text: 'Consulting the Oracle…', sentiment: 'NEUTRAL' };
    }
  };

  const toggleStrategyStatus = useCallback(async (strategyId: string) => {
    console.log('Toggling strategy', strategyId);
  }, []);

  // ── Strategies ───────────────────────────────────────────────────────────
  //
  // Maps backend strategies dict → typed Strategy[]
  // All fields that were previously 0/missing now come through correctly
  // because the new backend initialises them immediately in init_strategy_state()
  // before the backtest starts.

  const finalStrategies = useMemo((): Strategy[] => {
    if (!realTelemetry?.strategies) return [];

    return Object.keys(realTelemetry.strategies).map((symbol) => {
      const d = realTelemetry.strategies[symbol];
      const latencyCurrent = parseFloat(realTelemetry.latency?.current || '0');

      return {
        id:      symbol,
        name:    d.name || symbol.replace('.NS', ''),

        // PnL
        pnl:                d.pnl               ?? 0,
        pnlHistory:         d.pnl_history        ?? [],
        // Map per-symbol backtest equity curve from backend
        backtestPnlHistory: (() => {
          const perSym = realTelemetry?.backtest?.per_symbol?.[symbol];
          if (!perSym?.backtest_pnl_history) return [];
          return perSym.backtest_pnl_history as { time: number; value: number }[];
        })(),
        drawdownHistory:    d.drawdown_history   ?? [],

        // Execution metadata (static defaults — not yet in backend)
        latency:   latencyCurrent,
        riskFactor: 0.85,
        slippage:   1.2,
        fees:       45.0,
        orderRate:  15,

        // Risk metrics — all now computed in backend
        sharpeRatio:    d.sharpe        ?? 0,
        sortino:        d.sortino       ?? 0,    // NEW
        winRate:        d.win_rate      ?? 0,
        profitFactor:   d.profit_factor ?? 0,
        var95:          d.var_95        ?? 0,
        beta:           d.beta          ?? 0,
        maxDrawdown:    d.max_drawdown  ?? 0,
        calmarRatio:    d.max_drawdown && d.sharpe
          ? d.sharpe / Math.max(Math.abs(d.max_drawdown) / 100, 0.001)
          : 0,
        benchmarkAlpha: d.benchmark_alpha ?? 0,  // NEW

        // Regime info — NEW
        regime:         d.regime          ?? 'UNKNOWN',
        activeStrategy: d.active_strategy ?? 'NONE',

        status: (d.status ?? 'ACTIVE').toLowerCase() === 'active'
          ? 'active'
          : 'tripped',
      } as Strategy;
    });
  }, [realTelemetry]);

  // ── Infrastructure ───────────────────────────────────────────────────────

  const finalInfrastructure = useMemo((): InfrastructureHealth | null => {
    if (!realTelemetry) return infrastructure;
    return {
      exchangeConnectivity:
        realTelemetry.infrastructure.fixGateway === 'HEALTHY'
          ? InfrastructureState.Nominal
          : InfrastructureState.Degraded,
      marketDataFeedA:
        realTelemetry.infrastructure.marketData === 'HEALTHY'
          ? InfrastructureState.Nominal
          : InfrastructureState.Degraded,
      marketDataFeedB:
        realTelemetry.infrastructure.marketData === 'HEALTHY'
          ? InfrastructureState.Nominal
          : InfrastructureState.Degraded,
      dbWriteLatency: parseFloat(realTelemetry.latency.current) / 5,
    };
  }, [realTelemetry, infrastructure]);

  // ── Market snapshot ──────────────────────────────────────────────────────

  const marketSnapshot = useMemo(() => {
    if (realTelemetry?.market_snapshot) {
      return {
        ...realTelemetry.market_snapshot,
        nifty_change:  realTelemetry.market_snapshot.nifty_change  ?? 0,
        sensex_change: realTelemetry.market_snapshot.sensex_change ?? 0,
      };
    }
    return {
      nifty_price:   24530.0,
      sensex_price:  80230.0,
      nifty_change:  0,
      sensex_change: 0,
      market_status: 'CLOSED',
      is_live:       false,
      last_sync:     0,
    };
  }, [realTelemetry]);

  // ── Regime state — NEW ───────────────────────────────────────────────────

  const regimeState = useMemo((): RegimeState | null => {
    if (!realTelemetry?.regime) return null;
    return realTelemetry.regime as RegimeState;
  }, [realTelemetry]);

  // ── Portfolio state — NEW ────────────────────────────────────────────────

  const portfolioState = useMemo((): PortfolioState | null => {
    if (!realTelemetry?.portfolio) return null;
    return realTelemetry.portfolio as PortfolioState;
  }, [realTelemetry]);

  // ── Backtest state — NEW ─────────────────────────────────────────────────

  const backtestState = useMemo((): BacktestState | null => {
    if (!realTelemetry?.backtest) return null;
    return realTelemetry.backtest as BacktestState;
  }, [realTelemetry]);

  // ── Merged alerts ────────────────────────────────────────────────────────

  const mergedAlerts = useMemo(() => {
    const live = realTelemetry?.alerts ?? [];
    return [...live, ...alerts].slice(0, 100) as Alert[];
  }, [realTelemetry, alerts]);

  // ── Latency history ──────────────────────────────────────────────────────

  const mergedLatency = useMemo((): LatencyDataPoint[] => {
    return realTelemetry?.latency?.history ?? latencyData;
  }, [realTelemetry, latencyData]);

  // ── Correlation matrix ───────────────────────────────────────────────────

  const correlationMatrix = useMemo(() => {
    return realTelemetry?.correlation_matrix ?? [];
  }, [realTelemetry]);

  return {
    strategies:        finalStrategies,
    alerts:            mergedAlerts,
    latencyData:       mergedLatency,
    correlationMatrix,
    infrastructure:    finalInfrastructure,
    marketSnapshot,
    regimeState,        // NEW
    portfolioState,     // NEW
    backtestState,      // NEW
    toggleStrategyStatus,
    fetchDailyReport,
    fetchOracle,
    isRealConnected,
    telemetry: realTelemetry,
  };
};

export default useTradingData;