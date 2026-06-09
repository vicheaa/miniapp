import { useEffect, useState } from 'react';
import type { SuperAppBridge } from '../types/bridge';
import { resolveBridge } from '../services/bridge/bridge-factory';

interface UseSuperAppResult {
  bridge: SuperAppBridge | null;
  isMock: boolean;
}

/**
 * Hook that resolves the SuperApp bridge.
 *
 * On mount it polls for the native `window.superApp` injection;
 * if not found within 500 ms it falls back to a mock bridge that
 * uses the supplied `mockToken` for authentication.
 */
export function useSuperApp(mockToken: string): UseSuperAppResult {
  const [bridge, setBridge] = useState<SuperAppBridge | null>(
    window.superApp ?? null,
  );
  const [isMock, setIsMock] = useState(false);

  useEffect(() => {
    // If already resolved (e.g. SSR pre-set), skip
    if (window.superApp) {
      setBridge(window.superApp);
      setIsMock(false);
      return;
    }

    let cancelled = false;

    resolveBridge(mockToken).then(({ bridge: b, isMock: m }) => {
      if (!cancelled) {
        setBridge(b);
        setIsMock(m);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [mockToken]);

  return { bridge, isMock };
}
