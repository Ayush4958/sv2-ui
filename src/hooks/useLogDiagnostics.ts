import { useQuery } from '@tanstack/react-query';
import { authFetch, AuthError } from '@/lib/auth-fetch';
import type { LogDiagnosticsResponse } from '@/types/log-diagnostics';

async function fetchLogDiagnostics(): Promise<LogDiagnosticsResponse | null> {
  try {
    const response = await authFetch('/api/logs/diagnostics', {
      signal: AbortSignal.timeout(2500),
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    if (error instanceof AuthError) throw error;
    return null;
  }
}

export function useLogDiagnostics(enabled = true) {
  return useQuery({
    queryKey: ['log-diagnostics'],
    queryFn: fetchLogDiagnostics,
    refetchInterval: enabled ? 3000 : false,
    retry: false,
    enabled,
  });
}
