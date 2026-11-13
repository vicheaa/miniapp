// Local contract fixture only: this is not a live Google map or geocoding result.
const http = require('node:http');
let reverseStatus = 'OK';
let reverseDelay = 0;
const addressComponents = [
  { long_name: 'Phnom Penh', types: ['administrative_area_level_1', 'political'] },
  { long_name: 'Sen Sok', types: ['administrative_area_level_2', 'political'] },
  { long_name: 'Phnom Penh Thmei', types: ['administrative_area_level_3', 'political'] },
  { long_name: 'Fixture village', types: ['administrative_area_level_4', 'political'] },
];
function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(value));
}
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname === '/control') {
    const status = url.searchParams.get('status') ?? 'OK';
    if (!['OK', 'REQUEST_DENIED', 'ZERO_RESULTS', 'ERROR'].includes(status)) return json(res, 400, { message: 'Unknown fixture status.' });
    reverseStatus = status;
    reverseDelay = Math.min(1000, Math.max(0, Number(url.searchParams.get('delay')) || 0));
    return json(res, 200, { status: reverseStatus, delay: reverseDelay });
  }
  if (req.method !== 'GET') return json(res, 501, { message: 'Only fixture reads are modeled.' });
  if (url.pathname === '/geocode') {
    if (url.searchParams.get('address') === '__error__') return json(res, 503, { status: 'ERROR', results: [] });
    if (url.searchParams.get('address') === '__empty__') return json(res, 200, { status: 'ZERO_RESULTS', results: [] });
    const lat = Number(url.searchParams.get('lat') ?? 11.595);
    const lng = Number(url.searchParams.get('lng') ?? 104.89);
    if (url.searchParams.has('lat') && (reverseStatus !== 'OK' || reverseDelay)) {
      const status = reverseStatus;
      return setTimeout(() => json(res, 200, { status, results: status === 'OK' ? [{ formatted_address: 'St.598, Kh.Sen Sok, Phnom Penh', address_components: addressComponents, geometry: { location: { lat, lng } } }] : [] }), reverseDelay);
    }
    return json(res, 200, { status: 'OK', results: [{ formatted_address: 'St.598, Kh.Sen Sok, Phnom Penh', address_components: addressComponents, geometry: { location: { lat, lng } } }] });
  }
  if (url.pathname === '/sdk.js') {
    const origin = url.searchParams.get('origin');
    if (!origin || !/^http:\/\/(127\.0\.0\.1|localhost):\d+\/maps$/.test(origin)) return json(res, 400, { message: 'A local simulation origin is required.' });
    res.writeHead(200, { 'Content-Type': 'application/javascript', 'Access-Control-Allow-Origin': '*' });
    return res.end(`(() => {
      const origin = ${JSON.stringify(origin)};
      const latLng = (point) => ({ lat: () => point.lat, lng: () => point.lng });
      class Map {
        constructor(element, options) {
          this.center = options.center; this.listeners = {}; this.zoom = options.zoom; this.mapTypeId = options.mapTypeId;
          element.__fixtureMap = this;
          element.innerHTML = '<div style="height:100%;background:repeating-linear-gradient(90deg,transparent 0 59px,#fff 60px 65px),repeating-linear-gradient(0deg,#e8f0e6 0 54px,#fff 55px 60px);display:grid;place-items:center"><span style="background:white;padding:8px;color:#64748b;font:13px sans-serif">Local map fixture</span></div>';
          element.addEventListener('click', () => this.emit('click', { latLng: latLng({ lat: 11.595, lng: 104.89 }) }));
          setTimeout(() => this.emit('idle'), 0);
        }
        addListener(name, callback) { (this.listeners[name] ??= new Set()).add(callback); return { remove: () => this.listeners[name].delete(callback) }; }
        emit(name, event) { this.listeners[name]?.forEach((callback) => callback(event)); }
        getCenter() { return latLng(this.center); }
        getZoom() { return this.zoom; }
        setZoom(zoom) { this.zoom = zoom; }
        setMapTypeId(mapTypeId) { this.mapTypeId = mapTypeId; }
        panTo(point) { this.center = { lat: typeof point.lat === 'function' ? point.lat() : point.lat, lng: typeof point.lng === 'function' ? point.lng() : point.lng }; setTimeout(() => this.emit('idle'), 0); }
      }
      class Geocoder {
        geocode(request, callback) {
          const params = new URLSearchParams(request.location ? { lat: request.location.lat, lng: request.location.lng } : { address: request.address });
          fetch(origin + '/geocode?' + params).then((response) => response.json()).then((body) => callback(body.results.map((result) => ({ ...result, geometry: { location: latLng(result.geometry.location) } })), body.status)).catch(() => callback([], 'ERROR'));
        }
      }
      class Circle { constructor(options) { this.map = options.map; } setMap(map) { this.map = map; } }
      window.google = { maps: { Map, Geocoder, Circle, event: { clearInstanceListeners(instance) { instance.listeners = {}; } } } };
      const callback = new URL(document.currentScript.src).searchParams.get('callback');
      window[callback]();
    })();`);
  }
  return json(res, 501, { message: 'Maps fixture endpoint not modeled.' });
}).listen(process.env.PORT || 4903);
