import { useCallback, useEffect, useState } from 'react';
import type { SuperAppBridge } from '../types/bridge';
import type { MockBridgeController } from '../services/bridge/mock-bridge';
import { resolveBridge } from '../services/bridge/bridge-factory';
import { initializeBridge } from '../services/bridge/bootstrap';
import { useMiniAppStore } from '../store/miniAppStore';
import { appConfig } from '../config';

interface BridgeState {
  status:   'loading' | 'ready' | 'error';
  bridge:   SuperAppBridge | null;
  mock:     MockBridgeController | null;
  error:    string | null;
}

const loading: BridgeState = { status: 'loading', bridge: null, mock: null, error: null };

function developmentToken(): string {
  if (!import.meta.env.DEV) return '';
  try { return sessionStorage.getItem('dev_auth_token') ?? import.meta.env.VITE_DEV_AUTH_TOKEN ?? ''; }
  catch { return import.meta.env.VITE_DEV_AUTH_TOKEN ?? ''; }
}

/** Mount once at the application root. Retries create a fresh, cancellable session. */
export function useSuperApp() {
  const [attempt, setAttempt]   = useState(0);
  const [state, setState]       = useState<BridgeState>(loading);
  const retry = useCallback(()  => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let dispose: (() => void) | undefined;
    setState(loading);
    useMiniAppStore.getState().reset();

    const connect = async () => {
      try {
        let bridge: SuperAppBridge;
        let mock: MockBridgeController | null = null;
        try {
          bridge = await resolveBridge({
            signal: controller.signal,
            timeoutMs: import.meta.env.DEV
              ? appConfig.developmentBridgeTimeoutMs
              : appConfig.bridgeTimeoutMs,
          });
        } catch (error) {
          if (controller.signal.aborted) throw error;
          if (import.meta.env.DEV) {
            const { createMockBridge } = await import('../services/bridge/mock-bridge');
            if (controller.signal.aborted) return;
            mock = createMockBridge(developmentToken());
            bridge = mock.bridge;
          } else { throw error; }
        }
        dispose = await initializeBridge(bridge, { signal: controller.signal });
        if (controller.signal.aborted) { dispose(); return; }
        setState({ status: 'ready', bridge, mock, error: null });
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({
            status: 'error', bridge: null, mock: null,
            error: error instanceof Error ? error.message : 'Unable to initialize the mini-app. Please retry.',
          });
        }
      }
    };
    void connect();
    return () => { controller.abort(); dispose?.(); };
  }, [attempt]);

  return { ...state, retry };
}
