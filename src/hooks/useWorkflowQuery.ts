import { useInfiniteQuery } from '@tanstack/react-query';
import { useWorkflowStore } from '../store/workflowStore';
import { fetchWorkflowTasks } from '../services/api/workflow-api';

const PAGE_SIZE = 20;

/**
 * Infinite-scroll query for workflow tasks.
 */
export function useWorkflowTasksInfiniteQuery() {
  const token = useWorkflowStore((s) => s.authToken);
  const superApp = useWorkflowStore((s) => s.superApp);

  return useInfiniteQuery({
    queryKey: ['workflowTasks', token],
    queryFn: async ({ pageParam = 0 }) => {
      if (!token) return { items: [], page: 0, pageSize: PAGE_SIZE, total: 0 };
      try {
        return await fetchWorkflowTasks(token, pageParam, PAGE_SIZE);
      } catch (err) {
        if (superApp) {
          superApp.showToast('Failed to fetch workflow tasks');
        }
        throw err;
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.reduce((acc, p) => acc + p.items.length, 0);
      if (loadedCount < lastPage.total && lastPage.items.length > 0) {
        return allPages.length; // next page index (0-based)
      }
      return undefined;
    },
    enabled: !!token,
  });
}
