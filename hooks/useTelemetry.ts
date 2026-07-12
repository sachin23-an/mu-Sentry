import { useTelemetryContext } from '../context/TelemetryContext';

export const useTelemetry = () => {
  const { data, isConnected } = useTelemetryContext();
  return { data, isConnected };
};
