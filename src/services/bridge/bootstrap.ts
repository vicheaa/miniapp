import { appConfig } from '../../config';
import { normalizeLanguage, useMiniAppStore } from '../../store/miniAppStore';
import type { SuperAppBridge } from '../../types/bridge';
import { withTimeout } from './timeout';

interface BootstrapOptions {
  signal: AbortSignal;
  timeoutMs?: number;
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
  { signal, timeoutMs = appConfig.bridgeTimeoutMs }: BootstrapOptions,
): Promise<() => void> {
  const controller = new AbortController();
  let unsubscribe: void | (() => void);
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    controller.abort();
    signal.removeEventListener('abort', dispose);
    if (typeof unsubscribe === 'function') unsubscribe();
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

  try {
    if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    bridge.setTitle(appConfig.title);
    bridge.setPullToRefreshEnabled(appConfig.pullToRefreshEnabled);
    let eventLanguage: string | undefined;
    unsubscribe = bridge.on('onLanguageChanged', (data: unknown) => {
      if (disposed) return;
      const language = languageFrom(data);
      if (language) {
        eventLanguage = language;
        useMiniAppStore.getState().setLanguage(language);
      }
    });
    const [authToken, params, localization] = await Promise.all([
      bounded('Authentication', () => bridge.getAuthToken()),
      optional<unknown>('Launch parameters', () => bridge.getInitParams(), {}),
      optional<unknown>('Localization', () => bridge.getLocalization(), {}),
    ]);
    if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (typeof authToken !== 'string') throw new Error('The SuperApp returned an invalid auth token.');
    useMiniAppStore.setState({
      superApp: bridge,
      authToken,
      initParams: launchParams(params),
      language: normalizeLanguage(eventLanguage ?? languageFrom(localization) ?? appConfig.defaultLanguage),
    });
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
