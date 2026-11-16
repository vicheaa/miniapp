// Local data and SDK stand-ins only. Native WKWebView and its keyboard stay real.
(() => {
  sessionStorage.setItem('dev_auth_token', 'keyboard-fixture');
  const product = { id: 1, internal_code: 'PRD1', line_name: 'Vital 250 mL', category: 2, category_name: 'Vital', default_uom: 7, default_uom_name: 'Case', reference_uom: 'Case', unit_price: '4.5', thumbnail: '' };
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.pathname.startsWith('/services/')) {
      const results = url.pathname.includes('category') ? [{ id: 2, name_en: 'Vital', order_index: 1 }] : [product];
      return Promise.resolve(new Response(JSON.stringify({ count: results.length, next: null, previous: null, results }), { headers: { 'Content-Type': 'application/json' } }));
    }
    return nativeFetch(input, options);
  };
  const latLng = point => ({ lat: () => point.lat, lng: () => point.lng });
  class Map {
    constructor(element, options) { this.center = options.center; this.zoom = options.zoom; this.listeners = {}; element.style.background = '#e8f0e6'; }
    addListener(name, fn) { (this.listeners[name] ??= new Set()).add(fn); return { remove: () => this.listeners[name].delete(fn) }; }
    getCenter() { return latLng(this.center); }
    getZoom() { return this.zoom; }
    setZoom(zoom) { this.zoom = zoom; }
    setMapTypeId() {}
    panTo(point) { this.center = point; setTimeout(() => this.listeners.idle?.forEach(fn => fn()), 20); }
  }
  class Geocoder { geocode(request, callback) { callback([{ formatted_address: 'Phnom Penh test address', geometry: { location: latLng(request.location) } }], 'OK'); } }
  window.google = { maps: { Map, Geocoder, event: { clearInstanceListeners(instance) { instance.listeners = {}; } } } };
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition(success) { success({ coords: { latitude: 11.6, longitude: 104.9, accuracy: 10 } }); } } });
  const footerVisible = () => {
    const footer = document.querySelector('.keyboard-bottom-actions');
    if (!footer) return false;
    const style = getComputedStyle(footer);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
  };
  let editing = false;
  let editingFrames = 0;
  let footerFlashFrames = 0;
  document.addEventListener('focusin', event => {
    editing = event.target.matches('input:not([readonly]):not(:disabled), textarea:not([readonly]):not(:disabled)');
  });
  document.addEventListener('focusout', () => { editing = false; });
  const checkEditingFrame = () => {
    if (editing) {
      editingFrames++;
      if (footerVisible()) footerFlashFrames++;
    }
    requestAnimationFrame(checkEditingFrame);
  };
  requestAnimationFrame(checkEditingFrame);
  window.keyboardSnapshot = () => {
    const page = document.querySelector('.keyboard-page');
    const bounds = page?.getBoundingClientRect();
    return {
      ready: !!document.querySelector('#order-phone'),
      route: location.hash,
      open: document.documentElement.dataset.keyboardOpen,
      pageTop: bounds?.top,
      pageHeight: bounds?.height,
      viewportHeight: visualViewport.height,
      offsetTop: visualViewport.offsetTop,
      scrollY,
      active: document.activeElement?.id || document.activeElement?.type,
      footerVisible: footerVisible(),
      editingFrames,
      footerFlashFrames,
      addressReady: !!document.querySelector('.checkout-map-address textarea:not(:disabled)') && document.querySelector('.location-details')?.getAttribute('aria-busy') === 'false',
    };
  };
  const timer = setInterval(async () => {
    if (!document.querySelector('.cart-page')) return;
    clearInterval(timer);
    // WKUserScript has no module base URL: always import an absolute URL.
    const { useOrderDraftStore: draft } = await import(location.origin + '/src/store/orderDraftStore.ts');
    draft.setState({ items: { 1: { product: { ...product, default_uom: { id: 7, name: 'Case' } }, uom: { id: 7, name: 'Case' }, quantity: 1 } } });
  }, 100);
})();
