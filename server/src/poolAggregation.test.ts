import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BRAIINS_POOL_ADDRESS,
  BRAIINS_POOL_AUTHORITY_KEY,
  shouldAggregateTranslatorChannels,
} from '@sv2-ui/shared';
import type { PoolConfig } from '@sv2-ui/shared';

function braiinsPool(overrides: Partial<PoolConfig> = {}): PoolConfig {
  return {
    name: 'Braiins Pool',
    address: BRAIINS_POOL_ADDRESS,
    port: 3333,
    authority_public_key: BRAIINS_POOL_AUTHORITY_KEY,
    user_identity: 'miner.worker',
    ...overrides,
  };
}

test('shouldAggregateTranslatorChannels matches the strict Braiins identity', () => {
  assert.equal(shouldAggregateTranslatorChannels(braiinsPool()), true);
});

test('shouldAggregateTranslatorChannels ignores case in the address', () => {
  assert.equal(
    shouldAggregateTranslatorChannels(braiinsPool({ address: BRAIINS_POOL_ADDRESS.toUpperCase() })),
    true,
  );
});

test('shouldAggregateTranslatorChannels rejects a wrong authority key', () => {
  assert.equal(
    shouldAggregateTranslatorChannels(braiinsPool({ authority_public_key: 'not-the-braiins-key' })),
    false,
    'a Braiins address with a forged key must not aggregate',
  );
});

test('shouldAggregateTranslatorChannels rejects a wrong address', () => {
  assert.equal(
    shouldAggregateTranslatorChannels(braiinsPool({ address: 'pool.example.com' })),
    false,
    'the correct key on a non-Braiins address must not aggregate',
  );
});

test('shouldAggregateTranslatorChannels rejects a null pool', () => {
  assert.equal(shouldAggregateTranslatorChannels(null), false);
});
