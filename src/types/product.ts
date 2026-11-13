import type { Category, MediaFile } from './category';
import type { PaginatedResponse } from './pagination';

export type ProductViewMode = 'grid' | 'list';

export interface Uom {
  id: number;
  name: string;
  abbreviation: string;
  description: string | null;
  status: string;
  uom_entry: number;
  internal_id: string | null;
  company: string;
  order_index: number;
}

export interface ProductUom {
  id: number;
  uom: Uom;
  conversion_factor: string;
  status: string;
}

export interface Product {
  id: number;
  sequent?: number | string | null;
  default_uom: Pick<Uom, 'id' | 'name' | 'abbreviation'> | null;
  category: ProductCategory | null;
  thumbnail: MediaFile | null;
  images: MediaFile[];
  product_uoms: ProductUom[];
  line_name: string;
  line_name_kh: string | null;
  line_code: string;
  internal_code: string;
  unit_price: string;
  qty_step: string | null;
  reference_uom: string | null;
  status: string;
  description: string | null;
  soft_delete: boolean;
  for_web: boolean;
  for_mobile: boolean;
}

export interface ProductFilters {
  category_id?: number;
  search_value?: string;
}

export type ProductCategory = Pick<Category, 'id' | 'name_en'> & Partial<Category>;

/** Flattened product fields returned by the catalog API. */
export interface ProductRecord extends Omit<Product, 'category' | 'default_uom' | 'thumbnail' | 'images' | 'product_uoms' | 'qty_step' | 'soft_delete'> {
  category: number | null;
  category_name: string | null;
  default_uom: number | null;
  default_uom_name: string | null;
  default_uom_abbreviation: string | null;
  thumbnail: string | null;
  short_text?: string | null;
  short_text_kh?: string | null;
  type?: string;
  reference_code?: string | null;
  reference_name?: string | null;
  reference_name_kh?: string | null;
  reference_price?: string | null;
  company?: string;
  bundle_id?: number | null;
  qty_step?: string | null;
}

export type ProductResponse = PaginatedResponse<Product>;
