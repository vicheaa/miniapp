// Local stand-in only. No real credentials or production data.
const http = require('node:http');
let refreshes = 0;
let protectedRequests = 0;
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
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString()));
}
http.createServer(async (req, res) => {
  try {
    const body = form(req);
    const path = new URL(req.url, 'http://localhost').pathname;
    if (req.method === 'POST' && path === '/mobile/auth/refresh') {
      refreshes++;
      const data = await body;
      if (!String(req.headers['content-type']).startsWith('application/x-www-form-urlencoded') ||
          data.grant_type !== 'refresh_token' || data.client_id !== 'central_app') {
        return json(res, 400, { error: 'invalid_request' });
      }
      if (data.refresh_token === 'fixture-refresh-down') return json(res, 503, { error: 'temporarily_unavailable' });
      if (data.refresh_token === 'fixture-refresh-malformed') return json(res, 200, { access_token: '' });
      if (!['fixture-refresh-ok', 'fixture-refresh-rotated'].includes(data.refresh_token)) return json(res, 400, { error: 'invalid_grant' });
      return json(res, 200, { access_token: 'fresh-token', refresh_token: 'fixture-refresh-rotated', token_type: 'Bearer', expires_in: 300 });
    }
    if (req.method === 'GET' && ['/protected', '/central/api/me'].includes(path)) {
      protectedRequests++;
      if (req.headers.authorization !== 'Bearer fresh-token') {
        return json(res, 401, { message: 'Original API unauthorized', code: 'expired_access_token' });
      }
      return json(res, 200, { username: 'fixture-user', roles: ['ROLE_USER'], authorized: true });
    }
    if (req.method === 'GET' && path === '/__fixture/stats') return json(res, 200, { refreshes, protectedRequests });
    json(res, 501, { message: 'Endpoint is not modeled by this local fixture.' });
  } catch { json(res, 500, { error: 'fixture_error' }); }
}).listen(process.env.PORT || 4900);
