import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveConnectionStatus } from './useConnectionStatus.js';

test('does not report a configured pool as connected before SV2 setup succeeds', () => {
  assert.equal(resolveConnectionStatus({
    isHealthLoading: false,
    servicesHealthy: true,
    isOrchestrated: true,
    isRunning: true,
    isSovereignSolo: false,
    activePoolIndex: null,
  }), 'connecting');
});

test('reports connected only after an orchestrated pool is confirmed', () => {
  assert.equal(resolveConnectionStatus({
    isHealthLoading: false,
    servicesHealthy: true,
    isOrchestrated: true,
    isRunning: true,
    isSovereignSolo: false,
    activePoolIndex: 2,
  }), 'connected');
});

test('keeps standalone monitoring compatible without an active pool index', () => {
  assert.equal(resolveConnectionStatus({
    isHealthLoading: false,
    servicesHealthy: true,
    isOrchestrated: false,
    isRunning: false,
    isSovereignSolo: false,
    activePoolIndex: null,
  }), 'connected');
});
