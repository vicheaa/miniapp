// Local contract fixture based on the GET response supplied for this page.
const http = require('node:http');
const catalog = require('./catalog.json');
const customers = require('./customers.json');
const orderHistory = require('./order-history.json');
const merchant = { id: 1, name: 'Chamkar Coffee', code: 'CHAMKAR-COFFEE', is_active: true,
  created_at: '2026-09-24T16:39:18.000000Z', updated_at: '2026-09-24T16:39:18.000000Z' };
const apps = [
  { id: '01a09b49-7657-7303-a0f9-28f1edf44b7e', name: 'Chamkar Coffee Main Register', app_key: 'CHAMKAR-POS-APP-01', merchant_id: 1, ccy: 'usd', second_ccy: 'khr', is_active: true, created_at: '2026-09-24T16:39:19.000000Z', updated_at: '2026-10-15T08:17:28.000000Z', order_sources_count: 12, merchant },
  { id: '01a09b49-765b-735d-9d93-2e51f6745fdd', name: 'Chamkar Coffee Bar Register', app_key: 'CHAMKAR-POS-APP-02', merchant_id: 1, ccy: 'KHR', second_ccy: 'USD', is_active: true, created_at: '2026-09-24T16:39:19.000000Z', updated_at: '2026-09-24T16:39:19.000000Z', order_sources_count: 0, merchant },
];
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/api/admin/orders') {
    const page = Number(url.searchParams.get('page') || 1);
    res.setHeader('Content-Type', 'application/json');
    if ([401, 403, 500].includes(page)) { res.writeHead(page); return res.end(JSON.stringify({ message: 'Test error' })); }
    if (page === 998) return res.end(JSON.stringify({ data: 'invalid' }));
    if (page === 999) return res.end(JSON.stringify({ current_page: 999, last_page: 999, per_page: 20, total: 0, from: null, to: null, data: [] }));
    // Synthetic second page for verifying append/stop behavior; only page one was supplied.
    if (page === 2 && url.searchParams.get('per_page') === '20') return res.end(JSON.stringify({
      ...orderHistory, current_page: 2, from: 21, to: 27,
      data: orderHistory.data.slice(0, 7).map((order, index) => ({ ...order, id: `local-history-${index + 21}`, order_number: `LOCAL-HISTORY-${index + 21}` })),
    }));
    // The supplied fixture covers page one only.
    if (page !== 1 || url.searchParams.get('per_page') !== '20') { res.writeHead(501); return res.end(JSON.stringify({ message: 'Page not modeled' })); }
    return res.end(JSON.stringify(orderHistory));
  }
  if (req.method === 'POST' && url.pathname === '/api/admin/orders') {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      let body;
      try { body = JSON.parse(raw); } catch { res.writeHead(400); return res.end(JSON.stringify({ message: 'Invalid JSON' })); }
      // Reserved customer names exercise checkout failures against local fixtures only.
      if (body.customer_name === '__validation__') { res.writeHead(422); return res.end(JSON.stringify({ message: 'Validation failed', errors: { customer_id: ['The selected customer is invalid.'] } })); }
      if (body.customer_name === '__server_error__') { res.writeHead(500); return res.end(JSON.stringify({ message: 'Test server error' })); }
      if (body.customer_name === '__unauthorized__') { res.writeHead(401); return res.end(JSON.stringify({ message: 'Unauthenticated' })); }
      if (!body.pos_app_id || body.merchant_id !== 1 || !body.customer_name || body.status !== 'completed'
        || !['paid', 'unpaid'].includes(body.payment_status) || !['cash', 'bank'].includes(body.payment_method)
        || !Array.isArray(body.items) || !body.items.length || body.items.some((item) => !item.product_id
          || !Number.isFinite(item.price) || item.price < 0 || !Number.isInteger(item.quantity) || item.quantity < 1)) {
        res.writeHead(422); return res.end(JSON.stringify({ message: 'Invalid order payload' }));
      }
      res.writeHead(201);
      // Assumed response for local verification; the real success response was not provided.
      res.end(JSON.stringify({ data: { id: 'local-order-1', ...body } }));
    });
    return;
  }
  const terminalRoutes = {
    '/api/admin/customers': customers.data,
    '/api/admin/products': catalog.products,
    '/api/admin/categories': catalog.categories,
    '/api/admin/exchange-rates': catalog.rates,
    [`/api/admin/pos-apps/${catalog.app.id}`]: catalog.app,
    '/api/admin/pos-apps/01a09b49-765b-735d-9d93-2e51f6745fdd': { ...catalog.app, id: '01a09b49-765b-735d-9d93-2e51f6745fdd', name: 'Chamkar Coffee Bar Register', ccy: 'KHR', second_ccy: 'USD', order_sources: [] },
  };
  if (req.method === 'GET' && terminalRoutes[url.pathname]) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ data: terminalRoutes[url.pathname] }));
  }
  if (req.method !== 'GET' || url.pathname !== '/api/admin/pos-apps') {
    res.writeHead(501, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: 'Endpoint not modeled' }));
  }
  // Reserved fixture pages exercise client failure handling without real credentials.
  const page = Number(url.searchParams.get('page') || 1);
  if (page === 401 || page === 403 || page === 500) {
    res.writeHead(page, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: 'Test error' }));
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  if (page === 999) return res.end(JSON.stringify({ data: 'invalid' }));
  res.end(JSON.stringify({ current_page: page, data: page === 1 ? apps : [],
    from: page === 1 ? 1 : null, to: page === 1 ? 2 : null,
    last_page: 1, per_page: 10, total: 2 }));
}).listen(process.env.PORT);
