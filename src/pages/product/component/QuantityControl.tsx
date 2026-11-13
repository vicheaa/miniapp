import { useEffect, useState } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import { quantityStep, useOrderDraftStore } from '../../../store/orderDraftStore';
import type { Product } from '../../../types/product';
import { productName } from '../catalog';
import Icon from './Icon';

export default function QuantityControl({ product }: { product: Product }) {
  const { t, language } = useTranslation();
  const quantity = useOrderDraftStore((state) => state.items[product.id]?.quantity ?? 0);
  const adjust = useOrderDraftStore((state) => state.adjust);
  const setQuantity = useOrderDraftStore((state) => state.setQuantity);
  const isSubmitting = useOrderDraftStore((state) => state.isSubmitting);
  const [quantityInput, setQuantityInput] = useState<string | null>(null);
  useEffect(() => { setQuantityInput(null); }, [quantity]);
  const label = (key: string) => `${t(key)}: ${productName(product, language)}`;

  return (
    <div className="product-quantity" data-keyboard-field role="group" aria-label={label('products.quantity')}>
      <button type="button" className="product-quantity-button" disabled={isSubmitting} onClick={() => adjust(product, -1)} aria-label={label('products.decrease')}><Icon name="minus" /></button>
      <input
        className="product-quantity-input"
        type="number"
        disabled={isSubmitting}
        inputMode="decimal"
        min={0}
        step={quantityStep(product.qty_step)}
        enterKeyHint="done"
        autoComplete="off"
        spellCheck={false}
        aria-label={label('products.quantity')}
        value={quantityInput ?? String(quantity)}
        onFocus={() => setQuantityInput(String(quantity))}
        onChange={(event) => setQuantityInput(event.target.value)}
        onBlur={(event) => {
          if (event.currentTarget.value !== '' && event.currentTarget.validity.valid) {
            setQuantity(product, event.currentTarget.valueAsNumber);
          }
          setQuantityInput(null);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.value = String(quantity);
            event.currentTarget.blur();
          }
        }}
      />
      <button type="button" className="product-quantity-button" disabled={isSubmitting} onClick={() => adjust(product, 1)} aria-label={label('products.increase')}><Icon name="plus" /></button>
    </div>
  );
}
