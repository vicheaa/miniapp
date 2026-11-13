import { useTranslation } from '../../hooks/useTranslation';
import type { Category } from '../../types/category';
import type { Product, ProductViewMode } from '../../types/product';
import { categoryName, groupProducts } from './catalog';
import ProductCard from './component/ProductCard';

export function ProductSkeleton({ viewMode = 'grid' }: { viewMode?: ProductViewMode }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t('products.loading')}>
      <span className="sr-only">{t('products.loading')}</span>
      <div className="product-skeleton-heading" aria-hidden="true" />
      <div className="product-grid" data-view={viewMode} aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => <div className="product-card product-skeleton" key={index}><div /><span /><span /></div>)}
      </div>
    </div>
  );
}

export default function ProductList({ products, categories, viewMode = 'grid' }: { products: Product[]; categories: Category[]; viewMode?: ProductViewMode }) {
  const { t, language } = useTranslation();
  if (products.length === 0) {
    return (
      <div className="product-state" role="status">
        <h2>{t('products.empty')}</h2>
        <p>{t('products.emptyHint')}</p>
      </div>
    );
  }
  return groupProducts(products, categories).map((group) => (
    <section className="product-section" key={group.category?.id ?? 'uncategorized'} aria-labelledby={`category-${group.category?.id ?? 'other'}`}>
      <h2 id={`category-${group.category?.id ?? 'other'}`}>
        {group.category ? categoryName(group.category, language) : t('products.other')}
      </h2>
      <div className="product-grid" data-view={viewMode}>
        {group.products.map((product) => <ProductCard product={product} key={product.id} />)}
      </div>
    </section>
  ));
}
