import type { PosApp } from './pos-app';
import type { OrderCustomer } from './order';

export interface Category { id: string; name: string; description?: string; is_active: boolean; image: string | null }
export interface ExchangeRate { id: number; from_currency: string; to_currency: string; rate: number | string; operation: 'multiply' | 'divide'; is_active: boolean }
export interface ProductVariant { id: string; sku: string; values: Record<string, string>; price: string | number; image: string | null; is_available: boolean }
export interface Product {
  id: string; name: string; description: string | null; price: string | number; currency: string;
  image: string | null; category_id: string; category?: Category | null; is_active: boolean;
  sku?: string; variants?: ProductVariant[];
  attributes?: { id: string; name: string; items: { id: string; value: string }[] }[];
}
export interface OrderSource { id: string; name: string; is_active: boolean; source_type: string }
export interface PosAppDetail extends PosApp { order_sources: OrderSource[] }
export interface CartLine { key: string; productId: string; name: string; variantId?: string; options: string; price: number; currency: string; quantity: number; note?: string }
export interface DraftOrder { id: number; lines: CartLine[]; note: string; sourceId: string; customer?: OrderCustomer }
