import { useState, useCallback, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter } from 'react-router-dom';
import { useSuperApp } from './hooks/useSuperApp';
import { useMiniAppStore } from './store/miniAppStore';
import AppRoutes from './router';
import DevPanel from './components/ui/DevPanel';
import PageTransition from './components/ui/PageTransition';
import { AppBootstrapSkeleton } from './components/ui/SkeletonLoader';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: false, staleTime: 5 * 60 * 1000 },
  },
});

export default function App() {
  const [authToken, setAuthToken] = useState(() =>
    import.meta.env.DEV
      ? localStorage.getItem('dev_auth_token') || import.meta.env.VITE_DEV_AUTH_TOKEN || 'mock-dev-token'
      : 'mock-dev-token',
  );
  const { bridge, isMock } = useSuperApp(authToken);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!bridge) return;
    let active = true;
    setIsInitialized(false);
    const store = useMiniAppStore.getState();
    store.setSuperApp(bridge);
    store.setAuthToken('');
    store.setInitParams({});
    bridge.setTitle('POS Apps');
    bridge.setPullToRefreshEnabled(false);

    const initialize = async () => {
      // Each capability is optional for startup; a failure must not leave the app loading forever.
      await Promise.all([
        bridge.getAuthToken().then((token) => {
          if (active) store.setAuthToken(token);
        }).catch((error) => console.error('[App] Failed to get auth token:', error)),
        bridge.getInitParams().then((value) => {
          const params = typeof value === 'string' ? JSON.parse(value) : value;
          if (active && params && typeof params === 'object' && !Array.isArray(params)) {
            store.setInitParams(params);
          }
        }).catch((error) => console.error('[App] Failed to get launch parameters:', error)),
        bridge.getLocalization().then((locale) => {
          const language = locale?.language || locale?.localization;
          if (active && language) store.setLanguage(language);
        }).catch((error) => console.error('[App] Failed to get localization:', error)),
      ]);
      if (active) {
        setIsInitialized(true);
        bridge.ready();
      }
    };

    void initialize();
    const unsubscribe = bridge.on('onLanguageChanged', (data: { language?: string }) => {
      if (active && data?.language) store.setLanguage(data.language);
    });
    return () => {
      active = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [bridge]);

  const handleSaveToken = useCallback((token: string) => {
    localStorage.setItem('dev_auth_token', token);
    setAuthToken(token);
    useMiniAppStore.getState().setAuthToken(token);
    queryClient.clear();
  }, []);

  if (!bridge || !isInitialized) return <AppBootstrapSkeleton />;

  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <div className="relative min-h-screen bg-gray-50">
          <PageTransition><AppRoutes /></PageTransition>
          {import.meta.env.DEV && isMock && (
            <DevPanel superApp={bridge} authToken={authToken} onSaveToken={handleSaveToken} />
          )}
        </div>
      </HashRouter>
    </QueryClientProvider>
  );
}
