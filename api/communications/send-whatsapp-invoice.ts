import {getWallet, verifyWalletAccess, walletDoc, WHATSAPP_INVOICE_PRICE_PAISE} from '../_whatsapp-wallet.js';

async function createSignature(body: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(signature)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') return response.status(405).json({error: 'Method not allowed'});

  const token = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return response.status(401).json({error: 'Sign in is required to send an invoice.'});

  const endpoint = process.env.CRM_QPOS_WHATSAPP_INVOICE_URL
    || process.env.CRM_QPOS_WEBHOOK_URL?.replace(/\/subscription-invoices$/, '/whatsapp-invoices');
  const apiKey = process.env.CRM_API_KEY;
  const secret = process.env.CRM_WEBHOOK_SECRET;
  if (!endpoint || !apiKey || !secret) {
    return response.status(503).json({error: 'WhatsApp invoice delivery is not activated for QPOS yet.'});
  }

  const payload = request.body || {};
  if (!payload.recipient || !payload.storeName || !payload.invoiceNumber || !payload.pdfBase64 || !payload.workspaceScope) {
    return response.status(400).json({error: 'Invoice, store, recipient, and PDF are required.'});
  }
  if (String(payload.pdfBase64).length > 12_000_000) {
    return response.status(413).json({error: 'Invoice PDF is too large to send through WhatsApp.'});
  }

  const body = JSON.stringify(payload);
  try {
    const access = await verifyWalletAccess(token, String(payload.workspaceScope));
    if (!access) return response.status(401).json({error: 'Your sign-in session has expired. Please sign in again.'});
    const wallet = await getWallet(access.db, access.workspaceScope);
    if (wallet.balancePaise < WHATSAPP_INVOICE_PRICE_PAISE) {
      return response.status(402).json({error: 'WhatsApp wallet balance is too low. Add credit in Store Config to send this invoice.'});
    }
    const crmResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'x-neospec-signature': await createSignature(body, secret),
      },
      body,
    });
    const result = await crmResponse.json().catch(() => ({}));
    if (!crmResponse.ok) {
      return response.status(crmResponse.status).json({error: result.error || 'CRM could not deliver the WhatsApp invoice.'});
    }
    const ledgerId = `${String(payload.invoiceNumber).replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}`;
    let remainingBalance = wallet.balancePaise;
    await access.db.runTransaction(async transaction => {
      const reference = walletDoc(access.db, access.workspaceScope);
      const snapshot = await transaction.get(reference);
      const current = snapshot.exists ? snapshot.data() as any : {};
      const balancePaise = Number(current.balancePaise || 0);
      if (balancePaise < WHATSAPP_INVOICE_PRICE_PAISE) throw new Error('Wallet balance is too low.');
      remainingBalance = balancePaise - WHATSAPP_INVOICE_PRICE_PAISE;
      transaction.set(reference, {
        balancePaise: remainingBalance,
        totalSpentPaise: Number(current.totalSpentPaise || 0) + WHATSAPP_INVOICE_PRICE_PAISE,
        updatedAt: new Date().toISOString(),
      }, {merge: true});
      transaction.set(access.db.doc(`users/${access.workspaceScope}/whatsapp_wallet/active/ledger/${ledgerId}`), {
        type: 'invoice_delivery', amountPaise: -WHATSAPP_INVOICE_PRICE_PAISE, invoiceNumber: payload.invoiceNumber,
        messageId: result.messageId || '', createdAt: new Date().toISOString(),
      });
    });
    return response.status(200).json({success: true, messageId: result.messageId, remainingBalance});
  } catch (error) {
    console.error('QPOS WhatsApp invoice handoff failed:', error);
    return response.status(502).json({error: 'Could not reach the CRM WhatsApp service.'});
  }
}
