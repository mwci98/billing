import { Armchair, ClipboardList, EllipsisVertical, Search, ShoppingBag, Truck, Pencil, ReceiptText } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Sale } from '../types';
import { useAppState } from '../lib/stateContext';

function orderLabel(order: Sale) {
  return order.tableNumber ? `Table ${order.tableNumber}` : order.orderType || 'Guest order';
}

function orderIcon(order: Sale) {
  if (order.orderType === 'Delivery') return Truck;
  if (order.orderType === 'Takeaway') return ShoppingBag;
  return Armchair;
}

export const RestaurantOpenOrders: React.FC = () => {
  const { sales, settings, requestRestaurantOrderEdit, requestRestaurantOrderSettlement, setActiveTab, triggerToast } = useAppState();
  const [search, setSearch] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [orderFilter, setOrderFilter] = useState<'All' | 'Dine In' | 'Takeaway' | 'Delivery'>('All');
  const [settlingOrder, setSettlingOrder] = useState<Sale | null>(null);

  const openOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sales
      .filter(sale => sale.status === 'Pending' && sale.orderType)
      .filter(sale => !query || `${sale.id} ${sale.customerName} ${sale.tableNumber || ''} ${sale.orderType} ${sale.items.map(item => item.name).join(' ')}`.toLowerCase().includes(query))
      .sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime());
  }, [sales, search]);

  const visibleOrders = openOrders.filter(order => orderFilter === 'All' || order.orderType === orderFilter);
  const totalOpenValue = visibleOrders.reduce((total, order) => total + order.total, 0);
  const totalItems = visibleOrders.reduce((total, order) => total + order.items.reduce((itemTotal, item) => itemTotal + item.quantity, 0), 0);
  const filters = [
    {label: 'All', value: 'All' as const, count: openOrders.length},
    {label: 'Dine in', value: 'Dine In' as const, count: openOrders.filter(order => order.orderType === 'Dine In').length},
    {label: 'Takeaway', value: 'Takeaway' as const, count: openOrders.filter(order => order.orderType === 'Takeaway').length},
    {label: 'Delivery', value: 'Delivery' as const, count: openOrders.filter(order => order.orderType === 'Delivery').length},
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <header>
        <h1 className="text-2xl font-black sm:text-3xl">Open orders</h1>
        <p className="mt-1 text-sm text-gray-500">All ongoing orders across your restaurant.</p>
      </header>

      <div className="touch-scroll flex gap-2 overflow-x-auto pb-1">
        {filters.map(filter => <button key={filter.value} type="button" onClick={() => setOrderFilter(filter.value)} className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-black transition ${orderFilter === filter.value ? 'bg-emerald-500 text-[#06130E] shadow-sm shadow-emerald-500/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10'}`}>{filter.label} <span className="opacity-70">({filter.count})</span></button>)}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search order number, table, guest or item..." className="restaurant-input pl-11" />
      </div>

      {visibleOrders.length ? (
        <div className="space-y-2.5">
          {visibleOrders.map(order => {
            const Icon = orderIcon(order);
            const isExpanded = expandedOrderId === order.id;
            const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
            return (
              <article key={order.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:border-emerald-500/35 dark:border-white/10 dark:bg-[#141416]">
                <div className="flex items-center gap-3 p-3.5">
                  <div className={`rounded-2xl p-3 ${order.orderType === 'Delivery' ? 'bg-violet-500/10 text-violet-500' : order.orderType === 'Takeaway' ? 'bg-blue-500/10 text-blue-500' : 'bg-emerald-500/10 text-emerald-500'}`}><Icon className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-black">{order.orderType === 'Dine In' ? `Dine In · ${orderLabel(order)}` : order.orderType}</h2>
                    <p className="mt-0.5 text-[10px] font-bold text-gray-400">Order #{order.id}</p>
                    <p className="mt-0.5 text-[10px] font-bold text-gray-500">{itemCount} items <span className="px-1 text-gray-300 dark:text-white/20">·</span> {new Date(order.date).toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})}</p>
                    <p className="mt-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{order.guestCount ? `Guests: ${order.guestCount}` : order.customerName || 'Guest order'}</p>
                  </div>
                  <div className="shrink-0 text-right"><p className="font-mono text-sm font-black text-emerald-500">{settings.currency}{order.total.toFixed(2)}</p><span className="mt-2 inline-flex rounded-lg bg-amber-500/10 px-2 py-1 text-[9px] font-black text-amber-600 dark:text-amber-400">In progress</span></div>
                  <button type="button" onClick={() => setExpandedOrderId(isExpanded ? null : order.id)} aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${order.id}`} aria-expanded={isExpanded} aria-controls={`order-actions-${order.id}`} className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:hover:bg-white/5"><EllipsisVertical className="h-5 w-5" /></button>
                </div>
                {isExpanded ? <div id={`order-actions-${order.id}`} role="region" aria-label={`Actions and details for order ${order.id}`} className="border-t border-gray-100 bg-gray-50 p-3.5 text-xs dark:border-white/5 dark:bg-white/[0.025]">
                  <div className="space-y-2">{order.items.map((item, index) => <div key={`${item.productId}-${index}`} className="flex items-start justify-between gap-3"><span className="min-w-0"><span className="block font-bold">{item.name}</span><span className="text-[10px] text-gray-400">Qty {item.quantity}</span></span><span className="shrink-0 font-mono font-bold">{settings.currency}{(item.total + item.taxAmount).toFixed(2)}</span></div>)}</div>
                  {order.kitchenNotes ? <p className="mt-3 border-t border-dashed border-gray-300 pt-3 text-[11px] leading-5 text-gray-500 dark:border-white/10"><span className="font-black text-gray-400">Kitchen note: </span>{order.kitchenNotes}</p> : null}
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-200 pt-3 dark:border-white/10">
                    <button type="button" onClick={() => { requestRestaurantOrderEdit(order.id); setActiveTab('pos'); }} className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 px-3 py-2.5 text-xs font-black text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"><Pencil className="h-3.5 w-3.5" />Edit order</button>
                    <button type="button" onClick={() => setSettlingOrder(order)} className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-black text-[#07110D] hover:bg-emerald-400"><ReceiptText className="h-3.5 w-3.5" />Generate final bill</button>
                  </div>
                </div> : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 bg-white p-8 text-center dark:border-white/10 dark:bg-[#141416]">
          <ClipboardList className="mb-4 h-9 w-9 text-emerald-500/60" />
          <h2 className="font-black">No open orders</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">New restaurant tickets will appear here after they are saved as open orders.</p>
        </div>
      )}
      {settlingOrder ? <SettlementSheet order={settlingOrder} currency={settings.currency} onClose={() => setSettlingOrder(null)} onConfirm={(method) => {
        if (settlingOrder.status !== 'Pending') { triggerToast('This order has already been settled.', 'warning'); setSettlingOrder(null); return; }
        requestRestaurantOrderSettlement(settlingOrder.id, method); setSettlingOrder(null); setActiveTab('pos');
      }} /> : null}
      <div className="grid grid-cols-3 divide-x divide-gray-200 rounded-2xl border border-gray-200 bg-white py-3 text-center dark:divide-white/10 dark:border-white/10 dark:bg-[#141416]"><div><p className="text-[9px] font-bold text-gray-400">Total open orders</p><p className="text-sm font-black">{visibleOrders.length}</p></div><div><p className="text-[9px] font-bold text-gray-400">Total items</p><p className="text-sm font-black">{totalItems}</p></div><div><p className="text-[9px] font-bold text-gray-400">Total amount</p><p className="font-mono text-sm font-black text-emerald-500">{settings.currency}{totalOpenValue.toFixed(2)}</p></div></div>
    </div>
  );
};

function SettlementSheet({order, currency, onClose, onConfirm}: {order: Sale; currency: string; onClose: () => void; onConfirm: (method: 'Cash' | 'UPI') => void}) {
  const [method, setMethod] = useState<'Cash' | 'UPI'>('Cash');
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => { dialogRef.current?.focus(); const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, [onClose]);
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center"><div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="settle-title" className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-[#141416]"><h2 id="settle-title" className="text-lg font-black">Generate final bill</h2><p className="mt-1 text-sm text-gray-500">Choose payment and confirm settlement for order #{order.id}.</p><p className="mt-4 flex items-center justify-between rounded-2xl bg-emerald-500/10 px-4 py-3 font-mono text-xl font-black text-emerald-600"><span className="text-xs font-sans uppercase tracking-widest">Total</span>{currency}{order.total.toFixed(2)}</p><div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment method">{(['Cash', 'UPI'] as const).map(option => <button key={option} type="button" role="radio" aria-checked={method === option} onClick={() => setMethod(option)} className={`rounded-xl border px-3 py-3 text-sm font-black ${method === option ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600' : 'border-gray-200 text-gray-500 dark:border-white/10'}`}>{option}</button>)}</div><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-gray-200 py-3 text-sm font-black text-gray-500 dark:border-white/10">Cancel</button><button type="button" onClick={() => onConfirm(method)} className="rounded-xl bg-emerald-500 py-3 text-sm font-black text-[#07110D]">Confirm settlement</button></div></div></div>;
}
