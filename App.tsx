import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import LatencyMonitor from '@/components/LatencyMonitor';
import RiskHeatmap from '@/components/RiskHeatmap';
import PnlAnalyzer from '@/components/PnlAnalyzer';
import AlertCenter from '@/components/AlertCenter';
import Settings from '@/components/Settings';
import InfoOverlay from '@/components/InfoOverlay';
import { ExplanationToggle, StyleInjector } from '@/components/ui/Explanation';
import { TelemetryProvider } from '@/context/TelemetryContext';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState('dashboard');
  const [isExplanationMode, setIsExplanationMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const viewProps = { isExplanationMode };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        const keyMap: { [key: string]: string } = {
            '1': 'dashboard',
            '2': 'latency',
            '3': 'risk',
            '4': 'pnl',
            '5': 'alerts',
            '6': 'settings',
        };
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            return;
        }
        
        if (keyMap[event.key]) {
            setActiveView(keyMap[event.key]);
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
}, []); 

  return (
    <TelemetryProvider>
      <div className="min-h-screen flex flex-col lg:grid lg:grid-cols-[250px_1fr] lg:grid-rows-[auto_1fr] bg-cream-primary">
      <StyleInjector />
      <Header onMenuClick={toggleSidebar} />
      <div className={`
        fixed inset-0 z-40 lg:relative lg:z-0 lg:block
        ${isSidebarOpen ? 'block' : 'hidden'}
      `}>
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm lg:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
        <div className="relative h-full w-[280px] lg:w-full shadow-2xl lg:shadow-none">
          <Sidebar 
            activeView={activeView} 
            setActiveView={(view) => {
              setActiveView(view);
              setIsSidebarOpen(false);
            }} 
          />
        </div>
      </div>
      <main className="flex-1 overflow-y-auto min-h-0 relative">
        <div className={activeView === 'dashboard' ? '' : 'hidden'}>
          <Dashboard {...viewProps} />
        </div>
        <div className={activeView === 'latency' ? '' : 'hidden'}>
          <LatencyMonitor {...viewProps} />
        </div>
        <div className={activeView === 'risk' ? '' : 'hidden'}>
          <RiskHeatmap {...viewProps} />
        </div>
        <div className={activeView === 'pnl' ? '' : 'hidden'}>
          <PnlAnalyzer {...viewProps} />
        </div>
        <div className={activeView === 'alerts' ? '' : 'hidden'}>
          <AlertCenter {...viewProps} />
        </div>
        <div className={activeView === 'settings' ? '' : 'hidden'}>
          <Settings {...viewProps} />
        </div>
      </main>
      <ExplanationToggle isExplanationMode={isExplanationMode} setIsExplanationMode={setIsExplanationMode} />
      <InfoOverlay />
      </div>
    </TelemetryProvider>
  );
};

export default App;
