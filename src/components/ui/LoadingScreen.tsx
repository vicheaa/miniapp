import { useTranslation } from '../../hooks/useTranslation';

export default function LoadingScreen() {
  const { t } = useTranslation();

  return (
    <main className="app-shell connection-screen">
      <div role="status" aria-label={t('global.loading')}>
        <div className="connection-dots" aria-hidden="true">
          <span /><span /><span />
        </div>
      </div>
    </main>
  );
}
