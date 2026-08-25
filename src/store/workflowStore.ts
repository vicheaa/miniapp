import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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

  buKeys: string[];
  setBuKeys: (buKeys: string[]) => void;

  isFilterBtndisable: boolean;
  setIsFilterBtndisable: (isFilterBtndisable: boolean) => void;
}

export const useWorkflowStore = create<WorkflowStore>()(
  persist(
    (set) => ({
      selectedTask: null,
      setSelectedTask: (task) => set({ selectedTask: task }),

      searchQuery: '',
      setSearchQuery: (searchQuery) => set({ searchQuery }),

      filter: 'ASSIGNED',
      setFilter: (filter) =>
        set({
          filter,
          statusFilter: 'ALL',
        }),

      statusFilter: 'ALL',
      setStatusFilter: (statusFilter) => set({ statusFilter }),

      latest: true,
      setLatest: (latest) => set({ latest }),

      myRequest: false,
      setMyRequest: (myRequest) => set({ myRequest }),

      buKeys: ['PR'],
      setBuKeys: (buKeys) => set({ buKeys }),

      isFilterBtndisable: false,
      setIsFilterBtndisable: (isFilterBtndisable) => set({ isFilterBtndisable }),

      title: '',
      setTitle: (title: string) => set({ title }),
    }),
    {
      name: 'workflow-filter-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        filter: state.filter,
        statusFilter: state.statusFilter,
        searchQuery: state.searchQuery,
        latest: state.latest,
        myRequest: state.myRequest,
        buKeys: state.buKeys,
        title: state.title,
        isFilterBtndisable: state.isFilterBtndisable,
      }),
    }
  )
);
