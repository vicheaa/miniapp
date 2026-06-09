import { create } from 'zustand';
import type { SuperAppBridge } from '../types/bridge';
import type { AssetCountingSession, FunctionInCharge } from '../types/asset';

interface AssetStore {
  // Bridge & Auth
  superApp: SuperAppBridge | null;
  authToken: string;
  setSuperApp: (bridge: SuperAppBridge) => void;
  setAuthToken: (token: string) => void;

  // Navigation
  view: 'list' | 'detail' | 'reports';
  setView: (view: 'list' | 'detail' | 'reports') => void;
  goBack: () => void;

  // Selection
  selectedSession: AssetCountingSession | null;
  selectedFunction: FunctionInCharge | null;
  setSelectedSession: (session: AssetCountingSession | null) => void;
  setSelectedFunction: (fn: FunctionInCharge | null) => void;

  // Search & Filter
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string;
  setStatusFilter: (filter: string) => void;
}

export const useAssetStore = create<AssetStore>((set, get) => ({
  superApp: null,
  authToken: '',
  setSuperApp: (bridge) => set({ superApp: bridge }),
  setAuthToken: (token) => set({ authToken: token }),

  view: 'list',
  setView: (view) => {
    const { superApp } = get();
    // if (superApp) superApp.hapticFeedback('light');
    set({ view });
  },
  goBack: () => {
    const { view, superApp } = get();
    // if (superApp) superApp.hapticFeedback('light');
    if (view === 'reports') {
      set({ view: 'detail' });
    } else if (view === 'detail') {
      set({ view: 'list' });
    }
  },

  selectedSession: null,
  selectedFunction: null,
  setSelectedSession: (session) => set({ selectedSession: session }),
  setSelectedFunction: (fn) => set({ selectedFunction: fn }),

  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  statusFilter: 'ALL',
  setStatusFilter: (statusFilter) => {
    const { superApp } = get();
    // if (superApp) superApp.hapticFeedback('selection');
    set({ statusFilter });
  },
}));
