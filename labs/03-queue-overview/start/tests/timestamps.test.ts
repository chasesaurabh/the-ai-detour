import { test } from 'node:test';
import assert from 'node:assert/strict';
import { instant } from '../src/store.js';
test('rejects calendar rollover', () => assert.throws(() => instant('2026-02-30T12:00:00Z')));
test('accepts leap day only in leap years', () => {
  assert.equal(instant('2024-02-29T12:00:00Z'), Date.parse('2024-02-29T12:00:00Z'));
  assert.throws(() => instant('2026-02-29T12:00:00Z'));
});
test('rejects ambiguous day rollover and leap second', () => {
  assert.throws(() => instant('2026-11-21T24:00:00Z'));
  assert.throws(() => instant('2026-11-21T12:00:60Z'));
});
test('rejects unsupported precision and malformed offset', () => {
  assert.throws(() => instant('2026-11-21T12:00:00.0001Z'));
  assert.throws(() => instant('2026-11-21T12:00:00+01:60'));
});
test('equivalent offsets resolve to one instant', () => assert.equal(instant('2026-11-21T06:00:00-06:00'), instant('2026-11-21T12:00:00Z')));
