import assert from 'node:assert/strict';

import { buildHealthTwin } from './health-twin-model.ts';

const event = (value, day, quality = 90) => ({
  metric_kind: 'heart-rate-bpm',
  observed_at: `2026-09-${String(day).padStart(2, '0')}T08:00:00Z`,
  value,
  quality_percent: quality,
});

assert.equal(buildHealthTwin([]).state, 'no-data');
assert.equal(buildHealthTwin([event(70, 1), event(71, 2)]).state, 'building-baseline');

const steady = buildHealthTwin([70, 71, 69, 70, 71, 72, 70].map((value, index) => event(value, index + 1)));
assert.equal(steady.state, 'steady');
assert.equal(steady.metrics[0].sampleCount, 7);

const review = buildHealthTwin([70, 70, 69, 71, 90, 92, 91].map((value, index) => event(value, index + 1)));
assert.equal(review.state, 'review');
assert.ok(review.metrics[0].deviationPercent > 15);

assert.equal(buildHealthTwin([event(200, 1, 20)]).state, 'no-data');
console.log('health-twin contract: ok');