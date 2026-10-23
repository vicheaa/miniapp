import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InfiniteQueryObserver, QueryClient, QueryClientProvider } from '@tanstack/react-query';

process.env.VITE_POS_API_BASE_URL = process.env.POS_TEST_API_BASE_URL || 'http://127.0.0.1:4900/pos';
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const client = new QueryClient();
try {
  const { fetchOrderHistory } = await vite.ssrLoadModule('/src/services/api/orders.ts');
  const result = await fetchOrderHistory();
  assert.equal(result.data.length, 20);
  assert.equal(result.total, 27);
  assert.equal(result.last_page, 2);
  assert.equal(result.data[0].order_number, 'ORD-20261018-EFF4F6');
  assert.equal(result.data[0].items[0].variant_values.Sweetness, '0%');
  for (const [page, message] of [[401, /session has expired/], [403, /permission/], [500, /Unable to load/], [998, /unexpected order history/]]) {
    await assert.rejects(fetchOrderHistory(page), message);
  }
  assert.deepEqual((await fetchOrderHistory(999)).data, []);
  const { default: OrderHistory } = await vite.ssrLoadModule('/src/components/pos/OrderHistory.tsx');
  const render = () => renderToStaticMarkup(h(QueryClientProvider, { client }, h(OrderHistory)));
  assert.ok(render().includes('Loading orders'));
  client.setQueryData(['order-history', ''], { pages: [result], pageParams: [1] });
  const html = render();
  for (const value of ['ORD-20261018-EFF4F6', '$2.44', '10,000 ៛', 'paid', '20 recent orders loaded', 'Scroll to load more orders', 'Receipt']) assert.ok(html.includes(value), value);
  assert.ok(!html.includes('<dialog'));
  assert.ok(!html.includes('Previous'));
  assert.equal((html.match(/<tr>/g) || []).length, 21);
  const observer = new InfiniteQueryObserver(client, {
    queryKey: ['order-history', ''], initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => fetchOrderHistory(pageParam, signal),
    getNextPageParam: (last) => last.current_page < last.last_page ? last.current_page + 1 : undefined,
  });
  const next = await observer.fetchNextPage();
  assert.equal(next.data.pages.length, 2);
  assert.equal(next.data.pages.flatMap((page) => page.data).length, 27);
  assert.equal(next.hasNextPage, false);
  const all = render();
  assert.ok(all.includes('LOCAL-HISTORY-27'));
  assert.ok(all.includes('All orders loaded'));
  assert.equal((all.match(/<tr>/g) || []).length, 28);
  observer.destroy();
  const { buildHistoryReceipt } = await vite.ssrLoadModule('/src/utils/receipt.ts');
  const receipt = buildHistoryReceipt({ ...result.data[0], payment_status: 'unpaid', payment_method: 'card', status: 'pending' });
  for (const value of ['Green Tea', 'Sweetness: 0%', '$2.44', '10,000 KHR', 'Payment: card', 'Payment status: unpaid', 'Order status: pending']) assert.ok(receipt.text.includes(value), value);
  client.setQueryData(['order-history', ''], { pages: [{ ...result, data: [], from: null, to: null, total: 0, last_page: 1 }], pageParams: [1] });
  assert.ok(render().includes('No orders found.'));
  console.log('Passed: history API parameters and errors; table/loading/empty rendering; infinite query appends 20 + 7 orders and stops; receipt preserves saved totals and payment state.');
} finally {
  client.clear();
  await vite.close();
}
