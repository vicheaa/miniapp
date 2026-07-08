import { create } from 'zustand';
import type { WorkflowTask } from '../types/workflow';

interface WorkflowStore {
  // Selection
  selectedTask: WorkflowTask | null;
  setSelectedTask: (task: WorkflowTask | null) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Filter
  filter: 'AVAILABLE' | 'ASSIGNED' | 'COMPLETED';
  setFilter: (filter: 'AVAILABLE' | 'ASSIGNED' | 'COMPLETED') => void;

  latest: boolean;
  setLatest: (latest: boolean) => void;

  myRequest: boolean;
  setMyRequest: (myRequest: boolean) => void;
}

export const useWorkflowStore = create<WorkflowStore>((set) => ({
  selectedTask: null,
  setSelectedTask: (task) => set({ selectedTask: task }),

  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  filter: 'AVAILABLE',
  setFilter: (filter) => set({
    filter,
    latest: true,
    myRequest: filter === 'COMPLETED' ? true : false,
  }),

  latest: true,
  setLatest: (latest) => set({ latest }),

  myRequest: false,
  setMyRequest: (myRequest) => set({ myRequest }),
}));
