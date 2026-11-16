import type { Language } from '../../store/miniAppStore';
import { validCoordinates } from '../../utils/delivery';

export function orderMapUrl(latitude: unknown, longitude: unknown): string | null {
  const lat = typeof latitude === 'string' && latitude.trim() ? Number(latitude) : latitude;
  const lng = typeof longitude === 'string' && longitude.trim() ? Number(longitude) : longitude;
  if (!validCoordinates(lat, lng)) return null;
  const params = new URLSearchParams({ api: '1', query: `${lat},${lng}` });
  return `https://www.google.com/maps/search/?${params}`;
}

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

export function orderUnit(value: string, quantity: string | null): string {
  const unit = value.trim();
  if (quantity == null || !quantity.trim() || !Number.isFinite(Number(quantity))) return unit;
  const countableUnits: Record<string, string> = {
    case: 'cases', bottle: 'bottles', pack: 'packs', carton: 'cartons',
    piece: 'pieces', bag: 'bags', box: 'boxes', unit: 'units',
    set: 'sets', can: 'cans', pallet: 'pallets', tray: 'trays',
  };
  const forms = Object.entries(countableUnits).find(([singular, plural]) => unit.toLowerCase() === singular || unit.toLowerCase() === plural);
  // Keep Khmer names, measurement symbols and unknown units as provided.
  if (!forms) return unit;
  const label = forms[Math.abs(Number(quantity)) === 1 ? 0 : 1];
  if (unit === unit.toUpperCase()) return label.toUpperCase();
  return unit[0] === unit[0].toUpperCase() ? label[0].toUpperCase() + label.slice(1) : label;
}
