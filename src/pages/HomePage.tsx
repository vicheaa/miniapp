import { appConfig } from '../config';
import { useTranslation } from '../hooks/useTranslation';

export default function HomePage() {
  const { t } = useTranslation();
  return (
    <main className="app-shell">
      <div className="starter-card">
        <p className="text-sm font-medium text-slate-500">{appConfig.title}</p>
        <h1 className="mt-3 text-2xl font-semibold">{t('home.title')}</h1>
        <p className="mt-3 leading-7 text-slate-600">{t('home.description')}</p>
      </div>
    </main>
  );
}
