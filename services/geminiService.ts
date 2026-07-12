// Rule-based market commentary.
//
// FIX: This previously returned the exact same hardcoded sentence for
// every input, regardless of the prompt or live market state. That's
// dishonest — a recruiter who tries two different inputs and gets an
// identical answer will immediately flag it as fake.
//
// This version generates commentary from real, live telemetry (regime,
// realized volatility, momentum score) rather than an LLM call, and is
// upfront about that in the label the UI shows ("Regime-Based
// Commentary", not "AI Risk Analyst"). It mirrors the same honest
// approach already used by the backend's /v1/oracle endpoint.

interface CommentaryMetrics {
  regime?:          string;   // TRENDING | MEAN_REVERTING | UNCERTAIN
  realized_vol?:    number;
  vol_percentile?:  number;
  momentum_score?:  number;
  confidence?:      number;
}

export const analyzeTradingEvent = async (
  metrics?: CommentaryMetrics
): Promise<string> => {
  if (!metrics || !metrics.regime) {
    return 'No live telemetry available yet. Waiting for the first regime update from the engine.';
  }

  const {
    regime,
    realized_vol   = 0,
    vol_percentile = 50,
    momentum_score = 0,
    confidence     = 0,
  } = metrics;

  if (regime === 'TRENDING') {
    return (
      `Market regime: TRENDING (confidence ${confidence.toFixed(0)}%). ` +
      `Realized volatility ${realized_vol.toFixed(2)}% (${vol_percentile.toFixed(0)}th percentile), ` +
      `momentum score ${momentum_score.toFixed(2)}. ` +
      `Momentum signals are being weighted more heavily in the switching portfolio; ` +
      `expect the system to favor position persistence over mean-reversion entries.`
    );
  }

  if (regime === 'MEAN_REVERTING') {
    return (
      `Market regime: MEAN_REVERTING (confidence ${confidence.toFixed(0)}%). ` +
      `Realized volatility ${realized_vol.toFixed(2)}% (${vol_percentile.toFixed(0)}th percentile). ` +
      `RSI + Bollinger Band signals are being weighted more heavily; ` +
      `expect the system to favor fading extremes over trend-following entries.`
    );
  }

  return (
    `Market regime: UNCERTAIN (confidence ${confidence.toFixed(0)}%). ` +
    `Signals are mixed — realized volatility ${realized_vol.toFixed(2)}% ` +
    `(${vol_percentile.toFixed(0)}th percentile), momentum score ${momentum_score.toFixed(2)}. ` +
    `The system is running a balanced blend of momentum and mean-reversion until a clearer signal emerges.`
  );
};

export const generateRiskAnalysis = async (metrics?: CommentaryMetrics): Promise<{
  summary: string;
  recommendation: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}> => {
  const regime = metrics?.regime ?? 'UNCERTAIN';

  if (regime === 'TRENDING') {
    return {
      summary: 'Trend-persistence regime active based on Hurst exponent and momentum scoring.',
      recommendation: 'Maintain momentum-tilted allocation; monitor for regime confidence decay.',
      sentiment: (metrics?.momentum_score ?? 0) >= 0 ? 'BULLISH' : 'BEARISH',
    };
  }

  if (regime === 'MEAN_REVERTING') {
    return {
      summary: 'Mean-reverting regime active; price action showing reversion tendency.',
      recommendation: 'Favor RSI/Bollinger Band signals; size positions conservatively around extremes.',
      sentiment: 'NEUTRAL',
    };
  }

  return {
    summary: 'Regime signals are mixed with no clear directional edge.',
    recommendation: 'Maintain balanced exposure until regime confidence improves.',
    sentiment: 'NEUTRAL',
  };
};

const geminiService = {
  analyzeTradingEvent,
  generateRiskAnalysis,
};

export default geminiService;