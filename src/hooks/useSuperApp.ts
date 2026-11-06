import { useEffect, useState } from 'react';
import type { SuperAppBridge } from '../types/bridge';
import { resolveBridge } from '../services/bridge/bridge-factory';

interface UseSuperAppResult {
  bridge: SuperAppBridge | null;
  isMock: boolean;
  error: Error | null;
}

export function useSuperApp(mockToken: string): UseSuperAppResult {
  const [bridge, setBridge] = useState<SuperAppBridge | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    resolveBridge(mockToken).then(({ bridge: b, isMock: m }) => {
      if (!cancelled) {
        setBridge(b);
        setIsMock(m);
      }
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason : new Error('Unable to connect to the Super App.'));
    });

    return () => {
      cancelled = true;
    };
  }, [mockToken]);

  return { bridge, isMock, error };
}
