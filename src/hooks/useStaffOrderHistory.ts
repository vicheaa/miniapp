import { useQuery } from '@tanstack/react-query';
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
