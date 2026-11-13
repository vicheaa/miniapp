import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite, geocode, resolveLocationAddress, locationAddressDetails, isCoordinateAddress;
const emptyDetails = { province: '', district: '', commune: '', village: '' };
before(async () => {
  vite = await createServer({ mode: 'test', appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
  ({ geocode, resolveLocationAddress, locationAddressDetails, isCoordinateAddress } = await vite.ssrLoadModule('/src/services/maps/googleMaps.ts'));
});
after(async () => { await vite?.close(); });

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
