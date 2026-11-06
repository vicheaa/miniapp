import { create } from 'zustand';
import type { SuperAppBridge } from '../types/bridge';
import { appConfig } from '../config';

export type Language = 'en' | 'km';

export function normalizeLanguage(value: unknown): Language {
  return typeof value === 'string' && value.toLowerCase().startsWith('km') ? 'km' : 'en';
}

interface MiniAppStore {
  superApp: SuperAppBridge | null;
  authToken: string;
  sessionVersion: number;
  initParams: Record<string, unknown>;
  language: Language;
  setAuthToken: (token: string) => void;
  applyRefreshedToken: (previousToken: string, token: string, sessionVersion: number) => void;
  setLanguage: (language: string) => void;
  reset: () => void;
}

const initialState = () => ({
  superApp: null,
  authToken: '',
  initParams: {},
  language: appConfig.defaultLanguage as Language,
});

export const useMiniAppStore = create<MiniAppStore>((set) => ({
  ...initialState(),
  sessionVersion: 0,
  setAuthToken: (authToken) => set((state) => ({ authToken, sessionVersion: state.sessionVersion + 1 })),
  applyRefreshedToken: (previousToken, authToken, sessionVersion) => set((state) =>
    state.sessionVersion === sessionVersion && state.authToken === previousToken
      ? { authToken } : state),
  setLanguage: (language) => set({ language: normalizeLanguage(language) }),
  reset: () => set((state) => ({ ...initialState(), sessionVersion: state.sessionVersion + 1 })),
}));
