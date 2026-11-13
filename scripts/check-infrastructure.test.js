import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer as createHttpServer } from 'node:http';
import { once } from 'node:events';
import { createServer } from 'vite';

let vite;
let http;
let origin;
let resolveBridge;
let initializeBridge;
let createMockBridge;
let useMiniAppStore;
let createApiClient;
let ApiError;
let refreshNativeAuthToken;
const writes = new Map();
let completeUnauthorizedBody;
const wrappedReadPath = '/services/central/api/name/staff-order-detail/find';

function wrappedSfaError(variant = '') {
  const upstream = { message: 'Unauthorized', title: 'Unauthorized', ex: {
    message: variant === 'revoked' ? 'Token has been revoked or logged out.' :
      variant === 'internal-expired' ? 'Internal microservice token has expired.' : 'Token has expired.',
    code: variant === 'wrong-code' ? 'permission_denied' : 'authentication_failed',
  } };
  return {
    timestamp: '2026-11-12T01:24:00Z', status: 550,
    error: variant === 'other-error' ? 'Other failure' : 'Data failure',
    message: `[${variant === 'forbidden' ? '403 Forbidden' : '401 Unauthorized'}] during [GET] to [http://sfa/mobile/staff-order-detail/32/] [${variant === 'other-proxy' ? 'OtherApiProxy' : 'SFAApiProxy'}#staffOrderDetail(Long)]: [${variant === 'malformed' ? 'invalid json' : JSON.stringify(upstream)}]`,
  };
}

before(async () => {
  vite = await createServer({
    mode: 'test',
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  });
  ({ resolveBridge } = await vite.ssrLoadModule('/src/services/bridge/bridge-factory.ts'));
  ({ initializeBridge } = await vite.ssrLoadModule('/src/services/bridge/bootstrap.ts'));
  ({ createMockBridge } = await vite.ssrLoadModule('/src/services/bridge/mock-bridge.ts'));
  ({ useMiniAppStore } = await vite.ssrLoadModule('/src/store/miniAppStore.ts'));
  ({ createApiClient, ApiError } = await vite.ssrLoadModule('/src/services/api/request.ts'));
  ({ refreshNativeAuthToken } = await vite.ssrLoadModule('/src/services/bridge/auth.ts'));

  globalThis.window = { location: { search: '', hash: '' } };
  globalThis.document = { title: '' };
  http = createHttpServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString();
      if (req.method !== 'GET') writes.set(url.pathname, (writes.get(url.pathname) ?? 0) + 1);
      if (url.pathname.startsWith('/services/central/api/name/staff-order-') || url.pathname === '/wrapped-other') {
        const authorized = req.headers.authorization === 'Bearer fresh-token' && !url.searchParams.has('always');
        const respond = () => {
          res.writeHead(authorized ? 200 : Number(url.searchParams.get('status') || 500), { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(authorized
            ? { method: req.method, body, query: [...url.searchParams], authorization: req.headers.authorization }
            : wrappedSfaError(url.searchParams.get('variant'))));
        };
        const delay = !authorized ? Number(url.searchParams.get('delay') || 0) : 0;
        if (delay) setTimeout(respond, delay);
        else respond();
      } else if (url.pathname === '/protected-stream401' && req.headers.authorization !== 'Bearer fresh-token') {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.flushHeaders();
        res.write('{"message":');
        completeUnauthorizedBody = () => res.end('"Original API unauthorized","code":"expired_access_token"}');
      } else if (url.pathname.startsWith('/protected')) {
        const authorized = req.headers.authorization === 'Bearer fresh-token' && url.pathname !== '/protected-always401';
        const respond = () => {
          res.writeHead(authorized ? 200 : 401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(authorized
            ? { method: req.method, body, query: [...url.searchParams], authorization: req.headers.authorization }
            : { message: 'Original API unauthorized', code: 'expired_access_token' }));
        };
        const delay = Number(url.searchParams.get(authorized ? 'replayDelay' : 'delay') || 0);
        if (delay) setTimeout(respond, delay);
        else respond();
      } else if (url.pathname === '/slow') {
        const timer = setTimeout(() => res.end('{"done":true}'), 200);
        res.once('close', () => clearTimeout(timer));
      } else if (url.pathname === '/empty204') {
        res.writeHead(204).end();
      } else if (url.pathname === '/empty200') {
        res.end();
      } else if (url.pathname === '/malformed') {
        res.end('not json');
      } else if (url.pathname === '/error') {
        res.writeHead(Number(url.searchParams.get('status') || 422), { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Validation failed', errors: { name: ['Required'] } }));
      } else if (url.pathname === '/error-text') {
        res.writeHead(503).end('Temporarily unavailable');
      } else if (url.pathname === '/text') {
        res.writeHead(200, { 'Content-Type': 'text/plain' }).end('hello');
      } else if (url.pathname === '/binary') {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' }).end(Buffer.from([0, 1, 127, 255]));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ method: req.method, headers: req.headers, body, query: [...url.searchParams], path: url.pathname }));
      }
    } catch (error) { res.writeHead(500).end(String(error)); }
  });
  http.listen(0, '127.0.0.1');
  await once(http, 'listening');
  origin = `http://127.0.0.1:${http.address().port}`;
});

after(async () => {
  delete globalThis.window;
  delete globalThis.document;
  if (http) {
    http.closeAllConnections();
    await new Promise((resolve) => http.close(resolve));
  }
  await vite?.close();
});

function fixture(overrides = {}) {
  const listeners = new Set();
  const calls = [];
  const bridge = {
    getAuthToken: async () => 'native-token',
    getInitParams: async () => ({ example: 1 }),
    getLocalization: async () => ({ language: 'km-KH', localization: 'km' }),
    setTitle: (title) => calls.push(['title', title]),
    setPullToRefreshEnabled: (enabled) => calls.push(['refresh', enabled]),
    ready: () => calls.push(['ready']),
    on: (event, callback) => {
      assert.ok(['onLanguageChanged', 'tokenRefreshed'].includes(event));
      callback.event = event;
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    ...overrides,
  };
  return { bridge, listeners, calls, emit: (data, event = 'onLanguageChanged') =>
    listeners.forEach((callback) => { if (callback.event === event) callback(data); }) };
}

test('bridge: immediately injected native bridge', async () => {
  const { bridge } = fixture();
  window.superApp = bridge;
  assert.equal(await resolveBridge({ signal: new AbortController().signal }), bridge);
  delete window.superApp;
});

test('bridge: delayed injection, timeout, and successful retry', async () => {
  delete window.superApp;
  await assert.rejects(resolveBridge({ signal: new AbortController().signal, timeoutMs: 15 }), /Unable to connect/);
  const { bridge } = fixture();
  const timer = setTimeout(() => { window.superApp = bridge; }, 15);
  try {
    assert.equal(await resolveBridge({ signal: new AbortController().signal, timeoutMs: 250 }), bridge);
  } finally { clearTimeout(timer); delete window.superApp; }
});

test('bridge: cancellation during discovery and before discovery', async () => {
  const controller = new AbortController();
  const pending = resolveBridge({ signal: controller.signal, timeoutMs: 1_000 });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  await assert.rejects(resolveBridge({ signal: controller.signal }), { name: 'AbortError' });
});

test('bootstrap: auth, JSON launch parameters, localization, and readiness', async () => {
  useMiniAppStore.getState().reset();
  const f = fixture({ getInitParams: async () => '{"merchant":"example"}' });
  const dispose = await initializeBridge(f.bridge, { signal: new AbortController().signal });
  const state = useMiniAppStore.getState();
  assert.equal(state.superApp, f.bridge);
  assert.equal(state.authToken, 'native-token');
  assert.deepEqual(state.initParams, { merchant: 'example' });
  assert.equal(state.language, 'km');
  assert.deepEqual(f.calls, [['title', 'Mini App'], ['refresh', false], ['ready']]);
  f.emit({ language: 'en-US' });
  assert.equal(useMiniAppStore.getState().language, 'en');
  dispose();
  dispose();
  assert.equal(f.listeners.size, 0);
});

test('bootstrap: missing token is allowed without synthesizing credentials', async () => {
  const f = fixture({ getAuthToken: async () => '' });
  const dispose = await initializeBridge(f.bridge, { signal: new AbortController().signal });
  assert.equal(useMiniAppStore.getState().authToken, '');
  dispose();
});

test('bootstrap: optional methods can throw or never resolve', async () => {
  const f = fixture({
    getInitParams: () => { throw new Error('Unsupported'); },
    getLocalization: () => new Promise(() => {}),
  });
  const dispose = await initializeBridge(f.bridge, { signal: new AbortController().signal, timeoutMs: 15 });
  assert.deepEqual(useMiniAppStore.getState().initParams, {});
  assert.equal(useMiniAppStore.getState().language, 'en');
  dispose();
});

test('bootstrap: malformed launch values fall back to an empty map', async () => {
  for (const value of ['{invalid', '[]', null, 123]) {
    const f = fixture({ getInitParams: async () => value });
    const dispose = await initializeBridge(f.bridge, { signal: new AbortController().signal });
    assert.deepEqual(useMiniAppStore.getState().initParams, {});
    dispose();
  }
});

test('bootstrap: newer language events win over a stale initial locale', async () => {
  let resolveAuth;
  const f = fixture({ getAuthToken: () => new Promise((resolve) => { resolveAuth = resolve; }) });
  const pending = initializeBridge(f.bridge, { signal: new AbortController().signal });
  await new Promise(setImmediate);
  f.emit({ language: 'en' });
  resolveAuth('token');
  const dispose = await pending;
  assert.equal(useMiniAppStore.getState().language, 'en');
  dispose();
});

test('bootstrap: native resume token updates are used by HTTP without replacing the session', async () => {
  useMiniAppStore.getState().reset();
  const f = fixture();
  const dispose = await initializeBridge(f.bridge, { signal: new AbortController().signal });
  try {
    const version = useMiniAppStore.getState().sessionVersion;
    f.emit({ token: 'fresh-token' }, 'tokenRefreshed');
    const api = createApiClient({ baseUrl: origin, getToken: () => useMiniAppStore.getState().authToken });
    assert.equal((await api.get('/protected')).authorization, 'Bearer fresh-token');
    assert.equal(useMiniAppStore.getState().sessionVersion, version);
    for (const data of [null, 'token', {}, { token: 123 }, { token: '   ' }]) f.emit(data, 'tokenRefreshed');
    assert.equal(useMiniAppStore.getState().authToken, 'fresh-token');
    f.emit({ token: '' }, 'tokenRefreshed');
    assert.equal(useMiniAppStore.getState().authToken, '');
    assert.equal(useMiniAppStore.getState().sessionVersion, version + 1);
    f.emit({ token: 'late-token' }, 'tokenRefreshed');
    assert.equal(useMiniAppStore.getState().authToken, '');
  } finally { dispose(); }
});

test('bootstrap: a token pushed during initialization wins over a stale getAuthToken result', async () => {
  useMiniAppStore.getState().reset();
  let resolveAuth;
  const f = fixture({ getAuthToken: () => new Promise((resolve) => { resolveAuth = resolve; }) });
  const pending = initializeBridge(f.bridge, { signal: new AbortController().signal });
  await new Promise(setImmediate);
  f.emit({ token: 'fresh-token' }, 'tokenRefreshed');
  resolveAuth('stale-token');
  const dispose = await pending;
  assert.equal(useMiniAppStore.getState().authToken, 'fresh-token');
  dispose();
  f.emit({ token: 'disposed-token' }, 'tokenRefreshed');
  assert.equal(useMiniAppStore.getState().authToken, 'fresh-token');
});

test('bootstrap: token events from a replaced session cannot overwrite credentials', async () => {
  useMiniAppStore.getState().reset();
  const f = fixture();
  const dispose = await initializeBridge(f.bridge, { signal: new AbortController().signal });
  useMiniAppStore.getState().setAuthToken('replacement-session');
  f.emit({ token: 'late-token' }, 'tokenRefreshed');
  assert.equal(useMiniAppStore.getState().authToken, 'replacement-session');
  dispose();
});

test('bootstrap: auth failure/timeout and invalid tokens are recoverable', async () => {
  for (const getAuthToken of [
    () => Promise.reject(new Error('Auth unavailable')),
    () => new Promise(() => {}),
    async () => null,
  ]) {
    useMiniAppStore.getState().reset();
    const f = fixture({ getAuthToken });
    await assert.rejects(initializeBridge(f.bridge, { signal: new AbortController().signal, timeoutMs: 15, authTimeoutMs: 15 }));
    assert.equal(f.listeners.size, 0);
    assert.equal(f.calls.some(([call]) => call === 'ready'), false);
    assert.equal(useMiniAppStore.getState().authToken, '');
    const retry = fixture();
    const dispose = await initializeBridge(retry.bridge, { signal: new AbortController().signal });
    assert.equal(useMiniAppStore.getState().authToken, 'native-token');
    dispose();
  }
});

test('bootstrap: abort prevents late initialization and ready calls', async () => {
  let resolveAuth;
  const controller = new AbortController();
  const f = fixture({ getAuthToken: () => new Promise((resolve) => { resolveAuth = resolve; }) });
  const pending = initializeBridge(f.bridge, { signal: controller.signal });
  await new Promise(setImmediate);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  resolveAuth('late-token');
  await new Promise(setImmediate);
  assert.equal(f.listeners.size, 0);
  assert.equal(f.calls.some(([call]) => call === 'ready'), false);
  assert.notEqual(useMiniAppStore.getState().authToken, 'late-token');
});

test('bootstrap: Strict Mode style setup/cleanup/setup leaves one listener per event', async () => {
  const f = fixture();
  const first = new AbortController();
  const dispose = await initializeBridge(f.bridge, { signal: first.signal });
  first.abort();
  dispose();
  const second = new AbortController();
  const disposeAgain = await initializeBridge(f.bridge, { signal: second.signal });
  assert.equal(f.listeners.size, 2);
  second.abort();
  disposeAgain();
  assert.equal(f.listeners.size, 0);
});

test('bootstrap: hosts returning no unsubscribe cannot mutate state after disposal', async () => {
  let callback;
  const f = fixture({ on: (_event, cb) => { callback = cb; } });
  const controller = new AbortController();
  const dispose = await initializeBridge(f.bridge, { signal: controller.signal });
  controller.abort();
  dispose();
  useMiniAppStore.getState().setLanguage('en');
  callback({ language: 'km' });
  assert.equal(useMiniAppStore.getState().language, 'en');
});

test('mock bridge: token changes, URL launch parameters, and language events', async () => {
  window.location = { search: '?source=search&example=1', hash: '#/?source=hash&other=2' };
  const mock = createMockBridge();
  assert.equal(await mock.bridge.getAuthToken(), '');
  mock.setToken('updated');
  assert.equal(await mock.bridge.getAuthToken(), 'updated');
  assert.deepEqual(await mock.bridge.getInitParams(), { source: 'search', example: '1', other: '2' });
  const received = [];
  const unsubscribe = mock.bridge.on('onLanguageChanged', (value) => received.push(value));
  mock.setLanguage('km');
  assert.deepEqual(await mock.bridge.getLocalization(), { language: 'km', localization: 'km' });
  assert.deepEqual(received, [{ language: 'km' }]);
  unsubscribe();
  mock.setLanguage('en');
  assert.equal(received.length, 1);
  assert.equal((await mock.bridge.openPrinterSettings()).success, false);
  assert.equal(typeof mock.bridge.printText, 'function');
});

test('HTTP: GET query encoding, base path, and current auth token', async () => {
  const api = createApiClient({ baseUrl: origin + '/v1/', getToken: () => useMiniAppStore.getState().authToken });
  useMiniAppStore.getState().setAuthToken('first-token');
  const first = await api.get('/echo?existing=yes', {
    query: { search: 'a & ខ្មែរ', ids: [1, 2], active: false, page: 0, absent: undefined, empty: null },
  });
  assert.equal(first.path, '/v1/echo');
  assert.deepEqual(first.query, [['existing', 'yes'], ['search', 'a & ខ្មែរ'], ['ids', '1'], ['ids', '2'], ['active', 'false'], ['page', '0']]);
  assert.equal(first.headers.authorization, 'Bearer first-token');
  assert.equal(first.headers['content-type'], undefined);
  useMiniAppStore.getState().setAuthToken('second-token');
  assert.equal((await api.get('/echo')).headers.authorization, 'Bearer second-token');
  assert.equal((await api.get('/echo', { auth: false })).headers.authorization, undefined);
  assert.equal((await api.get('/echo', { headers: { Authorization: 'Custom' } })).headers.authorization, 'Custom');
  useMiniAppStore.getState().setAuthToken('');
  assert.equal((await api.get('/echo')).headers.authorization, undefined);
});

test('HTTP: JSON CRUD bodies and a bodyless DELETE', async () => {
  const api = createApiClient({ baseUrl: origin });
  for (const method of ['post', 'put', 'patch']) {
    const value = await api[method]('/echo', { name: 'example' });
    assert.equal(value.method, method.toUpperCase());
    assert.equal(value.headers['content-type'], 'application/json');
    assert.deepEqual(JSON.parse(value.body), { name: 'example' });
  }
  const value = await api.delete('/echo');
  assert.equal(value.method, 'DELETE');
  assert.equal(value.headers['content-type'], undefined);
  const withBody = await api.delete('/echo', { body: { ids: [1] } });
  assert.deepEqual(JSON.parse(withBody.body), { ids: [1] });
});

test('HTTP: multipart uploads let the browser set the boundary', async () => {
  const api = createApiClient({ baseUrl: origin });
  const form = new FormData();
  form.append('label', 'example');
  form.append('file', new Blob(['hello'], { type: 'text/plain' }), 'hello.txt');
  const result = await api.post('/echo', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  const boundary = result.headers['content-type'].match(/boundary=(.+)$/)?.[1];
  assert.ok(boundary);
  assert.ok(result.body.includes('--' + boundary));
  assert.ok(result.body.includes('name="file"; filename="hello.txt"'));
  assert.ok(result.body.includes('hello'));
});

test('HTTP: URL-encoded and binary request bodies are not JSON encoded', async () => {
  const api = createApiClient({ baseUrl: origin });
  const encoded = await api.post('/echo', new URLSearchParams({ name: 'A B' }));
  assert.match(encoded.headers['content-type'], /application\/x-www-form-urlencoded/);
  assert.equal(encoded.body, 'name=A+B');
  const binary = await api.post('/echo', new Blob(['binary'], { type: 'application/octet-stream' }));
  assert.equal(binary.headers['content-type'], 'application/octet-stream');
  assert.equal(binary.body, 'binary');
});

test('HTTP: text, binary downloads, and empty responses', async () => {
  const api = createApiClient({ baseUrl: origin });
  assert.equal(await api.get('/text', { responseType: 'text' }), 'hello');
  const blob = await api.get('/binary', { responseType: 'blob' });
  assert.equal(blob.type, 'application/octet-stream');
  assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())], [0, 1, 127, 255]);
  assert.equal(await api.get('/empty204'), undefined);
  assert.equal(await api.get('/empty200'), undefined);
  assert.equal(await api.request('HEAD', '/echo'), undefined);
});

test('HTTP: structured validation/auth/server errors preserve status and response', async () => {
  const api = createApiClient({ baseUrl: origin });
  for (const status of [401, 403, 422, 500]) {
    await assert.rejects(api.get('/error', { query: { status } }), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.kind, 'http');
      assert.equal(error.status, status);
      assert.equal(error.message, 'Validation failed');
      assert.deepEqual(error.data.errors, { name: ['Required'] });
      assert.equal(error.method, 'GET');
      return true;
    });
  }
  await assert.rejects(api.get('/error-text'), (error) =>
    error.kind === 'http' && error.status === 503 && error.data === 'Temporarily unavailable');
});

test('HTTP: malformed JSON keeps status and raw response details', async () => {
  await assert.rejects(createApiClient({ baseUrl: origin }).get('/malformed'), (error) =>
    error instanceof ApiError && error.kind === 'parse' && error.status === 200 && error.data === 'not json');
});

test('HTTP: timeouts, cancellation, and network failures remain distinguishable', async () => {
  const api = createApiClient({ baseUrl: origin, timeoutMs: 20 });
  await assert.rejects(api.get('/slow'), (error) => error.kind === 'timeout');
  const controller = new AbortController();
  const pending = api.get('/slow', { signal: controller.signal, timeoutMs: 1_000 });
  controller.abort();
  await assert.rejects(pending, (error) => error.kind === 'aborted');
  await assert.rejects(api.get('/echo', { signal: controller.signal }), (error) => error.kind === 'aborted');
  const failing = createApiClient({ fetch: async () => { throw new TypeError('offline'); } });
  await assert.rejects(failing.get('/echo'), (error) => error.kind === 'network' && error.cause.message === 'offline');
});

test('HTTP: mutation failures are never retried', async () => {
  const api = createApiClient({ baseUrl: origin });
  const before = writes.get('/error') ?? 0;
  await assert.rejects(api.post('/error', { name: 'example' }));
  assert.equal(writes.get('/error'), before + 1);
});

test('HTTP: endpoint paths cannot send a bearer token to another origin', async () => {
  let called = false;
  const api = createApiClient({ getToken: () => 'private', fetch: async () => { called = true; } });
  await assert.rejects(api.get('https://other.example/path'), TypeError);
  await assert.rejects(api.get('//other.example/path'), TypeError);
  await assert.rejects(api.get('\\other.example/path'), TypeError);
  await assert.rejects(api.get('\t/other.example/path'), TypeError);
  assert.equal(called, false);
});


function refreshingClient(overrides = {}) {
  let token = 'expired-token';
  let refreshes = 0;
  const api = createApiClient({
    baseUrl: origin,
    getToken: () => token,
    refreshAuthToken: async () => {
      refreshes++;
      await new Promise((resolve) => setTimeout(resolve, 20));
      token = 'fresh-token';
      return token;
    },
    ...overrides,
  });
  return { api, refreshes: () => refreshes, token: () => token };
}

function expiringWriteToken(seconds = -60) {
  return `fixture.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds })).toString('base64url')}.signature`;
}

test('auth preflight: concurrent writes and a rejected read share refresh before any writes', async () => {
  let token = expiringWriteToken();
  let refreshes = 0;
  const api = createApiClient({ baseUrl: origin, getToken: () => token, refreshAuthToken: async () => {
    refreshes++;
    await new Promise((resolve) => setTimeout(resolve, 50));
    token = 'fresh-token';
    return token;
  } });
  const path = '/services/central/api/name/staff-order-save/exec';
  const before = writes.get(path) ?? 0;
  const payload = { customer: 'fixture', items: [{ product_code: 'fixture', quantity: 1 }] };
  const values = await Promise.all([api.post(path, payload), api.post(path, payload), api.get('/protected')]);
  assert.equal(refreshes, 1);
  assert.equal(writes.get(path), before + 2);
  assert.deepEqual(values.slice(0, 2).map((value) => JSON.parse(value.body)), [payload, payload]);
  assert.ok(values.every((value) => value.authorization === 'Bearer fresh-token'));
});

test('auth preflight: unavailable, unchanged, and still-expiring credentials send no writes', async () => {
  const token = expiringWriteToken();
  for (const refreshAuthToken of [undefined, async () => null, async () => token,
    async () => expiringWriteToken(-30), async () => expiringWriteToken(15),
    async () => { throw new Error('Refresh unavailable'); }]) {
    const api = createApiClient({ baseUrl: origin, getToken: () => token, refreshAuthToken });
    const before = writes.get('/protected-write') ?? 0;
    await assert.rejects(api.post('/protected-write', {}), (error) => error.status === 401);
    assert.equal(writes.get('/protected-write') ?? 0, before);
  }
});

test('auth preflight: cancellation of one write leaves shared refresh available to another', async () => {
  const controller = new AbortController();
  let token = expiringWriteToken();
  let refreshes = 0;
  const api = createApiClient({ baseUrl: origin, getToken: () => token, refreshAuthToken: async () => {
    refreshes++;
    controller.abort();
    await new Promise((resolve) => setTimeout(resolve, 20));
    return token = 'fresh-token';
  } });
  const before = writes.get('/protected-write') ?? 0;
  const values = await Promise.allSettled([
    api.post('/protected-write', {}, { signal: controller.signal }), api.post('/protected-write', {}),
  ]);
  assert.equal(values[0].reason.kind, 'aborted');
  assert.equal(values[1].status, 'fulfilled');
  assert.equal(refreshes, 1);
  assert.equal(writes.get('/protected-write'), before + 1);
});

test('auth preflight: changing session while refreshing prevents the write', async () => {
  let session = 1;
  const api = createApiClient({ baseUrl: origin, getToken: () => expiringWriteToken(), getAuthSession: () => session,
    refreshAuthToken: async () => { session++; return 'fresh-token'; } });
  const before = writes.get('/protected-write') ?? 0;
  await assert.rejects(api.post('/protected-write', {}), (error) => error.kind === 'aborted');
  assert.equal(writes.get('/protected-write') ?? 0, before);
});

test('auth preflight: refresh has a separate deadline and a fresh resource timeout', async () => {
  for (const authRefreshTimeoutMs of [20, 1000]) {
    let token = expiringWriteToken();
    const api = createApiClient({ baseUrl: origin, getToken: () => token, authRefreshTimeoutMs,
      refreshAuthToken: async () => { await new Promise((resolve) => setTimeout(resolve, 100)); return token = 'fresh-token'; } });
    const before = writes.get('/protected-write') ?? 0;
    const operation = api.post('/protected-write', {}, { timeoutMs: 50 });
    if (authRefreshTimeoutMs === 20) {
      await assert.rejects(operation, (error) => error.kind === 'timeout');
      assert.equal(writes.get('/protected-write') ?? 0, before);
    } else {
      assert.equal((await operation).authorization, 'Bearer fresh-token');
      assert.equal(writes.get('/protected-write'), before + 1);
    }
  }
});

test('auth preflight: a real 401 still refreshes immediately and replays only once', async () => {
  let token = expiringWriteToken();
  let refreshes = 0;
  const api = createApiClient({ baseUrl: origin, getToken: () => token,
    refreshAuthToken: async () => { refreshes++; return token = `fresh-token-${refreshes}`; } });
  const before = writes.get('/protected-always401') ?? 0;
  await assert.rejects(api.post('/protected-always401', {}), (error) => error.status === 401);
  assert.equal(refreshes, 2, 'One preflight refresh and one reactive refresh; no rejection loop.');
  assert.equal(writes.get('/protected-always401'), before + 2);
});

test('auth preflight: public requests and caller Authorization bypass managed write refresh', async () => {
  let refreshes = 0;
  const api = createApiClient({ baseUrl: origin, getToken: () => expiringWriteToken(),
    refreshAuthToken: async () => { refreshes++; return 'fresh-token'; } });
  await assert.rejects(api.post('/protected-write', {}, { auth: false }), (error) => error.status === 401);
  await assert.rejects(api.post('/protected-write', {}, { headers: { Authorization: 'Bearer custom' } }), (error) => error.status === 401);
  assert.equal(refreshes, 0);
});

test('auth refresh: replays a 401 once and persists the new access token', async () => {
  const f = refreshingClient();
  const value = await f.api.get('/protected');
  assert.equal(value.authorization, 'Bearer fresh-token');
  assert.equal(f.refreshes(), 1);
  assert.equal(f.token(), 'fresh-token');
  await f.api.get('/protected');
  assert.equal(f.refreshes(), 1);
});

test('auth refresh: starts on the first 401 headers before the unauthorized body finishes', async () => {
  let refreshes = 0;
  const f = refreshingClient({ refreshAuthToken: async () => {
    refreshes++;
    completeUnauthorizedBody?.();
    return 'fresh-token';
  } });
  try {
    const value = await f.api.get('/protected-stream401', { timeoutMs: 300 });
    assert.equal(value.authorization, 'Bearer fresh-token');
    assert.equal(refreshes, 1);
  } finally { completeUnauthorizedBody?.(); completeUnauthorizedBody = undefined; }
});

test('auth refresh: the first query stays pending through slow refresh and replay, without Retry', async () => {
  const { QueryClient } = await import('@tanstack/react-query');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const states = [];
  const unsubscribe = client.getQueryCache().subscribe((event) => states.push(event.query.state.status));
  let refreshes = 0;
  const f = refreshingClient({ refreshAuthToken: async () => {
    refreshes++;
    await new Promise((resolve) => setTimeout(resolve, 250));
    return 'fresh-token';
  } });
  try {
    const value = await client.fetchQuery({
      queryKey: ['first-401-refresh'],
      queryFn: ({ signal }) => f.api.get('/protected', {
        signal, timeoutMs: 300, query: { delay: 150, replayDelay: 150 },
      }),
    });
    assert.equal(value.authorization, 'Bearer fresh-token');
    assert.equal(refreshes, 1);
    assert.equal(states.includes('error'), false);
    assert.equal(client.getQueryState(['first-401-refresh']).status, 'success');
  } finally { unsubscribe(); client.clear(); }
});

test('auth refresh: cancellation still wins while reading a delayed 401 body after refresh failure', async () => {
  let markRefreshStarted;
  const started = new Promise((resolve) => { markRefreshStarted = resolve; });
  const f = refreshingClient({ refreshAuthToken: async () => { markRefreshStarted(); return null; } });
  const controller = new AbortController();
  const rejected = assert.rejects(
    f.api.get('/protected-stream401', { signal: controller.signal, timeoutMs: 500 }),
    (error) => error.kind === 'aborted',
  );
  try {
    await started;
    controller.abort();
    await rejected;
  } finally { completeUnauthorizedBody?.(); completeUnauthorizedBody = undefined; }
});

test('auth refresh: concurrent and delayed 401 responses share one refresh', async () => {
  const f = refreshingClient();
  const values = await Promise.all([
    f.api.get('/protected'),
    f.api.get('/protected'),
    f.api.get('/protected', { query: { delay: 70 } }),
  ]);
  assert.equal(values.length, 3);
  assert.equal(f.refreshes(), 1);
});

test('auth refresh: the screenshot Central 500 wrapper refreshes and replays the read once', async () => {
  const f = refreshingClient();
  const value = await f.api.get(wrappedReadPath, { query: { id: 32 } });
  assert.equal(value.authorization, 'Bearer fresh-token');
  assert.deepEqual(value.query, [['id', '32']]);
  assert.equal(f.refreshes(), 1);
});

test('auth refresh: wrapped SFA errors and direct 401s share one refresh', async () => {
  const f = refreshingClient();
  const values = await Promise.all([
    f.api.get(wrappedReadPath), f.api.get('/protected'),
    f.api.get(wrappedReadPath, { query: { delay: 70 } }),
  ]);
  assert.ok(values.every((value) => value.authorization === 'Bearer fresh-token'));
  assert.equal(f.refreshes(), 1);
});

test('auth refresh: failed refresh and a rejected replay preserve the wrapped 500 without looping', async () => {
  for (const overrides of [{}, { refreshAuthToken: async () => null }, { refreshAuthToken: async () => { throw new Error('unavailable'); } }]) {
    const f = refreshingClient(overrides);
    await assert.rejects(f.api.get(wrappedReadPath, { query: { always: 1 } }), (error) => {
      assert.equal(error.status, 500);
      assert.deepEqual(error.data, wrappedSfaError());
      return true;
    });
    assert.ok(f.refreshes() <= 1);
  }
});

test('auth refresh: wrapped errors on writes, other endpoints, other failures, and custom/public auth do not refresh', async () => {
  const f = refreshingClient();
  const reject500 = (operation) => assert.rejects(operation, (error) => error.status === 500);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const path = '/services/central/api/name/staff-order-save/exec';
    const before = writes.get(path) ?? 0;
    await reject500(f.api.request(method, path, { body: { customer: 'fixture' } }));
    assert.equal(writes.get(path), before + 1);
    await reject500(f.api.request(method, wrappedReadPath));
  }
  await reject500(f.api.get('/wrapped-other'));
  for (const variant of ['revoked', 'wrong-code', 'other-error', 'other-proxy', 'forbidden', 'malformed']) {
    await reject500(f.api.get(wrappedReadPath, { query: { variant } }));
  }
  await reject500(f.api.get(wrappedReadPath, { auth: false }));
  await reject500(f.api.get(wrappedReadPath, { headers: { Authorization: 'Bearer custom' } }));
  await assert.rejects(f.api.get(wrappedReadPath, { query: { status: 403 } }), (error) => error.status === 403);
  assert.equal(f.refreshes(), 0);
});

test('auth refresh: JSON writes and query parameters survive exactly one replay', async () => {
  const f = refreshingClient();
  const before = writes.get('/protected-write') ?? 0;
  const value = await f.api.post('/protected-write', { name: 'example' }, { query: { page: 2 } });
  assert.equal(value.method, 'POST');
  assert.deepEqual(JSON.parse(value.body), { name: 'example' });
  assert.deepEqual(value.query, [['page', '2']]);
  assert.equal(writes.get('/protected-write'), before + 2);
  assert.equal(f.refreshes(), 1);
});

test('auth refresh: multipart bodies survive replay', async () => {
  const f = refreshingClient();
  const form = new FormData();
  form.append('file', new Blob(['upload-content']), 'example.txt');
  const value = await f.api.post('/protected-upload', form);
  assert.ok(value.body.includes('upload-content'));
  assert.ok(value.body.includes('filename="example.txt"'));
  assert.equal(f.refreshes(), 1);
});

test('auth refresh: a second 401 is returned without a refresh loop', async () => {
  const f = refreshingClient();
  await assert.rejects(f.api.get('/protected-always401'), (error) =>
    error.status === 401 && error.data.code === 'expired_access_token');
  assert.equal(f.refreshes(), 1);
});

test('auth refresh: failure, malformed responses, and timeouts preserve the original 401', async () => {
  for (const refreshAuthToken of [
    async () => { throw new Error('Refresh endpoint returned 503'); },
    async () => null,
    async () => '',
    async () => ({ access_token: 'wrong-shape' }),
    async () => 'expired-token',
    () => new Promise(() => {}),
  ]) {
    const f = refreshingClient({ refreshAuthToken, timeoutMs: 50, authRefreshTimeoutMs: 50 });
    await assert.rejects(f.api.get('/protected'), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 401);
      assert.equal(error.message, 'Original API unauthorized');
      assert.deepEqual(error.data, { message: 'Original API unauthorized', code: 'expired_access_token' });
      return true;
    });
  }
});

test('auth refresh: cancellation of one caller does not cancel the shared refresh', async () => {
  const f = refreshingClient();
  const controller = new AbortController();
  const first = f.api.get('/protected', { signal: controller.signal });
  const second = f.api.get('/protected');
  setTimeout(() => controller.abort(), 10);
  await assert.rejects(first, (error) => error.kind === 'aborted');
  assert.equal((await second).authorization, 'Bearer fresh-token');
  assert.equal(f.refreshes(), 1);
});

test('auth refresh: public requests, custom auth, 403, and 500 never refresh', async () => {
  const f = refreshingClient();
  await assert.rejects(f.api.get('/protected', { auth: false }), (error) => error.status === 401);
  await assert.rejects(f.api.get('/protected', { headers: { Authorization: 'Bearer custom' } }), (error) => error.status === 401);
  for (const status of [403, 500]) {
    await assert.rejects(f.api.get('/error', { query: { status } }), (error) => error.status === status);
  }
  assert.equal(f.refreshes(), 0);
});

test('auth refresh: session replacement during refresh prevents replay', async () => {
  let session = 1;
  let calls = 0;
  const f = refreshingClient({
    getAuthSession: () => session,
    refreshAuthToken: async () => { calls++; session++; return 'fresh-token'; },
  });
  await assert.rejects(f.api.get('/protected'), (error) => error.status === 401);
  assert.equal(calls, 1);
});

test('native refresh: unsupported or failing hosts preserve the 401', async () => {
  for (const bridge of [{}, { refreshAuthToken: async () => { throw new Error('Native refresh failed'); } }]) {
    useMiniAppStore.getState().reset();
    useMiniAppStore.setState({ superApp: bridge, authToken: 'expired-token' });
    const api = createApiClient({ baseUrl: origin, getToken: () => useMiniAppStore.getState().authToken, refreshAuthToken: refreshNativeAuthToken });
    await assert.rejects(api.get('/protected'), (error) => error.status === 401);
    assert.equal(useMiniAppStore.getState().authToken, 'expired-token');
  }
});

test('native refresh: token rotation keeps the session version and active query intact', async () => {
  const { QueryClient } = await import('@tanstack/react-query');
  useMiniAppStore.getState().reset();
  let nativeCalls = 0;
  useMiniAppStore.setState({
    authToken: 'expired-token',
    superApp: { refreshAuthToken: async (token) => { assert.equal(token, 'expired-token'); nativeCalls++; return 'fresh-token'; } },
  });
  const version = useMiniAppStore.getState().sessionVersion;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const unsubscribe = useMiniAppStore.subscribe((state, previous) => {
    if (state.sessionVersion !== previous.sessionVersion) { void client.cancelQueries(); client.clear(); }
  });
  try {
    const api = createApiClient({
      baseUrl: origin,
      getToken: () => useMiniAppStore.getState().authToken,
      getAuthSession: () => useMiniAppStore.getState().sessionVersion,
      refreshAuthToken: refreshNativeAuthToken,
    });
    const value = await client.fetchQuery({ queryKey: ['protected'], queryFn: ({ signal }) => api.get('/protected', { signal }) });
    assert.equal(value.authorization, 'Bearer fresh-token');
    assert.equal(nativeCalls, 1);
    assert.equal(useMiniAppStore.getState().authToken, 'fresh-token');
    assert.equal(useMiniAppStore.getState().sessionVersion, version);
    assert.equal(client.getQueryState(['protected']).status, 'success');
  } finally { unsubscribe(); client.clear(); }
});

test('native refresh: late responses cannot restore a logged-out session', async () => {
  let complete;
  useMiniAppStore.getState().reset();
  useMiniAppStore.setState({ authToken: 'expired-token', superApp: { refreshAuthToken: () => new Promise((resolve) => { complete = resolve; }) } });
  const pending = refreshNativeAuthToken('expired-token');
  await new Promise(setImmediate);
  useMiniAppStore.getState().reset();
  assert.equal(await pending, null);
  complete('fresh-token');
  await new Promise(setImmediate);
  assert.equal(useMiniAppStore.getState().authToken, '');
});


test('auth refresh: a fast failed refresh is shared by the original request wave', async () => {
  let calls = 0;
  const f = refreshingClient({ refreshAuthToken: async () => { calls++; return null; } });
  const results = await Promise.allSettled([
    f.api.get('/protected'),
    f.api.get('/protected'),
    f.api.get('/protected', { query: { delay: 30 } }),
  ]);
  assert.ok(results.every((result) => result.status === 'rejected' && result.reason.status === 401));
  assert.equal(calls, 1);
  await assert.rejects(f.api.get('/protected'), (error) => error.status === 401);
  assert.equal(calls, 2);
});


test('bootstrap: native auth refresh has its own deadline beyond optional bridge calls', async () => {
  useMiniAppStore.getState().reset();
  const f = fixture({
    getAuthToken: async () => { await new Promise((resolve) => setTimeout(resolve, 45)); return 'refreshed-startup-token'; },
    getInitParams: () => new Promise(() => {}),
  });
  const dispose = await initializeBridge(f.bridge, {
    signal: new AbortController().signal, timeoutMs: 10, authTimeoutMs: 250,
  });
  try {
    assert.equal(useMiniAppStore.getState().authToken, 'refreshed-startup-token');
    assert.deepEqual(useMiniAppStore.getState().initParams, {});
    assert.ok(f.calls.some(([action]) => action === 'ready'));
  } finally { dispose(); }
});

test('auth diagnostics: concurrent recovery is correlated without logging tokens, headers, or queries', async () => {
  const events = [];
  const f = refreshingClient({ onAuthDiagnostic: (event) => events.push(event) });
  await Promise.all([
    f.api.get('/protected?access_token=private-query', { headers: { 'X-Private': 'private-header' } }),
    f.api.get('/protected'),
  ]);
  assert.equal(events.filter((e) => e.phase === 'refresh_start').length, 1);
  assert.equal(events.filter((e) => e.phase === 'refresh_result' && e.result === 'success').length, 1);
  assert.equal(events.filter((e) => e.phase === 'replay_start').length, 2);
  assert.equal(events.filter((e) => e.phase === 'request_end' && e.result === 'success').length, 2);
  for (const id of new Set(events.map((e) => e.requestId))) {
    const requestEvents = events.filter((e) => e.requestId === id);
    assert.deepEqual(requestEvents.filter((e) => e.phase === 'response').map((e) => e.status), [401, 200]);
    assert.ok(requestEvents.every((e) => e.path === '/protected' && e.elapsedMs >= 0));
  }
  assert.doesNotMatch(JSON.stringify(events), /expired-token|fresh-token|Bearer|private-query|private-header|Authorization|authorization/);
});

test('auth diagnostics: wrapped failures expose only fixed indicators and do not refresh generic 500s', async () => {
  const events = [];
  const f = refreshingClient({ onAuthDiagnostic: (event) => events.push(event) });
  await f.api.get(wrappedReadPath);
  const expired = events.find((e) => e.phase === 'auth_rejection');
  assert.equal(expired.reason, 'sfa_expired');
  assert.equal(expired.indicators.expiredToken, true);
  assert.equal(expired.indicators.internalMicroserviceExpired, false);
  events.length = 0;
  await assert.rejects(f.api.get('/error', { query: { status: 500 } }), (error) => error.status === 500);
  assert.equal(events.find((e) => e.phase === 'auth_rejection').reason, 'unrecognized');
  assert.equal(events.some((e) => e.phase === 'refresh_start'), false);
  assert.doesNotMatch(JSON.stringify(events), /Validation failed|errors|Required/);

  const { inspectSfaAuthError } = await vite.ssrLoadModule('/src/services/api/auth-diagnostics.ts');
  const wrapper = wrappedSfaError();
  wrapper.private = 'private-body-secret';
  const safe = inspectSfaAuthError(wrapper);
  assert.ok(Object.values(safe).every((value) => typeof value === 'boolean'));
  assert.doesNotMatch(JSON.stringify(safe), /private-body-secret|Token has expired|http:\/\//);
});

test('auth diagnostics: throwing listeners cannot interrupt refresh, replay, or original errors', async () => {
  const f = refreshingClient({ onAuthDiagnostic: () => { throw new Error('Broken diagnostic sink'); } });
  assert.equal((await f.api.get('/protected')).authorization, 'Bearer fresh-token');
  assert.equal(f.refreshes(), 1);
  await assert.rejects(f.api.get('/error', { query: { status: 500 } }), (error) => error.status === 500);
});

test('auth refresh: captured internal wrapper recovers only when the caller access token is also expired', async () => {
  for (const expiry of [-60, 3600, null]) {
    let token = expiry === null ? 'opaque-token' : `fixture.${Buffer.from(JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + expiry,
    })).toString('base64url')}.signature`;
    let refreshes = 0;
    const api = createApiClient({ baseUrl: origin, getToken: () => token,
      refreshAuthToken: async () => { refreshes++; token = 'fresh-token'; return token; } });
    const operation = api.get(wrappedReadPath, { query: { variant: 'internal-expired' } });
    if (expiry === -60) {
      assert.equal((await operation).authorization, 'Bearer fresh-token');
      assert.equal(refreshes, 1);
    } else {
      await assert.rejects(operation, (error) => error.status === 500);
      assert.equal(refreshes, 0, 'A backend credential failure must not refresh a valid or opaque user token.');
    }
  }
});
