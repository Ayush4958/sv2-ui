import assert from 'node:assert/strict';
import test from 'node:test';

import type { PoolConfig } from '@sv2-ui/shared';
import {
  SRI_POOL_AUTHORITY_KEY,
  buildSriIdentity,
  getCompatiblePoolIdentity,
  getPoolIdentityError,
  getSriIdentityError,
  getSriIdentitySummary,
  getWorkerNameError,
  normalizePoolPriorityIdentities,
  normalizeSriIdentity,
  parseSriIdentity,
} from './miningIdentity';

const MAINNET_ADDRESS = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
const STANDARD_POOL: PoolConfig = {
  name: 'Standard Pool',
  address: 'pool.example.com',
  port: 3333,
  authority_public_key: 'standard-key',
  user_identity: MAINNET_ADDRESS,
};
const SRI_POOL: PoolConfig = {
  ...STANDARD_POOL,
  name: 'SRI Pool',
  authority_public_key: SRI_POOL_AUTHORITY_KEY,
  user_identity: `sri/solo/${MAINNET_ADDRESS}/worker1`,
};

test('getSriIdentityError accepts a valid solo identity', () => {
  assert.equal(getSriIdentityError(`sri/solo/${MAINNET_ADDRESS}/worker1`, 'mainnet'), null);
});

test('getSriIdentityError rejects a solo identity with an invalid embedded address', () => {
  assert.match(getSriIdentityError('sri/solo/not-a-bitcoin-address/worker1', 'mainnet') ?? '', /invalid bitcoin address/i);
});

test('getSriIdentityError accepts a valid partial donation identity', () => {
  assert.equal(getSriIdentityError(`sri/donate/25/${MAINNET_ADDRESS}/worker1`, 'mainnet'), null);
});

test('getSriIdentityError rejects a partial donation identity with an invalid embedded address', () => {
  assert.match(getSriIdentityError('sri/donate/25/not-a-bitcoin-address/worker1', 'mainnet') ?? '', /invalid bitcoin address/i);
});

test('getSriIdentityError accepts full donation identities without a payout address', () => {
  assert.equal(getSriIdentityError('sri/donate', 'mainnet'), null);
  assert.equal(getSriIdentityError('sri/donate/worker1', 'mainnet'), null);
});

test('normalizeSriIdentity converts a payout address to a zero donation SRI identity', () => {
  assert.equal(normalizeSriIdentity(MAINNET_ADDRESS), `sri/solo/${MAINNET_ADDRESS}`);
});

test('getSriIdentityError avoids exposing internal identity syntax', () => {
  assert.equal(
    getSriIdentityError(MAINNET_ADDRESS, 'mainnet'),
    'Enter a Bitcoin payout address, or set donation to 100% to donate the full reward',
  );
});

test('getSriIdentitySummary avoids exposing internal identity syntax', () => {
  assert.equal(
    getSriIdentitySummary(`sri/solo/${MAINNET_ADDRESS}/worker1`),
    `${MAINNET_ADDRESS}, worker worker1, 0% donation`,
  );
  assert.equal(getSriIdentitySummary('sri/donate'), 'Full reward donated, 100% donation');
});

test('getCompatiblePoolIdentity converts between standard and SRI solo identity formats', () => {
  assert.equal(
    getCompatiblePoolIdentity(SRI_POOL, STANDARD_POOL, 'solo'),
    MAINNET_ADDRESS,
  );
  assert.equal(
    getCompatiblePoolIdentity(STANDARD_POOL, SRI_POOL, 'solo'),
    `sri/solo/${MAINNET_ADDRESS}`,
  );
});

test('getCompatiblePoolIdentity does not leak a full-donation identity to another solo pool', () => {
  assert.equal(
    getCompatiblePoolIdentity({ ...SRI_POOL, user_identity: 'sri/donate' }, STANDARD_POOL, 'solo'),
    '',
  );
});

test('normalizePoolPriorityIdentities updates inherited fallback identities but preserves overrides', () => {
  const nextPrimary = { ...STANDARD_POOL, user_identity: 'new-primary.worker' };
  const inheritedFallback = { ...STANDARD_POOL, address: 'fallback.example.com' };
  const customFallback = {
    ...STANDARD_POOL,
    address: 'custom-fallback.example.com',
    user_identity: 'custom.worker',
  };

  const result = normalizePoolPriorityIdentities(
    [nextPrimary, inheritedFallback, customFallback],
    STANDARD_POOL,
    'pool',
  );

  assert.equal(result[1].user_identity, 'new-primary.worker');
  assert.equal(result[2].user_identity, 'custom.worker');
});

test('normalizePoolPriorityIdentities preserves fallback payout addresses during full donation', () => {
  const previousPrimary = {
    ...SRI_POOL,
    user_identity: `sri/donate/25/${MAINNET_ADDRESS}/worker1`,
  };
  const nextPrimary = {
    ...SRI_POOL,
    user_identity: 'sri/donate/worker1',
  };
  const fallback = {
    ...STANDARD_POOL,
    address: 'fallback.example.com',
    user_identity: MAINNET_ADDRESS,
  };

  const result = normalizePoolPriorityIdentities(
    [nextPrimary, fallback],
    previousPrimary,
    'solo',
  );

  assert.equal(result[1].user_identity, MAINNET_ADDRESS);
});

test('buildSriIdentity preserves "/" in worker names (no silent rewrite)', () => {
  const identity = buildSriIdentity('', 'rig/1', 100);
  const parsed = parseSriIdentity(identity);

  assert.equal(parsed.donationPercent, 100);
  assert.equal(parsed.address, '');
  assert.equal(parsed.workerName, 'rig/1');
});

test('buildSriIdentity preserves "/" in solo worker names', () => {
  assert.equal(
    buildSriIdentity(MAINNET_ADDRESS, 'rig/1', 0),
    `sri/solo/${MAINNET_ADDRESS}/rig/1`,
  );
});

test('getSriIdentityError rejects an SRI identity whose worker name contains "/"', () => {
  assert.match(
    getSriIdentityError(`sri/solo/${MAINNET_ADDRESS}/rig/1`, 'mainnet') ?? '',
    /worker name must not contain/i,
  );
  assert.match(
    getSriIdentityError(`sri/donate/rig/1`, 'mainnet') ?? '',
    /worker name must not contain/i,
  );
  assert.match(
    getSriIdentityError(`sri/donate/25/${MAINNET_ADDRESS}/rig/1`, 'mainnet') ?? '',
    /worker name must not contain/i,
  );
});

test('buildSriIdentity neutralizes a worker name that would inject SRI payout fields', () => {
  // A worker like `25/<address>` at 100% donation would otherwise be
  // reinterpreted by the SRI parser as a 25% partial-donation identity. The
  // builder strips slashes only in that dangerous `<pct>/` shape so the worker
  // label can never overwrite payout fields, while leaving `rig/1` intact.
  const identity = buildSriIdentity('', `25/${MAINNET_ADDRESS}`, 100);
  assert.equal(identity, `sri/donate/25${MAINNET_ADDRESS}`);
  const parsed = parseSriIdentity(identity);
  assert.equal(parsed.donationPercent, 100);
  assert.equal(parsed.address, '');
  assert.equal(parsed.workerName, `25${MAINNET_ADDRESS}`);
});

test('getWorkerNameError rejects a worker name containing "/" before it can be saved', () => {
  assert.match(
    getWorkerNameError(`25/${MAINNET_ADDRESS}`) ?? '',
    /worker name must not contain/i,
  );
});

test('normalizeSriIdentity does not silently rewrite a worker name containing "/"', () => {
  const identity = `sri/solo/${MAINNET_ADDRESS}/rig/1`;
  assert.equal(normalizeSriIdentity(identity), identity);
});

test('getPoolIdentityError (SRI) blocks Continue/Save while the worker name is invalid', () => {
  const pool: PoolConfig = {
    ...SRI_POOL,
    user_identity: `sri/solo/${MAINNET_ADDRESS}/rig/1`,
  };
  assert.match(
    getPoolIdentityError(pool, 'solo', 'mainnet') ?? '',
    /worker name must not contain/i,
  );
});

test('getPoolIdentityError (SRI) blocks a "/" worker supplied as the raw name, even when neutralized in the identity', () => {
  const neutralizedPool: PoolConfig = {
    ...SRI_POOL,
    user_identity: `sri/donate/25${MAINNET_ADDRESS}`,
  };
  assert.match(
    getPoolIdentityError(neutralizedPool, 'solo', 'mainnet', `25/${MAINNET_ADDRESS}`) ?? '',
    /worker name must not contain/i,
  );
});

test('editing the payout address while the worker name is invalid still carries the address into the identity', () => {
  const identity = buildSriIdentity('bc1qnewaddress', 'rig/1', 0);
  const parsed = parseSriIdentity(identity);
  assert.equal(parsed.address, 'bc1qnewaddress');
  assert.equal(parsed.workerName, 'rig/1');
});

test('editing the donation percent while the worker name is invalid still carries the percent into the identity', () => {
  const identity = buildSriIdentity(MAINNET_ADDRESS, 'rig/1', 25);
  const parsed = parseSriIdentity(identity);
  assert.equal(parsed.donationPercent, 25);
  assert.equal(parsed.workerName, 'rig/1');
});

test('buildSriIdentity preserves normal worker names', () => {
  assert.equal(
    buildSriIdentity('bc1q...', 'worker1', 0),
    'sri/solo/bc1q.../worker1',
  );
});

test('getWorkerNameError rejects names containing "/"', () => {
  assert.equal(getWorkerNameError('25/bc1qattacker'), 'Worker name must not contain "/"');
  assert.equal(getWorkerNameError('a/b'), 'Worker name must not contain "/"');
});

test('getWorkerNameError accepts normal worker names', () => {
  assert.equal(getWorkerNameError('worker1'), null);
  assert.equal(getWorkerNameError(''), null);
});
