import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useAssetStore } from '../store/assetStore';
import {
  fetchSessions,
  fetchFunctionInCharges,
  fetchReports,
} from '../services/api/asset-api';

/**
 * Fetch list of asset counting sessions.
 */
export function useSessionsQuery() {
  const token = useAssetStore((s) => s.authToken);
  const superApp = useAssetStore((s) => s.superApp);

  return useQuery({
    queryKey: ['sessions', token],
    queryFn: async () => {
      if (!token) return [];
      try {
        return await fetchSessions(token);
      } catch (err) {
        if (superApp) {
          superApp.showToast('Failed to fetch sessions');
        }
        throw err;
      }
    },
    enabled: !!token,
  });
}

/**
 * Fetch group breakdown progress for a given session.
 */
export function useFunctionInChargesQuery(sessionId?: number | null) {
  const token = useAssetStore((s) => s.authToken);

  return useQuery({
    queryKey: ['functionInCharges', sessionId, token],
    queryFn: async () => {
      if (!token || !sessionId) return [];
      return await fetchFunctionInCharges(token, sessionId);
    },
    enabled: !!token && !!sessionId,
  });
}

/**
 * Fetch assets/reports paginated lists with infinite scrolling.
 */
export function useReportsInfiniteQuery(
  sessionId?: number | null,
  functionId?: number | null,
) {
  const token = useAssetStore((s) => s.authToken);

  return useInfiniteQuery({
    queryKey: ['reports', sessionId, functionId, token],
    queryFn: async ({ pageParam = 1 }) => {
      if (!token || !sessionId || !functionId) {
        return { items: [], total: 0 };
      }
      return await fetchReports(token, sessionId, functionId, pageParam, 20);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.reduce((acc, page) => acc + page.items.length, 0);
      if (loadedCount < lastPage.total && lastPage.items.length > 0) {
        return allPages.length + 1;
      }
      return undefined;
    },
    enabled: !!token && !!sessionId && !!functionId,
  });
}

/**
 * Fetch user info from the SuperApp bridge.
 */
export function useUserInfoQuery() {
  const superApp = useAssetStore((s) => s.superApp);

  return useQuery({
    queryKey: ['userInfo', !!superApp],
    queryFn: async () => {
      if (!superApp) return null;
      return await superApp.getUserInfo();
    },
    enabled: !!superApp,
  });
}

