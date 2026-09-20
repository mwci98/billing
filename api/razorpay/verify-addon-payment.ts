import {createHmac, timingSafeEqual} from 'node:crypto';
import {authorizePaymentWorkspace} from '../../src/server/adapters/payment-auth.js';
import {razorpayLookup} from '../../src/server/adapters/razorpay.js';
import {processPaymentOnce} from '../../src/server/adapters/payment-idempotency.js';

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    return response.status(405).json({error: 'Method not allowed'});
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  const {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  } = request.body || {};

  if (!secret || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return response.status(400).json({error: 'Incomplete add-on payment verification data.'});
  }
  let identity;
  try { identity = await authorizePaymentWorkspace(request, String(request.body?.tenantId || '')); }
  catch (error) { return response.status(error instanceof Error && error.message === 'WORKSPACE_FORBIDDEN' ? 403 : 401).json({error: error instanceof Error && error.message === 'WORKSPACE_FORBIDDEN' ? 'You do not have access to this workspace.' : 'Sign in is required.'}); }

  const expected = createHmac('sha256', secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(String(razorpaySignature));

  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    return response.status(401).json({error: 'Invalid Razorpay payment signature.'});
  }

  try {
    const order = await razorpayLookup.order(razorpayOrderId);
    const payment = await razorpayLookup.payment(razorpayPaymentId);
    if (payment.order_id !== razorpayOrderId || Number(order.amount) !== 50000 || String(order.currency) !== 'INR' || order.notes?.purchaseType !== 'additional_store' || String(order.notes?.tenantId) !== identity.tenantId || !['captured','authorized'].includes(String(payment.status)) || Number(payment.amount) !== 50000 || String(payment.currency) !== 'INR') return response.status(409).json({error: 'The Razorpay payment does not match this add-on.'});
  } catch (error) { return response.status(error instanceof Error && error.message === 'RAZORPAY_NOT_CONFIGURED' ? 503 : 502).json({error: 'Could not verify the Razorpay payment.'}); }

  const processed = await processPaymentOnce(`addon:${identity.tenantId}:${razorpayPaymentId}`, {
    providerPaymentId: razorpayPaymentId,
    providerOrderId: razorpayOrderId,
    tenantId: identity.tenantId,
    operation: 'additional_store',
    processedAt: new Date().toISOString(),
  }, async () => undefined);

  return response.status(200).json({
    verified: true,
    razorpayPaymentId,
    ...(processed.duplicate ? {idempotent: true} : {}),
  });
}
