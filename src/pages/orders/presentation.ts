import type { Language } from '../../store/miniAppStore';

export function orderDate(value: string, language: Language): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(language === 'km' ? 'km-KH' : 'en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Phnom_Penh',
  }).format(date);
}

export function orderDateTime(value: string, language: Language): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(language === 'km' ? 'km-KH' : 'en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    hour12: true, timeZone: 'Asia/Phnom_Penh',
  }).format(date).replace(/\b(am|pm)\b/gi, (value) => value.toUpperCase());
}

export function orderStatus(status: string): 'pending' | 'accepted' | 'rejected' | 'delivered' | 'unknown' {
  const value = status.trim().toLowerCase();
  return value === 'pending' || value === 'accepted' || value === 'rejected' || value === 'delivered' ? value : 'unknown';
}

export function orderDetailBackTarget(from: unknown): string {
  return typeof from === 'string' && (from === '/' || /^\/orders(?:\?page=[1-9]\d*)?$/.test(from)) ? from : '/orders';
}

export function orderNumber(value: string | null, language: Language): string {
  if (value == null || !value.trim()) return '—';
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat(language === 'km' ? 'km-KH' : 'en-US', { maximumFractionDigits: 4 }).format(number) : '—';
}
