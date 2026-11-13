const http = require('node:http');
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/fixture.svg') {
    const color = ['blue', 'orange', 'red'].includes(url.searchParams.get('color')) ? url.searchParams.get('color') : 'blue';
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    return res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="220" viewBox="0 0 300 220"><rect x="22" y="35" width="256" height="150" rx="8" fill="${color}" opacity=".12"/><path d="M22 35h256v150H22z" fill="none" stroke="${color}" stroke-width="3"/><text x="150" y="116" text-anchor="middle" font-size="25" fill="${color}">Fixture product</text></svg>`);
  }
  if (req.method === 'GET' && url.pathname === '/missing.png') { res.writeHead(404); return res.end(); }
  res.writeHead(501, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Endpoint not modeled by this fixture.' }));
}).listen(process.env.PORT || 4902);
