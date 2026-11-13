import { api } from './request';
import type { Category } from '../../types/category';
import type { PaginatedResponse } from '../../types/pagination';

export async function getCategories(signal?: AbortSignal): Promise<Category[]> {
  const response = await api.get<PaginatedResponse<Category>>(
    '/services/central/api/name/staff-order-category/list', 
    { signal }
  );
  if (!response || !Array.isArray(response.results)) throw new Error('Invalid category response.');
  return [...response.results].sort((a, b) => (a.order_index ?? Infinity) - (b.order_index ?? Infinity));
}
