import {getAdminDb} from './_firebase-admin.js';

type LinkPayload = { scope: string; saleId: string; expiresAt: number; storeName: string; storeAddress?: string; storePhone?: string; storeGst?: string; currency: string };

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))).toString('base64url');
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
    if (!payload.scope || !payload.saleId || !payload.expiresAt || payload.expiresAt < Date.now()) return response.status(410).send('This invoice link has expired.');

    const db = getAdminDb();
    const publicInvoice = await db.doc(`users/${payload.scope}/public_invoices/${payload.saleId}`).get();
    const storedPdf = publicInvoice.exists ? publicInvoice.data() as any : null;
    if (Number(storedPdf?.chunkCount || 0) > 0 && Number(storedPdf.expiresAt || 0) >= Date.now()) {
      const chunkSnapshot = await publicInvoice.ref.collection('pdf_chunks').orderBy('__name__').get();
      const pdfBase64 = chunkSnapshot.docs.map(document => String(document.data().data || '')).join('');
      if (!pdfBase64) return response.status(404).send('Invoice PDF is unavailable.');
      const fileName = String(storedPdf.fileName || `Invoice_${payload.saleId}.pdf`).replace(/[\\/\r\n"]/g, '_');
      response.setHeader('Content-Type', 'application/pdf');
      response.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      response.setHeader('Cache-Control', 'private, no-store');
      return response.status(200).send(Buffer.from(pdfBase64, 'base64'));
    }

    const saleDoc = await db.doc(`users/${payload.scope}/sales/${payload.saleId}`).get();
    if (!saleDoc.exists) return response.status(404).send('Invoice not found.');
    const sale = saleDoc.data() as any;
    const invoiceNumber = sale.id || payload.saleId;
    const title = `Invoice ${invoiceNumber} from ${payload.storeName}`;
    const description = `Invoice total ${amount(sale.total, payload.currency)}. View or save your invoice from ${payload.storeName}.`;
    const items = Array.isArray(sale.items) ? sale.items : [];
    const rows = items.map((item: any, index: number) => {
      const qty = Number(item.quantity || 0);
      const total = Number(item.total || 0) + Number(item.taxAmount || 0);
      const rate = qty ? total / qty : total;
      return `<tr><td>${index + 1}</td><td><strong>${html(item.name)}</strong>${item.sku ? `<small>SKU: ${html(item.sku)}</small>` : ''}${Number(item.taxRate) ? `<small>GST ${html(item.taxRate)}%</small>` : ''}</td><td>${html(qty)}</td><td>${html(amount(rate, payload.currency))}</td><td>${html(amount(total, payload.currency))}</td></tr>`;
    }).join('') || '<tr><td colspan="5">No invoice items available.</td></tr>';
    const storeDetails = [payload.storeAddress, payload.storePhone ? `Phone: ${payload.storePhone}` : '', payload.storeGst ? `GSTIN: ${payload.storeGst}` : ''].filter(Boolean).map(html).join('<br>');
    const customerDetails = [sale.customerCompanyName, sale.customerBillingAddress, sale.customerPhone, sale.customerEmail, sale.customerGstNumber ? `GSTIN: ${sale.customerGstNumber}` : ''].filter(Boolean).map(html).join('<br>');
    const saleDate = sale.date ? new Date(sale.date).toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'}) : 'Not available';
    const subtotal = Number(sale.subtotal ?? sale.total ?? 0);
    const tax = Number(sale.taxAmount || 0);
    const discount = Number(sale.discount || 0);

    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Cache-Control', 'private, no-store');
    return response.status(200).send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${html(title)}</title><meta property="og:type" content="website"><meta property="og:title" content="${html(title)}"><meta property="og:description" content="${html(description)}"><meta property="og:image" content="https://qpos.neospec.co.in/whatsapp/qpos-invoice-banner.jpg"><meta name="theme-color" content="#00b879"><style>*{box-sizing:border-box}body{margin:0;background:#edf2ef;color:#17212f;font:14px/1.5 Arial,sans-serif}.wrap{max-width:820px;margin:30px auto;padding:0 16px}.sheet{background:#fff;border:1px solid #cad8d1;box-shadow:0 12px 34px #15261b1c}.head{display:flex;justify-content:space-between;gap:24px;padding:32px;border-bottom:5px solid #00b879}.brand{color:#009c67;font-size:11px;font-weight:800;letter-spacing:.16em}.head h1{margin:5px 0;font-size:27px;line-height:1.1}.muted{color:#657686}.right{text-align:right}.right strong{display:block;font-size:22px}.number{font:700 15px monospace;color:#007c54}.content{padding:28px 32px}.parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px}.party{border-top:1px solid #dce6e0;padding-top:12px}.label{color:#607184;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.party h2{font-size:16px;margin:5px 0}.party p{margin:0;color:#465764}table{width:100%;border-collapse:collapse}th{padding:10px 8px;background:#eaf6f1;color:#267257;font-size:10px;letter-spacing:.08em;text-align:left;text-transform:uppercase}td{padding:13px 8px;border-bottom:1px solid #e6ece8;vertical-align:top}td small{display:block;color:#71808d;font-size:11px}th:nth-last-child(-n+3),td:nth-last-child(-n+3){text-align:right}.summary{margin-left:auto;width:min(330px,100%);padding-top:18px}.summary div{display:flex;justify-content:space-between;padding:5px 0;color:#526472}.summary .grand{margin-top:6px;border-top:2px solid #17212f;padding-top:12px;color:#17212f;font-size:19px;font-weight:800}.payment{margin-top:22px;border:1px solid #cae9dc;background:#f2fbf7;padding:12px 14px;color:#176044}.action{display:block;width:100%;margin-top:22px;border:0;border-radius:10px;padding:14px;background:#00b879;color:#06271e;font-size:15px;font-weight:800;cursor:pointer}.foot{padding:18px 32px 28px;color:#657686;font-size:12px;text-align:center}@media(max-width:580px){.head{display:block;padding:24px}.right{text-align:left;margin-top:20px}.content{padding:22px 18px}.parties{grid-template-columns:1fr;gap:18px}th:nth-child(4),td:nth-child(4){display:none}.foot{padding:18px}}@media print{body{background:#fff}.wrap{max-width:none;margin:0;padding:0}.sheet{border:0;box-shadow:none}.action{display:none}}</style></head><body><main class="wrap"><article class="sheet"><header class="head"><div><div class="brand">QPOS TAX INVOICE</div><h1>${html(payload.storeName)}</h1><p class="muted">${storeDetails || 'Business details not available'}</p></div><div class="right"><strong>INVOICE</strong><div class="number">${html(invoiceNumber)}</div><div class="muted">Issued ${html(saleDate)}</div></div></header><section class="content"><div class="parties"><div class="party"><div class="label">Billed to</div><h2>${html(sale.customerName || 'Walk-in customer')}</h2><p>${customerDetails || 'Customer details not available'}</p></div><div class="party"><div class="label">Payment status</div><h2>${html(sale.status || 'Completed')}</h2><p>Paid via ${html(sale.paymentMethod || 'Not specified')}</p></div></div><table><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><div class="summary"><div><span>Subtotal</span><span>${html(amount(subtotal, payload.currency))}</span></div><div><span>GST</span><span>${html(amount(tax, payload.currency))}</span></div>${discount > 0 ? `<div><span>Discount</span><span>- ${html(amount(discount, payload.currency))}</span></div>` : ''}<div class="grand"><span>Grand total</span><span>${html(amount(sale.total, payload.currency))}</span></div></div><div class="payment">Payment method: <strong>${html(sale.paymentMethod || 'Not specified')}</strong></div><button class="action" onclick="window.print()">Print or save invoice</button></section><footer class="foot">Powered by QPOS, a product of Neospec.<br>qpos.neospec.co.in</footer></article></main></body></html>`);
  } catch (error) {
    console.error('Public invoice view failed:', error);
    return response.status(404).send('Invoice link is invalid or unavailable.');
  }
}
