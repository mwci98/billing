import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/online-orders/status';
import {adminStoreAdapter} from '../src/server/adapters/store';

const response = () => ({statusCode: 0, body: undefined as any, headers: {} as Record<string, string>, status(code: number) { this.statusCode = code; return this; }, json(value: any) { this.body = value; return this; }, setHeader(name: string, value: string) { this.headers[name] = value; }});

test('online order status rejects unsupported methods', async () => {
  const res = response();
  await handler({method: 'POST'}, res);
  assert.equal(res.statusCode, 405);
  assert.deepEqual(res.body, {error: 'Method not allowed'});
});

test('online order status rejects malformed tracking tokens', async () => {
  const res = response();
  await handler({method: 'GET', query: {token: 'short'}}, res);
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, {error: 'Order not found'});
});

test('online order status returns the current order receipt', async () => {
  const token = 'tracking-token-1234567890';
  const fakeDb: any = {doc: (path: string) => ({get: async () => path.startsWith('public_order_receipts/')
    ? {exists: true, data: () => ({workspaceScope: 'owner', orderId: 'ord-1', expiresAt: Date.now() + 60_000})}
    : {exists: true, data: () => ({orderNumber: 'ON-100', status: 'READY', locationName: 'Main', fulfilment: 'PICKUP', total: 250, updatedAt: '2026-01-01T00:00:00.000Z'})}})};
  adminStoreAdapter.setDbForTests(() => fakeDb);
  try {
    const res = response();
    await handler({method: 'GET', query: {token}}, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {orderNumber: 'ON-100', status: 'READY', locationName: 'Main', fulfilment: 'PICKUP', total: 250, updatedAt: '2026-01-01T00:00:00.000Z'});
    assert.equal(res.headers['Cache-Control'], 'private, no-store');
  } finally { adminStoreAdapter.reset(); }
});
