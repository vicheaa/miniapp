import { create } from 'zustand';
import type { WorkflowTask } from '../types/workflow';

interface WorkflowStore {
  // Selection
  selectedTask: WorkflowTask | null;
  setSelectedTask: (task: WorkflowTask | null) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const useWorkflowStore = create<WorkflowStore>((set) => ({
  selectedTask: null,
  setSelectedTask: (task) => set({ selectedTask: task }),

  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
