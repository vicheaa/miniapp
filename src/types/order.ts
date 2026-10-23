export interface Customer {
  id: number;
  name: string;
  email: string | null;
  telegram_id: string | null;
  phone?: string | null;
  is_guest: boolean;
  guest_id: string | null;
}

export interface OrderCustomer {
  id: string; name: string; email: string; phone: string; telegramId: string;
}
export interface OrderPayment {
  status: 'paid' | 'unpaid';
  method: 'cash' | 'bank';
}
export interface CreateOrderPayload {
  customer_id: string | null;
  merchant_id: number;
  pos_app_id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_telegram_id: string | null;
  status: 'completed';
  payment_status: OrderPayment['status'];
  payment_method: OrderPayment['method'];
  currency: string;
  second_currency: string | null;
  exchange_rate: number | null;
  second_grand_total: number | null;
  notes: string | null;
  items: {
    product_id: string; product_variant_id: string | null; quantity: number; price: number; notes: string | null;
  }[];
}
export interface HistoryOrderItem {
  id: string;
  product_name: string;
  quantity: number;
  price: string;
  total: string;
  variant_values: Record<string, string> | null;
  notes: string | null;
}

export interface HistoryOrder {
  id: string;
  order_number: string;
  customer_name: string | null;
  status: string;
  payment_status: string;
  payment_method: string | null;
  total_amount: string;
  currency: string;
  second_currency: string | null;
  second_grand_total: string | null;
  created_at: string;
  notes: string | null;
  source_name: string | null;
  pos_app: { name: string } | null;
  items: HistoryOrderItem[];
}

export interface OrderHistoryPage {
  data: HistoryOrder[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}
