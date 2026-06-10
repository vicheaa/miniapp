import { create } from 'zustand';
import type { SuperAppBridge } from '../types/bridge';
import type { WorkflowTask } from '../types/workflow';

interface WorkflowStore {
  // Bridge & Auth
  superApp: SuperAppBridge | null;
  authToken: string;
  setSuperApp: (bridge: SuperAppBridge) => void;
  setAuthToken: (token: string) => void;

  // Navigation
  view: 'task-list' | 'task-detail';
  setView: (view: 'task-list' | 'task-detail') => void;
  goBack: () => void;

  // Selection
  selectedTask: WorkflowTask | null;
  setSelectedTask: (task: WorkflowTask | null) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  superApp: null,
  authToken: '',
  setSuperApp: (bridge) => set({ superApp: bridge }),
  setAuthToken: (token) => set({ authToken: token }),

  view: 'task-list',
  setView: (view) => set({ view }),
  goBack: () => {
    const { view } = get();
    if (view === 'task-detail') {
      set({ view: 'task-list' });
    }
  },

  selectedTask: null,
  setSelectedTask: (task) => set({ selectedTask: task }),

  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
