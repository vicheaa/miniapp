import { api } from './request';
import type { DraftItem } from '../../store/orderDraftStore';
import type { OrderCustomer, SaveOrderPayload, SaveOrderResponse, StaffOrderSummary, StaffOrderHistory } from '../../types/order';
import type { PaginatedResponse } from '../../types/pagination';
import type { StaffOrderDetail, StaffOrderDetailRecord } from '../../types/order';
import { normalizeProduct } from './product';
import { deliveryIso, deliveryParts, isBackdatedDelivery, validCoordinates, validDeliveryDate } from '../../utils/delivery';

const validationMessages = {
  phoneRequired: 'Enter the phone number.',
  locationRequired: 'Select the delivery location.',
  invalidLocation: 'Select a valid delivery location.',
  invalidDeliveryDate: 'Select a valid delivery date.',
  pastDeliveryDate: 'Delivery date cannot be before today.',
  empty: 'Your cart is empty.',
  invalidItem: 'A cart item has an invalid product code, quantity, or price. Please remove it and add it again.',
};

export async function getStaffOrderDetail(id: number, signal?: AbortSignal): Promise<StaffOrderDetail> {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid order ID.');
  const response = await api.get<StaffOrderDetailRecord>('/services/central/api/name/staff-order-detail/find', {
    signal, query: { id },
  });
  if (!response || response.id !== id || !Array.isArray(response.items) || response.items.some((item) => !item || typeof item.quantity !== 'string')) {
    throw new Error('Invalid order detail response.');
  }
  return {
    ...response,
    items: response.items.map((item) => ({ ...item, product: item.product ? normalizeProduct(item.product) : null })),
  };
}

export async function getStaffOrderSummary(signal?: AbortSignal): Promise<StaffOrderSummary> {
  const response = await api.get<StaffOrderSummary>('/services/central/api/name/staff-order-summary/find', { signal });
  const fields = ['total_requests', 'pending_requests', 'accepted_requests', 'total_items_case'] as const;
  if (!response || fields.some((field) => typeof response[field] !== 'number' || !Number.isFinite(response[field]) || response[field] < 0)) {
    throw new Error('Invalid order summary response.');
  }
  return response;
}

export async function getStaffOrderHistory(page = 1, signal?: AbortSignal): Promise<PaginatedResponse<StaffOrderHistory>> {
  if (!Number.isSafeInteger(page) || page < 1) throw new Error('Invalid order history page.');
  const response = await api.get<PaginatedResponse<StaffOrderHistory>>('/services/central/api/name/staff-order-employee-order-history/find', {
    signal, query: { page, page_size: 20 },
  });
  if (!response || !Array.isArray(response.results) || !Number.isSafeInteger(response.count) || response.count < 0) {
    throw new Error('Invalid order history response.');
  }
  return response;
}

export class OrderValidationError extends Error {
  constructor(readonly key: keyof typeof validationMessages) {
    super(validationMessages[key]);
    this.name = 'OrderValidationError';
  }
}

export function buildOrderPayload(details: OrderCustomer, selected: DraftItem[], now = new Date()): SaveOrderPayload {
  const customer = details.customer?.trim();
  const phone = details.phone.trim();
  if (!phone) throw new OrderValidationError('phoneRequired');
  if (!selected.length) throw new OrderValidationError('empty');
  const rawDeliveryDate = details.delivery_date?.trim();
  if (rawDeliveryDate && !validDeliveryDate(rawDeliveryDate)) throw new OrderValidationError('invalidDeliveryDate');
  const delivery_date = rawDeliveryDate ? deliveryIso(deliveryParts(rawDeliveryDate)) : undefined;
  if (delivery_date && isBackdatedDelivery(delivery_date, now)) throw new OrderValidationError('pastDeliveryDate');
  const hasCoordinates = details.latitude != null || details.longitude != null;
  if (hasCoordinates && !validCoordinates(details.latitude, details.longitude)) throw new OrderValidationError('invalidLocation');
  return {
    ...(customer ? { customer } : {}), phone, email: details.email.trim(), address: details.address.trim(),
    ...(delivery_date ? { delivery_date } : {}),
    ...(hasCoordinates ? { latitude: details.latitude!, longitude: details.longitude! } : {}),
    items: selected.map(({ product, quantity }) => {
      const product_code = product.internal_code?.trim();
      const unit_price = Number(product.unit_price);
      if (!product_code || !Number.isFinite(quantity) || quantity <= 0 ||
          typeof product.unit_price !== 'string' || !product.unit_price.trim() ||
          !Number.isFinite(unit_price) || unit_price < 0) throw new OrderValidationError('invalidItem');
      return { product_code, quantity, unit_price };
    }),
  };
}

/** API_URL includes the /services gateway prefix, as for the catalog endpoints. */
export async function saveOrder(payload: SaveOrderPayload, signal?: AbortSignal): Promise<SaveOrderResponse> {
  const response = await api.post<SaveOrderResponse>('/services/central/api/name/staff-order-save/exec', payload, { signal });
  if (response?.status !== 'success') {
    throw new Error(response?.message || 'The server did not confirm that the order was saved.');
  }
  if (!response.data || !Number.isSafeInteger(response.data.id) || response.data.id <= 0) {
    throw new Error('The server returned an invalid order confirmation.');
  }
  return response;
}
