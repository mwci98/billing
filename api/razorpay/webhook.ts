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

async function createAndEmailCrmSubscriptionInvoice(event: any, subscription: any) {
  if (event.event !== 'subscription.charged') return;

  const endpoint = process.env.CRM_QPOS_WEBHOOK_URL;
  const apiKey = process.env.CRM_API_KEY;
  const sharedSecret = process.env.CRM_WEBHOOK_SECRET;
  if (!endpoint || !apiKey || !sharedSecret) {
    console.warn('QPOS CRM invoice integration is not configured; subscription invoice was not sent to CRM.');
    return;
  }

  const payment = event.payload?.payment?.entity;
  const paymentId = String(payment?.id || '');
  const amountPaise = Number(payment?.amount || subscription?.plan?.item?.amount || 0);
  const ownerEmail = String(subscription?.notes?.ownerEmail || '');
  if (!paymentId || !amountPaise || !ownerEmail) {
    console.warn('QPOS CRM invoice integration skipped because the Razorpay webhook payload is incomplete.');
    return;
  }

  const payload = {
    eventId: `${event.event}:${subscription.id}:${paymentId}`,
    subscriptionId: String(subscription.id),
    paymentId,
    tenantId: String(subscription.notes?.tenantId || ''),
    ownerEmail,
    ownerName: String(subscription.notes?.ownerName || ''),
    storeName: String(subscription.notes?.storeName || subscription.notes?.ownerName || ''),
    planName: 'QPOS Basic Annual Subscription',
    amountPaise,
    currency: String(payment?.currency || subscription?.plan?.item?.currency || 'INR'),
    paidAt: payment?.created_at ? new Date(payment.created_at * 1000).toISOString() : new Date().toISOString(),
  };
  const body = JSON.stringify(payload);
  const signature = createHmac('sha256', sharedSecret).update(body).digest('hex');
  const crmResponse = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'x-neospec-signature': signature,
    },
    body,
  });

  if (!crmResponse.ok) {
    throw new Error(`CRM subscription invoice request failed (${crmResponse.status}): ${await crmResponse.text()}`);
  }
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
      planTier: 'Basic',
      subscriptionStatus,
      razorpaySubscriptionId: subscription.id,
      subscriptionCurrentEnd: subscription.current_end
        ? new Date(subscription.current_end * 1000).toISOString()
        : null,
      subscriptionUpdatedAt: new Date().toISOString(),
    });
  }

  await createAndEmailCrmSubscriptionInvoice(event, subscription);

  return response.status(200).json({received: true});
}
