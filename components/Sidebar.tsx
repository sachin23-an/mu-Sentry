
import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Shield, 
  TrendingUp, 
  AlertCircle, 
  Settings, 
  LayoutDashboard,
  Cpu,
  Database,
  Globe,
  User,
  BarChart3,
  Clock,
  Wifi
} from 'lucide-react';

import MuLogo from './ui/MuLogo';
import useTradingData from '../hooks/useTradingData';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'latency', label: 'Latency Monitor', icon: Activity },
  { id: 'risk', label: 'Risk Heatmap', icon: Shield },
  { id: 'pnl', label: 'PnL Analyzer', icon: TrendingUp },
  { id: 'alerts', label: 'Alert Center', icon: AlertCircle },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView }) => {
  const { marketSnapshot } = useTradingData();
  const [cpuLoad, setCpuLoad] = useState(12);
  const [memLoad, setMemLoad] = useState(45);

  useEffect(() => {
    const interval = setInterval(() => {
      setCpuLoad(prev => Math.max(5, Math.min(95, prev + (Math.random() * 2 - 1))));
      setMemLoad(prev => Math.max(30, Math.min(85, prev + (Math.random() * 2 - 1))));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="bg-cream-secondary border-r border-border-cream flex flex-col h-full overflow-hidden">
      {/* Branding */}
      <div className="p-8 pb-4">
        <div className="flex items-center space-x-3 mb-2">
          <MuLogo size={40} variant="green" />
          <div>
            <h1 className="text-xl font-serif font-bold text-text-primary tracking-tight">
              <span className="font-sans">μ</span>-Sentry
            </h1>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        <p className="px-4 text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2 opacity-50">Main Menu</p>
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 w-full text-left group ${
              activeView === item.id
                ? 'bg-brand-green text-white shadow-lg shadow-brand-green/20'
                : 'text-text-secondary hover:bg-cream-tertiary hover:text-text-primary'
            }`}
          >
            <item.icon size={18} className={activeView === item.id ? 'text-white' : 'text-text-secondary group-hover:text-brand-green transition-colors'} />
            <span className="tracking-wide">{item.label}</span>
          </button>
        ))}

        {/* Market Snapshot Section */}
        <div className="mt-8 px-4 space-y-4">
          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest opacity-50">Market Snapshot</p>
          <div className="grid grid-cols-1 gap-2">
            <div className="p-3 rounded-xl bg-cream-tertiary/50 border border-border-cream/30 relative overflow-hidden group">
              {marketSnapshot.is_live && (
                <div className="absolute top-0 right-0 px-1.5 py-0.5 bg-brand-green/10 text-brand-green text-[7px] font-bold uppercase rounded-bl-lg">NSE Live</div>
              )}
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-text-secondary tracking-tighter">NIFTY 50</span>
                <span className={`text-[10px] font-mono ${marketSnapshot.nifty_change >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                  {marketSnapshot.nifty_change >= 0 ? '+' : ''}{(marketSnapshot.nifty_change || 0).toFixed(2)}%
                </span>
              </div>
              <p className="text-sm font-mono font-bold text-text-primary">
                ₹{(marketSnapshot.nifty_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              {marketSnapshot.last_sync > 0 && (
                <p className="text-[7px] text-text-secondary italic mt-1 opacity-60">Sync: {new Date(marketSnapshot.last_sync).toLocaleTimeString()}</p>
              )}
            </div>
            <div className="p-3 rounded-xl bg-cream-tertiary/50 border border-border-cream/30 relative">
              {marketSnapshot.is_live && (
                <div className="absolute top-0 right-0 px-1.5 py-0.5 bg-brand-green/10 text-brand-green text-[7px] font-bold uppercase rounded-bl-lg">NSE Live</div>
              )}
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-text-secondary tracking-tighter">SENSEX</span>
                <span className={`text-[10px] font-mono ${marketSnapshot.sensex_change >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                  {marketSnapshot.sensex_change >= 0 ? '+' : ''}{(marketSnapshot.sensex_change || 0).toFixed(2)}%
                </span>
              </div>
              <p className="text-sm font-mono font-bold text-text-primary">
                ₹{(marketSnapshot.sensex_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* System Health Section */}
        <div className="mt-8 px-4 space-y-4">
          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest opacity-50">System Health</p>
          
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-text-secondary">
                <span className="flex items-center tracking-tighter"><Cpu size={10} className="mr-1" /> CORE LOAD</span>
                <span>{cpuLoad.toFixed(1)}%</span>
              </div>
              <div className="h-1 bg-cream-tertiary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-brand-green transition-all duration-1000" 
                  style={{ width: `${cpuLoad}%` }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-text-secondary">
                <span className="flex items-center tracking-tighter"><Database size={10} className="mr-1" /> BUFFER</span>
                <span>{memLoad.toFixed(1)}%</span>
              </div>
              <div className="h-1 bg-cream-tertiary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-brand-blue transition-all duration-1000" 
                  style={{ width: `${memLoad}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-text-secondary pt-1">
              <span className="flex items-center tracking-tighter"><Wifi size={10} className="mr-1" /> NSE CORE</span>
              <span className="text-brand-green font-bold flex items-center">
                <span className="w-1.5 h-1.5 bg-brand-green rounded-full mr-1 animate-pulse" />
                ACTIVE
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-border-cream bg-cream-tertiary/30">
        <div className="flex items-center space-x-3 p-2 rounded-xl hover:bg-cream-tertiary transition-colors cursor-pointer group">
          <div className="w-10 h-10 rounded-full bg-white border border-border-cream flex items-center justify-center text-text-secondary group-hover:border-brand-green group-hover:text-brand-green transition-all">
            <User size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-text-primary truncate">MorningStar</p>
            <p className="text-[10px] text-text-secondary truncate">Senior Quant Trader</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
