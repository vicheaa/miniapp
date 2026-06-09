import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../store/appStore';
import { request } from '../services/api/http-client';

/**
 * Fetch basic user info from the SuperApp bridge.
 */
export function useUserInfoQuery() {
  const superApp = useAppStore((s) => s.superApp);

  return useQuery({
    queryKey: ['userInfo', !!superApp],
    queryFn: async () => {
      if (!superApp) return null;
      return await superApp.getUserInfo();
    },
    enabled: !!superApp,
  });
}

/**
 * Example Query showing how to perform authenticated fetch calls.
 * 
 * Replace this template with actual endpoint calls.
 */
export function useExampleDataQuery() {
  const token = useAppStore((s) => s.authToken);
  const superApp = useAppStore((s) => s.superApp);

  return useQuery({
    queryKey: ['exampleData', token],
    queryFn: async () => {
      if (!token) return [];
      try {
        // Example: fetches from backend via Vite/SuperApp proxy
        return await request('/api/v1/example-endpoint', {}, token);
      } catch (err) {
        if (superApp) {
          superApp.showToast('Failed to fetch data');
        }
        throw err;
      }
    },
    enabled: !!token,
  });
}

/**
 * Example Mutation showing how to perform mutations (POST/PUT/DELETE).
 */
export function useExampleMutation() {
  const token = useAppStore((s) => s.authToken);
  const superApp = useAppStore((s) => s.superApp);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { name: string }) => {
      return await request(
        '/api/v1/example-endpoint',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        token
      );
    },
    onSuccess: () => {
      if (superApp) {
        superApp.showToast('Item created successfully!');
      }
      // Invalidate queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['exampleData'] });
    },
    onError: (err) => {
      if (superApp) {
        superApp.showDialog({
          title: 'Error',
          message: err.message || 'Failed to submit data',
        });
      }
    },
  });
}
