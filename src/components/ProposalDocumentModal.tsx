import React, {useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Download, Loader2, Printer, X} from 'lucide-react';
import html2canvas from 'html2canvas';
import {jsPDF} from 'jspdf';
import {Proposal, StoreSettings} from '../types';
import {proposalStatusLabel} from '../lib/proposalWorkflow';


export const ProposalDocumentModal: React.FC<{proposal: Proposal; settings: StoreSettings; onClose: () => void}> = ({proposal, settings, onClose}) => {
  const documentRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const createPdfSource = () => {
    if (!documentRef.current) return null;
    const source = documentRef.current.cloneNode(true) as HTMLElement;
    source.removeAttribute('id');
    source.dataset.pdfProposal = 'true';
    source.style.cssText = 'position:fixed;left:0;top:0;z-index:0;pointer-events:none;width:142mm;max-width:142mm;height:auto;min-height:0;padding:8mm;box-sizing:border-box;background:#fff;color:#0f172a';
    document.body.appendChild(source);
    return source;
  };
  const prepareClone = (clonedDocument: Document) => {
    const source = clonedDocument.querySelector<HTMLElement>('[data-pdf-proposal="true"]');
    if (!source) return;
    source.style.setProperty('background-color', '#ffffff', 'important');
    source.style.setProperty('color', '#0f172a', 'important');
    source.querySelectorAll<HTMLElement>('*').forEach(element => {
      const style = clonedDocument.defaultView?.getComputedStyle(element);
      if (!style) return;
      if (style.color.includes('oklch')) element.style.setProperty('color', '#334155', 'important');
      if (style.backgroundColor.includes('oklch')) element.style.setProperty('background-color', '#ffffff', 'important');
      if (style.borderColor.includes('oklch')) element.style.setProperty('border-color', '#cbd5e1', 'important');
    });
  };
  const download = async () => {
    const source = createPdfSource();
    if (!source) return;
    setDownloadError('');
    setIsDownloading(true);
    try {
      await document.fonts?.ready;
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const canvas = await html2canvas(source, {scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false, windowWidth: 794, scrollX: 0, scrollY: 0, onclone: prepareClone});
      if (!canvas.width || !canvas.height) throw new Error('Proposal canvas is empty');
      const pdf = new jsPDF({orientation: 'portrait', unit: 'mm', format: 'a5'});
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const availableWidth = pageWidth - 6;
      const availableHeight = pageHeight - 6;
      const pagePixelHeight = Math.floor(canvas.width * (availableHeight / availableWidth));
      for (let sourceY = 0, page = 0; sourceY < canvas.height; sourceY += pagePixelHeight, page += 1) {
        const sliceHeight = Math.min(pagePixelHeight, canvas.height - sourceY);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const context = pageCanvas.getContext('2d');
        if (!context) throw new Error('Unable to prepare proposal PDF page');
        context.fillStyle = '#ffffff'; context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        context.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
        if (page > 0) pdf.addPage('a5', 'portrait');
        pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.96), 'JPEG', 3, 3, availableWidth, sliceHeight / canvas.width * availableWidth);
      }
      const blob = pdf.output('blob');
      if (blob.size < 1000) throw new Error('Generated proposal PDF is empty');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `${proposal.id}.pdf`; document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setDownloadError(error instanceof Error ? error.message : 'Unable to download proposal PDF.'); }
    finally { source.remove(); setIsDownloading(false); }
  };
  return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm"><div className="flex max-h-[96vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-slate-100 shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3"><div><p className="text-sm font-black text-slate-900">Proposal preview</p><p className="text-xs font-bold uppercase tracking-wider text-amber-600">Not a tax invoice · no payment due</p></div><div className="flex gap-2"><button onClick={() => window.print()} className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label="Print proposal"><Printer className="h-4 w-4" /></button><button onClick={download} disabled={isDownloading} className="rounded-xl bg-slate-900 p-2 text-white hover:bg-slate-800 disabled:opacity-50" aria-label="Download proposal PDF">{isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</button><button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X className="h-4 w-4" /></button></div></div>{downloadError && <p className="bg-red-50 px-4 py-2 text-xs font-bold text-red-700">PDF download failed: {downloadError}</p>}<div className="overflow-auto overscroll-contain p-3 sm:p-7"><p className="mb-2 text-center text-xs text-slate-500 sm:hidden">Scroll sideways to inspect the full A5 document</p><div ref={documentRef} id="printable-proposal" className="mx-auto min-h-[190mm] w-[148mm] max-w-none bg-white p-8 text-slate-900 shadow-sm"><header className="border-b-4 border-slate-900 pb-5"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><p className="text-xl font-black">{settings.storeName}</p><p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{settings.address}<br />{settings.phone} {settings.email}</p></div><div className="sm:text-right"><h1 className="text-2xl font-black tracking-tight">PROPOSAL / QUOTATION</h1><p className="mt-1 text-xs font-bold text-amber-600">NOT AN INVOICE</p></div></div></header><section className="grid grid-cols-1 gap-5 border-b border-slate-200 py-5 text-xs sm:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Prepared for</p><p className="mt-1 font-black">{proposal.customerName}</p><p className="leading-5 text-slate-600">{proposal.customerCompanyName}<br />{proposal.customerPhone}<br />{proposal.customerBillingAddress}</p></div><div className="sm:text-right"><p><b>Proposal:</b> {proposal.id}</p><p><b>Date:</b> {new Date(proposal.createdAt).toLocaleDateString('en-IN')}</p><p><b>Valid until:</b> {new Date(proposal.validUntil).toLocaleDateString('en-IN')}</p><p className="mt-2 inline-block rounded-md bg-amber-50 px-2 py-1 font-bold text-amber-700">{proposalStatusLabel(proposal.status)}</p></div></section><table className="my-5 w-full border-collapse text-left text-xs"><thead><tr className="border-y border-slate-300 bg-slate-50"><th className="p-2">Item</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">Tax</th><th className="p-2 text-right">Amount</th></tr></thead><tbody>{proposal.items.map((item, index) => <tr key={`${item.productId}-${index}`} className="border-b border-slate-100"><td className="p-2"><b>{item.name}</b><br /><span className="text-slate-400">{item.sku}</span></td><td className="p-2 text-right">{item.quantity}</td><td className="p-2 text-right">{settings.currency}{item.price.toFixed(2)}</td><td className="p-2 text-right">{item.taxRate}%</td><td className="p-2 text-right font-bold">{settings.currency}{(item.total + item.taxAmount).toFixed(2)}</td></tr>)}</tbody></table><div className="ml-auto w-64 space-y-2 border-t-2 border-slate-900 pt-3 text-xs"><div className="flex justify-between"><span>Subtotal</span><b>{settings.currency}{proposal.subtotal.toFixed(2)}</b></div><div className="flex justify-between"><span>Tax</span><b>{settings.currency}{proposal.taxAmount.toFixed(2)}</b></div><div className="flex justify-between"><span>Discount</span><b>-{settings.currency}{proposal.discount.toFixed(2)}</b></div><div className="flex justify-between border-t border-slate-300 pt-2 text-base"><span className="font-black">Proposal total</span><b>{settings.currency}{proposal.total.toFixed(2)}</b></div></div><footer className="mt-12 border-t border-slate-200 pt-4 text-[11px] leading-5 text-slate-500"><b>This document is a proposal/quotation only.</b> It is not a tax invoice, payment receipt, or proof of sale. Prices and availability are subject to confirmation until conversion to a final invoice.</footer></div></div></div></div>, document.body);
};
