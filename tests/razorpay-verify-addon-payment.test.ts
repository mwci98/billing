import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import test from 'node:test';
import handler from '../api/razorpay/verify-addon-payment';

const response = () => ({statusCode: 0, body: undefined as any, status(code: number) { this.statusCode = code; return this; }, json(value: any) { this.body = value; return this; }});

test('Razorpay add-on verification rejects unsupported methods', async () => {
  const res = response();
  await handler({method: 'GET'}, res);
  assert.equal(res.statusCode, 405);
});

test('Razorpay add-on verification rejects incomplete data', async () => {
  const previous = process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_KEY_SECRET = 'test-secret';
  const res = response();
  await handler({method: 'POST', body: {}}, res);
  if (previous === undefined) delete process.env.RAZORPAY_KEY_SECRET; else process.env.RAZORPAY_KEY_SECRET = previous;
  assert.equal(res.statusCode, 400);
});

test('Razorpay add-on verification rejects an invalid signature', async () => {
  const previous = process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_KEY_SECRET = 'test-secret';
  const res = response();
  await handler({method: 'POST', body: {razorpayOrderId: 'test_order_id', razorpayPaymentId: 'test_payment_id', razorpaySignature: 'invalid'}}, res);
  if (previous === undefined) delete process.env.RAZORPAY_KEY_SECRET; else process.env.RAZORPAY_KEY_SECRET = previous;
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, {error: 'Invalid Razorpay payment signature.'});
});

test('Razorpay add-on verification accepts a valid signature without network calls', async () => {
  const previous = process.env.RAZORPAY_KEY_SECRET;
  const previousFetch = globalThis.fetch;
  process.env.RAZORPAY_KEY_SECRET = 'test-secret';
  let fetchCalled = false;
  globalThis.fetch = (async () => { fetchCalled = true; throw new Error('network must not be called'); }) as any;
  const orderId = 'test_order_id';
  const paymentId = 'test_payment_id';
  const signature = createHmac('sha256', 'test-secret').update(`${orderId}|${paymentId}`).digest('hex');
  try {
    const res = response();
    await handler({method: 'POST', body: {razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: signature}}, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {verified: true, razorpayPaymentId: paymentId});
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = previousFetch;
    if (previous === undefined) delete process.env.RAZORPAY_KEY_SECRET; else process.env.RAZORPAY_KEY_SECRET = previous;
  }
});
