type AuthExpiredListener = () => void;

const listeners = new Set<AuthExpiredListener>();

export function onAuthExpired(callback: AuthExpiredListener): () => void {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}

export function notifyAuthExpired(): void {
  for (const listener of listeners) {
    listener();
  }
}
