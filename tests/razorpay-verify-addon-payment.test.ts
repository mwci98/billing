import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {afterEach, beforeEach, test} from 'node:test';
import handler from '../api/razorpay/verify-addon-payment';
import {setAuthForTests, resetAuthForTests} from '../api/_online-store';
import {adminStoreAdapter} from '../src/server/adapters/store';
import {setRazorpayLookupForTests, resetRazorpayLookupForTests} from '../src/server/adapters/razorpay';

const tenantId = 'owner_example_test';
const orderId = 'order_test';
const paymentId = 'pay_test';
const secret = 'test-secret';
const response = () => ({statusCode: 0, body: undefined as any, status(code: number) { this.statusCode = code; return this; }, json(value: any) { this.body = value; return this; }});
const request = () => ({method: 'POST', headers: {authorization: 'Bearer test-token'}, body: {
  tenantId, razorpayOrderId: orderId, razorpayPaymentId: paymentId,
  razorpaySignature: createHmac('sha256', secret).update(orderId + '|' + paymentId).digest('hex'),
}});
let order: any;
let payment: any;
let lookups: string[];
let unexpectedNetwork: number;
let oldFetch: typeof fetch;
let oldSecret: string | undefined;
let processedKeys: Set<string>;

beforeEach(() => {
  oldSecret = process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_KEY_SECRET = secret;
  oldFetch = globalThis.fetch;
  unexpectedNetwork = 0;
  processedKeys = new Set();
  globalThis.fetch = async () => { unexpectedNetwork++; throw new Error('Unexpected network access'); };
  setAuthForTests(() => ({verifyIdToken: async (token: string) => {
    assert.equal(token, 'test-token');
    return {uid: 'owner-test', email: 'owner@example.test'};
  }}) as any);
  adminStoreAdapter.setDbForTests(() => ({doc: (path: string) => {
    if (path.startsWith('payment_idempotency/')) return {path};
    assert.equal(path, 'users/' + tenantId + '/store_settings/active');
    return {get: async () => ({data: () => ({tenantId})})};
  }, runTransaction: async (fn: any) => fn({get: async (ref: any) => ({exists: processedKeys.has(ref.path)}), create: (ref: any) => { processedKeys.add(ref.path); }})}) as any);
  order = {id: orderId, amount: 50000, currency: 'INR', notes: {purchaseType: 'additional_store', tenantId}};
  payment = {id: paymentId, order_id: orderId, amount: 50000, currency: 'INR', status: 'captured'};
  lookups = [];
  setRazorpayLookupForTests({
    order: async id => { lookups.push('order:' + id); assert.equal(id, orderId); return order; },
    payment: async id => { lookups.push('payment:' + id); assert.equal(id, paymentId); return payment; },
    subscription: async () => { assert.fail('Unexpected subscription lookup'); },
  });
});
afterEach(() => {
  globalThis.fetch = oldFetch;
  resetAuthForTests();
  adminStoreAdapter.reset();
  resetRazorpayLookupForTests();
  if (oldSecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
  else process.env.RAZORPAY_KEY_SECRET = oldSecret;
  assert.equal(unexpectedNetwork, 0);
});
test('add-on verification rejects unsupported methods', async () => {
  const res = response();
  await handler({method: 'GET'}, res);
  assert.equal(res.statusCode, 405);
  assert.deepEqual(res.body, {error: 'Method not allowed'});
  assert.deepEqual(lookups, []);
});
test('add-on verification rejects incomplete input', async () => {
  const res = response();
  await handler({...request(), body: {}}, res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {error: 'Incomplete add-on payment verification data.'});
  assert.deepEqual(lookups, []);
});
for (const invalidAuth of ['missing', 'invalid']) {
  test('add-on verification rejects ' + invalidAuth + ' authentication before lookup', async () => {
    const req = request();
    if (invalidAuth === 'missing') req.headers.authorization = '';
    else setAuthForTests(() => ({verifyIdToken: async () => { throw new Error('Invalid token'); }}) as any);
    const res = response();
    await handler(req, res);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, {error: 'Sign in is required.'});
    assert.deepEqual(lookups, []);
  });
}
test('add-on verification rejects cross-tenant requests before lookup', async () => {
  const req = request();
  req.body.tenantId = 'other-tenant';
  const res = response();
  await handler(req, res);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {error: 'You do not have access to this workspace.'});
  assert.deepEqual(lookups, []);
});
test('add-on verification rejects invalid HMAC before lookup', async () => {
  const req = request();
  req.body.razorpaySignature = 'invalid';
  const res = response();
  await handler(req, res);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, {error: 'Invalid Razorpay payment signature.'});
  assert.deepEqual(lookups, []);
});
// Approved contract change: success requires authoritative provider objects.
test('add-on verification accepts authenticated valid provider state without live network', async () => {
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {verified: true, razorpayPaymentId: paymentId});
  assert.deepEqual(lookups, ['order:' + orderId, 'payment:' + paymentId]);
});
test('add-on verification is idempotent for the same provider payment', async () => {
  const first = response();
  await handler(request(), first);
  const second = response();
  await handler(request(), second);
  assert.equal(first.statusCode, 200);
  assert.deepEqual(first.body, {verified: true, razorpayPaymentId: paymentId});
  assert.equal(second.statusCode, 200);
  assert.deepEqual(second.body, {verified: true, razorpayPaymentId: paymentId, idempotent: true});
  assert.equal(processedKeys.size, 1);
});
const mismatches: Array<[string, () => void]> = [
  ['payment/order relationship', () => { payment.order_id = 'order_other'; }],
  ['order amount', () => { order.amount = 100; }],
  ['payment amount', () => { payment.amount = 100; }],
  ['order currency', () => { order.currency = 'USD'; }],
  ['payment currency', () => { payment.currency = 'USD'; }],
  ['purchase type', () => { order.notes.purchaseType = 'whatsapp_wallet'; }],
  ['provider tenant', () => { order.notes.tenantId = 'other-tenant'; }],
  ['missing ownership metadata', () => { order.notes = {}; }],
  ['payment status', () => { payment.status = 'failed'; }],
];
for (const [name, change] of mismatches) {
  test('add-on verification rejects mismatched ' + name + ' despite client claims', async () => {
    change();
    const req = request();
    const res = response();
    await handler({...req, body: {...req.body, amount: 50000, currency: 'INR', purchaseType: 'additional_store', status: 'captured', notes: {tenantId}}}, res);
    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.body, {error: 'The Razorpay payment does not match this add-on.'});
  });
}
for (const resource of ['order', 'payment'] as const) {
  test('add-on verification rejects unknown ' + resource, async () => {
    setRazorpayLookupForTests({[resource]: async () => { throw new Error('RAZORPAY_LOOKUP_FAILED'); }});
    const res = response();
    await handler(request(), res);
    assert.equal(res.statusCode, 502);
    assert.deepEqual(res.body, {error: 'Could not verify the Razorpay payment.'});
  });
}
test('add-on verification handles provider transport failure', async () => {
  setRazorpayLookupForTests({order: async () => { throw new Error('Mock provider unavailable'); }});
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.body, {error: 'Could not verify the Razorpay payment.'});
});
test('add-on verification handles unavailable provider configuration', async () => {
  setRazorpayLookupForTests({order: async () => { throw new Error('RAZORPAY_NOT_CONFIGURED'); }});
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, {error: 'Could not verify the Razorpay payment.'});
});
