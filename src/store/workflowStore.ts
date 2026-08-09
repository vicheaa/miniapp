import { create } from 'zustand';
import type { WorkflowTask } from '../types/workflow';

export type WorkflowStatusFilter = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

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

  statusFilter: WorkflowStatusFilter;
  setStatusFilter: (statusFilter: WorkflowStatusFilter) => void;

  title: string;
  setTitle: (title: string) => void;

  latest: boolean;
  setLatest: (latest: boolean) => void;

  myRequest: boolean;
  setMyRequest: (myRequest: boolean) => void;

  isFilterBtndisable: boolean;
  setIsFilterBtndisable: (isFilterBtndisable: boolean) => void;
}

export const useWorkflowStore = create<WorkflowStore>((set) => ({
  selectedTask: null,
  setSelectedTask: (task) => set({ selectedTask: task }),

  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  filter: 'ASSIGNED',
  setFilter: (filter) => set({
    filter,
    latest: true,
    myRequest: false,
    statusFilter: 'ALL',
  }),

  statusFilter: 'ALL',
  setStatusFilter: (statusFilter) => set({ statusFilter }),

  latest: true,
  setLatest: (latest) => set({ latest }),

  myRequest: false,
  setMyRequest: (myRequest) => set({ myRequest }),

  isFilterBtndisable: false,
  setIsFilterBtndisable: (isFilterBtndisable) => set({ isFilterBtndisable }),

  title: '',
  setTitle: (title: string) => set({ title }),
}));

