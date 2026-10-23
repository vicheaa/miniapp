import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, Clock3, Coffee, FileText, History, Layers, Maximize2, Minus, Plus, Printer, RotateCw, Search, ShoppingBag, ShoppingCart, Tag, Trash2, X } from 'lucide-react';
import { fetchCategories, fetchCustomers, fetchExchangeRates, fetchPosApp, fetchProducts, productImageUrl } from '../services/api/pos-terminal';
import { useMiniAppStore } from '../store/miniAppStore';
import type { DraftOrder, Product, ProductVariant } from '../types/pos-terminal';
import { cartTotal, convertPrice, money } from '../utils/pos-pricing';
import ProductOptions from '../components/pos/ProductOptions';
import OrderCheckout from '../components/pos/OrderCheckout';
import OrderHistory from '../components/pos/OrderHistory';
import ReceiptPrintDialog from '../components/pos/ReceiptPrintDialog';
import { openPrinterSettings } from '../services/bridge/printer';
import type { SavedReceipt } from '../utils/receipt';
import './pos-terminal.css';

function ProductImage({ product }: { product: Product }) {
  const src = productImageUrl(product.image);
  const [failed, setFailed] = useState(false);
  return src && !failed ? <img src={src} alt={product.name} loading="lazy" onError={() => setFailed(true)} />
    : <div className="terminal-image-fallback"><Coffee size={44} strokeWidth={1} /><span>{product.name}</span></div>;
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  return <span className="terminal-clock"><Clock3 size={14} />{now.toLocaleTimeString('en-US')}</span>;
}

export default function PosTerminalPage() {
  const { appId = '' } = useParams();
  // Reset local drafts when switching to a different register.
  return <Terminal key={appId} appId={appId} />;
}

function Terminal({ appId }: { appId: string }) {
  const queryClient = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const [historyActive, setHistoryActive] = useState(false);
  const authToken = useMiniAppStore((state) => state.authToken);
  const bridge = useMiniAppStore((state) => state.superApp);
  const app = useQuery({ queryKey: ['pos-app', appId, authToken], queryFn: ({ signal }) => fetchPosApp(appId, signal) });
  const products = useQuery({ queryKey: ['products', authToken], queryFn: ({ signal }) => fetchProducts(signal) });
  const categories = useQuery({ queryKey: ['categories', authToken], queryFn: ({ signal }) => fetchCategories(signal) });
  const exchange = useQuery({ queryKey: ['exchange-rates', authToken], queryFn: ({ signal }) => fetchExchangeRates(signal) });
  const customers = useQuery({ queryKey: ['customers', authToken], queryFn: ({ signal }) => fetchCustomers(signal) });
  const user = useQuery({ queryKey: ['bridge-user', bridge], queryFn: () => bridge!.getUserInfo(), enabled: !!bridge });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [orders, setOrders] = useState<DraftOrder[]>([{ id: 1, lines: [], note: '', sourceId: '' }]);
  const [activeOrder, setActiveOrder] = useState(1);
  const nextOrder = useRef(2);
  const [options, setOptions] = useState<Product | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [review, setReview] = useState(false);
  const [feedback, setFeedback] = useState({ text: '', autoDismiss: false });
  const message = feedback.text;
  const setMessage = (text: string, autoDismiss = false) => setFeedback({ text, autoDismiss });
  const [receipt, setReceipt] = useState<SavedReceipt | null>(null);
  const order = orders.find((item) => item.id === activeOrder)!;
  const rates = exchange.data || [];
  const currency = app.data?.ccy || 'USD';
  const secondCurrency = app.data?.second_ccy;
  const activeProducts = (products.data || []).filter((product) => product.is_active);
  const activeCategories = (categories.data || []).filter((item) => item.is_active);
  const term = search.trim().toLowerCase();
  const visibleProducts = activeProducts.filter((product) => (category === 'all' || product.category_id === category)
    && [product.name, product.description, product.sku, ...(product.variants || []).map((variant) => variant.sku)]
      .some((value) => value?.toLowerCase().includes(term)));
  const quantity = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = cartTotal(order.lines, currency, rates);
  const secondTotal = secondCurrency ? cartTotal(order.lines, secondCurrency, rates) : null;
  const userName = typeof user.data?.name === 'string' ? user.data.name : 'Account';
  const loading = [app, products, categories, exchange].some((query) => query.isPending);
  const failed = [app, products, categories, exchange].find((query) => query.isError);

  useEffect(() => {
    if (!feedback.text || !feedback.autoDismiss) return;
    const timer = window.setTimeout(() => setFeedback({ text: '', autoDismiss: false }), 2000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (!app.data) return;
    bridge?.setTitle(`${app.data.name} · POS`);
    return () => { bridge?.setTitle('POS Apps'); };
  }, [app.data?.name, bridge]);

  const updateOrder = (update: (draft: DraftOrder) => DraftOrder) => setOrders((current) => current.map((draft) => draft.id === activeOrder ? update(draft) : draft));
  const addProduct = (product: Product, variant?: ProductVariant, quantity = 1, note = '') => {
    const price = Number(variant?.price ?? product.price);
    if (convertPrice(price, product.currency, currency, rates) === null) return;
    const key = `${product.id}:${variant?.id || 'base'}${note ? `:${JSON.stringify(note)}` : ''}`;
    updateOrder((draft) => ({ ...draft, lines: draft.lines.some((line) => line.key === key)
      ? draft.lines.map((line) => line.key === key ? { ...line, quantity: line.quantity + quantity } : line)
      : [...draft.lines, { key, productId: product.id, name: product.name, variantId: variant?.id,
        options: variant ? Object.entries(variant.values).map(([name, value]) => `${name}: ${value}`).join(', ') : '',
        price, currency: product.currency, quantity, note }] }));
    setMessage(`${product.name} added to Order #${activeOrder}`, true);
  };
  const changeQuantity = (key: string, delta: number) => updateOrder((draft) => ({ ...draft, lines: draft.lines
    .map((line) => line.key === key ? { ...line, quantity: line.quantity + delta } : line).filter((line) => line.quantity > 0) }));
  const createOrder = () => {
    const id = nextOrder.current++;
    setOrders((current) => [...current, { id, lines: [], note: '', sourceId: '' }]);
    setActiveOrder(id); setShowNote(false); setHistoryActive(false);
  };
  const closeOrder = (id: number) => {
    const draft = orders.find((item) => item.id === id);
    if ((draft?.lines.length || draft?.note) && !window.confirm(`Discard Order #${id}?`)) return;
    const remaining = orders.filter((item) => item.id !== id);
    if (!remaining.length) {
      const next = nextOrder.current++;
      setOrders([{ id: next, lines: [], note: '', sourceId: '' }]); setActiveOrder(next);
    } else { setOrders(remaining); if (id === activeOrder) setActiveOrder(remaining[0].id); }
  };

  return <div className="terminal-page">
    <header className="terminal-topbar">
      <Link to="/" className="terminal-tool" aria-label="Back to POS apps" title="Back to POS apps"><ArrowLeft size={16} /></Link>
      <div className="terminal-tabs" role="tablist" aria-label="Terminal tabs">{orders.map((draft) => <div className={`terminal-tab ${!historyActive && activeOrder === draft.id ? 'active' : ''}`} key={draft.id}>
        <button role="tab" aria-selected={!historyActive && activeOrder === draft.id} onClick={() => { setActiveOrder(draft.id); setShowNote(false); setHistoryActive(false); }}><ShoppingBag size={14} />Order #{draft.id}<span className="terminal-count">{draft.lines.reduce((sum, line) => sum + line.quantity, 0)}</span></button>
        <button aria-label={`Close Order #${draft.id}`} onClick={() => closeOrder(draft.id)}><X size={13} /></button>
      </div>)}{showHistory && <div className={`terminal-tab ${historyActive ? 'active' : ''}`}>
        <button role="tab" aria-selected={historyActive} aria-controls="terminal-history-panel" onClick={() => setHistoryActive(true)}><History size={14} />Order History</button>
        <button aria-label="Close Order History" onClick={() => { setShowHistory(false); setHistoryActive(false); }}><X size={13} /></button>
      </div>}</div>
      <button className="terminal-tool" onClick={createOrder} aria-label="New order" title="New order"><Plus size={17} /></button>
      <span className="terminal-register" title={app.data?.name}><Layers size={16} /><span>{app.data?.name}</span></span>
      <div className="terminal-top-actions"><button className="terminal-tool terminal-fullscreen" aria-label="Toggle fullscreen" onClick={() => {
        const action = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
        void action.catch(() => setMessage('Fullscreen is unavailable in this browser.'));
      }}><Maximize2 size={17} /></button><Clock />
      <button type="button" className="terminal-tool" aria-label="Reload POS" title="Reload POS" onClick={() => {
        if (orders.some((draft) => draft.lines.length > 0 || draft.note) && !window.confirm('Reload POS and discard all unfinished orders?')) return;
        window.location.reload();
      }}><RotateCw size={17} /></button>
      <button className="terminal-tool" aria-label="Printer settings" title="Printer settings" onClick={() => {
        void openPrinterSettings(bridge).catch((error) => setMessage(error instanceof Error ? error.message : 'Unable to open printer settings.'));
      }}><Printer size={17} /></button>
      <button className="terminal-history" aria-label="Order History" title="Order History" onClick={() => { setShowHistory(true); setHistoryActive(true); }}><History size={14} /><span>Order History</span></button>
      <span className="terminal-user"><b>{userName.charAt(0)}</b><span>{userName}</span><ChevronDown size={13} /></span></div>
    </header>

    <div className="terminal-workspace" style={historyActive ? { display: 'none' } : undefined}>
      <main className="terminal-catalog">
        <div className="terminal-filters"><label className="terminal-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products by name, SKU, or description." aria-label="Search products" type="search" /></label>
          <div className="terminal-categories" aria-label="Product categories"><button className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>All Products ({activeProducts.length})</button>{activeCategories.map((item) => <button key={item.id} className={category === item.id ? 'active' : ''} onClick={() => setCategory(item.id)}>{item.name} ({activeProducts.filter((product) => product.category_id === item.id).length})</button>)}</div>
        </div>
        <div className="terminal-catalog-scroll">
          {loading ? <div className="terminal-product-grid" role="status" aria-label="Loading catalog">{Array.from({ length: 12 }, (_, index) => <div className="terminal-product-skeleton skeleton-shimmer" key={index} />)}</div>
          : failed ? <div className="terminal-state" role="alert"><h2>Unable to load the terminal</h2><p>{failed.error instanceof Error ? failed.error.message : 'Please try again.'}</p><button onClick={() => { for (const query of [app, products, categories, exchange]) if (query.isError) void query.refetch(); }}>Try again</button><Link to="/">Back to POS apps</Link></div>
          : !app.data?.is_active ? <div className="terminal-state"><h2>This register is inactive</h2><Link to="/">Back to POS apps</Link></div>
          : <div className="terminal-product-grid">{visibleProducts.map((product) => {
            const availableVariants = (product.variants || []).filter((variant) => variant.is_available);
            const primaryPrice = convertPrice(Number(product.price), product.currency, currency, rates);
            const available = primaryPrice !== null && (!product.variants?.length || availableVariants.length > 0);
            return <button key={product.id} className="terminal-product" disabled={!available} onClick={() => product.variants?.length ? setOptions(product) : addProduct(product)} aria-label={`Add ${product.name} to order`}>
              <div className="terminal-product-image"><ProductImage product={product} />{product.variants?.length ? <span className="terminal-option-count">{availableVariants.length} options</span> : null}</div>
              <div className="terminal-product-info"><span className="terminal-product-category">{product.category?.name || activeCategories.find((item) => item.id === product.category_id)?.name}</span><h2>{product.name}</h2><div className="terminal-product-bottom"><div><strong>{money(primaryPrice, currency)}</strong>{secondCurrency && <small>{money(convertPrice(Number(product.price), product.currency, secondCurrency, rates), secondCurrency)}</small>}{!available && <small>{primaryPrice === null ? 'Exchange rate unavailable' : 'Unavailable'}</small>}</div><span className="terminal-product-add"><Plus size={18} /></span></div></div>
            </button>;
          })}{!visibleProducts.length && <div className="terminal-state"><Coffee size={32} /><h2>No products found</h2><p>Try a different search or category.</p></div>}</div>}
        </div>
      </main>

      <aside className="terminal-cart" aria-label="Current order">
        <div className="terminal-order-header"><div className="terminal-order-title"><ShoppingCart size={20} /><strong>Order #{activeOrder}</strong><span className="terminal-count">{quantity} {quantity === 1 ? 'item' : 'items'}</span><button onClick={() => setShowNote((value) => !value)}><FileText size={14} />Add Note</button></div>
          <label className="terminal-source">Customer<select aria-label="Customer" value={order.customer?.id || ''} disabled={customers.isPending} onChange={(event) => {
            const selected = customers.data?.find((customer) => String(customer.id) === event.target.value);
            updateOrder((draft) => ({ ...draft, customer: selected ? {
              id: String(selected.id), name: selected.name, email: selected.email || '', phone: selected.phone || '', telegramId: selected.telegram_id || '',
            } : undefined }));
          }}><option value="">{customers.isPending ? 'Loading customers…' : '-- Walk-in / Custom Customer --'}</option>{customers.data?.map((customer) => <option key={customer.id} value={String(customer.id)}>{customer.name}{customer.email ? ` · ${customer.email}` : ''}</option>)}</select></label>
          {customers.isError && <p className="terminal-customer-error" role="alert">Unable to load customers. <button type="button" disabled={customers.isFetching} onClick={() => void customers.refetch()}>{customers.isFetching ? 'Retrying…' : 'Try again'}</button></p>}
          {customers.isSuccess && !customers.data.length && <p className="terminal-muted">No saved customers. Enter customer details at checkout.</p>}
          <label className="terminal-source">Order source<select aria-label="Order source" value={order.sourceId} onChange={(event) => updateOrder((draft) => ({ ...draft, sourceId: event.target.value }))}><option value="">-- Walk-in --</option>{app.data?.order_sources?.filter((source) => source.is_active).map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
          {showNote && <textarea className="terminal-note" aria-label="Order note" placeholder="Add a note for this order…" value={order.note} onChange={(event) => updateOrder((draft) => ({ ...draft, note: event.target.value }))} />}
        </div>
        {!order.lines.length ? <div className="terminal-empty-cart"><ShoppingCart size={40} strokeWidth={1.5} /><h2>Cart is empty</h2><p>Click on products from the catalog grid to add items to order.</p></div>
        : <div className="terminal-cart-lines">{order.lines.map((line) => <article key={line.key}><div className="terminal-line-heading"><strong>{line.name}</strong><button aria-label={`Remove ${line.name}`} onClick={() => updateOrder((draft) => ({ ...draft, lines: draft.lines.filter((item) => item.key !== line.key) }))}><Trash2 size={14} /></button></div>{line.options && <p>{line.options}</p>}{line.note && <p className="terminal-line-note">Note: {line.note}</p>}<div className="terminal-line-bottom"><div className="terminal-quantity"><button onClick={() => changeQuantity(line.key, -1)} aria-label={`Decrease ${line.name} quantity`}><Minus size={13} /></button><span>{line.quantity}</span><button onClick={() => changeQuantity(line.key, 1)} aria-label={`Increase ${line.name} quantity`}><Plus size={13} /></button></div><strong>{money(convertPrice(line.price * line.quantity, line.currency, currency, rates), currency)}</strong></div></article>)}</div>}
        <div className="terminal-summary"><button className="terminal-discount" disabled title="Promotion and discount endpoints have not been provided"><Tag size={14} />Add discount or promotion code</button><div className="terminal-subtotal"><span>Subtotal</span><span>{money(total, currency)}</span></div><div className="terminal-total"><strong>Total Amount</strong><div><strong>{money(total, currency)}</strong>{secondCurrency && quantity > 0 && <small>{money(secondTotal, secondCurrency)}</small>}</div></div>{total === null && <p className="terminal-price-warning">An exchange rate is missing for an item in this order.</p>}
          <button className="terminal-review" disabled={!quantity || total === null || loading || !!failed || !app.data?.is_active} onClick={() => setReview(true)}><FileText size={16} />Review Order ({money(total, currency)})</button>
        </div>
      </aside>
    </div>
    {message && <div className="terminal-feedback" role="status">{message}<button aria-label="Dismiss message" onClick={() => setMessage('')}><X size={14} /></button></div>}
    {options && <ProductOptions product={options} currency={currency} rates={rates} onAdd={addProduct} onClose={() => setOptions(null)} />}
    {showHistory && <OrderHistory active={historyActive} />}
    {review && app.data && <OrderCheckout order={order} app={app.data} rates={rates} onClose={() => setReview(false)} onSuccess={(draftId, savedId, savedReceipt) => {
      void queryClient.invalidateQueries({ queryKey: ['order-history'] });
      setReceipt(savedReceipt);
      setReview(false);
      setMessage(savedId !== undefined ? `Order ${savedId} saved successfully.` : 'Order saved successfully.');
      const freshId = nextOrder.current++;
      setOrders((current) => {
        const remaining = current.filter((draft) => draft.id !== draftId);
        return [...remaining, { id: freshId, lines: [], note: '', sourceId: '' }];
      });
      setActiveOrder(freshId);
      setShowNote(false);
    }} />}
    {receipt && <ReceiptPrintDialog receipt={receipt} bridge={bridge} onClose={() => setReceipt(null)} />}
  </div>;
}
