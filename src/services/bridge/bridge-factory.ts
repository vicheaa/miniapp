import type { SuperAppBridge } from '../../types/bridge';
import { createMockBridge } from './mock-bridge';

export interface BridgeResult {
  bridge: SuperAppBridge;
  isMock: boolean;
}

/**
 * Attempt to resolve the SuperApp bridge.
 *
 * Polls `window.superApp` every 100 ms for up to `timeoutMs` milliseconds.
 * If the real bridge is not injected in time, falls back to a mock.
 *
 * @returns A promise that resolves with the bridge and whether it is mocked.
 */
export function resolveBridge(
  mockToken: string,
  timeoutMs: number = 500,
): Promise<BridgeResult> {
  // Fast path — already available
  if (window.superApp) {
    return Promise.resolve({ bridge: window.superApp, isMock: false });
  }

  return new Promise((resolve) => {
    let elapsed = 0;
    const interval = setInterval(() => {
      if (window.superApp) {
        clearInterval(interval);
        resolve({ bridge: window.superApp, isMock: false });
        return;
      }

      elapsed += 100;
      if (elapsed >= timeoutMs) {
        clearInterval(interval);
        resolve({ bridge: createMockBridge(mockToken), isMock: true });
      }
    }, 100);
  });
}
