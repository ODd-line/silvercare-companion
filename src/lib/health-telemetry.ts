import type { HealthMetricKind, WatchHealthEvent } from './bluetooth-contract';

export const HEALTH_TELEMETRY_PROTOCOL_VERSION = 1;
export const HEALTH_TELEMETRY_PACKET_SIZE = 32;
export const HEALTH_ACK_PACKET_SIZE = 16;

const METRIC_BY_CODE: Record<number, { kind: HealthMetricKind; scale: number }> = {
  1: { kind: 'heart-rate-bpm', scale: 1000 },
  2: { kind: 'step-count', scale: 1000 },
  3: { kind: 'cadence-spm', scale: 1000 },
  4: { kind: 'gait-symmetry-percent', scale: 1000 },
};

function bytesToHex(value: bigint): string {
  return value.toString(16).padStart(16, '0');
}

export function decodeHealthTelemetryPacket(bytes: Uint8Array): WatchHealthEvent {
  if (bytes.byteLength !== HEALTH_TELEMETRY_PACKET_SIZE) {
    throw new Error(`Invalid health packet length: ${bytes.byteLength}`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const protocolVersion = view.getUint8(0);
  const metric = METRIC_BY_CODE[view.getUint8(1)];
  const qualityPercent = view.getUint8(2);
  const sequence = view.getUint32(4, true);
  const bootSession = view.getBigUint64(8, true);
  const observedAt = view.getBigUint64(16, true);
  const valueMilli = view.getInt32(24, true);

  if (protocolVersion !== HEALTH_TELEMETRY_PROTOCOL_VERSION || !metric || qualityPercent > 100 ||
      sequence === 0 || bootSession === 0n || observedAt === 0n || observedAt > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Invalid health telemetry packet');
  }

  return {
    protocolVersion: HEALTH_TELEMETRY_PROTOCOL_VERSION,
    kind: metric.kind,
    qualityPercent,
    sequence,
    bootSessionId: bytesToHex(bootSession),
    observedAtEpochMs: Number(observedAt),
    value: valueMilli / metric.scale,
  };
}

export function decodeBase64HealthTelemetry(value: string): WatchHealthEvent {
  const binary = globalThis.atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return decodeHealthTelemetryPacket(bytes);
}

export function encodeHealthAcknowledgement(event: WatchHealthEvent): Uint8Array {
  const bytes = new Uint8Array(HEALTH_ACK_PACKET_SIZE);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, HEALTH_TELEMETRY_PROTOCOL_VERSION);
  view.setUint8(1, 1);
  view.setUint32(4, event.sequence, true);
  view.setBigUint64(8, BigInt(`0x${event.bootSessionId}`), true);
  return bytes;
}

export function encodeHealthAcknowledgementBase64(event: WatchHealthEvent): string {
  const bytes = encodeHealthAcknowledgement(event);
  return globalThis.btoa(String.fromCharCode(...bytes));
}