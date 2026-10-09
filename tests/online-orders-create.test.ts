import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/online-orders/create';
import {adminStoreAdapter} from '../src/server/adapters/store';

const response = () => ({statusCode: 0, body: undefined as any, status(code: number) { this.statusCode = code; return this; }, json(value: any) { this.body = value; return this; }});

test('online order creation rejects unsupported methods', async () => { const res = response(); await handler({method: 'GET'}, res); assert.equal(res.statusCode, 405); });
test('online order creation validates the customer phone', async () => { const res = response(); await handler({method: 'POST', body: {customerPhone: '123'}}, res); assert.equal(res.statusCode, 400); assert.equal(res.body.error, 'Enter a valid mobile number with country code'); });

test('online order creation writes an order through mocked Firestore', async () => {
  const writes: string[] = [];
  const product = {id: 'p1', name: 'Momo', sku: 'M1', itemType: 'Service', showOnline: true, sellingPrice: 200, taxRate: 0};
  const fakeRef = (path: string) => ({id: path.split('/').at(-1), path, get: async () => {
    if (path === 'public_stores/wow') return {exists: true, data: () => ({enabled: true, ownerScope: 'owner', locationId: 'primary-store'})};
    if (path.includes('store_settings/active')) return {exists: true, data: () => ({storeName: 'Test', onlineStore: {enabled: true, slug: 'wow', pickupEnabled: true, deliveryEnabled: false, paymentMethods: ['PAY_AT_STORE'], participatingLocationIds: ['primary-store']}})};
    if (path.includes('/products/p1')) return {exists: true, id: 'p1', data: () => product};
    return {exists: false, data: () => ({})};
  }});
  const fakeDb: any = {doc: fakeRef, runTransaction: async (fn: any) => fn({get: async (ref: any) => ref.get(), create: (ref: any) => writes.push(`create:${ref.path}`), set: (ref: any) => writes.push(`set:${ref.path}`), update: (ref: any) => writes.push(`update:${ref.path}`)})};
  adminStoreAdapter.setDbForTests(() => fakeDb);
  try {
    const res = response(); await handler({method: 'POST', body: {slug: 'wow', locationKey: 'main', idempotencyKey: 'idempotency-key-1234', customerName: 'A Customer', customerPhone: '+911234567890', fulfilment: 'PICKUP', paymentMethod: 'PAY_AT_STORE', items: [{productId: 'p1', quantity: 1}]}}, res);
    assert.equal(res.statusCode, 201); assert.match(res.body.orderId, /^ord-/); assert.match(res.body.orderNumber, /^ON-/); assert.equal(res.body.status, 'PENDING_CONFIRMATION'); assert.ok(writes.some(item => item.includes('online_orders')));
  } finally { adminStoreAdapter.reset(); }
});

const branchOrderBody = {
  slug: 'wow',
  locationKey: 'downtown',
  tableToken: 'table-token',
  idempotencyKey: 'branch-idempotency-key',
  customerName: 'A Customer',
  customerPhone: '+911234567890',
  fulfilment: 'PICKUP',
  paymentMethod: 'PAY_AT_STORE',
  items: [{productId: 'p1', quantity: 1}],
};

const runBranchTableOrder = async (tableMapping: Record<string, unknown>) => {
  const writes: string[] = [];
  const product = {id: 'p1', name: 'Momo', sku: 'M1', itemType: 'Service', showOnline: true, sellingPrice: 200, taxRate: 0};
  const fakeRef = (path: string) => ({id: path.split('/').at(-1), path, get: async () => {
    if (path === 'public_stores/wow') return {exists: true, data: () => ({enabled: true, ownerScope: 'owner', locationId: 'branch-1'})};
    if (path === 'users/owner/store_settings/active') return {exists: true, data: () => ({
      storeName: 'Test',
      storeBranches: [{id: 'branch-1', branchCode: 'downtown', name: 'Downtown', configuration: {onlineStore: {enabled: true, slug: 'wow', pickupEnabled: true, deliveryEnabled: false, paymentMethods: ['PAY_AT_STORE'], participatingLocationIds: ['branch-1']}}}],
    })};
    if (path === 'public_tables/table-token') return {exists: true, data: () => tableMapping};
    if (path.includes('/products/p1')) return {exists: true, id: 'p1', data: () => product};
    return {exists: false, data: () => ({})};
  }});
  const fakeDb: any = {doc: fakeRef, runTransaction: async (fn: any) => fn({get: async (ref: any) => ref.get(), create: (ref: any) => writes.push(`create:${ref.path}`), set: (ref: any) => writes.push(`set:${ref.path}`), update: (ref: any) => writes.push(`update:${ref.path}`)})};
  adminStoreAdapter.setDbForTests(() => fakeDb);
  try {
    const res = response();
    await handler({method: 'POST', body: branchOrderBody}, res);
    return {res, writes};
  } finally { adminStoreAdapter.reset(); }
};

const validBranchTableMapping = {
  active: true,
  slug: 'wow',
  locationKey: 'downtown',
  ownerScope: 'owner',
  workspaceScope: 'owner__store__branch-1',
  tableName: 'Table 7',
};

test('table QR order succeeds when branch owner and workspace scopes match', async () => {
  const {res, writes} = await runBranchTableOrder(validBranchTableMapping);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.status, 'PENDING_CONFIRMATION');
  assert.ok(writes.some(item => item.includes('users/owner__store__branch-1/online_orders')));
});

for (const [name, override] of [
  ['wrong workspace scope', {workspaceScope: 'owner__store__other'}],
  ['wrong owner scope', {ownerScope: 'another-owner'}],
  ['inactive mapping', {active: false}],
  ['wrong slug', {slug: 'another-store'}],
  ['wrong location key', {locationKey: 'uptown'}],
] as const) {
  test(`table QR order rejects ${name}`, async () => {
    const {res, writes} = await runBranchTableOrder({...validBranchTableMapping, ...override});
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'This table QR is no longer active');
    assert.equal(writes.length, 0);
  });
}
