import {createHmac} from 'node:crypto';
import {getAdminAuth} from '../_firebase-admin';

function createSignature(body: string, secret: string) {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') return response.status(405).json({error: 'Method not allowed'});

  const token = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return response.status(401).json({error: 'Sign in is required to send an invoice.'});

  try {
    await getAdminAuth().verifyIdToken(token);
  } catch {
    return response.status(401).json({error: 'Your sign-in session has expired. Please sign in again.'});
  }

  const endpoint = process.env.CRM_QPOS_WHATSAPP_INVOICE_URL
    || process.env.CRM_QPOS_WEBHOOK_URL?.replace(/\/subscription-invoices$/, '/whatsapp-invoices');
  const apiKey = process.env.CRM_API_KEY;
  const secret = process.env.CRM_WEBHOOK_SECRET;
  if (!endpoint || !apiKey || !secret) {
    return response.status(503).json({error: 'WhatsApp invoice delivery is not activated for QPOS yet.'});
  }

  const payload = request.body || {};
  if (!payload.recipient || !payload.storeName || !payload.invoiceNumber || !payload.pdfBase64) {
    return response.status(400).json({error: 'Invoice, store, recipient, and PDF are required.'});
  }
  if (String(payload.pdfBase64).length > 12_000_000) {
    return response.status(413).json({error: 'Invoice PDF is too large to send through WhatsApp.'});
  }

  const body = JSON.stringify(payload);
  try {
    const crmResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'x-neospec-signature': createSignature(body, secret),
      },
      body,
    });
    const result = await crmResponse.json().catch(() => ({}));
    if (!crmResponse.ok) {
      return response.status(crmResponse.status).json({error: result.error || 'CRM could not deliver the WhatsApp invoice.'});
    }
    return response.status(200).json({success: true, messageId: result.messageId});
  } catch (error) {
    console.error('QPOS WhatsApp invoice handoff failed:', error);
    return response.status(502).json({error: 'Could not reach the CRM WhatsApp service.'});
  }
}
