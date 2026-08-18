import assert from 'node:assert/strict';
import test from 'node:test';
import { hslToHex, isImageDataUrl, parseHslTriplet, validateLogoFile } from './useUiConfig.js';

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

test('isImageDataUrl accepts base64 image data URLs', () => {
  assert.equal(isImageDataUrl('data:image/png;base64,iVBORw0KGgo='), true);
  assert.equal(isImageDataUrl('data:image/svg+xml;base64,PHN2Zz4='), true);
  assert.equal(isImageDataUrl('data:image/jpeg;base64,/9j/4AAQ'), true);
});

test('isImageDataUrl rejects non-image or malformed values', () => {
  assert.equal(isImageDataUrl('data:text/plain;base64,abc'), false);
  assert.equal(isImageDataUrl('data:image/png,notbase64'), false);
  assert.equal(isImageDataUrl(''), false);
  assert.equal(isImageDataUrl(null), false);
  assert.equal(isImageDataUrl(undefined), false);
  assert.equal(isImageDataUrl(42), false);
});

test('validateLogoFile rejects empty or non-image input', async () => {
  assert.deepEqual(await validateLogoFile(null), { ok: false, error: 'No file selected.' });
  assert.deepEqual(
    await validateLogoFile({ size: 0, type: 'image/png' } as unknown as File),
    { ok: false, error: 'The selected file is empty.' },
  );
  assert.deepEqual(
    await validateLogoFile({ size: 10, type: 'text/plain' } as unknown as File),
    { ok: false, error: 'Please choose an image file (PNG, JPG, SVG, or GIF).' },
  );
});

test('validateLogoFile accepts a real image type', async () => {
  assert.deepEqual(
    await validateLogoFile({ size: 10, type: 'image/png' } as unknown as File),
    { ok: true },
  );
});
