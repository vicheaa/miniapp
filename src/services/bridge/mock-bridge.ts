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

    getInitParams: async () => {
      console.log('[Mock SuperApp] getInitParams called');
      const urlParams = new URLSearchParams(window.location.search);
      const filter = urlParams.get('filter') || 'AVAILABLE';
      const latest = urlParams.get('latest') !== 'false';
      const myRequest = urlParams.get('myRequest') !== 'false';
      return { filter, latest, myRequest };
    },

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

    setPullToRefreshEnabled: (enabled: boolean) => {
      console.log('[Mock SuperApp] setPullToRefreshEnabled called:', enabled);
    },

    hapticFeedback: (type?: string) => {
      console.log('[Mock SuperApp] hapticFeedback called:', type);
    },

    getDeviceInfo: async () => ({
      platform: 'Browser (Mock)',
      osVersion: 'DevMode',
    }),

    getLocalization: async () => {
      const currentLanguage = (window as any).__mockLanguage || 'en';
      return {
        localization: currentLanguage,
        language: currentLanguage,
      };
    },

    ready: () => {
      console.log('[Mock SuperApp] ready called');
    },

    isAvailable: () => true,

    openUrl: (url: string) => {
      console.log('[Mock SuperApp] openUrl called:', url);
      window.open(url, '_blank');
    },

    on: (event: string, cb: (data: any) => void) => {
      console.log('[Mock SuperApp] registered listener for:', event);
      if (!(window as any).__mockEventListeners) {
        (window as any).__mockEventListeners = {};
      }
      if (!(window as any).__mockEventListeners[event]) {
        (window as any).__mockEventListeners[event] = [];
      }
      (window as any).__mockEventListeners[event].push(cb);
    },
  };
}

// Global helper for DevPanel to trigger bridge listeners in standalone mock mode
if (typeof window !== 'undefined') {
  (window as any).triggerMockEvent = (event: string, data: any) => {
    console.log(`[Mock SuperApp] Simulating event trigger: ${event}`, data);
    const listeners = (window as any).__mockEventListeners?.[event];
    if (listeners) {
      listeners.forEach((cb: (d: any) => void) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`[Mock SuperApp] Error in listener for event ${event}:`, e);
        }
      });
    }
  };
}
