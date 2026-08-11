import {getAdminDb} from './_firebase-admin.js';

type LinkPayload = { scope: string; saleId: string; expiresAt: number; storeName: string; storeAddress?: string; storePhone?: string; storeGst?: string; currency: string };

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Buffer.from(signature).toString('base64url');
}

const html = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[char]!));
const amount = (value: unknown, currency: string) => `${currency}${Number(value || 0).toFixed(2)}`;

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
    const saleDoc = await getAdminDb().doc(`users/${payload.scope}/sales/${payload.saleId}`).get();
    if (!saleDoc.exists) return response.status(404).send('Invoice not found.');
    const sale = saleDoc.data() as any;
    const invoiceNumber = sale.id || payload.saleId;
    const items = Array.isArray(sale.items) ? sale.items : [];
    const title = `Invoice ${invoiceNumber} from ${payload.storeName}`;
    const description = `Invoice total ${amount(sale.total, payload.currency)}. View or save your invoice from ${payload.storeName}.`;
    const rows = items.map((item: any) => `<tr><td>${html(item.name)}</td><td>${html(item.quantity)}</td><td>${html(amount((Number(item.total) || 0) + (Number(item.taxAmount) || 0), payload.currency))}</td></tr>`).join('');
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Cache-Control', 'private, no-store');
    return response.status(200).send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${html(title)}</title><meta property="og:type" content="website"><meta property="og:title" content="${html(title)}"><meta property="og:description" content="${html(description)}"><meta property="og:image" content="https://qpos.neospec.co.in/whatsapp/qpos-invoice-banner.jpg"><meta name="theme-color" content="#00b879"><style>body{margin:0;background:#f5f7f6;color:#17212f;font-family:Arial,sans-serif}.wrap{max-width:720px;margin:32px auto;padding:0 18px}.card{background:#fff;border:1px solid #dbe3df;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px #10251a14}.head{padding:28px;background:#06271e;color:#fff}.brand{color:#0ad38d;font-size:12px;font-weight:700;letter-spacing:.12em}.head h1{margin:9px 0 4px;font-size:27px}.muted{color:#607087}.head .muted{color:#b9d4cb}.body{padding:26px}.grid{display:grid;grid-template-columns:1fr auto;gap:14px;border-bottom:1px solid #e7ece9;padding-bottom:20px}.customer{margin:20px 0}table{width:100%;border-collapse:collapse}th,td{padding:12px 6px;border-bottom:1px solid #edf1ef;text-align:left;font-size:14px}th:last-child,td:last-child{text-align:right}.total{display:flex;justify-content:space-between;font-size:20px;font-weight:700;margin-top:20px}.action{margin-top:26px;width:100%;border:0;border-radius:12px;padding:15px;background:#00b879;color:#032418;font-weight:700;font-size:16px;cursor:pointer}@media print{.action{display:none}.wrap{margin:0;max-width:none}.card{box-shadow:none;border:0}}</style></head><body><main class="wrap"><section class="card"><header class="head"><div class="brand">QPOS INVOICE</div><h1>${html(payload.storeName)}</h1><div class="muted">${html(payload.storeAddress)}${payload.storePhone ? ` · ${html(payload.storePhone)}` : ''}</div></header><div class="body"><div class="grid"><div><strong>Invoice</strong><br>${html(invoiceNumber)}</div><div><strong>Date</strong><br>${html(new Date(sale.date).toLocaleDateString('en-IN'))}</div></div>${sale.customerName ? `<div class="customer"><strong>Billed to</strong><br>${html(sale.customerName)}</div>` : ''}<table><thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><div class="total"><span>Total</span><span>${html(amount(sale.total, payload.currency))}</span></div><p class="muted">Payment: ${html(sale.paymentMethod || 'Not specified')}</p><button class="action" onclick="window.print()">Print or Save as PDF</button></div></section></main></body></html>`);
  } catch (error) {
    console.error('Public invoice view failed:', error);
    return response.status(404).send('Invoice link is invalid or unavailable.');
  }
}
