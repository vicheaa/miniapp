import { useId, type ReactNode } from 'react';
import { NavigationLink } from '../MiniAppNavigation';
import { useTranslation } from '../../hooks/useTranslation';
import { requestErrorPresentation } from '../../services/api/error-presentation';

export function ErrorNotice({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  const id = useId();
  return (
    <section className="request-error" role="alert" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`}>
      <span className="request-error-icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16h.01" /></svg>
      </span>
      <div className="request-error-content">
        <h3 id={`${id}-title`}>{title}</h3>
        <p id={`${id}-message`}>{message}</p>
        {action && <div className="request-error-actions">{action}</div>}
      </div>
    </section>
  );
}

export default function RequestErrorNotice({ error, context = 'read', retry }: {
  error: unknown;
  context?: 'read' | 'submit';
  retry?: () => void;
}) {
  const { t } = useTranslation();
  const copy = requestErrorPresentation(error, context);
  return <ErrorNotice title={t(copy.titleKey)} message={t(copy.messageKey)} action={
    copy.checkOrders ? <NavigationLink to="/orders" className="request-error-action">{t('errors.checkOrders')}</NavigationLink> :
      retry && <button type="button" className="request-error-action" onClick={retry}>{t('global.retry')}</button>
  } />;
}
