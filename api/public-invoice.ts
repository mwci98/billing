import {getAdminDb} from './_firebase-admin.js';

type LinkPayload = {scope: string; saleId: string; expiresAt: number};

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  return Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))).toString('base64url');
}

export default async function handler(request: any, response: any) {
  const token = String(request.query.token || '');
  const [encoded, suppliedSignature] = token.split('.');
  const secret = process.env.PUBLIC_INVOICE_SECRET || process.env.CRM_WEBHOOK_SECRET;
  if (!encoded || !suppliedSignature || !secret || suppliedSignature !== await sign(encoded, secret)) {
    return response.status(404).send('Invoice link is invalid.');
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as LinkPayload;
    if (!payload.scope || !payload.saleId || !payload.expiresAt || payload.expiresAt < Date.now()) {
      return response.status(410).send('This invoice link has expired.');
    }

    const publicInvoice = await getAdminDb().doc(`users/${payload.scope}/public_invoices/${payload.saleId}`).get();
    const storedPdf = publicInvoice.exists ? publicInvoice.data() as any : null;
    if (Number(storedPdf?.chunkCount || 0) < 1 || Number(storedPdf?.expiresAt || 0) < Date.now()) {
      return response.status(404).send('The original invoice PDF is unavailable. Please request a new invoice link.');
    }

    const chunkSnapshot = await publicInvoice.ref.collection('pdf_chunks').orderBy('__name__').get();
    if (chunkSnapshot.size !== Number(storedPdf.chunkCount)) {
      return response.status(404).send('The original invoice PDF is incomplete. Please request a new invoice link.');
    }
    const pdfBase64 = chunkSnapshot.docs.map(document => String(document.data().data || '')).join('');
    if (!pdfBase64) {
      return response.status(404).send('The original invoice PDF is unavailable. Please request a new invoice link.');
    }

    const pdf = Buffer.from(pdfBase64, 'base64');
    if (pdf.length < 5 || pdf.subarray(0, 5).toString('ascii') !== '%PDF-') {
      return response.status(500).send('The stored invoice is not a valid PDF. Please request a new invoice link.');
    }

    const fileName = String(storedPdf.fileName || `Invoice_${payload.saleId}.pdf`).replace(/[\\/\r\n"]/g, '_');
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    response.setHeader('Content-Length', String(pdf.length));
    response.setHeader('Cache-Control', 'private, no-store');
    return response.status(200).send(pdf);
  } catch (error) {
    console.error('Public invoice PDF failed:', error);
    return response.status(404).send('Invoice link is invalid or unavailable.');
  }
}
