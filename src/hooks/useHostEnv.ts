import { useState, useEffect } from 'react';

interface HostEnv {
  HOST_OS: string | null;
  STRATUM_HOST: string | null;
}

function detectBrowserOs(): string | null {
  const browserPlatform = `${navigator.platform} ${navigator.userAgent}`.toLowerCase();
  if (browserPlatform.includes('mac')) return 'macos';
  if (browserPlatform.includes('linux')) return 'linux';
  return null;
}

export function useHostEnv() {
  const [hostOs, setHostOs] = useState<string | null>(null);
  const [stratumHost, setStratumHost] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/env')
      .then(res => res.json() as Promise<HostEnv>)
      .then(data => {
        if (!cancelled) {
          setHostOs(data.HOST_OS ?? detectBrowserOs());
          setStratumHost(data.STRATUM_HOST);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHostOs(detectBrowserOs());
          setIsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  return { hostOs, stratumHost, isLoading };
}
