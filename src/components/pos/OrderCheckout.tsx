import { useRef, useState } from 'react';
import { Banknote, Check, CircleCheck, Clock3, Landmark, ReceiptText, ShoppingBag, Store, UserRound } from 'lucide-react';
import type { DraftOrder, ExchangeRate, PosAppDetail } from '../../types/pos-terminal';
import type { OrderCustomer, OrderPayment } from '../../types/order';
import { buildOrderPayload } from '../../utils/order-payload';
import { cartTotal, convertPrice, money } from '../../utils/pos-pricing';
import { createOrder } from '../../services/api/orders';
import { buildReceipt, wrapReceiptText, type SavedReceipt } from '../../utils/receipt';
import TerminalDialog from './TerminalDialog';

export default function OrderCheckout({ order, app, rates, onClose, onSuccess }: {
  order: DraftOrder; app: PosAppDetail; rates: ExchangeRate[]; onClose: () => void;
  onSuccess: (draftId: number, savedId: string | number | undefined, receipt: SavedReceipt) => void;
}) {
  const [customer, setCustomer] = useState<OrderCustomer>(() => order.customer || { id: '', name: 'Walk-in', email: '', phone: '', telegramId: '' });
  const [itemNotes, setItemNotes] = useState<Record<string, string>>(() => Object.fromEntries(order.lines.map((line) => [line.key, line.note || ''])));
  const [payment, setPayment] = useState<OrderPayment>({ status: 'paid', method: 'cash' });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const field = (key: keyof OrderCustomer, value: string) => setCustomer((current) => ({ ...current, [key]: value }));
  const total = cartTotal(order.lines, app.ccy, rates);
  const secondTotal = app.second_ccy ? cartTotal(order.lines, app.second_ccy, rates) : null;
  const quantity = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  const paid = payment.status === 'paid';
  const method = payment.method === 'cash' ? 'Cash' : 'Bank';
  const rate = rates.find((value) => value.is_active && value.from_currency.toUpperCase() === app.ccy.toUpperCase()
    && value.to_currency.toUpperCase() === app.second_ccy?.toUpperCase() && Number(value.rate) > 0);
  const rateText = rate ? `Rate: 1 ${(rate.operation === 'divide' ? rate.to_currency : rate.from_currency).toUpperCase()} = ${Number(rate.rate).toLocaleString('en-US')} ${(rate.operation === 'divide' ? rate.from_currency : rate.to_currency).toUpperCase()}` : '';
  const totalLabel = `${money(total, app.ccy)}${app.second_ccy ? ` / ${money(secondTotal, app.second_ccy)}` : ''}`;

  return <TerminalDialog title="Review & Place Order" className="checkout-dialog" onClose={onClose} busy={pending} header={<div className="checkout-heading"><span className="checkout-heading-icon"><ShoppingBag size={25} /></span><div><div className="checkout-heading-title"><h2 id="terminal-dialog-title">Review &amp; Place Order</h2><span>Order #{order.id}</span></div><p>Verify cart items and configure payment before completing the order</p></div></div>}>
    <form className="checkout-form" onSubmit={async (event) => {
      event.preventDefault();
      if (submitting.current) return;
      submitting.current = true;
      setPending(true); setError('');
      try {
        const payload = buildOrderPayload(order, app, rates, customer, itemNotes, payment);
        // Prepare the receipt before saving so formatting cannot cause a duplicate sale.
        const receipt = buildReceipt(payload, order, app);
        const result = await createOrder(payload);
        if (result.id !== undefined) {
          const heading = wrapReceiptText(`Order: ${result.id}`);
          receipt.text = receipt.text.replace(`Register order: #${order.id}`, () => heading);
          receipt.orderId = result.id;
        }
        onSuccess(order.id, result.id, receipt);
      } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save the order. Your draft has been kept.'); }
      finally { submitting.current = false; setPending(false); }
    }}>
      <div className="checkout-items-panel">
        <div className="checkout-customer-banner"><span className="checkout-avatar"><UserRound size={20} /></span><strong>{customer.name.trim() || 'Walk-in Customer'}</strong><div className="checkout-register-tags"><span><Store size={14} />{app.merchant?.name || 'Store'}</span><span>{app.name}</span></div></div>
        <details className="checkout-customer-edit" onInvalidCapture={(event) => { event.currentTarget.open = true; }}><summary>Customer details</summary><fieldset disabled={pending} className="terminal-checkout-fields"><legend className="terminal-sr-only">Customer</legend><div className="terminal-customer-grid">
          <label>Name<input required value={customer.name} onChange={(event) => field('name', event.target.value)} autoComplete="name" /></label>
          <label>Customer ID (optional)<input value={customer.id} onChange={(event) => field('id', event.target.value)} /></label>
          <label>Email (optional)<input type="email" value={customer.email} onChange={(event) => field('email', event.target.value)} autoComplete="email" /></label>
          <label>Phone (optional)<input type="tel" value={customer.phone} onChange={(event) => field('phone', event.target.value)} autoComplete="tel" /></label>
          <label>Telegram ID (optional)<input value={customer.telegramId} onChange={(event) => field('telegramId', event.target.value)} /></label>
        </div></fieldset></details>
        <div className="checkout-section-title"><h3>Order items <span>{order.lines.length}</span></h3><span>{quantity} total qty</span></div>
        <fieldset disabled={pending} className="terminal-checkout-fields checkout-items"><legend className="terminal-sr-only">Order items</legend>{order.lines.map((line) => <article className="checkout-item" key={line.key}><div className="checkout-item-main"><div><h4>{line.name}{line.options && <span className="checkout-variant">{line.options}</span>}</h4><p>{line.quantity} × {money(convertPrice(line.price, line.currency, app.ccy, rates), app.ccy)}</p></div><strong>{money(convertPrice(line.price * line.quantity, line.currency, app.ccy, rates), app.ccy)}</strong></div><label className="terminal-item-note">Item note<input value={itemNotes[line.key] || ''} onChange={(event) => setItemNotes((current) => ({ ...current, [line.key]: event.target.value }))} placeholder="Optional" /></label></article>)}</fieldset>
        {order.note && <p className="terminal-review-note">{order.note}</p>}
        {order.sourceId && <p className="checkout-source">Order source: {app.order_sources?.find((source) => source.id === order.sourceId)?.name || 'Walk-in'}</p>}
      </div>
      <div className="checkout-payment-panel">
        <fieldset disabled={pending} className="terminal-checkout-fields checkout-payment-fields"><legend className="terminal-sr-only">Payment</legend>
          <div className="checkout-section-title"><h3>Payment status</h3><span className={`checkout-status ${paid ? 'paid' : ''}`}>{paid ? 'Paid' : 'Unpaid'}</span></div>
          <div className="checkout-status-options" role="group" aria-label="Payment status"><button type="button" aria-pressed={paid} className={paid ? 'selected' : ''} onClick={() => setPayment((value) => ({ ...value, status: 'paid' }))}><CircleCheck size={19} />Paid</button><button type="button" aria-pressed={!paid} className={!paid ? 'selected' : ''} onClick={() => setPayment((value) => ({ ...value, status: 'unpaid' }))}><Clock3 size={19} />Unpaid</button></div>
          <div className="checkout-section-title"><h3>Payment method</h3><strong>{method}</strong></div>
          <div className="checkout-methods" role="group" aria-label="Payment method"><button type="button" aria-pressed={payment.method === 'cash'} className={payment.method === 'cash' ? 'selected' : ''} onClick={() => setPayment((value) => ({ ...value, method: 'cash' }))}><span><Banknote size={24} /></span><div><strong>Cash</strong><small>Cash payment</small></div></button><button type="button" aria-pressed={payment.method === 'bank'} className={payment.method === 'bank' ? 'selected' : ''} onClick={() => setPayment((value) => ({ ...value, method: 'bank' }))}><span><Landmark size={24} /></span><div><strong>Bank</strong><small>Transfer / QR</small></div></button></div>
        </fieldset>
        <div className="checkout-summary"><div className="checkout-section-title"><h3>Payment summary</h3><ReceiptText size={20} /></div><dl><div><dt>Subtotal</dt><dd>{money(total, app.ccy)}</dd></div><div><dt>Payment Status</dt><dd><span className={`checkout-status ${paid ? 'paid' : ''}`}>{paid && <CircleCheck size={13} />}{paid ? 'Paid' : 'Unpaid'}</span></dd></div><div><dt>Payment Method</dt><dd>{payment.method === 'cash' ? <Banknote size={16} /> : <Landmark size={16} />}{method}</dd></div><div><dt>Total Items</dt><dd>{quantity} {quantity === 1 ? 'unit' : 'units'}</dd></div></dl><div className="checkout-payable"><div><h3>Total payable</h3>{rateText && <p>{rateText}</p>}</div><div><strong>{money(total, app.ccy)}</strong>{app.second_ccy && <small>{money(secondTotal, app.second_ccy)}</small>}</div></div></div>
        <div className="checkout-submit">{error && <p className="terminal-checkout-error" role="alert">{error}</p>}<button type="submit" className="checkout-place-order" disabled={pending || total === null || (!!app.second_ccy && secondTotal === null)}>{pending ? 'Saving order…' : <><Check size={21} />Place Order ({totalLabel})</>}</button><button type="button" className="terminal-checkout-back" disabled={pending} onClick={onClose}>Continue editing</button></div>
      </div>
    </form>
  </TerminalDialog>;
}
