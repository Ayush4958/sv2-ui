import assert from 'node:assert/strict';
import test from 'node:test';

import { SOLO_POOLS, knownPoolToConfig, getKnownPoolForConfig } from './pools';
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
    address: 'stratum.ckpool.org',
    port: 3336,
    authority_public_key: '9anrRNhBh7869XtNnFcCuGBRZP51E635qGbu457J5kHdszhfRc3',
    user_identity: '',
  });
  assert.equal(
    `stratum2+tcp://${ckPool.address}:${ckPool.port}/${ckPool.authority_public_key}`,
    'stratum2+tcp://stratum.ckpool.org:3336/9anrRNhBh7869XtNnFcCuGBRZP51E635qGbu457J5kHdszhfRc3',
  );
  assert.equal(isValidPoolAuthorityPubkey(ckPool.authority_public_key), true);
  assert.equal(ckPool.monogram, 'CK');
  assert.equal(ckPool.logoUrl, undefined);
});

test('an unverified display name cannot establish trusted pool identity', () => {
  const attackerSuppliedConfig = {
    name: 'Braiins Pool',
    address: 'attacker.example',
    port: 3333,
    authority_public_key: '',
  };

  assert.equal(getKnownPoolForConfig(attackerSuppliedConfig), null,
    'a user-controlled name alone must not grant official pool branding');
});

test('correct address and port with wrong authority key must not receive official branding', () => {
  const wrongAuthorityConfig = {
    name: 'Braiins Pool',
    address: 'stratum.braiins.com',
    port: 3333,
    authority_public_key: '1111111111111111111111111111111111111111111111111111111111111111',
  };

  assert.equal(getKnownPoolForConfig(wrongAuthorityConfig), null,
    'an official endpoint with a forged authority key must not receive official pool branding');
});
