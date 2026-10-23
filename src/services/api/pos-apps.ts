import { apiGet } from './request';
import type { PosAppsResponse } from '../../types/pos-app';

export async function fetchPosApps(page: number, signal?: AbortSignal): Promise<PosAppsResponse> {
  const result = await apiGet<PosAppsResponse>(`/api/admin/pos-apps?page=${page}`, signal);
  if (!result || !Array.isArray(result.data) || !Number.isInteger(result.current_page)
    || !Number.isInteger(result.last_page) || !Number.isInteger(result.total)
    || result.data.some((app) => !app
      || typeof app.id !== 'string' || typeof app.name !== 'string'
      || typeof app.app_key !== 'string' || typeof app.ccy !== 'string')) {
    throw new Error('The server returned an unexpected POS apps response.');
  }
  return result as PosAppsResponse;
}
