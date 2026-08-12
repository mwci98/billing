import {verifyWalletAccess} from '../_whatsapp-wallet.js';

const ALLOWED_AMOUNTS = new Set([10000, 20000, 50000]);

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') return response.status(405).json({error: 'Method not allowed'});
  const idToken = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const firebaseApiKey = String(request.headers['x-firebase-api-key'] || '');
  const {workspaceScope, amountPaise} = request.body || {};
  const amount = Number(amountPaise);
  if (!ALLOWED_AMOUNTS.has(amount)) return response.status(400).json({error: 'Choose a valid wallet top-up amount.'});
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return response.status(503).json({error: 'Razorpay is not configured yet.'});

  try {
    const access = await verifyWalletAccess(idToken, String(workspaceScope || ''), firebaseApiKey);
    if (!access) return response.status(401).json({error: 'Sign in is required to top up this wallet.'});
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const result = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST', headers: {Authorization: `Basic ${auth}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({amount, currency: 'INR', receipt: `wa_${Date.now()}`, notes: {purchaseType: 'whatsapp_wallet', workspaceScope: access.workspaceScope, ownerEmail: access.email}}),
    });
    const body = await result.json().catch(() => ({}));
    if (!result.ok) return response.status(result.status).json({error: body?.error?.description || 'Could not create the wallet order.'});
    return response.status(200).json({keyId, orderId: body.id, amount, currency: 'INR'});
  } catch (error) {
    console.error('WhatsApp wallet order failed:', error);
    return response.status(503).json({error: error instanceof Error ? error.message : 'Could not start the wallet top-up.'});
  }
}
