import React, { useState, useMemo } from 'react';
import useTradingData from '../hooks/useTradingData';
import Card from './ui/Card';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { ExplanationOverlay } from './ui/Explanation';

interface PnlAnalyzerProps {
    isExplanationMode: boolean;
}

const PnlAnalyzer: React.FC<PnlAnalyzerProps> = ({ isExplanationMode }) => {
    const { strategies } = useTradingData();
    const [selectedStrategyId, setSelectedStrategyId] = useState<string>('');
    
    // Ensure a strategy is selected when data becomes available
    React.useEffect(() => {
        if (strategies.length > 0 && !selectedStrategyId) {
            setSelectedStrategyId(strategies[0].id);
        }
    }, [strategies, selectedStrategyId]);

    const selectedStrategy = strategies.find(s => s.id === selectedStrategyId);

    const combinedPnlData = useMemo(() => {
        if (!selectedStrategy) return [];
        
        const liveData = selectedStrategy.pnlHistory.map(p => ({ time: p.time, live: p.value }));
        const backtestData = selectedStrategy.backtestPnlHistory.map(p => ({ time: p.time, backtest: p.value }));

        const mergedData: { [key: number]: { time: number, live?: number, backtest?: number } } = {};

        liveData.forEach(p => {
            mergedData[p.time] = { ...mergedData[p.time], time: p.time, live: p.live };
        });
        backtestData.forEach(p => {
            mergedData[p.time] = { ...mergedData[p.time], time: p.time, backtest: p.backtest };
        });

        // Forward fill both live and backtest data to ensure continuous lines
        const sortedData = Object.values(mergedData).sort((a, b) => a.time - b.time);
        let lastLiveValue: number | undefined = undefined;
        let lastBacktestValue: number | undefined = undefined;

        sortedData.forEach(d => {
            // Forward fill backtest
            if (d.backtest !== undefined) {
                lastBacktestValue = d.backtest;
            } else if (lastBacktestValue !== undefined) {
                d.backtest = lastBacktestValue;
            }

            // Forward fill live, which will only start once the first live point is seen
            if (d.live !== undefined) {
                lastLiveValue = d.live;
            } else if (lastLiveValue !== undefined) {
                d.live = lastLiveValue;
            }
        });

        return sortedData;

    }, [selectedStrategy]);

    const trackingError = useMemo(() => {
        if (!selectedStrategy || selectedStrategy.pnlHistory.length < 2 || selectedStrategy.backtestPnlHistory.length < 2) return 0;
        
        // Find overlapping time points
        const livePts = selectedStrategy.pnlHistory;
        const benchPts = selectedStrategy.backtestPnlHistory;
        
        const diffs: number[] = [];
        livePts.forEach((p, i) => {
            if (i === 0) return;
            const liveRet = (p.value - livePts[i-1].value) / (livePts[i-1].value || 1);
            
            // Find closest benchmark point in time
            const benchIdx = benchPts.findIndex(b => b.time >= p.time);
            if (benchIdx > 0) {
                const benchRet = (benchPts[benchIdx].value - benchPts[benchIdx-1].value) / (benchPts[benchIdx-1].value || 1);
                diffs.push(liveRet - benchRet);
            }
        });
        
        if (diffs.length === 0) return 0;
        const meanDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
        const stdDiff = Math.sqrt(diffs.map(x => Math.pow(x - meanDiff, 2)).reduce((a, b) => a + b, 0) / diffs.length);
        
        // Return annualized tracking error percentage
        return stdDiff * Math.sqrt(252 * 1440) * 100;
    }, [selectedStrategy]);

    return (
        <div className="p-6 space-y-6">
            <h2 className="text-3xl font-serif font-bold text-text-primary">Strategy Performance Analyzer</h2>
            <div className="relative">
                <Card>
                    <div className="flex items-center space-x-4 mb-6">
                        <label htmlFor="strategy-select" className="text-text-secondary text-sm font-medium">Select Strategy:</label>
                        <select
                            id="strategy-select"
                            value={selectedStrategyId}
                            onChange={(e) => setSelectedStrategyId(e.target.value)}
                            className="bg-cream-tertiary border border-border-cream rounded-xl p-3 text-sm font-bold text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all"
                        >
                            {strategies.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    {selectedStrategy && (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                                <div className="bg-cream-tertiary p-4 rounded-2xl border border-border-cream">
                                    <p className="text-[10px] uppercase tracking-widest font-bold text-text-secondary mb-1">Net PnL</p>
                                    <p className={`text-xl font-bold ${selectedStrategy.pnl >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>{selectedStrategy.pnl.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</p>
                                </div>
                                 <div className="bg-cream-tertiary p-4 rounded-2xl border border-border-cream">
                                    <p className="text-[10px] uppercase tracking-widest font-bold text-text-secondary mb-1">Tracking Error</p>
                                    <p className="text-xl font-bold text-text-primary">{trackingError.toFixed(2)}%</p>
                                </div>
                                <div className="bg-cream-tertiary p-4 rounded-2xl border border-border-cream">
                                    <p className="text-[10px] uppercase tracking-widest font-bold text-text-secondary mb-1">Sharpe Ratio</p>
                                    <p className="text-xl font-bold text-text-primary">{selectedStrategy.sharpeRatio.toFixed(2)}</p>
                                </div>
                                <div className="bg-cream-tertiary p-4 rounded-2xl border border-border-cream">
                                    <p className="text-[10px] uppercase tracking-widest font-bold text-text-secondary mb-1">Max Drawdown</p>
                                    <p className="text-xl font-bold text-brand-yellow">{selectedStrategy.maxDrawdown.toFixed(2)}%</p>
                                </div>
                                <div className="bg-cream-tertiary p-4 rounded-2xl border border-border-cream">
                                    <p className="text-[10px] uppercase tracking-widest font-bold text-text-secondary mb-1">Calmar Ratio</p>
                                    <p className="text-xl font-bold text-text-primary">{selectedStrategy.calmarRatio.toFixed(2)}</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                <div>
                                    <h3 className="text-lg font-serif font-bold text-text-primary mb-4">Live vs. Backtest PnL: {selectedStrategy.name}</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart data={combinedPnlData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                                            <XAxis dataKey="time" tickFormatter={(time) => new Date(time).toLocaleTimeString()} stroke="#5A5A5A" fontSize={10} fontStyle="italic"/>
                                            <YAxis stroke="#5A5A5A" fontSize={10} tickFormatter={(value) => `₹${value.toLocaleString('en-IN')}`}/>
                                            <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px' }} labelStyle={{ color: '#1A1A1A', fontWeight: 'bold' }}/>
                                            <Legend wrapperStyle={{fontSize: "12px", paddingTop: "10px"}}/>
                                            <Line type="monotone" dataKey="live" name="Live Net PnL" stroke="#4A7C44" strokeWidth={3} dot={false} />
                                            <Line type="monotone" dataKey="backtest" name="Backtested PnL" stroke="#5A5A5A" strokeWidth={2} strokeDasharray="5 5" dot={false} opacity={0.5} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                <div>
                                    <h3 className="text-lg font-serif font-bold text-text-primary mb-4">Drawdown Curve (%)</h3>
                                     <ResponsiveContainer width="100%" height={300}>
                                        <AreaChart data={selectedStrategy.drawdownHistory}>
                                             <defs>
                                                <linearGradient id="colorDrawdown" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#A64D4D" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#A64D4D" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                                            <XAxis dataKey="time" tickFormatter={(time) => new Date(time).toLocaleTimeString()} stroke="#5A5A5A" fontSize={10} fontStyle="italic"/>
                                            <YAxis stroke="#5A5A5A" fontSize={10} unit="%" domain={[0, 'dataMax + 5']}/>
                                            <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px' }} labelStyle={{ color: '#1A1A1A', fontWeight: 'bold' }}/>
                                            <Area type="monotone" dataKey="drawdown" name="Drawdown" stroke="#A64D4D" strokeWidth={2} fill="url(#colorDrawdown)" dot={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </>
                    )}
                </Card>
                {isExplanationMode && selectedStrategy && <ExplanationOverlay title="Strategy Performance Analysis" what="A deep-dive into a single strategy's risk and return profile, comparing its live PnL curve to its idealized backtest and showing its drawdown (losses from peak)." why="This view answers the crucial question: 'Is the strategy performing as expected?' A widening gap between the live and backtest PnL (Tracking Error) indicates model drift or unexpected costs, which is a critical signal for intervention." how="It calculates industry-standard metrics like Sharpe Ratio and plots the live PnL, backtested PnL, and drawdown time-series." />}
            </div>
        </div>
    );
};

export default PnlAnalyzer;