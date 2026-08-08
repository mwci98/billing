import { Armchair, ChevronDown, ClipboardList, Clock3, Search, ShoppingBag, Truck, UsersRound } from 'lucide-react';
import React, { useMemo, useState } from 'react';

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
  const { sales, settings } = useAppState();
  const [search, setSearch] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const openOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sales
      .filter(sale => sale.status === 'Pending' && sale.orderType)
      .filter(sale => !query || `${sale.id} ${sale.customerName} ${sale.tableNumber || ''} ${sale.orderType} ${sale.items.map(item => item.name).join(' ')}`.toLowerCase().includes(query))
      .sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime());
  }, [sales, search]);

  const totalOpenValue = openOrders.reduce((total, order) => total + order.total, 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-500">Restaurant queue</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Open orders</h1>
          <p className="mt-1 text-sm text-gray-500">Unpaid guest tickets waiting to be edited or settled at the counter.</p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#141416]">
          <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-500"><ClipboardList className="h-4 w-4" /></div>
          <div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Open value</p><p className="font-mono text-sm font-black text-emerald-500">{settings.currency}{totalOpenValue.toFixed(2)}</p></div>
        </div>
      </header>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search order number, table, guest or item..." className="restaurant-input pl-11" />
      </div>

      {openOrders.length ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {openOrders.map(order => {
            const Icon = orderIcon(order);
            const isExpanded = expandedOrderId === order.id;
            const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
            return (
              <article key={order.id} className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:border-emerald-500/35 hover:shadow-lg dark:border-white/10 dark:bg-[#141416]">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4 dark:border-white/5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-500"><Icon className="h-5 w-5" /></div>
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-black">{orderLabel(order)}</h2>
                      <p className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-gray-400">Order #{order.id}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-600 dark:text-amber-400">Open</span>
                </div>

                <div className="grid grid-cols-2 gap-3 p-4 text-xs">
                  <div className="rounded-2xl bg-gray-50 p-3 dark:bg-white/[0.035]"><p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Items</p><p className="mt-1 font-black">{itemCount} items</p></div>
                  <div className="rounded-2xl bg-gray-50 p-3 dark:bg-white/[0.035]"><p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Total</p><p className="mt-1 font-mono text-sm font-black text-emerald-500">{settings.currency}{order.total.toFixed(2)}</p></div>
                  {order.guestCount ? <div className="flex items-center gap-2 text-gray-500"><UsersRound className="h-3.5 w-3.5 text-emerald-500" />{order.guestCount} guests</div> : <div />}
                  <div className="flex items-center justify-end gap-2 text-right text-gray-500"><Clock3 className="h-3.5 w-3.5 text-emerald-500" />{new Date(order.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>

                <div className="border-t border-gray-100 p-3 dark:border-white/5">
                  <button type="button" onClick={() => setExpandedOrderId(isExpanded ? null : order.id)} className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-xs font-black text-gray-600 transition hover:bg-gray-50 hover:text-emerald-500 dark:text-gray-300 dark:hover:bg-white/[0.035]">
                    <span>{isExpanded ? 'Hide order details' : 'View order details'}</span><ChevronDown className={`h-4 w-4 transition ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  {isExpanded ? <div className="mt-2 space-y-2 rounded-2xl bg-gray-50 p-3 text-xs dark:bg-white/[0.035]">
                    {order.items.map((item, index) => <div key={`${item.productId}-${index}`} className="flex items-start justify-between gap-3"><span className="min-w-0"><span className="block font-bold">{item.name}</span><span className="text-[10px] text-gray-400">Qty {item.quantity}</span></span><span className="shrink-0 font-mono font-bold">{settings.currency}{(item.total + item.taxAmount).toFixed(2)}</span></div>)}
                    {order.kitchenNotes ? <div className="border-t border-dashed border-gray-300 pt-2 text-[11px] leading-5 text-gray-500 dark:border-white/10"><span className="font-black uppercase tracking-wide text-gray-400">Kitchen note: </span>{order.kitchenNotes}</div> : null}
                  </div> : null}
                </div>
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
    </div>
  );
};
