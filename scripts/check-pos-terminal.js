import assert from 'node:assert/strict';
import { createServer } from 'vite';

process.env.VITE_POS_API_BASE_URL = process.env.POS_TEST_API_BASE_URL || 'http://127.0.0.1:4900/pos';
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const api = await vite.ssrLoadModule('/src/services/api/pos-terminal.ts');
  const { convertPrice, cartTotal } = await vite.ssrLoadModule('/src/utils/pos-pricing.ts');
  const id = '01a09b49-7657-7303-a0f9-28f1edf44b7e';
  const [app, products, categories, rates] = await Promise.all([
    api.fetchPosApp(id), api.fetchProducts(), api.fetchCategories(), api.fetchExchangeRates(),
  ]);
  assert.equal(app.id, id);
  assert.equal(app.order_sources.length, 12);
  assert.equal(products.length, 8); // Only complete records from the truncated attachment.
  assert.equal(categories.length, 3);
  assert.equal(products[0].variants.length, 6);
  assert.equal(convertPrice(6000, 'KHR', 'usd', rates), 6000 / 4100);
  assert.equal(convertPrice(2, 'USD', 'khr', rates), 8200);
  assert.equal(convertPrice(6000, 'KHR', 'KHR', []), 6000);
  assert.equal(convertPrice(6000, 'KHR', 'USD', []), null);
  assert.equal(convertPrice(-10, 'KHR', 'KHR', rates), null);
  assert.equal(convertPrice(6000, 'KHR', 'USD', [{ ...rates[0], is_active: false }]), null);
  const line = { key: 'test', productId: 'test', name: 'Coffee', options: '', price: 6000, currency: 'KHR', quantity: 2 };
  assert.equal(cartTotal([line], 'USD', rates), 2.93);
  assert.equal(cartTotal([line], 'KHR', rates), 12000);
  assert.equal(cartTotal([line], 'USD', []), null);
  assert.equal(cartTotal([], 'USD', []), 0);
  assert.equal(api.productImageUrl('/storage/products/coffee.jpg'), `${process.env.VITE_POS_API_BASE_URL}/storage/products/coffee.jpg`);
  assert.equal(api.productImageUrl('https://example.com/image.jpg'), 'https://example.com/image.jpg');

  const { default: Terminal } = await vite.ssrLoadModule('/src/pages/PosTerminalPage.tsx');
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
  const { MemoryRouter, Routes, Route } = await import('react-router-dom');
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const client = new QueryClient();
  for (const [key, data] of [[['pos-app', id, ''], app], [['products', ''], products], [['categories', ''], categories], [['exchange-rates', ''], rates]]) client.setQueryData(key, data);
  const html = renderToStaticMarkup(h(QueryClientProvider, { client }, h(MemoryRouter, { initialEntries: [`/pos-apps/${id}/pos`] }, h(Routes, null, h(Route, { path: '/pos-apps/:appId/pos', element: h(Terminal) })))));
  for (const value of ['Coconut Coffee', 'Hot Latte', '$1.46', '6,000 ៛', 'All Products (8)', 'Cart is empty', 'Foodpanda']) assert.ok(html.includes(value), value);
  client.clear();
  console.log('Passed: four terminal API calls, product options, currency conversion, missing rates, order totals, images, and terminal rendering.');
} finally { await vite.close(); }
