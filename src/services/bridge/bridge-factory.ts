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
 * Mock credentials are used only during standalone development.
 *
 * @returns A promise that resolves with the bridge and whether it is mocked.
 */
export function resolveBridge(
  mockToken: string,
  timeoutMs: number = import.meta.env.DEV ? 500 : 15_000,
  allowMock: boolean = import.meta.env.DEV,
): Promise<BridgeResult> {
  // Fast path — already available
  if (window.superApp && typeof window.superApp.getAuthToken === 'function') {
    return Promise.resolve({ bridge: window.superApp, isMock: false });
  }

  return new Promise((resolve, reject) => {
    const started = Date.now();
    const interval = setInterval(() => {
      if (window.superApp && typeof window.superApp.getAuthToken === 'function') {
        clearInterval(interval);
        resolve({ bridge: window.superApp, isMock: false });
        return;
      }

      if (Date.now() - started >= timeoutMs) {
        clearInterval(interval);
        if (allowMock) {
          resolve({ bridge: createMockBridge(mockToken), isMock: true });
        } else {
          reject(new Error('Unable to connect to the Super App. Please close the miniapp and open it again.'));
        }
      }
    }, 100);
  });
}
