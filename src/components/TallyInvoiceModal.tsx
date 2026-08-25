import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Download, CheckCircle2, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Sale, StoreSettings } from '../types';
import { auth, firebaseWebApiKey } from '../lib/firebase';
import { useAppState } from '../lib/stateContext';

interface TallyInvoiceModalProps {
  activeReceipt: Sale;
  settings: StoreSettings;
  onClose: () => void;
}

const WhatsAppIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 32 32" aria-hidden="true" className={className} fill="currentColor">
    <path d="M16.04 3C9.4 3 4 8.32 4 14.87c0 2.1.56 4.15 1.63 5.94L4 26.72l6.1-1.58a12.2 12.2 0 0 0 5.93 1.53h.01C22.68 26.67 28 21.35 28 14.8 28 8.27 22.68 3 16.04 3Zm0 21.66h-.01c-1.82 0-3.6-.48-5.16-1.4l-.37-.22-3.62.94.97-3.48-.24-.36a9.68 9.68 0 0 1-1.5-5.27C6.11 9.43 10.56 5 16.04 5c5.47 0 9.84 4.39 9.84 9.8 0 5.43-4.4 9.86-9.84 9.86Zm5.4-7.39c-.3-.15-1.76-.86-2.03-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-1.74-.85-2.88-1.52-4.03-3.45-.3-.52.3-.48.86-1.6.1-.2.05-.37-.03-.52-.07-.15-.66-1.58-.91-2.16-.24-.57-.49-.49-.67-.5h-.57c-.2 0-.52.08-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.21 3.07c.15.2 2.1 3.17 5.08 4.45.71.3 1.26.49 1.7.63.71.22 1.35.19 1.86.11.57-.08 1.76-.71 2-1.4.25-.7.25-1.3.18-1.42-.08-.13-.27-.2-.57-.35Z" />
  </svg>
);

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
  const previewRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    previewRef.current?.scrollTo({ top: 0, left: 0 });
  }, [activeReceipt.id]);

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
    const invoice = clonedDocument.querySelector<HTMLElement>('[data-pdf-invoice="true"]')
      || clonedDocument.getElementById('printable-tally-a5-invoice');
    if (!invoice) return;

    invoice.style.setProperty('width', '142mm', 'important');
    invoice.style.setProperty('max-width', '142mm', 'important');
    invoice.style.setProperty('min-height', '0', 'important');
    invoice.style.setProperty('padding', '3mm', 'important');
    invoice.style.setProperty('box-sizing', 'border-box', 'important');

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

  const createPdfSource = () => {
    const preview = document.getElementById('printable-tally-a5-invoice');
    if (!preview) return null;

    const source = preview.cloneNode(true) as HTMLElement;
    source.removeAttribute('id');
    source.dataset.pdfInvoice = 'true';
    source.style.cssText = [
      'position: fixed',
      'left: 0',
      'top: 0',
      'z-index: 0',
      'pointer-events: none',
      'width: 142mm',
      'max-width: 142mm',
      'height: auto',
      'min-height: 0',
      'padding: 3mm',
      'box-sizing: border-box',
      'background: #fff',
    ].join(';');
    document.body.appendChild(source);
    return source;
  };

  const createInvoicePdf = async (): Promise<Blob | null> => {
    const pdfSource = createPdfSource();
    if (!pdfSource) return null;

    try {
      await document.fonts?.ready;
      await Promise.all(Array.from(pdfSource.querySelectorAll('img')).map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => resolve(), { once: true });
        });
      }));
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      const canvas = await html2canvas(pdfSource, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 794,
        scrollX: 0,
        scrollY: 0,
        onclone: prepareInvoiceForPdf,
      });

      if (!canvas.width || !canvas.height) {
        throw new Error('Invoice canvas is empty');
      }

      const pdf = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const availableWidth = pageWidth - 6;
      const availableHeight = pageHeight - 6;
      const pagePixelHeight = Math.floor(canvas.width * (availableHeight / availableWidth));
      const pixels = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
      let contentHeight = canvas.height;
      if (pixels) {
        for (let y = canvas.height - 1; y >= 0; y -= 1) {
          let hasInk = false;
          for (let x = 0; x < canvas.width; x += 4) {
            const offset = (y * canvas.width + x) * 4;
            if (pixels[offset + 3] > 10 && (pixels[offset] < 248 || pixels[offset + 1] < 248 || pixels[offset + 2] < 248)) {
              hasInk = true;
              break;
            }
          }
          if (hasInk) {
            contentHeight = Math.min(canvas.height, y + 4);
            break;
          }
        }
      }
      let sourceY = 0;
      let pageIndex = 0;

      while (sourceY < contentHeight) {
        const sliceHeight = Math.min(pagePixelHeight, contentHeight - sourceY);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const context = pageCanvas.getContext('2d');
        if (!context) throw new Error('Unable to prepare invoice PDF page');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        context.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

        if (pageIndex > 0) pdf.addPage('a5', 'portrait');
        const renderedHeight = (sliceHeight / canvas.width) * availableWidth;
        pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.98), 'JPEG', 3, 3, availableWidth, renderedHeight);
        sourceY += sliceHeight;
        pageIndex += 1;
      }
      return pdf.output('blob');
    } finally {
      pdfSource.remove();
    }
  };

  const downloadPDF = async () => {
    setIsPdfLoading(true);
    try {
      const blob = await createInvoicePdf();
      if (!blob || blob.size < 1000) throw new Error('Generated PDF is empty');

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Tax_Invoice_${activeReceipt.id.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
          fileName: `Tax_Invoice_${activeReceipt.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
          pdfBase64,
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
            <th className="p-1 text-left w-[38%]">Description of Goods</th>
            <th className="p-1 w-[11%]">HSN/SAC</th>
            <th className="p-1 w-[7%]">Qty</th>
            <th className="p-1 text-right w-[15%]">Rate ({settings.currency})</th>
            <th className="p-1 w-[6%]">per</th>
            <th className="p-1 text-right w-[17%]">Amount ({settings.currency})</th>
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
                      {item.serializedUnits!.length > 1 && <span className="font-bold">Unit {unitIndex + 1}: </span>}
                      <span className="block">{unit.trackingType === 'serial' ? 'Serial No.' : 'IMEI 1'}: {unit.imei1}</span>
                      {unit.imei2 && <span className="block">IMEI 2: {unit.imei2}</span>}
                    </span>
                  ))}
                </td>
                <td className="p-1 text-center font-mono">{hsnCode}</td>
                <td className="p-1 text-center font-bold">{item.quantity}</td>
                <td className="p-1 text-right font-mono whitespace-nowrap">{item.price.toFixed(2)}</td>
                <td className="p-1 text-center">Pcs</td>
                <td className="p-1 text-right font-bold font-mono whitespace-nowrap">{(item.price * item.quantity).toFixed(2)}</td>
              </tr>
            );
          })}

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
              <tr className="invoice-summary-row">
                <td colSpan={6} className="p-1 text-right font-semibold">CGST @ {(Number(rate) / 2).toFixed(1)}%</td>
                <td className="p-1 text-right font-mono font-semibold">{group.cgst.toFixed(2)}</td>
              </tr>
              <tr className="invoice-summary-row">
                <td colSpan={6} className="p-1 text-right font-semibold">SGST @ {(Number(rate) / 2).toFixed(1)}%</td>
                <td className="p-1 text-right font-mono font-semibold">{group.sgst.toFixed(2)}</td>
              </tr>
            </React.Fragment>
          ))}

          {/* Total Line */}
          <tr className="invoice-summary-row font-bold bg-gray-50 border-t border-black">
            <td colSpan={3} className="p-1 text-right">Total</td>
            <td className="p-1 text-center font-mono">{items.reduce((s, it) => s + it.quantity, 0)} Pcs</td>
            <td colSpan={2} className="p-1"></td>
            <td className="p-1 text-right font-mono text-[10.5px] whitespace-nowrap">{settings.currency}{activeReceipt.total.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {/* Amount in Words */}
      <div className="border-x border-b border-black p-1.5 font-bold text-[9.5px]">
        Amount Chargeable (in words): <span className="font-normal italic">{numberToWords(activeReceipt.total)}</span>
      </div>

      {/* Tax Breakdown Grid (Tally Standard HSN/SAC) */}
      <table className="invoice-tax-table w-full table-fixed tally-table-border border-collapse text-[8.5px] mt-1">
        <colgroup>
          <col className="w-[14%]" />
          <col className="w-[20%]" />
          <col className="w-[10%]" />
          <col className="w-[16%]" />
          <col className="w-[10%]" />
          <col className="w-[16%]" />
          <col className="w-[14%]" />
        </colgroup>
        <thead>
          <tr className="bg-gray-100 font-bold text-center">
            <th className="p-0.5">HSN/SAC</th>
            <th className="p-0.5">Taxable Value</th>
            <th className="p-0.5">CGST Rate</th>
            <th className="p-0.5">CGST Amount</th>
            <th className="p-0.5">SGST Rate</th>
            <th className="p-0.5">SGST Amount</th>
            <th className="p-0.5">Total Tax</th>
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
              <p className="whitespace-pre-line text-[8.5px] leading-tight text-gray-800">
                {settings.invoiceDeclaration?.trim() || 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.'}
              </p>
            </td>
            <td className="w-2/5 p-2 text-right align-top">
              <p className="font-bold uppercase">for {settings.storeName}</p>
              {settings.invoiceSignature ? (
                <div className="mt-2 flex h-8 items-center justify-end">
                  <img
                    src={settings.invoiceSignature}
                    alt="Authorised signature"
                    style={{
                      display: 'block',
                      width: 'auto',
                      height: 'auto',
                      maxWidth: '110px',
                      maxHeight: '30px',
                      marginLeft: 'auto',
                      marginRight: '8px',
                      objectFit: 'contain',
                      filter: 'contrast(1.8) brightness(1.15)'
                    }}
                  />
                </div>
              ) : (
                <div className="h-8" />
              )}
              <div className="mt-1 border-t border-black pt-1">
                <p className="font-bold uppercase text-[8.5px]">Authorised Signatory</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {upiQrCode && (
        <div className="flex items-center gap-2 border-x border-b border-black bg-white p-1.5">
          <img src={upiQrCode} alt="UPI payment QR" className="h-14 w-14 shrink-0" />
          <div className="text-[8px] leading-tight">
            <p className="font-bold">Scan to pay by UPI</p>
            <p>{settings.upiPayeeName || settings.storeName}</p>
            <p className="font-mono">{settings.upiId}</p>
            <p className="font-bold">Amount: {settings.currency}{activeReceipt.total.toFixed(2)}</p>
          </div>
        </div>
      )}

      <div className="bg-white py-1 text-center text-[8px] font-bold uppercase leading-normal text-gray-800">
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
        .tally-invoice-paper table {
          table-layout: fixed !important;
        }
        .tally-invoice-paper th,
        .tally-invoice-paper td {
          overflow-wrap: anywhere;
        }
        .tally-invoice-paper .invoice-summary-row th,
        .tally-invoice-paper .invoice-summary-row td {
          height: auto !important;
          padding-top: 2px !important;
          padding-bottom: 6px !important;
          line-height: 1.25 !important;
          vertical-align: top !important;
        }
        .tally-invoice-paper .invoice-tax-table th,
        .tally-invoice-paper .invoice-tax-table td {
          height: auto !important;
          padding: 2px 2px 6px !important;
          line-height: 1.25 !important;
          vertical-align: top !important;
          white-space: normal !important;
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

      <div className="relative my-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col rounded-xl border border-gray-800 bg-gray-900 p-2 shadow-2xl sm:max-h-[94vh] sm:p-3">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-900 shadow-lg transition hover:bg-gray-100"
          aria-label="Close invoice preview"
          title="Close invoice preview"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Printable / Preview A5 Paper Sheet */}
        <div ref={previewRef} className="flex min-h-0 flex-1 justify-center overflow-auto rounded-lg bg-gray-950/60 p-1 sm:p-3">
          
          <div 
            id="printable-tally-a5-invoice" 
            className="tally-invoice-paper w-full max-w-[148mm] bg-white text-black p-2 sm:p-5 shadow-2xl rounded-sm border border-black text-[8px] sm:text-[10px] leading-tight space-y-0"
            style={{ width: '100%', height: '100%', minHeight: '100%', maxWidth: '148mm', boxSizing: 'border-box' }}
          >
            {renderInvoiceContent()}
          </div>

        </div>

        {/* Action buttons footer */}
        <div className="mt-2 flex shrink-0 justify-center">
          <div className="flex items-center justify-center gap-2">
            {settings.whatsappInvoiceEnabled && <button
              onClick={sendInvoiceOnWhatsApp}
              disabled={isWhatsAppSending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-sm transition hover:bg-[#20bd5a] disabled:opacity-50"
              title="Send this invoice PDF through the configured Neospec WhatsApp Business number"
              aria-label={isWhatsAppSending ? 'Sending invoice on WhatsApp' : 'Send invoice on WhatsApp'}
            >
              {isWhatsAppSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <WhatsAppIcon className="h-5 w-5" />}
            </button>}
            <button
              onClick={downloadPDF}
              disabled={isPdfLoading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm transition hover:bg-sky-500 disabled:opacity-50"
              title="Download invoice PDF"
              aria-label={isPdfLoading ? 'Saving invoice PDF' : 'Download invoice PDF'}
            >
              {isPdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </button>
            <button
              onClick={printInvoice}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-5 text-xs font-bold text-white transition hover:bg-emerald-500"
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
