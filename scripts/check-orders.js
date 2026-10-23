import assert from 'node:assert/strict';
import { createServer } from 'vite';
process.env.VITE_POS_API_BASE_URL = process.env.POS_TEST_API_BASE_URL || 'http://127.0.0.1:4900/pos';
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { buildOrderPayload } = await vite.ssrLoadModule('/src/utils/order-payload.ts');
  const { createOrder } = await vite.ssrLoadModule('/src/services/api/orders.ts');
  const api = await vite.ssrLoadModule('/src/services/api/pos-terminal.ts');
  const [app, rates] = await Promise.all([api.fetchPosApp('01a09b49-7657-7303-a0f9-28f1edf44b7e'), api.fetchExchangeRates()]);
  const draft = { id: 1, note: '', sourceId: '', lines: [{ key: 'latte', productId: 'hot-latte', variantId: 'hot-latte-sweetness-0', name: 'Hot Latte', options: 'Sweetness: 0%', price: 5000, currency: 'KHR', quantity: 2 }] };
  const customer = { id: '2', name: 'VIP Member', email: 'vip@chamkarcoffee.com', phone: '', telegramId: '' };
  const payload = buildOrderPayload(draft, app, rates, customer, { latte: '123' });
  assert.deepEqual(payload, {
    customer_id: '2', merchant_id: 1, pos_app_id: app.id, customer_name: 'VIP Member', customer_email: 'vip@chamkarcoffee.com', customer_phone: null, customer_telegram_id: null,
    status: 'completed', payment_status: 'paid', payment_method: 'cash', currency: 'USD', second_currency: 'KHR', exchange_rate: 4100, second_grand_total: 10000, notes: null,
    items: [{ product_id: 'hot-latte', product_variant_id: 'hot-latte-sweetness-0', quantity: 2, price: 1.2195121951219512, notes: '123' }],
  });
  assert.throws(() => buildOrderPayload({ ...draft, lines: [] }, app, rates, customer, {}), /at least one item/);
  assert.throws(() => buildOrderPayload(draft, app, [], customer, {}), /exchange rate/);
  assert.throws(() => buildOrderPayload(draft, app, rates, { ...customer, name: ' ' }, {}), /customer name/);
  assert.throws(() => buildOrderPayload(draft, { ...app, is_active: false }, rates, customer, {}), /inactive/);
  assert.equal(buildOrderPayload({ ...draft, sourceId: app.order_sources[0].id }, app, rates, customer, {}).notes, 'Order source: Foodpanda');
  const khr = buildOrderPayload(draft, { ...app, ccy: 'KHR', second_ccy: 'USD' }, rates, customer, {});
  assert.equal(khr.items[0].price, 5000); assert.equal(khr.second_grand_total, 2.44);
  const singleCurrency = buildOrderPayload(draft, { ...app, second_ccy: null }, rates, customer, {});
  assert.equal(singleCurrency.exchange_rate, null); assert.equal(singleCurrency.second_grand_total, null);
  assert.deepEqual(await createOrder(payload), { id: 'local-order-1' });
  const bankPayload = buildOrderPayload(draft, app, rates, customer, {}, { status: 'unpaid', method: 'bank' });
  assert.equal(bankPayload.payment_status, 'unpaid');
  assert.equal(bankPayload.payment_method, 'bank');
  assert.deepEqual(await createOrder(bankPayload), { id: 'local-order-1' });
  const { buildReceipt } = await vite.ssrLoadModule('/src/utils/receipt.ts');
  const receipt = buildReceipt(bankPayload, draft, app);
  assert.ok(receipt.text.includes('Payment: BANK'));
  assert.ok(receipt.text.includes('Status: UNPAID'));
  const { default: OrderCheckout } = await vite.ssrLoadModule('/src/components/pos/OrderCheckout.tsx');
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const html = renderToStaticMarkup(h(OrderCheckout, { order: draft, app, rates, onClose() {}, onSuccess() {} }));
  for (const text of ['Review &amp; Place Order', 'Order items', 'Payment status', 'Payment method', 'Payment summary', 'Total payable', 'Place Order', 'Cash payment', 'Transfer / QR', 'Customer details', 'Hot Latte', '$2.44', '10,000 ៛']) assert.ok(html.includes(text), text);
  await assert.rejects(createOrder({ ...payload, customer_name: '__validation__' }), /selected customer is invalid/);
  await assert.rejects(createOrder({ ...payload, customer_name: '__server_error__' }), /Check your orders before trying again/);
  await assert.rejects(createOrder({ ...payload, customer_name: '__unauthorized__' }), /session has expired/);
  console.log('Passed: review dialog rendering, default cash/paid and bank/unpaid payloads, matching receipt state, full-precision prices, totals, validation, and POST success/422/500/401 over HTTP.');
} finally { await vite.close(); }
