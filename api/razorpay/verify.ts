import {createHmac, timingSafeEqual} from 'node:crypto';
import {updateTenantSubscription} from '../_firebase-admin';

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

  const activatedAt = new Date().toISOString();
  await updateTenantSubscription(tenantId, {
    planTier: 'Basic',
    subscriptionStatus: 'active',
    razorpaySubscriptionId,
    subscriptionActivatedAt: activatedAt,
  });

  return response.status(200).json({
    verified: true,
    subscriptionStatus: 'active',
    razorpaySubscriptionId,
    activatedAt,
  });
}
