import { useState, useCallback, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSuperApp } from './hooks/useSuperApp';
import { useAppStore } from './store/appStore';
import HomePage from './pages/HomePage';
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

export default function App() {
  /* ── Auth token for standalone dev mode ──────────────────────────────── */
  const [authToken, setAuthToken] = useState<string>(() => {
    return (
      localStorage.getItem('dev_auth_token') ||
      import.meta.env.VITE_DEV_AUTH_TOKEN ||
      ''
    );
  });

  const { bridge: superApp, isMock } = useSuperApp(authToken);

  const setSuperApp = useAppStore((s) => s.setSuperApp);
  const setAuthTokenInStore = useAppStore((s) => s.setAuthToken);

  // Sync bridge to store when resolved
  useEffect(() => {
    if (superApp) {
      setSuperApp(superApp);
    }
  }, [superApp, setSuperApp]);

  // Sync auth token to store
  useEffect(() => {
    setAuthTokenInStore(authToken);
  }, [authToken, setAuthTokenInStore]);

  const handleSaveToken = useCallback((newToken: string) => {
    localStorage.setItem('dev_auth_token', newToken);
    setAuthToken(newToken);
    setAuthTokenInStore(newToken);
  }, [setAuthTokenInStore]);

  /* ── Waiting for bridge ──────────────────────────────────────────────── */
  if (!superApp) {
    return (
      <div className="font-sans max-w-md mx-auto min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 p-6">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="font-semibold text-slate-600">Initializing Bridge...</p>
          <p className="text-xs text-slate-400 mt-1">Checking for SuperApp container context</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="relative min-h-screen bg-slate-50">
        {/* Router or View Controller */}
        <AppRouter superApp={superApp} />

        {/* Floating Developer Bridge Console (Only active in stand-alone browser mock mode) */}
        {isMock && (
          <DevPanel
            superApp={superApp}
            authToken={authToken}
            onSaveToken={handleSaveToken}
          />
        )}
      </div>
    </QueryClientProvider>
  );
}

/* ── App View Router ────────────────────────────────────────────────────── */

function AppRouter({ superApp }: { superApp: NonNullable<typeof window.superApp> }) {
  const view = useAppStore((s) => s.view);
  const token = useAppStore((s) => s.authToken);
  const setAuthToken = useAppStore((s) => s.setAuthToken);

  // Initialize bridge events & configuration
  useEffect(() => {
    superApp.ready();
    superApp.setTitle('MiniApp Starter');
  }, [superApp]);

  // Pull dynamic auth token if store token is empty (when running in real SuperApp)
  useEffect(() => {
    const fetchToken = async () => {
      if (!token) {
        try {
          const t = await superApp.getAuthToken();
          if (t) setAuthToken(t);
        } catch (e) {
          console.error('[AppRouter] Failed to fetch dynamic token:', e);
        }
      }
    };
    fetchToken();
  }, [superApp, token, setAuthToken]);

  // Standard sliding transition panel or simple view switcher based on AppStore.view
  return (
    <div className="w-full min-h-screen overflow-x-hidden relative">
      {view === 'home' ? (
        <HomePage />
      ) : (
        <div className="p-8 text-center text-slate-400">
          <p>Unknown view: "{view}"</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm"
          >
            Reload App
          </button>
        </div>
      )}
    </div>
  );
}
