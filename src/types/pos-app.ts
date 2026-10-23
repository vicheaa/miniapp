export interface Merchant {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PosApp {
  id: string;
  name: string;
  app_key: string;
  merchant_id: number;
  ccy: string;
  second_ccy: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  order_sources_count: number;
  merchant: Merchant | null;
}

export interface PosAppsResponse {
  current_page: number;
  data: PosApp[];
  from: number | null;
  to: number | null;
  last_page: number;
  per_page: number;
  total: number;
}
