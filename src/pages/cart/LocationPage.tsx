import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMiniAppNavigation } from '../../components/MiniAppNavigation';
import { useTranslation } from '../../hooks/useTranslation';
import { useKeyboardPage } from '../../hooks/useKeyboardViewport';
import { useOrderDraftStore } from '../../store/orderDraftStore';
import { hasResolvedLocation, isCoordinateAddress, isPlusCodeAddress, loadGoogleMaps, mapCoordinates, onMapsAuthFailure, resolveLocationAddress, type DeliveryMap, type MapCircle, type MapPoint } from '../../services/maps/googleMaps';
import { validCoordinates } from '../../utils/delivery';
import { emptyLocationAddressDetails } from '../../types/location';
import Icon from '../product/component/Icon';

const DEFAULT_MAP_ZOOM = 18;

export default function LocationPage() {
  useKeyboardPage();
  const { t } = useTranslation();
  const { navigateTo } = useMiniAppNavigation();
  const route = useLocation();
  const details = useOrderDraftStore((state) => state.details);
  const savedLocationDetails = useOrderDraftStore((state) => state.locationDetails);
  const updateLocation = useOrderDraftStore((state) => state.updateLocation);
  const [initial] = useState(() => ({ address: isCoordinateAddress(details.address) || isPlusCodeAddress(details.address) ? '' : details.address.replace(/ប្រទេស\s*កម្ពុជា\s*$/, 'ព្រះរាជាណាចក្រកម្ពុជា'), details: savedLocationDetails, point: validCoordinates(details.latitude, details.longitude) ? { lat: details.latitude!, lng: details.longitude! } : null }));
  const host = useRef<HTMLDivElement>(null);
  const addressInput = useRef<HTMLTextAreaElement>(null);
  const map = useRef<DeliveryMap | null>(null);
  const locate = useRef<(() => void) | null>(null);
  const generation = useRef(0);
  const locatingGeneration = useRef(0);
  const addressEdited = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [moving, setMoving] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [, setAddressError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [address, setAddress] = useState(initial.address);
  const [addressDetails, setAddressDetails] = useState(initial.details ?? emptyLocationAddressDetails());
  const [point, setPoint] = useState<MapPoint | null>(initial.point);
  const close = () => { if (route.state?.fromCart) navigateTo(-1); else navigateTo('/cart', true); };

  useLayoutEffect(() => {
    const input = addressInput.current;
    if (!input) return;
    const resize = () => {
      input.style.height = 'auto';
      input.style.height = `${input.scrollHeight + 2}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (input.parentElement) observer.observe(input.parentElement);
    return () => observer.disconnect();
  }, [address]);

  useEffect(() => {
    let live = true;
    setReady(false);
    setMapError(false);
    setAddressError(null);
    setLocationError(null);
    const unsubscribeAuth = onMapsAuthFailure(() => {
      if (!live) return;
      generation.current++;
      locatingGeneration.current++;
      setReady(false);
      setResolving(false);
      setLocating(false);
      setMoving(false);
      setMapError(true);
    });
    let dispose = () => {};
    void loadGoogleMaps().then((api) => {
      if (!live || !host.current) return;
      const element = host.current;
      const center = initial.point ?? { lat: 11.5564, lng: 104.9282 };
      const instance = new api.Map(element, { center, zoom: DEFAULT_MAP_ZOOM, mapTypeId: 'roadmap', tilt: 0, mapTypeControl: false, zoomControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false, gestureHandling: 'greedy' });
      map.current = instance;
      setSatellite(false);
      const geocoder = new api.Geocoder();
      let selectionTimer: ReturnType<typeof setTimeout> | undefined;
      let dragging = false;
      let selectionNeeded = false;
      let lookupActive = false;
      // Recheck older addresses; Khmer text and prefixes do not prove the road is correct.
      let last = initial.address.trim() && hasResolvedLocation(initial.details, initial.point) ? `${center.lat.toFixed(7)},${center.lng.toFixed(7)}` : '';
      let circles: MapCircle[] = [];
      const select = (selected: MapPoint) => {
        if (!live || !validCoordinates(selected.lat, selected.lng)) return;
        setMoving(false);
        const key = `${selected.lat.toFixed(7)},${selected.lng.toFixed(7)}`;
        if (key === last) return;
        last = key;
        const request = ++generation.current;
        const savedAddress = initial.point && key === `${initial.point.lat.toFixed(7)},${initial.point.lng.toFixed(7)}` ? initial.address : '';
        addressEdited.current = false;
        setPoint(selected);
        setAddress(savedAddress);
        setAddressDetails(emptyLocationAddressDetails());
        setAddressError(null);
        setResolving(true);
        lookupActive = true;
        void resolveLocationAddress(geocoder, selected).then((result) => {
          if (!live || request !== generation.current) return;
          if (!addressEdited.current) setAddress(result.address || savedAddress);
          setAddressDetails(result.details);
          setAddressError(result.errorStatus === 'REQUEST_DENIED' ? 'checkout.addressLookupDenied' : result.errorStatus ? 'checkout.addressUnavailable' : null);
          if (result.errorStatus) console.warn('Delivery address lookup failed:', result.errorStatus);
        }).finally(() => {
          if (live && request === generation.current) { lookupActive = false; setResolving(false); }
        });
      };
      const cancelLocate = () => { locatingGeneration.current++; setLocating(false); };
      const beginMove = () => {
        clearTimeout(selectionTimer);
        generation.current++;
        // A response for the previous center must not finish during a new drag.
        if (lookupActive) last = '';
        lookupActive = false;
        selectionNeeded = true;
        setResolving(false);
        setMoving(true);
      };
      const settleCenter = () => {
        if (dragging || !selectionNeeded) return;
        clearTimeout(selectionTimer);
        selectionTimer = setTimeout(() => {
          const current = instance.getCenter();
          if (live && current) {
            selectionNeeded = false;
            select({ lat: current.lat(), lng: current.lng() });
          }
        }, 180);
      };
      const panTo = (selected: MapPoint) => {
        const current = instance.getCenter();
        beginMove();
        instance.panTo(selected);
        // An unchanged center may not produce an idle event.
        if (current && current.lat() === selected.lat && current.lng() === selected.lng) settleCenter();
      };
      const listeners = [
        instance.addListener('idle', settleCenter),
        instance.addListener('zoom_changed', () => { if (!dragging) beginMove(); }),
        instance.addListener('dragstart', () => { dragging = true; cancelLocate(); beginMove(); }),
        instance.addListener('dragend', () => { dragging = false; settleCenter(); }),
        instance.addListener('click', (event) => {
          if (!event?.latLng) return;
          cancelLocate();
          const selected = { lat: event.latLng.lat(), lng: event.latLng.lng() };
          panTo(selected);
        }),
      ];
      locate.current = () => {
        if (!live) return;
        const request = ++locatingGeneration.current;
        setLocationError(null);
        if (!navigator.geolocation || window.isSecureContext === false) { setLocationError('checkout.locationUnsupported'); return; }
        setLocating(true);
        navigator.geolocation.getCurrentPosition((position) => {
          if (!live || request !== locatingGeneration.current) return;
          setLocating(false);
          const selected = { lat: position.coords.latitude, lng: position.coords.longitude };
          if (!validCoordinates(selected.lat, selected.lng)) { setLocationError('checkout.locationUnavailable'); return; }
          circles.forEach((circle) => circle.setMap(null));
          circles = api.Circle ? [
            new api.Circle({ map: instance, center: selected, radius: Math.min(position.coords.accuracy, 300), fillColor: '#4285f4', fillOpacity: .12, strokeWeight: 0, clickable: false }),
            new api.Circle({ map: instance, center: selected, radius: 7, fillColor: '#4285f4', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, clickable: false, zIndex: 2 }),
          ] : [];
          instance.setZoom(DEFAULT_MAP_ZOOM);
          panTo(selected);
        }, (error) => {
          if (!live || request !== locatingGeneration.current) return;
          setLocating(false);
          setLocationError(error.code === 1 ? 'checkout.locationDenied' : error.code === 3 ? 'checkout.locationTimeout' : 'checkout.locationUnavailable');
        }, { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 });
      };
      if (!last) select(center);
      setReady(true);
      if (!initial.point) locate.current();
      dispose = () => {
        clearTimeout(selectionTimer);
        listeners.forEach((listener) => listener.remove());
        circles.forEach((circle) => circle.setMap(null));
        api.event.clearInstanceListeners(instance);
        element.replaceChildren();
      };
    }).catch(() => { if (live) { setReady(false); setMapError(true); } });
    return () => {
      live = false;
      generation.current++;
      locatingGeneration.current++;
      unsubscribeAuth();
      locate.current = null;
      map.current = null;
      dispose();
    };
  }, [attempt, initial]);

  return <main className="products-page keyboard-page location-page" aria-labelledby="location-title">
    <header className="products-header">
      <div className="products-toolbar">
        <button type="button" className="product-header-button" aria-label={t('cart.back')} onClick={close}><Icon name="back-ios" /></button>
        <h1 id="location-title">{t('cart.location')}</h1><span aria-hidden="true" />
      </div>
    </header>
    <div className="location-content" data-keyboard-scroll>
      <div className="checkout-map-wrap" data-keyboard-gesture-exempt data-no-ptr>
        <div ref={host} className="checkout-google-map" aria-label={t('checkout.deliveryMap')} />
        {ready && <div className="checkout-map-pin" aria-hidden="true"><Icon name="location" /></div>}
        {!ready && !mapError && <p className="checkout-map-loading" role="status">{t('checkout.loadingMap')}</p>}
        {/* <p className="location-map-hint">{t('checkout.mapHint')}</p> */}
        <div className="location-map-controls keyboard-bottom-actions" role="group" aria-label={t('checkout.mapControls')}>
          <button type="button" disabled={!ready} aria-label={t('checkout.satelliteView')} aria-pressed={satellite} onClick={() => { map.current?.setMapTypeId(satellite ? 'roadmap' : 'hybrid'); setSatellite(!satellite); }}><Icon name="layers" /></button>
          <button type="button" disabled={!ready} aria-label={t('checkout.zoomIn')} onClick={() => { if (map.current) map.current.setZoom(Math.min(21, (map.current.getZoom() ?? DEFAULT_MAP_ZOOM) + 1)); }}><Icon name="plus" /></button>
          <button type="button" disabled={!ready} aria-label={t('checkout.zoomOut')} onClick={() => { if (map.current) map.current.setZoom(Math.max(1, (map.current.getZoom() ?? DEFAULT_MAP_ZOOM) - 1)); }}><Icon name="minus" /></button>
        </div>
        <button type="button" className="location-recenter keyboard-bottom-actions" disabled={!ready || locating} onClick={() => locate.current?.()}><Icon name="locate" /><span>{t(locating ? 'checkout.locating' : 'checkout.myLocation')}</span></button>
      </div>
      <div className="location-details" aria-busy={moving || resolving}>
        {mapError && <div className="checkout-map-error" role="alert"><p>{t('checkout.mapUnavailable')}</p><button type="button" onClick={() => setAttempt((current) => current + 1)}>{t('global.retry')}</button></div>}
        <div className="location-selected-heading"><span className="location-selected-icon" aria-hidden="true"><Icon name="location" /></span><div><h2>{t('checkout.selectedLocation')}</h2>{point && <p className="checkout-map-coordinates">{mapCoordinates(point)}</p>}</div></div>
        {locationError && <p className="checkout-map-error" role="alert">{t(locationError)}</p>}
        <label className="checkout-map-address">{t('orderDetails.address')}<textarea ref={addressInput} rows={2} name="street-address" enterKeyHint="done" autoComplete="street-address" autoCapitalize="sentences" onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); event.currentTarget.blur(); } }} value={address} disabled={!ready} placeholder={t(resolving ? 'checkout.findingAddress' : 'checkout.addressPlaceholder')} onChange={(event) => { addressEdited.current = true; locatingGeneration.current++; setLocating(false); setAddress(event.target.value); }} /></label>
        {/* <dl className="location-address-details" aria-label={t('checkout.addressDetails')} aria-busy={resolving}>
          {(['province', 'district', 'commune', 'village'] as const).map((field) => <div key={field}><dt>{t(`checkout.${field}`)}</dt><dd>{addressDetails[field] || t(resolving ? 'global.loading' : 'checkout.addressDetailUnavailable')}</dd></div>)}
        </dl> */}
        {/* {addressError && <p className="location-hint location-address-note" role="status">{t(addressError)}</p>} */}
        {/* {resolving && <p className="location-hint" role="status">{t('checkout.findingAddress')}</p>} */}
      </div>
    </div>
    <footer className="cart-footer keyboard-bottom-actions">
      <button type="button" className="cart-continue" disabled={!ready || moving || locating || resolving || !point || !address.trim() || isCoordinateAddress(address)} onClick={() => { if (point) { updateLocation({ address: address.trim(), latitude: point.lat, longitude: point.lng }, addressDetails); close(); } }}>{t('checkout.useLocation')}</button>
    </footer>
  </main>;
}
