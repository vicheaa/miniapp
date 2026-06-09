import { useState, useCallback, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSuperApp } from './hooks/useSuperApp';
import { useAssetStore } from './store/assetStore';
import SessionListPage from './pages/asset-counting/SessionListPage';
import SessionDetailPage from './pages/asset-counting/SessionDetailPage';
import ReportsPage from './pages/asset-counting/ReportsPage';
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

  const setSuperApp = useAssetStore((s) => s.setSuperApp);
  const setAuthTokenInStore = useAssetStore((s) => s.setAuthToken);

  // Sync bridge and token to Zustand store when resolved
  useEffect(() => {
    if (superApp) {
      setSuperApp(superApp);
    }
  }, [superApp, setSuperApp]);

  useEffect(() => {
    if (authToken) {
      setAuthTokenInStore(authToken);
    }
  }, [authToken, setAuthTokenInStore]);

  const handleSaveToken = useCallback((newToken: string) => {
    localStorage.setItem('dev_auth_token', newToken);
    setAuthToken(newToken);
    setAuthTokenInStore(newToken);
  }, [setAuthTokenInStore]);

  /* ── Waiting for bridge ──────────────────────────────────────────────── */
  if (!superApp) {
    return (
      <div className="font-sans max-w-[480px] mx-auto p-0 text-center pt-[100px] text-slate-400">
        <p>Waiting for SuperApp Bridge...</p>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="relative min-h-screen">
        <AssetCountingRouter key={authToken} superApp={superApp} />

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

/* ── Internal router component ─────────────────────────────────────────── */

function AssetCountingRouter({ superApp }: { superApp: NonNullable<typeof window.superApp> }) {
  const view = useAssetStore((s) => s.view);
  const selectedSession = useAssetStore((s) => s.selectedSession);
  const selectedFunction = useAssetStore((s) => s.selectedFunction);
  const token = useAssetStore((s) => s.authToken);
  const setAuthToken = useAssetStore((s) => s.setAuthToken);

  // Initialize bridge
  superApp.ready();
  superApp.setTitle('Asset Counting');

  // Pull dynamic auth token if store token is empty
  useEffect(() => {
    const fetchToken = async () => {
      if (!token) {
        try {
          const t = await superApp.getAuthToken();
          if (t) setAuthToken(t);
        } catch (e) {
          console.error('[App] Failed to fetch dynamic token:', e);
        }
      }
    };
    fetchToken();
  }, [superApp, token, setAuthToken]);

  const viewIndex = view === 'list' ? 0 : view === 'detail' ? 1 : 2;

  return (
    <div className="w-full h-screen overflow-hidden relative bg-slate-50">
      <div
        className="flex w-full h-full transition-transform duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          transform: `translate3d(-${viewIndex * 100}%, 0, 0)`,
        }}
      >
        {/* Slide 1: Session List */}
        <div className="flex-[0_0_100%] w-full h-screen box-border">
          <SessionListPage />
        </div>

        {/* Slide 2: Session Detail */}
        <div className="flex-[0_0_100%] w-full h-screen box-border">
          {selectedSession ? (
            <SessionDetailPage />
          ) : (
            <div className="p-8 text-center text-slate-400 bg-slate-50 min-h-screen">
              Waiting for session selection...
            </div>
          )}
        </div>

        {/* Slide 3: Reports */}
        <div className="flex-[0_0_100%] w-full h-screen box-border">
          {selectedSession && selectedFunction ? (
            <ReportsPage />
          ) : (
            <div className="p-8 text-center text-slate-400 bg-slate-50 min-h-screen">
              Waiting for group selection...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
