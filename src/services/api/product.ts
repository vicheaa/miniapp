import { api } from './request';
import type { Product, ProductFilters, ProductRecord, ProductResponse } from '../../types/product';
import type { PaginatedResponse } from '../../types/pagination';

export function normalizeProduct(product: ProductRecord): Product {
  return {
    ...product,
    category: product.category == null ? null : { id: product.category, name_en: product.category_name || '' },
    default_uom: product.default_uom == null ? null : {
      id: product.default_uom,
      name: product.default_uom_name || product.reference_uom || product.default_uom_abbreviation || '',
      abbreviation: product.default_uom_abbreviation || product.default_uom_name || product.reference_uom || '',
    },
    thumbnail: product.thumbnail ? { file_url: product.thumbnail } : null,
    images: [],
    product_uoms: [],
    qty_step: product.qty_step ?? null,
    soft_delete: false,
  };
}

export async function getProducts(filters: ProductFilters = {}, signal?: AbortSignal): Promise<ProductResponse> {
  const response = await api.get<PaginatedResponse<ProductRecord>>('/services/central/api/name/staff-order-product/page', {
    signal,
    query: {
      category_id: filters.category_id,
      search_value: filters.search_value?.trim() || undefined,
    },
  });
  if (!response || !Array.isArray(response.results)) throw new Error('Invalid product response.');
  return { ...response, results: response.results.map(normalizeProduct) };
}
