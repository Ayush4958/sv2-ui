import { useQuery } from '@tanstack/react-query';
import { authFetch, AuthError } from '@/lib/auth-fetch';
import type { ContainerLogsResponse } from '@/types/log-diagnostics';

async function fetchContainerLogs(): Promise<ContainerLogsResponse | null> {
  try {
    const response = await authFetch('/api/logs/raw', {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    return response.json() as Promise<ContainerLogsResponse>;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    return null;
  }
}

export function useContainerLogs(enabled = false) {
  return useQuery({
    queryKey: ['container-logs-raw'],
    queryFn: fetchContainerLogs,
    refetchInterval: enabled ? 3000 : false,
    retry: false,
    enabled,
  });
}
