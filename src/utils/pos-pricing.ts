import type { CartLine, ExchangeRate } from '../types/pos-terminal';

export function convertPrice(amount: number, from: string, to: string, rates: ExchangeRate[]): number | null {
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (from.toUpperCase() === to.toUpperCase()) return amount;
  const rate = rates.find((item) => item.is_active && item.from_currency.toUpperCase() === from.toUpperCase()
    && item.to_currency.toUpperCase() === to.toUpperCase() && Number(item.rate) > 0 && Number.isFinite(Number(item.rate)));
  if (!rate) return null;
  if (rate.operation === 'divide') return amount / Number(rate.rate);
  if (rate.operation === 'multiply') return amount * Number(rate.rate);
  return null;
}
export function money(amount: number | null, currency: string): string {
  if (amount === null) return '—';
  const code = currency.toUpperCase();
  if (code === 'KHR') return `${Math.round(amount).toLocaleString('en-US')} ៛`;
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(amount); }
  catch { return `${amount.toFixed(2)} ${code}`; }
}
export function cartTotal(lines: CartLine[], currency: string, rates: ExchangeRate[]): number | null {
  let total = 0;
  for (const line of lines) {
    const converted = convertPrice(line.price * line.quantity, line.currency, currency, rates);
    if (converted === null) return null;
    total += converted;
  }
  // Convert and round the whole order, rather than rounding each unit price.
  return Math.round(total * (currency.toUpperCase() === 'KHR' ? 1 : 100)) / (currency.toUpperCase() === 'KHR' ? 1 : 100);
}
