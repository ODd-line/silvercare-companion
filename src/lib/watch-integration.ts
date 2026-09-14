export const WATCH_PROTOCOL_VERSION = 1;

export type WatchConnectionState = 'transport-pending' | 'connected' | 'stale';

export type WatchCheckInState = 'idle' | 'prompting' | 'confirmed-ok' | 'help-requested' | 'timed-out';

export type WatchCompanionSnapshot = {
  protocolVersion: typeof WATCH_PROTOCOL_VERSION;
  generatedAt: string;
  wearerName: string;
  gaitSummary: {
    state: 'unavailable' | 'baseline-building' | 'ready';
    cadenceSpm: number | null;
    symmetryPercent: number | null;
    trend: 'unavailable' | 'steady' | 'review';
  };
  checkIn: {
    state: WatchCheckInState;
    message: string | null;
  };
  emergencyContact: {
    name: string;
    phone: string;
  } | null;
};

export const WATCH_CAPABILITIES = [
  'Native SilverCare watch screen',
  'Local wearer check-ins',
  'Possible-collapse evidence evaluator',
  'Wi-Fi hardware and credential storage',
] as const;

export const WATCH_TRANSPORT_GAPS = [
  'Authenticated phone-to-watch transport',
  'Sensor ingestion from gait insoles',
  'Remote check-in delivery',
] as const;

export function createWatchSnapshot(
  wearerName: string,
  emergencyContact: { name: string; phone: string } | null,
): WatchCompanionSnapshot {
  return {
    protocolVersion: WATCH_PROTOCOL_VERSION,
    generatedAt: new Date().toISOString(),
    wearerName,
    gaitSummary: {
      state: 'unavailable',
      cadenceSpm: null,
      symmetryPercent: null,
      trend: 'unavailable',
    },
    checkIn: {
      state: 'idle',
      message: null,
    },
    emergencyContact,
  };
}