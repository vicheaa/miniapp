import { useRef, useState, type KeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { NavigationLink, useMiniAppNavigation } from '../../components/MiniAppNavigation';
import { useTranslation } from '../../hooks/useTranslation';
import { useKeyboardPage } from '../../hooks/useKeyboardViewport';
import { useOrderDraftStore } from '../../store/orderDraftStore';
import { OrderValidationError } from '../../services/api/order';
import RequestErrorNotice, { ErrorNotice } from '../../components/ui/RequestErrorNotice';
import { productName } from '../product/catalog';
import Icon from '../product/component/Icon';
import OrderSubmissionDialog from './OrderSubmissionDialog';
import { isBackdatedDelivery, validCoordinates } from '../../utils/delivery';

export default function CartSummaryPage() {
  useKeyboardPage();
  const { t, language } = useTranslation();
  const { navigateTo } = useMiniAppNavigation();
  const queryClient = useQueryClient();
  const items = useOrderDraftStore((state) => state.items);
  const isSubmitting = useOrderDraftStore((state) => state.isSubmitting);
  const savedOrder = useOrderDraftStore((state) => state.savedOrder);
  const submitError = useOrderDraftStore((state) => state.submitError);
  const commitOrder = useOrderDraftStore((state) => state.commitOrder);
  const details = useOrderDraftStore((state) => state.details);
  const updateDetails = useOrderDraftStore((state) => state.updateDetails);
  const [checkoutError, setCheckoutError] = useState<'locationRequired' | 'pastDeliveryDate' | null>(null);
  const locationButton = useRef<HTMLButtonElement>(null);
  const phoneInput = useRef<HTMLInputElement>(null);
  const customerInput = useRef<HTMLInputElement>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const selected = Object.values(items);
  const quantityFormat = new Intl.NumberFormat(language === 'km' ? 'km-KH' : 'en-US', { maximumFractionDigits: 4 });
  const totals = new Map<string, number>();
  for (const item of selected) {
    const unit = item.uom?.name || item.product.reference_uom || '';
    totals.set(unit, Number(((totals.get(unit) ?? 0) + item.quantity).toFixed(4)));
  }
  const canSubmit = Boolean(details.phone.trim() && details.address.trim() && validCoordinates(details.latitude, details.longitude));
  const finishEditing = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  return (
    <main className="products-page keyboard-page cart-page" aria-labelledby="cart-title" aria-busy={isSubmitting}>
      <header className="products-header">
        <div className="products-toolbar">
          <NavigationLink to="/products" replace className="product-header-button product-back" aria-label={t('cart.back')}><Icon name="back-ios" /></NavigationLink>
          <h1 id="cart-title">{t('cart.detailTitle')}</h1>
          <span aria-hidden="true" />
        </div>
      </header>
      <div className="cart-items" data-keyboard-scroll>
        {selected.length === 0 ? <p className="cart-empty" role="status">{t('cart.empty')}</p> : (
          <section className="cart-order-summary" aria-labelledby="cart-order-heading">
            <h2 id="cart-order-heading">{t('cart.orderSummary')}</h2>
            <ul className="cart-summary-list">
              {selected.map((item) => (
                <li className="cart-summary-row" key={item.product.id}>
                  <h3>{productName(item.product, language)}</h3>
                  <p><span className="cart-summary-quantity">x{quantityFormat.format(item.quantity)}</span> <span className="cart-summary-unit">{item.uom?.name || item.product.reference_uom}</span></p>
                </li>
              ))}
            </ul>
          </section>
        )}
        {selected.length > 0 && (
          <form id="order-checkout" className="cart-checkout" onSubmit={(event) => {
            event.preventDefault();
            if (!details.address.trim() || !validCoordinates(details.latitude, details.longitude)) {
              setCheckoutError('locationRequired');
              locationButton.current?.focus();
              return;
            }
            if (details.delivery_date && isBackdatedDelivery(details.delivery_date)) {
              setCheckoutError('pastDeliveryDate');
              return;
            }
            setCheckoutError(null);
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            void commitOrder(details).then((saved) => {
              if (saved) {
                void queryClient.invalidateQueries({ queryKey: ['staff-orders'] });
                setSuccessOpen(true);
              }
            });
          }}>
            <fieldset disabled={isSubmitting} aria-labelledby="cart-customer-heading">
              <legend id="cart-customer-heading">{t('cart.customerDetails')}</legend>
              <div className="cart-customer-card">
                <div className="checkout-field">
                  <label htmlFor="order-phone"><span>{t('cart.phoneNumber')} <span className="checkout-required" aria-hidden="true">*</span></span></label>
                  <div className="checkout-input">
                    <input ref={phoneInput} id="order-phone" name="phone" type="tel" inputMode="tel" enterKeyHint="done" autoComplete="tel" autoCorrect="off" spellCheck={false} placeholder={t('cart.phoneNumber')} required value={details.phone} onKeyDown={finishEditing} onChange={(event) => updateDetails({ phone: event.target.value })} />
                    {details.phone && <button type="button" className="checkout-input-clear" data-keep-keyboard aria-label={t('cart.clearPhone')} onPointerDown={(event) => event.preventDefault()} onClick={() => { updateDetails({ phone: '' }); phoneInput.current?.focus({ preventScroll: true }); }}><span><Icon name="close" /></span></button>}
                  </div>
                </div>
                <div className="checkout-field"><span id="checkout-location-label">{t('cart.location')} <span className="checkout-required" aria-hidden="true">*</span><span className="sr-only">{t('checkout.required')}</span></span><button ref={locationButton} type="button" onClick={() => navigateTo('/cart/location', false, { fromCart: true })} className="checkout-field-button" aria-labelledby="checkout-location-label checkout-location-value" aria-invalid={checkoutError === 'locationRequired'}><span id="checkout-location-value" className={details.address ? '' : 'checkout-placeholder'}>{details.address || t('checkout.selectLocation')}</span><span className="checkout-edit-icon"><Icon name="edit" /></span></button></div>
                <div className="checkout-field">
                  <label htmlFor="order-customer"><span>{t('cart.customer')} <span className="checkout-optional">({t('cart.optional')})</span></span></label>
                  <div className="checkout-input">
                    <input ref={customerInput} id="order-customer" name="customer" type="text" enterKeyHint="done" autoComplete="name" autoCapitalize="words" autoCorrect="off" spellCheck={false} placeholder={t('cart.customer')} value={details.customer ?? ''} onKeyDown={finishEditing} onChange={(event) => updateDetails({ customer: event.target.value })} />
                    {details.customer && <button type="button" className="checkout-input-clear" data-keep-keyboard aria-label={t('cart.clearCustomer')} onPointerDown={(event) => event.preventDefault()} onClick={() => { updateDetails({ customer: '' }); customerInput.current?.focus({ preventScroll: true }); }}><span><Icon name="close" /></span></button>}
                  </div>
                </div>
              </div>
            </fieldset>
            {!isSubmitting && (checkoutError ? <ErrorNotice title={t('errors.validationTitle')} message={t(`cart.${checkoutError}`)} /> : submitError instanceof OrderValidationError
              ? <ErrorNotice title={t('errors.validationTitle')} message={t(`cart.${submitError.key}`)} />
              : submitError != null && <RequestErrorNotice error={submitError} context="submit" />)}
          </form>
        )}
      </div>
      <footer className="cart-footer keyboard-bottom-actions">
        {selected.length > 0 ? <>
          <div className="cart-total" aria-live="polite" aria-atomic="true">
            <span>{t('cart.total')}</span>
            <div className="cart-total-quantities">{[...totals].map(([unit, quantity]) => <p key={unit}><span className="cart-total-number">{quantityFormat.format(quantity)}</span> <span className="cart-summary-unit">{unit}</span></p>)}</div>
          </div>
          <button type="submit" form="order-checkout" className="cart-continue" disabled={isSubmitting || !canSubmit}>{t(isSubmitting ? 'cart.submitting' : 'cart.submit')}</button>
        </> : <NavigationLink to="/products" replace className="cart-continue">{t('cart.continue')}</NavigationLink>}
      </footer>
      <OrderSubmissionDialog phase={isSubmitting ? 'submitting' : successOpen && savedOrder ? 'success' : null} orderId={savedOrder?.data.id} onDismiss={() => setSuccessOpen(false)} />
    </main>
  );
}
