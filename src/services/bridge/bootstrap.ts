import { appConfig } from '../../config';
import { normalizeLanguage, useMiniAppStore } from '../../store/miniAppStore';
import type { SuperAppBridge } from '../../types/bridge';
import { withTimeout } from './timeout';

interface BootstrapOptions {
  signal: AbortSignal;
  timeoutMs?: number;
  authTimeoutMs?: number;
}

function launchParams(value: unknown): Record<string, unknown> {
  try {
    const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

function languageFrom(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const data = value as Record<string, unknown>;
  const language = data.language || data.localization;
  return typeof language === 'string' ? language : undefined;
}

/** Initialize one bridge session. The returned disposer also handles hosts with no unsubscribe. */
export async function initializeBridge(
  bridge: SuperAppBridge,
  { signal, timeoutMs = appConfig.bridgeTimeoutMs, authTimeoutMs = appConfig.authRefreshTimeoutMs }: BootstrapOptions,
): Promise<() => void> {
  const controller = new AbortController();
  const unsubscribers: (() => void)[] = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    controller.abort();
    signal.removeEventListener('abort', dispose);
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
  signal.addEventListener('abort', dispose, { once: true });
  if (signal.aborted) dispose();
  const bounded = <T>(label: string, operation: () => T | PromiseLike<T>) =>
    withTimeout(operation, timeoutMs, controller.signal, label);
  const optional = async <T>(label: string, operation: () => T | PromiseLike<T>, fallback: T): Promise<T> => {
    try { return await bounded(label, operation); }
    catch (error) {
      if (controller.signal.aborted) throw error;
      return fallback;
    }
  };
  const listen = (event: string, callback: (data: unknown) => void) => {
    const unsubscribe = bridge.on(event, callback);
    if (typeof unsubscribe === 'function') unsubscribers.push(unsubscribe);
  };

  try {
    if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    bridge.setTitle(appConfig.title);
    bridge.setPullToRefreshEnabled(appConfig.pullToRefreshEnabled);
    let eventLanguage: string | undefined;
    let eventToken: string | undefined;
    let initialized = false;
    const sessionVersion = useMiniAppStore.getState().sessionVersion;
    listen('tokenRefreshed', (data: unknown) => {
      if (disposed || !data || typeof data !== 'object') return;
      const token = (data as Record<string, unknown>).token;
      if (typeof token !== 'string' || (token !== '' && !token.trim())) return;
      const state = useMiniAppStore.getState();
      if (state.sessionVersion !== sessionVersion) return;
      if (!initialized) { eventToken = token; return; }
      if (state.superApp !== bridge) return;
      if (!token) {
        // Native cleared authentication. Invalidate private queries and the old session.
        state.reset();
      } else {
        state.applyRefreshedToken(state.authToken, token, sessionVersion);
      }
    });
    listen('onLanguageChanged', (data: unknown) => {
      if (disposed) return;
      const language = languageFrom(data);
      if (language) {
        eventLanguage = language;
        useMiniAppStore.getState().setLanguage(language);
      }
    });
    const [authToken, params, localization] = await Promise.all([
      withTimeout(() => bridge.getAuthToken(), authTimeoutMs, controller.signal, 'Authentication'),
      optional<unknown>('Launch parameters', () => bridge.getInitParams(), {}),
      optional<unknown>('Localization', () => bridge.getLocalization(), {}),
    ]);
    if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (typeof authToken !== 'string') throw new Error('The SuperApp returned an invalid auth token.');
    useMiniAppStore.setState({
      superApp: bridge,
      authToken: eventToken ?? authToken,
      initParams: launchParams(params),
      language: normalizeLanguage(eventLanguage ?? languageFrom(localization) ?? appConfig.defaultLanguage),
    });
    initialized = true;
    bridge.ready();
    return dispose;
  } catch (error) {
    dispose();
    if (!signal.aborted && useMiniAppStore.getState().superApp === bridge) {
      useMiniAppStore.getState().reset();
    }
    throw error;
  }
}
