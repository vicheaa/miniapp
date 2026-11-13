import type { Product, ProductRecord } from './product';

export interface OrderCustomer {
  customer?: string;
  phone: string;
  email: string;
  address: string;
  delivery_date?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface StaffOrderSummary {
  total_requests: number;
  pending_requests: number;
  accepted_requests: number;
  total_items_case: number;
}

export interface StaffOrderHistoryItem {
  id: number;
  product_id: number | null;
  product_code: string;
  product_name: string;
  quantity: string;
  unit_price: string;
  discount_amount: string | null;
  subtotal: string | null;
  remarks: string | null;
  staff_order: number;
}

export interface StaffOrderHistory extends OrderCustomer {
  id: number;
  no: string;
  created_date: string;
  staff_name: string;
  staff_code: string;
  status: string;
  items: StaffOrderHistoryItem[];
}

export interface StaffOrderDetailItem {
  id: number;
  quantity: string;
  discount_amount: string | null;
  subtotal: string | null;
  remarks: string | null;
  staff_order: number;
  product: Product | null;
}

export interface StaffOrderDetail extends Omit<StaffOrderHistory, 'items'> {
  items: StaffOrderDetailItem[];
  delivery_date: string | null;
}

export interface StaffOrderDetailRecord extends Omit<StaffOrderDetail, 'items'> {
  items: (Omit<StaffOrderDetailItem, 'product'> & { product: ProductRecord | null })[];
}

export interface OrderItem {
  product_code: string;
  product_id?: number;
  product_name?: string;
  quantity: number;
  unit_price: number;
}

export interface SaveOrderPayload extends OrderCustomer {
  items: OrderItem[];
}

export interface SaveOrderResponse {
  status: 'success';
  message: string;
  data: {
    id: number;
    customer: string;
    phone: string;
    total_items: number;
  };
}
