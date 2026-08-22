import type { PoolConfig } from './types.js';

export const BRAIINS_POOL_AUTHORITY_KEY = '9awtMD5KQgvRUh2yFbjVeT7b6hjipWcAsQHd6wEhgtDT9soosna';
export const BRAIINS_POOL_ADDRESS = 'stratum.braiins.com';

// Aggregation is derived from the authenticated pool identity, not a
// user-controlled name. A pool only aggregates translator channels when it
// strictly matches Braiins on BOTH address and authority public key, so a
// spoofed single field (address OR key) can no longer trigger the behavior.
export function shouldAggregateTranslatorChannels(pool: PoolConfig | null): boolean {
  if (!pool) return false;
  return (
    pool.address.trim().toLowerCase() === BRAIINS_POOL_ADDRESS &&
    pool.authority_public_key === BRAIINS_POOL_AUTHORITY_KEY
  );
}

export function shouldAggregateTranslatorChannelsForPools(
  pools: readonly (PoolConfig | null | undefined)[],
): boolean {
  return pools.some((pool) => shouldAggregateTranslatorChannels(pool ?? null));
}

export function isFullDonationIdentity(userIdentity: string): boolean {
  return userIdentity === 'sri/donate' || /^sri\/donate\/[^/]+$/.test(userIdentity);
}
