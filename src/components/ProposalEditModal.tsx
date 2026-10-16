import React, {useMemo, useState} from 'react';
import {Plus, Save, Trash2, X} from 'lucide-react';
import {Product, Proposal, SaleItem} from '../types';

type EditableLine = SaleItem & {grossUnitPrice: number};

const toEditable = (item: SaleItem): EditableLine => ({...item, grossUnitPrice: item.price * (1 + item.taxRate / 100)});

export const ProposalEditModal: React.FC<{
  proposal: Proposal;
  products: Product[];
  currency: string;
  onClose: () => void;
  onSave: (changes: Partial<Proposal>) => Promise<void>;
}> = ({proposal, products, currency, onClose, onSave}) => {
  const [customerName, setCustomerName] = useState(proposal.customerName);
  const [customerPhone, setCustomerPhone] = useState(proposal.customerPhone || '');
  const [customerEmail, setCustomerEmail] = useState(proposal.customerEmail || '');
  const [customerAddress, setCustomerAddress] = useState(proposal.customerBillingAddress || '');
  const [validUntil, setValidUntil] = useState(proposal.validUntil.slice(0, 10));
  const [discount, setDiscount] = useState(proposal.discount);
  const [lines, setLines] = useState<EditableLine[]>(proposal.items.map(toEditable));
  const [productId, setProductId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const totals = useMemo(() => {
    const gross = lines.reduce((sum, line) => sum + line.grossUnitPrice * line.quantity, 0);
    const tax = lines.reduce((sum, line) => sum + (line.grossUnitPrice * line.quantity) - ((line.grossUnitPrice * line.quantity) / (1 + line.taxRate / 100)), 0);
    return {gross, tax, subtotal: gross - tax, total: Math.max(0, gross - discount)};
  }, [lines, discount]);
  const addLine = () => {
    const product = products.find(item => item.id === productId);
    if (!product || lines.some(line => line.productId === product.id)) return;
    setLines(current => [...current, {productId: product.id, name: product.name, sku: product.sku, barcode: product.barcode, price: 0, quantity: 1, taxRate: product.taxRate, taxAmount: 0, total: 0, grossUnitPrice: product.sellingPrice}]);
    setProductId('');
  };
  const save = async () => {
    setError('');
    if (!customerName.trim()) return setError('Customer name is required.');
    if (!lines.length) return setError('Add at least one proposal item.');
    const valid = new Date(`${validUntil}T23:59:59`);
    if (!validUntil || Number.isNaN(valid.getTime()) || valid < new Date()) return setError('Valid-until date must be today or later.');
    if (lines.some(line => line.quantity <= 0 || line.grossUnitPrice < 0)) return setError('Quantities and prices must be valid.');
    const items: SaleItem[] = lines.map(({grossUnitPrice, ...line}) => {
      const gross = grossUnitPrice * line.quantity;
      const taxableUnit = grossUnitPrice / (1 + line.taxRate / 100);
      return {...line, price: taxableUnit, total: taxableUnit * line.quantity, taxAmount: gross - taxableUnit * line.quantity, serializedUnits: undefined};
    });
    setSaving(true);
    try {
      await onSave({customerName: customerName.trim(), customerPhone: customerPhone.trim() || undefined, customerEmail: customerEmail.trim() || undefined, customerBillingAddress: customerAddress.trim() || undefined, validUntil: valid.toISOString(), items, subtotal: totals.subtotal, taxAmount: totals.tax, discount, total: totals.total});
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save proposal.'); }
    finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-[110] flex justify-end bg-slate-950/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Edit proposal">
    <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl dark:bg-[#111112]">
      <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10"><div><p className="text-base font-black">Edit proposal</p><p className="mt-0.5 text-xs text-slate-500">Changes stay in the proposal and do not affect stock.</p></div><button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Close editor"><X className="h-5 w-5" /></button></header>
      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        <section><h3 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">Customer & validity</h3><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Customer name<input value={customerName} onChange={e => setCustomerName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-normal dark:border-white/10 dark:bg-black/20" /></label><label className="text-xs font-bold">Phone<input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-normal dark:border-white/10 dark:bg-black/20" /></label><label className="text-xs font-bold">Email<input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-normal dark:border-white/10 dark:bg-black/20" /></label><label className="text-xs font-bold">Valid until<input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-normal dark:border-white/10 dark:bg-black/20" /></label><label className="text-xs font-bold sm:col-span-2">Billing address<textarea value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} rows={2} className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-normal dark:border-white/10 dark:bg-black/20" /></label></div></section>
        <section><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Line items</h3><span className="text-xs text-slate-400">No stock is reserved</span></div><div className="flex gap-2"><select value={productId} onChange={e => setProductId(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs dark:border-white/10 dark:bg-[#141416]"><option value="">Add catalog item…</option>{products.filter(product => !lines.some(line => line.productId === product.id)).map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select><button onClick={addLine} disabled={!productId} className="flex items-center gap-1 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900"><Plus className="h-4 w-4" /> Add</button></div><div className="mt-3 space-y-2">{lines.map((line, index) => <div key={line.productId} className="grid grid-cols-[1fr_70px_100px_36px] items-end gap-2 rounded-xl border border-slate-200 p-3 dark:border-white/10"><div className="min-w-0"><p className="truncate text-xs font-black">{line.name}</p><p className="text-[11px] text-slate-500">{line.sku} · GST {line.taxRate}%</p></div><label className="text-[11px] font-bold text-slate-500">Qty<input type="number" min="1" value={line.quantity} onChange={e => setLines(current => current.map((item, i) => i === index ? {...item, quantity: Math.max(1, Number(e.target.value))} : item))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-right text-xs dark:border-white/10 dark:bg-black/20" /></label><label className="text-[11px] font-bold text-slate-500">Unit price<input type="number" min="0" value={line.grossUnitPrice} onChange={e => setLines(current => current.map((item, i) => i === index ? {...item, grossUnitPrice: Math.max(0, Number(e.target.value))} : item))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-right text-xs dark:border-white/10 dark:bg-black/20" /></label><button onClick={() => setLines(current => current.filter((_, i) => i !== index))} className="rounded-lg p-2 text-red-500 hover:bg-red-50" aria-label={`Remove ${line.name}`}><Trash2 className="h-4 w-4" /></button></div>)}</div></section>
        <section className="ml-auto w-full max-w-sm space-y-2 rounded-2xl bg-slate-50 p-4 text-xs dark:bg-white/5"><div className="flex justify-between"><span>Subtotal</span><b>{currency}{totals.subtotal.toFixed(2)}</b></div><div className="flex justify-between"><span>Tax</span><b>{currency}{totals.tax.toFixed(2)}</b></div><label className="flex items-center justify-between">Discount<input type="number" min="0" value={discount} onChange={e => setDiscount(Math.max(0, Number(e.target.value)))} className="w-28 rounded-lg border border-slate-200 p-2 text-right font-mono dark:border-white/10 dark:bg-black/20" /></label><div className="flex justify-between border-t border-slate-200 pt-2 text-base dark:border-white/10"><b>Total</b><b>{currency}{totals.total.toFixed(2)}</b></div></section>
        {error && <p className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
      </div>
      <footer className="flex justify-end gap-2 border-t border-slate-200 p-4 dark:border-white/10"><button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold dark:border-white/10">Cancel</button><button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-slate-950 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save changes'}</button></footer>
    </div>
  </div>;
};
