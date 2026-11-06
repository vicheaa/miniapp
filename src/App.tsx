import { lazy, Suspense, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter } from 'react-router-dom';
import { appConfig } from './config';
import { useSuperApp } from './hooks/useSuperApp';
import { useTranslation } from './hooks/useTranslation';
import { useMiniAppStore } from './store/miniAppStore';
import AppRoutes from './router';

const DevPanel = import.meta.env.DEV
  ? lazy(() => import('./components/ui/DevPanel'))
  : null;

export default function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { refetchOnWindowFocus: false, retry: false, staleTime: 5 * 60_000 },
      mutations: { retry: false },
    },
  }));
  const session = useSuperApp();
  const sessionVersion = useMiniAppStore((state) => state.sessionVersion);
  const { t, language } = useTranslation();

  useEffect(() => { document.title = appConfig.title; }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => {
    void queryClient.cancelQueries();
    queryClient.clear();
  }, [queryClient, sessionVersion]);

  if (session.status === 'loading') {
    return <main className="app-shell" role="status"><p className='font-inter'>{t('global.loading')}</p></main>;
  }
  if (session.status === 'error') {
    return (
      <main className="app-shell">
        <div className="starter-card" role="alert">
          <h1 className="text-xl font-semibold">{t('global.connectionError')}</h1>
          <p className="my-4 text-slate-600">{session.error}</p>
          <button className="action-button" onClick={session.retry}>{t('global.retry')}</button>
        </div>
      </main>
    );
  }
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AppRoutes />
        {DevPanel && session.mock && (
          <Suspense fallback={null}><DevPanel controller={session.mock} /></Suspense>
        )}
      </HashRouter>
    </QueryClientProvider>
  );
}
