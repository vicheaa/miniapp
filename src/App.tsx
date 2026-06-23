import { useState, useCallback, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { useSuperApp } from './hooks/useSuperApp';
import { useMiniAppStore } from './store/miniAppStore';
import TaskListPage from './pages/workflow/TaskListPage';
import TaskDetailPage from './pages/workflow/TaskDetailPage';
import DevPanel from './components/dev/DevPanel';

// Initialize React Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

/**
 * Root application component.
 */
export default function App() {
  /* ── Auth token for standalone dev mode ──────────────────────────────── */
  const [authToken, setAuthToken] = useState<string>(() => {
    return (
      localStorage.getItem('dev_auth_token') ||
      import.meta.env.VITE_DEV_AUTH_TOKEN ||
      'mock-dev-token-value'
    );
  });

  const { bridge: superApp, isMock } = useSuperApp(authToken);

  const setSuperApp = useMiniAppStore((s) => s.setSuperApp);
  const setAuthTokenInStore = useMiniAppStore((s) => s.setAuthToken);
  const setLanguage = useMiniAppStore((s) => s.setLanguage);

  // Sync bridge and token to Zustand store when resolved
  useEffect(() => {
    if (superApp) {
      setSuperApp(superApp);

      // Initialize bridge
      superApp.ready();
      superApp.setTitle('Workflow');

      // Pull dynamic auth token if store token is empty
      const fetchToken = async () => {
        const token = useMiniAppStore.getState().authToken;
        if (!token) {
          try {
            const t = await superApp.getAuthToken();
            if (t) setAuthTokenInStore(t);
          } catch (e) {
            console.error('[App] Failed to fetch dynamic token:', e);
          }
        }
      };
      fetchToken();

      // Initialize language from bridge
      superApp
        .getLocalization()
        .then((loc) => {
          if (loc && (loc.language || loc.localization)) {
            setLanguage(loc.language || loc.localization);
          }
        })
        .catch((err) => {
          console.error('[App] Failed to fetch initial localization:', err);
        });

      // Listen for language changes from native host
      superApp.on('onLanguageChanged', (data: any) => {
        if (data && data.language) {
          setLanguage(data.language);
        }
      });
    }
  }, [superApp, setSuperApp, setLanguage, setAuthTokenInStore]);

  useEffect(() => {
    if (isMock && authToken) {
      setAuthTokenInStore(authToken);
    }
  }, [authToken, isMock, setAuthTokenInStore]);

  const handleSaveToken = useCallback((newToken: string) => {
    localStorage.setItem('dev_auth_token', newToken);
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

  /* ── Waiting for bridge and token ────────────────────────────────────── */
  if (!superApp || !storeToken) {
    return (
      <div className="font-sans max-w-[480px] mx-auto p-0 text-center pt-[100px] text-slate-400">
        <p>Loading application...</p>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <div className="relative min-h-screen">
          <div className="w-full h-screen overflow-hidden relative bg-slate-50">
            <Routes key={authToken}>
              <Route path="/" element={<TaskListPage />} />
              <Route path="/task/:taskId" element={<TaskDetailPage />} />
            </Routes>
          </div>

          {isMock && (
            <>
              <button
                onClick={handleToggleLanguage}
                style={{
                  position: 'fixed',
                  bottom: '100px',
                  right: '20px',
                  zIndex: 9999,
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  backgroundColor: '#063E89',
                  color: '#ffffff',
                  border: '2px solid rgba(255, 255, 255, 0.8)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  fontFamily: 'sans-serif',
                  transition: 'transform 0.1s active',
                }}
                title="Switch Language"
              >
                <span style={{ fontSize: '14px', marginBottom: '2px' }}>🌐</span>
                <span>{language.toUpperCase()}</span>
              </button>
{/* 
              <DevPanel
                superApp={superApp}
                authToken={authToken}
                onSaveToken={handleSaveToken}
              /> */}
            </>
          )}
        </div>
      </HashRouter>
    </QueryClientProvider>
  );
}
