
import React, { useMemo } from 'react';
import useTradingData from '../hooks/useTradingData';
import Card from './ui/Card';
import { AreaChart, Area, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from 'recharts';
import { ExplanationOverlay } from './ui/Explanation';

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
            <h2 className="text-3xl font-serif font-bold text-text-primary">Latency Monitor</h2>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="relative">
                    <Card>
                        <h3 className="text-text-secondary text-[10px] uppercase tracking-widest font-bold mb-1">Current System Latency</h3>
                        <p className={`text-3xl font-bold ${avgLatency > 50 ? 'text-brand-yellow' : 'text-text-primary'}`}>{avgLatency.toFixed(2)}ms</p>
                    </Card>
                    {isExplanationMode && <ExplanationOverlay title="Current Latency" what="The system-wide average order round-trip time, right now." why="This is our real-time speed. If this number creeps up, we are losing our competitive edge in the market instantly." how="Calculated from the most recent latency data points from all critical systems." />}
                </div>
                 <div className="relative">
                    <Card>
                        <h3 className="text-text-secondary text-[10px] uppercase tracking-widest font-bold mb-1">Peak Latency (session)</h3>
                        <p className={`text-3xl font-bold ${maxLatency > 80 ? 'text-brand-red' : 'text-text-primary'}`}>{maxLatency.toFixed(2)}ms</p>
                    </Card>
                    {isExplanationMode && <ExplanationOverlay title="Peak Latency" what="The single worst (highest) latency measurement recorded during the current trading session." why="This tells us the worst-case scenario we've faced today. It's crucial for understanding our system's performance under stress." how="Maintains a running maximum of all latency values recorded since the system started." />}
                </div>
                 <div className="relative">
                    <Card>
                        <h3 className="text-text-secondary text-[10px] uppercase tracking-widest font-bold mb-1">Latency Status</h3>
                        <p className={`text-3xl font-bold ${avgLatency > 80 ? 'text-brand-red' : avgLatency > 50 ? 'text-brand-yellow' : 'text-brand-green'}`}>
                            {avgLatency > 80 ? 'CRITICAL' : avgLatency > 50 ? 'WARNING' : 'NOMINAL'}
                        </p>
                    </Card>
                     {isExplanationMode && <ExplanationOverlay title="Latency Status" what="A human-readable summary of the current latency situation based on predefined thresholds." why="Provides an at-a-glance health check. Quants don't need to read the numbers; the color tells them if they need to act." how="A simple state machine: if latency > 80ms, status is CRITICAL. If > 50ms, WARNING. Otherwise, NOMINAL." />}
                </div>
            </div>
            <div className="relative">
                <Card>
                    <h3 className="text-lg font-serif font-bold text-text-primary mb-4">System Latency Over Time (with Adaptive Thresholds)</h3>
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
                            <Area type="monotone" dataKey="latency" name="System Latency" stroke="#4A6FA5" strokeWidth={2} fillOpacity={1} fill="url(#colorLatency)" />
                            <Line type="monotone" dataKey="warning" name="Warning (μ+2σ)" stroke="#C4A46B" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                            <Line type="monotone" dataKey="critical" name="Critical (μ+4σ)" stroke="#A64D4D" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </Card>
                {isExplanationMode && <ExplanationOverlay title="Latency Time-Series w/ Adaptive Thresholds" what="A historical graph of latency with dynamic warning (yellow) and critical (red) thresholds." why="Static thresholds are naive. A 50ms spike is normal during market open, but a disaster in a quiet market. These adaptive thresholds, based on recent volatility (standard deviation), adjust to market conditions, reducing false alarms and highlighting true anomalies." how="Calculates a rolling mean (μ) and standard deviation (σ) of latency. Thresholds are plotted at μ+2σ and μ+4σ." />}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="relative">
                    <Card>
                        <h3 className="text-lg font-serif font-bold text-text-primary mb-4">Latency by Strategy</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                            {strategies.map(s => (
                                <div key={s.name} className="p-3 bg-cream-tertiary rounded-xl border border-border-cream text-center">
                                    <p className="text-text-secondary truncate font-medium mb-1">{s.name}</p>
                                    <p className={`text-lg font-bold ${s.latency > 40 ? 'text-brand-yellow' : 'text-text-primary'}`}>{s.latency.toFixed(2)}ms</p>
                                </div>
                            ))}
                        </div>
                    </Card>
                    {isExplanationMode && <ExplanationOverlay title="Latency by Strategy" what="A breakdown of current latency for each individual trading algorithm." why="Isolates the problem. If system-wide latency is high, this tells us if it's one misbehaving algorithm or a problem with the entire network infrastructure." how="Each strategy process reports its own recent average latency, which is displayed here for comparison." />}
                </div>
                <div className="relative">
                    <Card>
                        <h3 className="text-lg font-serif font-bold text-text-primary mb-4">Latency Distribution (Session)</h3>
                        <LatencyDistributionChart latencyData={latencyData.map(d => d.latency)} />
                    </Card>
                    {isExplanationMode && <ExplanationOverlay title="Latency Distribution Histogram" what="A bar chart showing how many latency measurements fall into different time buckets (e.g., 10-15ms, 15-20ms)." why="The average latency can be misleading. This chart reveals the 'tail risk'— a long tail of high-latency events that could be killing profitability, even if the average looks good. A tight, left-skewed distribution is the goal." how="Groups all latency measurements from the session into bins and counts the number of occurrences in each." />}
                </div>
            </div>
        </div>
    );
};

export default LatencyMonitor;
