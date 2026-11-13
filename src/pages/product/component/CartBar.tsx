import { NavigationLink } from '../../../components/MiniAppNavigation';
import { useTranslation } from '../../../hooks/useTranslation';
import { useOrderDraftStore } from '../../../store/orderDraftStore';

export default function CartBar() {
  const { t } = useTranslation();
  const items = useOrderDraftStore((state) => state.items);
  const count = Object.keys(items).length;
  if (count === 0) return null;
  return (
    <div className="cart-bar-container keyboard-bottom-actions">
      <NavigationLink to="/cart" className="cart-bar">
        <span>{t('cart.view')}</span>
        <span className="cart-badge" aria-live="polite" aria-atomic="true">{count}</span>
      </NavigationLink>
    </div>
  );
}
