import type { Category } from '../../types/category';
import type { Product, ProductCategory } from '../../types/product';
import type { Language } from '../../store/miniAppStore';

export function categoryName(category: ProductCategory, language: Language): string {
  return (language === 'km' ? category.name_kh?.trim() : '') || category.name_en || category.code || '';
}

export function productName(product: Product, language: Language): string {
  return (language === 'km' ? product.line_name_kh?.trim() : '') || product.line_name || product.line_code || product.internal_code;
}

export function mediaUrl(path?: string, apiOrigin = import.meta.env.VITE_API_ORIGIN || ''): string | undefined {
  if (!path?.trim()) return undefined;
  const value = path.trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//') || value.includes('\\')) return undefined;
  // Append to the configured base, preserving prefixes such as /services.
  return `${apiOrigin.replace(/\/+$/, '')}/${value.replace(/^\/+/, '')}`;
}

function productSequence(product: Product): number {
  const value = product.sequent;
  if (value == null || (typeof value === 'string' && !value.trim())) return Infinity;
  const sequence = Number(value);
  return Number.isFinite(sequence) ? sequence : Infinity;
}

export function groupProducts(products: Product[], categories: Category[]) {
  const groups = new Map<number | null, { category: ProductCategory | null; products: Product[] }>();
  for (const product of products) {
    const id = product.category?.id ?? null;
    let group = groups.get(id);
    if (!group) {
      group = { category: categories.find((category) => category.id === id) ?? product.category, products: [] };
      groups.set(id, group);
    }
    group.products.push(product);
  }
  for (const group of groups.values()) {
    group.products.sort((a, b) => productSequence(a) - productSequence(b));
  }
  return [...groups.values()].sort((a, b) =>
    (a.category?.order_index ?? Infinity) - (b.category?.order_index ?? Infinity));
}
