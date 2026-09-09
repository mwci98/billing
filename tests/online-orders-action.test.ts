import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/online-orders/action';
import {adminStoreAdapter} from '../src/server/adapters/store';
import {resetAuthForTests, setAuthForTests} from '../api/_online-store';

const response = () => ({statusCode: 0, body: undefined as any, status(code: number) { this.statusCode = code; return this; }, json(value: any) { this.body = value; return this; }});
test('online order action rejects missing authentication', async () => { const res = response(); await handler({method: 'POST', headers: {}, body: {}}, res); assert.equal(res.statusCode, 401); assert.equal(res.body.error, 'Sign in with Google to manage online orders'); });
test('online order action rejects invalid actions', async () => { setAuthForTests(() => ({verifyIdToken: async () => ({uid: 'u1', email: 'owner@example.com'})}) as any); const res = response(); await handler({method: 'POST', headers: {authorization: 'Bearer test'}, body: {workspaceScope: 'owner', orderId: 'ord-1', action: 'NOPE'}}, res); resetAuthForTests(); assert.equal(res.statusCode, 400); assert.equal(res.body.error, 'Invalid order action'); });

test('online order action accepts a pending order through mocked transaction', async () => {
  const writes: string[] = []; const orderRef: any = {path: 'users/owner/online_orders/ord-1', get: async () => ({exists: true, data: () => ({status: 'PENDING_CONFIRMATION', orderNumber: 'ON-1', customerPhone: '+911234567890', items: [], auditTrail: []})})};
  const fakeDb: any = {doc: (path: string) => path === orderRef.path ? orderRef : {path, get: async () => ({exists: true, data: () => ({email: 'owner@example.com'})})}, runTransaction: async (fn: any) => fn({get: async (ref: any) => ref.get(), update: (ref: any, value: any) => writes.push(`update:${ref.path}:${value.status}`), set: () => writes.push('set'), create: () => writes.push('create')})};
  setAuthForTests(() => ({verifyIdToken: async () => ({uid: 'u1', email: 'owner@example.com'})}) as any); adminStoreAdapter.setDbForTests(() => fakeDb);
  try { const res = response(); await handler({method: 'POST', headers: {authorization: 'Bearer test'}, body: {workspaceScope: 'owner', orderId: 'ord-1', action: 'ACCEPT'}}, res); assert.equal(res.statusCode, 200); assert.equal(res.body.status, 'ACCEPTED'); assert.ok(writes.some(item => item.includes('ACCEPTED'))); } finally { adminStoreAdapter.reset(); resetAuthForTests(); }
});
