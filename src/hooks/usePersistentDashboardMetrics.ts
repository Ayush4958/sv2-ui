import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface PersistedMetricEntry {
  key: string;
  value: number;
}

export interface PersistedShareStatsEntry {
  key: string;
  acknowledged: number;
  submitted: number;
  rejected: number;
  rejectedByReason?: Record<string, number>;
}

export interface PersistentShareStats {
  acknowledged: number;
  submitted: number;
  rejected: number;
  rejectionReasons: Array<{ reason: string; count: number }>;
  unclassifiedRejected: number;
}

type PersistedMetricState = Record<string, number>;
type PersistedShareStatsState = Record<string, {
  acknowledged: number;
  submitted: number;
  rejected: number;
  rejectedByReason: Record<string, number>;
}>;

function storageKeyFor(metricKey: string, configKey: string): string {
  return `sv2_${metricKey}:${configKey}`;
}

function createEmptyMetricState(): PersistedMetricState {
  return {};
}

function createEmptyShareStatsState(): PersistedShareStatsState {
  return {};
}

const MAX_SHARE_STATS_ENTRIES = 256;
const MAX_REJECTION_REASONS = 32;
const MAX_ENTRY_KEY_LENGTH = 256;
const MAX_REASON_LENGTH = 128;
const MAX_SHARE_STATS_STORAGE_LENGTH = 2 * 1024 * 1024;

// Reserved bucket that accumulates the counts of entries evicted under the
// entry-count cap so lifetime totals can never decrease.
export const AGGREGATE_KEY = '@@evicted@@';

function normalizeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

// Stable, synchronous, dependency-free hash so telemetry-derived keys that
// exceed the key-length bound can still be persisted (instead of dropped)
// under a short, predictable key.
function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function normalizeMetricKey(key: string): string {
  return key === AGGREGATE_KEY || key.length <= MAX_ENTRY_KEY_LENGTH
    ? key
    : `h:${hashString(key)}`;
}

function normalizeMetricState(value: unknown): PersistedMetricState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return createEmptyMetricState();
  }

  const source = value as Record<string, unknown>;
  const normalized: PersistedMetricState = {};

  // Preserve the aggregate bucket so lifetime totals never decrease.
  const aggregate = source[AGGREGATE_KEY];
  if (typeof aggregate === 'number' && Number.isFinite(aggregate)) {
    normalized[AGGREGATE_KEY] = Math.max(0, aggregate);
  }

  const entries = Object.entries(source)
    .filter(([key]) => key !== AGGREGATE_KEY)
    .slice(-MAX_SHARE_STATS_ENTRIES);

  entries.forEach(([key, val]) => {
    const normalizedKey = normalizeMetricKey(key);
    if (normalizedKey === AGGREGATE_KEY) return;
    const normalizedValue = normalizeCount(val);
    if (!(normalizedKey in normalized) || normalized[normalizedKey] < normalizedValue) {
      normalized[normalizedKey] = normalizedValue;
    }
  });

  return normalized;
}

function normalizeShareStatsState(value: unknown): PersistedShareStatsState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return createEmptyShareStatsState();
  }

  const source = value as Record<string, unknown>;
  const normalized: PersistedShareStatsState = {};

  // Preserve the aggregate bucket so lifetime totals never decrease.
  const storedAggregate = source[AGGREGATE_KEY];
  if (
    storedAggregate &&
    typeof storedAggregate === 'object' &&
    !Array.isArray(storedAggregate)
  ) {
    const agg = storedAggregate as Record<string, unknown>;
    const storedReasons = agg.rejectedByReason;
    normalized[AGGREGATE_KEY] = {
      acknowledged: normalizeCount(agg.acknowledged),
      submitted: normalizeCount(agg.submitted),
      rejected: normalizeCount(agg.rejected),
      rejectedByReason:
        storedReasons && typeof storedReasons === 'object' && !Array.isArray(storedReasons)
          ? Object.fromEntries(
              Object.entries(storedReasons as Record<string, unknown>).map(([reason, count]) => [
                reason,
                normalizeCount(count),
              ]),
            )
          : {},
    };
  }

  const entries = Object.entries(source)
    .filter(([key]) => key !== AGGREGATE_KEY)
    .slice(-MAX_SHARE_STATS_ENTRIES);

  entries.forEach(([key, entry]) => {
    const normalizedKey = normalizeMetricKey(key);
    if (normalizedKey === AGGREGATE_KEY) return;

    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return;
    }

    const storedEntry = entry as Record<string, unknown>;
    const storedReasons = storedEntry.rejectedByReason;
    const rejectedByReason =
      storedReasons && typeof storedReasons === 'object' && !Array.isArray(storedReasons)
        ? Object.fromEntries(
            Object.entries(storedReasons)
              .filter(([reason]) => reason.length <= MAX_REASON_LENGTH)
              .slice(-MAX_REJECTION_REASONS)
              .map(([reason, count]) => [reason, normalizeCount(count)]),
          )
        : {};

    normalized[normalizedKey] = {
      acknowledged: normalizeCount(storedEntry.acknowledged),
      submitted: normalizeCount(storedEntry.submitted),
      rejected: normalizeCount(storedEntry.rejected),
      rejectedByReason,
    };
  });

  return normalized;
}

// Pure merge used by usePersistentMetric. Bounds key length (via hashing),
// normalizes values, and enforces the entry-count cap by moving evicted
// per-key maxima into the aggregate bucket so totals stay monotonic.
export function mergeMetricEntries(
  prev: PersistedMetricState,
  entries: PersistedMetricEntry[],
): { next: PersistedMetricState; changed: boolean } {
  let changed = false;
  const next: PersistedMetricState = { ...prev };

  const boundedEntries = entries
    .map((entry) => ({ key: normalizeMetricKey(entry.key), value: entry.value }))
    .filter((entry) => entry.key !== AGGREGATE_KEY);
  const liveKeys = new Set(boundedEntries.map((entry) => entry.key));

  boundedEntries.forEach(({ key, value }) => {
    const normalizedValue = Math.max(0, value);
    if ((next[key] ?? 0) < normalizedValue) {
      next[key] = normalizedValue;
      changed = true;
    }
  });

  const evictable = Object.keys(next).filter((k) => k !== AGGREGATE_KEY);
  while (evictable.length > MAX_SHARE_STATS_ENTRIES) {
    const evictCandidate = evictable.find((k) => !liveKeys.has(k)) ?? evictable[0];
    next[AGGREGATE_KEY] = (next[AGGREGATE_KEY] ?? 0) + (next[evictCandidate] ?? 0);
    delete next[evictCandidate];
    evictable.splice(evictable.indexOf(evictCandidate), 1);
    changed = true;
  }

  return { next, changed };
}

// Pure merge used by usePersistentShareStatsEntries. Bounds key length (via
// hashing, instead of silently dropping) and enforces the entry-count cap by
// folding evicted counts into the aggregate share-stats bucket.
export function mergeShareStatsEntries(
  prev: PersistedShareStatsState,
  entries: PersistedShareStatsEntry[],
): { next: PersistedShareStatsState; changed: boolean } {
  let changed = false;
  const next: PersistedShareStatsState = { ...prev };

  const boundedEntries = entries
    .map((entry) => ({ ...entry, key: normalizeMetricKey(entry.key) }))
    .filter((entry) => entry.key !== AGGREGATE_KEY);
  const incomingEntryKeys = new Set(boundedEntries.map((entry) => entry.key));

  boundedEntries.forEach((entry) => {
    const existing = next[entry.key];
    const realKeyCount = Object.keys(next).filter((k) => k !== AGGREGATE_KEY).length;
    if (!existing && realKeyCount >= MAX_SHARE_STATS_ENTRIES) {
      const evictable = Object.keys(next).filter((k) => k !== AGGREGATE_KEY);
      const keyToEvict = evictable.find((k) => !incomingEntryKeys.has(k)) ?? evictable[0];
      const evicted = next[keyToEvict];
      if (evicted) {
        const aggregate = next[AGGREGATE_KEY] ?? {
          acknowledged: 0,
          submitted: 0,
          rejected: 0,
          rejectedByReason: {},
        };
        aggregate.acknowledged += evicted.acknowledged;
        aggregate.submitted += evicted.submitted;
        aggregate.rejected += evicted.rejected;
        for (const [reason, count] of Object.entries(evicted.rejectedByReason)) {
          aggregate.rejectedByReason[reason] = (aggregate.rejectedByReason[reason] ?? 0) + count;
        }
        next[AGGREGATE_KEY] = aggregate;
        delete next[keyToEvict];
        changed = true;
      }
    }

    const current = existing ?? {
      acknowledged: 0,
      submitted: 0,
      rejected: 0,
      rejectedByReason: {},
    };
    const rejectedByReason = { ...current.rejectedByReason };

    const incomingReasons = Object.entries(entry.rejectedByReason ?? {})
      .filter(([reason]) => reason.length <= MAX_REASON_LENGTH)
      .slice(-MAX_REJECTION_REASONS);
    const incomingReasonNames = new Set(incomingReasons.map(([reason]) => reason));

    for (const [reason, count] of incomingReasons) {
      const normalizedCount = Math.max(0, count);
      if ((rejectedByReason[reason] ?? 0) < normalizedCount) {
        if (
          !(reason in rejectedByReason) &&
          Object.keys(rejectedByReason).length >= MAX_REJECTION_REASONS
        ) {
          const reasons = Object.keys(rejectedByReason);
          const reasonToEvict =
            reasons.find((candidate) => !incomingReasonNames.has(candidate)) ?? reasons[0];
          delete rejectedByReason[reasonToEvict];
        }
        rejectedByReason[reason] = normalizedCount;
        changed = true;
      }
    }

    const nextEntry = {
      acknowledged: Math.max(current.acknowledged, Math.max(0, entry.acknowledged)),
      submitted: Math.max(current.submitted, Math.max(0, entry.submitted)),
      rejected: Math.max(current.rejected, Math.max(0, entry.rejected)),
      rejectedByReason,
    };

    if (
      nextEntry.acknowledged !== current.acknowledged ||
      nextEntry.submitted !== current.submitted ||
      nextEntry.rejected !== current.rejected
    ) {
      changed = true;
    }

    next[entry.key] = nextEntry;
  });

  return { next, changed };
}

function loadFromStorage<T>(
  metricKey: string,
  configKey: string,
  createInitialState: () => T,
  normalizeState?: (value: unknown) => T,
  maxStoredLength = Number.POSITIVE_INFINITY,
): T {
  try {
    const stored = localStorage.getItem(storageKeyFor(metricKey, configKey));
    if (stored) {
      if (stored.length > maxStoredLength) return createInitialState();
      const parsed = JSON.parse(stored) as unknown;
      return normalizeState ? normalizeState(parsed) : (parsed as T);
    }
  } catch {
    // Ignore parse errors and start fresh.
  }

  return createInitialState();
}

function usePersistentState<T>(
  metricKey: string,
  configKey: string,
  createInitialState: () => T,
  normalizeState?: (value: unknown) => T,
  maxStoredLength?: number,
): [T, (updater: (prev: T) => T) => void] {
  const [state, setState] = useState<T>(
    () => loadFromStorage(metricKey, configKey, createInitialState, normalizeState, maxStoredLength),
  );

  const storageKeyRef = useRef<string>(storageKeyFor(metricKey, configKey));

  useEffect(() => {
    storageKeyRef.current = storageKeyFor(metricKey, configKey);
    setState(loadFromStorage(metricKey, configKey, createInitialState, normalizeState, maxStoredLength));
  }, [configKey, metricKey, createInitialState, maxStoredLength, normalizeState]);

  const updateState = useCallback((updater: (prev: T) => T) => {
    setState((prev) => {
      const next = updater(prev);

      if (Object.is(next, prev)) {
        return prev;
      }

      try {
        localStorage.setItem(storageKeyRef.current, JSON.stringify(next));
      } catch {
        // Ignore storage errors (private browsing quota, etc.)
      }

      return next;
    });
  }, []);

  return [state, updateState];
}

function usePersistentMetric(
  entries: PersistedMetricEntry[],
  configKey: string,
  metricKey: string,
): PersistedMetricState {
  const [persistedCounts, updatePersistedCounts] = usePersistentState(
    metricKey,
    configKey,
    createEmptyMetricState,
    normalizeMetricState,
    MAX_SHARE_STATS_STORAGE_LENGTH,
  );

  useEffect(() => {
    if (entries.length === 0) return;

    updatePersistedCounts((prev) => {
      const { next, changed } = mergeMetricEntries(prev, entries);
      return changed ? next : prev;
    });
  }, [entries, updatePersistedCounts]);

  return persistedCounts;
}

function usePersistentShareStatsEntries(
  entries: PersistedShareStatsEntry[],
  configKey: string,
): PersistedShareStatsState {
  const [persistedStats, updatePersistedStats] = usePersistentState(
    'share_stats',
    configKey,
    createEmptyShareStatsState,
    normalizeShareStatsState,
    MAX_SHARE_STATS_STORAGE_LENGTH,
  );

  useEffect(() => {
    if (entries.length === 0) return;

    updatePersistedStats((prev) => {
      const { next, changed } = mergeShareStatsEntries(prev, entries);
      return changed ? next : prev;
    });
  }, [entries, updatePersistedStats]);

  return persistedStats;
}

export function usePersistentBlocksFound(
  entries: PersistedMetricEntry[],
  configKey: string,
): number {
  const persistedCounts = usePersistentMetric(entries, configKey, 'blocks_found');

  return useMemo(
    () => Object.values(persistedCounts).reduce((sum, count) => sum + count, 0),
    [persistedCounts],
  );
}

export function usePersistentBestDifficulty(
  entries: PersistedMetricEntry[],
  configKey: string,
): number {
  const persistedCounts = usePersistentMetric(entries, configKey, 'best_diff');

  return useMemo(
    () =>
      Object.entries(persistedCounts).reduce(
        (max, [key, value]) => (key === AGGREGATE_KEY ? max : Math.max(max, value)),
        0,
      ),
    [persistedCounts],
  );
}

export function usePersistentShareStats(
  entries: PersistedShareStatsEntry[],
  configKey: string,
): PersistentShareStats {
  const persistedStats = usePersistentShareStatsEntries(entries, configKey);

  return useMemo(() => {
    const rejectedByReason = new Map<string, number>();
    let acknowledged = 0;
    let submitted = 0;
    let rejected = 0;

    Object.values(persistedStats).forEach((entry) => {
      acknowledged += entry.acknowledged;
      submitted += entry.submitted;
      rejected += entry.rejected;

      for (const [reason, count] of Object.entries(entry.rejectedByReason)) {
        rejectedByReason.set(reason, (rejectedByReason.get(reason) ?? 0) + count);
      }
    });

    const rejectionReasons = [...rejectedByReason.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
    const classifiedRejected = rejectionReasons.reduce((sum, item) => sum + item.count, 0);

    return {
      acknowledged,
      submitted,
      rejected,
      rejectionReasons,
      unclassifiedRejected: Math.max(0, rejected - classifiedRejected),
    };
  }, [persistedStats]);
}
