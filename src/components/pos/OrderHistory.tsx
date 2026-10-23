import { Fragment, useEffect, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { History, Printer, RotateCw, Search, ChevronDown } from 'lucide-react';
import { fetchOrderHistory } from '../../services/api/orders';
import { useMiniAppStore } from '../../store/miniAppStore';
import { money } from '../../utils/pos-pricing';
import { buildHistoryReceipt } from '../../utils/receipt';
import type { HistoryOrder } from '../../types/order';
import { printReceipt } from '../../services/bridge/printer';

const statuses = ['All', 'Pending', 'Processing', 'Shipped', 'Completed', 'Cancelled'];

export default function OrderHistory({ active = true }: { active?: boolean }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printMessage, setPrintMessage] = useState('');
  const scroll = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const authToken = useMiniAppStore((state) => state.authToken);
  const bridge = useMiniAppStore((state) => state.superApp);
  const history = useInfiniteQuery({
    queryKey: ['order-history', authToken],
    initialPageParam: 1,
    staleTime: 30_000,
    queryFn: ({ pageParam, signal }) => fetchOrderHistory(pageParam, signal),
    getNextPageParam: (last) => last.current_page < last.last_page ? last.current_page + 1 : undefined,
    enabled: active,
  });
  const { fetchNextPage, hasNextPage, isFetching, isFetchNextPageError } = history;
  const orders = [...new Map((history.data?.pages.flatMap((page) => page.data) || []).map((order) => [order.id, order])).values()];
  const term = search.trim().toLowerCase();
  const visible = orders.filter((order) => (status === 'All' || order.status.toLowerCase() === status.toLowerCase())
    && (!term || [order.order_number, order.customer_name].some((value) => value?.toLowerCase().includes(term))));

  useEffect(() => {
    if (!active || !hasNextPage || isFetching || isFetchNextPageError || !sentinel.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void fetchNextPage();
    }, { root: scroll.current, rootMargin: '0px 0px 240px 0px' });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [active, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage, search, status]);

  const print = async (order: HistoryOrder) => {
    if (printing) return;
    setPrinting(true); setPrintMessage('Contacting printer…');
    try { await printReceipt(bridge, buildHistoryReceipt(order).text); setPrintMessage(`Receipt for ${order.order_number} sent to printer.`); }
    catch (error) { setPrintMessage(error instanceof Error ? error.message : 'Unable to print receipt.'); }
    finally { setPrinting(false); }
  };

  return <section id="terminal-history-panel" role="tabpanel" aria-label="Order History" className="terminal-history-panel" style={active ? undefined : { display: 'none' }}>
    <header className="terminal-history-header"><History size={30} /><div><h1>Recent Orders History</h1><p>{orders.length} recent orders loaded{history.data ? ` of ${history.data.pages[0].total}` : ''} · View order details or print a receipt</p></div>
      <button className="terminal-tool" aria-label="Refresh order history" disabled={isFetching} onClick={() => void history.refetch()}><RotateCw size={17} /></button>
      <label className="terminal-search"><Search size={17} /><input type="search" aria-label="Search loaded orders" placeholder="Search Order # or Customer…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
    </header>
    <div className="terminal-history-filters" aria-label="Filter orders by status">{statuses.map((value) => <button key={value} aria-pressed={status === value} className={status === value ? 'active' : ''} onClick={() => setStatus(value)}>{value}</button>)}</div>
    {printMessage && <p className="terminal-history-message" role="status">{printMessage}</p>}
    <div className="terminal-history-scroll" ref={scroll}>
      {history.isPending ? <p className="terminal-state" role="status">Loading orders…</p>
        : history.isError && !history.data ? <div className="terminal-state" role="alert"><h2>Unable to load orders</h2><p>{history.error.message}</p><button disabled={isFetching} onClick={() => void history.refetch()}>Try again</button></div>
        : <>
          <div className="terminal-history-table-wrap"><table className="terminal-history-table"><thead><tr>{['Order #', 'Customer', 'Items', 'Total amount', 'Payment', 'Status', 'Date & time', 'Actions'].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{visible.map((order) => <Fragment key={order.id}><tr>
              <td><strong>{order.order_number}</strong></td><td><strong>{order.customer_name || 'Walk-in'}</strong></td>
              <td>{order.items.reduce((sum, item) => sum + item.quantity, 0)} items</td>
              <td className="terminal-history-amount"><strong>{money(Number(order.total_amount), order.currency)}</strong>{order.second_currency && order.second_grand_total !== null && <small>{money(Number(order.second_grand_total), order.second_currency)}</small>}</td>
              <td><span className={`terminal-history-badge ${order.payment_status === 'paid' ? 'success' : ''}`}>{order.payment_status}</span></td>
              <td><span className={`terminal-history-badge ${order.status === 'completed' ? 'success' : ''}`}>{order.status}</span></td>
              <td className="terminal-history-date">{new Date(order.created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</td>
              <td><div className="terminal-history-actions"><button disabled={printing} onClick={() => void print(order)}><Printer size={14} />Receipt</button><button aria-label={`Details for ${order.order_number}`} aria-expanded={expanded === order.id} onClick={() => setExpanded(expanded === order.id ? null : order.id)}><ChevronDown size={16} /></button></div></td>
            </tr>{expanded === order.id && <tr><td colSpan={8}><div className="terminal-history-details"><p>{order.pos_app?.name} · Payment: {order.payment_method || '—'} · Source: {order.source_name || 'Walk-in'}</p><ul>{order.items.map((item) => <li key={item.id}><div><strong>{item.quantity} × {item.product_name}</strong>{item.variant_values && <span>{Object.entries(item.variant_values).map(([name, value]) => `${name}: ${value}`).join(', ')}</span>}{item.notes && <span>Note: {item.notes}</span>}</div><strong>{money(Number(item.total), order.currency)}</strong></li>)}</ul>{order.notes && <p className="terminal-history-note">{order.notes}</p>}</div></td></tr>}</Fragment>)}</tbody>
          </table></div>
          {!visible.length && <p className="terminal-state">{orders.length ? 'No matching orders in the loaded history.' : 'No orders found.'}</p>}
          {history.isError && <div className="terminal-history-message" role="alert"><p>{history.error.message}</p><button disabled={isFetching} onClick={() => void (isFetchNextPageError ? fetchNextPage() : history.refetch())}>Try again</button></div>}
          <div ref={sentinel} className="terminal-history-sentinel" role="status">{history.isFetchingNextPage ? 'Loading more orders…' : history.isRefetching ? 'Refreshing orders…' : hasNextPage ? 'Scroll to load more orders' : orders.length ? 'All orders loaded' : ''}</div>
        </>}
    </div>
  </section>;
}
