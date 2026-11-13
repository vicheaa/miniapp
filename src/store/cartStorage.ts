import type { Product } from '../types/product';
import type { DraftItem } from './orderDraftStore';

export const CART_STORAGE_KEY = 'cart';
type CartStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): CartStorage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; }
  catch { return undefined; }
}

/** A stable cache owner across token refreshes; never persist the token itself. */
export function cartOwner(token: string): string {
  try {
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')), (char) => char.charCodeAt(0));
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (record(claims) && typeof claims.sub === 'string' && claims.sub) {
      return JSON.stringify([typeof claims.iss === 'string' ? claims.iss : '', claims.sub]);
    }
  } catch { /* Public/opaque-token sessions use a device-level cart. */ }
  return token ? 'device' : 'guest';
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function readCart(owner: string, storage = browserStorage()): Record<number, DraftItem> {
  try {
    const saved: unknown = JSON.parse(storage?.getItem(CART_STORAGE_KEY) || 'null');
    if (!record(saved) || saved.version !== 1 || saved.owner !== owner || !record(saved.items)) return {};
    const items: Record<number, DraftItem> = {};
    for (const [key, value] of Object.entries(saved.items)) {
      if (!record(value) || !record(value.product)) continue;
      const product = value.product;
      if (!Number.isSafeInteger(product.id) || Number(product.id) <= 0 || String(product.id) !== key || typeof product.line_name !== 'string') continue;
      if (typeof value.quantity !== 'number' || !Number.isFinite(value.quantity) || value.quantity <= 0 || Number(value.quantity.toFixed(4)) !== value.quantity) continue;
      const uom = record(product.default_uom) && typeof product.default_uom.name === 'string' ? product.default_uom : null;
      const restored = {
        ...product,
        line_name_kh: typeof product.line_name_kh === 'string' ? product.line_name_kh : null,
        line_code: typeof product.line_code === 'string' ? product.line_code : '',
        internal_code: typeof product.internal_code === 'string' ? product.internal_code : '',
        qty_step: typeof product.qty_step === 'string' ? product.qty_step : null,
        thumbnail: record(product.thumbnail) && typeof product.thumbnail.file_url === 'string' ? product.thumbnail : null,
        images: Array.isArray(product.images) ? product.images.filter((file) => record(file) && typeof file.file_url === 'string') : [],
        default_uom: uom,
        reference_uom: typeof product.reference_uom === 'string' ? product.reference_uom : null,
      } as unknown as Product;
      const step = Number(restored.qty_step);
      const stepUnits = Math.round((Number.isFinite(step) && step > 0 ? step : 1) * 10_000);
      const units = Math.round(value.quantity * 10_000);
      if (!Number.isSafeInteger(units) || stepUnits <= 0 || units % stepUnits !== 0) continue;
      items[restored.id] = { product: restored, uom: restored.default_uom, quantity: value.quantity };
    }
    return items;
  } catch { return {}; }
}

export function writeCart(owner: string, items: Record<number, DraftItem>, storage = browserStorage()): void {
  try {
    if (Object.keys(items).length === 0) storage?.removeItem(CART_STORAGE_KEY);
    else storage?.setItem(CART_STORAGE_KEY, JSON.stringify({ version: 1, owner, items }));
  } catch { /* Keep the in-memory cart usable if storage is blocked or full. */ }
}

export function removeSavedCart(storage = browserStorage()): void {
  try { storage?.removeItem(CART_STORAGE_KEY); } catch { /* Storage may be unavailable. */ }
}
