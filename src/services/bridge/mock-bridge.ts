import type { SuperAppBridge } from '../../types/bridge';
import type { Language } from '../../store/miniAppStore';

export interface MockBridgeController {
  bridge: SuperAppBridge;
  setToken: (token: string) => void;
  setLanguage: (language: Language) => void;
  emit: (event: string, data: unknown) => void;
}

/** Browser-only implementation, imported behind import.meta.env.DEV. */
export function createMockBridge(initialToken = ''): MockBridgeController {
  let token = initialToken;
  let language: Language = 'en';
  const listeners = new Map<string, Set<(data: unknown) => void>>();
  const emit = (event: string, data: unknown) => {
    listeners.get(event)?.forEach((callback) => callback(data));
  };
  const bridge: SuperAppBridge = {
    getAuthToken: async () => token,
    getUserInfo: async () => ({ name: 'Dev User', username: 'dev_user', email: 'dev@example.com' }),
    getInitParams: async () => {
      const hashQuery = window.location.hash.split('?')[1] || '';
      return Object.fromEntries([
        ...new URLSearchParams(hashQuery),
        ...new URLSearchParams(window.location.search),
      ]);
    },
    scanQR: async () => ({ success: true, code: 'MOCK-QR-CODE-12345' }),
    showDialog: async ({ title = 'Dialog', message = '' }) => ({
      confirmed: window.confirm(`${title}\n\n${message}`),
    }),
    showToast: (message) => window.alert(`[Mock SuperApp] ${message}`),
    close: () => window.alert('[Mock SuperApp] App close requested'),
    setTitle: (title) => { document.title = title; },
    setPullToRefreshEnabled: (enabled) => console.info('[Mock SuperApp] pull-to-refresh:', enabled),
    hapticFeedback: (type) => console.info('[Mock SuperApp] haptic feedback:', type),
    getDeviceInfo: async () => ({ platform: 'Browser (Mock)', osVersion: 'Development' }),
    getLocalization: async () => ({ language, localization: language }),
    ready: () => console.info('[Mock SuperApp] ready'),
    isAvailable: () => true,
    openUrl: (url) => { window.open(url, '_blank', 'noopener,noreferrer'); },
    openPrinterSettings: async () => ({ success: false, message: 'Native printer settings are unavailable in the browser.' }),
    printText: async (text) => {
      console.info('[Mock SuperApp] print preview:', text);
      return { success: false, message: 'Browser preview only; no printer is connected.' };
    },
    on: (event, callback) => {
      let callbacks = listeners.get(event);
      if (!callbacks) { callbacks = new Set(); listeners.set(event, callbacks); }
      callbacks.add(callback);
      return () => {
        callbacks.delete(callback);
        if (!callbacks.size) listeners.delete(event);
      };
    },
  };
  return {
    bridge, emit,
    setToken: (value) => { token = value; },
    setLanguage: (value) => {
      language = value;
      emit('onLanguageChanged', { language });
    },
  };
}
