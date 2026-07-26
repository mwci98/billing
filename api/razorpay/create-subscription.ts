const RAZORPAY_PLAN_ID = 'plan_TIA4ucA1UJe67v';

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    return response.status(405).json({error: 'Method not allowed'});
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return response.status(503).json({
      error: 'Razorpay is not configured yet. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Vercel.',
    });
  }

  const {tenantId, email, name} = request.body || {};
  if (!tenantId || !email) {
    return response.status(400).json({error: 'Tenant and owner email are required.'});
  }

  const authorization = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const razorpayResponse = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authorization}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      plan_id: RAZORPAY_PLAN_ID,
      total_count: 10,
      quantity: 1,
      customer_notify: 1,
      notes: {
        tenantId,
        ownerEmail: email,
        ownerName: name || '',
        planTier: 'Basic',
      },
    }),
  });

  const razorpayBody = await razorpayResponse.text();
  let payload: any = {};
  try {
    payload = razorpayBody ? JSON.parse(razorpayBody) : {};
  } catch {
    return response.status(502).json({
      error: 'Razorpay returned an invalid response. Please try again.',
    });
  }
  if (!razorpayResponse.ok) {
    return response.status(razorpayResponse.status).json({
      error: payload?.error?.description || 'Unable to create Razorpay subscription.',
    });
  }

  return response.status(200).json({
    keyId,
    subscriptionId: payload.id,
    planId: RAZORPAY_PLAN_ID,
  });
}
