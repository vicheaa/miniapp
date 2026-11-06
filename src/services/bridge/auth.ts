import { appConfig } from '../../config';
import { useMiniAppStore } from '../../store/miniAppStore';
import { withTimeout } from './timeout';

/** Refresh tokens stay in the SuperApp. A failure leaves the caller's original 401 intact. */
export async function refreshNativeAuthToken(rejectedToken: string): Promise<string | null> {
  const { superApp, sessionVersion, authToken } = useMiniAppStore.getState();
  if (authToken !== rejectedToken) return authToken || null;
  if (typeof superApp?.refreshAuthToken !== 'function') return null;
  const controller = new AbortController();
  const unsubscribe = useMiniAppStore.subscribe((state) => {
    if (state.sessionVersion !== sessionVersion || state.superApp !== superApp) controller.abort();
  });
  try {
    const token = await withTimeout(
      () => superApp.refreshAuthToken!(rejectedToken),
      appConfig.authRefreshTimeoutMs,
      controller.signal,
      'Token refresh',
    );
    if (typeof token !== 'string' || !token.trim() || token === rejectedToken || controller.signal.aborted) return null;
    useMiniAppStore.getState().applyRefreshedToken(rejectedToken, token, sessionVersion);
    const current = useMiniAppStore.getState();
    return current.sessionVersion === sessionVersion && current.superApp === superApp
      ? current.authToken || null : null;
  } catch { return null; }
  finally { unsubscribe(); controller.abort(); }
}
