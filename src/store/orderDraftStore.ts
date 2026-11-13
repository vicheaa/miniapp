import { create } from 'zustand';
import type { Product } from '../types/product';
import type { OrderCustomer, SaveOrderResponse } from '../types/order';
import type { LocationAddressDetails } from '../types/location';
import type { SelectedLocation } from '../services/maps/googleMaps';
import { buildOrderPayload, saveOrder } from '../services/api/order';
import { useMiniAppStore } from './miniAppStore';
import { cartOwner, readCart, removeSavedCart, writeCart } from './cartStorage';

const emptyDetails = (): OrderCustomer => ({ customer: '', phone: '', email: '', address: '', delivery_date: null, latitude: null, longitude: null });

export interface DraftItem {
  product: Product;
  uom: Product['default_uom'];
  quantity: number;
}

interface OrderDraftStore {
  items: Record<number, DraftItem>;
  details: OrderCustomer;
  locationDetails: LocationAddressDetails | null;
  updateDetails: (details: Partial<OrderCustomer>) => void;
  updateLocation: (location: SelectedLocation, locationDetails: LocationAddressDetails) => void;
  isSubmitting: boolean;
  savedOrder: SaveOrderResponse | null;
  submitError: unknown;
  commitOrder: (details: OrderCustomer) => Promise<boolean>;
  adjust: (product: Product, direction: 1 | -1) => void;
  setQuantity: (product: Product, quantity: number) => boolean;
  clear: () => void;
}

export function quantityStep(value: string | null): number {
  const step = Number(value);
  return Number.isFinite(step) && step > 0 ? step : 1;
}

export const useOrderDraftStore = create<OrderDraftStore>((set, get) => ({
  items: {},
  details: emptyDetails(),
  locationDetails: null,
  updateDetails: (details) => set((state) => state.isSubmitting ? state : ({ details: { ...state.details, ...details }, ...('address' in details || 'latitude' in details || 'longitude' in details ? { locationDetails: null } : {}) })),
  updateLocation: (location, locationDetails) => set((state) => state.isSubmitting ? state : ({ details: { ...state.details, ...location }, locationDetails })),
  isSubmitting: false,
  savedOrder: null,
  submitError: null,
  commitOrder: async (details) => {
    if (get().isSubmitting) return false;
    const sessionVersion = useMiniAppStore.getState().sessionVersion;
    set({ isSubmitting: true, submitError: null, savedOrder: null });
    try {
      const payload = buildOrderPayload(details, Object.values(get().items));
      const savedOrder = await saveOrder(payload);
      // A late response must never clear another session's cart.
      if (useMiniAppStore.getState().sessionVersion !== sessionVersion) return false;
      set({ items: {}, details: emptyDetails(), locationDetails: null, savedOrder });
      return true;
    } catch (submitError) {
      if (useMiniAppStore.getState().sessionVersion === sessionVersion) set({ submitError });
      return false;
    } finally {
      set({ isSubmitting: false });
    }
  },
  adjust: (product, direction) => set((state) => {
    if (state.isSubmitting) return state;
    const current = state.items[product.id];
    // The API supplies decimal quantities with four places; avoid floating-point drift.
    const quantity = Number(((current?.quantity ?? 0) + direction * quantityStep(product.qty_step)).toFixed(4));
    const items = { ...state.items };
    if (quantity <= 0) delete items[product.id];
    else items[product.id] = { product, uom: product.default_uom, quantity };
    return { items, savedOrder: null, submitError: null };
  }),
  setQuantity: (product, quantity) => {
    if (get().isSubmitting) return false;
    if (!Number.isFinite(quantity) || quantity < 0 || Number(quantity.toFixed(4)) !== quantity) return false;
    const units = Math.round(quantity * 10_000);
    const step = Math.round(quantityStep(product.qty_step) * 10_000);
    if (!Number.isSafeInteger(units) || step <= 0 || units % step !== 0) return false;
    set((state) => {
      const items = { ...state.items };
      if (quantity === 0) delete items[product.id];
      else items[product.id] = { product, uom: product.default_uom, quantity };
      return { items, savedOrder: null, submitError: null };
    });
    return true;
  },
  clear: () => set({ items: {}, details: emptyDetails(), locationDetails: null, savedOrder: null, submitError: null }),
}));

let activeOwner: string | null = null;
const unsubscribeCart = useOrderDraftStore.subscribe((state, previous) => {
  if (activeOwner !== null && state.items !== previous.items) writeCart(activeOwner, state.items);
});

const unsubscribeSession = useMiniAppStore.subscribe((state, previous) => {
  if (state.sessionVersion !== previous.sessionVersion) {
    // The initial bridge reset must not erase the cart saved before a reload.
    if (activeOwner !== null) removeSavedCart();
    activeOwner = null;
    useOrderDraftStore.getState().clear();
  }
  if (state.superApp !== null || state.authToken) {
    const owner = cartOwner(state.authToken);
    if (activeOwner !== owner) {
      activeOwner = owner;
      useOrderDraftStore.setState({ items: readCart(owner) });
    }
  }
});

// Also support development hot reload after the native session is already ready.
const currentSession = useMiniAppStore.getState();
if (currentSession.superApp !== null || currentSession.authToken) {
  activeOwner = cartOwner(currentSession.authToken);
  useOrderDraftStore.setState({ items: readCart(activeOwner) });
}
if (import.meta.hot) import.meta.hot.dispose(() => { unsubscribeCart(); unsubscribeSession(); });
