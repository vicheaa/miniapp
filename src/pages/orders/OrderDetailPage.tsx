import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { NavigationLink } from '../../components/MiniAppNavigation';
import { useTranslation } from '../../hooks/useTranslation';
import { getStaffOrderDetail } from '../../services/api/order';
import { useMiniAppStore } from '../../store/miniAppStore';
import { copyText } from '../../utils/clipboard';
import { productName } from '../product/catalog';
import Icon from '../product/component/Icon';
import ProductImage from '../product/component/ProductImage';
import OrdersError from './OrdersError';
import { orderDateTime, orderDetailBackTarget, orderMapUrl, orderNumber, orderStatus, orderUnit } from './presentation';

function CopyOrderNumber({ number }: { number: string }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');

  useEffect(() => {
    if (status !== 'copied' && status !== 'error') return;
    const timeout = window.setTimeout(() => setStatus('idle'), 2500);
    return () => window.clearTimeout(timeout);
  }, [status]);

  const copy = async () => {
    setStatus('copying');
    try {
      await copyText(number);
      setStatus('copied');
    } catch {
      setStatus('error');
    }
  };

  return (
    <span className="order-detail-number">
      <button type="button" className="order-detail-copy" onClick={() => void copy()} disabled={status === 'copying'} aria-label={t(status === 'copied' ? 'orderDetails.copied' : 'orderDetails.copyOrderNumber')} title={t('orderDetails.copyOrderNumber')} data-copied={status === 'copied'}>
        <Icon name={status === 'copied' ? 'check' : 'copy'} />
      </button>
      <strong>{number}</strong>
      <span className={status === 'error' ? 'order-detail-copy-error' : 'sr-only'} role="status">{status === 'copied' ? t('orderDetails.copied') : status === 'error' ? t('orderDetails.copyFailed') : ''}</span>
    </span>
  );
}

export default function OrderDetailPage() {
  const { t, language } = useTranslation();
  const [failedMapUrl, setFailedMapUrl] = useState<string | null>(null);
  const { orderId = '' } = useParams();
  const location = useLocation();
  const back = orderDetailBackTarget(location.state?.from);
  const sessionVersion = useMiniAppStore((state) => state.sessionVersion);
  const superApp = useMiniAppStore((state) => state.superApp);
  const id = /^[1-9]\d*$/.test(orderId) ? Number(orderId) : NaN;
  const validId = Number.isSafeInteger(id) && id > 0;
  const detail = useQuery({
    queryKey: ['staff-orders', 'detail', sessionVersion, id],
    queryFn: ({ signal }) => getStaffOrderDetail(id, signal),
    enabled: validId,
  });
  const order = detail.data;
  const status = order ? orderStatus(order.status) : 'unknown';
  const mapUrl = orderMapUrl(order?.latitude, order?.longitude);

  return (
    <main className="products-page sales-page order-detail-page" aria-labelledby="detail-title">
      <header className="products-header sales-header"><div className="products-toolbar">
        <NavigationLink to={back} replace className="product-header-button" aria-label={t('orderDetails.back')}><Icon name="back-ios" /></NavigationLink>
        <h1 id="detail-title">{t('orderDetails.title')}</h1><span aria-hidden="true" />
      </div></header>
      <div className="sales-content order-detail-content" aria-busy={detail.isFetching}>
        {!validId ? <p className="sales-error" role="alert">{t('orderDetails.invalidOrder')}</p> : detail.isError ? <OrdersError error={detail.error} retry={() => void detail.refetch()} /> : !order ? <p className="sales-state" role="status">{t('orderDetails.loading')}</p> : <>
          <section className="order-detail-panel" aria-label={t('orderDetails.overview')}>
            <div className="order-detail-customer-heading">
              {/* <h2>{order.customer || '—'}</h2> */}
              <CopyOrderNumber key={`${sessionVersion}:${order.id}:${order.no}`} number={order.no} />
              <span className="sales-status" data-status={status}>{status === 'unknown' ? order.status : t(`home.${status}`)}</span>
            </div>
            <p className="order-detail-identity"><time dateTime={order.created_date}>{orderDateTime(order.created_date, language)}</time></p>
            <dl className="order-detail-fields">
              {order.customer?.trim() && (
                <div><dt>{t('orderDetails.customer')}</dt><dd>{order.customer}</dd></div>
              )}
              <div><dt>{t('orderDetails.phone')}</dt><dd>{order.phone || '—'}</dd></div>
              <div><dt>{t('orderDetails.salesperson')}</dt><dd>{order.staff_code && `${order.staff_code} · `}{order.staff_name || '—'}</dd></div>
              <div><dt>{t('orderDetails.delivery')}</dt><dd>{order.delivery_date ? orderDateTime(order.delivery_date, language) : t('orderDetails.notScheduled')}</dd></div>
              <div><dt>{t('orderDetails.address')}</dt><dd className="order-detail-address">
                <span>{order.address || '—'}</span>
                {mapUrl && <a className="order-detail-map-link" href={mapUrl} target="_blank" rel="noopener noreferrer" onClick={async (event) => {
                  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  if (!superApp?.isAvailable()) return;
                  event.preventDefault();
                  setFailedMapUrl(null);
                  try {
                    await superApp.openUrl(mapUrl);
                  } catch { setFailedMapUrl(mapUrl); }
                }}><Icon name="location" />{t('orderDetails.seeMap')}</a>}
                {mapUrl && failedMapUrl === mapUrl && <span className="order-detail-map-error" role="status">{t('orderDetails.mapOpenFailed')}</span>}
              </dd></div>
            </dl>
          </section>
          <section className="order-detail-panel" aria-labelledby="order-items-title">
            <h2 id="order-items-title">{t('orderDetails.items')} <span className="order-detail-count">({order.items.length})</span></h2>
            {order.items.length === 0 ? <p className="sales-state">{t('orderDetails.noItems')}</p> : <ul className="order-detail-items">
              {order.items.map((item) => <li className="order-detail-item" key={item.id}>
                <div className="order-detail-item-image"><ProductImage product={item.product} /></div>
                <div className="order-detail-item-info">
                  <h3>{item.product ? productName(item.product, language) : t('orderDetails.productUnavailable')}</h3>
                  {item.product && <p className="order-detail-product-meta">{item.product.line_code || item.product.internal_code}</p>}
                  {item.remarks && <p className="order-detail-remarks">{item.remarks}</p>}
                </div>
                <p className="order-detail-quantity">x {orderNumber(item.quantity, language)} {orderUnit(item.product?.default_uom?.name || item.product?.reference_uom || '', item.quantity)}</p>
              </li>)}
            </ul>}
          </section>
        </>}
      </div>
    </main>
  );
}
