import { supabase } from './supabase';
import { buildHealthTwin, type HealthTwin, type StoredHealthEvent } from './health-twin-model';

export type { HealthTwin } from './health-twin-model';

export async function loadHealthTwin(): Promise<HealthTwin> {
  if (!supabase) return buildHealthTwin([]);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('watch_health_events')
    .select('metric_kind, observed_at, value, quality_percent')
    .gte('observed_at', since)
    .order('observed_at', { ascending: true })
    .limit(1000);
  if (error) throw error;
  return buildHealthTwin((data ?? []).map((event) => ({
    ...event,
    value: Number(event.value),
  })) as StoredHealthEvent[]);
}