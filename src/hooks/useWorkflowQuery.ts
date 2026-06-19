import { useInfiniteQuery } from '@tanstack/react-query';
import { useWorkflowStore } from '../store/workflowStore';
import { useMiniAppStore } from '../store/miniAppStore';
import { fetchWorkflowTasks } from '../services/api/workflow-api';
import { useDebounce } from './useDebounce';

const PAGE_SIZE = 20;

/**
 * Infinite-scroll query for workflow tasks.
 */
export function useWorkflowTasksInfiniteQuery() {
  const token = useMiniAppStore((s) => s.authToken);
  const superApp = useMiniAppStore((s) => s.superApp);
  const searchQuery = useWorkflowStore((s) => s.searchQuery);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  return useInfiniteQuery({
    queryKey: ['workflowTasks', token, debouncedSearchQuery],
    queryFn: async ({ pageParam = 0 }) => {
      if (!token) return { items: [], page: 0, pageSize: PAGE_SIZE, total: 0 };
      try {
        return await fetchWorkflowTasks(
          pageParam,
          PAGE_SIZE,
          undefined,
          undefined,
          undefined,
          debouncedSearchQuery || undefined
        );
      } catch (err: any) {
        if (superApp) {
          superApp.showToast(err.message);
        }
        throw err;
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.reduce((acc, p) => acc + p.items.length, 0);
      if (loadedCount < lastPage.total && lastPage.items.length > 0) {
        return allPages.length;
      }
      return undefined;
    },
    enabled: !!token,
  });
}
