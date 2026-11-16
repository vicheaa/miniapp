import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite, geocode, resolveLocationAddress, hasResolvedLocation, locationAddressDetails, prefixedLocationDetails, isCoordinateAddress, isPlusCodeAddress, isKhmerAddress, loadGoogleMaps;
const emptyDetails = { province: '', district: '', commune: '', village: '' };
const latLng = (lat, lng) => ({ lat: () => lat, lng: () => lng });
before(async () => {
  vite = await createServer({ mode: 'test', appType: 'custom', define: { 'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify('maps-test-key') }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
  ({ geocode, resolveLocationAddress, hasResolvedLocation, locationAddressDetails, prefixedLocationDetails, isCoordinateAddress, isPlusCodeAddress, isKhmerAddress, loadGoogleMaps } = await vite.ssrLoadModule('/src/services/maps/googleMaps.ts'));
});
after(async () => { await vite?.close(); });

test('maps: the SDK loads in Khmer for Cambodia independently of the browser language', async () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const api = { Map: class {}, Geocoder: class {} };
  globalThis.window = {};
  globalThis.document = {
    createElement: () => ({ remove() {} }),
    head: { append(script) {
      const params = new URL(script.src).searchParams;
      assert.equal(params.get('language'), 'km');
      assert.equal(params.get('region'), 'KH');
      globalThis.window.google = { maps: api };
      globalThis.window[params.get('callback')]();
    } },
  };
  try {
    assert.equal(await loadGoogleMaps(), api);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('maps: reverse lookup returns the provider address and preserves provider failure statuses', async () => {
  const result = { formatted_address: 'Delivery address', geometry: { location: { lat: () => 11.595, lng: () => 104.89 } } };
  const request = { location: { lat: 11.595, lng: 104.89 } };
  assert.equal(await geocode({ geocode(input, callback) { assert.deepEqual(input, request); callback([result], 'OK'); } }, request), result);
  for (const status of ['REQUEST_DENIED', 'ZERO_RESULTS', 'OVER_QUERY_LIMIT', 'ERROR']) {
    await assert.rejects(geocode({ geocode(_, callback) { callback([], status); } }, request), new RegExp(status));
  }
});

test('maps: a stalled provider lookup times out rather than permanently disabling confirmation', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const request = geocode({ geocode() {} }, { location: { lat: 0, lng: 0 } });
  const rejected = assert.rejects(request, /TIMEOUT/);
  context.mock.timers.tick(10_000);
  await rejected;
});

test('maps: synchronous SDK failures reject the lookup', async () => {
  await assert.rejects(geocode({ geocode() { throw new Error('SDK failure'); } }, { location: { lat: 0, lng: 0 } }), /SDK failure/);
});

test('maps: location auto-fill returns address text and exposes lookup failures without substituting coordinates', async () => {
  const point = { lat: 11.575, lng: 104.921 };
  assert.deepEqual(await resolveLocationAddress({ geocode(_, callback) { callback([{ formatted_address: '  Phnom Penh delivery address  ' }], 'OK'); } }, point), { address: 'Phnom Penh delivery address', details: emptyDetails, errorStatus: null });
  for (const status of ['REQUEST_DENIED', 'ZERO_RESULTS', 'OVER_QUERY_LIMIT', 'ERROR']) {
    assert.deepEqual(await resolveLocationAddress({ geocode(_, callback) { callback([], status); } }, point), { address: '', details: emptyDetails, errorStatus: status });
  }
  assert.deepEqual(await resolveLocationAddress({ geocode(_, callback) { callback([{ formatted_address: ' ' }], 'OK'); } }, { lat: 0, lng: -104.89 }), { address: '', details: emptyDetails, errorStatus: 'ZERO_RESULTS' });
});

test('maps: legacy coordinate-only addresses are detected without rejecting numbered street addresses', () => {
  for (const value of ['11.603254, 104.900614', ' 0, -104.89 ', '+11.5,+104.9']) assert.equal(isCoordinateAddress(value), true);
  for (const value of ['', '123, Street 598, Phnom Penh', '#11, 104 Street', 'Phnom Penh']) assert.equal(isCoordinateAddress(value), false);
});

test('maps: incomplete primary results use another readable result or real administrative names', async () => {
  const point = { lat: 11.5, lng: 104.9 };
  const details = { ...emptyDetails, province: 'Phnom Penh', district: 'Sen Sok' };
  const components = [
    { long_name: details.province, types: ['administrative_area_level_1'] },
    { long_name: details.district, types: ['administrative_area_level_2'] },
  ];
  const resolve = (results) => resolveLocationAddress({ geocode(_, callback) { callback(results, 'OK'); } }, point);
  assert.deepEqual(await resolve([{ formatted_address: '11.5, 104.9', address_components: components }]), { address: 'Sen Sok, Phnom Penh', details, errorStatus: null });
  assert.deepEqual(await resolve([{ formatted_address: '' }, { formatted_address: 'Street 598, Phnom Penh', address_components: components }]), { address: 'Street 598, Phnom Penh', details, errorStatus: null });
  assert.deepEqual(await resolve([{ formatted_address: '11.5, 104.9' }]), { address: '', details: emptyDetails, errorStatus: 'ZERO_RESULTS' });
});

test('maps: administrative details come from typed components across results, not the formatted address', async () => {
  const components = [
    { long_name: 'Province name', types: ['administrative_area_level_1', 'political'] },
    { long_name: 'District name', types: ['administrative_area_level_2', 'political'] },
    { long_name: 'ឃុំសាកល្បង', types: ['administrative_area_level_3', 'political'] },
    { long_name: 'Village name', types: ['administrative_area_level_4', 'political'] },
  ];
  const results = [{ formatted_address: 'Street address', address_components: components.slice(0, 2) }, { formatted_address: '', address_components: components.slice(2) }];
  const resolved = await resolveLocationAddress({ geocode(_, callback) { callback(results, 'OK'); } }, { lat: 11.5, lng: 104.9 });
  assert.equal(resolved.address, 'Street address');
  assert.deepEqual(resolved.details, { province: 'Province name', district: 'District name', commune: 'ឃុំសាកល្បង', village: 'Village name' });
  assert.deepEqual(locationAddressDetails([{ formatted_address: 'Village name, Commune name, District name, Province name' }]), emptyDetails);
});

test('maps: explicit administrative components take priority; missing village names are never guessed', () => {
  const details = locationAddressDetails([{ address_components: [
    { long_name: 'Fallback district', types: ['sublocality_level_1'] },
    { long_name: 'Actual district', types: ['administrative_area_level_2'] },
    { long_name: 'Commune name', types: ['sublocality_level_2'] },
    { long_name: 'Nearby neighborhood', types: ['neighborhood'] },
    { long_name: 'A shop name', types: ['premise'] },
  ] }]);
  assert.deepEqual(details, { province: '', district: 'Actual district', commune: 'Commune name', village: '' });
});

test('maps: Plus Codes are detected without rejecting readable street addresses', () => {
  for (const value of ['JV3X+8V7, Phnom Penh 12105, Cambodia', '  jv3x+8v7 Phnom Penh ', '7P28JV3X+8V7', '7P280000+XX']) assert.equal(isPlusCodeAddress(value), true);
  for (const value of ['', 'Street 598, Phnom Penh', '#11, 104 Street', '11.5, 104.9', 'C++ School, Phnom Penh']) assert.equal(isPlusCodeAddress(value), false);
});

test('maps: a street result replaces the leading Plus Code and includes available address divisions', async () => {
  const components = [
    { long_name: 'Unit 2', types: ['subpremise'] },
    { long_name: 'Building A', types: ['premise'] },
    { long_name: '42', types: ['street_number'] },
    { long_name: 'Street 598', types: ['route'] },
    { long_name: 'Phnom Penh', types: ['locality'] },
    { long_name: 'Phnom Penh', types: ['administrative_area_level_1'] },
    { long_name: '12105', types: ['postal_code'] },
    { long_name: 'Cambodia', types: ['country'] },
  ];
  const result = await resolveLocationAddress({ geocode(_, callback) { callback([
    { formatted_address: 'JV3X+8V7, Phnom Penh 12105, Cambodia', types: ['plus_code'] },
    { formatted_address: '42 Street 598, Phnom Penh, Cambodia', types: ['street_address'], address_components: components },
    { formatted_address: 'Sen Sok, Phnom Penh', address_components: [
      { long_name: 'Sen Sok', types: ['administrative_area_level_2'] },
      { long_name: 'Phnom Penh Thmei', types: ['administrative_area_level_3'] },
    ] },
  ], 'OK'); } }, { lat: 11.603028, lng: 104.899537 });
  assert.equal(result.address, 'Unit 2, Building A, 42 Street 598, Phnom Penh Thmei, Sen Sok, Phnom Penh, 12105, Cambodia');
  assert.equal(result.errorStatus, null);
});

test('maps: address lookup always requests Khmer and uses real divisions, postal code and country', async () => {
  const point = { lat: 11.5564, lng: 104.9282 };
  const components = [
    { long_name: 'JV3X+8V7', types: ['plus_code'] },
    { long_name: 'សង្កាត់ទឹកថ្លា', types: ['administrative_area_level_3'] },
    { long_name: 'ខណ្ឌសែនសុខ', types: ['administrative_area_level_2'] },
    { long_name: 'រាជធានីភ្នំពេញ', types: ['administrative_area_level_1'] },
    { long_name: '120102', types: ['postal_code'] },
    { long_name: 'ប្រទេសកម្ពុជា', types: ['country'] },
  ];
  const result = await resolveLocationAddress({ geocode(request, callback) {
    assert.deepEqual(request, { location: point, language: 'km' });
    callback([{ formatted_address: 'JV3X+8V7, Phnom Penh, Cambodia', address_components: components }], 'OK');
  } }, point);
  assert.equal(result.address, 'សង្កាត់ទឹកថ្លា, ខណ្ឌសែនសុខ, រាជធានីភ្នំពេញ, 120102, ព្រះរាជាណាចក្រកម្ពុជា');
  assert.equal(result.details.village, '');
  assert.equal(result.errorStatus, null);
});

test('maps: a Plus Code without readable address data is never used as the address', async () => {
  const result = await resolveLocationAddress({ geocode(_, callback) {
    callback([{ formatted_address: 'JV3X+8V7, Phnom Penh 12105, Cambodia', types: ['plus_code'] }], 'OK');
  } }, { lat: 11.603028, lng: 104.899537 });
  assert.deepEqual(result, { address: '', details: emptyDetails, errorStatus: 'ZERO_RESULTS' });
});

test('maps: an English address with only a Khmer country name still needs localization', () => {
  assert.equal(isKhmerAddress('One Road Group, Street Chea Sophara (598), Phnom Penh, កម្ពុជា'), false);
  assert.equal(isKhmerAddress('Phnom Penh, Cambodia'), false);
  assert.equal(isKhmerAddress(''), false);
  assert.equal(isKhmerAddress('ផ្លូវ ៥៩៨, សង្កាត់ទឹកថ្លា, រាជធានីភ្នំពេញ, 120102, កម្ពុជា'), true);
});

test('maps: Khmer street and administrative names take priority over mixed English results', async () => {
  const result = await resolveLocationAddress({ geocode(_, callback) { callback([
    { formatted_address: 'One Road Group, Street Chea Sophara (598), Phnom Penh, កម្ពុជា', types: ['street_address'], geometry: { location: latLng(11.605, 104.899) }, address_components: [
      { long_name: 'Street Chea Sophara (598)', types: ['route'] },
      { long_name: 'Phnom Penh', types: ['locality'] },
      { long_name: 'Phnom Penh', types: ['administrative_area_level_1'] },
      { long_name: 'Sen Sok', types: ['administrative_area_level_2'] },
    ] },
    { formatted_address: 'ផ្លូវ ៥៩៨, រាជធានីភ្នំពេញ, កម្ពុជា', types: ['route'], geometry: { location: latLng(11.603230, 104.900514) }, address_components: [
      { long_name: 'ផ្លូវ ៥៩៨', types: ['route'] },
      { long_name: 'រាជធានីភ្នំពេញ', types: ['locality'] },
      { long_name: 'រាជធានីភ្នំពេញ', types: ['administrative_area_level_1'] },
      { long_name: 'ខណ្ឌសែនសុខ', types: ['administrative_area_level_2'] },
      { long_name: 'កម្ពុជា', types: ['country'] },
    ] },
  ], 'OK'); } }, { lat: 11.603230, lng: 104.900514 });
  assert.equal(result.address, 'ផ្លូវ ៥៩៨, ខណ្ឌសែនសុខ, រាជធានីភ្នំពេញ, ព្រះរាជាណាចក្រកម្ពុជា');
  assert.equal(result.details.province, 'រាជធានីភ្នំពេញ');
  assert.equal(result.details.district, 'ខណ្ឌសែនសុខ');
});

test('maps: unavailable Khmer street names preserve the delivery address instead of dropping it', async () => {
  const result = await resolveLocationAddress({ geocode(_, callback) { callback([
    { formatted_address: 'Street Chea Sophara (598), Phnom Penh, កម្ពុជា', types: ['route'], address_components: [
      { long_name: 'Street Chea Sophara (598)', types: ['route'] },
      { long_name: 'Phnom Penh', types: ['locality'] },
    ] },
    { formatted_address: 'រាជធានីភ្នំពេញ, កម្ពុជា', types: ['locality'], address_components: [
      { long_name: 'រាជធានីភ្នំពេញ', types: ['locality'] },
      { long_name: 'កម្ពុជា', types: ['country'] },
    ] },
  ], 'OK'); } }, { lat: 11.603230, lng: 104.900514 });
  assert.equal(result.address, 'Street Chea Sophara (598), រាជធានីភ្នំពេញ, ព្រះរាជាណាចក្រកម្ពុជា');
  assert.equal(result.errorStatus, null);
});

test('maps: the address field uses Khmer local divisions instead of English business and street text', async () => {
  const result = await resolveLocationAddress({ geocode(_, callback) { callback([
    { formatted_address: 'One Road Group, Street Chea Sophara (598), Phnom Penh, កម្ពុជា', types: ['street_address'], address_components: [
      { long_name: 'One Road Group', types: ['premise'] },
      { long_name: 'Street Chea Sophara (598)', types: ['route'] },
      { long_name: 'Phnom Penh', types: ['locality'] },
      { long_name: 'កម្ពុជា', types: ['country'] },
    ] },
    { formatted_address: 'សង្កាត់ភ្នំពេញថ្មី, ខណ្ឌសែនសុខ, រាជធានីភ្នំពេញ, កម្ពុជា', types: ['administrative_area_level_3'], address_components: [
      { long_name: 'សង្កាត់ភ្នំពេញថ្មី', types: ['administrative_area_level_3'] },
      { long_name: 'ខណ្ឌសែនសុខ', types: ['administrative_area_level_2'] },
      { long_name: 'រាជធានីភ្នំពេញ', types: ['administrative_area_level_1'] },
      { long_name: '12105', types: ['postal_code'] },
    ] },
  ], 'OK'); } }, { lat: 11.603230, lng: 104.900514 });
  assert.equal(result.address, 'សង្កាត់ភ្នំពេញថ្មី, ខណ្ឌសែនសុខ, រាជធានីភ្នំពេញ, 12105, ព្រះរាជាណាចក្រកម្ពុជា');
  assert.equal(isKhmerAddress(result.address), true);
  assert.equal(result.errorStatus, null);
});

test('maps: an untranslated business name does not replace an available Khmer street address', async () => {
  const result = await resolveLocationAddress({ geocode(_, callback) { callback([
    { formatted_address: 'One Road Group, ផ្លូវ ៥៩៨, រាជធានីភ្នំពេញ, កម្ពុជា', types: ['street_address'], address_components: [
      { long_name: 'One Road Group', types: ['premise'] },
      { long_name: '42', types: ['street_number'] },
      { long_name: 'ផ្លូវ ៥៩៨', types: ['route'] },
      { long_name: 'រាជធានីភ្នំពេញ', types: ['administrative_area_level_1'] },
      { long_name: 'កម្ពុជា', types: ['country'] },
    ] },
  ], 'OK'); } }, { lat: 11.603230, lng: 104.900514 });
  assert.equal(result.address, '42 ផ្លូវ ៥៩៨, រាជធានីភ្នំពេញ, ព្រះរាជាណាចក្រកម្ពុជា');
  assert.equal(result.errorStatus, null);
});

test('maps: address text prefixes bare Khmer administrative names and keeps the raw details', async () => {
  const result = await resolveLocationAddress({ geocode(_, callback) { callback([
    { formatted_address: 'JV3X+8V7, Phnom Penh, Cambodia', types: ['plus_code'], address_components: [
      { long_name: 'ទួលគោក', types: ['administrative_area_level_4'] },
      { long_name: 'ភ្នំពេញថ្មី', types: ['administrative_area_level_3'] },
      { long_name: 'សែនសុខ', types: ['administrative_area_level_2'] },
      { long_name: 'ភ្នំពេញ', types: ['administrative_area_level_1'] },
      { long_name: 'ភ្នំពេញ', types: ['locality'] },
      { long_name: '120707', types: ['postal_code'] },
      { long_name: 'កម្ពុជា', types: ['country'] },
    ] },
  ], 'OK'); } }, { lat: 11.603166, lng: 104.900863 });
  assert.equal(result.address, 'ភូមិទួលគោក, សង្កាត់ភ្នំពេញថ្មី, ខណ្ឌសែនសុខ, រាជធានីភ្នំពេញ, 120707, ព្រះរាជាណាចក្រកម្ពុជា');
  assert.deepEqual(result.details, { village: 'ទួលគោក', commune: 'ភ្នំពេញថ្មី', district: 'សែនសុខ', province: 'ភ្នំពេញ' });
});

test('maps: prefixes distinguish provincial districts from Phnom Penh and preserve existing labels', () => {
  assert.deepEqual(prefixedLocationDetails({ village: 'ព្រែកតូច', commune: 'ព្រែកថ្មី', district: 'កៀនស្វាយ', province: 'កណ្ដាល' }), {
    village: 'ភូមិព្រែកតូច', commune: 'ឃុំព្រែកថ្មី', district: 'ស្រុកកៀនស្វាយ', province: 'ខេត្តកណ្ដាល',
  });
  const labeled = { village: 'ភូមិសាកល្បង', commune: 'សង្កាត់តាខ្មៅ', district: 'ក្រុងតាខ្មៅ', province: 'ខេត្តកណ្ដាល' };
  assert.deepEqual(prefixedLocationDetails(labeled), labeled);
  assert.equal(prefixedLocationDetails({ ...labeled, commune: 'តាខ្មៅ' }).commune, 'សង្កាត់តាខ្មៅ');
});

test('maps: prefix formatting never invents missing administrative divisions or translates English names', () => {
  assert.deepEqual(prefixedLocationDetails(emptyDetails), emptyDetails);
  const english = { village: 'Village name', commune: 'Commune name', district: 'District name', province: 'Province name' };
  assert.deepEqual(prefixedLocationDetails(english), english);
  const labeled = { village: 'ភូមិសាកល្បង', commune: 'សង្កាត់ភ្នំពេញថ្មី', district: 'ខណ្ឌសែនសុខ', province: 'រាជធានីភ្នំពេញ' };
  assert.deepEqual(prefixedLocationDetails(labeled), labeled);
});

test('maps: Street 598 stays selected along its segment instead of a fully Khmer address on Street 1800', async () => {
  // Geometry reproduces the live response at the reference screenshot coordinate.
  const common = [
    { long_name: 'ឫស្សីកែវ', types: ['administrative_area_level_3'] },
    { long_name: 'ខណ្ឌឫស្សីកែវ', types: ['administrative_area_level_2'] },
    { long_name: 'ភ្នំពេញ', types: ['administrative_area_level_1'] },
    { long_name: 'កម្ពុជា', types: ['country'] },
  ];
  const results = [
    { formatted_address: '31 ផ្លូវ ១៨០០, ភ្នំពេញ, កម្ពុជា', types: ['street_address'], geometry: { location: latLng(11.605081, 104.8977561) }, address_components: [
      { long_name: '31', types: ['street_number'] },
      { long_name: 'ផ្លូវ ១៨០០', types: ['route'] }, ...common,
    ] },
    { formatted_address: 'Street 598, ភ្នំពេញ, កម្ពុជា', types: ['route'], geometry: {
      location: latLng(11.60334440000763, 104.8994087000714),
      bounds: { getSouthWest: () => latLng(11.603045, 104.899342), getNorthEast: () => latLng(11.6036438, 104.8994754) },
    }, address_components: [{ long_name: 'Street 598', types: ['route'] }, ...common] },
  ];
  for (const point of [
    { lat: 11.6031455, lng: 104.8994880 },
    { lat: 11.6033455, lng: 104.8994480 },
    { lat: 11.6035455, lng: 104.8994080 },
  ]) {
    const result = await resolveLocationAddress({ geocode(_, callback) { callback(results, 'OK'); } }, point);
    assert.equal(result.address, 'ផ្លូវ ៥៩៨, សង្កាត់ឫស្សីកែវ, ខណ្ឌឫស្សីកែវ, រាជធានីភ្នំពេញ, ព្រះរាជាណាចក្រកម្ពុជា');
    assert.doesNotMatch(result.address, /១៨០០|31/);
  }
  const otherRoad = await resolveLocationAddress({ geocode(_, callback) { callback(results, 'OK'); } }, { lat: 11.605081, lng: 104.8977561 });
  assert.match(otherRoad.address, /^31 ផ្លូវ ១៨០០,/);
});

test('maps: a road segment containing the pin is compared by its bounds instead of its distant center', async () => {
  const point = { lat: 11.6, lng: 104.9 };
  const result = await resolveLocationAddress({ geocode(_, callback) { callback([
    { formatted_address: '31 ផ្លូវ ១៨០០', types: ['street_address'], geometry: { location: latLng(11.601, 104.901) }, address_components: [
      { long_name: '31', types: ['street_number'] }, { long_name: 'ផ្លូវ ១៨០០', types: ['route'] },
    ] },
    { formatted_address: 'Street 598', types: ['route'], geometry: {
      location: latLng(11.62, 104.9),
      bounds: { getSouthWest: () => latLng(11.59, 104.8999), getNorthEast: () => latLng(11.65, 104.9001) },
    }, address_components: [{ long_name: 'Street 598', types: ['route'] }, { long_name: 'កម្ពុជា', types: ['country'] }] },
  ], 'OK'); } }, point);
  assert.equal(result.address, 'ផ្លូវ ៥៩៨, ព្រះរាជាណាចក្រកម្ពុជា');
});

test('maps: a closer street with a Plus Code in its formatted text still uses its real route component', async () => {
  const result = await resolveLocationAddress({ geocode(_, callback) { callback([
    { formatted_address: '31 ផ្លូវ ១៨០០', types: ['street_address'], geometry: { location: latLng(11.605, 104.897) }, address_components: [{ long_name: 'ផ្លូវ ១៨០០', types: ['route'] }] },
    { formatted_address: 'JV3X+8V7, Street 598, Phnom Penh', types: ['street_address'], geometry: { location: latLng(11.6031, 104.8995) }, address_components: [
      { long_name: 'JV3X+8V7', types: ['plus_code'] },
      { long_name: 'Street 598', types: ['route'] },
      { long_name: 'កម្ពុជា', types: ['country'] },
    ] },
  ], 'OK'); } }, { lat: 11.6031, lng: 104.8995 });
  assert.equal(result.address, 'ផ្លូវ ៥៩៨, ព្រះរាជាណាចក្រកម្ពុជា');
});

test('maps: cached addresses are reused only after the current resolver checked the same point', async () => {
  const point = { lat: 11.6031455, lng: 104.8994880 };
  assert.equal(hasResolvedLocation({ province: 'ភ្នំពេញ', district: 'ឫស្សីកែវ', commune: 'ឫស្សីកែវ', village: '' }, point), false);
  const result = await resolveLocationAddress({ geocode(_, callback) { callback([{ formatted_address: 'Street 598' }], 'OK'); } }, point);
  assert.equal(hasResolvedLocation(result.details, point), true);
  assert.equal(hasResolvedLocation(result.details, { ...point, lat: point.lat + 0.001 }), false);
  assert.equal(hasResolvedLocation(null, point), false);
  const failed = await resolveLocationAddress({ geocode(_, callback) { callback([], 'ZERO_RESULTS'); } }, point);
  assert.equal(hasResolvedLocation(failed.details, point), false);
});
