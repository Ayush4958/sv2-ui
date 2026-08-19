import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

import {
  AGGREGATE_KEY,
  mergeMetricEntries,
  mergeShareStatsEntries,
  normalizeMetricKey,
  usePersistentBestDifficulty,
  usePersistentBlocksFound,
  usePersistentShareStats,
} from './usePersistentDashboardMetrics.js';

function withMockLocalStorage(store: Record<string, string>, run: () => void): void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      clear() {},
      getItem(key: string) {
        return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
      },
      key() {
        return null;
      },
      get length() {
        return Object.keys(store).length;
      },
      removeItem() {},
      setItem() {},
    } satisfies Storage,
  });
  try {
    run();
  } finally {
    if (previous) {
      Object.defineProperty(globalThis, 'localStorage', previous);
    } else {
      delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  }
}

test('bounds persisted rejection-reason cardinality from untrusted telemetry', () => {
  const reasonCount = 10_000;
  const rejectedByReason = Object.fromEntries(
    Array.from({ length: reasonCount }, (_, index) => [`reason-${index}`, 1]),
  );
  const storedState = JSON.stringify({
    channel: {
      acknowledged: 0,
      submitted: reasonCount,
      rejected: reasonCount,
      rejectedByReason,
    },
  });

  withMockLocalStorage({ 'sv2_share_stats:default': storedState }, () => {
    let observedReasonCount = -1;
    function Probe() {
      observedReasonCount = usePersistentShareStats([], 'default').rejectionReasons.length;
      return null;
    }

    renderToString(createElement(Probe));
    assert.ok(
      observedReasonCount < reasonCount,
      `loaded all ${reasonCount} attacker-controlled reason labels`,
    );
  });
});

test('normalizeMetricKey hashes over-length keys instead of dropping them', () => {
  const longKey = `jdc:1:extended:2:${'x'.repeat(300)}`;
  const normalized = normalizeMetricKey(longKey);
  assert.ok(normalized.startsWith('h:'), 'over-length key should be hashed');
  assert.ok(normalized.length <= 256, 'hashed key must stay short');
  assert.equal(normalizeMetricKey('short-key'), 'short-key');
  assert.equal(normalizeMetricKey(AGGREGATE_KEY), AGGREGATE_KEY);
});

test('mergeMetricEntries bounds entry count and preserves evicted totals in the aggregate bucket', () => {
  const channelCount = 300;
  const entries = Array.from({ length: channelCount }, (_, index) => ({
    key: `ch:${index}`,
    value: 1,
  }));

  const { next } = mergeMetricEntries({}, entries);
  const realKeys = Object.keys(next).filter((key) => key !== AGGREGATE_KEY);

  assert.ok(realKeys.length <= 256, `expected <=256 real keys, got ${realKeys.length}`);
  assert.ok(AGGREGATE_KEY in next, 'aggregate bucket must exist after eviction');
  const total = Object.values(next).reduce((sum, value) => sum + value, 0);
  assert.equal(total, channelCount, 'lifetime total must be preserved via the aggregate bucket');
});

test('mergeMetricEntries keeps totals monotonic across channel churn', () => {
  let state: Record<string, number> = {};
  let cumulativeSeen = 0;
  let previousTotal = 0;

  for (let batch = 0; batch < 5; batch += 1) {
    const entries = Array.from({ length: 300 }, (_, index) => ({
      key: `ch:${batch}-${index}`,
      value: 1,
    }));
    state = mergeMetricEntries(state, entries).next;
    cumulativeSeen += 300;
    const total = Object.values(state).reduce((sum, value) => sum + value, 0);
    assert.ok(total >= previousTotal, 'lifetime total must never decrease');
    previousTotal = total;
  }

  assert.equal(previousTotal, cumulativeSeen, 'every channel counted exactly once across churn');
});

test('mergeShareStatsEntries preserves lifetime totals when evicting entries', () => {
  const channelCount = 300;
  const entries = Array.from({ length: channelCount }, (_, index) => ({
    key: `ch:${index}`,
    acknowledged: 1,
    submitted: 1,
    rejected: 1,
    rejectedByReason: {},
  }));

  const { next } = mergeShareStatsEntries({}, entries);
  const realKeys = Object.keys(next).filter((key) => key !== AGGREGATE_KEY);

  assert.ok(realKeys.length <= 256, `expected <=256 real keys, got ${realKeys.length}`);
  const totalAcknowledged = Object.values(next).reduce((sum, entry) => sum + entry.acknowledged, 0);
  assert.equal(totalAcknowledged, channelCount, 'share-stats lifetime total preserved');
});

test('usePersistentBestDifficulty excludes the aggregate bucket from the max', () => {
  const storedState = JSON.stringify({
    [AGGREGATE_KEY]: 9999,
    'real:1': 5,
  });

  withMockLocalStorage({ 'sv2_best_diff:default': storedState }, () => {
    let observed = -1;
    function Probe() {
      observed = usePersistentBestDifficulty([], 'default');
      return null;
    }

    renderToString(createElement(Probe));
    assert.equal(observed, 5, 'max must exclude the aggregate bucket');
  });
});

test('usePersistentBestDifficulty computes a bounded max without a spread RangeError', () => {
  const indices = Array.from({ length: 10000 }, (_, index) => index);
  const storedState = JSON.stringify(
    Object.fromEntries(indices.map((index) => [`k:${index}`, index % 7])),
  );
  const expectedMax = Math.max(...indices.slice(-256).map((index) => index % 7));

  withMockLocalStorage({ 'sv2_best_diff:default': storedState }, () => {
    let observed = -1;
    function Probe() {
      observed = usePersistentBestDifficulty([], 'default');
      return null;
    }

    assert.doesNotThrow(() => renderToString(createElement(Probe)));
    assert.equal(observed, expectedMax, 'max of the last 256 stored entries (no spread)');
  });
});

test('usePersistentBlocksFound normalizes an oversized stored state at load', () => {
  const storedState = JSON.stringify(
    Object.fromEntries(Array.from({ length: 10000 }, (_, index) => [`k:${index}`, 1])),
  );

  withMockLocalStorage({ 'sv2_blocks_found:default': storedState }, () => {
    let observed = -1;
    function Probe() {
      observed = usePersistentBlocksFound([], 'default');
      return null;
    }

    assert.doesNotThrow(() => renderToString(createElement(Probe)));
    assert.equal(observed, 256, 'load caps the unbounded stored metric to the entry limit');
  });
});

test('usePersistentShareStats resets state when the stored payload exceeds the size limit', () => {
  const padding = 'x'.repeat(3 * 1024 * 1024);
  const storedState = JSON.stringify({
    channel: { acknowledged: 1, submitted: 1, rejected: 1, rejectedByReason: {} },
    padding,
  });

  withMockLocalStorage({ 'sv2_share_stats:default': storedState }, () => {
    let observed = undefined as ReturnType<typeof usePersistentShareStats> | undefined;
    function Probe() {
      observed = usePersistentShareStats([], 'default');
      return null;
    }

    renderToString(createElement(Probe));
    assert.equal(observed?.acknowledged, 0, 'oversized payload is discarded');
    assert.equal(observed?.rejectionReasons.length, 0);
  });
});
