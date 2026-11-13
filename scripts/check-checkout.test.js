import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampDeliveryDate, daysInMonth, deliveryParts, deliveryIso, isBackdatedDelivery, todayDeliveryIso, validDeliveryDate, validCoordinates, deliveryDisplay } from '../src/utils/delivery.ts';

test('checkout date: defaults use Cambodia today and submission is always midnight +07:00', () => {
  assert.deepEqual(deliveryParts(null, new Date('2026-11-11T18:30:00Z')), { year: 2026, month: 11, day: 12 });
  const parts = deliveryParts('2026-11-12T14:30:00+07:00');
  assert.equal(deliveryIso(parts), '2026-11-12T00:00:00+07:00');
  assert.match(deliveryDisplay(deliveryIso(parts), 'en'), /12\/11\/2026/);
  assert.doesNotMatch(deliveryDisplay(deliveryIso(parts), 'en'), /AM|PM|:/);
  assert.equal(todayDeliveryIso(new Date('2026-11-11T18:30:00Z')), '2026-11-12T00:00:00+07:00');
});

test('checkout datetime: changing months clamps days and preserves leap-day validity', () => {
  assert.equal(daysInMonth(2028, 2), 29);
  assert.equal(daysInMonth(2027, 2), 28);
  assert.equal(deliveryIso({ year: 2027, month: 2, day: 31 }), '2027-02-28T00:00:00+07:00');
  assert.equal(validDeliveryDate('2028-02-29T23:59:00+07:00'), true);
  for (const value of ['2027-02-29T00:00:00+07:00', '2026-13-01T12:00:00+07:00', '2026-11-11', '2026-11-11T25:00:00+07:00']) assert.equal(validDeliveryDate(value), false);
});

test('checkout date: calendar minimum clamps prior days, months and years without rejecting today at midnight', () => {
  const minimum = { year: 2026, month: 11, day: 11 };
  for (const parts of [{ year: 2025, month: 12, day: 31 }, { year: 2026, month: 10, day: 30 }, { year: 2026, month: 11, day: 10 }]) assert.deepEqual(clampDeliveryDate(parts, minimum), minimum);
  assert.deepEqual(clampDeliveryDate({ year: 2027, month: 2, day: 31 }, minimum), { year: 2027, month: 2, day: 28 });
  const noon = new Date('2026-11-11T12:00:00+07:00');
  assert.equal(isBackdatedDelivery('2026-11-11T00:00:00+07:00', noon), false);
  assert.equal(isBackdatedDelivery('2026-11-10T23:59:00+07:00', noon), true);
  assert.equal(isBackdatedDelivery('2026-11-12T00:00:00+07:00', noon), false);
});

test('checkout date: Cambodia day/year rollover prevents stale checkout dates from being submitted', () => {
  const beforeMidnight = new Date('2026-12-31T23:59:59+07:00');
  const afterMidnight = new Date('2027-01-01T00:00:00+07:00');
  const selected = todayDeliveryIso(beforeMidnight);
  assert.equal(selected, '2026-12-31T00:00:00+07:00');
  assert.equal(isBackdatedDelivery(selected, beforeMidnight), false);
  assert.equal(isBackdatedDelivery(selected, afterMidnight), true);
  assert.equal(todayDeliveryIso(afterMidnight), '2027-01-01T00:00:00+07:00');
});

test('checkout map coordinates: zero and geographic bounds are valid; missing/non-numeric values are not', () => {
  for (const point of [[0, 0], [90, 180], [-90, -180], [11.595, 104.89]]) assert.equal(validCoordinates(...point), true);
  for (const point of [[null, null], [undefined, 104], ['11', 104], [91, 104], [11, 181], [NaN, 104], [11, Infinity]]) assert.equal(validCoordinates(...point), false);
});
