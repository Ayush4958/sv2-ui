import assert from 'node:assert/strict';
import test from 'node:test';

import { SOLO_POOLS, knownPoolToConfig } from './pools';
import { isValidPoolAuthorityPubkey } from './utils';

test('solo pool presets are sorted alphabetically', () => {
  const names = SOLO_POOLS.map((pool) => pool.name);

  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
});

test('CKPool preset matches its SV2 solo endpoint', () => {
  const ckPool = SOLO_POOLS.find((pool) => pool.id === 'ckpool');

  assert.ok(ckPool);
  assert.deepEqual(knownPoolToConfig(ckPool), {
    name: 'CKPool',
    address: 'sv2solo.ckpool.org',
    port: 3336,
    authority_public_key: '9anrRNhBh7869XtNnFcCuGBRZP51E635qGbu457J5kHdszhfRc3',
    user_identity: '',
  });
  assert.equal(
    `stratum2+tcp://${ckPool.address}:${ckPool.port}/${ckPool.authority_public_key}`,
    'stratum2+tcp://sv2solo.ckpool.org:3336/9anrRNhBh7869XtNnFcCuGBRZP51E635qGbu457J5kHdszhfRc3',
  );
  assert.equal(isValidPoolAuthorityPubkey(ckPool.authority_public_key), true);
  assert.equal(ckPool.monogram, 'CK');
  assert.equal(ckPool.logoUrl, undefined);
});
