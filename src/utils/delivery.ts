const CAMBODIA_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface DeliveryParts {
  year: number;
  month: number;
  day: number;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function deliveryParts(value?: string | null, now = new Date()): DeliveryParts {
  const parsed = value ? new Date(value) : now;
  const local = new Date((Number.isFinite(parsed.getTime()) ? parsed : now).getTime() + CAMBODIA_OFFSET_MS);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate() };
}

export function deliveryIso(parts: DeliveryParts): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(Math.min(parts.day, daysInMonth(parts.year, parts.month)))}T00:00:00+07:00`;
}

export function todayDeliveryIso(now = new Date()): string {
  return deliveryIso(deliveryParts(null, now));
}

export function isBackdatedDelivery(value: string, now = new Date()): boolean {
  return !validDeliveryDate(value) || deliveryIso(deliveryParts(value)).slice(0, 10) < todayDeliveryIso(now).slice(0, 10);
}

export function clampDeliveryDate(parts: DeliveryParts, minimum = deliveryParts()): DeliveryParts {
  const month = Math.max(1, Math.min(12, parts.month));
  const candidate = { ...parts, month, day: Math.max(1, Math.min(parts.day, daysInMonth(parts.year, month))) };
  return deliveryIso(candidate) < deliveryIso(minimum) ? { ...minimum } : candidate;
}

export function validDeliveryDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month) && Number.isFinite(Date.parse(value));
}

export function validCoordinates(latitude: unknown, longitude: unknown): boolean {
  return typeof latitude === 'number' && typeof longitude === 'number' && Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export function deliveryDisplay(value: string, language: 'en' | 'km'): string {
  return new Intl.DateTimeFormat(language === 'km' ? 'km-KH' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Phnom_Penh',
  }).format(new Date(value));
}
