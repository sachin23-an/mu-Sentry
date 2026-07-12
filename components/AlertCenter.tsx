
import React, { useState, useMemo } from 'react';
import useTradingData from '../hooks/useTradingData';
import { Alert, AlertLevel } from '../types';
import Card from './ui/Card';
import { ExplanationOverlay } from './ui/Explanation';

interface AlertCenterProps {
    isExplanationMode: boolean;
}

const AlertItem: React.FC<{ alert: Alert }> = ({ alert }) => {
  const levelStyles = {
    [AlertLevel.Info]: { bg: 'bg-brand-blue/5', border: 'border-brand-blue/30', text: 'text-brand-blue', icon: 'i' },
    [AlertLevel.Warning]: { bg: 'bg-brand-yellow/5', border: 'border-brand-yellow/30', text: 'text-brand-yellow', icon: '!' },
    [AlertLevel.Critical]: { bg: 'bg-brand-red/5', border: 'border-brand-red/30', text: 'text-brand-red', icon: '!!' },
    [AlertLevel.Anomaly]: { bg: 'bg-purple-500/5', border: 'border-purple-500/30', text: 'text-purple-600', icon: 'σ' },
  };

  const styles = levelStyles[alert.level];

  return (
    <div className={`flex items-start space-x-3 p-3 border-l-4 rounded-r-md ${styles.bg} ${styles.border}`}>
      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm ${styles.text} bg-white shadow-sm`}>
        {styles.icon}
      </div>
      <div>
        <p className={`font-semibold ${styles.text} capitalize text-sm`}>{alert.level} Event</p>
        <p className="text-text-primary text-sm">{alert.message}</p>
        <p className="text-xs text-text-secondary mt-1">{new Date(alert.timestamp).toLocaleString()}</p>
      </div>
    </div>
  );
};

const AlertCenter: React.FC<AlertCenterProps> = ({ isExplanationMode }) => {
    const { alerts } = useTradingData();
    const [filter, setFilter] = useState<AlertLevel | 'all'>('all');

    const filteredAlerts = useMemo(() => {
        if (filter === 'all') return alerts;
        return alerts.filter(a => a.level === filter);
    }, [alerts, filter]);

    return (
        <div className="p-4 space-y-4">
            <h2 className="text-2xl font-serif text-text-primary">Event & Alert Center</h2>
            <div className="relative">
                <Card>
                    <div className="flex items-center space-x-2 mb-4">
                        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filter === 'all' ? 'bg-brand-green text-white shadow-sm' : 'bg-cream-tertiary text-text-secondary hover:bg-cream-tertiary/80'}`}>All</button>
                        <button onClick={() => setFilter(AlertLevel.Critical)} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filter === AlertLevel.Critical ? 'bg-brand-red text-white shadow-sm' : 'bg-cream-tertiary text-text-secondary hover:bg-cream-tertiary/80'}`}>Critical</button>
                        <button onClick={() => setFilter(AlertLevel.Anomaly)} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filter === AlertLevel.Anomaly ? 'bg-purple-600 text-white shadow-sm' : 'bg-cream-tertiary text-text-secondary hover:bg-cream-tertiary/80'}`}>Anomalies</button>
                        <button onClick={() => setFilter(AlertLevel.Warning)} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filter === AlertLevel.Warning ? 'bg-brand-yellow text-text-primary shadow-sm' : 'bg-cream-tertiary text-text-secondary hover:bg-cream-tertiary/80'}`}>Warnings</button>
                    </div>
                    <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
                        {filteredAlerts.length > 0 ? (
                            filteredAlerts.map(alert => <AlertItem key={alert.id} alert={alert} />)
                        ) : (
                            <p className="text-text-secondary text-center py-8">No events match the current filter.</p>
                        )}
                    </div>
                </Card>
                {isExplanationMode && <ExplanationOverlay title="Event & Alert Center" what="A comprehensive, filterable log of all system-generated events, including statistical anomalies (σ)." why="This is the trading desk's central nervous system. It ensures no critical event is missed and provides a full audit trail. Filtering for 'anomalies' is key for proactive risk management, allowing us to spot subtle deviations before they cause a failure." how="An event bus collects alerts from all systems. This UI subscribes to the bus and displays the alerts, allowing client-side filtering by severity level." />}
            </div>
        </div>
    );
};

export default AlertCenter;
