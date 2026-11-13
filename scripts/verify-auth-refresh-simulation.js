// Run against the local auth-refresh Postman simulation only. All credentials below are fixtures.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createServer } from 'vite';
import { QueryClient } from '@tanstack/react-query';

const origin = process.argv[2] || 'http://127.0.0.1:4912/central';
const target = new URL(origin);
assert.ok(target.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(target.hostname), 'Use a local simulation URL.');
// This is the source actually injected by SuperAppWebView, rather than the standalone SDK asset.
const sdkPath = new URL('../../oml-central/lib/features/webview/bridge/sdk/bridge_sdk_source.dart', import.meta.url);
const dart = await readFile(sdkPath, 'utf8');
const sdk = dart.slice(dart.indexOf("r'''") + 4, dart.lastIndexOf("'''"));
const vite = await createServer({ mode: 'test', server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });

try {
  const { createApiClient } = await vite.ssrLoadModule('/src/services/api/request.ts');
  const { refreshNativeAuthToken } = await vite.ssrLoadModule('/src/services/bridge/auth.ts');
  const { initializeBridge } = await vite.ssrLoadModule('/src/services/bridge/bootstrap.ts');
  const { useMiniAppStore: store } = await vite.ssrLoadModule('/src/store/miniAppStore.ts');
  const stats = async () => (await fetch(`${origin}/__fixture/stats`)).json();
  const detailPath = '/services/central/api/name/staff-order-detail/find';

  async function scenario(refreshToken, run, initialAccessToken = 'expired-token') {
    let accessToken = initialAccessToken;
    let refreshCalls = 0;
    const window = { SuperAppBridge: { postMessage(raw) {
      const { action, data, requestId } = JSON.parse(raw);
      void (async () => {
        let result = {};
        let error = null;
        try {
          if (action === 'getAuthToken') result = { token: accessToken };
          if (action === 'getLocalization') result = { language: 'en' };
          if (action === 'refreshAuthToken') {
            assert.equal(data.token, accessToken);
            refreshCalls++;
            const response = await fetch(`${origin}/mobile/auth/refresh`, {
              method: 'POST', body: new URLSearchParams({
                grant_type: 'refresh_token', client_id: 'central_app', refresh_token: refreshToken,
              }),
            });
            if (!response.ok) throw new Error(`Fixture native refresh failed (${response.status}).`);
            const tokens = await response.json();
            accessToken = tokens.access_token;
            refreshToken = tokens.refresh_token;
            result = { token: accessToken };
          }
        } catch (failure) { error = failure.message; }
        if (requestId) window.receiveMessageFromNative('__bridge_response__', { requestId, data: result, error });
      })();
    } } };
    vm.runInNewContext(sdk, { window, setTimeout, clearTimeout, console: { log() {}, warn() {}, error() {} } });
    globalThis.window = window;
    store.getState().reset();
    const dispose = await initializeBridge(window.superApp, { signal: new AbortController().signal });
    const api = createApiClient({
      baseUrl: origin, getToken: () => store.getState().authToken,
      getAuthSession: () => store.getState().sessionVersion, refreshAuthToken: refreshNativeAuthToken,
    });
    try { await run({ api, window, refreshCalls: () => refreshCalls }); }
    finally { dispose(); store.getState().reset(); delete globalThis.window; }
  }

  await scenario('fixture-refresh-ok', async ({ api, refreshCalls }) => {
    const before = await stats();
    const values = await Promise.all([
      api.get(detailPath, { query: { id: 32 } }), api.get('/protected'), api.get(detailPath, { query: { id: 32 } }),
    ]);
    assert.ok(values.every((value) => value.authorized));
    assert.equal(values[0].id, 32);
    assert.equal(refreshCalls(), 1);
    assert.equal(store.getState().authToken, 'fresh-token');
    const after = await stats();
    assert.equal(after.refreshes - before.refreshes, 1);
    assert.equal(after.protectedRequests - before.protectedRequests, 6);
    console.log('PASS: injected SDK + miniapp bridge + HTTP: concurrent wrapped 500/direct 401 refresh once and replay successfully.');
  });
  await scenario('fixture-refresh-down', async ({ api, refreshCalls }) => {
    const before = await stats();
    await assert.rejects(api.get(detailPath, { query: { id: 32 } }), (error) =>
      error.status === 500 && error.data.error === 'Data failure' && error.data.message.includes('Token has expired.'));
    assert.equal(refreshCalls(), 1);
    const after = await stats();
    assert.equal(after.refreshes - before.refreshes, 1);
    assert.equal(after.protectedRequests - before.protectedRequests, 1);
    console.log('PASS: refresh HTTP 503 preserves the original Central 500; no replay.');
  });
  await scenario('fixture-refresh-ok', async ({ api, refreshCalls }) => {
    const before = await stats();
    await assert.rejects(api.get(detailPath, { query: { always: 1 } }), (error) => error.status === 500);
    assert.equal(refreshCalls(), 1);
    const after = await stats();
    assert.equal(after.protectedRequests - before.protectedRequests, 2);
    console.log('PASS: a rejected replay stops after one refresh and two resource requests.');
  });
  await scenario('fixture-refresh-ok', async ({ api, window, refreshCalls }) => {
    const version = store.getState().sessionVersion;
    window.receiveMessageFromNative('updateToken', 'fresh-token');
    assert.equal((await api.get(detailPath, { query: { id: 32 } })).authorized, true);
    assert.equal(store.getState().sessionVersion, version);
    assert.equal(refreshCalls(), 0);
    console.log('PASS: native resume update reaches the token store before the next HTTP request.');
  });
  for (const expired of [true, false]) {
    const initialToken = `fixture.${Buffer.from(JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + (expired ? -60 : 3600),
    })).toString('base64url')}.signature`;
    await scenario('fixture-refresh-ok', async ({ api, refreshCalls }) => {
      const before = await stats();
      const operation = api.get(detailPath, { query: { id: 39, variant: 'internal-expired' } });
      if (expired) {
        assert.equal((await operation).authorized, true);
        assert.equal(refreshCalls(), 1);
      } else {
        await assert.rejects(operation, (error) => error.status === 500);
        assert.equal(refreshCalls(), 0);
      }
      const after = await stats();
      assert.equal(after.refreshes - before.refreshes, expired ? 1 : 0);
      assert.equal(after.protectedRequests - before.protectedRequests, expired ? 2 : 1);
      console.log(`PASS: captured internal-token wrapper with ${expired ? 'expired' : 'valid'} user JWT: ${expired ? 'one automatic refresh and replay' : 'backend error preserved without user refresh'}.`);
    }, initialToken);
  }
  const expiringOrderToken = `fixture.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 60 })).toString('base64url')}.signature`;
  const orderPath = '/services/central/api/name/staff-order-save/exec';
  const orderPayload = { phone: 'fixture-phone', items: [{ product_code: 'fixture-product', quantity: 20 }] };
  await scenario('fixture-refresh-ok', async ({ api, refreshCalls }) => {
    const before = await stats();
    const value = await api.post(orderPath, orderPayload);
    assert.equal(value.status, 'success');
    assert.deepEqual(value.payload, orderPayload);
    assert.equal(refreshCalls(), 1);
    const after = await stats();
    assert.equal(after.refreshes - before.refreshes, 1);
    assert.equal(after.orderRequests - before.orderRequests, 1);
    assert.equal(after.savedOrders - before.savedOrders, 1);
    console.log('PASS: expired order token refreshes through the injected SDK before one successful POST.');
  }, expiringOrderToken);
  await scenario('fixture-refresh-ok', async ({ api, refreshCalls }) => {
    const before = await stats();
    const value = await api.post(orderPath, orderPayload, { query: { reauth: 1 } });
    assert.equal(value.status, 'success');
    assert.deepEqual(value.payload, orderPayload);
    assert.equal(refreshCalls(), 2, 'Preflight does not suppress recovery from an actual HTTP 401.');
    assert.equal(store.getState().authToken, 'fresh-token-next');
    const after = await stats();
    assert.equal(after.refreshes - before.refreshes, 2);
    assert.equal(after.orderRequests - before.orderRequests, 2);
    assert.equal(after.savedOrders - before.savedOrders, 1);
    console.log('PASS: an actual POST 401 after preflight refreshes immediately and replays once without surfacing the rejection.');
  }, expiringOrderToken);
  await scenario('fixture-refresh-down', async ({ api, refreshCalls }) => {
    const before = await stats();
    await assert.rejects(api.post(orderPath, orderPayload), (error) => error.status === 401);
    assert.equal(refreshCalls(), 1);
    const after = await stats();
    assert.equal(after.orderRequests - before.orderRequests, 0);
    assert.equal(after.savedOrders - before.savedOrders, 0);
    console.log('PASS: refresh 503 blocks order submission before any POST.');
  }, expiringOrderToken);
  await scenario('fixture-refresh-ok', async ({ api, refreshCalls }) => {
    const before = await stats();
    await assert.rejects(api.post(orderPath, orderPayload, { query: { always: 1 } }), (error) =>
      error.status === 500 && error.data.message.endsWith('[SFAApiProxy#staffOrder(JsonNode)]: []'));
    assert.equal(refreshCalls(), 1);
    const after = await stats();
    assert.equal(after.orderRequests - before.orderRequests, 1);
    assert.equal(after.savedOrders - before.savedOrders, 0);
    console.log('PASS: the screenshot POST wrapper after refresh is preserved without repeating the write.');
  }, expiringOrderToken);
  await scenario('fixture-refresh-ok', async ({ api, refreshCalls }) => {
    const before = await stats();
    await assert.rejects(api.post(orderPath, orderPayload), (error) => error.status === 500);
    assert.equal(refreshCalls(), 0);
    const after = await stats();
    assert.equal(after.orderRequests - before.orderRequests, 1);
    console.log('PASS: the empty-body wrapper alone does not prove token expiry or trigger a write replay.');
  });
  await scenario('fixture-refresh-slow', async ({ api, refreshCalls }) => {
    const before = await stats();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const states = [];
    const unsubscribe = client.getQueryCache().subscribe((event) => states.push(event.query.state.status));
    try {
      const value = await client.fetchQuery({
        queryKey: ['slow-native-refresh-first-request'],
        queryFn: ({ signal }) => api.get('/protected', { signal, timeoutMs: 500 }),
      });
      assert.equal(value.authorized, true);
      assert.equal(refreshCalls(), 1);
      assert.equal(states.includes('error'), false);
      const after = await stats();
      assert.equal(after.refreshes - before.refreshes, 1);
      assert.equal(after.protectedRequests - before.protectedRequests, 2);
      console.log('PASS: first 401 automatically refreshes for 11 seconds and replays successfully; query never enters error, with no manual Retry.');
    } finally { unsubscribe(); client.clear(); }
  });
  console.log('Native dispatch was simulated; this does not validate Flutter storage, production refresh, or a device WebView.');
} finally { await vite.close(); }
