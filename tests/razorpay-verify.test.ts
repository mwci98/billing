import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {afterEach, beforeEach, test} from 'node:test';
import handler from '../api/razorpay/verify';
import {subscriptionAdapter} from '../src/server/adapters/subscription';
import {setAuthForTests, resetAuthForTests} from '../api/_online-store';
import {adminStoreAdapter} from '../src/server/adapters/store';
import {setRazorpayLookupForTests, resetRazorpayLookupForTests} from '../src/server/adapters/razorpay';

const tenantId = 'owner_example_test';
const paymentId = 'pay_test';
const subscriptionId = 'sub_test';
const planId = 'plan_test';
const secret = 'test-secret';
const response = () => ({statusCode: 0, body: undefined as any, status(code: number) { this.statusCode = code; return this; }, json(value: any) { this.body = value; return this; }});
const request = () => ({method: 'POST', headers: {authorization: 'Bearer test-token'}, body: {
  tenantId, razorpayPaymentId: paymentId, razorpaySubscriptionId: subscriptionId,
  razorpaySignature: createHmac('sha256', secret).update(paymentId + '|' + subscriptionId).digest('hex'),
}});
let subscription: any;
let lookups: string[];
let updates: Array<{tenant: string; value: Record<string, unknown>}>;
let unexpectedNetwork: number;
let oldFetch: typeof fetch;
let oldSecret: string | undefined;
let oldPlan: string | undefined;
let processedKeys: Set<string>;

beforeEach(() => {
  oldSecret = process.env.RAZORPAY_KEY_SECRET;
  oldPlan = process.env.RAZORPAY_BASIC_PLAN_ID;
  process.env.RAZORPAY_KEY_SECRET = secret;
  process.env.RAZORPAY_BASIC_PLAN_ID = planId;
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
  subscription = {id: subscriptionId, plan_id: planId, status: 'active', notes: {tenantId}};
  lookups = [];
  updates = [];
  subscriptionAdapter.setUpdaterForTests(async (tenant, value) => { updates.push({tenant, value}); });
  setRazorpayLookupForTests({
    subscription: async id => { lookups.push(id); assert.equal(id, subscriptionId); return subscription; },
    payment: async () => { assert.fail('Current subscription flow does not fetch a payment'); },
    order: async () => { assert.fail('Current subscription flow does not fetch an order'); },
  });
});
afterEach(() => {
  globalThis.fetch = oldFetch;
  resetAuthForTests();
  adminStoreAdapter.reset();
  subscriptionAdapter.reset();
  resetRazorpayLookupForTests();
  if (oldSecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
  else process.env.RAZORPAY_KEY_SECRET = oldSecret;
  if (oldPlan === undefined) delete process.env.RAZORPAY_BASIC_PLAN_ID;
  else process.env.RAZORPAY_BASIC_PLAN_ID = oldPlan;
  assert.equal(unexpectedNetwork, 0);
});
test('subscription verification rejects unsupported methods and incomplete input', async () => {
  const method = response();
  await handler({method: 'GET'}, method);
  assert.equal(method.statusCode, 405);
  assert.deepEqual(method.body, {error: 'Method not allowed'});
  const missing = response();
  await handler({...request(), body: {}}, missing);
  assert.equal(missing.statusCode, 400);
  assert.deepEqual(missing.body, {error: 'Incomplete payment verification data.'});
  assert.deepEqual(lookups, []);
  assert.deepEqual(updates, []);
});
for (const invalidAuth of ['missing', 'invalid']) {
  test('subscription verification rejects ' + invalidAuth + ' authentication before lookup', async () => {
    const req = request();
    if (invalidAuth === 'missing') req.headers.authorization = '';
    else setAuthForTests(() => ({verifyIdToken: async () => { throw new Error('Invalid token'); }}) as any);
    const res = response();
    await handler(req, res);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, {error: 'Sign in is required.'});
    assert.deepEqual(lookups, []);
    assert.deepEqual(updates, []);
  });
}
test('subscription verification rejects invalid HMAC before lookup or persistence', async () => {
  const req = request();
  req.body.razorpaySignature = 'invalid';
  const res = response();
  await handler(req, res);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, {error: 'Invalid Razorpay payment signature.'});
  assert.deepEqual(lookups, []);
  assert.deepEqual(updates, []);
});
for (const providerTenant of [tenantId, 'other-tenant']) {
  test('subscription verification rejects cross-tenant request when provider tenant is ' + providerTenant, async () => {
    const req = request();
    req.body.tenantId = 'other-tenant';
    subscription.notes.tenantId = providerTenant;
    const res = response();
    await handler(req, res);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, {error: 'You do not have access to this workspace.'});
    assert.deepEqual(lookups, []);
    assert.deepEqual(updates, []);
  });
}
// Approved contract change: activation now also requires provider plan and tenant validation.
test('subscription verification activates authenticated valid provider subscription', async () => {
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(lookups, [subscriptionId]);
  assert.equal(updates.length, 1);
  assert.deepEqual(res.body, {verified: true, subscriptionStatus: 'active', razorpaySubscriptionId: subscriptionId, activatedAt: updates[0].value.subscriptionActivatedAt});
  assert.deepEqual(updates[0], {tenant: tenantId, value: {
    planTier: 'Basic', subscriptionStatus: 'active', razorpaySubscriptionId: subscriptionId,
    subscriptionActivatedAt: res.body.activatedAt,
  }});
  assert.equal(typeof res.body.activatedAt, 'string');
  assert.ok(Number.isFinite(Date.parse(String(res.body.activatedAt))));
});
test('subscription verification is idempotent for the same provider subscription', async () => {
  const first = response();
  await handler(request(), first);
  const second = response();
  await handler(request(), second);
  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(second.body.idempotent, true);
  assert.equal(updates.length, 1);
  assert.equal(processedKeys.size, 1);
});
const mismatches: Array<[string, () => void]> = [
  ['plan', () => { subscription.plan_id = 'plan_other'; }],
  ['tenant', () => { subscription.notes.tenantId = 'other-tenant'; }],
  ['missing tenant metadata', () => { subscription.notes = {}; }],
  ['provider status', () => { subscription.status = 'cancelled'; }],
];
for (const [name, change] of mismatches) {
  test('subscription verification rejects mismatched ' + name + ' despite client claims', async () => {
    change();
    const req = request();
    const res = response();
    await handler({...req, body: {...req.body, plan_id: planId, status: 'active', notes: {tenantId}}}, res);
    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.body, {error: 'The Razorpay subscription does not match this workspace.'});
    assert.deepEqual(updates, []);
  });
}
test('subscription verification rejects unknown subscription without persistence', async () => {
  setRazorpayLookupForTests({subscription: async () => { throw new Error('RAZORPAY_LOOKUP_FAILED'); }});
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.body, {error: 'Could not verify the Razorpay subscription.'});
  assert.deepEqual(updates, []);
});
test('subscription verification handles provider transport failure without persistence', async () => {
  setRazorpayLookupForTests({subscription: async () => { throw new Error('Mock provider unavailable'); }});
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.body, {error: 'Could not verify the Razorpay subscription.'});
  assert.deepEqual(updates, []);
});
test('subscription verification handles unavailable provider configuration without persistence', async () => {
  setRazorpayLookupForTests({subscription: async () => { throw new Error('RAZORPAY_NOT_CONFIGURED'); }});
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, {error: 'Could not verify the Razorpay subscription.'});
  assert.deepEqual(updates, []);
});
