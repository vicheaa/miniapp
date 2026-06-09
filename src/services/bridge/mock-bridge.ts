import type { SuperAppBridge } from '../../types/bridge';

/**
 * Create a mock SuperApp bridge for standalone development.
 *
 * All methods log to the console and use browser-native fallbacks
 * (e.g. `window.confirm` for dialogs, `alert` for toasts).
 */
export function createMockBridge(token: string): SuperAppBridge {
  return {
    getAuthToken: async () => token,

    getUserInfo: async () => ({
      name: 'Dev User',
      username: 'dev_user',
      email: 'dev@example.com',
    }),

    scanQR: async () => {
      console.log('[Mock SuperApp] scanQR called');
      return { success: true, code: 'MOCK-QR-CODE-12345' };
    },

    showDialog: async (opts) => {
      console.log('[Mock SuperApp] showDialog called:', opts);
      const confirmed = window.confirm(
        `${opts.title || 'Dialog'}\n\n${opts.message || ''}`,
      );
      return { confirmed };
    },

    showToast: (message: string) => {
      console.log('[Mock SuperApp] showToast called:', message);
      alert(`[Toast] ${message}`);
    },

    close: () => {
      console.log('[Mock SuperApp] close called');
      alert('[Mock SuperApp] App close requested');
    },

    setTitle: (title: string) => {
      console.log('[Mock SuperApp] setTitle called:', title);
      document.title = title;
    },

    hapticFeedback: (type?: string) => {
      console.log('[Mock SuperApp] hapticFeedback called:', type);
    },

    getDeviceInfo: async () => ({
      platform: 'Browser (Mock)',
      osVersion: 'DevMode',
    }),

    ready: () => {
      console.log('[Mock SuperApp] ready called');
    },

    isAvailable: () => true,

    on: (event: string, _cb: (data: any) => void) => {
      console.log('[Mock SuperApp] registered listener for:', event);
    },
  };
}
