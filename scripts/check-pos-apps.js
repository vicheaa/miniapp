import assert from 'node:assert/strict';
import { createServer } from 'vite';

// Start the documented local Postman simulation first. No real API or auth is used.
process.env.VITE_POS_API_BASE_URL = process.env.POS_TEST_API_BASE_URL || 'http://127.0.0.1:4900/pos';
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { fetchPosApps } = await vite.ssrLoadModule('/src/services/api/pos-apps.ts');
  const result = await fetchPosApps(1);
  assert.equal(result.data.length, 2);
  assert.equal(result.data[0].name, 'Chamkar Coffee Main Register');
  assert.equal(result.data[0].ccy, 'usd');
  assert.equal(result.data[1].ccy, 'KHR');
  assert.equal(result.data[0].order_sources_count, 12);
  assert.deepEqual((await fetchPosApps(2)).data, []);
  await assert.rejects(fetchPosApps(401), /session has expired/);
  await assert.rejects(fetchPosApps(403), /permission/);
  await assert.rejects(fetchPosApps(500), /Unable to load/);
  await assert.rejects(fetchPosApps(999), /unexpected POS apps response/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetchPosApps(1, controller.signal), { name: 'AbortError' });

  // Render the actual page with the same response cached, without a browser or live backend.
  const { default: HomePage } = await vite.ssrLoadModule('/src/pages/HomePage.tsx');
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MemoryRouter } = await import('react-router-dom');
  const queryClient = new QueryClient();
  queryClient.setQueryData(['pos-apps', 1, ''], result);
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client: queryClient }, createElement(MemoryRouter, null, createElement(HomePage))));
  for (const expected of ['Chamkar Coffee Main Register', 'Chamkar Coffee Bar Register', 'CHAMKAR-POS-APP-01', 'CHAMKAR-POS-APP-02', 'Active', 'usd', 'KHR']) assert.ok(html.includes(expected), expected);
  queryClient.clear();
  console.log('Passed: real HTTP list, empty page, 401/403/500, malformed response, cancellation, and page rendering.');
} finally {
  await vite.close();
}
