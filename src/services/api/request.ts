import { appConfig } from '../../config';
import { useMiniAppStore } from '@/store/miniAppStore';
import { refreshNativeAuthToken } from '../bridge/auth';

type QueryScalar          = string | number | boolean | null | undefined;
export type QueryParams   = Record<string, QueryScalar | readonly QueryScalar[]>;
export type ResponseType  = 'json' | 'text' | 'blob';
export type HttpMethod    = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
type ResponseValue<T, R extends ResponseType> = R extends 'text' ? string : R extends 'blob' ? Blob : T;

export interface RequestOptions<R extends ResponseType = 'json'> extends Omit<RequestInit, 'method' | 'body' | 'headers' | 'signal'> {
  query?:   QueryParams;
  headers?: HeadersInit;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  responseType?: R;
  /** Disable the automatic bearer header for a public endpoint. */
  auth?: boolean;
}
type MethodOptions<R extends ResponseType> = Omit<RequestOptions<R>, 'body'>;

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'aborted' | 'parse';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly data: unknown;
  readonly url: string;
  readonly method: HttpMethod;

  constructor(message: string, details: {
    kind: ApiErrorKind;
    status?: number | null;
    data?: unknown;
    url: string;
    method: HttpMethod;
    cause?: unknown;
  }) {
    super(message, { cause: details.cause });
    this.name = 'ApiError';
    this.kind = details.kind;
    this.status = details.status ?? null;
    this.data = details.data;
    this.url = details.url;
    this.method = details.method;
  }
}

export interface ApiClientOptions {
  baseUrl?: string;
  getToken?: () => string;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
  /** Return and persist a refreshed access token, or null when refresh is unavailable. */
  refreshAuthToken?: (rejectedToken: string) => Promise<string | null>;
  /** Changes on login/logout, but stays stable when tokens rotate within the same session. */
  getAuthSession?: () => unknown;
}

function waitForRefresh(pending: Promise<string | null>, signal: AbortSignal): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const onAbort = () => { cleanup(); reject(signal.reason); };
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    if (signal.aborted) { onAbort(); return; }
    signal.addEventListener('abort', onAbort, { once: true });
    pending.then((token) => { cleanup(); resolve(token); }, (error) => { cleanup(); reject(error); });
  });
}

async function responseError(response: Response, url: string, method: HttpMethod): Promise<ApiError> {
  const text = await response.text();
  let data: unknown = text;
  try { data = text ? JSON.parse(text) : undefined; } catch { /* Preserve non-JSON details. */ }
  return new ApiError(errorMessage(response.status, data), { kind: 'http', status: response.status, data, url, method });
}

function requestUrl(baseUrl: string, path: string, query?: QueryParams): string {
  // Requests belong to the configured API. Pass endpoint paths, not arbitrary origins.
  if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('//') || /[\\\t\r\n]/.test(path)) {
    throw new TypeError('API requests require a relative endpoint path.');
  }
  let url = `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== null && item !== undefined) params.append(key, String(item));
    }
  }
  const encoded = params.toString();
  if (encoded) url += `${url.includes('?') ? '&' : '?'}${encoded}`;
  return url;
}

function errorMessage(status: number, data: unknown): string {
  if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
    return data.message;
  }
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to access this resource.';
  return `Request failed (${status}).`;
}

/** Retry an authenticated 401 once after refresh; never retry transport or server failures. */
export function createApiClient({
  baseUrl = '',
  getToken = () => '',
  timeoutMs: defaultTimeoutMs = appConfig.requestTimeoutMs,
  fetch: fetcher = globalThis.fetch,
  refreshAuthToken,
  getAuthSession = () => undefined,
}: ApiClientOptions = {}) {
  let refreshGeneration = 0;
  // Keep a completed failure for requests already in flight; new requests may try again.
  let refreshing: { session: unknown; generation: number; done: boolean; promise: Promise<string | null> } | null = null;
  function recoverToken(rejectedToken: string, session: unknown, generation: number): Promise<string | null> {
    if (getAuthSession() !== session) return Promise.resolve(null);
    const currentToken = getToken();
    if (currentToken !== rejectedToken) return Promise.resolve(currentToken || null);
    if (!refreshAuthToken) return Promise.resolve(null);
    if (refreshing && refreshing.session === session && (!refreshing.done || refreshing.generation === generation)) return refreshing.promise;
    const task = {
      session,
      generation: refreshGeneration,
      done: false,
      promise: Promise.resolve().then(() => refreshAuthToken(rejectedToken))
        .then((value) => typeof value === 'string' && value.trim() ? value : null).catch(() => null).finally(() => {
          task.done = true;
          if (refreshing === task) refreshGeneration++;
        }),
    };
    refreshing = task;
    return task.promise;
  }

  async function request<T = unknown, R extends ResponseType = 'json'>(
    method: HttpMethod,
    path: string,
    options: RequestOptions<R> = {},
  ): Promise<ResponseValue<T, R> | undefined> {
    const { query, headers: inputHeaders, body: inputBody, signal, timeoutMs = defaultTimeoutMs,
      responseType = 'json', auth = true, ...fetchOptions } = options;
    const url = requestUrl(baseUrl, path, query);
    const controller = new AbortController();
    let timedOut = false;
    const onAbort = () => controller.abort(signal?.reason);
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => {
      if (!controller.signal.aborted) {
        timedOut = true;
        controller.abort(new DOMException('Request timed out', 'TimeoutError'));
      }
    }, timeoutMs);
    let status: number | null = null;
    try {
      if (controller.signal.aborted) throw controller.signal.reason;
      const headers = new Headers(inputHeaders);
      const session = getAuthSession();
      const generation = refreshGeneration;
      const token = auth ? getToken() : '';
      const managedAuth = auth && !!token && !headers.has('Authorization');
      if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
      if (!headers.has('Accept')) {
        headers.set('Accept', responseType === 'json' ? 'application/json' : responseType === 'text' ? 'text/plain' : '*/*');
      }
      let body: BodyInit | undefined;
      if (inputBody instanceof FormData) {
        body = inputBody;
        headers.delete('Content-Type');
      } else if (inputBody instanceof Blob || inputBody instanceof URLSearchParams ||
          inputBody instanceof ArrayBuffer || ArrayBuffer.isView(inputBody) || typeof inputBody === 'string') {
        body = inputBody as BodyInit;
      } else if (inputBody !== undefined) {
        body = JSON.stringify(inputBody);
        if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
      }
      let response = await fetcher(url, {
        ...fetchOptions, method, headers, body, signal: controller.signal,
      });
      status = response.status;
      if (status === 401 && managedAuth && refreshAuthToken && getAuthSession() === session) {
        const unauthorized = await responseError(response, url, method);
        if (controller.signal.aborted) {
          if (timedOut) throw unauthorized;
          throw controller.signal.reason;
        }
        let freshToken: string | null;
        try { freshToken = await waitForRefresh(recoverToken(token, session, generation), controller.signal); }
        catch (error) {
          if (controller.signal.aborted && !timedOut) throw error;
          throw unauthorized;
        }
        if (!freshToken || freshToken === token || getAuthSession() !== session) throw unauthorized;
        headers.set('Authorization', `Bearer ${freshToken}`);
        response = await fetcher(url, { ...fetchOptions, method, headers, body, signal: controller.signal });
        status = response.status;
      }
      if (!response.ok) throw await responseError(response, url, method);
      if (method === 'HEAD' || status === 204 || status === 205) return undefined;
      if (responseType === 'blob') return await response.blob() as ResponseValue<T, R>;
      const text = await response.text();
      if (!text) return undefined;
      if (responseType === 'text') return text as ResponseValue<T, R>;
      try { return JSON.parse(text) as ResponseValue<T, R>; }
      catch (cause) {
        throw new ApiError('The server returned invalid JSON.', { kind: 'parse', status, data: text, url, method, cause });
      }
    } catch (cause) {
      if (cause instanceof ApiError) throw cause;
      const kind: ApiErrorKind = timedOut ? 'timeout' : controller.signal.aborted ? 'aborted' : 'network';
      const message = kind === 'timeout' ? 'The request timed out.' :
        kind === 'aborted' ? 'The request was cancelled.' : 'Unable to reach the server.';
      throw new ApiError(message, { kind, status, url, method, cause });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  const get = <T = unknown, R extends ResponseType = 'json'>(path: string, options?: MethodOptions<R>) =>
    request<T, R>('GET', path, options);
  const post = <T = unknown, R extends ResponseType = 'json'>(path: string, body?: unknown, options?: MethodOptions<R>) =>
    request<T, R>('POST', path, { ...options, body });
  const put = <T = unknown, R extends ResponseType = 'json'>(path: string, body?: unknown, options?: MethodOptions<R>) =>
    request<T, R>('PUT', path, { ...options, body });
  const patch = <T = unknown, R extends ResponseType = 'json'>(path: string, body?: unknown, options?: MethodOptions<R>) =>
    request<T, R>('PATCH', path, { ...options, body });
  const remove = <T = unknown, R extends ResponseType = 'json'>(path: string, options?: RequestOptions<R>) =>
    request<T, R>('DELETE', path, options);
  return { request, get, post, put, patch, delete: remove };
}

export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_ORIGIN || '',
  getToken: () => useMiniAppStore.getState().authToken,
  getAuthSession: () => useMiniAppStore.getState().sessionVersion,
  refreshAuthToken: refreshNativeAuthToken,
});
