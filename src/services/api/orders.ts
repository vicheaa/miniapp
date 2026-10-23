import { getHeaders } from '../api-header';
import type { CreateOrderPayload, OrderHistoryPage } from '../../types/order';
import { apiGet } from './request';

export async function fetchOrderHistory(page = 1, signal?: AbortSignal): Promise<OrderHistoryPage> {
  const result = await apiGet<OrderHistoryPage>(`/api/admin/orders?per_page=20${page > 1 ? `&page=${page}` : ''}`, signal);
  if (!result || !Array.isArray(result.data) || !Number.isInteger(result.current_page)
    || !Number.isInteger(result.last_page) || !Number.isInteger(result.total)) {
    throw new Error('The server returned an unexpected order history response.');
  }
  return result;
}

export async function createOrder(payload: CreateOrderPayload): Promise<{ id?: string | number }> {
  const baseUrl = (import.meta.env.VITE_POS_API_BASE_URL || '').replace(/\/+$/, '');
  let response: Response;
  try {
    // Never automatically retry a sale: a connection failure may occur after it was saved.
    response = await fetch(`${baseUrl}/api/admin/orders`, {
      method: 'POST', headers: { ...getHeaders(), Accept: 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error('Could not confirm whether the order was saved. Check your orders before trying again. Your draft has been kept.');
  }
  // A successful response may have no body; the API's response shape was not specified.
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) throw new Error('Your session has expired. Please sign in again. Your draft has been kept.');
    if (response.status === 403) throw new Error('You do not have permission to create orders.');
    if (response.status >= 500) throw new Error('The server could not confirm this order. Check your orders before trying again. Your draft has been kept.');
    const errors = body?.errors && typeof body.errors === 'object'
      ? Object.values(body.errors).flat().filter((value): value is string => typeof value === 'string').join(' ') : '';
    throw new Error(errors || (typeof body?.message === 'string' ? body.message : `Unable to save the order (${response.status}).`));
  }
  const id = body?.data?.id ?? body?.id;
  return typeof id === 'string' || typeof id === 'number' ? { id } : {};
}
