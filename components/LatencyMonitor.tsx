import React, { useMemo } from 'react';
import useTradingData from '../hooks/useTradingData';
import Card from './ui/Card';
import { AreaChart, Area, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from 'recharts';
import { ExplanationOverlay } from './ui/Explanation';

// FIX: this entire page was labeled/explained as if it measured order
// round-trip time / trading latency ("competitive edge in the market
// instantly"). What it actually plots is telemetry.latency, which the
// backend populates with cycle_ms -- the time backend/app.py's
// live_engine loop took to fetch and process all watched symbols in
// its last pass. That's a backend data-refresh duration (currently
// 10-90+ seconds depending on yfinance response times), not network
// or exchange latency in any trading sense. Relabeled throughout so
// this doesn't overclaim low-latency infrastructure the project
// doesn't have. The underlying charts/math (mean/std thresholds,
// distribution histogram, per-strategy breakdown) are legitimate and
// unchanged -- only the framing and copy changed.

interface LatencyMonitorProps {
    isExplanationMode: boolean;
}

const LatencyDistributionChart: React.FC<{ latencyData: number[] }> = ({ latencyData }) => {
    const binnedData = useMemo(() => {
        if (latencyData.length === 0) return [];
        const maxLatency = Math.max(...latencyData, 50);
        const binCount = 20;
        const binSize = maxLatency / binCount;
        const bins = Array(binCount).fill(0).map((_, i) => ({
            range: `${(i * binSize).toFixed(0)}-${((i + 1) * binSize).toFixed(0)}ms`,
            count: 0
        }));

        latencyData.forEach(latency => {
            const binIndex = Math.min(Math.floor(latency / binSize), binCount - 1);
            if (bins[binIndex]) {
                bins[binIndex].count++;
            }
        });

        return bins;
    }, [latencyData]);

    return (
        <ResponsiveContainer width="100%" height={250}>
            <BarChart data={binnedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="range" stroke="#5A5A5A" fontSize={10} fontStyle="italic" />
                <YAxis stroke="#5A5A5A" fontSize={10} label={{ value: 'Count', angle: -90, position: 'insideLeft', fill: '#5A5A5A', fontSize: 10 }} />
                <Tooltip
                    contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px' }}
                    labelStyle={{ color: '#1A1A1A', fontWeight: 'bold' }}
                />
                <Bar dataKey="count" fill="#4A6FA5" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
}


const LatencyMonitor: React.FC<LatencyMonitorProps> = ({ isExplanationMode }) => {
    const { latencyData, strategies } = useTradingData();
    
    const timeSeriesData = useMemo(() => {
        if(latencyData.length < 2) return [];
        const mean = latencyData.map(d=>d.latency).reduce((a,b) => a+b, 0) / latencyData.length;
        const stdDev = Math.sqrt(latencyData.map(d=>Math.pow(d.latency - mean, 2)).reduce((a,b) => a+b, 0) / latencyData.length);

        return latencyData.map(d => ({
            ...d,
            mean: mean,
            warning: mean + 2 * stdDev,
            critical: mean + 4 * stdDev,
        }));
    }, [latencyData]);

    const avgLatency = latencyData.length > 0 ? latencyData[latencyData.length - 1].latency : 0;
    const maxLatency = latencyData.length > 0 ? Math.max(...latencyData.map(d => d.latency)) : 0;


    return (
        <div className="p-6 space-y-6">
            <h2 className="text-3xl font-serif font-bold text-text-primary">Cycle Time Monitor</h2>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="relative">
                    <Card>
                        <h3 className="text-text-secondary text-[10px] uppercase tracking-widest font-bold mb-1">Last Cycle Time</h3>
                        <p className={`text-3xl font-bold ${avgLatency > 30000 ? 'text-brand-yellow' : 'text-text-primary'}`}>{avgLatency.toFixed(2)}ms</p>
                    </Card>
                    {isExplanationMode && <ExplanationOverlay title="Last Cycle Time" what="How long the backend's live data-refresh loop took to fetch and process every watched symbol in its most recent pass." why="This is a data-pipeline health metric, not trading latency -- it tells us whether yfinance is responding quickly or throttling us, which directly affects how current the dashboard's numbers are." how="Measured backend-side as time.time() at the start of the loop vs. the end, once per cycle (currently every ~20s plus fetch time)." />}
                </div>
                 <div className="relative">
                    <Card>
                        <h3 className="text-text-secondary text-[10px] uppercase tracking-widest font-bold mb-1">Peak Cycle Time (session)</h3>
                        <p className={`text-3xl font-bold ${maxLatency > 60000 ? 'text-brand-red' : 'text-text-primary'}`}>{maxLatency.toFixed(2)}ms</p>
                    </Card>
                    {isExplanationMode && <ExplanationOverlay title="Peak Cycle Time" what="The single longest data-refresh cycle recorded during the current session." why="Shows worst-case data-pipeline slowness -- useful for spotting when the free Yahoo Finance data source is being slow or rate-limiting requests." how="Maintains a running maximum of all cycle-time values recorded since the backend started." />}
                </div>
                 <div className="relative">
                    <Card>
                        <h3 className="text-text-secondary text-[10px] uppercase tracking-widest font-bold mb-1">Pipeline Status</h3>
                        <p className={`text-3xl font-bold ${avgLatency > 60000 ? 'text-brand-red' : avgLatency > 30000 ? 'text-brand-yellow' : 'text-brand-green'}`}>
                            {avgLatency > 60000 ? 'SLOW' : avgLatency > 30000 ? 'DEGRADED' : 'NOMINAL'}
                        </p>
                    </Card>
                     {isExplanationMode && <ExplanationOverlay title="Pipeline Status" what="A human-readable summary of current data-refresh speed based on fixed thresholds." why="At-a-glance check for whether the data pipeline is healthy, without having to read raw millisecond numbers." how="Simple thresholds: cycle time > 60s is SLOW, > 30s is DEGRADED, otherwise NOMINAL. Tuned for a free-tier yfinance pipeline, not a trading system." />}
                </div>
            </div>
            <div className="relative">
                <Card>
                    <h3 className="text-lg font-serif font-bold text-text-primary mb-4">Cycle Time Over Time (with Adaptive Thresholds)</h3>
                    <ResponsiveContainer width="100%" height={350}>
                        <AreaChart data={timeSeriesData}>
                             <defs>
                                <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#4A6FA5" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#4A6FA5" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                            <XAxis dataKey="time" tickFormatter={(time) => new Date(time).toLocaleTimeString()} stroke="#5A5A5A" fontSize={10} fontStyle="italic"/>
                            <YAxis stroke="#5A5A5A" fontSize={10} domain={[0, 'dataMax + 20']} label={{ value: 'ms', position: 'insideLeft', angle: -90, fill: '#5A5A5A', dy: 10, fontSize: 10 }}/>
                            <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px' }} labelStyle={{ color: '#1A1A1A', fontWeight: 'bold' }}/>
                            <Legend wrapperStyle={{fontSize: "12px", paddingTop: "10px"}}/>
                            <Area type="monotone" dataKey="latency" name="Cycle Time" stroke="#4A6FA5" strokeWidth={2} fillOpacity={1} fill="url(#colorLatency)" />
                            <Line type="monotone" dataKey="warning" name="Warning (μ+2σ)" stroke="#C4A46B" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                            <Line type="monotone" dataKey="critical" name="Critical (μ+4σ)" stroke="#A64D4D" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </Card>
                {isExplanationMode && <ExplanationOverlay title="Cycle Time Series w/ Adaptive Thresholds" what="A historical graph of backend cycle time with dynamic warning (yellow) and critical (red) thresholds." why="Static thresholds don't adapt well -- a slow cycle during a cold start is expected, but a sustained slow cycle later usually means Yahoo Finance is throttling. Adaptive thresholds based on recent variance reduce false alarms." how="Calculates a rolling mean (μ) and standard deviation (σ) of cycle time. Thresholds are plotted at μ+2σ and μ+4σ." />}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="relative">
                    <Card>
                        <h3 className="text-lg font-serif font-bold text-text-primary mb-4">Cycle Time by Strategy</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                            {strategies.map(s => (
                                <div key={s.name} className="p-3 bg-cream-tertiary rounded-xl border border-border-cream text-center">
                                    <p className="text-text-secondary truncate font-medium mb-1">{s.name}</p>
                                    <p className={`text-lg font-bold ${s.latency > 40 ? 'text-brand-yellow' : 'text-text-primary'}`}>{s.latency.toFixed(2)}ms</p>
                                </div>
                            ))}
                        </div>
                    </Card>
                    {isExplanationMode && <ExplanationOverlay title="Cycle Time by Strategy" what="A per-symbol breakdown of the most recent processing time reported for each strategy." why="Helps isolate whether a slowdown is coming from one specific symbol/strategy or the whole data pipeline." how="Each strategy entry carries its own last-reported latency value from backend state, shown here for comparison." />}
                </div>
                <div className="relative">
                    <Card>
                        <h3 className="text-lg font-serif font-bold text-text-primary mb-4">Cycle Time Distribution (Session)</h3>
                        <LatencyDistributionChart latencyData={latencyData.map(d => d.latency)} />
                    </Card>
                    {isExplanationMode && <ExplanationOverlay title="Cycle Time Distribution Histogram" what="A bar chart showing how many cycle-time measurements fall into different duration buckets." why="The average can hide a long tail of slow cycles (e.g. from yfinance rate-limiting or symbol errors). This chart reveals that tail instead of hiding it behind a single average number." how="Groups all cycle-time measurements from the session into bins and counts occurrences in each." />}
                </div>
            </div>
        </div>
    );
};

export default LatencyMonitor;