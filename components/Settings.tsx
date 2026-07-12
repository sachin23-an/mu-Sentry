
import React from 'react';
import Card from './ui/Card';
import { ExplanationOverlay } from './ui/Explanation';

interface SettingsProps {
    isExplanationMode: boolean;
}

const Settings: React.FC<SettingsProps> = ({ isExplanationMode }) => {
    return (
        <div className="p-4 space-y-4">
            <h2 className="text-2xl font-serif text-text-primary">System Configuration</h2>
            <div className="relative">
                <Card>
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-base font-serif font-bold text-brand-green">Adaptive Latency Thresholds</h3>
                            <div className="mt-2 space-y-2 text-sm">
                                <label className="flex items-center space-x-4">
                                    <span className="w-52 text-text-secondary">Warning Threshold (Std. Dev.)</span>
                                    <input type="number" defaultValue="2" step="0.1" className="w-24 bg-cream-tertiary border border-border-cream rounded-md p-2 focus:ring-2 focus:ring-brand-green outline-none" />
                                     <span className="text-xs text-text-secondary">σ (Sigma)</span>
                                </label>
                                <label className="flex items-center space-x-4">
                                    <span className="w-52 text-text-secondary">Critical Threshold (Std. Dev.)</span>
                                    <input type="number" defaultValue="4" step="0.1" className="w-24 bg-cream-tertiary border border-border-cream rounded-md p-2 focus:ring-2 focus:ring-brand-green outline-none" />
                                     <span className="text-xs text-text-secondary">σ (Sigma)</span>
                                </label>
                            </div>
                        </div>

                        <div className="border-t border-border-cream pt-4">
                            <h3 className="text-base font-serif font-bold text-brand-green">Data & Refresh</h3>
                            <div className="mt-2 space-y-2 text-sm">
                                <label className="flex items-center space-x-4">
                                    <span className="w-52 text-text-secondary">UI Refresh Rate (s)</span>
                                    <input type="number" defaultValue="1.5" step="0.1" className="w-24 bg-cream-tertiary border border-border-cream rounded-md p-2 focus:ring-2 focus:ring-brand-green outline-none" />
                                </label>
                            </div>
                        </div>

                        <div className="border-t border-border-cream pt-4">
                            <h3 className="text-base font-serif font-bold text-brand-green">Notifications</h3>
                            <div className="mt-2 space-y-2 text-sm">
                                <label className="flex items-center space-x-3 cursor-pointer group">
                                    <input type="checkbox" className="form-checkbox h-4 w-4 bg-cream-tertiary border-border-cream text-brand-green rounded focus:ring-brand-green" defaultChecked />
                                    <span className="group-hover:text-text-primary transition-colors">Email on CRITICAL</span>
                                </label>
                                <label className="flex items-center space-x-3 cursor-pointer group">
                                    <input type="checkbox" className="form-checkbox h-4 w-4 bg-cream-tertiary border-border-cream text-brand-green rounded focus:ring-brand-green" />
                                    <span className="group-hover:text-text-primary transition-colors">Telegram on ANOMALY</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </Card>
                {isExplanationMode && <ExplanationOverlay title="System Configuration" what="A control panel to configure the core parameters of the <span class='font-sans'>μ</span>-Sentry system." why="A risk system must be adaptable. Market volatility changes, so our definition of an 'anomaly' must be adjustable. This panel allows the desk to fine-tune the system's sensitivity (in standard deviations, not arbitrary milliseconds) and notification channels without redeploying code." how="These UI controls connect to a configuration service. When a value is saved, the backend engines fetch the new configuration and apply it in real-time." />}
            </div>
        </div>
    );
};

export default Settings;
