import { emptyLocationAddressDetails, type LocationAddressDetails } from '../../types/location';

export interface MapPoint { lat: number; lng: number }
export interface SelectedLocation { address: string; latitude: number; longitude: number }
export interface LatLng { lat(): number; lng(): number }
export interface MapListener { remove(): void }
export interface DeliveryMap {
  getCenter(): LatLng | undefined;
  getZoom(): number | undefined;
  panTo(point: MapPoint | LatLng): void;
  setZoom(zoom: number): void;
  setMapTypeId(mapTypeId: 'roadmap' | 'hybrid'): void;
  addListener(event: string, callback: (event?: { latLng?: LatLng }) => void): MapListener;
}
export interface MapCircle { setMap(map: DeliveryMap | null): void }
export interface GeocodeAddressComponent { long_name: string; short_name?: string; types: string[] }
export interface GeocodeResult { formatted_address: string; address_components?: GeocodeAddressComponent[]; geometry: { location: LatLng } }
export interface DeliveryGeocoder {
  geocode(request: { location?: MapPoint; address?: string; region?: string }, callback: (results: GeocodeResult[] | null, status: string) => void): void;
}
export interface GoogleMapsApi {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => DeliveryMap;
  Geocoder: new () => DeliveryGeocoder;
  Circle?: new (options: Record<string, unknown>) => MapCircle;
  event: { clearInstanceListeners(instance: unknown): void };
}

declare global {
  interface Window {
    google?: { maps: GoogleMapsApi };
  }
}

let loading: Promise<GoogleMapsApi> | undefined;
let sequence = 0;
let authFailed = false;
let authHandlerInstalled = false;
const authListeners = new Set<() => void>();

export function onMapsAuthFailure(callback: () => void): () => void {
  authListeners.add(callback);
  return () => { authListeners.delete(callback); };
}

export function loadGoogleMaps(): Promise<GoogleMapsApi> {
  if (!authHandlerInstalled) {
    const callbacks = window as unknown as Record<string, unknown>;
    const previous = callbacks.gm_authFailure;
    callbacks.gm_authFailure = () => {
      authFailed = true;
      authListeners.forEach((callback) => callback());
      if (typeof previous === 'function') previous();
    };
    authHandlerInstalled = true;
  }
  if (authFailed) return Promise.reject(new Error('Google Maps authentication failed.'));
  if (window.google?.maps?.Map && window.google.maps.Geocoder) return Promise.resolve(window.google.maps);
  if (loading) return loading;
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  if (!key) return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not configured.'));
  const callback = `__miniappGoogleMapsReady${++sequence}`;
  const callbacks = window as unknown as Record<string, unknown>;
  const script = document.createElement('script');
  const params = new URLSearchParams({ key, v: 'quarterly', loading: 'async', callback });
  script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
  script.async = true;
  loading = new Promise<GoogleMapsApi>((resolve, reject) => {
    const fail = () => {
      clearTimeout(timer);
      callbacks[callback] = () => {};
      script.remove();
      loading = undefined;
      reject(new Error('Google Maps could not be loaded.'));
    };
    const timer = setTimeout(fail, 15_000);
    script.onerror = fail;
    callbacks[callback] = () => {
      clearTimeout(timer);
      delete callbacks[callback];
      if (!authFailed && window.google?.maps?.Map && window.google.maps.Geocoder) resolve(window.google.maps);
      else fail();
    };
    document.head.append(script);
  });
  return loading;
}

function geocodeResults(geocoder: DeliveryGeocoder, request: { location?: MapPoint; address?: string; region?: string }): Promise<GeocodeResult[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), 10_000);
    try {
      geocoder.geocode(request, (results, status) => {
        clearTimeout(timer);
        if (status === 'OK' && results?.[0]) resolve(results);
        else reject(new Error(status));
      });
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
}

export async function geocode(geocoder: DeliveryGeocoder, request: { location?: MapPoint; address?: string; region?: string }): Promise<GeocodeResult> {
  return (await geocodeResults(geocoder, request))[0];
}

export function mapCoordinates(point: MapPoint): string {
  return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
}

export function isCoordinateAddress(address: string): boolean {
  return /^\s*[+-]?\d+(?:\.\d+)?\s*,\s*[+-]?\d+(?:\.\d+)?\s*$/.test(address);
}

export function locationAddressDetails(results: GeocodeResult[]): LocationAddressDetails {
  const components = results.flatMap((result) => result.address_components ?? []);
  const name = (...types: string[]) => {
    for (const type of types) {
      const value = components.find((component) => component.types?.includes(type) && component.long_name?.trim())?.long_name.trim();
      if (value) return value;
    }
    return '';
  };
  // Prefer explicit administrative divisions; Google may omit smaller divisions.
  return {
    province: name('administrative_area_level_1'),
    district: name('administrative_area_level_2', 'sublocality_level_1'),
    commune: name('administrative_area_level_3', 'sublocality_level_2'),
    village: name('administrative_area_level_4', 'sublocality_level_3'),
  };
}

export async function resolveLocationAddress(geocoder: DeliveryGeocoder, point: MapPoint): Promise<{ address: string; details: LocationAddressDetails; errorStatus: string | null }> {
  try {
    const results = await geocodeResults(geocoder, { location: point });
    const details = locationAddressDetails(results);
    const address = results.map((result) => result.formatted_address?.trim()).find((value) => value && !isCoordinateAddress(value))
      || [details.village, details.commune, details.district, details.province].filter(Boolean).join(', ');
    return { address, details, errorStatus: address ? null : 'ZERO_RESULTS' };
  } catch (error) {
    // Preserve the provider status so a denied request is distinguishable from missing data.
    return { address: '', details: emptyLocationAddressDetails(), errorStatus: error instanceof Error ? error.message : 'ERROR' };
  }
}

