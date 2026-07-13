import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Card from './ui/Card';
import useTradingData from '../hooks/useTradingData';
import { useTelemetry } from '../hooks/useTelemetry';
import { Alert, AlertLevel, Strategy, InfrastructureHealth, InfrastructureState } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, BarChart, Bar } from 'recharts';
import MarketOracle from './MarketOracle';
import { ExplanationOverlay } from './ui/Explanation';
import { ServerIcon, DataFeedIcon, DatabaseIcon } from './ui/icons';
import { Settings, X } from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardProps {
  isExplanationMode: boolean;
}

// ── PnL Chart ─────────────────────────────────────────────────────────────────

const PnlChart: React.FC<{ strategies: Strategy[] }> = ({ strategies }) => {
  const chartData = useMemo(() => {
    if (!strategies.length || !strategies[0].pnlHistory.length) return [];
    const activeHistories = strategies.map(s => s.pnlHistory);
    return activeHistories[0].map((_, i) => {
      const time = activeHistories[0][i].time;
      const point: { time: number; [key: string]: number } = { time };
      strategies.forEach((s, si) => {
        if (activeHistories[si][i]) point[s.id] = activeHistories[si][i].value;
      });
      return point;
    });
  }, [strategies]);

  const colors = ['#4A7C44', '#4A6FA5', '#C4A46B', '#A64D4D', '#6B9AC4',
                  '#9B59B6', '#E67E22', '#1ABC9C', '#E74C3C', '#3498DB'];

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
        <XAxis dataKey="time" tickFormatter={(t) => new Date(t).toLocaleTimeString()}
          stroke="#5A5A5A" fontSize={10} fontStyle="italic" />
        <YAxis stroke="#5A5A5A" fontSize={10}
          tickFormatter={(v) => `₹${v.toLocaleString('en-IN')}`} />
        <Tooltip
          contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px' }}
          labelStyle={{ color: '#1A1A1A', fontWeight: 'bold' }} />
        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
        {strategies.map((s, i) => (
          <Line key={s.id} type="monotone" dataKey={s.id} name={s.name}
            stroke={colors[i % colors.length]} strokeWidth={2} dot={false} connectNulls={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

// ── Alert Item ─────────────────────────────────────────────────────────────────

const AlertItem: React.FC<{ alert: Alert }> = ({ alert }) => {
  const colors = {
    [AlertLevel.Info]:     'bg-brand-blue/10 text-brand-blue border border-brand-blue/20',
    [AlertLevel.Warning]:  'bg-brand-yellow/10 text-brand-yellow border border-brand-yellow/20',
    [AlertLevel.Critical]: 'bg-brand-red/10 text-brand-red border border-brand-red/20',
    [AlertLevel.Anomaly]:  'bg-purple-500/10 text-purple-600 border border-purple-500/20',
  };
  return (
    <div className={`p-3 rounded-xl text-xs font-medium ${colors[alert.level]}`}>
      <span className="font-bold uppercase tracking-wider">{alert.level}: </span>
      {alert.message}
      <span className="text-[10px] opacity-60 ml-2 italic">
        {new Date(alert.timestamp).toLocaleTimeString()}
      </span>
    </div>
  );
};

// ── Infrastructure Panel ──────────────────────────────────────────────────────

const InfrastructurePanel: React.FC<{ health: InfrastructureHealth; telemetry?: any }> = ({ health, telemetry }) => {
  const getColor = (s: InfrastructureState | string) => {
    if (s === InfrastructureState.Down     || s === 'DOWN')     return 'text-brand-red';
    if (s === InfrastructureState.Degraded || s === 'DEGRADED') return 'text-brand-yellow';
    return 'text-brand-green';
  };
  const gw = telemetry?.infrastructure?.fixGateway  || health.exchangeConnectivity;
  const md = telemetry?.infrastructure?.marketData  || health.marketDataFeedA;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
      {[
        { icon: <ServerIcon   className={`h-5 w-5 ${getColor(gw)}`} />, label: 'FIX Gateway',   val: gw },
        { icon: <DataFeedIcon className={`h-5 w-5 ${getColor(md)}`} />, label: 'Data Feed A',   val: md },
        { icon: <DataFeedIcon className={`h-5 w-5 ${getColor(health.marketDataFeedB)}`} />, label: 'Data Feed B', val: health.marketDataFeedB },
        { icon: <DatabaseIcon className={`h-5 w-5 ${health.dbWriteLatency > 10 ? 'text-brand-yellow' : 'text-brand-green'}`} />,
          label: 'DB Write', val: `${health.dbWriteLatency.toFixed(2)}ms` },
      ].map(({ icon, label, val }) => (
        <div key={label} className="flex items-center space-x-3 p-3 bg-cream-tertiary rounded-xl border border-border-cream">
          {icon}
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider font-bold opacity-50">{label}</span>
            <span className={`font-bold ${getColor(String(val))}`}>{String(val)}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Toggle Switch ─────────────────────────────────────────────────────────────

const ToggleSwitch: React.FC<{ enabled: boolean; onChange: () => void }> = ({ enabled, onChange }) => (
  <button
    onClick={onChange}
    className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors
                focus:outline-none focus:ring-2 focus:ring-offset-2
                ${enabled ? 'bg-brand-green' : 'bg-gray-400'}`}
  >
    <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform
                      ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);

// ── Market Regime Panel — NOW WIRED TO REAL BACKEND ───────────────────────────
// 
// Previously showed hardcoded VIX 12.4 and correlation 0.84.
// Now reads from regimeState which comes from the backend's
// Hurst exponent + realized volatility classifier.

const MarketRegimePanel: React.FC<{ isExplanationMode: boolean }> = ({ isExplanationMode }) => {
  const { marketSnapshot, regimeState } = useTradingData();

  const isMarketOpen = marketSnapshot.market_status === 'OPEN';

  // Real data from regime classifier
  const regime      = regimeState?.current      ?? 'UNKNOWN';
  const confidence  = regimeState?.confidence   ?? 0;
  const realizedVol = regimeState?.realized_vol ?? 0;
  const volPct      = regimeState?.vol_percentile ?? 50;
  const hurst       = regimeState?.regime_history?.slice(-1)[0]?.hurst ?? 0.5;

  const regimeColor = regime === 'TRENDING'
    ? 'text-brand-green' : regime === 'MEAN_REVERTING'
    ? 'text-brand-blue'  : 'text-brand-yellow';

  const regimeBg = regime === 'TRENDING'
    ? 'bg-brand-green/10 border-brand-green/20' : regime === 'MEAN_REVERTING'
    ? 'bg-brand-blue/10 border-brand-blue/20'   : 'bg-brand-yellow/10 border-brand-yellow/20';

  // Mini sparkline bars from regime history (last 7 points)
  const histBars = regimeState?.regime_history?.slice(-7).map(r => r.confidence) ?? [40, 35, 45, 30, 55, 60, confidence];

  return (
    <Card className="flex-grow relative">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-serif font-bold text-text-primary">Market Regime Diagnostics</h3>
          <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-full border
                           ${isMarketOpen ? 'bg-brand-green/10 border-brand-green/20'
                                          : 'bg-brand-red/10 border-brand-red/20'}`}>
            <div className={`w-1.5 h-1.5 rounded-full
                             ${isMarketOpen ? 'bg-brand-green animate-pulse' : 'bg-brand-red'}`} />
            <span className={`text-[8px] font-bold uppercase tracking-widest
                              ${isMarketOpen ? 'text-brand-green' : 'text-brand-red'}`}>
              {isMarketOpen ? 'Market Live' : 'Market Closed'}
            </span>
          </div>
        </div>
        <span className="text-[10px] bg-brand-blue/10 text-brand-blue px-2 py-1 rounded-full font-bold uppercase tracking-widest">
          Alpha Focus
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* LEFT — Current Regime (Hurst + confidence) */}
        <div className={`p-4 rounded-xl border space-y-3 ${regimeBg}`}>
          <p className="text-xs font-bold text-text-secondary uppercase tracking-widest">
            Current Regime
          </p>
          <div className="flex items-end justify-between">
            <div>
              <p className={`text-2xl font-mono font-bold ${regimeColor}`}>
                {regime}
              </p>
              <p className="text-[10px] font-bold text-text-secondary mt-1">
                Hurst Exponent: <span className={regimeColor}>{hurst.toFixed(3)}</span>
              </p>
              <p className={`text-[10px] font-bold uppercase mt-0.5 ${regimeColor}`}>
                {confidence.toFixed(0)}% confidence
              </p>
            </div>
            {/* Confidence sparkline */}
            <div className="h-10 w-24 flex items-end space-x-1">
              {histBars.map((h, i) => (
                <div key={i}
                  className={`flex-1 rounded-t-sm ${
                    regime === 'TRENDING' ? 'bg-brand-green/40'
                    : regime === 'MEAN_REVERTING' ? 'bg-brand-blue/40'
                    : 'bg-brand-yellow/40'}`}
                  style={{ height: `${Math.max(h, 5)}%` }} />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — Realized Volatility */}
        <div className="bg-cream-tertiary p-4 rounded-xl border border-border-cream space-y-3">
          <p className="text-xs font-bold text-text-secondary uppercase tracking-widest">
            Realized Volatility
          </p>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-mono font-bold text-text-primary">
                {realizedVol.toFixed(1)}
                <span className="text-sm font-normal text-text-secondary ml-1">% ann.</span>
              </p>
              <p className={`text-[10px] font-bold uppercase mt-1 ${
                volPct > 75 ? 'text-brand-red'
                : volPct > 50 ? 'text-brand-yellow'
                : 'text-brand-green'}`}>
                {volPct.toFixed(0)}th percentile of history
              </p>
            </div>
            {/* Vol percentile bar */}
            <div className="w-24 h-10 flex flex-col justify-end">
              <div className="h-2 bg-cream-primary rounded-full overflow-hidden border border-border-cream">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    volPct > 75 ? 'bg-brand-red'
                    : volPct > 50 ? 'bg-brand-yellow'
                    : 'bg-brand-green'}`}
                  style={{ width: `${volPct}%` }}
                />
              </div>
              <p className="text-[9px] text-text-secondary mt-1 text-right">vol rank</p>
            </div>
          </div>
        </div>
      </div>

      {/* Regime insight note */}
      <div className="mt-4 p-3 bg-white/40 rounded-lg border border-border-cream/30 text-[10px] text-text-secondary italic">
        {regime === 'TRENDING'
          ? `Trending regime detected (H=${hurst.toFixed(2)}). Momentum strategy allocated 80% of capital. Price persistence is statistically significant — trend-following expected to outperform.`
          : regime === 'MEAN_REVERTING'
          ? `Mean-reverting regime detected (H=${hurst.toFixed(2)}). RSI-Bollinger strategy allocated 80% of capital. Prices expected to revert to equilibrium — fade extreme moves.`
          : `Uncertain regime (H=${hurst.toFixed(2)}). Equal-weight hybrid allocation active. No statistically significant directional bias detected.`}
      </div>

      {isExplanationMode && (
        <ExplanationOverlay
          title="Market Regime Diagnostics"
          what="Real-time classification of market regime using the Hurst Exponent (R/S analysis) and realized volatility percentile."
          why="The core research hypothesis: momentum works in trending regimes, mean-reversion works in oscillating regimes. This panel shows which regime is active and drives the strategy allocation decision."
          how="Hurst exponent is computed via R/S analysis on the last 100 price bars. H>0.55 = trending, H<0.45 = mean-reverting. Confidence is the weighted composite of Hurst, vol percentile, and SMA momentum score."
        />
      )}
    </Card>
  );
};

// ── Strategy Research Panel ────────────────────────────────────────────────────

const StrategyResearchPanel: React.FC<{
  strategies:    Strategy[];
  onToggle:      (id: string) => void;
  onBacktest:    (id: string) => void;
  isBacktesting: string | null;
}> = ({ strategies, onToggle, onBacktest, isBacktesting }) => (
  <Card className="flex-grow">
    <h3 className="text-lg font-serif font-bold text-text-primary mb-4">
      Alpha Research Diagnostics
    </h3>
    <div className="space-y-3">
      {strategies.map(strat => (
        <div
          key={strat.id}
          className={`flex flex-col p-4 rounded-xl transition-all duration-300 border gap-4
                      ${strat.status === 'tripped'
                        ? 'bg-brand-red/5 border-brand-red/20'
                        : 'bg-cream-tertiary border-border-cream'}`}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="font-bold text-text-primary text-base">{strat.name}</p>
              <p className="text-xs text-text-secondary italic">
                Sharpe: {(strat.sharpeRatio || 0).toFixed(2)} |
                Sortino: {(strat.sortino || 0).toFixed(2)} |
                Beta: {(strat.beta || 0).toFixed(2)}
              </p>
              {/* NEW — show active strategy + regime */}
              <p className="text-[10px] text-text-secondary mt-0.5">
                Strategy: <span className="font-bold text-brand-blue">{strat.activeStrategy}</span>
                {' '}| Regime: <span className="font-bold text-brand-green">{strat.regime}</span>
              </p>
            </div>
            <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest
                              ${strat.status === 'active'
                                ? 'bg-brand-green/10 text-brand-green'
                                : 'bg-brand-red/10 text-brand-red'}`}>
              {strat.status}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Win Rate',     val: `${(strat.winRate || 0).toFixed(1)}%`,   color: 'text-brand-blue' },
              { label: 'Prof. Factor', val: `${(strat.profitFactor || 0).toFixed(2)}x`, color: 'text-brand-green' },
              { label: 'VaR (95%)',    val: `${(strat.var95 || 0).toFixed(2)}%`,     color: 'text-brand-red' },
              { label: 'Drawdown',     val: `${(strat.maxDrawdown || 0).toFixed(2)}%`, color: 'text-text-primary' },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-white/50 p-2 rounded-lg border border-border-cream/30">
                <p className="text-[9px] uppercase tracking-tighter opacity-50 font-bold">{label}</p>
                <p className={`text-sm font-mono font-bold ${color}`}>{val}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-border-cream/30 pt-3">
            <button
              disabled={isBacktesting === strat.id}
              onClick={() => onBacktest(strat.id)}
              className="text-[10px] bg-brand-blue text-white px-3 py-1 rounded-full font-bold
                         uppercase tracking-widest hover:bg-text-primary transition-colors disabled:opacity-50"
            >
              {isBacktesting === strat.id ? 'Running...' : 'View Backtest'}
            </button>
            <div className="flex items-center space-x-3">
              <span className="text-[10px] text-text-secondary font-bold uppercase">Manual Halt</span>
              <ToggleSwitch enabled={strat.status === 'active'} onChange={() => onToggle(strat.id)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  </Card>
);

// ── Engine Status ─────────────────────────────────────────────────────────────

const EngineStatus: React.FC<{ telemetry: any }> = ({ telemetry }) => {
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibPrice, setCalibPrice]       = useState('');

  const lastTick = telemetry?.timestamp
    ? new Date(telemetry.timestamp).toLocaleTimeString()
    : 'N/A';

  // FIX: is_simulated removed from backend.
  // Now we derive data quality from whether nifty_price > 0.
  const isLive    = (telemetry?.market_snapshot?.nifty_price ?? 0) > 0;
  const regime    = telemetry?.regime?.current ?? 'UNKNOWN';
  const btStatus  = telemetry?.backtest?.status ?? 'PENDING';

  const handleCalibrate = async () => {
    if (!calibPrice) return;
    try {
      // FIX: this was calling /api/v1/calibrate, a route that never
      // existed anywhere in backend/app.py -- the click silently did
      // nothing. Added a real /v1/calibrate route in the backend and
      // pointed this at it.
      await fetch('/v1/calibrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nifty_price: parseFloat(calibPrice) }),
      });
      setIsCalibrating(false);
      setCalibPrice('');
    } catch (err) {
      console.error('Calibration failed', err);
    }
  };

  return (
    <Card className="flex flex-col h-full relative">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-serif font-bold text-text-primary">Alpha Engine Metrics</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsCalibrating(!isCalibrating)}
            className={`p-1.5 rounded-full transition-all
                        ${isCalibrating
                          ? 'bg-brand-blue/20 text-brand-blue shadow-sm'
                          : 'text-text-secondary hover:bg-cream-tertiary'}`}
            title="Manual Calibration"
          >
            <Settings className="w-4 h-4" />
          </button>
          <div className={`flex items-center px-3 py-1 rounded-full text-[10px] font-bold
                          uppercase tracking-widest
                          ${telemetry ? 'bg-brand-green/10 text-brand-green'
                                      : 'bg-brand-red/10 text-brand-red'}`}>
            {telemetry ? '⚡ Engine Live' : '🔌 Offline'}
          </div>
        </div>
      </div>

      {isCalibrating ? (
        <div className="space-y-4 bg-brand-blue/5 p-4 rounded-xl border border-brand-blue/20">
          <p className="text-[10px] font-bold text-brand-blue uppercase tracking-widest">
            Manual Price Sync
          </p>
          <div className="flex space-x-2">
            <input
              type="number"
              value={calibPrice}
              onChange={(e) => setCalibPrice(e.target.value)}
              placeholder="Enter Real Nifty Index"
              className="flex-grow bg-white border border-border-cream rounded-lg px-3 py-2
                         text-sm font-mono focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
            <button
              onClick={handleCalibrate}
              className="bg-brand-blue text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-brand-blue/90"
            >
              Sync
            </button>
          </div>
          <p className="text-[9px] text-text-secondary italic">Last heartbeat: {lastTick}</p>
        </div>
      ) : (
        <div className="space-y-4 flex-grow">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-text-secondary uppercase tracking-widest font-bold mb-1">
                Last Heartbeat
              </p>
              <p className="text-xl font-mono font-bold text-text-primary">{lastTick}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-secondary uppercase tracking-widest font-bold mb-1">
                {/* FIX: this was labeled "Engine Latency", which reads as
                    a claim about network/exchange latency. What it
                    actually measures is telemetry.latency.current, i.e.
                    the time the backend's live_engine loop took to fetch
                    and process all symbols in its last pass -- a data
                    refresh cycle time, not latency in the trading sense.
                    Relabeled to avoid overclaiming low-latency infra. */}
                Cycle Time
              </p>
              <p className="text-xl font-mono font-bold text-brand-blue">
                {telemetry?.latency?.current || '0.00'}
                <span className="text-xs font-normal ml-1">ms</span>
              </p>
            </div>
          </div>

          {/* NEW — Regime + Backtest status */}
          <div className="bg-cream-primary p-3 rounded-xl border border-border-cream/50 space-y-2">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-bold">
              <span className="text-text-secondary">Data Mode</span>
              <span className={isLive ? 'text-brand-green' : 'text-brand-yellow'}>
                {isLive ? 'Live NSE' : 'Awaiting Data'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-bold">
              <span className="text-text-secondary">Active Regime</span>
              <span className={
                regime === 'TRENDING'      ? 'text-brand-green'
                : regime === 'MEAN_REVERTING' ? 'text-brand-blue'
                : 'text-brand-yellow'
              }>{regime}</span>
            </div>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-bold">
              <span className="text-text-secondary">Backtest</span>
              <span className={btStatus === 'COMPLETE' ? 'text-brand-green' : 'text-brand-yellow'}>
                {btStatus}
              </span>
            </div>
            <p className="text-[9px] text-text-secondary italic leading-relaxed">
              {telemetry?.market_snapshot?.market_status === 'OPEN'
                ? `Engine trading — NIFTY at ₹${(telemetry?.market_snapshot?.nifty_price || 0).toLocaleString('en-IN')}`
                : `Engine monitoring — NIFTY at ₹${(telemetry?.market_snapshot?.nifty_price || 0).toLocaleString('en-IN')}`}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
};

// ── Flight Recorder ───────────────────────────────────────────────────────────

const FlightRecorder: React.FC<{ fetchReport: () => Promise<any> }> = ({ fetchReport }) => {
  const [log, setLog]             = useState<any[]>([]);
  const [isExpanded, setExpanded] = useState(false);

  const refreshLog = useCallback(async () => {
    const data = await fetchReport();
    setLog(data.log || []);
  }, [fetchReport]);

  useEffect(() => {
    refreshLog();
    const iv = setInterval(refreshLog, 5000);
    return () => clearInterval(iv);
  }, [refreshLog]);

  const downloadReport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(log, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `musentry_audit_${new Date().toISOString()}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Card className="md:col-span-2 lg:col-span-4 xl:col-span-5 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-brand-red rounded-full animate-pulse" />
          <h3 className="text-lg font-serif font-bold text-text-primary">
            Black Box: Flight Recorder
          </h3>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={refreshLog}
            className="px-4 py-1.5 bg-cream-tertiary border border-border-cream rounded-full
                       text-xs font-bold hover:bg-cream-primary transition-all"
          >
            Refresh Audit
          </button>
          <button
            onClick={downloadReport}
            className="px-4 py-1.5 bg-text-primary text-white rounded-full text-xs font-bold
                       hover:bg-brand-green transition-all"
          >
            Download Report
          </button>
        </div>
      </div>

      <div className={`mt-2 bg-black border border-gray-800 rounded-xl overflow-y-auto custom-scrollbar
                       transition-all duration-500 ${isExpanded ? 'h-[400px]' : 'h-[150px]'}`}>
        <div className="p-4 font-mono text-[10px] text-brand-green space-y-1">
          {log.length === 0 ? (
            <p className="opacity-50 italic uppercase tracking-widest">
              No trades recorded yet — waiting for signal generation...
            </p>
          ) : (
            log.map((entry, i) => (
              <div key={i} className="border-b border-gray-900 pb-2 mb-2 last:border-0">
                <span className="text-gray-500">
                  [{new Date(entry.timestamp).toLocaleTimeString()}]
                </span>{' '}
                <span className={entry.side === 'SELL' && entry.pnl < 0 ? 'text-brand-red' : 'text-brand-yellow'}>
                  {entry.side}
                </span>:{' '}
                <span className="text-gray-300">{entry.symbol}</span>
                {' '}@ ₹{entry.price?.toLocaleString('en-IN')}
                {' '}| Qty: {entry.qty}
                {entry.pnl !== undefined && (
                  <span className={entry.pnl >= 0 ? 'text-brand-green' : 'text-brand-red'}>
                    {' '}| PnL: ₹{entry.pnl?.toLocaleString('en-IN')}
                  </span>
                )}
                <span className="text-gray-600 ml-2 italic">
                  [{entry.regime} | {entry.strategy}]
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <button
        onClick={() => setExpanded(!isExpanded)}
        className="w-full mt-2 py-1 text-[10px] uppercase font-bold text-text-secondary
                   hover:text-text-primary transition-colors"
      >
        {isExpanded ? 'Collapse Log' : 'Expand Full Audit Trail'}
      </button>
    </Card>
  );
};

// ── Backtest Modal — NOW SHOWS REAL RESEARCH DATA ─────────────────────────────

const BacktestModal: React.FC<{ data: any; symbol: string | null; onClose: () => void }> = ({ data, symbol, onClose }) => {
  const isFull = data.status === 'COMPLETE' && data.insample;
  // FIX: the backend already returns per-symbol results in
  // data.per_symbol[symbol] -- this pulls out the specific stock that
  // was actually clicked, instead of only ever showing the portfolio
  // aggregate for every symbol.
  const symbolData = symbol ? data.per_symbol?.[symbol] : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto
                   shadow-2xl border border-border-cream"
      >
        <div className="p-6 border-b border-border-cream flex justify-between items-center bg-cream-primary sticky top-0">
          <div>
            <h3 className="text-xl font-serif font-bold text-text-primary">
              Research Backtest Report
            </h3>
            <p className="text-xs text-text-secondary uppercase tracking-widest font-bold">
              {symbolData ? `${symbolData.name || symbol} — Individual Result` : (data.period || 'Regime-Switching Portfolio')} | In-sample / Out-of-sample
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-cream-tertiary rounded-full transition-colors">
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Per-symbol result — the actual stock that was clicked */}
          {symbolData && (
            <div>
              <p className="text-[10px] font-bold text-brand-green uppercase tracking-widest mb-3">
                {symbolData.name || symbol} — This Symbol's Backtest
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'IS Sharpe',      val: symbolData.is_sharpe,     color: 'text-brand-green' },
                  { label: 'OOS Sharpe',     val: symbolData.oos_sharpe,    color: 'text-brand-blue' },
                  { label: 'Win Rate',       val: symbolData.win_rate,      color: 'text-brand-yellow', suffix: '%' },
                  { label: 'Profit Factor',  val: symbolData.profit_factor, color: 'text-text-primary' },
                  { label: 'IS Return',      val: symbolData.is_return,     color: 'text-brand-green', suffix: '%' },
                  { label: 'OOS Return',     val: symbolData.oos_return,    color: 'text-brand-blue', suffix: '%' },
                  { label: 'Max Drawdown',   val: symbolData.max_drawdown,  color: 'text-brand-red', suffix: '%' },
                  { label: 'Num Trades',     val: symbolData.num_trades,    color: 'text-text-primary' },
                ].map(({ label, val, color, suffix }) => (
                  <div key={label} className="p-3 bg-cream-tertiary rounded-xl border border-border-cream">
                    <p className="text-[10px] text-text-secondary uppercase tracking-widest font-bold">{label}</p>
                    <p className={`text-lg font-mono font-bold ${color}`}>
                      {typeof val === 'number' ? val.toFixed(2) : (val ?? 0)}{suffix || ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {symbol && !symbolData && (
            <div className="p-3 bg-brand-yellow/10 border border-brand-yellow/30 rounded-xl text-xs text-text-secondary">
              No individual backtest result found yet for {symbol} — showing portfolio-wide context below instead.
            </div>
          )}

          {/* Strategy comparison cards */}
          {isFull ? (
            <>
              <div>
                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">
                  Portfolio-Wide Context (all 10 stocks combined)
                </p>
                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-3 opacity-60">
                  In-Sample Performance (8 months)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Switching',   val: data.insample?.switching?.sharpe,   color: 'text-brand-green' },
                    { label: 'Momentum',    val: data.insample?.momentum?.sharpe,    color: 'text-brand-blue' },
                    { label: 'Mean Rev.',   val: data.insample?.meanrev?.sharpe,     color: 'text-brand-yellow' },
                    { label: 'Benchmark',   val: data.insample?.benchmark?.sharpe,   color: 'text-text-secondary' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="p-3 bg-cream-tertiary rounded-xl border border-border-cream">
                      <p className="text-[10px] text-text-secondary uppercase tracking-widest font-bold">{label}</p>
                      <p className={`text-lg font-mono font-bold ${color}`}>
                        {(val ?? 0).toFixed(2)}
                      </p>
                      <p className="text-[9px] text-text-secondary">Sharpe</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-3">
                  Out-of-Sample Validation (4 months — key test)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Switching',   val: data.outsample?.switching?.sharpe,  color: 'text-brand-green' },
                    { label: 'Momentum',    val: data.outsample?.momentum?.sharpe,   color: 'text-brand-blue' },
                    { label: 'Mean Rev.',   val: data.outsample?.meanrev?.sharpe,    color: 'text-brand-yellow' },
                    { label: 'Benchmark',   val: data.outsample?.benchmark?.sharpe,  color: 'text-text-secondary' },
                  ].map(({ label, val, color }) => (
                    <div key={label} className="p-3 bg-cream-tertiary rounded-xl border border-border-cream">
                      <p className="text-[10px] text-text-secondary uppercase tracking-widest font-bold">{label}</p>
                      <p className={`text-lg font-mono font-bold ${color}`}>
                        {(val ?? 0).toFixed(2)}
                      </p>
                      <p className="text-[9px] text-text-secondary">Sharpe</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Regime stats */}
              {data.regime_stats && (
                <div className="p-4 bg-cream-primary rounded-xl border border-border-cream">
                  <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-3">
                    Regime-Conditional Analysis — The Core Research Finding
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="font-bold text-brand-green mb-1">Momentum in TRENDING regime</p>
                      <p className="font-mono">Sharpe: {(data.regime_stats.momentum_in_trending ?? 0).toFixed(3)}</p>
                    </div>
                    <div>
                      <p className="font-bold text-brand-red mb-1">Momentum in MEAN_REVERTING regime</p>
                      <p className="font-mono">Sharpe: {(data.regime_stats.momentum_in_meanrev ?? 0).toFixed(3)}</p>
                    </div>
                    <div>
                      <p className="font-bold text-brand-blue mb-1">Mean-Rev. in MEAN_REVERTING regime</p>
                      <p className="font-mono">Sharpe: {(data.regime_stats.meanrev_in_meanrev ?? 0).toFixed(3)}</p>
                    </div>
                    <div>
                      <p className="font-bold text-brand-yellow mb-1">Mean-Rev. in TRENDING regime</p>
                      <p className="font-mono">Sharpe: {(data.regime_stats.meanrev_in_trending ?? 0).toFixed(3)}</p>
                    </div>
                  </div>
                  <p className="text-[9px] text-text-secondary italic mt-3">
                    Market was {data.regime_stats.trending_pct ?? 0}% trending,
                    {' '}{data.regime_stats.meanrev_pct ?? 0}% mean-reverting.
                  </p>
                </div>
              )}

              {/* Research conclusion */}
              {data.research_conclusion && (
                <div className="p-4 bg-brand-green/5 rounded-xl border border-brand-green/20">
                  <p className="text-[10px] font-bold text-brand-green uppercase tracking-widest mb-2">
                    Research Conclusion
                  </p>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {data.research_conclusion}
                  </p>
                </div>
              )}

              {/* Equity curve chart */}
              {data.equity_curves?.insample_switching?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-3">
                    In-Sample Equity Curves
                  </p>
                  <div className="h-[220px] bg-cream-tertiary/30 rounded-2xl p-4 border border-border-cream/50">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.equity_curves.insample_switching.map((v: number, i: number) => ({
                        i,
                        switching:  v,
                        momentum:   data.equity_curves.insample_momentum?.[i],
                        meanrev:    data.equity_curves.insample_meanrev?.[i],
                        benchmark:  data.equity_curves.insample_benchmark?.[i],
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                        <XAxis dataKey="i" hide />
                        <YAxis hide domain={['auto', 'auto']} />
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '10px', backgroundColor: '#fff' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line type="monotone" dataKey="switching" name="Switching" stroke="#4A7C44" strokeWidth={2.5} dot={false} />
                        <Line type="monotone" dataKey="momentum"  name="Momentum"  stroke="#4A6FA5" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                        <Line type="monotone" dataKey="meanrev"   name="Mean Rev."  stroke="#C4A46B" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                        <Line type="monotone" dataKey="benchmark" name="Benchmark" stroke="#999"    strokeWidth={1}   dot={false} strokeDasharray="2 4" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          ) : (
            // Fallback for simple backtest data
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Gain', val: `₹${(data.total_pnl || 0).toLocaleString('en-IN')}`, color: data.total_pnl >= 0 ? 'text-brand-green' : 'text-brand-red' },
                { label: 'Win Rate',   val: `${data.win_rate || 0}%`,   color: 'text-brand-blue' },
                { label: 'Sharpe',     val: String(data.sharpe || 0),   color: 'text-text-primary' },
                { label: 'Max DD',     val: `${data.drawdown || 0}%`,   color: 'text-brand-red' },
              ].map(({ label, val, color }) => (
                <div key={label} className="p-3 bg-cream-tertiary rounded-xl border border-border-cream">
                  <p className="text-[10px] text-text-secondary uppercase tracking-widest font-bold">{label}</p>
                  <p className={`text-lg font-mono font-bold ${color}`}>{val}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-cream-primary border-t border-border-cream flex justify-end sticky bottom-0">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-text-primary text-white rounded-full text-xs font-bold
                       hover:bg-brand-green transition-all"
          >
            Close Analysis
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Dashboard (main) ──────────────────────────────────────────────────────────

const Dashboard: React.FC<DashboardProps> = ({ isExplanationMode }) => {
  const {
    strategies, alerts, latencyData, infrastructure,
    toggleStrategyStatus, fetchDailyReport, fetchOracle,
    isRealConnected,
  } = useTradingData();
  const { data: telemetry } = useTelemetry();

  const [backtestData, setBacktestData] = useState<any>(null);
  const [backtestSymbol, setBacktestSymbol] = useState<string | null>(null);
  const [isBacktesting, setIsBacktesting] = useState<string | null>(null);

  // FIX: this previously took an `id` parameter and never used it
  // (named `_id`, the underscore-prefix convention for "intentionally
  // unused") -- every "View Backtest" click, regardless of which
  // symbol's card it came from, fetched and displayed the exact same
  // portfolio-wide aggregate report. That's why every company showed
  // identical numbers.
  //
  // The backend's run_full_backtest() already computes real per-symbol
  // results (per_symbol_results[symbol] in backend/app.py) and returns
  // them in the same /v1/backtest response as data.per_symbol -- they
  // just were never displayed. This now tracks which symbol was
  // clicked and the modal shows that symbol's real numbers first.
  const handleRunBacktest = async (id: string) => {
    setIsBacktesting(id);
    setBacktestSymbol(id);
    try {
      const response = await fetch('/v1/backtest', { method: 'GET' });
      if (response.ok) {
        const data = await response.json();
        setBacktestData(data);
      }
    } catch (err) {
      console.error('Backtest fetch failed', err);
    } finally {
      setIsBacktesting(null);
    }
  };

  const totalPnl     = useMemo(() => strategies.reduce((s, st) => s + st.pnl, 0), [strategies]);
  const totalFees    = useMemo(() => strategies.reduce((s, st) => s + st.fees, 0), [strategies]);
  const avgSlippage  = useMemo(() =>
    strategies.length > 0
      ? strategies.reduce((s, st) => s + st.slippage, 0) / strategies.length
      : 0,
    [strategies]);
  const anomalyAlerts = useMemo(() =>
    alerts.filter(a => a.level === AlertLevel.Anomaly).length,
    [alerts]);

  // FIX: derive data quality from nifty_price, not is_simulated
  const isLive = (telemetry?.market_snapshot?.nifty_price ?? 0) > 0;

  return (
    <div className="relative">

      {/* Header Status Bar */}
      <div className="px-4 py-2 flex items-center justify-between border-b border-border-cream
                      bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isRealConnected ? 'bg-brand-green animate-pulse' : 'bg-brand-red'}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
              {isRealConnected ? 'Engine Link: Connected' : 'Engine Link: Disconnected'}
            </span>
          </div>

          {/* FIX: is_simulated removed, use isLive derived from nifty_price */}
          <div className="flex items-center space-x-2 border-l border-border-cream pl-4">
            <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-brand-green' : 'bg-brand-yellow'}`} />
            <span className={`text-[10px] font-bold uppercase tracking-widest ${isLive ? 'text-brand-green' : 'text-amber-600'}`}>
              {isLive ? 'Mode: Market Live' : 'Mode: Awaiting Data'}
            </span>
          </div>

          {telemetry?.timestamp && (
            <div className="hidden sm:flex items-center space-x-2 border-l border-border-cream pl-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary opacity-60">
                Last Data Tick:
              </span>
              <span className="text-[10px] font-mono font-bold text-brand-blue">
                {new Date(telemetry.timestamp).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
            System Status:
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest
                            ${infrastructure?.exchangeConnectivity === InfrastructureState.Nominal
                              ? 'bg-brand-green/10 text-brand-green'
                              : 'bg-brand-red/10 text-brand-red'}`}>
            {infrastructure?.exchangeConnectivity === InfrastructureState.Nominal ? 'Nominal' : 'Warning'}
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">

        {/* Metric Cards */}
        {[
          {
            title: 'Total Net PnL',
            value: totalPnl.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }),
            color: totalPnl >= 0 ? 'text-brand-green' : 'text-brand-red',
            what: 'The real-time, fee-adjusted profit or loss across all strategies.',
            why: 'Gross PnL is vanity, Net PnL is sanity.',
            how: 'Aggregates net PnL from every strategy after costs.',
          },
          {
            title: 'Trading Costs (24h)',
            value: totalFees.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }),
            color: 'text-brand-yellow',
            what: 'Total exchange fees and commissions paid.',
            why: 'Costs are a direct leak from profitability.',
            how: 'Sums fees from all executed trades.',
          },
          {
            title: 'Avg. Slippage',
            value: `${avgSlippage.toFixed(2)} bps`,
            color: 'text-text-primary',
            what: 'Average difference between expected and actual execution price.',
            why: 'Slippage is the hidden tax of speed.',
            how: 'Volume-weighted average across recent trades.',
          },
          {
            title: 'Anomalies (1h)',
            value: String(anomalyAlerts),
            color: anomalyAlerts > 0 ? 'text-brand-red' : 'text-text-primary',
            what: 'Count of statistically significant deviations.',
            why: 'Proactive risk metric — investigate before failure.',
            how: 'Z-score on key time-series flags outliers.',
          },
        ].map(({ title, value, color, what, why, how }) => (
          <div key={title} className="relative xl:col-span-1">
            <Card>
              <h3 className="text-text-secondary text-xs font-medium">{title}</h3>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </Card>
            {isExplanationMode && (
              <ExplanationOverlay title={title} what={what} why={why} how={how} />
            )}
          </div>
        ))}

        {/* Engine Status */}
        <div className="relative xl:col-span-1">
          <EngineStatus telemetry={telemetry} />
          {isExplanationMode && (
            <ExplanationOverlay
              title="Alpha Engine Metrics"
              what="Verification center for the live data pipeline."
              why="Transparency is key — confirms data is live, regime is classified, and backtest is ready."
              how="Reads regime, backtest status, and latency directly from Python backend state."
            />
          )}
        </div>

        {/* PnL Tracker */}
        <div className="md:col-span-2 lg:col-span-4 xl:col-span-5 relative">
          <Card>
            <h3 className="text-lg font-serif font-bold text-text-primary mb-4">Live PnL Tracker</h3>
            <PnlChart strategies={strategies} />
          </Card>
          {isExplanationMode && (
            <ExplanationOverlay
              title="Live PnL Tracker"
              what="Time-series chart showing PnL evolution of each strategy."
              why="Helps visualize performance and identify anomalies."
              how="Plots pnl_history for each strategy on a shared timeline."
            />
          )}
        </div>

        {/* Alerts + Oracle */}
        <div className="md:col-span-2 lg:col-span-2 xl:col-span-2 flex flex-col space-y-4 relative">
          <MarketOracle telemetry={telemetry} fetchOracle={fetchOracle} />
          <Card className="flex-grow">
            <h3 className="text-lg font-serif font-bold text-text-primary mb-4">Event Feed</h3>
            <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
              {alerts.slice(0, 15).map(alert => (
                <AlertItem key={alert.id} alert={alert} />
              ))}
              {alerts.length === 0 && (
                <p className="text-text-secondary text-xs italic text-center py-4">
                  No events yet — waiting for signals...
                </p>
              )}
            </div>
          </Card>
          {isExplanationMode && (
            <ExplanationOverlay
              title="Event Feed"
              what="Real-time stream of alerts, regime switches, and trade signals."
              why="Central nervous system — immediate notification of regime changes and executions."
              how="Displays most recent entries from the global alert log."
            />
          )}
        </div>

        {/* Regime + Strategy Research */}
        <div className="md:col-span-2 lg:col-span-2 xl:col-span-3 flex flex-col space-y-4">
          <div className="relative">
            <MarketRegimePanel isExplanationMode={isExplanationMode} />
          </div>
          <div className="relative">
            <StrategyResearchPanel
              strategies={strategies}
              onToggle={toggleStrategyStatus}
              onBacktest={handleRunBacktest}
              isBacktesting={isBacktesting}
            />
            {isExplanationMode && (
              <ExplanationOverlay
                title="Alpha Research Diagnostics"
                what="Real-time metrics per strategy including active regime and strategy type."
                why="Shows whether each strategy is running momentum or mean-reversion logic, and why."
                how="Reads active_strategy and regime fields from live backend state."
              />
            )}
          </div>
        </div>

        {/* Flight Recorder */}
        <div className="md:col-span-2 lg:col-span-4 xl:col-span-5 relative">
          <FlightRecorder fetchReport={fetchDailyReport} />
          {isExplanationMode && (
            <ExplanationOverlay
              title="Black Box: Flight Recorder"
              what="Persistent trade log showing every BUY/SELL with regime context and PnL."
              why="Provides full audit trail — shows which regime triggered each trade."
              how="Reads from backend trade_log which records symbol, side, price, regime, strategy, and PnL per trade."
            />
          )}
        </div>

      </div>

      {backtestData && (
        <BacktestModal data={backtestData} symbol={backtestSymbol} onClose={() => { setBacktestData(null); setBacktestSymbol(null); }} />
      )}
    </div>
  );
};

export default Dashboard;