import { useInfiniteQuery } from '@tanstack/react-query';
import { useWorkflowStore } from '../store/workflowStore';
import { useMiniAppStore } from '../store/miniAppStore';
import { fetchWorkflowTasks } from '../services/api/workflow-api';
import { useDebounce } from './useDebounce';

const PAGE_SIZE = 20;

export function useWorkflowTasksInfiniteQuery() {
  const token = useMiniAppStore((s) => s.authToken);
  const superApp = useMiniAppStore((s) => s.superApp);
  const searchQuery = useWorkflowStore((s) => s.searchQuery);
  const filter = useWorkflowStore((s) => s.filter);
  const statusFilter = useWorkflowStore((s) => s.statusFilter);
  const latest = useWorkflowStore((s) => s.latest);
  const myRequest = useWorkflowStore((s) => s.myRequest);
  const buKeys = useWorkflowStore((s) => s.buKeys);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const statuses = filter === 'COMPLETED'
    ? (statusFilter === 'ALL' ? [] : [statusFilter])
    : [];

  return useInfiniteQuery({
    queryKey: ['workflowTasks', token, debouncedSearchQuery, filter, statusFilter, latest, myRequest, buKeys],
    queryFn: async ({ pageParam = 0 }) => {
      if (!token) return { items: [], page: 0, pageSize: PAGE_SIZE, total: 0 };
      try {
        return await fetchWorkflowTasks(
          pageParam,
          PAGE_SIZE,
          filter,
          latest,
          myRequest,
          debouncedSearchQuery || undefined,
          statuses,
          buKeys
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
