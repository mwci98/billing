import {createHmac, timingSafeEqual} from 'node:crypto';
import {updateTenantSubscription} from '../_firebase-admin';

export const config = {
  api: {bodyParser: false},
};

async function readRawBody(request: any) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    return response.status(405).json({error: 'Method not allowed'});
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return response.status(503).json({error: 'Webhook secret is not configured.'});
  }

  const rawBody = await readRawBody(request);
  const receivedSignature = String(request.headers['x-razorpay-signature'] || '');
  const expectedSignature = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(receivedSignature);

  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    return response.status(401).json({error: 'Invalid webhook signature.'});
  }

  const event = JSON.parse(rawBody.toString('utf8'));
  const subscription = event.payload?.subscription?.entity;
  const tenantId = subscription?.notes?.tenantId;
  if (!tenantId) return response.status(200).json({received: true});

  const statusByEvent: Record<string, string> = {
    'subscription.activated': 'active',
    'subscription.charged': 'active',
    'subscription.pending': 'past_due',
    'subscription.halted': 'past_due',
    'subscription.cancelled': 'cancelled',
    'subscription.completed': 'expired',
  };
  const subscriptionStatus = statusByEvent[event.event];
  if (subscriptionStatus) {
    await updateTenantSubscription(tenantId, {
      planTier: 'Pro',
      subscriptionStatus,
      razorpaySubscriptionId: subscription.id,
      subscriptionCurrentEnd: subscription.current_end
        ? new Date(subscription.current_end * 1000).toISOString()
        : null,
      subscriptionUpdatedAt: new Date().toISOString(),
    });
  }

  return response.status(200).json({received: true});
}
