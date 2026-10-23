import type { HealthMetricKind } from './bluetooth-contract';

export type StoredHealthEvent = {
  metric_kind: HealthMetricKind;
  observed_at: string;
  value: number;
  quality_percent: number;
};

export type TwinMetric = {
  kind: HealthMetricKind;
  state: 'building-baseline' | 'steady' | 'review';
  latestValue: number;
  baselineMean: number | null;
  deviationPercent: number | null;
  sampleCount: number;
};

export type HealthTwin = {
  state: 'no-data' | 'building-baseline' | 'steady' | 'review';
  generatedAt: string;
  metrics: TwinMetric[];
};

const MINIMUM_BASELINE_SAMPLES = 7;

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function buildHealthTwin(events: StoredHealthEvent[], generatedAt = new Date().toISOString()): HealthTwin {
  const usableEvents = events.filter((event) => event.quality_percent >= 50 && Number.isFinite(event.value));
  const kinds = [...new Set(usableEvents.map((event) => event.metric_kind))];
  const metrics = kinds.map((kind): TwinMetric => {
    const samples = usableEvents
      .filter((event) => event.metric_kind === kind)
      .sort((left, right) => Date.parse(left.observed_at) - Date.parse(right.observed_at));
    const latestValue = samples.at(-1)!.value;
    if (samples.length < MINIMUM_BASELINE_SAMPLES) {
      return { kind, state: 'building-baseline', latestValue, baselineMean: null, deviationPercent: null, sampleCount: samples.length };
    }

    const baselineValues = samples.slice(0, -3).map((sample) => sample.value);
    const recentValues = samples.slice(-3).map((sample) => sample.value);
    const baselineMean = mean(baselineValues);
    const recentMean = mean(recentValues);
    const deviationPercent = baselineMean === 0 ? 0 : ((recentMean - baselineMean) / Math.abs(baselineMean)) * 100;
    const threshold = kind === 'gait-symmetry-percent' ? 8 : kind === 'heart-rate-bpm' ? 15 : 20;

    return {
      kind,
      state: Math.abs(deviationPercent) >= threshold ? 'review' : 'steady',
      latestValue,
      baselineMean,
      deviationPercent,
      sampleCount: samples.length,
    };
  });

  const state = metrics.length === 0
    ? 'no-data'
    : metrics.some((metric) => metric.state === 'review')
      ? 'review'
      : metrics.some((metric) => metric.state === 'building-baseline')
        ? 'building-baseline'
        : 'steady';
  return { state, generatedAt, metrics };
}