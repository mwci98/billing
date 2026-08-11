import {timingSafeEqual, createHmac} from 'node:crypto';
import {getWallet, verifyWalletAccess, walletDoc} from '../_whatsapp-wallet';

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') return response.status(405).json({error: 'Method not allowed'});
  const idToken = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const {workspaceScope, razorpayOrderId, razorpayPaymentId, razorpaySignature} = request.body || {};
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) return response.status(400).json({error: 'Incomplete wallet payment verification.'});

  try {
    const access = await verifyWalletAccess(idToken, String(workspaceScope || ''));
    if (!access) return response.status(401).json({error: 'Sign in is required to verify this wallet payment.'});
    const expected = createHmac('sha256', secret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
    const received = Buffer.from(String(razorpaySignature));
    const expectedBuffer = Buffer.from(expected);
    if (received.length !== expectedBuffer.length || !timingSafeEqual(received, expectedBuffer)) return response.status(401).json({error: 'Invalid Razorpay payment signature.'});
    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keyId) return response.status(503).json({error: 'Razorpay is not configured yet.'});
    const orderResponse = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(razorpayOrderId)}`, {
      headers: {Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString('base64')}`},
    });
    const order = await orderResponse.json().catch(() => ({}));
    const amount = Number(order.amount || 0);
    if (!orderResponse.ok || order.notes?.purchaseType !== 'whatsapp_wallet' || order.notes?.workspaceScope !== access.workspaceScope || ![10000, 20000, 50000].includes(amount)) {
      return response.status(400).json({error: 'This Razorpay order is not a valid wallet top-up.'});
    }
    const reference = access.db.doc(`users/${access.workspaceScope}/whatsapp_wallet/ledger/${razorpayPaymentId}`);
    await access.db.runTransaction(async transaction => {
      const existing = await transaction.get(reference);
      if (existing.exists) return;
      const walletReference = walletDoc(access.db, access.workspaceScope);
      const walletSnapshot = await transaction.get(walletReference);
      const wallet = walletSnapshot.exists ? walletSnapshot.data() as any : {};
      transaction.set(walletReference, {balancePaise: Number(wallet.balancePaise || 0) + amount, totalSpentPaise: Number(wallet.totalSpentPaise || 0), updatedAt: new Date().toISOString()}, {merge: true});
      transaction.set(reference, {type: 'credit', amountPaise: amount, paymentId: razorpayPaymentId, createdAt: new Date().toISOString()});
    });
    const wallet = await getWallet(access.db, access.workspaceScope);
    return response.status(200).json({verified: true, ...wallet});
  } catch (error) {
    console.error('WhatsApp wallet payment verification failed:', error);
    return response.status(500).json({error: error instanceof Error ? error.message : 'Could not verify the wallet top-up.'});
  }
}
