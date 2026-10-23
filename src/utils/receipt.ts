import type { CreateOrderPayload, HistoryOrder } from '../types/order';
import type { DraftOrder, PosAppDetail } from '../types/pos-terminal';
import { money } from './pos-pricing';

export interface SavedReceipt { text: string; orderId?: string | number }

/** 80 mm paper with a 72 mm / 576-dot print area at 12 dots per character. */
export const RECEIPT_COLUMNS = 48;

// Match the native text printer's currency substitution before measuring columns.
const cleanReceiptText = (value: string) => value.replace(/៛/g, 'KHR').replace(/[\x00-\x1f\x7f]/g, ' ').trim();

export function wrapReceiptText(value: string): string {
  const chars = Array.from(cleanReceiptText(value));
  const lines = [];
  for (let i = 0; i < chars.length; i += RECEIPT_COLUMNS) lines.push(chars.slice(i, i + RECEIPT_COLUMNS).join(''));
  return lines.join('\n');
}

/** Reprints saved amounts and payment state without recalculating a past sale. */
export function buildHistoryReceipt(order: HistoryOrder): SavedReceipt {
  const rule = '-'.repeat(RECEIPT_COLUMNS);
  const lines = [order.pos_app?.name || 'SALES RECEIPT', `Order: ${order.order_number}`,
    new Date(order.created_at).toLocaleString('en-GB'), rule, `Customer: ${order.customer_name || 'Walk-in'}`, rule];
  for (const item of order.items) {
    lines.push(`${item.quantity} x ${item.product_name}`);
    if (item.variant_values) lines.push(Object.entries(item.variant_values).map(([name, value]) => `${name}: ${value}`).join(', '));
    lines.push(`${money(Number(item.price), order.currency)} each   ${money(Number(item.total), order.currency)}`);
    if (item.notes) lines.push(`Note: ${item.notes}`);
  }
  lines.push(rule, `TOTAL: ${money(Number(order.total_amount), order.currency)}`);
  if (order.second_currency && order.second_grand_total !== null) lines.push(`TOTAL: ${money(Number(order.second_grand_total), order.second_currency)}`);
  lines.push(`Payment: ${order.payment_method || '—'}`, `Payment status: ${order.payment_status}`, `Order status: ${order.status}`);
  if (order.notes) lines.push(rule, ...order.notes.split('\n'));
  lines.push(rule, 'Thank you!', '');
  return { text: lines.map(wrapReceiptText).join('\n'), orderId: order.id };
}

/** Plain text for an 80 mm thermal receipt. Printer encoding is owned by the native app. */
export function buildReceipt(payload: CreateOrderPayload, draft: DraftOrder, app: PosAppDetail, orderId?: string | number, date = new Date()): SavedReceipt {
  const width = RECEIPT_COLUMNS;
  const rule = '-'.repeat(width);
  const wrap = wrapReceiptText;
  const pair = (label: string, value: string) => {
    label = cleanReceiptText(label);
    value = cleanReceiptText(value);
    const remaining = width - Array.from(label).length - Array.from(value).length;
    return remaining > 0 ? label + ' '.repeat(remaining) + value : `${wrap(label)}\n${wrap(value)}`;
  };
  const lines = [wrap(app.merchant?.name || app.name), wrap(app.name), rule,
    'SALES RECEIPT', wrap(orderId !== undefined ? `Order: ${orderId}` : `Register order: #${draft.id}`),
    wrap(date.toLocaleString('en-GB')), rule, wrap(`Customer: ${payload.customer_name}`)];
  if (payload.customer_phone) lines.push(wrap(`Phone: ${payload.customer_phone}`));
  lines.push(rule);
  let total = 0;
  payload.items.forEach((item, index) => {
    const line = draft.lines[index];
    const amount = item.price * item.quantity;
    total += amount;
    lines.push(wrap(line.name));
    if (line.options) lines.push(wrap(line.options));
    lines.push(pair(`${item.quantity} x ${money(item.price, payload.currency)}`, money(amount, payload.currency)));
    if (item.notes) lines.push(wrap(`Note: ${item.notes}`));
  });
  lines.push(rule, pair('TOTAL', money(total, payload.currency)));
  if (payload.second_currency && payload.second_grand_total !== null) {
    lines.push(pair('TOTAL ' + payload.second_currency, money(payload.second_grand_total, payload.second_currency)));
  }
  lines.push(`Payment: ${(payload.payment_method || 'cash').toUpperCase()}`, `Status: ${(payload.payment_status || 'paid').toUpperCase()}`);
  if (payload.notes) lines.push(rule, ...payload.notes.split('\n').map(wrap));
  // Finish the last printed line; the native bridge already feeds paper before cutting.
  lines.push(rule, 'Thank you!', '');
  return { text: lines.join('\n'), orderId };
}
