import { useTranslatorHealth, useJdcHealth, usePoolData } from './usePoolData';
import { useSetupStatus } from './useSetupStatus';

export interface ConnectionStatus {
  status: 'connected' | 'connecting' | 'disconnected';
  statusLabel: string | null;
  poolName: string | null;
  uptime: number;
}

type ResolveConnectionStatusOptions = {
  isHealthLoading: boolean;
  servicesHealthy: boolean;
  isOrchestrated: boolean;
  isRunning: boolean;
  isSovereignSolo: boolean;
  activePoolIndex: number | null;
};

export function resolveConnectionStatus({
  isHealthLoading,
  servicesHealthy,
  isOrchestrated,
  isRunning,
  isSovereignSolo,
  activePoolIndex,
}: ResolveConnectionStatusOptions): ConnectionStatus['status'] {
  const hasConfirmedPool = !isOrchestrated || isSovereignSolo || activePoolIndex !== null;
  const isPoolConnected = servicesHealthy && hasConfirmedPool;
  const isAwaitingPool = isOrchestrated && isRunning && !isSovereignSolo && activePoolIndex === null;

  if (isHealthLoading || isAwaitingPool) return 'connecting';
  return isPoolConnected ? 'connected' : 'disconnected';
}

/**
 * Single source of truth for header connection status.
 * Use this in any page that renders <Shell> to keep the indicator consistent.
 */
export function useConnectionStatus(): ConnectionStatus {
  const {
    isOrchestrated,
    isRunning,
    miningMode,
    mode: templateMode,
    poolName,
    activePoolIndex,
  } = useSetupStatus();
  const { isJdMode, global: poolGlobal } = usePoolData(templateMode);

  const { data: translatorOk, isLoading: translatorHealthLoading, isError: translatorHealthError } =
    useTranslatorHealth();
  const { data: jdcOk, isLoading: jdcHealthLoading, isError: jdcHealthError } =
    useJdcHealth(isJdMode);

  const translatorHealthy = translatorOk === true && !translatorHealthError;
  const jdcHealthy        = jdcOk === true && !jdcHealthError;
  const isHealthLoading   = translatorHealthLoading || (isJdMode && jdcHealthLoading);
  const isSovereignSolo   = miningMode === 'solo' && templateMode === 'jd';
  const servicesHealthy   = isJdMode ? (translatorHealthy && jdcHealthy) : translatorHealthy;
  const hasConfirmedPool  = !isOrchestrated || isSovereignSolo || activePoolIndex !== null;
  const isPoolConnected   = servicesHealthy && hasConfirmedPool;
  const status = resolveConnectionStatus({
    isHealthLoading,
    servicesHealthy,
    isOrchestrated,
    isRunning,
    isSovereignSolo,
    activePoolIndex,
  });

  return {
    status,
    statusLabel: isSovereignSolo ? 'Mining services healthy' : null,
    poolName: isPoolConnected ? (poolName ?? null) : null,
    uptime:   isPoolConnected ? (poolGlobal?.uptime_secs ?? 0) : 0,
  };
}
