import type {
  AssetCountingSession,
  FunctionInCharge,
  AssetCountingReport,
} from '../../types/asset';

/* ── Helpers ───────────────────────────────────────────────────────────── */

function authHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Normalise various API envelope shapes into an array.
 */
function unwrapArray<T>(result: any): T[] {
  if (Array.isArray(result)) return result;
  const items = result.items || result.data || result.content;
  return Array.isArray(items) ? items : [];
}

/* ── Public API ────────────────────────────────────────────────────────── */

/**
 * Fetch a paginated list of asset counting sessions.
 */
export async function fetchSessions(
  token: string,
  page: number = 1,
  pageSize: number = 20,
): Promise<AssetCountingSession[]> {
  const url = `/services/central/api/name/asset-counting-session/page?page=${page}&pageSize=${pageSize}`;
  console.log('[AssetAPI] Fetching sessions…');

  const res = await fetch(url, { method: 'GET', headers: authHeaders(token) });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);

  const result = await res.json();
  return unwrapArray<AssetCountingSession>(result);
}

/**
 * Fetch the function-in-charge breakdown for a given session.
 */
export async function fetchFunctionInCharges(
  token: string,
  sessionId: number,
): Promise<FunctionInCharge[]> {
  const url = `/services/central/api/name/function-in-charge-count-info/list?session_id=${sessionId}`;
  console.log(`[AssetAPI] Fetching function-in-charges for session ${sessionId}…`);

  const res = await fetch(url, { method: 'GET', headers: authHeaders(token) });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);

  const result = await res.json();
  return unwrapArray<FunctionInCharge>(result);
}

/**
 * Fetch asset-counting report items (paginated).
 */
export async function fetchReports(
  token: string,
  sessionId: number,
  functionInChargeId: number,
  page: number = 1,
  pageSize: number = 20,
): Promise<{ items: AssetCountingReport[]; total: number }> {
  const url =
    `/services/central/api/name/asset-counting-report/page` +
    `?session_id=${sessionId}` +
    `&page=${page}` +
    `&pageSize=${pageSize}` +
    `&function_in_charge_id=${functionInChargeId}`;

  console.log(`[AssetAPI] Fetching reports page ${page} (session=${sessionId}, fn=${functionInChargeId})…`);

  const res = await fetch(url, { method: 'GET', headers: authHeaders(token) });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);

  const result = await res.json();
  return {
    items: result.items || [],
    total: result.total || 0,
  };
}
