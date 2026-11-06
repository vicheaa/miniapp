import { appConfig } from '../../config';
import type { SuperAppBridge } from '../../types/bridge';

interface ResolveOptions {
  signal: AbortSignal;
  timeoutMs?: number;
}

/** Resolve only the native bridge. Development fallback is owned by useSuperApp. */
export function resolveBridge({ signal, timeoutMs = appConfig.bridgeTimeoutMs }: ResolveOptions): Promise<SuperAppBridge> {
  return new Promise((resolve, reject) => {
    let poll: ReturnType<typeof setInterval> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      clearInterval(poll);
      clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(signal.reason ?? new DOMException('Cancelled', 'AbortError'));
    };
    const check = () => {
      const bridge = typeof window !== 'undefined' ? window.superApp : undefined;
      if (bridge) {
        cleanup();
        resolve(bridge);
        return true;
      }
      return false;
    };
    if (signal.aborted) { onAbort(); return; }
    signal.addEventListener('abort', onAbort, { once: true });
    if (check()) return;
    poll = setInterval(check, Math.min(100, timeoutMs));
    timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Unable to connect to the SuperApp. Open this mini-app inside the SuperApp, then retry.'));
    }, timeoutMs);
  });
}
