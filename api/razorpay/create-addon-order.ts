const ADDITIONAL_STORE_PRICE_PAISE = 50000;

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    return response.status(405).json({error: 'Method not allowed'});
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return response.status(503).json({
      error: 'Razorpay is not configured yet.',
    });
  }

  const {tenantId, email} = request.body || {};
  if (!tenantId || !email) {
    return response.status(400).json({error: 'Tenant and owner email are required.'});
  }

  const authorization = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authorization}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: ADDITIONAL_STORE_PRICE_PAISE,
      currency: 'INR',
      receipt: `store_${Date.now()}`,
      notes: {
        tenantId,
        ownerEmail: email,
        purchaseType: 'additional_store',
      },
    }),
  });

  const body = await razorpayResponse.text();
  let payload: any = {};
  try {
    payload = body ? JSON.parse(body) : {};
  } catch {
    return response.status(502).json({error: 'Razorpay returned an invalid response.'});
  }

  if (!razorpayResponse.ok) {
    return response.status(razorpayResponse.status).json({
      error: payload?.error?.description || 'Unable to create the add-on payment.',
    });
  }

  return response.status(200).json({
    keyId,
    orderId: payload.id,
    amount: ADDITIONAL_STORE_PRICE_PAISE,
    currency: 'INR',
  });
}
