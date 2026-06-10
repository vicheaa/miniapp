import { useState, useCallback, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSuperApp } from './hooks/useSuperApp';
import { useWorkflowStore } from './store/workflowStore';
import TaskListPage from './pages/workflow/TaskListPage';
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

  const setSuperApp = useWorkflowStore((s) => s.setSuperApp);
  const setAuthTokenInStore = useWorkflowStore((s) => s.setAuthToken);

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
        <WorkflowRouter key={authToken} superApp={superApp} />

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

function WorkflowRouter({ superApp }: { superApp: NonNullable<typeof window.superApp> }) {
  const view = useWorkflowStore((s) => s.view);
  const selectedTask = useWorkflowStore((s) => s.selectedTask);
  const token = useWorkflowStore((s) => s.authToken);
  const setAuthToken = useWorkflowStore((s) => s.setAuthToken);

  // Initialize bridge
  superApp.ready();
  superApp.setTitle('Workflow');

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

  const viewIndex = view === 'task-list' ? 0 : 1;

  return (
    <div className="w-full h-screen overflow-hidden relative bg-slate-50">
      <div
        className="flex w-full h-full transition-transform duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          transform: `translate3d(-${viewIndex * 100}%, 0, 0)`,
        }}
      >
        {/* Slide 1: Task List */}
        <div className="flex-[0_0_100%] w-full h-screen box-border">
          <TaskListPage />
        </div>

        {/* Slide 2: Task Detail (placeholder for future) */}
        <div className="flex-[0_0_100%] w-full h-screen box-border">
          {selectedTask ? (
            <div className="p-6 bg-slate-50 min-h-screen">
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <h2 className="text-[18px] font-bold text-slate-900 mb-2">{selectedTask.taskName}</h2>
                <p className="text-[13px] text-slate-500">{selectedTask.instanceInfo.processName}</p>
                <p className="text-[13px] text-slate-400 mt-1">Business Key: {selectedTask.instanceInfo.businessKey}</p>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 bg-slate-50 min-h-screen">
              Waiting for task selection...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
