import type { WatchHealthEvent } from './bluetooth-contract';
import { supabase } from './supabase';

export async function enrollSilverCareWatch(hardwareId: string, displayName: string): Promise<string> {
  if (!supabase) throw new Error('Sign in to sync watch health data.');
  const { data, error } = await supabase.rpc('enroll_silvercare_watch', {
    p_hardware_id: hardwareId,
    p_display_name: displayName,
  });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('The service did not return a watch enrollment ID.');
  return data;
}

export async function uploadWatchHealthEvent(deviceId: string, event: WatchHealthEvent): Promise<void> {
  if (!supabase) throw new Error('Sign in to sync watch health data.');
  const { error } = await supabase.rpc('ingest_watch_health_event', {
    p_device_id: deviceId,
    p_boot_session_id: event.bootSessionId,
    p_sequence: event.sequence,
    p_metric_kind: event.kind,
    p_observed_at: new Date(event.observedAtEpochMs).toISOString(),
    p_value: event.value,
    p_quality_percent: event.qualityPercent,
  });
  if (error) throw error;
}