import { useEffect, useRef } from 'react';
import { NavigationLink } from '../../components/MiniAppNavigation';
import { useInfiniteStaffOrderHistory } from '../../hooks/useStaffOrderHistory';
import { useTranslation } from '../../hooks/useTranslation';
import Icon from '../product/component/Icon';
import OrderCards, { OrderCardsSkeleton } from './OrderCards';
import OrdersError from './OrdersError';

export default function OrderHistoryPage() {
  const { t } = useTranslation();
  const { history } = useInfiniteStaffOrderHistory();
  const content = useRef<HTMLDivElement>(null);
  const loadMore = useRef<HTMLDivElement>(null);
  const { fetchNextPage, hasNextPage, isFetching, isError } = history;

  useEffect(() => {
    if (!content.current || !loadMore.current || !hasNextPage || isFetching || isError) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void fetchNextPage({ cancelRefetch: false });
      }
    }, { root: content.current, rootMargin: '0px 0px 200px 0px' });
    observer.observe(loadMore.current);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetching, isError]);

  return (
    <main className="products-page sales-page" aria-labelledby="history-title">
      <header className="products-header sales-header"><div className="products-toolbar"><NavigationLink to="/" replace className="product-header-button" aria-label={t('home.back')}><Icon name="back-ios" /></NavigationLink><h1 id="history-title">{t('home.allOrders')}</h1><span aria-hidden="true" /></div></header>
      <div className="sales-content" ref={content} aria-busy={history.isFetching}>
        {history.isPending ? <OrderCardsSkeleton /> : history.data ? <>
          <p className="sales-history-count">{history.data.pages[0].count} {t('home.orders')}</p>
          <OrderCards orders={history.data.pages.flatMap((page) => page.results)} />
        </> : null}
        {history.isError && <OrdersError error={history.error} retry={() => {
          if (history.isFetching) return;
          if (history.isFetchNextPageError) void history.fetchNextPage({ cancelRefetch: false });
          else void history.refetch();
        }} />}
        {history.hasNextPage && <div className="sales-load-more" ref={loadMore} aria-hidden="true" />}
        {history.isFetchingNextPage && <>
          <p className="sales-history-loading" role="status">{t('home.loadingOrders')}</p>
          <OrderCardsSkeleton />
        </>}
      </div>
      <div className="sales-actions"><NavigationLink to="/products" className="sales-new-order"><Icon name="plus" />{t('products.title')}</NavigationLink></div>
    </main>
  );
}
