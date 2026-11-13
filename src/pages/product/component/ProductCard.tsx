import { useTranslation } from '../../../hooks/useTranslation';
import { useOrderDraftStore } from '../../../store/orderDraftStore';
import type { Product } from '../../../types/product';
import { productName } from '../catalog';
import Icon from './Icon';
import ProductImage from './ProductImage';
import QuantityControl from './QuantityControl';

export default function ProductCard({ product }: { product: Product }) {
  const { t, language } = useTranslation();
  const name = productName(product, language);
  const quantity = useOrderDraftStore((state) => state.items[product.id]?.quantity ?? 0);
  const adjust = useOrderDraftStore((state) => state.adjust);
  const isSubmitting = useOrderDraftStore((state) => state.isSubmitting);
  return (
    <article className="product-card">
      <ProductImage product={product} />
      <h3 className="product-name">{name}</h3>
      <div className="product-card-actions">
        {quantity > 0 ? <QuantityControl product={product} /> : (
          <button type="button" className="product-add-button" disabled={isSubmitting} onClick={() => adjust(product, 1)} aria-label={`${t('products.add')}: ${name}`}><Icon name="plus" /></button>
        )}
      </div>
    </article>
  );
}
