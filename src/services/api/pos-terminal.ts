import { apiGet } from './request';
import type { Category, ExchangeRate, PosAppDetail, Product } from '../../types/pos-terminal';
import type { Customer } from '../../types/order';

async function list<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const response = await apiGet<{ data: T[] }>(path, signal);
  if (!response || !Array.isArray(response.data)) throw new Error('The server returned an unexpected catalog response.');
  return response.data;
}
export const fetchProducts = (signal?: AbortSignal) => list<Product>('/api/admin/products?paginate=false', signal);
export const fetchCustomers = (signal?: AbortSignal) => list<Customer>('/api/admin/customers?paginate=false', signal);
export const fetchCategories = (signal?: AbortSignal) => list<Category>('/api/admin/categories?paginate=false&is_active=true', signal);
export const fetchExchangeRates = (signal?: AbortSignal) => list<ExchangeRate>('/api/admin/exchange-rates', signal);
export async function fetchPosApp(id: string, signal?: AbortSignal): Promise<PosAppDetail> {
  const response = await apiGet<{ data: PosAppDetail }>(`/api/admin/pos-apps/${encodeURIComponent(id)}`, signal);
  if (!response?.data || typeof response.data.id !== 'string' || typeof response.data.ccy !== 'string') {
    throw new Error('The server returned an unexpected POS app response.');
  }
  return response.data;
}
export function productImageUrl(image: string | null | undefined): string | undefined {
  if (!image) return undefined;
  if (/^https?:\/\//i.test(image)) return image;
  const base = (import.meta.env.VITE_POS_ASSET_BASE_URL || import.meta.env.VITE_POS_API_BASE_URL || '').replace(/\/+$/, '');
  const path = image.replace(/^\/+/, '');
  return `${base}/${path.startsWith('storage/') ? path : `storage/${path}`}`;
}
