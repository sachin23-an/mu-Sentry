
import React, { useState, useEffect } from 'react';
import { X, Shield, Activity, Cpu, Zap, Globe, Lock, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import MuLogo from './ui/MuLogo';

const InfoOverlay: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 1000);

    const handleTriggerClick = () => setIsOpen(true);
    const trigger = document.getElementById('info-trigger');
    if (trigger) {
      trigger.addEventListener('click', handleTriggerClick);
    }

    return () => {
      clearTimeout(timer);
      if (trigger) {
        trigger.removeEventListener('click', handleTriggerClick);
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const closeOverlay = () => setIsOpen(false);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-6 md:p-12">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeOverlay}
              className="absolute inset-0 bg-cream-primary/80 backdrop-blur-md cursor-pointer"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 200 }}
              className="relative w-full max-w-6xl h-full sm:h-auto sm:max-h-[90vh] bg-white border border-border-cream sm:rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,0.1)] flex flex-col md:flex-row overflow-hidden"
            >
              {/* Left Pane: Editorial/Brand */}
              <div className="w-full md:w-1/2 p-8 sm:p-12 md:p-16 flex flex-col justify-between border-b md:border-b-0 md:border-r border-border-cream bg-gradient-to-br from-cream-secondary to-white">
                <div>
                  <motion.div 
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="mb-12 flex items-center space-x-3"
                  >
                    <MuLogo size={48} variant="green" />
                    <span className="text-4xl font-bold text-text-primary tracking-tighter">-Sentry</span>
                  </motion.div>
                  
                  <motion.h2 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-5xl sm:text-7xl font-serif text-text-primary leading-[0.9] tracking-tighter mb-8"
                  >
                    The Sentinel of <br />
                    <span className="italic font-light text-brand-green">High-Frequency</span> <br />
                    Risk
                  </motion.h2>

                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-lg sm:text-xl text-text-secondary font-serif italic leading-relaxed max-w-md"
                  >
                    "μ-Sentry is the definitive observability layer for institutional Indian equity desks. We bridge the gap between NSE market klines and strategic risk management."
                  </motion.p>
                </div>

                <div className="mt-12 md:mt-0">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="h-[1px] w-12 bg-brand-green/30"></div>
                    <span className="text-[10px] uppercase tracking-[0.4em] text-brand-green font-bold">System Status: Active</span>
                  </div>
                  <p className="text-[10px] font-mono text-text-secondary/40 uppercase tracking-widest">
                    Build 9211 // Quantum Ready // Auth: Verified
                  </p>
                </div>
              </div>

              {/* Right Pane: Technical Specs */}
              <div className="w-full md:w-1/2 p-8 sm:p-12 md:p-16 overflow-y-auto custom-scrollbar bg-white">
                <button
                  onClick={closeOverlay}
                  className="absolute top-8 right-8 p-2 text-text-secondary hover:text-text-primary transition-all rounded-full hover:bg-cream-secondary z-50"
                >
                  <X size={24} />
                </button>

                <div className="space-y-12">
                  <section>
                    <h3 className="text-[10px] uppercase tracking-[0.3em] text-text-secondary font-bold mb-8">Core Capabilities</h3>
                    <div className="grid grid-cols-1 gap-8">
                      <div className="flex items-start space-x-6">
                        <div className="p-3 rounded-xl bg-cream-secondary text-brand-green shrink-0">
                          <Activity size={20} />
                        </div>
                        <div>
                          <h4 className="text-text-primary font-bold text-sm mb-1 uppercase tracking-wider">Nanosecond Observability</h4>
                          <p className="text-text-secondary text-xs leading-relaxed">Monitoring every tick and every packet with sub-microsecond resolution across the entire stack.</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-6">
                        <div className="p-3 rounded-xl bg-cream-secondary text-brand-red shrink-0">
                          <Shield size={20} />
                        </div>
                        <div>
                          <h4 className="text-text-primary font-bold text-sm mb-1 uppercase tracking-wider">Statistical Guardrails</h4>
                          <p className="text-text-secondary text-xs leading-relaxed">Automated, server-side circuit breakers that react to σ-deviations in real-time, preventing runaway losses.</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-6">
                        <div className="p-3 rounded-xl bg-cream-secondary text-purple-600 shrink-0">
                          <Cpu size={20} />
                        </div>
                        <div>
                          <h4 className="text-text-primary font-bold text-sm mb-1 uppercase tracking-wider">Infrastructure Integrity</h4>
                          <p className="text-text-secondary text-xs leading-relaxed">Continuous validation of FIX gateways, market data feeds, and database persistence layers.</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-[10px] uppercase tracking-[0.3em] text-text-secondary font-bold mb-8">System Architecture</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-cream-secondary/30 border border-border-cream">
                        <Globe size={16} className="text-text-secondary/40 mb-3" />
                        <span className="block text-[10px] text-text-secondary uppercase tracking-widest mb-1">Network</span>
                        <span className="text-text-primary text-xs font-mono">L3/L4 Bypass</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-cream-secondary/30 border border-border-cream">
                        <Lock size={16} className="text-text-secondary/40 mb-3" />
                        <span className="block text-[10px] text-text-secondary uppercase tracking-widest mb-1">Security</span>
                        <span className="text-text-primary text-xs font-mono">AES-256-GCM</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-cream-secondary/30 border border-border-cream">
                        <BarChart3 size={16} className="text-text-secondary/40 mb-3" />
                        <span className="block text-[10px] text-text-secondary uppercase tracking-widest mb-1">Compute</span>
                        <span className="text-text-primary text-xs font-mono">FPGA Offload</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-cream-secondary/30 border border-border-cream">
                        <Zap size={16} className="text-text-secondary/40 mb-3" />
                        <span className="block text-[10px] text-text-secondary uppercase tracking-widest mb-1">Latency</span>
                        <span className="text-text-primary text-xs font-mono">&lt; 500ns Jitter</span>
                      </div>
                    </div>
                  </section>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={closeOverlay}
                    className="w-full py-4 bg-brand-green text-white font-bold uppercase tracking-[0.2em] text-xs rounded-xl shadow-[0_10px_30px_rgba(74,124,68,0.2)]"
                  >
                    Initialize Command Center
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default InfoOverlay;
