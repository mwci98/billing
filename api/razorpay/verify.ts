import {createHmac, timingSafeEqual} from 'node:crypto';
import {subscriptionAdapter} from '../../src/server/adapters/subscription.js';
import {authorizePaymentWorkspace} from '../../src/server/adapters/payment-auth.js';
import {razorpayLookup} from '../../src/server/adapters/razorpay.js';
import {processPaymentOnce} from '../../src/server/adapters/payment-idempotency.js';

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    return response.status(405).json({error: 'Method not allowed'});
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  const {
    tenantId,
    razorpayPaymentId,
    razorpaySubscriptionId,
    razorpaySignature,
  } = request.body || {};

  if (!secret || !tenantId || !razorpayPaymentId || !razorpaySubscriptionId || !razorpaySignature) {
    return response.status(400).json({error: 'Incomplete payment verification data.'});
  }
  let identity;
  try { identity = await authorizePaymentWorkspace(request, tenantId); }
  catch (error) { return response.status(error instanceof Error && error.message === 'WORKSPACE_FORBIDDEN' ? 403 : 401).json({error: error instanceof Error && error.message === 'WORKSPACE_FORBIDDEN' ? 'You do not have access to this workspace.' : 'Sign in is required.'}); }

  const expected = createHmac('sha256', secret)
    .update(`${razorpayPaymentId}|${razorpaySubscriptionId}`)
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
    const subscription = await razorpayLookup.subscription(razorpaySubscriptionId);
    if (subscription.plan_id !== process.env.RAZORPAY_BASIC_PLAN_ID || !['active','authenticated','completed'].includes(String(subscription.status)) || String(subscription.notes?.tenantId) !== identity.tenantId) return response.status(409).json({error: 'The Razorpay subscription does not match this workspace.'});
  } catch (error) { return response.status(error instanceof Error && error.message === 'RAZORPAY_NOT_CONFIGURED' ? 503 : 502).json({error: 'Could not verify the Razorpay subscription.'}); }

  const activatedAt = new Date().toISOString();
  const processed = await processPaymentOnce(`subscription:${identity.tenantId}:${razorpaySubscriptionId}`, {
    providerPaymentId: razorpayPaymentId,
    providerSubscriptionId: razorpaySubscriptionId,
    tenantId: identity.tenantId,
    operation: 'subscription_activation',
    processedAt: activatedAt,
  }, async () => {
    await subscriptionAdapter.update(identity.tenantId, {
      planTier: 'Basic',
      subscriptionStatus: 'active',
      razorpaySubscriptionId,
      subscriptionActivatedAt: activatedAt,
    });
  });

  return response.status(200).json({
    verified: true,
    subscriptionStatus: 'active',
    razorpaySubscriptionId,
    activatedAt,
    ...(processed.duplicate ? {idempotent: true} : {}),
  });
}
