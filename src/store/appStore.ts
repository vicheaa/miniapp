import { create } from 'zustand';
import type { SuperAppBridge } from '../types/bridge';

interface AppStore {
  // Bridge & Auth State
  superApp: SuperAppBridge | null;
  authToken: string;
  setSuperApp: (bridge: SuperAppBridge) => void;
  setAuthToken: (token: string) => void;

  // Navigation state (generic stack-based or simple tab/view state)
  view: string;
  setView: (view: string) => void;
  
  // Navigation stack (for back button management)
  history: string[];
  pushView: (view: string) => void;
  popView: () => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  superApp: null,
  authToken: '',
  
  setSuperApp: (bridge) => set({ superApp: bridge }),
  setAuthToken: (token) => set({ authToken: token }),

  view: 'home',
  history: ['home'],

  setView: (view) => {
    const { superApp } = get();
    if (superApp) {
      superApp.hapticFeedback?.('light');
    }
    set({ view, history: [view] });
  },

  pushView: (view) => {
    const { superApp, history } = get();
    if (superApp) {
      superApp.hapticFeedback?.('light');
    }
    set({ view, history: [...history, view] });
  },

  popView: () => {
    const { superApp, history } = get();
    if (history.length <= 1) return; // Cannot go back beyond home
    
    if (superApp) {
      superApp.hapticFeedback?.('light');
    }
    
    const newHistory = history.slice(0, -1);
    const prevView = newHistory[newHistory.length - 1];
    set({ view: prevView, history: newHistory });
  },
}));
