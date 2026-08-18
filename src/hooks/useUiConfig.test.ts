import assert from 'node:assert/strict';
import test from 'node:test';
import { hslToHex, parseHslTriplet } from './useUiConfig.js';

test('parseHslTriplet accepts the canonical single-space form', () => {
  assert.deepEqual(parseHslTriplet('190 100% 45%'), { h: 190, s: 100, l: 45 });
});

test('parseHslTriplet accepts repeated spaces (validation and parsing agree)', () => {
  assert.deepEqual(parseHslTriplet('190  100%  45%'), { h: 190, s: 100, l: 45 });
});

test('parseHslTriplet accepts tab-separated values', () => {
  assert.deepEqual(parseHslTriplet('190\t100%\t45%'), { h: 190, s: 100, l: 45 });
});

test('parseHslTriplet trims surrounding whitespace', () => {
  assert.deepEqual(parseHslTriplet('  190 100% 45%  '), { h: 190, s: 100, l: 45 });
});

test('parseHslTriplet rejects malformed values', () => {
  assert.equal(parseHslTriplet('190 100%'), null);
  assert.equal(parseHslTriplet('abc 100% 45%'), null);
  assert.equal(parseHslTriplet('190 100% 45% extra'), null);
  assert.equal(parseHslTriplet(''), null);
  assert.equal(parseHslTriplet(null), null);
  assert.equal(parseHslTriplet(undefined), null);
});

test('parseHslTriplet rejects out-of-range values', () => {
  assert.equal(parseHslTriplet('400 100% 45%'), null, 'hue above 360');
  assert.equal(parseHslTriplet('190 150% 45%'), null, 'saturation above 100');
  assert.equal(parseHslTriplet('190 100% 150%'), null, 'lightness above 100');
  assert.equal(parseHslTriplet('-1 100% 45%'), null, 'negative hue');
  assert.equal(parseHslTriplet('190 -5% 45%'), null, 'negative saturation');
});

test('parseHslTriplet accepts boundary values', () => {
  assert.deepEqual(parseHslTriplet('360 0% 0%'), { h: 360, s: 0, l: 0 });
  assert.deepEqual(parseHslTriplet('0 100% 100%'), { h: 0, s: 100, l: 100 });
});

test('hslToHex returns a valid hex string for the canonical form', () => {
  assert.match(hslToHex('190 100% 45%'), /^#[0-9a-f]{6}$/);
});

test('hslToHex does not produce NaN colors for tab or repeated-space input', () => {
  assert.match(hslToHex('190\t100%\t45%'), /^#[0-9a-f]{6}$/);
  assert.match(hslToHex('190  100%  45%'), /^#[0-9a-f]{6}$/);
});

test('hslToHex falls back to a safe color for invalid input', () => {
  assert.equal(hslToHex('garbage'), '#000000');
  assert.equal(hslToHex('400 100% 45%'), '#000000');
  assert.equal(hslToHex(''), '#000000');
});
