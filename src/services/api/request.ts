import { appConfig } from '../../config';
import { useMiniAppStore } from '../../store/miniAppStore';
import { refreshNativeAuthToken } from '../bridge/auth';
import { accessTokenLifetimeSeconds, inspectSfaAuthError, stagingAuthDiagnostics, type AuthDiagnosticEvent, type AuthDiagnosticListener } from './auth-diagnostics';

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
  /** Separate wait for native refresh; each resource attempt retains its own timeoutMs. */
  authRefreshTimeoutMs?: number;
  /** Return and persist a refreshed access token, or null when refresh is unavailable. */
  refreshAuthToken?: (rejectedToken: string) => Promise<string | null>;
  /** Changes on login/logout, but stays stable when tokens rotate within the same session. */
  getAuthSession?: () => unknown;
  /** Optional redacted diagnostics. Listener failures never affect requests. */
  onAuthDiagnostic?: AuthDiagnosticListener;
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
  if (typeof data === 'string' && data.trim()) return data;
  if (data && typeof data === 'object') {
    const fields = data as Record<string, unknown>;
    const messages = ['message', 'detail', 'error_description', 'error', 'title']
      .map((key) => fields[key])
      .filter((value): value is string => typeof value === 'string' && !!value.trim());
    if (messages.length) return [...new Set(messages)].join('\n');
    return JSON.stringify(data);
  }
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to access this resource.';
  return `Request failed (${status}).`;
}

/** Show the server's message with its HTTP status, or the actual client failure. */
export function formatApiError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.status === null ? error.message : `HTTP ${error.status}: ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}

/** Compatibility with Central's FailedResponse wrapping an SFA auth rejection as HTTP 500. */
function isExpiredSfaRead(error: ApiError, path: string, rejectedToken: string): boolean {
  // Restrict recovery to known reads. A server failure during a write may follow a committed side effect.
  if (error.status !== 500 || error.method !== 'GET' ||
      !/^\/?services\/central\/api\/name\/staff-order-[^/?#]+\/(?:find|list|page)(?:\?|$)/.test(path) ||
      !error.data || typeof error.data !== 'object') return false;
  const indicators = inspectSfaAuthError(error.data);
  return indicators.dataFailure && indicators.wrappedGet && indicators.sfaProxy &&
    indicators.authenticationFailed && (indicators.expiredToken ||
      // The captured deployment uses a different message for an internal credential.
      // Recover only if our own access token is expired too; a valid-user service
      // credential failure belongs to the backend, not native user authentication.
      (indicators.internalMicroserviceExpired && (accessTokenLifetimeSeconds(rejectedToken) ?? Infinity) <= 0));
}

/** Refresh expiring write credentials before sending; recover rejected requests at most once. */
export function createApiClient({
  baseUrl = '',
  getToken = () => '',
  timeoutMs: defaultTimeoutMs = appConfig.requestTimeoutMs,
  authRefreshTimeoutMs = appConfig.authRefreshTimeoutMs,
  fetch: fetcher = globalThis.fetch,
  refreshAuthToken,
  getAuthSession = () => undefined,
  onAuthDiagnostic,
}: ApiClientOptions = {}) {
  let refreshGeneration = 0;
  let requestSequence = 0;
  // Keep a completed failure for requests already in flight; new requests may try again.
  let refreshing: { session: unknown; generation: number; done: boolean; promise: Promise<string | null> } | null = null;
  type Trace = (phase: AuthDiagnosticEvent['phase'], details?: Partial<AuthDiagnosticEvent>) => void;
  function recoverToken(rejectedToken: string, session: unknown, generation: number, trace: Trace): Promise<string | null> {
    if (getAuthSession() !== session) return Promise.resolve(null);
    const currentToken = getToken();
    if (currentToken !== rejectedToken) {
      trace('refresh_reuse');
      return Promise.resolve(currentToken || null);
    }
    if (!refreshAuthToken) return Promise.resolve(null);
    if (refreshing && refreshing.session === session && (!refreshing.done || refreshing.generation === generation)) {
      trace('refresh_join');
      return refreshing.promise;
    }
    const started = Date.now();
    trace('refresh_start');
    const task = {
      session,
      generation: refreshGeneration,
      done: false,
      promise: Promise.resolve().then(() => refreshAuthToken(rejectedToken))
        .then((value) => typeof value === 'string' && value.trim() ? value : null).catch(() => null)
        .then((value) => {
          trace('refresh_result', { durationMs: Date.now() - started,
            result: !value ? 'failed' : value === rejectedToken ? 'unchanged' : 'success' });
          return value;
        }).finally(() => {
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
    const requestId = ++requestSequence;
    const started = Date.now();
    let attempt = 1;
    let status: number | null = null;
    const trace: Trace = (phase, details) => {
      if (!onAuthDiagnostic) return;
      try {
        onAuthDiagnostic({ phase, requestId, method, path: path.split(/[?#]/, 1)[0],
          attempt, status, elapsedMs: Date.now() - started, ...details });
      } catch { /* Diagnostics must not interrupt authentication or HTTP. */ }
    };
    const controller = new AbortController();
    let transportController = new AbortController();
    const abortTransport = () => transportController.abort(controller.signal.reason);
    controller.signal.addEventListener('abort', abortTransport);
    let timedOut = false;
    const onAbort = () => controller.abort(signal?.reason);
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startTimeout = (duration: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!controller.signal.aborted) {
          timedOut = true;
          controller.abort(new DOMException('Request timed out', 'TimeoutError'));
        }
      }, duration);
    };
    startTimeout(timeoutMs);
    try {
      if (controller.signal.aborted) throw controller.signal.reason;
      const headers = new Headers(inputHeaders);
      const session = getAuthSession();
      let generation = refreshGeneration;
      let token = auth ? getToken() : '';
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
      // Central can wrap a downstream write's 401 as 500 with an empty body.
      // Avoid sending an expired credential rather than replaying an ambiguous write.
      // Match native's 30-second expiry window; opaque tokens retain status-based recovery.
      const refreshBeforeWrite = managedAuth && method !== 'GET' && method !== 'HEAD' &&
        (accessTokenLifetimeSeconds(token) ?? Infinity) <= 30;
      if (refreshBeforeWrite) {
        trace('auth_preflight', { accessTokenExpiresInSeconds: accessTokenLifetimeSeconds(token) });
        startTimeout(authRefreshTimeoutMs);
        const freshToken = await waitForRefresh(recoverToken(token, session, generation, trace), controller.signal);
        if (controller.signal.aborted) throw controller.signal.reason;
        if (getAuthSession() !== session) {
          throw new ApiError('The request was cancelled.', { kind: 'aborted', url, method });
        }
        if (!freshToken || freshToken === token || (accessTokenLifetimeSeconds(freshToken) ?? Infinity) <= 30) {
          throw new ApiError('Unable to refresh your session. Please reopen the miniapp and try again.',
            { kind: 'http', status: 401, url, method });
        }
        token = freshToken;
        // A later real 401 still deserves one reactive refresh, even if this
        // credential was checked proactively. Never reuse the preflight result
        // as recovery for a rejection of that same result.
        generation = refreshGeneration;
        headers.set('Authorization', `Bearer ${token}`);
        startTimeout(timeoutMs);
      }
      let response = await fetcher(url, {
        ...fetchOptions, method, headers, body, signal: transportController.signal,
      });
      status = response.status;
      trace('response', { managedAuth, refreshAvailable: !!refreshAuthToken, sessionCurrent: getAuthSession() === session,
        ...(onAuthDiagnostic ? { accessTokenExpiresInSeconds: accessTokenLifetimeSeconds(token) } : {}) });
      const canRecover = managedAuth && !!refreshAuthToken && getAuthSession() === session;
      const directUnauthorized = status === 401 && canRecover;
      // A 401 header is sufficient to refresh. Its body may be delayed or never finish.
      let failure = response.ok || directUnauthorized ? null : await responseError(response, url, method);
      if (!response.ok) trace('auth_rejection', {
        reason: status === 401 ? 'http_401' : failure && isExpiredSfaRead(failure, path, token) ? 'sfa_expired' : 'unrecognized',
        ...(failure ? { indicators: inspectSfaAuthError(failure.data) } : {}),
      });
      if (directUnauthorized || (failure && isExpiredSfaRead(failure, path, token) && canRecover)) {
        const unauthorized = failure ? Promise.resolve(failure) : responseError(response, url, method).catch(() =>
          new ApiError('Your session has expired. Please sign in again.', { kind: 'http', status: 401, url, method }));
        const originalError = async () => {
          // A fast refresh rejection must not leave error-body reading unbounded.
          if (!controller.signal.aborted) startTimeout(timeoutMs);
          const error = await unauthorized;
          if (controller.signal.aborted && !timedOut) throw controller.signal.reason;
          return error;
        };
        if (controller.signal.aborted) {
          if (timedOut) throw await originalError();
          throw controller.signal.reason;
        }
        // Keep the initial query pending while native refresh runs. The resource timeout
        // must not expire this caller halfway through a successful native refresh.
        startTimeout(authRefreshTimeoutMs);
        let freshToken: string | null;
        try { freshToken = await waitForRefresh(recoverToken(token, session, generation, trace), controller.signal); }
        catch (error) {
          if (controller.signal.aborted && !timedOut) throw error;
          throw await originalError();
        }
        if (!freshToken || freshToken === token || getAuthSession() !== session) throw await originalError();
        // Release the rejected response, including any body still streaming, then give
        // the replay a fresh transport and a full resource timeout.
        transportController.abort();
        transportController = new AbortController();
        if (controller.signal.aborted) throw controller.signal.reason;
        startTimeout(timeoutMs);
        headers.set('Authorization', `Bearer ${freshToken}`);
        attempt = 2;
        trace('replay_start');
        response = await fetcher(url, { ...fetchOptions, method, headers, body, signal: transportController.signal });
        status = response.status;
        trace('response', onAuthDiagnostic ? { accessTokenExpiresInSeconds: accessTokenLifetimeSeconds(freshToken) } : {});
        failure = response.ok ? null : await responseError(response, url, method);
      }
      if (failure) throw failure;
      if (method === 'HEAD' || status === 204 || status === 205) { trace('request_end', { result: 'success' }); return undefined; }
      if (responseType === 'blob') {
        const value = await response.blob();
        trace('request_end', { result: 'success' });
        return value as ResponseValue<T, R>;
      }
      const text = await response.text();
      if (!text) { trace('request_end', { result: 'success' }); return undefined; }
      if (responseType === 'text') { trace('request_end', { result: 'success' }); return text as ResponseValue<T, R>; }
      try {
        const value = JSON.parse(text) as ResponseValue<T, R>;
        trace('request_end', { result: 'success' });
        return value;
      }
      catch (cause) {
        throw new ApiError('The server returned invalid JSON.', { kind: 'parse', status, data: text, url, method, cause });
      }
    } catch (cause) {
      if (cause instanceof ApiError) {
        trace('request_end', { result: cause.kind === 'http' ? 'http_error' : cause.kind });
        throw cause;
      }
      const kind: ApiErrorKind = timedOut ? 'timeout' : controller.signal.aborted ? 'aborted' : 'network';
      trace('request_end', { result: kind });
      const message = kind === 'timeout' ? 'The request timed out.' :
        kind === 'aborted' ? 'The request was cancelled.' : 'Unable to reach the server.';
      throw new ApiError(message, { kind, status, url, method, cause });
    } finally {
      clearTimeout(timer);
      transportController.abort();
      controller.signal.removeEventListener('abort', abortTransport);
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
  onAuthDiagnostic: stagingAuthDiagnostics,
});
