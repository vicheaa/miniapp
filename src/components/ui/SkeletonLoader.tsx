import { useTranslation } from '../../hooks/useTranslation';
import Spinner from './Spinner';

export function AppBootstrapSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center" role="status">
      <Spinner message={t('global.loading')} />
    </div>
  );
}
