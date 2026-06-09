/**
 * Domain models for the Asset Counting feature.
 */

/** A single asset-counting session (top-level entity). */
export interface AssetCountingSession {
  id: number;
  session_name: string;
  total_asset: number;
  count_asset?: number;  // number of assets already counted
  remaining?: number;    // total_asset - count_asset
  status: string; // 'progressing', 'finished', 'draft', etc.
  started_at: string;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A department/function group responsible for counting a subset of assets. */
export interface FunctionInCharge {
  id: number;
  name: string;
  total_asset: number;
  count_asset: number;
  remaining: number;
  created_at: string;
  updated_at: string;
}

/** An individual asset report item within a session + function group. */
export interface AssetCountingReport {
  id: number;
  session_id: number;
  holding_function: string;
  holding_function_id: number;
  function_in_charge: string;
  function_in_charge_id: number;
  asset_name: string;
  asset_tag: string;
  employee_name: string | null;
  employee_id: number | null;
  location: string;
  location_id: number;
  user_location_id: number;
  capitalization_date: string | null;
  total_quantity: number;
  actual_quantity: number;
  count_status: boolean;
  asset_counting_records: any[];
  created_at: string;
  updated_at: string;
}
