/**
 * Format an ISO date string into a compact representation.
 *
 * @example formatDateCompact('2026-05-28T09:24:11Z') // "28 May 2026 09:24:11"
 */
export function formatDateTimeCompact(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const day = date.getUTCDate();
    const month = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    const year = date.getUTCFullYear();
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');

    return `${day} ${month} ${year} ${hours}:${minutes}:${seconds}`;
  } catch {
    return dateStr;
  }
}
export function formatDateCompact(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const day = date.getUTCDate();
    const month = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    const year = date.getUTCFullYear();

    return `${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
}

/**
 * Format an ISO date string into a 12-hour date-time representation.
 *
 * @example format12H('2026-05-28T09:24:11Z') // "28 May 2026 09:24:11 AM"
 */
export function format12H(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const day = date.getUTCDate();
    const month = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    const year = date.getUTCFullYear();
    const rawHours = date.getUTCHours();
    const hours12 = rawHours % 12 || 12;
    const hours = String(hours12).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    const ampm = rawHours >= 12 ? 'PM' : 'AM';

    return `${day} ${month} ${year}, ${hours}:${minutes}${ampm}`;
  } catch {
    return dateStr;
  }
}


/**
 * Format a number into currency format (xxx,xxx,xxx.xx)
 */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '0.00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format a string like "IN_PROGRESS" or "in_progress" into Title Case ("In Progress").
 */
export function formatStatusText(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

