import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';

// Full shape of what the Python backend broadcasts via WebSocket
interface TelemetryData {
  timestamp: number;

  latency: {
    current: string;
    p99:     string;
    history: { time: number; latency: number }[];
  };

  infrastructure: {
    fixGateway:  string;
    marketData:  string;
    database:    string;
  };

  pnl: {
    realized:   string;
    unrealized: string;
  };

  market_snapshot: {
    nifty_price:   number;
    sensex_price:  number;
    nifty_change:  number;
    sensex_change: number;
    is_live:       boolean;
    market_status: string;
    last_sync:     number;
  };

  // ── Regime state ────────────────────────────────────
  regime: {
    current:        string;        // TRENDING | MEAN_REVERTING | UNCERTAIN
    confidence:     number;
    realized_vol:   number;
    vol_percentile: number;
    momentum_score: number;
    switches_today: number;
    regime_history: {
      time:       number;
      regime:     string;
      confidence: number;
      hurst:      number;
    }[];
  };

  // ── Portfolio state ─────────────────────────────────
  portfolio: {
    total_equity:     number;
    total_return_pct: number;
    equity_history:   { time: number; value: number; benchmark: number }[];
    momentum_weight:  number;
    meanrev_weight:   number;
    active_strategy:  string;
  };

  // ── Backtest results ────────────────────────────────
  backtest: {
    status:      string;
    data_period: string;
    insample:    Record<string, any>;
    outsample:   Record<string, any>;
    regime_stats: {
      trending_pct:         number;
      meanrev_pct:          number;
      momentum_in_trending: number;
      momentum_in_meanrev:  number;
      meanrev_in_trending:  number;
      meanrev_in_meanrev:   number;
    };
    research_conclusion: string;
    equity_curves:       Record<string, any>;
  };

  alerts:    any[];
  strategies: { [key: string]: any };
  correlation_matrix: number[][];
}

interface TelemetryContextType {
  data:       TelemetryData | null;
  isConnected: boolean;
  lastUpdate:  number;
}

const TelemetryContext = createContext<TelemetryContextType>({
  data:        null,
  isConnected: false,
  lastUpdate:  0,
});

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [data, setData]               = useState<TelemetryData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate]   = useState(0);

  const socketRef           = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    // FIX: build the WebSocket URL relative to wherever the app is being
    // served from, instead of hardcoding localhost:5000. This makes the
    // same build work on a laptop (http://localhost:3000), on a LAN IP,
    // or on a deployed domain (https://myapp.com -> wss://myapp.com).
    // The Express gateway (server.ts) proxies /python-ws to the Flask
    // backend, so the browser only ever needs to know its own host.
    const protocol  = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host      = window.location.host; // e.g. localhost:3000 or myapp.com
    const socketUrl = `${protocol}//${host}/python-ws`;

    console.log('μ-Sentry: Connecting to Engine at', socketUrl);

    const socket = new WebSocket(socketUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log('μ-Sentry: Engine Link Established.');
      setIsConnected(true);
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'TELEMETRY_UPDATE') {
          setData(message.payload);
          setLastUpdate(Date.now());
        }
      } catch (err) {
        console.error('Telemetry Parse Error:', err);
      }
    };

    socket.onclose = () => {
      console.warn('μ-Sentry: Engine Link Severed.');
      setIsConnected(false);
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 3000);
    };

    socket.onerror = (err) => {
      console.error('WebSocket Error:', err);
      socket.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      socketRef.current?.close();
    };
  }, [connect]);

  return (
    <TelemetryContext.Provider value={{ data, isConnected, lastUpdate }}>
      {children}
    </TelemetryContext.Provider>
  );
};

export const useTelemetryContext = () => useContext(TelemetryContext);