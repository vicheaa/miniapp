import { useState, useCallback, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { useSuperApp } from './hooks/useSuperApp';
import { useMiniAppStore } from './store/miniAppStore';
import { useWorkflowStore } from './store/workflowStore';
import TaskListPage from './pages/workflow/TaskListPage';
import TaskDetailPage from './pages/workflow/TaskDetailPage';
import DevPanel from './components/ui/DevPanel';
import PageTransition from './components/ui/PageTransition';
import { AppBootstrapSkeleton } from './components/ui/SkeletonLoader';
import ErrorState from './components/ui/ErrorState';
import { safeStorage } from './lib/safe-storage';
import { withTimeout } from './lib/with-timeout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

export default function App() {
  const [authToken, setAuthToken] = useState<string>(() => {
    return (
      safeStorage.getItem('dev_auth_token') ||
      import.meta.env.VITE_DEV_AUTH_TOKEN ||
      'mock-dev-token-value'
    );
  });

  const { bridge: superApp, isMock, error: bridgeError } = useSuperApp(authToken);

  const [isInitialized, setIsInitialized] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const setSuperApp = useMiniAppStore((s) => s.setSuperApp);
  const setAuthTokenInStore = useMiniAppStore((s) => s.setAuthToken);
  const setLanguage = useMiniAppStore((s) => s.setLanguage);

  useEffect(() => {
    if (superApp) {
      let cancelled = false;
      setSuperApp(superApp);
      setIsInitialized(false);
      setBootstrapError(null);
      try { superApp.ready?.(); } catch (error) { console.warn('[App] Native ready notification failed:', error); }
      try { superApp.setTitle?.('Workflow'); } catch (error) { console.warn('[App] Native title update failed:', error); }

      const initializeApp = async () => {
        try {
          // 1. Fetch token if not present
          const token = useMiniAppStore.getState().authToken;
          if (!token) {
            const t = await withTimeout(() => superApp.getAuthToken(), 10_000, 'Sign-in');
            if (cancelled) return;
            if (typeof t !== 'string' || !t.trim()) {
              throw new Error('The Super App could not sign you in. Please close the miniapp and open it again.');
            }
            setAuthTokenInStore(t);
          }

          // 2. Fetch init params
          try {
            let params = await withTimeout(() => superApp.getInitParams?.(), 5_000, 'Launch settings');
            if (cancelled) return;
            if (typeof params === 'string') {
              try {
                params = JSON.parse(params);
              } catch (e) {
                console.error('[App] Failed to parse init params string:', e);
              }
            }
            if (params && typeof params === 'object') {
              const { filter, latest, myRequest, buKeys, isFilterBtndisable, title, setTitle } = params;
              const store = useWorkflowStore.getState();
              if (filter) store.setFilter(filter);
              if (latest !== undefined && latest !== null) {
                store.setLatest(typeof latest === 'string' ? latest !== 'false' : Boolean(latest));
              }
              if (myRequest !== undefined && myRequest !== null) {
                store.setMyRequest(typeof myRequest === 'string' ? myRequest === 'true' : Boolean(myRequest));
              }
              if (buKeys !== undefined && buKeys !== null) {
                let parsedBuKeys: string[] = [];
                if (Array.isArray(buKeys)) {
                  parsedBuKeys = buKeys;
                } else if (typeof buKeys === 'string') {
                  try {
                    parsedBuKeys = buKeys.startsWith('[') ? JSON.parse(buKeys) : buKeys.split(',');
                  } catch {
                    parsedBuKeys = [buKeys];
                  }
                }
                if (parsedBuKeys.length > 0) {
                  store.setBuKeys(parsedBuKeys);
                }
              }
              if (isFilterBtndisable !== undefined && isFilterBtndisable !== null) {
                const isDisabled = isFilterBtndisable === true || isFilterBtndisable === 'true';
                store.setIsFilterBtndisable(isDisabled);
              }
              const displayTitle = setTitle || title;
              if (displayTitle) store.setTitle(displayTitle);
            }
          } catch (e) {
            console.error('[App] Failed to fetch init params:', e);
          }

          // 3. Fetch localization
          try {
            const loc = await withTimeout(() => superApp.getLocalization?.(), 5_000, 'Language settings');
            if (cancelled) return;
            if (loc && (loc.language || loc.localization)) {
              setLanguage(loc.language || loc.localization);
            }
          } catch (err) {
            console.error('[App] Failed to fetch initial localization:', err);
          }
        } catch (error) {
          if (!cancelled) setBootstrapError(error instanceof Error ? error.message : 'Unable to start Workflow. Please reopen the miniapp.');
        } finally {
          if (!cancelled) setIsInitialized(true);
        }
      };

      initializeApp();

      try {
        superApp.on?.('onLanguageChanged', (data: any) => {
          if (!cancelled && data && typeof data.language === 'string') setLanguage(data.language);
        });
      } catch (error) {
        console.warn('[App] Native language listener unavailable:', error);
      }
      return () => { cancelled = true; };
    }
  }, [superApp, setSuperApp, setLanguage, setAuthTokenInStore]);

  useEffect(() => {
    if (isMock && authToken) {
      setAuthTokenInStore(authToken);
    }
  }, [authToken, isMock, setAuthTokenInStore]);

  const handleSaveToken = useCallback((newToken: string) => {
    safeStorage.setItem('dev_auth_token', newToken);
    setAuthToken(newToken);
    setAuthTokenInStore(newToken);
  }, [setAuthTokenInStore]);

  const language = useMiniAppStore((s) => s.language);

  const handleToggleLanguage = useCallback(() => {
    const nextLang = language === 'en' ? 'km' : 'en';
    (window as any).__mockLanguage = nextLang;
    if ((window as any).triggerMockEvent) {
      (window as any).triggerMockEvent('onLanguageChanged', { language: nextLang });
    }
  }, [language]);

  const storeToken = useMiniAppStore((s) => s.authToken);
  const superAppFromStore = useMiniAppStore((s) => s.superApp);

  if (bridgeError || bootstrapError) {
    return <div className="min-h-screen flex items-center justify-center p-4"><ErrorState message={bridgeError?.message || bootstrapError!} onRetry={() => window.location.reload()} /></div>;
  }

  /* ── Waiting for bridge, token and initialization ────────────────────── */
  if (!superAppFromStore || !storeToken || !isInitialized) {
    return <AppBootstrapSkeleton />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <div className="relative min-h-screen">
          <div className="w-full h-screen overflow-hidden relative bg-gray-50">
            <PageTransition>
              <Routes key={authToken}>
                <Route path="/" element={<TaskListPage />} />
                <Route path="/task/:taskId" element={<TaskDetailPage />} />
              </Routes>
            </PageTransition>
          </div>

          {/* {isMock && superApp && (
            <DevPanel
              superApp={superApp}
              authToken={authToken}
              onSaveToken={handleSaveToken}
            />
          )} */}
        </div>
      </HashRouter>
    </QueryClientProvider>
  );
}
