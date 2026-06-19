import { create } from 'zustand';
import type { SuperAppBridge } from '../types/bridge';
import enTranslations from '../../assets/lang/en.json';
import kmTranslations from '../../assets/lang/km.json';

const translationsMap: Record<string, any> = {
  en: enTranslations,
  km: kmTranslations,
};

interface MiniAppStore {
  // Bridge & Auth
  superApp: SuperAppBridge | null;
  authToken: string;
  setSuperApp: (bridge: SuperAppBridge) => void;
  setAuthToken: (token: string) => void;

  // Localization
  language: string;
  translations: any;
  setLanguage: (lang: string) => void;
}

export const useMiniAppStore = create<MiniAppStore>((set) => ({
  superApp: null,
  authToken: '',
  setSuperApp: (bridge) => set({ superApp: bridge }),
  setAuthToken: (token) => set({ authToken: token }),

  language: 'en',
  translations: enTranslations,
  setLanguage: (lang) => {
    const cleanLang = lang.toLowerCase().startsWith('km') ? 'km' : 'en';
    set({
      language: cleanLang,
      translations: translationsMap[cleanLang] || enTranslations,
    });
  },
}));
