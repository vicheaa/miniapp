import type { CreateOrderPayload, OrderCustomer, OrderPayment } from '../types/order';
import type { DraftOrder, ExchangeRate, PosAppDetail } from '../types/pos-terminal';
import { cartTotal, convertPrice } from './pos-pricing';

const nullable = (value: string) => value.trim() || null;
export function buildOrderPayload(order: DraftOrder, app: PosAppDetail, rates: ExchangeRate[], customer: OrderCustomer, itemNotes: Record<string, string>, payment: OrderPayment = { status: 'paid', method: 'cash' }): CreateOrderPayload {
  if (!app.is_active) throw new Error('This register is inactive.');
  if (!order.lines.length) throw new Error('Add at least one item to this order.');
  if (!customer.name.trim()) throw new Error('Enter a customer name.');
  const currency = app.ccy.toUpperCase();
  const secondCurrency = app.second_ccy?.toUpperCase() || null;
  let exchangeRate: number | null = null;
  let secondTotal: number | null = null;
  if (secondCurrency) {
    exchangeRate = currency === secondCurrency ? 1 : Number(rates.find((rate) => rate.is_active
      && rate.from_currency.toUpperCase() === currency && rate.to_currency.toUpperCase() === secondCurrency
      && (rate.operation === 'multiply' || rate.operation === 'divide') && Number.isFinite(Number(rate.rate)) && Number(rate.rate) > 0)?.rate);
    secondTotal = cartTotal(order.lines, secondCurrency, rates);
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0 || secondTotal === null) throw new Error('An exchange rate is missing for this order.');
  }
  const source = app.order_sources?.find((item) => item.id === order.sourceId);
  const notes = [order.note.trim(), source ? `Order source: ${source.name}` : ''].filter(Boolean).join('\n');
  return {
    customer_id: nullable(customer.id), merchant_id: app.merchant_id, pos_app_id: app.id,
    customer_name: customer.name.trim(), customer_email: nullable(customer.email), customer_phone: nullable(customer.phone), customer_telegram_id: nullable(customer.telegramId),
    status: 'completed', payment_status: payment.status, payment_method: payment.method, currency, second_currency: secondCurrency,
    exchange_rate: exchangeRate, second_grand_total: secondTotal, notes: nullable(notes),
    items: order.lines.map((line) => {
      const price = convertPrice(line.price, line.currency, currency, rates);
      if (price === null) throw new Error(`An exchange rate is missing for ${line.name}.`);
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw new Error(`Invalid quantity for ${line.name}.`);
      return { product_id: line.productId, product_variant_id: line.variantId || null, quantity: line.quantity,
        price, notes: nullable(itemNotes[line.key] ?? line.note ?? '') };
    }),
  };
}
