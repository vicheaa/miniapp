import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../hooks/useTranslation';
import { NavigationLink, useMiniAppNavigation } from '../components/MiniAppNavigation';
import { useStaffOrderHistory } from '../hooks/useStaffOrderHistory';
import { getStaffOrderSummary } from '../services/api/order';
import { useMiniAppStore } from '../store/miniAppStore';
import OrderCards, { OrderCardsSkeleton } from './orders/OrderCards';
import OrdersError from './orders/OrdersError';
import Icon from './product/component/Icon';

export default function HomePage() {
  const { t } = useTranslation();
  const language = useMiniAppStore((state) => state.language);
  const { exitMiniApp, isClosing, closeError } = useMiniAppNavigation();
  const sessionVersion = useMiniAppStore((state) => state.sessionVersion);
  const { history } = useStaffOrderHistory();
  const summary = useQuery({
    queryKey: ['staff-orders', 'summary', sessionVersion],
    queryFn: ({ signal }) => getStaffOrderSummary(signal),
  });
  const metrics = [
    { field: 'total_requests', label: 'totalOrders', tone: 'default' },
    { field: 'pending_requests', label: 'pendingOrders', tone: 'pending' },
    { field: 'accepted_requests', label: 'acceptedOrders', tone: 'accepted' },
    { field: 'total_items_case', label: 'totalItems', tone: 'default' },
  ] as const;
  const number = new Intl.NumberFormat(language === 'km' ? 'km-KH' : 'en-US');
  return (
    <main className="products-page sales-page" aria-labelledby="sales-title">
      <header className="products-header sales-header">
        <div className="products-toolbar">
          <button type="button" className="product-header-button" disabled={isClosing} onClick={exitMiniApp} aria-label={t('home.exit')}><Icon name="back-ios" /></button>
          <h1 className="sales-title" id="sales-title">{t('home.title')}</h1><span aria-hidden="true" />
        </div>
      </header>
      <div className="sales-content">
        {closeError && <OrdersError error={closeError} retry={exitMiniApp} />}
        <section aria-label={t('home.summary')} aria-busy={summary.isFetching}>
          {summary.isError && <OrdersError error={summary.error} retry={() => void summary.refetch()} />}
          <dl className="sales-summary">
            {metrics.map(({ field, label, tone }) => (
              <div className="sales-metric" key={field} data-tone={tone}>
                <dt>{t(`home.${label}`)}</dt>
                <dd>{summary.data ? number.format(summary.data[field]) : summary.isPending ? <span className="sales-metric-skeleton" aria-label={t('global.loading')} /> : '—'}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="sales-recent" aria-labelledby="recent-orders-title" aria-busy={history.isFetching}>
          <div className="sales-section-heading"><h2 id="recent-orders-title">{t('home.recentOrders')}</h2><NavigationLink to="/orders">{t('home.seeAll')}<Icon name="chevron-right" /></NavigationLink></div>
          {history.isError ? <OrdersError error={history.error} retry={() => void history.refetch()} /> : history.isPending ? <OrderCardsSkeleton /> : <OrderCards orders={history.data.results.slice(0, 3)} />}
        </section>
      </div>
      <div className="sales-actions"><NavigationLink to="/products" className="sales-new-order"><Icon name="plus" />{t('products.title')}</NavigationLink></div>
    </main>
  );
}
