import React from 'react';
import useTradingData from '../hooks/useTradingData';
import Card from './ui/Card';
import { ExplanationOverlay } from './ui/Explanation';

interface RiskHeatmapProps {
    isExplanationMode: boolean;
}

const RiskHeatmap: React.FC<RiskHeatmapProps> = ({ isExplanationMode }) => {
    const { correlationMatrix, strategies } = useTradingData();
    
    const getColorForCorrelation = (value: number) => {
        if (value > 0.8) return 'bg-brand-red';
        if (value > 0.6) return 'bg-brand-yellow';
        if (value > 0.4) return 'bg-brand-blue';
        return 'bg-brand-green';
    };

    if (strategies.length === 0) {
        return <div className="p-6">Loading strategy data...</div>;
    }

    return (
        <div className="p-6 space-y-6">
            <h2 className="text-3xl font-serif font-bold text-text-primary">Risk Correlation Heatmap</h2>
            <div className="relative">
                <Card>
                    <div className="flex justify-end space-x-6 mb-6 items-center text-[10px] uppercase tracking-widest font-bold opacity-70">
                        <span className="flex items-center"><div className="w-3 h-3 rounded-full bg-brand-green mr-2"></div>Low {'(<0.4)'}</span>
                        <span className="flex items-center"><div className="w-3 h-3 rounded-full bg-brand-blue mr-2"></div>Moderate {'(<0.6)'}</span>
                        <span className="flex items-center"><div className="w-3 h-3 rounded-full bg-brand-yellow mr-2"></div>High {'(<0.8)'}</span>
                        <span className="flex items-center"><div className="w-3 h-3 rounded-full bg-brand-red mr-2"></div>Critical {'>0.8'}</span>
                    </div>
                    <div className="relative overflow-x-auto pb-8 custom-scrollbar">
                        <div className="grid gap-2 min-w-[800px]" style={{ gridTemplateColumns: `200px repeat(${strategies.length}, 1fr)` }}>
                            {/* Empty corner */}
                            <div></div>
                            {/* Column headers */}
                            {strategies.map(s => (
                                <div key={s.id} className="text-[10px] uppercase tracking-widest font-bold text-text-secondary text-center h-32 flex items-end justify-center pb-4">
                                    <span className="transform -rotate-45 origin-bottom-left whitespace-nowrap inline-block w-0 translate-x-4">
                                        {s.name}
                                    </span>
                                </div>
                            ))}
                            
                            {/* Rows */}
                            {strategies.map((rowStrategy, rowIndex) => (
                                <React.Fragment key={rowStrategy.id}>
                                    <div className="text-[10px] font-bold text-text-primary flex items-center justify-end pr-6 h-14 truncate uppercase tracking-widest border-r border-border-cream/50 mr-2">
                                        {rowStrategy.name}
                                    </div>
                                    {correlationMatrix[rowIndex]?.map((value, colIndex) => (
                                        <div key={`${rowIndex}-${colIndex}`} className="relative group h-14">
                                            <div className={`w-full h-full rounded-xl ${getColorForCorrelation(value)} transition-all duration-300 group-hover:scale-105 shadow-sm border border-black/10`}></div>
                                            <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                {value.toFixed(2)}
                                            </div>
                                        </div>
                                    ))}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </Card>
                {isExplanationMode && <ExplanationOverlay title="Correlation Heatmap" what="A matrix that visualizes how similarly our 'independent' strategies are behaving. Red means they are making the same bets." why="This is our 'concentration risk' radar. If two strategies are highly correlated, they are not independent. A market move against their shared bet could cause catastrophic, amplified losses. This is a cardinal sin in portfolio management." how="It calculates the statistical correlation (e.g., Pearson correlation) between the PnL time-series or trade signals of every pair of strategies over a recent time window." />}
            </div>
        </div>
    );
};

export default RiskHeatmap;
