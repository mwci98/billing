import {verifyWalletAccess, WHATSAPP_INVOICE_PRICE_PAISE} from '../_whatsapp-wallet.js';
import {reserveDebit, completeDebit, releaseDebit, markHandoffUnknown} from '../../src/server/adapters/whatsapp-debit.js';

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
  const firebaseApiKey = String(request.headers['x-firebase-api-key'] || '');
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
    const access = await verifyWalletAccess(token, String(payload.workspaceScope), firebaseApiKey);
    if (!access) return response.status(401).json({error: 'Your sign-in session has expired. Please sign in again.'});
    let reservation: any;
    try { reservation = await reserveDebit(access.db, access.workspaceScope, String(payload.invoiceNumber)); }
    catch (error) { if (error instanceof Error && error.message === 'WALLET_INSUFFICIENT') return response.status(402).json({error: 'WhatsApp wallet balance is too low. Add credit in Store Config to send this invoice.'}); throw error; }
    if (reservation.state === 'completed') return response.status(200).json({success: true, messageId: reservation.messageId, remainingBalance: reservation.remainingBalance});
    if (!reservation.fresh && (reservation.state === 'reserved' || reservation.state === 'handoff_unknown')) return response.status(202).json({success: true, pending: true, operationId: reservation.id});
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
      await releaseDebit(access.db, access.workspaceScope, reservation.id);
      return response.status(crmResponse.status).json({error: result.error || 'CRM could not deliver the WhatsApp invoice.'});
    }
    await completeDebit(access.db, access.workspaceScope, reservation.id, result.messageId || '');
    return response.status(200).json({success: true, messageId: result.messageId, remainingBalance: reservation.remainingBalance});
  } catch (error) {
    if (error instanceof Error && !String(error.message).includes('WALLET')) { try { const access = await verifyWalletAccess(token, String(payload.workspaceScope), firebaseApiKey); if (access) await markHandoffUnknown(access.db, access.workspaceScope, (await reserveDebit(access.db, access.workspaceScope, String(payload.invoiceNumber))).id); } catch {} }
    console.error('QPOS WhatsApp invoice handoff failed:', error);
    return response.status(502).json({error: 'Could not reach the CRM WhatsApp service.'});
  }
}
