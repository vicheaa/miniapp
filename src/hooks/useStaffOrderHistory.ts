import { infiniteQueryOptions, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getStaffOrderHistory } from '../services/api/order';
import { useMiniAppStore } from '../store/miniAppStore';

export function useStaffOrderHistory(page = 1) {
  const sessionVersion = useMiniAppStore((state) => state.sessionVersion);
  const history = useQuery({
    queryKey: ['staff-orders', 'history', sessionVersion, page],
    queryFn: ({ signal }) => getStaffOrderHistory(page, signal),
  });
  return { history };
}

export function infiniteStaffOrderHistoryOptions(sessionVersion: number) {
  return infiniteQueryOptions({
    queryKey: ['staff-orders', 'history', sessionVersion, 'infinite'],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => getStaffOrderHistory(pageParam, signal),
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.next && lastPage.results.length > 0 ? lastPageParam + 1 : undefined,
  });
}

export function useInfiniteStaffOrderHistory() {
  const sessionVersion = useMiniAppStore((state) => state.sessionVersion);
  const history = useInfiniteQuery(infiniteStaffOrderHistoryOptions(sessionVersion));
  return { history };
}
