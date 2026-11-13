import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNavigationGuard } from '../src/services/bridge/navigation.ts';

test('navigation: rapid repeated back actions only navigate once', () => {
  let time = 0;
  const guard = createNavigationGuard(() => time);
  const routes = [];
  assert.equal(guard.run(() => routes.push('/products')), true);
  time = 100;
  assert.equal(guard.run(() => routes.push('/')), false);
  assert.deepEqual(routes, ['/products']);
  time = 500;
  assert.equal(guard.run(() => routes.push('/')), true);
  assert.deepEqual(routes, ['/products', '/']);
});

test('navigation: the tap following a back action cannot exit the newly opened root page', () => {
  let time = 0;
  const guard = createNavigationGuard(() => time);
  let closes = 0;
  guard.run(() => {});
  time = 200;
  assert.equal(guard.run(() => closes++, true), false);
  assert.equal(closes, 0);
  time = 600;
  assert.equal(guard.run(() => closes++, true), true);
  assert.equal(closes, 1);
});

test('navigation: exit sends one native close and blocks later navigation while closing', () => {
  let time = 0;
  const guard = createNavigationGuard(() => time);
  const actions = [];
  guard.run(() => actions.push('native.close'), true);
  time = 60_000;
  assert.equal(guard.run(() => actions.push('native.close'), true), false);
  assert.equal(guard.run(() => actions.push('/products')), false);
  assert.deepEqual(actions, ['native.close']);
});

test('navigation: a synchronous native callback cannot reenter close', () => {
  const guard = createNavigationGuard(() => 0);
  let closes = 0;
  guard.run(() => {
    closes++;
    assert.equal(guard.run(() => closes++, true), false);
  }, true);
  assert.equal(closes, 1);
});

test('navigation: a thrown bridge error allows the user to retry exit', () => {
  const guard = createNavigationGuard(() => 0);
  assert.throws(() => guard.run(() => { throw new Error('Bridge unavailable'); }, true), /Bridge unavailable/);
  let closes = 0;
  assert.equal(guard.run(() => closes++, true), true);
  assert.equal(closes, 1);
});
