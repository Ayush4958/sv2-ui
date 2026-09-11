const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isStateChangingMethod(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}

function originComponents(value: string): { hostname: string; port: string } | null {
  try {
    const url = new URL(value);
    return { hostname: url.hostname, port: url.port };
  } catch {
    return null;
  }
}

function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
  );
}

export type OriginCheckInput = {
  method: string;
  origin: string | undefined;
  host: string | undefined;
  secFetchSite: string | undefined;
};

export function isSameOriginRequest(input: OriginCheckInput): boolean {
  if (!isStateChangingMethod(input.method)) return true;

  const site = input.secFetchSite?.toLowerCase();
  if (site) {
    return site === 'same-origin' || site === 'none';
  }

  if (!input.origin) return true;

  const origin = originComponents(input.origin);
  if (!origin) return false;

  const hostHeader = input.host;
  if (!hostHeader) return false;
  const request = originComponents(`http://${hostHeader}`);
  if (!request) return false;

  if (origin.hostname === request.hostname && origin.port === request.port) return true;

  return isLoopbackHostname(origin.hostname) && isLoopbackHostname(request.hostname);
}
