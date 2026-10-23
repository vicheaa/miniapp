import { getHeaders } from '../api-header';

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const baseUrl = (import.meta.env.VITE_POS_API_BASE_URL || '').replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { ...getHeaders(), Accept: 'application/json' },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Your session has expired. Please sign in again.');
    if (response.status === 403) throw new Error('You do not have permission to access this resource.');
    throw new Error(`Unable to load data (${response.status}). Please try again.`);
  }
  try { return await response.json() as T; }
  catch { throw new Error('The server returned an unexpected response.'); }
}
