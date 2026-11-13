import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer as createHttpServer } from 'node:http';
import { once } from 'node:events';
import { createServer } from 'vite';

let vite;
let server;
let getProducts;
let getCategories;
let draft;
let session;
let catalog;
let quantityStep;
let lastRequest;
let categoryResponse;
let productResponse;
let responseStatus = 200;
let responseDelay = 0;
let mockOrigin;
const nativeFetch = globalThis.fetch;
const category = { id: 2, code: 'CAT000002', name_en: 'Vital', name_kh: 'វីតាល់', order_index: 1, thumbnail: {}, images: [], status: 'Active', description: null, soft_deleted: false, deleted_at: null };
const apiProduct = {
  id: 353, internal_code: 'PRD00000353', line_code: 'FG000012',
  line_name: 'Vital 250 mL', line_name_kh: 'វីតាល់ ២៥០',
  short_text: '250 mL', short_text_kh: 'វីតាល់ ២៥០', type: 'OWN',
  category: 2, category_name: 'Vital', default_uom: 7,
  default_uom_name: 'Case', default_uom_abbreviation: 'Case', unit_price: '4.5000',
  reference_code: 'FG000012', reference_name: 'Vital 250 mL', reference_name_kh: 'វីតាល់ ២៥០',
  reference_uom: 'Case', reference_price: '4.5', status: 'Active', description: null,
  for_web: true, for_mobile: true, company: 'OFL', bundle_id: null,
  thumbnail: 'http://10.0.12.247:3303/media/uploads/category/fixture.jpeg',
};
const envelope = (results) => ({ count: results.length, next: null, previous: null, results });
const product = {
  ...apiProduct, category: { id: 2, name_en: 'Vital' },
  default_uom: { id: 7, name: 'Case', abbreviation: 'Case' },
  thumbnail: { file_url: apiProduct.thumbnail }, images: [], product_uoms: [], qty_step: null, soft_delete: false,
};

before(async () => {
  server = createHttpServer((req, res) => {
    lastRequest = { url: new URL(req.url, 'http://localhost'), headers: req.headers };
    const body = req.url.includes('staff-order-category') ? categoryResponse : productResponse;
    const respond = () => {
      res.writeHead(responseStatus, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (responseDelay) {
      const timer = setTimeout(respond, responseDelay);
      res.once('close', () => clearTimeout(timer));
    } else respond();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  mockOrigin = origin;
  globalThis.fetch = (url, options) => nativeFetch(new URL(url, origin), options);
  vite = await createServer({ mode: 'test', server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
  ({ getProducts } = await vite.ssrLoadModule('/src/services/api/product.ts'));
  ({ getCategories } = await vite.ssrLoadModule('/src/services/api/category.ts'));
  ({ useOrderDraftStore: draft, quantityStep } = await vite.ssrLoadModule('/src/store/orderDraftStore.ts'));
  ({ useMiniAppStore: session } = await vite.ssrLoadModule('/src/store/miniAppStore.ts'));
  catalog = await vite.ssrLoadModule('/src/pages/product/catalog.ts');
  session.getState().setAuthToken('fixture-token');
  categoryResponse = envelope([category]);
  productResponse = envelope([apiProduct]);
});

after(async () => {
  globalThis.fetch = nativeFetch;
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  await vite?.close();
});

test('catalog HTTP: initial request has no parameters and uses the current bearer token', async () => {
  const result = await getProducts();
  assert.deepEqual(result, envelope([product]));
  assert.equal(lastRequest.url.pathname, '/services/central/api/name/staff-order-product/page');
  assert.equal(lastRequest.url.search, '');
  assert.equal(lastRequest.headers.authorization, 'Bearer fixture-token');
});

test('catalog HTTP: category/search are encoded without pagination or blank searches', async () => {
  await getProducts({ category_id: 2, search_value: '  Vital & water  ' });
  assert.deepEqual([...lastRequest.url.searchParams], [['category_id', '2'], ['search_value', 'Vital & water']]);
  await getProducts({ search_value: '   ' });
  assert.equal(lastRequest.url.search, '');
});

test('catalog HTTP: categories use their endpoint and sort without changing the response', async () => {
  categoryResponse = envelope([{ ...category, id: 1, order_index: 2 }, category, { ...category, id: 4, name_en: 'OM', name_kh: 'OM', order_index: 3, status: '_StatusEnum.ACTIVE' }]);
  const originalResponse = structuredClone(categoryResponse);
  assert.deepEqual((await getCategories()).map(({ id }) => id), [2, 1, 4]);
  assert.deepEqual(categoryResponse, originalResponse);
  assert.equal(lastRequest.url.pathname, '/services/central/api/name/staff-order-category/list');
  assert.equal(lastRequest.url.search, '');
});

test('development proxy: keeps API calls same-origin even when a direct API origin is also configured', async () => {
  const previousTarget = process.env.VITE_DEV_PROXY_TARGET;
  const previousOrigin = process.env.VITE_API_ORIGIN;
  let proxy;
  try {
    process.env.VITE_DEV_PROXY_TARGET = mockOrigin;
    process.env.VITE_API_ORIGIN = 'https://direct-api.example.com';
    proxy = await createServer({ mode: 'test', server: { host: '127.0.0.1', port: 0, hmr: false } });
    await proxy.listen();
    const origin = `http://127.0.0.1:${proxy.httpServer.address().port}`;
    assert.equal(proxy.config.define['import.meta.env.VITE_API_ORIGIN'], '""');
    const transformed = await proxy.transformRequest('/src/services/api/request.ts');
    assert.ok(/"VITE_API_ORIGIN":\s*""/.test(transformed.code), 'The browser API origin must be empty when the proxy is configured.');
    for (const path of ['/services/central/api/name/staff-order-category/list', '/services/central/api/name/staff-order-product/page']) {
      const response = await nativeFetch(origin + path, { headers: { Authorization: 'Bearer fixture-token' } });
      assert.equal(response.status, 200);
      await response.json();
      assert.equal(lastRequest.url.pathname, path);
      assert.equal(lastRequest.url.search, '');
      assert.equal(lastRequest.headers.authorization, 'Bearer fixture-token');
    }
  } finally {
    await proxy?.close();
    if (previousTarget === undefined) delete process.env.VITE_DEV_PROXY_TARGET;
    else process.env.VITE_DEV_PROXY_TARGET = previousTarget;
    if (previousOrigin === undefined) delete process.env.VITE_API_ORIGIN;
    else process.env.VITE_API_ORIGIN = previousOrigin;
  }
});

test('catalog HTTP: flattened products retain category, image, and UOM data through grouping and cart storage', async () => {
  productResponse = envelope([apiProduct]);
  const [result] = (await getProducts()).results;
  const [group] = catalog.groupProducts([result], [category]);
  assert.equal(group.category, category);
  assert.equal(catalog.categoryName(group.category, 'km'), 'វីតាល់');
  assert.equal(catalog.mediaUrl(result.thumbnail.file_url), apiProduct.thumbnail);
  draft.getState().adjust(result, 1);
  assert.equal(draft.getState().items[353].quantity, 1);
  assert.deepEqual(draft.getState().items[353].uom, { id: 7, name: 'Case', abbreviation: 'Case' });
  const { readCart, writeCart } = await vite.ssrLoadModule('/src/store/cartStorage.ts');
  let saved;
  const storage = { getItem: () => saved, setItem: (_, value) => { saved = value; } };
  writeCart('fixture-owner', draft.getState().items, storage);
  const restored = readCart('fixture-owner', storage)[353];
  assert.equal(restored.uom.id, 7);
  assert.equal(restored.uom.name, 'Case');
  assert.equal(restored.product.thumbnail.file_url, apiProduct.thumbnail);
  draft.getState().clear();
});

test('catalog HTTP: optional product data and response metadata are preserved', async () => {
  productResponse = { count: 106, next: '/products?page=2', previous: null, results: [
    { ...apiProduct, category: null, default_uom: null, thumbnail: null },
    { ...apiProduct, default_uom_name: null, default_uom_abbreviation: null, thumbnail: '', qty_step: '0.2500' },
  ] };
  const response = await getProducts();
  assert.equal(response.count, 106);
  assert.equal(response.next, '/products?page=2');
  assert.equal(response.previous, null);
  assert.equal(response.results[0].category, null);
  assert.equal(response.results[0].default_uom, null);
  assert.equal(response.results[0].thumbnail, null);
  assert.equal(response.results[1].default_uom.name, 'Case');
  assert.equal(quantityStep(response.results[1].qty_step), 0.25);
  assert.equal(catalog.groupProducts([response.results[1]], [])[0].category.name_en, 'Vital');
});

test('catalog HTTP: empty lists, wrong envelopes, and failures remain distinguishable', async () => {
  productResponse = envelope([]);
  categoryResponse = envelope([]);
  assert.deepEqual((await getProducts()).results, []);
  assert.deepEqual(await getCategories(), []);
  for (const invalid of [null, [], { items: [] }, { results: null }, { results: {} }]) {
    productResponse = invalid;
    categoryResponse = invalid;
    await assert.rejects(getProducts(), /Invalid product response/);
    await assert.rejects(getCategories(), /Invalid category response/);
  }
  productResponse = { items: [] };
  await assert.rejects(getProducts(), /Invalid product response/);
  categoryResponse = {};
  await assert.rejects(getCategories(), /Invalid category response/);
  responseStatus = 503;
  await assert.rejects(getProducts(), (error) => error.status === 503);
  responseStatus = 200;
});

test('catalog HTTP: query cancellation reaches fetch', async () => {
  responseDelay = 500;
  const controller = new AbortController();
  const pending = getProducts({}, controller.signal);
  setTimeout(() => controller.abort(), 25);
  await assert.rejects(pending, (error) => error.kind === 'aborted');
  responseDelay = 0;
});

test('catalog grouping: category order, unknown categories, and uncategorized products', () => {
  const later = { ...category, id: 3, order_index: 2 };
  const groups = catalog.groupProducts([
    { ...product, id: 1, category: later }, product, { ...product, id: 4, category: null },
  ], [category]);
  assert.deepEqual(groups.map((group) => group.category?.id ?? null), [2, 3, null]);
  assert.equal(groups[0].products[0].id, 353);
});

test('catalog presentation: Khmer names fall back to English and thumbnail paths append to the API base', () => {
  assert.equal(catalog.categoryName(category, 'km'), 'វីតាល់');
  assert.equal(catalog.productName(product, 'km'), apiProduct.line_name_kh);
  assert.equal(catalog.productName({ ...product, line_name_kh: '' }, 'km'), product.line_name);
  assert.equal(catalog.mediaUrl('/media/test.png', 'https://api.example.com/services'), 'https://api.example.com/services/media/test.png');
  assert.equal(catalog.mediaUrl('media/test.png', 'https://api.example.com/services/'), 'https://api.example.com/services/media/test.png');
  assert.equal(catalog.mediaUrl('/media/test.png', '/services/central'), '/services/central/media/test.png');
  assert.equal(catalog.mediaUrl('media/test.png', ''), '/media/test.png');
  assert.equal(catalog.mediaUrl('https://cdn.example.com/image.png'), 'https://cdn.example.com/image.png');
  assert.equal(catalog.mediaUrl(''), undefined);
  assert.equal(catalog.mediaUrl('javascript:alert(1)'), undefined);
});

test('draft: default UOM, increments, and removal at zero', () => {
  draft.getState().clear();
  draft.getState().adjust(product, 1);
  draft.getState().adjust(product, 1);
  assert.equal(draft.getState().items[353].quantity, 2);
  assert.deepEqual(draft.getState().items[353].uom, product.default_uom);
  draft.getState().adjust(product, -1);
  draft.getState().adjust(product, -1);
  assert.equal(draft.getState().items[353], undefined);
  draft.getState().adjust(product, -1);
  assert.deepEqual(draft.getState().items, {});
});

test('draft: decimal steps do not drift and invalid steps default to one', () => {
  const fractional = { ...product, qty_step: '0.1000' };
  for (let i = 0; i < 3; i++) draft.getState().adjust(fractional, 1);
  assert.equal(draft.getState().items[353].quantity, 0.3);
  for (let i = 0; i < 3; i++) draft.getState().adjust(fractional, -1);
  assert.deepEqual(draft.getState().items, {});
  for (const value of [null, '', 'invalid', '0', '-1', 'Infinity']) assert.equal(quantityStep(value), 1);
});

test('draft: directly entered quantities replace the amount and zero removes the item', () => {
  assert.equal(draft.getState().setQuantity(product, 12), true);
  assert.equal(draft.getState().items[353].quantity, 12);
  assert.deepEqual(draft.getState().items[353].uom, product.default_uom);
  draft.getState().adjust(product, 1);
  assert.equal(draft.getState().items[353].quantity, 13);
  assert.equal(draft.getState().setQuantity(product, 0), true);
  assert.deepEqual(draft.getState().items, {});
});

test('draft: manual quantities respect decimal steps and invalid input preserves the amount', () => {
  const fractional = { ...product, qty_step: '0.2500' };
  assert.equal(draft.getState().setQuantity(fractional, 2.5), true);
  for (const invalid of [-1, NaN, Infinity, 2.6, 2.50001, Number.MAX_VALUE]) {
    assert.equal(draft.getState().setQuantity(fractional, invalid), false);
    assert.equal(draft.getState().items[353].quantity, 2.5);
  }
  draft.getState().clear();
});

test('draft: token rotation preserves selection, session replacement and reset clear it', () => {
  draft.getState().adjust(product, 1);
  session.getState().applyRefreshedToken('fixture-token', 'rotated-token', session.getState().sessionVersion);
  assert.equal(draft.getState().items[353].quantity, 1);
  session.getState().setLanguage('km');
  assert.equal(draft.getState().items[353].quantity, 1);
  session.getState().setAuthToken('another-session');
  assert.deepEqual(draft.getState().items, {});
  draft.getState().adjust(product, 1);
  session.getState().reset();
  assert.deepEqual(draft.getState().items, {});
});
