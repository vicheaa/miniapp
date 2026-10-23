import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

process.env.VITE_POS_API_BASE_URL = process.env.POS_TEST_API_BASE_URL || 'http://127.0.0.1:4900/pos';
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const client = new QueryClient();
try {
  const api = await vite.ssrLoadModule('/src/services/api/pos-terminal.ts');
  const { default: Terminal } = await vite.ssrLoadModule('/src/pages/PosTerminalPage.tsx');
  const { default: Checkout } = await vite.ssrLoadModule('/src/components/pos/OrderCheckout.tsx');
  const { buildOrderPayload } = await vite.ssrLoadModule('/src/utils/order-payload.ts');
  const id = '01a09b49-7657-7303-a0f9-28f1edf44b7e';
  const [customers, app, products, categories, rates] = await Promise.all([
    api.fetchCustomers(), api.fetchPosApp(id), api.fetchProducts(), api.fetchCategories(), api.fetchExchangeRates(),
  ]);
  assert.equal(customers.length, 14);
  assert.equal(customers[1].name, 'VIP Member');
  assert.equal(customers[10].telegram_id, '2140216903');
  for (const [key, data] of [[['customers', ''], customers], [['pos-app', id, ''], app], [['products', ''], products], [['categories', ''], categories], [['exchange-rates', ''], rates]]) client.setQueryData(key, data);
  const html = renderToStaticMarkup(h(QueryClientProvider, { client }, h(MemoryRouter, { initialEntries: [`/pos-apps/${id}/pos`] }, h(Routes, null, h(Route, { path: '/pos-apps/:appId/pos', element: h(Terminal) })))));
  for (const text of ['aria-label="Customer"', 'VIP Member', 'Guest SOQXPO', 'Vid VieTips', 'aria-label="Order source"']) assert.ok(html.includes(text), text);
  const record = customers[10];
  const customer = { id: String(record.id), name: record.name, email: record.email || '', phone: record.phone || '', telegramId: record.telegram_id || '' };
  const order = { id: 1, sourceId: '', note: '', customer, lines: [{ key: 'coffee', productId: 'coffee', name: 'Coffee', options: '', price: 1.22, currency: 'USD', quantity: 1 }] };
  const checkout = renderToStaticMarkup(h(Checkout, { order, app, rates, onClose() {}, onSuccess() {} }));
  for (const value of [customer.id, customer.name, customer.email, customer.telegramId]) assert.ok(checkout.includes(`value="${value}"`), value);
  const payload = buildOrderPayload(order, app, rates, customer, {});
  assert.equal(payload.customer_id, '11');
  assert.equal(payload.customer_telegram_id, '2140216903');
  assert.equal(payload.customer_email, record.email);
  client.setQueryData(['customers', ''], []);
  const empty = renderToStaticMarkup(h(QueryClientProvider, { client }, h(MemoryRouter, { initialEntries: [`/pos-apps/${id}/pos`] }, h(Routes, null, h(Route, { path: '/pos-apps/:appId/pos', element: h(Terminal) })))));
  assert.ok(empty.includes('No saved customers.'));
  console.log('Passed: customer HTTP route, 14 customer records, selector rendering, empty state, checkout prefill, and selected customer order payload.');
} finally { client.clear(); await vite.close(); }
