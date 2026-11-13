import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { createServer } from 'vite';
import { CART_STORAGE_KEY } from '../src/store/cartStorage.ts';

const previousWindow = globalThis.window;
const servers = [];
let saved;
let storage;
const key = CART_STORAGE_KEY;
const product = {
  id: 353, line_name: 'Vital 1500ML', line_name_kh: null, line_code: 'VT1500', internal_code: 'PRD353',
  qty_step: '1.0000', default_uom: { id: 62, name: 'Package' }, thumbnail: {}, images: [],
};
const token = (subject, rotation = 1) => `fixture.${Buffer.from(JSON.stringify({ iss: 'fixture-issuer', sub: subject, iat: rotation })).toString('base64url')}.signature`;

beforeEach(() => {
  saved = new Map();
  storage = {
    getItem: (name) => saved.get(name) ?? null,
    setItem: (name, value) => saved.set(name, value),
    removeItem: (name) => saved.delete(name),
  };
  globalThis.window = { localStorage: storage };
});
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
});

async function app() {
  const vite = await createServer({
    configFile: false,
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, entries: [] },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  });
  servers.push(vite);
  const { useOrderDraftStore: cart } = await vite.ssrLoadModule('/src/store/orderDraftStore.ts');
  const { useMiniAppStore: session } = await vite.ssrLoadModule('/src/store/miniAppStore.ts');
  const helpers = await vite.ssrLoadModule('/src/store/cartStorage.ts');
  return { cart, session, helpers };
}

test('cart storage: additions, manual quantities, and removals persist without credentials', async () => {
  const { cart, session } = await app();
  const authToken = token('user-a');
  session.getState().setAuthToken(authToken);
  cart.getState().adjust(product, 1);
  assert.equal(JSON.parse(saved.get(key)).items[353].quantity, 1);
  cart.getState().setQuantity(product, 8);
  cart.getState().adjust(product, -1);
  assert.equal(JSON.parse(saved.get(key)).items[353].quantity, 7);
  assert.equal(saved.get(key).includes(authToken), false);
  cart.getState().setQuantity(product, 0);
  assert.equal(saved.has(key), false);
});

test('checkout draft: updating a map selection preserves phone and delivery date without persisting personal data', async () => {
  const { cart, session } = await app();
  session.getState().setAuthToken(token('user-a'));
  cart.getState().adjust(product, 1);
  cart.getState().updateDetails({ phone: '012345678', delivery_date: '2027-02-15T00:00:00+07:00' });
  cart.getState().updateDetails({ address: 'Delivery test address', latitude: 11.595, longitude: 104.89 });
  assert.equal(cart.getState().details.phone, '012345678');
  assert.equal(cart.getState().details.delivery_date, '2027-02-15T00:00:00+07:00');
  assert.equal(cart.getState().details.latitude, 11.595);
  assert.equal(cart.getState().details.address, 'Delivery test address');
  const serialized = saved.get(key);
  assert.equal(serialized.includes('012345678'), false);
  assert.equal(serialized.includes('Delivery test address'), false);
  session.getState().reset();
  assert.equal(cart.getState().details.phone, '');
  assert.equal(cart.getState().details.address, '');
  assert.equal(cart.getState().details.latitude, null);
});

test('checkout draft: administrative address details stay with their confirmed pin and clear when that pin or session changes', async () => {
  const { cart, session } = await app();
  session.getState().setAuthToken(token('user-a'));
  const parts = { province: 'Province', district: 'District', commune: 'Commune', village: 'Village' };
  cart.getState().updateLocation({ address: 'Confirmed address', latitude: 11.595, longitude: 104.89 }, parts);
  cart.getState().updateDetails({ phone: '012345678' });
  assert.deepEqual(cart.getState().locationDetails, parts);
  assert.equal(cart.getState().details.address, 'Confirmed address');
  cart.getState().updateDetails({ latitude: 11.6 });
  assert.equal(cart.getState().locationDetails, null);
  cart.getState().updateLocation({ address: 'New address', latitude: 11.6, longitude: 104.9 }, parts);
  session.getState().reset();
  assert.equal(cart.getState().locationDetails, null);
});

test('cart storage: a cold startup reset preserves saved data until authentication restores it', async () => {
  const first = await app();
  first.session.getState().setAuthToken(token('user-a'));
  first.cart.getState().setQuantity(product, 9);
  const second = await app();
  assert.deepEqual(second.cart.getState().items, {});
  second.session.getState().reset();
  assert.equal(JSON.parse(saved.get(key)).items[353].quantity, 9);
  // Bootstrap publishes its native session with setState after the initial reset.
  second.session.setState({ superApp: {}, authToken: token('user-a', 2) });
  assert.equal(second.cart.getState().items[353].quantity, 9);
  assert.equal(second.cart.getState().items[353].uom.name, 'Package');
});

test('cart storage: another JWT user cannot restore the previous user cart', async () => {
  const first = await app();
  first.session.getState().setAuthToken(token('user-a'));
  first.cart.getState().adjust(product, 1);
  const second = await app();
  second.session.getState().reset();
  second.session.setState({ superApp: {}, authToken: token('user-b') });
  assert.deepEqual(second.cart.getState().items, {});
  assert.equal(saved.has(key), false);
});

test('cart storage: token rotation preserves the cart and explicit logout clears saved data', async () => {
  const { cart, session } = await app();
  session.getState().setAuthToken(token('user-a'));
  cart.getState().adjust(product, 1);
  session.getState().applyRefreshedToken(token('user-a'), token('user-a', 2), session.getState().sessionVersion);
  assert.equal(cart.getState().items[353].quantity, 1);
  assert.equal(JSON.parse(saved.get(key)).items[353].quantity, 1);
  session.getState().reset();
  assert.deepEqual(cart.getState().items, {});
  assert.equal(saved.has(key), false);
});

test('cart storage: corrupt JSON, unsupported versions, and malformed items cannot break restoration', async () => {
  const { helpers } = await app();
  const owner = helpers.cartOwner(token('user-a'));
  for (const value of ['not-json', 'null', JSON.stringify({ version: 2, owner, items: {} })]) {
    saved.set(key, value);
    assert.deepEqual(helpers.readCart(owner), {});
  }
  saved.set(key, JSON.stringify({ version: 1, owner, items: {
    353: { product, quantity: 3 },
    354: { product: { ...product, id: 354 }, quantity: -1 },
    355: { product: { ...product, id: 355 }, quantity: 0 },
    356: { product: { ...product, id: 356 }, quantity: '5' },
    357: { product: { ...product, id: 357 }, quantity: 1.5 },
    358: { product: { ...product, id: 999 }, quantity: 1 },
  } }));
  assert.deepEqual(Object.keys(helpers.readCart(owner)), ['353']);
});

test('cart storage: storage access and quota failures leave the in-memory cart usable', async () => {
  Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new Error('Blocked'); } });
  const { cart, session } = await app();
  session.getState().setAuthToken(token('user-a'));
  assert.doesNotThrow(() => cart.getState().adjust(product, 1));
  assert.equal(cart.getState().items[353].quantity, 1);
  Object.defineProperty(window, 'localStorage', { value: {
    getItem: () => null,
    setItem: () => { throw new Error('Quota exceeded'); },
    removeItem: () => { throw new Error('Blocked'); },
  } });
  assert.doesNotThrow(() => cart.getState().adjust(product, 1));
  assert.equal(cart.getState().items[353].quantity, 2);
  assert.doesNotThrow(() => cart.getState().clear());
  assert.deepEqual(cart.getState().items, {});
});
