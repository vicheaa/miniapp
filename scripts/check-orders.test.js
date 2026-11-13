import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createServer as createHttpServer } from 'node:http';
import { once } from 'node:events';
import { createServer } from 'vite';
import { todayDeliveryIso } from '../src/utils/delivery.ts';

let vite, server, draft, session, orders;
let status, body, delay, requests, streamUnauthorized, completeUnauthorizedBody;
const nativeFetch = globalThis.fetch;
const previousWindow = globalThis.window;
const saved = new Map();
const details = { customer: 'Angkor Fresh Mart123', phone: '015 667788', email: 'angkorfresh@example.com', address: 'Toul Kork, Phnom Penh' };
const confirmation = { status: 'success', message: 'Staff order created successfully.', data: { id: 24, customer: details.customer, phone: details.phone, total_items: 3 } };
const product = { id: 152, internal_code: 'PRD00000152', line_code: 'FG000012', line_name: 'Vital', unit_price: '48.0000', qty_step: null, default_uom: { id: 7, name: 'Case', abbreviation: 'Case' } };

before(async () => {
  globalThis.window = { localStorage: {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
    removeItem: (key) => saved.delete(key),
  } };
  server = createHttpServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requests.push({ method: req.method, path: req.url, headers: req.headers, body: JSON.parse(Buffer.concat(chunks).toString()) });
    if (streamUnauthorized && req.headers.authorization !== 'Bearer fresh-order-token') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.flushHeaders();
      res.write('{"message":');
      completeUnauthorizedBody = () => res.end('"Original API unauthorized"}');
      return;
    }
    setTimeout(() => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(status === 204 ? undefined : JSON.stringify(body));
    }, delay);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  globalThis.fetch = (url, options) => nativeFetch(new URL(url, origin), options);
  vite = await createServer({ mode: 'test', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
  orders = await vite.ssrLoadModule('/src/services/api/order.ts');
  ({ useOrderDraftStore: draft } = await vite.ssrLoadModule('/src/store/orderDraftStore.ts'));
  ({ useMiniAppStore: session } = await vite.ssrLoadModule('/src/store/miniAppStore.ts'));
});

beforeEach(() => {
  status = 201; body = confirmation; delay = 0; requests = [];
  streamUnauthorized = false; completeUnauthorizedBody = undefined;
  session.getState().reset();
  session.getState().setAuthToken('order-fixture-token');
  draft.getState().clear();
});

after(async () => {
  globalThis.fetch = nativeFetch;
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
  server?.closeAllConnections();
  if (server) await new Promise((resolve) => server.close(resolve));
  await vite?.close();
});

test('orders: cart maps internal codes and decimal prices to the supplied payload', () => {
  const payload = orders.buildOrderPayload({ ...details, customer: ` ${details.customer} `, phone: ` ${details.phone} ` }, [
    { product, quantity: 10 },
    { product: { ...product, id: 4, internal_code: 'PRD000177', unit_price: '16.5000' }, quantity: 25 },
    { product: { ...product, id: 153, internal_code: 'PRD00000153', unit_price: '22.0000' }, quantity: 12 },
  ]);
  assert.deepEqual(payload, { ...details, items: [
    { product_code: 'PRD00000152', quantity: 10, unit_price: 48 },
    { product_code: 'PRD000177', quantity: 25, unit_price: 16.5 },
    { product_code: 'PRD00000153', quantity: 12, unit_price: 22 },
  ] });
});

test('orders HTTP: saveOrder posts JSON with bearer auth and optional product metadata', async () => {
  const payload = { ...details, items: [{ product_id: 4, product_name: 'MC2000', product_code: 'PRD000177', quantity: 25, unit_price: 16.5 }] };
  assert.deepEqual(await orders.saveOrder(payload), confirmation);
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[0].path, '/services/central/api/name/staff-order-save/exec');
  assert.equal(requests[0].headers.authorization, 'Bearer order-fixture-token');
  assert.equal(requests[0].headers['content-type'], 'application/json');
  assert.deepEqual(requests[0].body, payload);
});

function expiringOrderToken(seconds) {
  return `fixture.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds })).toString('base64url')}.signature`;
}

test('orders: expired and soon-expiring tokens refresh before the single order POST', async () => {
  for (const seconds of [-60, 15]) {
    session.getState().setAuthToken(expiringOrderToken(seconds));
    const rejectedToken = session.getState().authToken;
    let completeRefresh;
    let markRefreshStarted;
    const started = new Promise((resolve) => { markRefreshStarted = resolve; });
    session.setState({ superApp: { refreshAuthToken: (token) => {
      assert.equal(token, rejectedToken);
      markRefreshStarted();
      return new Promise((resolve) => { completeRefresh = resolve; });
    } } });
    draft.getState().setQuantity(product, 10);
    const before = requests.length;
    const pending = draft.getState().commitOrder(details);
    // The refresh must begin without first sending a rejected order.
    await Promise.race([started, pending.then(() => assert.fail('Order sent before refresh.'))]);
    assert.equal(requests.length, before);
    assert.equal(draft.getState().isSubmitting, true);
    assert.equal(await draft.getState().commitOrder(details), false);
    completeRefresh('fresh-order-token');
    assert.equal(await pending, true);
    assert.equal(requests.length, before + 1);
    assert.equal(requests.at(-1).headers.authorization, 'Bearer fresh-order-token');
    assert.deepEqual(requests.at(-1).body.items, [{ product_code: 'PRD00000152', quantity: 10, unit_price: 48 }]);
  }
});

test('orders: a failed refresh sends no order and preserves the cart for retry', async () => {
  session.getState().setAuthToken(expiringOrderToken(-60));
  session.setState({ superApp: { refreshAuthToken: async () => { throw new Error('Native refresh unavailable'); } } });
  draft.getState().setQuantity(product, 10);
  assert.equal(await draft.getState().commitOrder(details), false);
  assert.equal(requests.length, 0);
  assert.equal(draft.getState().items[152].quantity, 10);
  assert.equal(draft.getState().savedOrder, null);
  assert.equal(draft.getState().isSubmitting, false);
});

test('orders: the first 401 refreshes on headers and stays submitting without exposing an error', async () => {
  for (const preflight of [false, true]) {
    streamUnauthorized = true;
    requests = [];
    session.getState().setAuthToken(preflight ? expiringOrderToken(-60) : 'opaque-order-token');
    let calls = 0;
    let completeRefresh;
    let markReactiveRefresh;
    const refreshing = new Promise((resolve) => { markReactiveRefresh = resolve; });
    session.setState({ superApp: { refreshAuthToken: () => {
      calls++;
      if (preflight && calls === 1) return Promise.resolve('preflight-order-token');
      // The error body is deliberately unfinished until refresh has started.
      completeUnauthorizedBody();
      markReactiveRefresh();
      return new Promise((resolve) => { completeRefresh = resolve; });
    } } });
    draft.getState().setQuantity(product, 10);
    const states = [];
    const unsubscribe = draft.subscribe((state) => states.push({ submitting: state.isSubmitting, error: state.submitError }));
    try {
      const pending = draft.getState().commitOrder(details);
      await Promise.race([refreshing, pending.then(() => assert.fail('401 escaped before reactive refresh.'))]);
      assert.equal(requests.length, 1);
      assert.equal(draft.getState().isSubmitting, true);
      assert.equal(draft.getState().submitError, null);
      completeRefresh('fresh-order-token');
      assert.equal(await pending, true);
      assert.equal(calls, preflight ? 2 : 1);
      assert.equal(requests.length, 2);
      assert.deepEqual(requests[1].body, requests[0].body);
      assert.equal(states.some((state) => state.error != null), false);
      assert.equal(states.slice(0, -1).every((state) => state.submitting), true);
    } finally { unsubscribe(); completeUnauthorizedBody?.(); }
  }
});

test('orders: success clears the cart and its persisted copy only after the response', async () => {
  delay = 40;
  draft.getState().setQuantity(product, 10);
  const pending = draft.getState().commitOrder(details);
  assert.equal(draft.getState().isSubmitting, true);
  assert.equal(draft.getState().items[152].quantity, 10);
  assert.equal(saved.has('cart'), true);
  assert.equal(await pending, true);
  assert.deepEqual(draft.getState().items, {});
  assert.equal(saved.has('cart'), false);
  assert.deepEqual(draft.getState().savedOrder, confirmation);
  assert.equal(draft.getState().isSubmitting, false);
});

test('orders: an explicit success status and valid order ID are required before clearing the cart', async () => {
  for (const response of [
    { status: 204, body: undefined },
    { status: 200, body: { status: 'error', message: 'Customer is invalid.' } },
    { status: 200, body: { status: 'success', message: 'Saved', data: null } },
  ]) {
    status = response.status; body = response.body;
    draft.getState().adjust(product, 1);
    const items = draft.getState().items;
    assert.equal(await draft.getState().commitOrder(details), false);
    assert.equal(draft.getState().items, items);
    assert.equal(draft.getState().savedOrder, null);
    if (response.body?.status === 'error') assert.equal(draft.getState().submitError.message, 'Customer is invalid.');
  }
});

test('orders: HTTP 422 and 503 preserve cart data, expose server errors, and do not retry', async () => {
  for (const responseStatus of [422, 503]) {
    status = responseStatus; body = { message: 'Order rejected' };
    draft.getState().setQuantity(product, 10);
    const count = requests.length;
    assert.equal(await draft.getState().commitOrder(details), false);
    assert.equal(requests.length, count + 1);
    assert.equal(draft.getState().items[152].quantity, 10);
    assert.equal(JSON.parse(saved.get('cart')).items[152].quantity, 10);
    assert.equal(draft.getState().submitError.status, responseStatus);
    assert.equal(draft.getState().submitError.message, 'Order rejected');
    assert.equal(draft.getState().isSubmitting, false);
    assert.equal(draft.getState().savedOrder, null);
  }
  status = 201; body = confirmation;
  assert.equal(await draft.getState().commitOrder(details), true);
});

test('orders: duplicate submissions and edits are blocked while the order is in flight', async () => {
  delay = 40;
  draft.getState().setQuantity(product, 10);
  const pending = draft.getState().commitOrder(details);
  assert.equal(await draft.getState().commitOrder(details), false);
  draft.getState().adjust(product, 1);
  assert.equal(draft.getState().setQuantity(product, 25), false);
  assert.equal(draft.getState().items[152].quantity, 10);
  assert.equal(await pending, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.items[0].quantity, 10);
});

test('orders: late success after session replacement cannot clear the new cart or report success', async () => {
  delay = 40;
  draft.getState().adjust(product, 1);
  const pending = draft.getState().commitOrder(details);
  session.getState().setAuthToken('replacement-token');
  // Model cart hydration in the replacement session.
  draft.setState({ items: { 152: { product, uom: product.default_uom, quantity: 8 } } });
  assert.equal(await pending, false);
  assert.equal(draft.getState().items[152].quantity, 8);
  assert.equal(draft.getState().savedOrder, null);
  assert.equal(draft.getState().submitError, null);
});

test('orders: invalid phone/cart data is rejected before sending an HTTP request', async () => {
  draft.getState().adjust(product, 1);
  for (const [field, key] of [['phone', 'phoneRequired']]) {
    assert.equal(await draft.getState().commitOrder({ ...details, [field]: ' ' }), false);
    assert.equal(draft.getState().submitError.key, key);
  }
  draft.getState().clear();
  assert.equal(await draft.getState().commitOrder(details), false);
  assert.equal(draft.getState().submitError.key, 'empty');
  for (const invalid of [
    { ...product, internal_code: '' }, { ...product, unit_price: '' },
    { ...product, unit_price: null }, { ...product, unit_price: 'invalid' },
    { ...product, unit_price: '-1' }, { ...product, unit_price: 'Infinity' },
  ]) {
    assert.throws(() => orders.buildOrderPayload(details, [{ product: invalid, quantity: 1 }]), { key: 'invalidItem' });
  }
  for (const quantity of [0, -1, NaN, Infinity]) {
    assert.throws(() => orders.buildOrderPayload(details, [{ product, quantity }]), { key: 'invalidItem' });
  }
  assert.equal(requests.length, 0);
});

test('orders HTTP: customer name and delivery date can be absent or blank and are omitted from the request', async () => {
  for (const optional of [{}, { customer: '', delivery_date: '' }, { customer: '  ', delivery_date: '  ' }, { customer: undefined, delivery_date: null }]) {
    const checkout = { phone: details.phone, email: details.email, address: details.address, latitude: 11.595, longitude: 104.89, ...optional };
    draft.getState().setQuantity(product, 1);
    assert.equal(await draft.getState().commitOrder(checkout), true);
    assert.deepEqual(requests.at(-1).body, { phone: details.phone, email: details.email, address: details.address, latitude: 11.595, longitude: 104.89, items: [{ product_code: 'PRD00000152', quantity: 1, unit_price: 48 }] });
  }
});

test('orders HTTP: checkout preserves existing fields and sends today at midnight with numeric coordinates', async () => {
  const today = todayDeliveryIso();
  const checkout = { ...details, delivery_date: today.replace('T00:00:00', 'T14:30:00'), latitude: 11.595, longitude: 104.89 };
  draft.getState().adjust(product, 1);
  assert.equal(await draft.getState().commitOrder(checkout), true);
  assert.deepEqual(requests[0].body, { ...checkout, delivery_date: today, items: [{ product_code: 'PRD00000152', quantity: 1, unit_price: 48 }] });
});

test('orders: backdated delivery is rejected and future/today values normalize to midnight', () => {
  const now = new Date('2026-11-11T15:00:00+07:00');
  const selected = [{ product, quantity: 1 }];
  assert.throws(() => orders.buildOrderPayload({ ...details, delivery_date: '2026-11-10T23:59:00+07:00' }, selected, now), { key: 'pastDeliveryDate' });
  assert.equal(orders.buildOrderPayload({ ...details, delivery_date: '2026-11-11T03:45:00+07:00' }, selected, now).delivery_date, '2026-11-11T00:00:00+07:00');
  assert.equal(orders.buildOrderPayload({ ...details, delivery_date: '2026-11-12T21:30:00+07:00' }, selected, now).delivery_date, '2026-11-12T00:00:00+07:00');
});

test('orders: invalid delivery dates and partial or out-of-range coordinates never send a request', async () => {
  draft.getState().adjust(product, 1);
  for (const extra of [
    { delivery_date: 'not-a-date' }, { delivery_date: '2026-02-31T12:00:00+07:00' },
    { latitude: 11.5 }, { longitude: 104.9 }, { latitude: NaN, longitude: 104 },
    { latitude: 91, longitude: 104 }, { latitude: 11, longitude: -181 },
  ]) assert.equal(await draft.getState().commitOrder({ ...details, ...extra }), false);
  assert.equal(requests.length, 0);
  const payload = orders.buildOrderPayload({ ...details, delivery_date: null, latitude: null, longitude: null }, [{ product, quantity: 1 }]);
  assert.equal('delivery_date' in payload, false);
  assert.equal('latitude' in payload, false);
  assert.equal('longitude' in payload, false);
});
