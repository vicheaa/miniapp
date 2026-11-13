// Investigation only: model lost HTTP connections, not iOS suspension itself.
// Run with Node 26: node scripts/investigate-lockscreen-resume.js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import vm from 'node:vm';
import { createServer } from 'vite';
import { QueryClient, QueryObserver, focusManager, onlineManager } from '@tanstack/react-query';

// Read the actual App defaults so this investigation cannot silently use a different policy.
const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const configurationText = source.match(/new QueryClient\((\{[\s\S]*?\n  \})\)/)?.[1];
assert.ok(configurationText, 'Could not find the App QueryClient literal; update this investigation after a refactor.');
const configuration = vm.runInNewContext(`(${configurationText})`, {}, { timeout: 1_000 });

const summary = { total_requests: 14, pending_requests: 12, accepted_requests: 1, total_items_case: 732 };
const history = { count: 0, next: null, previous: null, results: [] };
const requests = [];
let mode = 'healthy';
const server = createHttpServer((req, res) => {
  const path = new URL(req.url, 'http://fixture.invalid').pathname;
  requests.push({ mode, path });
  if (mode === 'disconnect') { req.socket.destroy(); return; }
  if (mode === 'proxy-error') { res.writeHead(500).end('Proxy Error: fixture upstream unavailable'); return; }
  if (mode === 'hang') return;
  if (mode === 'truncated-body') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': '1000' });
    res.write('{');
    setTimeout(() => res.destroy(), 20);
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(path.includes('staff-order-summary') ? summary : history));
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const nativeFetch = globalThis.fetch;
// The real sales module uses the shared singleton client; redirect it ONLY to this local server.
globalThis.fetch = (input, options) => {
  const parsed = new URL(input, 'http://fixture.invalid');
  assert.match(parsed.pathname, /^\/services\/central\/api\/name\/staff-order-/);
  return nativeFetch(new URL(parsed.pathname + parsed.search, origin), options);
};
globalThis.window = new EventTarget();
globalThis.document = { visibilityState: 'visible' };
const vite = await createServer({ mode: 'test', appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
const results = [];

try {
  const sales = await vite.ssrLoadModule('/src/services/api/order.ts');
  const { createApiClient, formatApiError } = await vite.ssrLoadModule('/src/services/api/request.ts');
  const { initializeBridge } = await vite.ssrLoadModule('/src/services/bridge/bootstrap.ts');
  const { useMiniAppStore: store } = await vite.ssrLoadModule('/src/store/miniAppStore.ts');
  let refreshes = 0;
  const listeners = new Map();
  const bridge = {
    getAuthToken: async () => 'fixture-access-token', getInitParams: async () => ({}),
    getLocalization: async () => ({ language: 'en' }), setTitle() {}, setPullToRefreshEnabled() {}, ready() {},
    refreshAuthToken: async () => { refreshes++; return 'fixture-refreshed-token'; },
    on(event, callback) { listeners.set(event, callback); return () => listeners.delete(event); },
  };
  store.getState().reset();
  const dispose = await initializeBridge(bridge, { signal: new AbortController().signal });
  const sessionVersion = store.getState().sessionVersion;

  async function observe(run) {
    const client = new QueryClient(configuration);
    client.mount();
    const observers = [
      new QueryObserver(client, { queryKey: ['staff-orders', 'summary', sessionVersion],
        queryFn: ({ signal }) => sales.getStaffOrderSummary(signal) }),
      new QueryObserver(client, { queryKey: ['staff-orders', 'history', sessionVersion, 1],
        queryFn: ({ signal }) => sales.getStaffOrderHistory(1, signal) }),
    ];
    const unsubscribers = observers.map((observer) => observer.subscribe(() => {}));
    const settled = async (expected) => {
      for (let i = 0; i < 200; i++) {
        if (observers.every((observer) => observer.getCurrentResult().status === expected &&
            observer.getCurrentResult().fetchStatus === 'idle')) return;
        await delay(10);
      }
      assert.fail(`Queries did not settle as ${expected}.`);
    };
    try { await run({ client, observers, settled }); }
    finally {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      client.unmount(); client.clear();
      focusManager.setFocused(true); onlineManager.setOnline(true);
    }
  }
  async function resume() {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await delay(75); // Let query focus handlers run; not a simulated lock duration.
  }

  try {
    mode = 'healthy';
    await observe(async ({ client, observers, settled }) => {
      await settled('success');
      // Model the reported five-minute absence without sleeping or pretending to suspend iOS.
      for (const [key, data] of client.getQueriesData({})) {
        client.setQueryData(key, data, { updatedAt: Date.now() - 301_000 });
      }
      assert.ok(observers.every((observer) => observer.getCurrentResult().isStale));
      const before = requests.length;
      mode = 'disconnect';
      await resume();
      assert.equal(requests.length, before);
      await settled('success');
      results.push({ scenario: 'already-loaded-screen-resume-after-five-minutes', result: 'cached data aged past five-minute staleTime; no refetch on resume; successful data stays cached' });
    });

    mode = 'disconnect';
    await observe(async ({ observers, settled }) => {
      await settled('error');
      for (const observer of observers) {
        const { error, data } = observer.getCurrentResult();
        assert.equal(error.kind, 'network'); assert.equal(error.status, null);
        assert.equal(formatApiError(error), 'Unable to reach the server.');
        assert.equal(data, undefined);
      }
      const failedRequests = requests.length;
      mode = 'healthy';
      await resume();
      assert.equal(requests.length, failedRequests);
      await settled('error');
      listeners.get('tokenRefreshed')({ token: 'fixture-resume-token' });
      await delay(75);
      assert.equal(store.getState().authToken, 'fixture-resume-token');
      assert.equal(store.getState().sessionVersion, sessionVersion);
      assert.equal(requests.length, failedRequests);
      await settled('error');
      assert.equal(refreshes, 0);
      await Promise.all(observers.map((observer) => observer.refetch()));
      await settled('success');
      results.push({ scenario: 'lost-connections-before-response', result: 'both screenshot errors reproduced; focus and token push do not recover; manual refetch succeeds', refreshes });
    });

    mode = 'disconnect';
    await observe(async ({ settled }) => {
      await settled('error');
      const before = requests.length;
      mode = 'healthy';
      onlineManager.setOnline(false); onlineManager.setOnline(true);
      await settled('success');
      assert.ok(requests.length >= before + 2);
      results.push({ scenario: 'explicit-offline-online-transition', result: 'failed reads recover automatically when an actual reconnect transition is delivered' });
    });

    for (const [fault, expectedKind, expectedStatus, expectedMessage] of [
      ['proxy-error', 'http', 500, 'HTTP 500: Proxy Error: fixture upstream unavailable'],
      ['truncated-body', 'network', 200, 'HTTP 200: Unable to reach the server.'],
      ['hang', 'timeout', null, 'The request timed out.'],
    ]) {
      mode = fault;
      const api = createApiClient({ baseUrl: origin, timeoutMs: 100, fetch: nativeFetch });
      await assert.rejects(api.get('/services/central/api/name/staff-order-summary/find'), (error) => {
        assert.equal(error.kind, expectedKind); assert.equal(error.status, expectedStatus);
        assert.equal(formatApiError(error), expectedMessage);
        return true;
      });
      results.push({ scenario: fault, kind: expectedKind, status: expectedStatus, displayed: expectedMessage });
    }
  } finally { dispose(); store.getState().reset(); }
  console.log(JSON.stringify({
    scope: 'Real miniapp sales functions, bridge bootstrap/store, shared HTTP client and TanStack Query; local TCP faults and manually driven query focus/online events. No physical lock, native proxy or production API.',
    queryDefaults: configuration.defaultOptions.queries, results,
    serverRequests: requests,
  }, null, 2));
} finally {
  globalThis.fetch = nativeFetch;
  delete globalThis.window; delete globalThis.document;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await vite.close();
}
