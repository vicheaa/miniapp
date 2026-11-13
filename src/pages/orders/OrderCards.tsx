import { useLocation } from 'react-router-dom';
import { NavigationLink } from '../../components/MiniAppNavigation';
import { useTranslation } from '../../hooks/useTranslation';
import type { StaffOrderHistory } from '../../types/order';
import Icon from '../product/component/Icon';
import { orderDate, orderStatus } from './presentation';

export default function OrderCards({ orders }: { orders: StaffOrderHistory[] }) {
  const { t, language } = useTranslation();
  const location = useLocation();
  if (!orders.length) return <p className="sales-state" role="status">{t('home.noOrders')}</p>;
  return (
    <ul className="sales-orders">
      {orders.map((order) => {
        const status = orderStatus(order.status);
        return (
          <li key={order.id}>
            <NavigationLink to={`/orders/${order.id}`} state={{ from: location.pathname + location.search }} className="sales-order-link" aria-label={`${t('orderDetails.view')} ${order.no}`}>
              <article className="sales-order" aria-label={`${t('home.order')} ${order.no}`}>
                <div className="sales-order-heading">
                  <h3>{order.phone || order.customer || order.no}</h3>
                  <span className="sales-status" data-status={status}>{status === 'unknown' ? order.status : t(`home.${status}`)}</span>
                </div>
                <p className="sales-order-meta"><Icon name="calendar" /><time dateTime={order.created_date}>{orderDate(order.created_date, language)}</time></p>
                <p className="sales-order-meta"><Icon name="location" /><span>{order.address || '—'}</span></p>
              </article>
            </NavigationLink>
          </li>
        );
      })}
    </ul>
  );
}

export function OrderCardsSkeleton() {
  const { t } = useTranslation();
  return <div className="sales-orders" role="status" aria-label={t('home.loadingOrders')}>{[0, 1, 2].map((id) => <div className="sales-order sales-order-skeleton" key={id} aria-hidden="true"><span /><span /><span /></div>)}</div>;
}
