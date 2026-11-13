// Local stand-in only. No real credentials or production data.
const http = require('node:http');
let refreshes = 0;
let protectedRequests = 0;
let orderRequests = 0;
let savedOrders = 0;
function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(value));
}
async function form(req) {
  if (req.body !== undefined) {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
    return Object.fromEntries(new URLSearchParams(String(req.body)));
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString();
  return String(req.headers['content-type']).startsWith('application/json')
    ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw));
}
http.createServer(async (req, res) => {
  try {
    const body = form(req);
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    if (req.method === 'POST' && path === '/services/central/api/name/staff-order-save/exec') {
      orderRequests++;
      const payload = await body;
      const reauth = url.searchParams.has('reauth');
      const authorized = req.headers.authorization === `Bearer ${reauth ? 'fresh-token-next' : 'fresh-token'}`;
      if (!authorized || url.searchParams.has('always')) {
        if (reauth) return json(res, 401, { message: 'Original API unauthorized', code: 'expired_access_token' });
        return json(res, 500, { status: 550, error: 'Data failure',
          message: '[401 Unauthorized] during [POST] to [http://sfa/mobile/staff-order/save/] [SFAApiProxy#staffOrder(JsonNode)]: []' });
      }
      savedOrders++;
      return json(res, 200, { status: 'success', data: { id: savedOrders }, payload });
    }
    if (req.method === 'POST' && path === '/mobile/auth/refresh') {
      refreshes++;
      const data = await body;
      if (!String(req.headers['content-type']).startsWith('application/x-www-form-urlencoded') ||
          data.grant_type !== 'refresh_token' || data.client_id !== 'central_app') {
        return json(res, 400, { error: 'invalid_request' });
      }
      if (data.refresh_token === 'fixture-refresh-down') return json(res, 503, { error: 'temporarily_unavailable' });
      if (data.refresh_token === 'fixture-refresh-malformed') return json(res, 200, { access_token: '' });
      if (!['fixture-refresh-ok', 'fixture-refresh-rotated', 'fixture-refresh-slow'].includes(data.refresh_token)) return json(res, 400, { error: 'invalid_grant' });
      // Exceeds the miniapp's former 10-second bridge limit, without real credentials.
      if (data.refresh_token === 'fixture-refresh-slow') await new Promise((resolve) => setTimeout(resolve, 11_000));
      return json(res, 200, { access_token: data.refresh_token === 'fixture-refresh-rotated' ? 'fresh-token-next' : 'fresh-token', refresh_token: 'fixture-refresh-rotated', token_type: 'Bearer', expires_in: 300 });
    }
    const sfaRead = path === '/services/central/api/name/staff-order-detail/find';
    if (req.method === 'GET' && (sfaRead || ['/protected', '/central/api/me'].includes(path))) {
      protectedRequests++;
      if (req.headers.authorization !== 'Bearer fresh-token' || url.searchParams.has('always')) {
        if (sfaRead) {
          const upstream = { message: 'Unauthorized', title: 'Unauthorized', ex: {
            message: url.searchParams.get('variant') === 'internal-expired'
              ? 'Internal microservice token has expired.' : 'Token has expired.', code: 'authentication_failed',
          } };
          return json(res, 500, {
            timestamp: '2026-11-12T01:24:00Z', status: 550, error: 'Data failure',
            message: `[401 Unauthorized] during [GET] to [http://sfa/mobile/staff-order-detail/32/] [SFAApiProxy#staffOrderDetail(Long)]: [${JSON.stringify(upstream)}]`,
          });
        }
        return json(res, 401, { message: 'Original API unauthorized', code: 'expired_access_token' });
      }
      return json(res, 200, {
        username: 'fixture-user', roles: ['ROLE_USER'], authorized: true,
        ...(sfaRead ? { id: Number(url.searchParams.get('id') || 32), items: [] } : {}),
      });
    }
    if (req.method === 'GET' && path === '/__fixture/stats') return json(res, 200, { refreshes, protectedRequests, orderRequests, savedOrders });
    json(res, 501, { message: 'Endpoint is not modeled by this local fixture.' });
  } catch { json(res, 500, { error: 'fixture_error' }); }
}).listen(process.env.PORT || 4900);
