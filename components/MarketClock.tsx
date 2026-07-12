import React, { useState, useEffect } from 'react';

interface MarketStatus {
    status: 'OPEN' | 'CLOSED' | 'PRE-MARKET' | 'POST-MARKET';
    countdownTo: string;
    diff: number;
}

const getMarketStatus = (): MarketStatus => {
    const now = new Date();
    // Use 'Asia/Kolkata' for Indian Standard Time (IST)
    const indiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    
    const dayOfWeek = indiaTime.getDay(); // 0 = Sunday, 6 = Saturday
    const hours = indiaTime.getHours();
    const minutes = indiaTime.getMinutes();
    const timeInMinutes = hours * 60 + minutes;

    // NSE Timings in minutes from midnight
    const preMarketOpenMinutes = 9 * 60;      // 9:00 AM
    const marketOpenMinutes = 9 * 60 + 15;    // 9:15 AM
    const marketCloseMinutes = 15 * 60 + 30;  // 3:30 PM
    const postMarketCloseMinutes = 16 * 60;   // 4:00 PM

    const getTargetTime = (hour: number, minute: number, dayOffset = 0) => {
        const target = new Date(indiaTime);
        target.setDate(target.getDate() + dayOffset);
        target.setHours(hour, minute, 0, 0);
        return target;
    };

    // Weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        const daysUntilMonday = dayOfWeek === 0 ? 1 : 2;
        const target = getTargetTime(9, 0, daysUntilMonday);
        return { status: 'CLOSED', countdownTo: 'Pre-Market Open', diff: target.getTime() - indiaTime.getTime() };
    }

    // Weekday checks
    if (timeInMinutes >= marketOpenMinutes && timeInMinutes < marketCloseMinutes) {
        const target = getTargetTime(15, 30);
        return { status: 'OPEN', countdownTo: 'Market Close', diff: target.getTime() - indiaTime.getTime() };
    }
    if (timeInMinutes >= preMarketOpenMinutes && timeInMinutes < marketOpenMinutes) {
        const target = getTargetTime(9, 15);
        return { status: 'PRE-MARKET', countdownTo: 'Market Open', diff: target.getTime() - indiaTime.getTime() };
    }
    // NSE has a short post-market session.
    if (timeInMinutes > marketCloseMinutes && timeInMinutes < postMarketCloseMinutes) {
        const target = getTargetTime(16, 0);
        return { status: 'POST-MARKET', countdownTo: 'Post-Market Close', diff: target.getTime() - indiaTime.getTime() };
    }

    // Closed on a weekday (before pre-market or after post-market)
    const isBeforePreMarket = timeInMinutes < preMarketOpenMinutes;
    const dayOffset = isBeforePreMarket ? 0 : (dayOfWeek === 5 ? 3 : 1); // If after-hours Friday, jump to Monday
    const target = getTargetTime(9, 0, dayOffset);
    return { status: 'CLOSED', countdownTo: 'Pre-Market Open', diff: target.getTime() - indiaTime.getTime() };
};


const formatCountdown = (diff: number): string => {
    if (diff <= 0) return '00:00:00';
    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};


const MarketClock: React.FC = () => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [marketStatus, setMarketStatus] = useState<MarketStatus>(getMarketStatus());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
            setMarketStatus(getMarketStatus());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const statusConfig = {
        OPEN: { color: 'bg-brand-green', text: 'text-brand-green' },
        CLOSED: { color: 'bg-brand-red', text: 'text-brand-red' },
        'PRE-MARKET': { color: 'bg-brand-yellow', text: 'text-brand-yellow' },
        'POST-MARKET': { color: 'bg-brand-blue', text: 'text-brand-blue' },
    };

    const config = statusConfig[marketStatus.status];

    return (
        <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full animate-pulse ${config.color}`}></div>
                <div>
                    <span className={`font-bold ${config.text}`}>{marketStatus.status}</span>
                    <span className="text-text-secondary text-xs ml-2">({marketStatus.countdownTo})</span>
                </div>
            </div>
            <div className="font-mono bg-cream-tertiary border border-border-cream/50 px-3 py-1 rounded-md text-text-primary tracking-widest shadow-sm">
                {formatCountdown(marketStatus.diff)}
            </div>
            <div className="font-mono text-lg text-text-secondary">
                {currentTime.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })} IST
            </div>
        </div>
    );
};

export default MarketClock;