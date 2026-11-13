import { useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { NavigationLink } from '../../components/MiniAppNavigation';
import { useStaffOrderHistory } from '../../hooks/useStaffOrderHistory';
import { useTranslation } from '../../hooks/useTranslation';
import Icon from '../product/component/Icon';
import OrderCards, { OrderCardsSkeleton } from './OrderCards';
import OrdersError from './OrdersError';

export default function OrderHistoryPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const requestedPage = Number(params.get('page') || 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const { history } = useStaffOrderHistory(page);
  const content = useRef<HTMLDivElement>(null);
  function changePage(next: number) {
    setParams({ page: String(next) });
    if (content.current) content.current.scrollTop = 0;
  }
  return (
    <main className="products-page sales-page" aria-labelledby="history-title">
      <header className="products-header sales-header"><div className="products-toolbar"><NavigationLink to="/" replace className="product-header-button" aria-label={t('home.back')}><Icon name="back-ios" /></NavigationLink><h1 id="history-title">{t('home.allOrders')}</h1><span aria-hidden="true" /></div></header>
      <div className="sales-content" ref={content} aria-busy={history.isFetching}>
        {history.isError ? <OrdersError error={history.error} retry={() => void history.refetch()} /> : history.isPending ? <OrderCardsSkeleton /> : <>
          <p className="sales-history-count">{history.data.count} {t('home.orders')}</p>
          <OrderCards orders={history.data.results} />
        </>}
        {history.data && (history.data.next || history.data.previous) && <nav className="sales-pagination" aria-label={t('home.pagination')}>
          <button type="button" disabled={page <= 1 || !history.data.previous || history.isFetching} onClick={() => changePage(page - 1)}>{t('home.previous')}</button>
          <span>{t('home.page')} {page}</span>
          <button type="button" disabled={!history.data.next || history.isFetching} onClick={() => changePage(page + 1)}>{t('home.next')}</button>
        </nav>}
      </div>
      <div className="sales-actions"><NavigationLink to="/products" className="sales-new-order"><Icon name="plus" />{t('products.title')}</NavigationLink></div>
    </main>
  );
}
