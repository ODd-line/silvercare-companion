import assert from 'node:assert/strict';

import { decodeHealthTelemetryPacket, encodeHealthAcknowledgement } from './health-telemetry.ts';

const packet = new Uint8Array(32);
const view = new DataView(packet.buffer);
view.setUint8(0, 1);
view.setUint8(1, 1);
view.setUint8(2, 94);
view.setUint32(4, 1, true);
view.setBigUint64(8, 0x0102030405060708n, true);
view.setBigUint64(16, 1769052600000n, true);
view.setInt32(24, 72500, true);

const event = decodeHealthTelemetryPacket(packet);
assert.deepEqual(event, {
  protocolVersion: 1,
  kind: 'heart-rate-bpm',
  qualityPercent: 94,
  sequence: 1,
  bootSessionId: '0102030405060708',
  observedAtEpochMs: 1769052600000,
  value: 72.5,
});
assert.deepEqual([...encodeHealthAcknowledgement(event)], [
  1, 1, 0, 0, 1, 0, 0, 0, 8, 7, 6, 5, 4, 3, 2, 1,
]);

assert.throws(() => decodeHealthTelemetryPacket(packet.subarray(0, 31)), /length/);
packet[2] = 101;
assert.throws(() => decodeHealthTelemetryPacket(packet), /Invalid/);

console.log('health-telemetry contract: ok');