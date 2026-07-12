import React, { useMemo, useState, useEffect } from 'react';
import MarketClock from './MarketClock';
import useTradingData from '../hooks/useTradingData';
import { useTelemetryContext } from '../context/TelemetryContext';
import { TrendingUp, AlertCircle, Zap, Menu, Wifi, WifiOff, Activity } from 'lucide-react';

import MuLogo from './ui/MuLogo';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { strategies, alerts, isRealConnected } = useTradingData();
  const { data: telemetry, lastUpdate } = useTelemetryContext();
  const [pulse, setPulse] = useState(false);
  
  // Trigger pulse animation on every data packet
  useEffect(() => {
    if (lastUpdate) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 200);
      return () => clearTimeout(timer);
    }
  }, [lastUpdate]);

  const totalPnl = useMemo(() => strategies.reduce((sum, s) => sum + s.pnl, 0), [strategies]);
  const activeAlerts = useMemo(() => alerts.length, [alerts]);

  return (
    <header className="bg-cream-secondary border-b border-border-cream px-4 sm:px-8 py-3 flex items-center justify-between lg:col-span-2 shadow-sm z-10">
      <div className="flex items-center space-x-4 sm:space-x-8">
        {/* Mobile Menu Button */}
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 text-text-secondary hover:text-brand-green hover:bg-cream-tertiary rounded-lg transition-colors"
        >
          <Menu size={24} />
        </button>

        {/* Connection Status & Pulse */}
        <div className="flex items-center space-x-3 mr-2 group">
          {isRealConnected ? (
            <div className="flex items-center text-brand-green" title="Live Telemetry Connected">
              <div className={`relative flex items-center justify-center`}>
                <Wifi size={14} className="relative z-10" />
                <div className={`absolute w-4 h-4 rounded-full bg-brand-green/20 transition-all duration-200 ${pulse ? 'scale-150 opacity-100' : 'scale-0 opacity-0'}`} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-tighter ml-1.5 hidden sm:inline">Engine Live</span>
            </div>
          ) : (
            <div className="flex items-center text-brand-red animate-pulse" title="Telemetry Disconnected">
              <WifiOff size={14} />
              <span className="text-[10px] font-bold uppercase tracking-tighter ml-1.5 hidden sm:inline">Engine Offline</span>
            </div>
          )}
          
          <div className="h-4 w-[1px] bg-border-cream opacity-50" />
          
          <div className="flex items-center space-x-1">
             <Activity size={12} className={pulse ? 'text-brand-green' : 'text-text-secondary'} />
             <span className="text-[9px] font-mono font-bold text-text-secondary">
                {telemetry?.latency.current || '0.00'}<span className="opacity-50">ms</span>
             </span>
          </div>
        </div>

        {/* Global PnL Quick View */}
        <div className="hidden sm:flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${totalPnl >= 0 ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-red/10 text-brand-red'}`}>
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest leading-none mb-1">Global PnL</p>
            <p className={`text-sm font-mono font-bold leading-none ${totalPnl >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
              {totalPnl >= 0 ? '+' : ''}{totalPnl.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        {/* Active Alerts Quick View - Hidden on very small screens */}
        <div className="hidden md:flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-brand-yellow/10 text-brand-yellow">
            <AlertCircle size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest leading-none mb-1">Active Alerts</p>
            <p className="text-sm font-mono font-bold text-text-primary leading-none">
              {activeAlerts} <span className="text-[10px] font-normal text-text-secondary">Events</span>
            </p>
          </div>
        </div>

        {/* System Latency Quick View - Hidden on small screens */}
        <div className="hidden lg:flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-brand-blue/10 text-brand-blue">
            <Zap size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest leading-none mb-1">Avg Latency</p>
            <p className="text-sm font-mono font-bold text-text-primary leading-none">
              {telemetry?.latency.current || '0.00'} <span className="text-[10px] font-normal text-text-secondary">ms</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-6">
        <div className="hidden sm:block h-8 w-[1px] bg-border-cream mx-2"></div>
        <MarketClock />
        <div className="hidden sm:block h-8 w-[1px] bg-border-cream mx-2"></div>
        <button 
          id="info-trigger"
          className="p-1 text-text-secondary hover:text-brand-green transition-colors rounded-lg hover:bg-cream-tertiary"
          title="System Information"
        >
          <MuLogo size={32} variant="outline" className="hover:bg-brand-green/5" />
        </button>
      </div>
    </header>
  );
};

export default Header;