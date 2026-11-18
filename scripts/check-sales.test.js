import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createServer as createHttpServer } from 'node:http';
import { once } from 'node:events';
import { createServer } from 'vite';
import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query';

let vite, server, sales, presentation, estimates, session, origin, infiniteStaffOrderHistoryOptions;
let lastRequest, summaryBody, historyBody, detailBody, status, delay, calls;
const nativeFetch = globalThis.fetch;
const summary = { total_requests: 14, pending_requests: 12, accepted_requests: 1, total_items_case: 732 };
const order = { id: 22, no: '261110-0002', customer: 'Angkor Fresh Mart', phone: '015 667788', email: 'angkorfresh@example.com', address: 'Toul Kork, Phnom Penh', created_date: '2026-11-10T09:16:45.433478+07:00', staff_name: 'Pheun Reach', staff_code: '002330', status: 'Accepted', items: [] };
const detailProduct = { id: 7, internal_code: 'PRD00000007', line_code: 'FG000013', line_name: 'Vital 350 mL', line_name_kh: 'វីតាល់ 350 mL, 24 ដប', category: 2, category_name: 'Vital', default_uom: 7, default_uom_name: 'Case', default_uom_abbreviation: 'Case', unit_price: '3.0000', reference_uom: 'Case', thumbnail: 'http://10.0.12.247:3303/media/uploads/fixture.jpg' };

before(async () => {
  server = createHttpServer((req, res) => {
    calls++;
    lastRequest = { url: new URL(req.url, 'http://localhost'), headers: req.headers };
    const response = req.url.includes('staff-order-detail') ? detailBody : req.url.includes('staff-order-summary') ? summaryBody : historyBody;
    setTimeout(() => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(response)); }, delay);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
  globalThis.fetch = (url, options) => nativeFetch(new URL(url, origin), options);
  vite = await createServer({ mode: 'test', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
  sales = await vite.ssrLoadModule('/src/services/api/order.ts');
  ({ infiniteStaffOrderHistoryOptions } = await vite.ssrLoadModule('/src/hooks/useStaffOrderHistory.ts'));
  presentation = await vite.ssrLoadModule('/src/pages/orders/presentation.ts');
  estimates = await vite.ssrLoadModule('/src/pages/orders/estimates.ts');
  ({ useMiniAppStore: session } = await vite.ssrLoadModule('/src/store/miniAppStore.ts'));
});
beforeEach(() => {
  summaryBody = summary;
  historyBody = { count: 10, next: null, previous: null, results: [order] };
  detailBody = { ...order, id: 25, no: '261111-0002', status: 'Pending', delivery_date: null, items: [
    { id: 53, quantity: '10.0000', discount_amount: null, subtotal: null, remarks: null, staff_order: 25, product: { ...detailProduct, id: 310, internal_code: 'PRD00000157', line_name: 'NS: MC Pack - Minced Pork', thumbnail: '', unit_price: '0.0000' } },
    { id: 54, quantity: '12.0000', discount_amount: null, subtotal: null, remarks: null, staff_order: 25, product: detailProduct },
  ] };
  status = 200; delay = 0; calls = 0;
  session.getState().setAuthToken('sales-fixture-token');
});
after(async () => {
  globalThis.fetch = nativeFetch;
  server?.closeAllConnections();
  if (server) await new Promise((resolve) => server.close(resolve));
  await vite?.close();
});

test('sales HTTP: summary uses the configured Central endpoint and current bearer token without history filters', async () => {
  assert.deepEqual(await sales.getStaffOrderSummary(), summary);
  assert.equal(lastRequest.url.pathname, '/services/central/api/name/staff-order-summary/find');
  assert.equal(lastRequest.url.search, '');
  assert.equal(lastRequest.headers.authorization, 'Bearer sales-fixture-token');
});

test('sales HTTP: history sends only page and page_size with the current bearer token', async () => {
  assert.deepEqual(await sales.getStaffOrderHistory(), historyBody);
  assert.equal(lastRequest.url.pathname, '/services/central/api/name/staff-order-employee-order-history/find');
  assert.deepEqual([...lastRequest.url.searchParams], [['page', '1'], ['page_size', '20']]);
  assert.equal(lastRequest.headers.authorization, 'Bearer sales-fixture-token');
});

test('sales HTTP: subsequent pages preserve count and next/previous metadata', async () => {
  historyBody = { count: 45, next: '/history?page=3', previous: '/history?page=1', results: [order] };
  assert.deepEqual(await sales.getStaffOrderHistory(2), historyBody);
  assert.equal(lastRequest.url.searchParams.get('page'), '2');
  assert.deepEqual([...lastRequest.url.searchParams], [['page', '2'], ['page_size', '20']]);
});

test('order list: infinite query appends pages, shares in-flight requests, and stops at the last page', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const options = infiniteStaffOrderHistoryOptions(session.getState().sessionVersion);
  try {
    historyBody = { count: 2, next: '/history?page=2', previous: null, results: [order] };
    await client.fetchInfiniteQuery(options);
    const observer = new InfiniteQueryObserver(client, options);
    historyBody = { count: 2, next: null, previous: '/history?page=1', results: [{ ...order, id: 21 }] };
    delay = 20;
    const [result] = await Promise.all([
      observer.fetchNextPage({ cancelRefetch: false }),
      observer.fetchNextPage({ cancelRefetch: false }),
    ]);
    assert.equal(calls, 2);
    assert.equal(lastRequest.url.searchParams.get('page'), '2');
    assert.deepEqual(result.data.pageParams, [1, 2]);
    assert.deepEqual(result.data.pages.flatMap((page) => page.results.map((entry) => entry.id)), [22, 21]);
    assert.equal(result.hasNextPage, false);
    await observer.fetchNextPage();
    assert.equal(calls, 2);
  } finally { client.clear(); }
});

test('order list: a failed next page preserves loaded orders and retries the same page', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const options = infiniteStaffOrderHistoryOptions(session.getState().sessionVersion);
  try {
    historyBody = { count: 2, next: '/history?page=2', previous: null, results: [order] };
    await client.fetchInfiniteQuery(options);
    const observer = new InfiniteQueryObserver(client, options);
    status = 503;
    historyBody = { message: 'Temporarily unavailable' };
    const failed = await observer.fetchNextPage();
    assert.equal(failed.isFetchNextPageError, true);
    assert.deepEqual(failed.data.pages[0].results, [order]);
    assert.deepEqual(failed.data.pageParams, [1]);
    status = 200;
    historyBody = { count: 2, next: null, previous: '/history?page=1', results: [{ ...order, id: 21 }] };
    const retried = await observer.fetchNextPage();
    assert.equal(lastRequest.url.searchParams.get('page'), '2');
    assert.equal(retried.isError, false);
    assert.equal(retried.data.pages.length, 2);
  } finally { client.clear(); }
});

test('order list: empty pages stop pagination and caches stay separate from home and other sessions', async () => {
  const client = new QueryClient();
  const version = session.getState().sessionVersion;
  const options = infiniteStaffOrderHistoryOptions(version);
  try {
    client.setQueryData(['staff-orders', 'history', version, 1], historyBody);
    historyBody = { count: 0, next: '/history?page=2', previous: null, results: [] };
    await client.fetchInfiniteQuery(options);
    const observer = new InfiniteQueryObserver(client, options);
    const result = await observer.fetchNextPage();
    assert.equal(result.hasNextPage, false);
    assert.equal(calls, 1);
    assert.deepEqual(client.getQueryData(['staff-orders', 'history', version, 1]).results, [order]);
    assert.equal(client.getQueryData(infiniteStaffOrderHistoryOptions(version + 1).queryKey), undefined);
  } finally { client.clear(); }
});

test('sales: invalid page numbers are rejected before making a request', async () => {
  for (const page of [0, -1, NaN, 1.5, Infinity]) await assert.rejects(sales.getStaffOrderHistory(page), /Invalid order history page/);
  assert.equal(calls, 0);
});

test('sales HTTP: zero summary and empty history are valid; malformed contracts are errors', async () => {
  summaryBody = { total_requests: 0, pending_requests: 0, accepted_requests: 0, total_items_case: 0 };
  assert.deepEqual(await sales.getStaffOrderSummary(), summaryBody);
  historyBody = { count: 0, next: null, previous: null, results: [] };
  assert.deepEqual(await sales.getStaffOrderHistory(), historyBody);
  for (const response of [null, {}, { ...summary, accepted_requests: '1' }, { ...summary, total_items_case: -1 }]) {
    summaryBody = response;
    await assert.rejects(sales.getStaffOrderSummary(), /Invalid order summary response/);
  }
  for (const response of [null, [], { count: 1, items: [] }, { count: -1, results: [] }]) {
    historyBody = response;
    await assert.rejects(sales.getStaffOrderHistory(), /Invalid order history response/);
  }
});

test('sales HTTP: errors remain visible and cancellation reaches fetch', async () => {
  status = 503;
  summaryBody = historyBody = { message: 'Sales unavailable' };
  await assert.rejects(sales.getStaffOrderSummary(), (error) => error.status === 503 && error.message === 'Sales unavailable');
  await assert.rejects(sales.getStaffOrderHistory(), (error) => error.status === 503);
  status = 200; delay = 100;
  const controller = new AbortController();
  const pending = sales.getStaffOrderHistory(1, controller.signal);
  controller.abort();
  await assert.rejects(pending, (error) => error.kind === 'aborted');
});

test('sales presentation: dates use Cambodia time and statuses retain their real meaning', () => {
  assert.equal(presentation.orderDate(order.created_date, 'en'), '10 Nov 2026');
  assert.equal(presentation.orderDate('2026-11-10T19:30:00Z', 'en'), '11 Nov 2026');
  assert.equal(presentation.orderDate('invalid', 'en'), '—');
  assert.ok(presentation.orderDate(order.created_date, 'km'));
  assert.equal(presentation.orderStatus('Accepted'), 'accepted');
  assert.equal(presentation.orderStatus('Pending'), 'pending');
  assert.equal(presentation.orderStatus('Rejected'), 'rejected');
  assert.equal(presentation.orderStatus('Custom'), 'unknown');
});

test('order detail HTTP: ID and bearer token reach the endpoint; nested products normalize without changing quantities', async () => {
  const detail = await sales.getStaffOrderDetail(25);
  assert.equal(lastRequest.url.pathname, '/services/central/api/name/staff-order-detail/find');
  assert.deepEqual([...lastRequest.url.searchParams], [['id', '25']]);
  assert.equal(lastRequest.headers.authorization, 'Bearer sales-fixture-token');
  assert.equal(detail.id, 25);
  assert.equal(detail.delivery_date, null);
  assert.equal(detail.items[0].quantity, '10.0000');
  assert.equal(detail.items[0].product.thumbnail, null);
  assert.equal(detail.items[0].product.unit_price, '0.0000');
  assert.equal(detail.items[1].product.thumbnail.file_url, detailProduct.thumbnail);
  assert.deepEqual(detail.items[1].product.default_uom, { id: 7, name: 'Case', abbreviation: 'Case' });
  assert.equal('unit_price' in detail.items[1], false, 'Catalog prices must not be invented as saved order-line prices.');
  assert.equal(detailBody.items[1].product.default_uom, 7, 'The wire response stays unchanged.');
});

test('order detail: invalid IDs are rejected without sending requests', async () => {
  for (const id of [0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) await assert.rejects(sales.getStaffOrderDetail(id), /Invalid order ID/);
  assert.equal(calls, 0);
});

test('order detail HTTP: wrong IDs and invalid envelopes are errors', async () => {
  for (const response of [null, {}, { id: 26, items: [] }, { id: 25, results: [] }, { id: 25, items: [null] }]) {
    detailBody = response;
    await assert.rejects(sales.getStaffOrderDetail(25), /Invalid order detail response/);
  }
});

test('order detail HTTP: empty orders, removed products, and nullable fields remain distinguishable', async () => {
  detailBody.items[0].product = null;
  assert.equal((await sales.getStaffOrderDetail(25)).items[0].product, null);
  detailBody.items = [];
  assert.deepEqual((await sales.getStaffOrderDetail(25)).items, []);
});

test('order detail HTTP: missing orders and cancellation preserve their actual errors', async () => {
  status = 404; detailBody = { message: 'Order not found.' };
  await assert.rejects(sales.getStaffOrderDetail(25), (error) => error.status === 404 && error.message === 'Order not found.');
  status = 200; delay = 100;
  const controller = new AbortController();
  const pending = sales.getStaffOrderDetail(25, controller.signal);
  controller.abort();
  await assert.rejects(pending, (error) => error.kind === 'aborted');
});

test('order details: safe back targets preserve history pages and decimals do not invent zero values', () => {
  for (const from of ['/', '/orders', '/orders?page=2']) assert.equal(presentation.orderDetailBackTarget(from), from);
  for (const from of [undefined, '//evil.example', 'https://evil.example', '/products', '/orders/25', '/orders?page=0', {}]) assert.equal(presentation.orderDetailBackTarget(from), '/orders');
  assert.equal(presentation.orderNumber('10.0000', 'en'), '10');
  assert.equal(presentation.orderNumber('0.2500', 'en'), '0.25');
  assert.equal(presentation.orderNumber('0.0000', 'en'), '0');
  for (const value of [null, '', 'invalid', 'Infinity']) assert.equal(presentation.orderNumber(value, 'en'), '—');
});

test('order estimates: supplied zero prices are valid and the sample quantities total USD 36.00', () => {
  const result = estimates.estimateOrder(detailBody.items);
  assert.equal(result.lines[0].totalCents, 0);
  assert.equal(result.lines[1].totalCents, 3600);
  assert.equal(result.subtotalCents, 3600);
  assert.equal(result.discountCents, 0);
  assert.equal(result.totalCents, 3600);
  assert.equal(estimates.orderCurrency(result.totalCents / 100, 'en'), '$36.00');
  assert.equal(estimates.orderCurrency(0, 'en'), '$0.00');
});

test('order estimates: fractional quantities, sub-cent unit prices, discounts, and rounding remain consistent', () => {
  const line = { ...detailBody.items[1], quantity: '0.1000', discount_amount: '0.1000', product: { ...detailProduct, unit_price: '3.3500' } };
  const result = estimates.estimateOrder([line]);
  assert.equal(result.subtotalCents, 34);
  assert.equal(result.discountCents, 10);
  assert.equal(result.totalCents, 24);
  const small = estimates.estimateOrder([{ ...line, quantity: '1000.0000', discount_amount: null, product: { ...detailProduct, unit_price: '0.0010' } }]);
  assert.equal(small.totalCents, 100);
  assert.equal(estimates.orderCurrency(small.lines[0].unitPrice, 'en', 4), '$0.001');
  for (const [price, cents] of [['0.0049', 0], ['0.0050', 1], ['0.0051', 1]]) {
    assert.equal(estimates.estimateOrder([{ ...line, quantity: '1.0000', discount_amount: null, product: { ...detailProduct, unit_price: price } }]).totalCents, cents);
  }
});

test('order estimates: unavailable or invalid pricing never produces a misleading zero total', () => {
  for (const product of [null, { ...detailProduct, unit_price: '' }, { ...detailProduct, unit_price: '-1.00' }, { ...detailProduct, unit_price: 'Infinity' }, { ...detailProduct, unit_price: '9007199254740991' }]) {
    const result = estimates.estimateOrder([{ ...detailBody.items[1], product }]);
    assert.equal(result.totalCents, null);
    assert.equal(estimates.orderCurrency(result.totalCents, 'en'), '—');
  }
  assert.equal(estimates.estimateOrder([{ ...detailBody.items[1], quantity: 'invalid' }]).totalCents, null);
  assert.equal(estimates.estimateOrder([{ ...detailBody.items[1], discount_amount: 'invalid' }]).totalCents, null);
  assert.match(presentation.orderDateTime('2026-11-11T11:30:27+07:00', 'en'), /11:30 AM/);
  assert.equal(presentation.orderDateTime('invalid', 'en'), '—');
});
