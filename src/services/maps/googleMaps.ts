import { emptyLocationAddressDetails, type LocationAddressDetails } from '../../types/location';
import { validCoordinates } from '../../utils/delivery';

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
export interface GeocodeResult {
  formatted_address: string;
  types?: string[];
  address_components?: GeocodeAddressComponent[];
  geometry: { location: LatLng; bounds?: { getSouthWest(): LatLng; getNorthEast(): LatLng } };
}
export interface GeocodeRequest { location?: MapPoint; address?: string; region?: string; language?: string }
export interface DeliveryGeocoder {
  geocode(request: GeocodeRequest, callback: (results: GeocodeResult[] | null, status: string) => void): void;
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
const resolvedLocationPoints = new WeakMap<LocationAddressDetails, MapPoint>();

export function hasResolvedLocation(details: LocationAddressDetails | null | undefined, point: MapPoint | null): boolean {
  const resolved = details ? resolvedLocationPoints.get(details) : undefined;
  return !!resolved && !!point && resolved.lat === point.lat && resolved.lng === point.lng;
}

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
  const params = new URLSearchParams({ key, v: 'quarterly', loading: 'async', language: 'km', region: 'KH', callback });
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

function geocodeResults(geocoder: DeliveryGeocoder, request: GeocodeRequest): Promise<GeocodeResult[]> {
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

export async function geocode(geocoder: DeliveryGeocoder, request: GeocodeRequest): Promise<GeocodeResult> {
  return (await geocodeResults(geocoder, request))[0];
}

export function mapCoordinates(point: MapPoint): string {
  return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
}

export function isCoordinateAddress(address: string): boolean {
  return /^\s*[+-]?\d+(?:\.\d+)?\s*,\s*[+-]?\d+(?:\.\d+)?\s*$/.test(address);
}

export function isPlusCodeAddress(address: string): boolean {
  return /^[23456789CFGHJMPQRVWX0]{2,8}\+[23456789CFGHJMPQRVWX]{2,7}(?=$|[\s,])/i.test(address.trim());
}

export function isKhmerAddress(address: string): boolean {
  return /\p{Script=Khmer}/u.test(address) && !/\p{Script=Latin}/u.test(address);
}

function componentName(components: GeocodeAddressComponent[], type: string): string {
  const names = components.filter((component) => component.types.includes(type))
    .map((component) => component.long_name.trim()).filter(Boolean);
  return names.find((name) => /\p{Script=Khmer}/u.test(name)) ?? names[0] ?? '';
}

function withKhmerPrefix(value: string, prefix: string, existingPrefixes: RegExp): string {
  const name = value.trim();
  return isKhmerAddress(name) && !existingPrefixes.test(name) ? `${prefix}${name}` : name;
}

export function prefixedLocationDetails(details: LocationAddressDetails): LocationAddressDetails {
  const phnomPenh = /^(?:រាជធានី\s*)?ភ្នំពេញ$/.test(details.province.trim())
    || /^(?:Phnom Penh|Phnom Penh Capital)$/i.test(details.province.trim());
  const urban = phnomPenh || /^(?:ខណ្ឌ|ក្រុង)/.test(details.district.trim());
  return {
    village: withKhmerPrefix(details.village, 'ភូមិ', /^ភូមិ/),
    commune: withKhmerPrefix(details.commune, urban ? 'សង្កាត់' : 'ឃុំ', /^(?:សង្កាត់|ឃុំ)/),
    district: withKhmerPrefix(details.district, phnomPenh ? 'ខណ្ឌ' : 'ស្រុក', /^(?:ខណ្ឌ|ស្រុក|ក្រុង)/),
    province: withKhmerPrefix(details.province, phnomPenh ? 'រាជធានី' : 'ខេត្ត', /^(?:រាជធានី|ខេត្ត)/),
  };
}

function placeName(value: string): string {
  return value.replace(/^(?:រាជធានី|ខេត្ត|ខណ្ឌ|ស្រុក|ក្រុង|សង្កាត់|ឃុំ|ភូមិ)\s*/, '').replace(/\s/g, '');
}

function resultDistance(point: MapPoint, result: GeocodeResult): number {
  const location = result.geometry?.location;
  if (!location) return Infinity;
  let lat = location.lat();
  let lng = location.lng();
  if (!validCoordinates(lat, lng)) return Infinity;
  const bounds = result.geometry.bounds;
  if (bounds) {
    const southwest = bounds.getSouthWest();
    const northeast = bounds.getNorthEast();
    // A road's center can be far along the same road. Measure against the
    // returned segment bounds instead of treating its center as the whole road.
    lat = Math.max(southwest.lat(), Math.min(northeast.lat(), point.lat));
    const west = southwest.lng();
    const east = northeast.lng();
    if (west <= east) lng = Math.max(west, Math.min(east, point.lng));
    else if (point.lng >= west || point.lng <= east) lng = point.lng;
    else lng = Math.abs(point.lng - west) < Math.abs(point.lng - east) ? west : east;
  }
  const latitude = (lat - point.lat) * Math.PI / 180;
  const longitude = (lng - point.lng) * Math.PI / 180;
  const haversine = Math.sin(latitude / 2) ** 2
    + Math.cos(lat * Math.PI / 180) * Math.cos(point.lat * Math.PI / 180) * Math.sin(longitude / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function closestStreetResult(results: GeocodeResult[], point: MapPoint): GeocodeResult | undefined {
  const streets = results.filter((result) => !result.types?.includes('plus_code')
    && componentName(result.address_components ?? [], 'route'));
  return streets.reduce<GeocodeResult | undefined>((closest, result) =>
    !closest || resultDistance(point, result) < resultDistance(point, closest) ? result : closest, undefined);
}

function localizedRoute(route: string, country: string): string {
  if (!isKhmerAddress(country)) return route;
  const numberedStreet = route.match(/^(?:Street|St\.?|Road|Rd\.?)\s+(\d+)$/i)
    ?? route.match(/^(\d+)\s+(?:Street|St\.?|Road|Rd\.?)$/i);
  return numberedStreet ? `ផ្លូវ ${numberedStreet[1].replace(/\d/g, (digit) => '០១២៣៤៥៦៧៨៩'[Number(digit)])}` : route;
}

export function locationAddressDetails(results: GeocodeResult[]): LocationAddressDetails {
  const components = results.flatMap((result) => result.address_components ?? []);
  const name = (...types: string[]) => {
    for (const type of types) {
      const value = componentName(components, type);
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
    const results = await geocodeResults(geocoder, { location: point, language: 'km' });
    const details = locationAddressDetails(results);
    // A Plus Code can precede a street address in Google's reverse-geocoding results.
    const readableResults = results.filter((result) => {
      const value = result.formatted_address?.trim();
      return value && !result.types?.includes('plus_code') && !isPlusCodeAddress(value) && !isCoordinateAddress(value);
    });
    // Select the road by location before formatting its language. A fully Khmer
    // result may describe an unrelated address hundreds of metres from the pin.
    const readable = closestStreetResult(results, point) ?? readableResults[0];
    const components = results.flatMap((result) => result.address_components ?? []);
    const name = (type: string) => componentName(components, type);
    const displayDetails = prefixedLocationDetails(details);
    const localityName = name('locality');
    const locality = [details.province, details.district].some((value) => value && placeName(value) === placeName(localityName))
      ? '' : withKhmerPrefix(localityName, 'ក្រុង', /^(?:រាជធានី|ក្រុង)/);
    const countryName = name('country');
    const country = /^(?:(?:ប្រទេស|ព្រះរាជាណាចក្រ)\s*)?កម្ពុជា$/.test(countryName)
      ? 'ព្រះរាជាណាចក្រកម្ពុជា'
      : withKhmerPrefix(countryName, 'ប្រទេស', /^(?:ប្រទេស|ព្រះរាជាណាចក្រ)/);
    const streetComponents = (readable ?? results[0])?.address_components ?? [];
    const streetName = (type: string) => componentName(streetComponents, type);
    const route = localizedRoute(streetName('route'), countryName);
    const street = route ? [streetName('street_number'), route].filter(Boolean).join(' ') : '';
    const fullAddress = [...new Set([
      ...(street ? [streetName('subpremise'), streetName('premise'), street] : []),
      displayDetails.village, displayDetails.commune, displayDetails.district,
      locality, displayDetails.province, name('postal_code'), country,
    ].filter(Boolean))].join(', ');
    const localDivisions = [displayDetails.village, displayDetails.commune, displayDetails.district];
    const khmerDivisions = localDivisions.filter(isKhmerAddress);
    const khmerRegions = [locality, displayDetails.province].filter(isKhmerAddress);
    const khmerStreet = isKhmerAddress(route) ? street : '';
    // The editable address should use Khmer divisions when Google has only an
    // English street/business name. A translated country or city alone is too broad.
    const hasKhmerLocation = khmerStreet || (khmerDivisions.length > 0 && khmerRegions.length > 0);
    const khmerAddress = hasKhmerLocation ? [...new Set([
      ...(khmerStreet ? [streetName('subpremise'), streetName('premise')].filter(isKhmerAddress).concat(khmerStreet) : []),
      ...khmerDivisions, ...khmerRegions,
      name('postal_code'),
      ...[country].filter(isKhmerAddress),
    ].filter(Boolean))].join(', ') : '';
    // Keep provider text when no structured street is available. For administrative
    // results, include the smaller divisions returned for the selected point.
    const administrativeResult = readable?.types?.some((type) => type === 'locality' || type === 'postal_code' || type.startsWith('administrative_area_'));
    const address = khmerAddress || (street || administrativeResult ? fullAddress : readable?.formatted_address.trim()) || fullAddress;
    if (address) resolvedLocationPoints.set(details, { ...point });
    return { address, details, errorStatus: address ? null : 'ZERO_RESULTS' };
  } catch (error) {
    // Preserve the provider status so a denied request is distinguishable from missing data.
    return { address: '', details: emptyLocationAddressDetails(), errorStatus: error instanceof Error ? error.message : 'ERROR' };
  }
}

