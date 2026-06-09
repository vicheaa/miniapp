/**
 * Create standard authorization headers using the JWT token from the SuperApp bridge.
 */
export function getAuthHeaders(token?: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Standard utility to unwrap API list/page data formats.
 * Normalizes envelopes like { items: [...] }, { data: [...] }, or { content: [...] }
 * into a plain array.
 */
export function unwrapArray<T>(result: any): T[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  const items = result.items || result.data || result.content;
  return Array.isArray(items) ? items : [];
}

/**
 * A simple wrapper around the global `fetch` API that automatically adds authentication
 * headers and throws an error on non-OK responses.
 * 
 * Note: Requests to `/api/*` and `/services/*` are proxied by the Vite dev server locally,
 * and will be routed correctly inside the SuperApp container.
 */
export async function request<T = any>(
  url: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers = {
    ...getAuthHeaders(token),
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  // Handle empty or no-content responses
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
