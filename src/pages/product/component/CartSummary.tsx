import { useRef } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import { useOrderDraftStore } from '../../../store/orderDraftStore';
import { productName } from '../catalog';
import Icon from './Icon';
import ProductImage from './ProductImage';
import QuantityControl from './QuantityControl';
import { dismissKeyboard } from '../../../utils/keyboardViewport';

export default function CartSummary() {
  const { t, language } = useTranslation();
  const items = useOrderDraftStore((state) => state.items);
  const setQuantity = useOrderDraftStore((state) => state.setQuantity);
  const selected = Object.values(items);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = () => dialogRef.current?.close();

  return (
    <>
      {selected.length > 0 && (
        <div className="cart-bar-container keyboard-bottom-actions">
          <button type="button" className="cart-bar" aria-haspopup="dialog" aria-controls="cart-summary" onClick={() => { dismissKeyboard(); dialogRef.current?.showModal(); }}>
            <span>{t('cart.view')}</span>
            <span className="cart-badge" aria-live="polite" aria-atomic="true">{selected.length}</span>
          </button>
        </div>
      )}
      <dialog ref={dialogRef} id="cart-summary" className="cart-dialog" aria-labelledby="cart-title" onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]');
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }} onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
      }}>
        <header className="cart-header">
          <div><h2 id="cart-title">{t('cart.title')}</h2><p>{selected.length} {t('cart.products')}</p></div>
          <button type="button" className="product-header-button" aria-label={t('cart.close')} onClick={close} autoFocus><Icon name="close" /></button>
        </header>
        <div className="cart-items" data-keyboard-scroll>
          {selected.length === 0 ? <p className="cart-empty" role="status">{t('cart.empty')}</p> : (
            <ul>
              {selected.map((item) => (
                <li className="cart-item" key={item.product.id}>
                  <div className="cart-item-image"><ProductImage product={item.product} /></div>
                  <div className="cart-item-detail">
                    <h3>{productName(item.product, language)}</h3>
                    <p>{item.uom?.name || item.product.reference_uom}</p>
                    <div className="cart-item-actions">
                      <QuantityControl product={item.product} />
                      <button type="button" className="cart-remove" aria-label={`${t('cart.remove')}: ${productName(item.product, language)}`} onClick={() => setQuantity(item.product, 0)}>{t('cart.remove')}</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer className="cart-footer"><button type="button" className="cart-continue" onClick={close}>{t('cart.continue')}</button></footer>
      </dialog>
    </>
  );
}
