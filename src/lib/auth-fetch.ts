import { notifyAuthExpired } from '@/lib/auth-events';

export class AuthError extends Error {
  constructor() {
    super('Authentication required');
    this.name = 'AuthError';
  }
}

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status === 401) {
    notifyAuthExpired();
    throw new AuthError();
  }
  return response;
}
