import type { StaffOrderDetailItem } from '../../types/order';
import type { Language } from '../../store/miniAppStore';

function decimalUnits(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,4})?$/.test(value.trim())) return null;
  const [whole, fraction = ''] = value.trim().split('.');
  const units = Number(whole) * 10_000 + Number(fraction.padEnd(4, '0'));
  return Number.isSafeInteger(units) ? units : null;
}

function roundToCents(units: number, divisor: number): number {
  return Math.floor(units / divisor) + (units % divisor >= divisor / 2 ? 1 : 0);
}

export function estimateOrder(items: StaffOrderDetailItem[]) {
  const lines = items.map((item) => {
    const quantity = decimalUnits(item.quantity);
    const price = decimalUnits(item.product?.unit_price);
    const discount = item.discount_amount == null ? 0 : decimalUnits(item.discount_amount);
    if (quantity == null || price == null || discount == null || !Number.isSafeInteger(quantity * price)) return null;
    // Four decimal places on each input: their product has eight places.
    const subtotalCents = roundToCents(quantity * price, 1_000_000);
    const discountCents = roundToCents(discount, 100);
    return { unitPrice: price / 10_000, subtotalCents, discountCents, totalCents: subtotalCents - discountCents };
  });
  let subtotalCents = 0;
  let discountCents = 0;
  for (const line of lines) {
    if (line == null) return { lines, subtotalCents: null, discountCents: null, totalCents: null };
    subtotalCents += line.subtotalCents;
    discountCents += line.discountCents;
  }
  if (!Number.isSafeInteger(subtotalCents) || !Number.isSafeInteger(discountCents)) {
    return { lines, subtotalCents: null, discountCents: null, totalCents: null };
  }
  return { lines, subtotalCents, discountCents, totalCents: subtotalCents - discountCents };
}

export function orderCurrency(amount: number | null, language: Language, maximumFractionDigits = 2): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat(language === 'km' ? 'km-KH' : 'en-US', {
    style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2, maximumFractionDigits,
  }).format(amount);
}
