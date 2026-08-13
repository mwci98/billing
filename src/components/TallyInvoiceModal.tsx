import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Download, CheckCircle2, FileText, Loader2, MessageCircle } from 'lucide-react';
// @ts-ignore html2pdf module declaration
import html2pdf from 'html2pdf.js';
import QRCode from 'qrcode';
import { Sale, StoreSettings } from '../types';
import { auth, firebaseWebApiKey } from '../lib/firebase';
import { useAppState } from '../lib/stateContext';

interface TallyInvoiceModalProps {
  activeReceipt: Sale;
  settings: StoreSettings;
  onClose: () => void;
}

// Helper: Convert number to Words (Rupees & Paise) for Indian Tally standard
function numberToWords(num: number): string {
  if (!num || isNaN(num) || num <= 0) return 'Zero Rupees Only';
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : ' ');
    if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + (n % 100 !== 0 ? 'and ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 !== 0 ? inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 !== 0 ? inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 !== 0 ? inWords(n % 10000000) : '');
  };

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  let result = 'INR ' + (rupees === 0 ? 'Zero' : inWords(rupees).trim());
  if (paise > 0) {
    result += ' and ' + inWords(paise).trim() + ' Paise';
  }
  return result + ' Only';
}

// Helper: GST State Code Mapping (38 Indian States and UTs)
export const GST_STATE_MAP: { [code: string]: string } = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
  '99': 'Centre Jurisdiction',
};

export function getGstStateInfo(gstNumber?: string): { stateName: string; stateCode: string } {
  if (gstNumber && gstNumber.trim().length >= 2) {
    const code = gstNumber.trim().substring(0, 2);
    if (GST_STATE_MAP[code]) {
      return { stateName: GST_STATE_MAP[code], stateCode: code };
    }
  }
  return { stateName: 'Karnataka', stateCode: '29' };
}

export const TallyInvoiceModal: React.FC<TallyInvoiceModalProps> = ({
  activeReceipt,
  settings,
  onClose
}) => {
  const { activeStore, currentUser } = useAppState();
  const [upiQrCode, setUpiQrCode] = useState('');
  const upiUri = activeReceipt.paymentMethod === 'UPI' && settings.upiId
    ? `upi://pay?${new URLSearchParams({ pa: settings.upiId, pn: settings.upiPayeeName || settings.storeName, am: activeReceipt.total.toFixed(2), cu: 'INR', tn: `Invoice ${activeReceipt.id}` }).toString()}`
    : '';

  useEffect(() => {
    if (!upiUri) {
      setUpiQrCode('');
      return;
    }
    QRCode.toDataURL(upiUri, { width: 180, margin: 1, errorCorrectionLevel: 'M' })
      .then(setUpiQrCode)
      .catch(() => setUpiQrCode(''));
  }, [upiUri]);

  const sellerState = getGstStateInfo(settings.gstNumber);
  const buyerState = activeReceipt.customerStateCode
    ? {
        stateName: activeReceipt.customerState || GST_STATE_MAP[activeReceipt.customerStateCode] || 'Not specified',
        stateCode: activeReceipt.customerStateCode
      }
    : activeReceipt.customerGstNumber
      ? getGstStateInfo(activeReceipt.customerGstNumber)
      : sellerState;
  const formattedDate = new Date(activeReceipt.date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  
  const formattedTime = new Date(activeReceipt.date).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Calculate GST splits (CGST & SGST 50-50 for intra-state)
  const items = activeReceipt.items || [];
  const taxGroups: { [key: number]: { taxable: number; cgst: number; sgst: number; totalTax: number } } = {};

  items.forEach(item => {
    const rate = item.taxRate || 18;
    const taxable = item.price * item.quantity;
    const taxAmt = item.taxAmount ?? (taxable * rate / 100);
    const halfTax = taxAmt / 2;

    if (!taxGroups[rate]) {
      taxGroups[rate] = { taxable: 0, cgst: 0, sgst: 0, totalTax: 0 };
    }
    taxGroups[rate].taxable += taxable;
    taxGroups[rate].cgst += halfTax;
    taxGroups[rate].sgst += halfTax;
    taxGroups[rate].totalTax += taxAmt;
  });

  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isWhatsAppSending, setIsWhatsAppSending] = useState(false);

  // html2canvas on some Android WebViews cannot parse Tailwind's oklch colors.
  // The invoice uses this clone hook so generated PDFs always use plain RGB values.
  const prepareInvoiceForPdf = (clonedDocument: Document) => {
    const invoice = clonedDocument.getElementById('printable-tally-a5-invoice');
    if (!invoice) return;

    invoice.querySelectorAll('.bg-gray-100').forEach((element) => {
      (element as HTMLElement).style.setProperty('background-color', '#f3f4f6', 'important');
    });
    invoice.querySelectorAll('.bg-gray-50').forEach((element) => {
      (element as HTMLElement).style.setProperty('background-color', '#f9fafb', 'important');
    });
    invoice.querySelectorAll('.text-gray-700').forEach((element) => {
      (element as HTMLElement).style.setProperty('color', '#374151', 'important');
    });
    invoice.querySelectorAll('.text-gray-800').forEach((element) => {
      (element as HTMLElement).style.setProperty('color', '#1f2937', 'important');
    });
  };

  const createInvoicePdf = async (): Promise<Blob | null> => {
    const printElement = document.getElementById('printable-tally-a5-invoice');
    if (!printElement) return null;
    const options = {
      margin: [3, 3, 3, 3] as [number, number, number, number],
      filename: `Tax_Invoice_${activeReceipt.id.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, onclone: prepareInvoiceForPdf },
      jsPDF: { unit: 'mm', format: 'a5', orientation: 'portrait' as const }
    };
    return html2pdf().set(options).from(printElement).outputPdf('blob') as Promise<Blob>;
  };

  const downloadPDF = async () => {
    const printElement = document.getElementById('printable-tally-a5-invoice');
    if (!printElement) return;

    setIsPdfLoading(true);
    try {
      await html2pdf().set({
        margin: [3, 3, 3, 3] as [number, number, number, number],
        filename: `Tax_Invoice_${activeReceipt.id.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, onclone: prepareInvoiceForPdf },
        jsPDF: { unit: 'mm', format: 'a5', orientation: 'portrait' as const }
      }).from(printElement).save();
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("PDF generation failed. Using browser print instead.");
      window.print();
    } finally {
      setIsPdfLoading(false);
    }
  };

  const sendInvoiceOnWhatsApp = async () => {
    if (!activeReceipt.customerPhone) {
      alert('Add the customer WhatsApp number before sending this invoice.');
      return;
    }
    if (!auth.currentUser) {
      alert('Please sign in again before sending a WhatsApp invoice.');
      return;
    }
    setIsWhatsAppSending(true);
    try {
      const phoneDigits = activeReceipt.customerPhone.replace(/\D/g, '');
      const recipient = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits;
      if (recipient.length < 10) throw new Error('Enter a valid customer WhatsApp number before sending the invoice.');
      const pdf = await createInvoicePdf();
      if (!pdf) throw new Error('Could not generate the invoice PDF.');
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(new Error('Could not prepare the invoice PDF.'));
        reader.readAsDataURL(pdf);
      });
      const marketingImageBase64 = await fetch('/whatsapp/qpos-invoice-banner.jpg')
        .then(response => response.ok ? response.blob() : Promise.reject(new Error('Banner not available')))
        .then(blob => new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
          reader.onerror = () => reject(new Error('Could not prepare the QPOS banner.'));
          reader.readAsDataURL(blob);
        }))
        .catch(() => '');
      const idToken = await auth.currentUser.getIdToken();
      const ownerScope = settings.tenantId
        || currentUser?.tenantId
        || (currentUser?.email || '').toLowerCase().trim().replace(/[^a-zA-Z0-9]/g, '_');
      const workspaceScope = currentUser?.workspaceScope
        || (!activeStore?.id || activeStore.id === 'primary-store' || activeStore.id === ownerScope
          ? ownerScope
          : `${ownerScope}__store__${activeStore.id.toLowerCase().trim().replace(/[^a-zA-Z0-9_-]/g, '_')}`);
      const linkResponse = await fetch('/api/public-invoices/create', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${idToken}`, 'x-firebase-api-key': firebaseWebApiKey},
        body: JSON.stringify({
          workspaceScope,
          saleId: activeReceipt.id,
          invoice: {
            storeName: settings.storeName,
            storeAddress: settings.address,
            storePhone: settings.phone,
            storeGst: settings.gstNumber,
            currency: settings.currency,
          },
        }),
      });
      const linkResult = await linkResponse.json().catch(() => ({}));
      if (!linkResponse.ok || !linkResult.url) {
        throw new Error(linkResult.error || 'Could not create the secure invoice link.');
      }
      const invoiceSummary = [
        `*${settings.storeName}*`,
        settings.address,
        settings.phone ? `Phone: ${settings.phone}` : '',
        '',
        `Invoice: ${activeReceipt.id}`,
        `Date: ${new Date(activeReceipt.date).toLocaleDateString('en-IN')}`,
        activeReceipt.customerName ? `Customer: ${activeReceipt.customerName}` : '',
        '',
        '*Items*',
        ...activeReceipt.items.slice(0, 8).map(item => `${item.name} x ${item.quantity} - ${settings.currency}${(item.total + item.taxAmount).toFixed(2)}`),
        activeReceipt.items.length > 8 ? `+ ${activeReceipt.items.length - 8} more item(s)` : '',
        '',
        `*Total: ${settings.currency}${activeReceipt.total.toFixed(2)}*`,
        `Payment: ${activeReceipt.paymentMethod}`,
        'Thank you for your business.',
      ].filter(Boolean).join('\n').slice(0, 1000);
      const response = await fetch('/api/communications/send-whatsapp-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}`, 'x-firebase-api-key': firebaseWebApiKey },
        body: JSON.stringify({
          recipient,
          workspaceScope,
          storeName: settings.storeName,
          invoiceNumber: activeReceipt.id,
          total: activeReceipt.total,
          currency: settings.currency,
          fileName: `Invoice_${activeReceipt.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
          pdfBase64,
          ...(marketingImageBase64 ? {marketingImageBase64} : {}),
          invoicePublicUrl: linkResult.url,
          invoiceSummary,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'WhatsApp could not deliver the invoice.');
      alert('Invoice sent on WhatsApp.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'WhatsApp invoice delivery failed.');
    } finally {
      setIsWhatsAppSending(false);
    }
  };

  const printInvoice = () => {
    // Attempt standard browser print dialog
    try {
      window.focus();
      window.print();
    } catch (e) {
      console.warn("window.print failed, downloading PDF fallback", e);
      downloadPDF();
    }
  };

  const renderInvoiceContent = () => (
    <>
      {/* Title Banner */}
      <div className="text-center font-bold text-xs uppercase border-b border-black pb-1 mb-1 tracking-wider">
        TAX INVOICE
      </div>

      {/* Main Header Table Grid */}
      <table className="w-full tally-table-border border-collapse text-[10px]">
        <tbody>
          {/* Seller & Invoice info header row */}
          <tr>
            <td colSpan={2} className="w-1/2 p-2 align-top">
              <p className="font-bold text-xs uppercase leading-tight">{settings.storeName}</p>
              <p className="mt-0.5 whitespace-pre-line text-[9.5px] leading-snug">{settings.address}</p>
              <p className="mt-1 font-semibold text-[9.5px]">Phone: {settings.phone}</p>
              {settings.email && <p className="text-[9.5px]">Email: {settings.email}</p>}
              <p className="font-bold mt-1 text-[9.5px]">GSTIN/UIN: {settings.gstNumber || 'N/A'}</p>
              <p className="text-[9px]">State Name: {sellerState.stateName}, Code: {sellerState.stateCode}</p>
            </td>
            <td colSpan={2} className="w-1/2 p-0 align-top">
              <table className="w-full text-[9.5px] border-collapse">
                <tbody>
                  <tr>
                    <td className="border-r border-b border-black p-1 w-1/2 font-semibold">Invoice No.<br/><span className="font-bold text-[10px]">{activeReceipt.id}</span></td>
                    <td className="border-b border-black p-1 w-1/2 font-semibold">Dated<br/><span className="font-bold text-[10px]">{formattedDate} ({formattedTime})</span></td>
                  </tr>
                  <tr>
                    <td className="border-r border-b border-black p-1 font-semibold">Delivery Note<br/><span className="font-normal">-</span></td>
                    <td className="border-b border-black p-1 font-semibold">Mode/Terms of Payment<br/><span className="font-bold uppercase">{activeReceipt.paymentMethod}</span></td>
                  </tr>
                  <tr>
                    <td className="border-r border-b border-black p-1 font-semibold">Supplier's Ref.<br/><span className="font-normal">{activeReceipt.employeeName}</span></td>
                    <td className="border-b border-black p-1 font-semibold">Other Reference(s)<br/><span className="font-normal">POS Terminal</span></td>
                  </tr>
                  <tr>
                    <td className="border-r border-black p-1 font-semibold">Buyer's Order No.<br/><span className="font-normal">-</span></td>
                    <td className="p-1 font-semibold">Dispatch Doc No.<br/><span className="font-normal">-</span></td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* Buyer / Consignee details */}
          <tr>
            <td colSpan={2} className="p-2 align-top border-t border-black">
              <p className="font-semibold text-[9px] uppercase tracking-wide">Buyer (Billed to):</p>
              <p className="font-bold text-xs uppercase mt-0.5">{activeReceipt.customerCompanyName || activeReceipt.customerName || 'Cash / Walk-in Customer'}</p>
              {activeReceipt.customerCompanyName && <p className="text-[9px]">Contact Person: {activeReceipt.customerName}</p>}
              <p className="text-[9px] mt-0.5">Contact: {activeReceipt.customerPhone || (activeReceipt.customerId ? 'Registered Account' : 'Counter Sale')}</p>
              {activeReceipt.customerBillingAddress && <p className="text-[9px] whitespace-pre-line">{activeReceipt.customerBillingAddress}</p>}
              {activeReceipt.customerGstNumber && <p className="text-[9px]">GSTIN: {activeReceipt.customerGstNumber}</p>}
              <p className="text-[9px]">State Name: {buyerState.stateName}, Code: {buyerState.stateCode}</p>
            </td>
            <td colSpan={2} className="p-2 align-top border-t border-black">
              <p className="font-semibold text-[9px] uppercase tracking-wide">Consignee (Shipped to):</p>
              <p className="font-bold text-xs uppercase mt-0.5">{activeReceipt.customerCompanyName || activeReceipt.customerName || 'Cash / Walk-in Customer'}</p>
              <p className="text-[9px] mt-0.5 whitespace-pre-line">Destination: {activeReceipt.customerShippingAddress || activeReceipt.customerBillingAddress || 'Counter Pick'}</p>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Product Particulars Table */}
      <table className="w-full tally-table-border border-collapse text-[9.5px] mt-[-1px]">
        <thead>
          <tr className="bg-gray-100 font-bold text-center">
            <th className="p-1 w-[6%]">Sl No.</th>
            <th className="p-1 text-left w-[44%]">Description of Goods</th>
            <th className="p-1 w-[12%]">HSN/SAC</th>
            <th className="p-1 w-[8%]">Qty</th>
            <th className="p-1 text-right w-[14%]">Rate ({settings.currency})</th>
            <th className="p-1 w-[6%]">per</th>
            <th className="p-1 text-right w-[10%]">Amount ({settings.currency})</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const hsnCode = `8517.${(idx + 10).toString().padStart(2, '0')}`;
            return (
              <tr key={idx} className="align-top">
                <td className="p-1 text-center font-mono">{idx + 1}</td>
                <td className="p-1 font-medium">
                  <span className="font-bold">{item.name}</span>
                  {item.sku && <span className="block text-[8.5px] text-gray-700">SKU: {item.sku}</span>}
                  {item.serializedUnits?.map((unit, unitIndex) => (
                    <span key={unit.unitId} className="block text-[8px] font-mono text-gray-700">
                      {item.serializedUnits!.length > 1 && <span className="font-bold">Handset {unitIndex + 1}: </span>}
                      <span className="block">IMEI 1: {unit.imei1}</span>
                      {unit.imei2 && <span className="block">IMEI 2: {unit.imei2}</span>}
                    </span>
                  ))}
                </td>
                <td className="p-1 text-center font-mono">{hsnCode}</td>
                <td className="p-1 text-center font-bold">{item.quantity}</td>
                <td className="p-1 text-right font-mono">{item.price.toFixed(2)}</td>
                <td className="p-1 text-center">Pcs</td>
                <td className="p-1 text-right font-bold font-mono">{(item.price * item.quantity).toFixed(2)}</td>
              </tr>
            );
          })}

          {/* Fill empty rows for standard height Tally format if items < 3 */}
          {Array.from({ length: Math.max(0, 3 - items.length) }).map((_, i) => (
            <tr key={`empty-${i}`} className="h-6">
              <td className="p-1"></td>
              <td className="p-1"></td>
              <td className="p-1"></td>
              <td className="p-1"></td>
              <td className="p-1"></td>
              <td className="p-1"></td>
              <td className="p-1"></td>
            </tr>
          ))}

          {/* Tax & Discount Summary Rows */}
          {activeReceipt.discount > 0 && (
            <tr>
              <td colSpan={6} className="p-1 text-right font-semibold">Less: Discount / Scheme Off</td>
              <td className="p-1 text-right font-mono font-bold">-{activeReceipt.discount.toFixed(2)}</td>
            </tr>
          )}
          
          {/* CGST / SGST split rows */}
          {Object.entries(taxGroups).map(([rate, group]) => (
            <React.Fragment key={rate}>
              <tr>
                <td colSpan={6} className="p-1 text-right font-semibold">CGST @ {(Number(rate) / 2).toFixed(1)}%</td>
                <td className="p-1 text-right font-mono font-semibold">{group.cgst.toFixed(2)}</td>
              </tr>
              <tr>
                <td colSpan={6} className="p-1 text-right font-semibold">SGST @ {(Number(rate) / 2).toFixed(1)}%</td>
                <td className="p-1 text-right font-mono font-semibold">{group.sgst.toFixed(2)}</td>
              </tr>
            </React.Fragment>
          ))}

          {/* Total Line */}
          <tr className="font-bold bg-gray-50 border-t border-black">
            <td colSpan={3} className="p-1 text-right">Total</td>
            <td className="p-1 text-center font-mono">{items.reduce((s, it) => s + it.quantity, 0)} Pcs</td>
            <td colSpan={2} className="p-1"></td>
            <td className="p-1 text-right font-mono text-[10.5px]">{settings.currency}{activeReceipt.total.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {/* Amount in Words */}
      <div className="border-x border-b border-black p-1.5 font-bold text-[9.5px]">
        Amount Chargeable (in words): <span className="font-normal italic">{numberToWords(activeReceipt.total)}</span>
      </div>

      {/* Tax Breakdown Grid (Tally Standard HSN/SAC) */}
      <table className="w-full tally-table-border border-collapse text-[8.5px] mt-1">
        <thead>
          <tr className="bg-gray-100 font-bold text-center">
            <th rowSpan={2} className="p-0.5">HSN/SAC</th>
            <th rowSpan={2} className="p-0.5">Taxable Value</th>
            <th colSpan={2} className="p-0.5">Central Tax</th>
            <th colSpan={2} className="p-0.5">State Tax</th>
            <th rowSpan={2} className="p-0.5">Total Tax Amount</th>
          </tr>
          <tr className="bg-gray-100 font-bold text-center">
            <th className="p-0.5">Rate</th>
            <th className="p-0.5">Amount</th>
            <th className="p-0.5">Rate</th>
            <th className="p-0.5">Amount</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(taxGroups).map(([rateStr, group], i) => {
            const rate = Number(rateStr);
            const halfRate = (rate / 2).toFixed(1) + '%';
            return (
              <tr key={i} className="text-center font-mono">
                <td className="p-0.5">8517.00</td>
                <td className="p-0.5 text-right">{group.taxable.toFixed(2)}</td>
                <td className="p-0.5">{halfRate}</td>
                <td className="p-0.5 text-right">{group.cgst.toFixed(2)}</td>
                <td className="p-0.5">{halfRate}</td>
                <td className="p-0.5 text-right">{group.sgst.toFixed(2)}</td>
                <td className="p-0.5 text-right font-bold">{group.totalTax.toFixed(2)}</td>
              </tr>
            );
          })}
          <tr className="font-bold bg-gray-50 text-right font-mono">
            <td className="p-0.5 text-center">Total</td>
            <td className="p-0.5">{Object.values(taxGroups).reduce((s, g) => s + g.taxable, 0).toFixed(2)}</td>
            <td className="p-0.5"></td>
            <td className="p-0.5">{Object.values(taxGroups).reduce((s, g) => s + g.cgst, 0).toFixed(2)}</td>
            <td className="p-0.5"></td>
            <td className="p-0.5">{Object.values(taxGroups).reduce((s, g) => s + g.sgst, 0).toFixed(2)}</td>
            <td className="p-0.5">{Object.values(taxGroups).reduce((s, g) => s + g.totalTax, 0).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {/* Tax Amount in Words */}
      <div className="border-x border-b border-black p-1.5 font-bold text-[9px]">
        Tax Amount (in words):{' '}
        <span className="font-normal italic">
          {numberToWords(Object.values(taxGroups).reduce((sum, group) => sum + group.totalTax, 0))}
        </span>
      </div>

      {/* Bank details & Terms + Signatory */}
      <table className="w-full tally-table-border border-collapse text-[9px] mt-1">
        <tbody>
          <tr>
            <td className="w-3/5 p-1.5 align-top">
              {settings.showBankDetailsOnInvoice && (
                <div className="mb-1">
                  <p className="font-bold underline">Company's Bank Details:</p>
                  {settings.bankAccountHolder && (
                    <p>Account Holder: <span className="font-semibold">{settings.bankAccountHolder}</span></p>
                  )}
                  <p>Bank Name: <span className="font-semibold">{settings.bankName}</span></p>
                  <p>A/c No.: <span className="font-semibold font-mono">{settings.bankAccountNumber}</span></p>
                  <p>
                    Branch & IFSC:{' '}
                    <span className="font-semibold font-mono">
                      {[settings.bankBranch, settings.bankIfsc].filter(Boolean).join(' / ')}
                    </span>
                  </p>
                </div>
              )}
              <p className="font-bold underline">Declaration:</p>
              <p className="text-[8.5px] leading-tight text-gray-800">
                We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
              </p>
              {upiQrCode && (
                <div className="mt-2 flex items-center gap-2 border-t border-dashed border-black pt-2">
                  <img src={upiQrCode} alt="UPI payment QR" className="h-16 w-16" />
                  <div className="text-[8px] leading-tight">
                    <p className="font-bold">Scan to pay by UPI</p>
                    <p>{settings.upiPayeeName || settings.storeName}</p>
                    <p className="font-mono">{settings.upiId}</p>
                    <p className="font-bold">Amount: {settings.currency}{activeReceipt.total.toFixed(2)}</p>
                  </div>
                </div>
              )}
            </td>
            <td className="w-2/5 p-2 text-right align-top">
              <p className="font-bold uppercase">for {settings.storeName}</p>
              {settings.invoiceSignature ? (
                <div className="mt-3 h-11">
                  <img
                    src={settings.invoiceSignature}
                    alt="Authorised signature"
                    style={{
                      display: 'block',
                      width: 'auto',
                      height: 'auto',
                      maxWidth: '110px',
                      maxHeight: '36px',
                      marginLeft: 'auto',
                      marginRight: '8px',
                      objectFit: 'contain',
                      filter: 'contrast(1.8) brightness(1.15)'
                    }}
                  />
                </div>
              ) : (
                <div className="h-14" />
              )}
              <div className="mt-1 pt-2 border-t border-black">
                <p className="font-bold uppercase text-[8.5px]">Authorised Signatory</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="text-center text-[8px] font-bold uppercase mt-3 pb-1 tracking-normal leading-normal text-gray-800">
        THIS IS A COMPUTER GENERATED INVOICE BY QPOS
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      {/* Scoped CSS rules to guarantee 100% black text on crisp white paper background in all dark/light modes */}
      <style>{`
        .tally-invoice-paper, .tally-invoice-paper * {
          color: #000000 !important;
          border-color: #000000 !important;
          font-family: Arial, sans-serif !important;
        }
        .tally-invoice-paper {
          background-color: #FFFFFF !important;
        }
        .tally-table-border {
          border: 1px solid #000000 !important;
        }
        .tally-table-border td, .tally-table-border th {
          border: 1px solid #000000 !important;
        }
        .tally-invoice-paper table,
        .tally-invoice-paper thead,
        .tally-invoice-paper tbody,
        .tally-invoice-paper tr,
        .tally-invoice-paper tr:hover,
        .tally-invoice-paper td,
        .tally-invoice-paper th {
          background-color: #ffffff !important;
        }
        .tally-invoice-paper .bg-gray-50 {
          background-color: #f9fafb !important;
        }
        .tally-invoice-paper .bg-gray-100 {
          background-color: #f3f4f6 !important;
        }

        #printable-tally-a5-invoice-portal {
          display: none;
        }

        @media print {
          @page {
            size: A5 portrait;
            margin: 3mm;
          }
          html, body {
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
          }
          /* Hide all top level nodes except portal */
          body > *:not(#printable-tally-a5-invoice-portal) {
            display: none !important;
          }
          #printable-tally-a5-invoice-portal {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 148mm !important;
            margin: 0 !important;
            padding: 2mm !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>

      {/* Render print portal attached directly to document.body */}
      {typeof document !== 'undefined' && document.body && createPortal(
        <div 
          id="printable-tally-a5-invoice-portal" 
          className="tally-invoice-paper"
        >
          {renderInvoiceContent()}
        </div>,
        document.body
      )}

      <div className="w-full max-w-3xl rounded-2xl bg-gray-900 border border-gray-800 shadow-2xl p-3 sm:p-6 relative flex flex-col my-auto max-h-[calc(100dvh-1rem)] sm:max-h-[92vh]">
        
        {/* Header toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 mb-3 sm:mb-4 border-b border-gray-800 text-white shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold flex flex-wrap items-center gap-2">
                QwickPOS Invoice <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">A5 Paper Ready</span>
              </h3>
              <p className="text-xs text-gray-400">Official GST compliant invoice print layout</p>
            </div>
          </div>

          <div className="flex w-full sm:w-auto items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition cursor-pointer"
              aria-label="Close invoice preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable / Preview A5 Paper Sheet */}
        <div className="flex-1 min-h-0 overflow-auto flex justify-center bg-gray-950/60 p-2 sm:p-6 rounded-xl border border-gray-800">
          
          <div 
            id="printable-tally-a5-invoice" 
            className="tally-invoice-paper w-full max-w-[148mm] bg-white text-black p-2 sm:p-5 shadow-2xl rounded-sm border border-black text-[8px] sm:text-[10px] leading-tight space-y-0"
            style={{ width: '100%', maxWidth: '148mm', minHeight: '210mm', boxSizing: 'border-box' }}
          >
            {renderInvoiceContent()}
          </div>

        </div>

        {/* Action buttons footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 sm:pt-4 mt-2 border-t border-gray-800 shrink-0">
          <p className="text-xs text-gray-400">
            Sale Completed • <span className="text-white font-semibold">{activeReceipt.items.length} Items Billed</span>
          </p>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            {settings.whatsappInvoiceEnabled && <button
              onClick={sendInvoiceOnWhatsApp}
              disabled={isWhatsAppSending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-500 disabled:opacity-50"
              title="Send this invoice PDF through the configured Neospec WhatsApp Business number"
              aria-label={isWhatsAppSending ? 'Sending invoice on WhatsApp' : 'Send invoice on WhatsApp'}
            >
              {isWhatsAppSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            </button>}
            <button
              onClick={downloadPDF}
              disabled={isPdfLoading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-700 bg-gray-800 text-gray-200 transition hover:bg-gray-700 disabled:opacity-50"
              title="Download invoice PDF"
              aria-label={isPdfLoading ? 'Saving invoice PDF' : 'Download invoice PDF'}
            >
              {isPdfLoading ? <Loader2 className="h-4 w-4 text-emerald-400 animate-spin" /> : <Download className="h-4 w-4 text-emerald-400" />}
            </button>
            <button
              onClick={printInvoice}
              className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-500 sm:flex-none sm:px-5"
            >
              <Printer className="h-4 w-4" />
              <span>Print A5</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
