import assert from 'node:assert/strict';
import test from 'node:test';
import {createSubscriptionLifecycle, workspaceListenerKey} from '../src/lib/firestoreListenerLifecycle';

test('workspace listener key is unavailable until authentication and scopes resolve', () => {
  assert.equal(workspaceListenerKey({authResolution: 'initializing', userId: 'u1', ownerScope: 'owner', workspaceScope: 'owner'}), null);
  assert.equal(workspaceListenerKey({authResolution: 'signed_out', userId: null, ownerScope: null, workspaceScope: null}), null);
  assert.equal(workspaceListenerKey({authResolution: 'authenticated', userId: 'u1', ownerScope: 'default_store', workspaceScope: 'default_store'}), null);
});

test('same authenticated identity and workspace do not restart subscriptions', () => {
  const lifecycle = createSubscriptionLifecycle();
  let starts = 0;
  let stops = 0;
  const start = () => { starts += 1; return () => { stops += 1; }; };
  const key = workspaceListenerKey({authResolution: 'authenticated', userId: 'u1', ownerScope: 'owner', workspaceScope: 'owner'});

  assert.equal(lifecycle.update(key, start), true);
  assert.equal(lifecycle.update(key, start), false);
  assert.equal(starts, 1);
  assert.equal(stops, 0);
});

test('workspace switch cleans up the previous subscription set once', () => {
  const lifecycle = createSubscriptionLifecycle();
  const events: string[] = [];
  lifecycle.update('u1:owner:owner', () => { events.push('start:primary'); return () => events.push('stop:primary'); });
  lifecycle.update('u1:owner:owner__store__branch', () => { events.push('start:branch'); return () => events.push('stop:branch'); });
  assert.deepEqual(events, ['start:primary', 'stop:primary', 'start:branch']);
});

test('logout and disposal clean up active listeners without duplicate cleanup', () => {
  const lifecycle = createSubscriptionLifecycle();
  let stops = 0;
  lifecycle.update('u1:owner:owner', () => () => { stops += 1; });
  lifecycle.update(null, () => () => { stops += 1; });
  lifecycle.dispose();
  assert.equal(stops, 1);
  assert.equal(lifecycle.activeKey(), null);
});
