import { useTranslation } from '../../hooks/useTranslation';
import type { Category } from '../../types/category';
import type { ProductViewMode } from '../../types/product';
import { categoryName } from '../product/catalog';
import Icon from '../product/component/Icon';

interface Props {
  categories: Category[];
  selectedId?: number;
  onSelect: (id?: number) => void;
  viewMode: ProductViewMode;
  onViewModeChange: (mode: ProductViewMode) => void;
}

export default function CategoryList({ categories, selectedId, onSelect, viewMode, onViewModeChange }: Props) {
  const { t, language } = useTranslation();
  const switchLabel = t(viewMode === 'grid' ? 'products.showList' : 'products.showGrid');
  return (
    <div className="product-category-row">
      <nav className="product-categories" aria-label={t('products.categories')}>
        <button type="button" className="category-pill" aria-pressed={selectedId === undefined} onClick={() => onSelect()}>{t('products.all')}</button>
        {categories.map((category) => (
          <button type="button" className="category-pill" key={category.id} aria-pressed={selectedId === category.id} onClick={() => onSelect(category.id)}>{categoryName(category, language)}</button>
        ))}
      </nav>
      <button type="button" className="product-view-toggle" aria-label={switchLabel} title={switchLabel} onClick={() => onViewModeChange(viewMode === 'grid' ? 'list' : 'grid')}>
        <Icon name={viewMode === 'grid' ? 'list' : 'grid'} />
      </button>
    </div>
  );
}
