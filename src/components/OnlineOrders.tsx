import React, {useMemo, useState} from 'react';
import {Check, CheckCheck, ChefHat, Clock3, MapPin, PackageCheck, Phone, ShoppingBag, Store, X} from 'lucide-react';
import {auth} from '../lib/firebase';
import {useAppState} from '../lib/stateContext';
import {getBusinessMode} from '../lib/businessMode';
import {updateDevelopmentOnlineOrder} from '../lib/developmentOnlineOrders';
import {OnlineOrder, OnlineOrderStatus} from '../types';

type OrderAction = 'ACCEPT' | 'REJECT' | 'START_PREPARING' | 'MARK_READY' | 'COMPLETE' | 'CANCEL';

const statusLabels: Record<OnlineOrderStatus, string> = {
  PENDING_CONFIRMATION: 'New', ACCEPTED: 'Accepted', PREPARING: 'Preparing', READY: 'Ready',
  COMPLETED: 'Completed', CANCELLED: 'Cancelled', REJECTED: 'Rejected'
};

const actions: Partial<Record<OnlineOrderStatus, Array<{action: OrderAction; label: string; primary?: boolean}>>> = {
  PENDING_CONFIRMATION: [{action: 'ACCEPT', label: 'Accept order', primary: true}, {action: 'REJECT', label: 'Reject'}],
  ACCEPTED: [{action: 'START_PREPARING', label: 'Start preparing', primary: true}, {action: 'CANCEL', label: 'Cancel'}],
  PREPARING: [{action: 'MARK_READY', label: 'Mark ready', primary: true}, {action: 'CANCEL', label: 'Cancel'}],
  READY: [{action: 'COMPLETE', label: 'Complete sale', primary: true}, {action: 'CANCEL', label: 'Cancel'}]
};

const filters: Array<{value: 'ACTIVE' | OnlineOrderStatus | 'ALL'; label: string}> = [
  {value: 'ACTIVE', label: 'Active'}, {value: 'PENDING_CONFIRMATION', label: 'New'},
  {value: 'READY', label: 'Ready'}, {value: 'COMPLETED', label: 'Completed'}, {value: 'ALL', label: 'All'}
];

export const OnlineOrders: React.FC = () => {
  const {onlineOrders, settings, activeStore, currentUser, hasPermission, triggerToast} = useAppState();
  const [filter, setFilter] = useState<(typeof filters)[number]['value']>('ACTIVE');
  const [busyOrderId, setBusyOrderId] = useState('');
  const canManage = hasPermission('canManageOnlineOrders');
  const isRestaurant = getBusinessMode(settings.businessType) === 'Restaurant';
  const activeStatuses: OnlineOrderStatus[] = ['PENDING_CONFIRMATION', 'ACCEPTED', 'PREPARING', 'READY'];
  const visible = useMemo(() => onlineOrders.filter(order => filter === 'ALL' || (filter === 'ACTIVE' ? activeStatuses.includes(order.status) : order.status === filter)), [onlineOrders, filter]);

  const updateOrder = async (order: OnlineOrder, action: OrderAction) => {
    if (!canManage) return triggerToast('You can view orders but cannot update them.', 'warning');
    setBusyOrderId(order.id);
    try {
      if (import.meta.env.DEV) {
        await updateDevelopmentOnlineOrder(order, action, {id: currentUser?.id || 'local-owner', name: currentUser?.name || 'Local owner'});
        triggerToast(action === 'COMPLETE' ? 'Order completed and added to sales.' : 'Online order updated.', 'success');
        return;
      }
      if (!auth.currentUser) throw new Error('Sign in with Google to manage online orders.');
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch('/api/online-orders/action', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${idToken}`},
        body: JSON.stringify({workspaceScope: order.workspaceScope, orderId: order.id, action})
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'The order could not be updated');
      triggerToast(action === 'COMPLETE' ? 'Order completed and added to sales.' : 'Online order updated.', 'success');
    } catch (error) {
      triggerToast(error instanceof Error ? error.message : 'The order could not be updated', 'error');
    } finally {
      setBusyOrderId('');
    }
  };

  return <div className="mx-auto w-full max-w-7xl space-y-5 p-3 sm:p-6">
    <section className="flex flex-col gap-4 rounded-md border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#141416] sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-[10px] font-black uppercase text-emerald-600">{activeStore.name}</p><h1 className="mt-1 text-2xl font-black">{isRestaurant ? 'Restaurant Online Orders' : 'Online Orders'}</h1><p className="mt-1 text-sm text-gray-500">{isRestaurant ? 'Takeaway and delivery orders for this outlet.' : 'Customer orders, stock reservations, and fulfilment.'}</p></div>
      <div className="grid grid-cols-2 gap-2 sm:flex"><Metric label="New" value={onlineOrders.filter(order => order.status === 'PENDING_CONFIRMATION').length} /><Metric label="Active" value={onlineOrders.filter(order => activeStatuses.includes(order.status)).length} /></div>
    </section>

    <div className="flex gap-2 overflow-x-auto pb-1">{filters.map(item => <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black ${filter === item.value ? 'bg-gray-950 text-white dark:bg-white dark:text-black' : 'border border-gray-200 bg-white text-gray-600 dark:border-white/10 dark:bg-[#141416] dark:text-gray-300'}`}>{item.label}</button>)}</div>

    {visible.length ? <div className="grid gap-4 lg:grid-cols-2">{visible.map(order => <OrderCard key={order.id} order={order} currency={settings.currency} busy={busyOrderId === order.id} canManage={canManage} onAction={action => updateOrder(order, action)} />)}</div> : <div className="rounded-md border border-dashed border-gray-300 bg-white py-20 text-center dark:border-white/10 dark:bg-[#141416]"><ShoppingBag className="mx-auto h-9 w-9 text-gray-300" /><p className="mt-3 font-black">No {filter === 'ACTIVE' ? 'active' : filter.toLowerCase()} orders</p><p className="mt-1 text-sm text-gray-500">Orders for this store location will appear here.</p></div>}
  </div>;
};

const Metric = ({label, value}: {label: string; value: number}) => <div className="min-w-24 rounded-md bg-gray-50 px-4 py-3 dark:bg-white/5"><p className="text-[10px] font-black uppercase text-gray-400">{label}</p><p className="mt-1 font-mono text-xl font-black">{value}</p></div>;

const OrderCard: React.FC<{order: OnlineOrder; currency: string; busy: boolean; canManage: boolean; onAction: (action: OrderAction) => void}> = ({order, currency, busy, canManage, onAction}) => {
  const statusIcon = order.status === 'READY' ? <PackageCheck /> : order.status === 'COMPLETED' ? <CheckCheck /> : order.status === 'PREPARING' ? <ChefHat /> : order.status === 'CANCELLED' || order.status === 'REJECTED' ? <X /> : order.status === 'ACCEPTED' ? <Check /> : <Clock3 />;
  return <article className="overflow-hidden rounded-md border border-gray-200 bg-white dark:border-white/10 dark:bg-[#141416]">
    <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4 dark:border-white/5"><div><p className="font-mono text-sm font-black text-emerald-600">{order.orderNumber}</p><p className="mt-1 text-[11px] text-gray-500">{new Date(order.createdAt).toLocaleString()}</p></div><span className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-[10px] font-black uppercase dark:bg-white/10">{React.cloneElement(statusIcon, {className: 'h-3.5 w-3.5'})}{statusLabels[order.status]}</span></div>
    <div className="p-4"><div className="flex items-start justify-between gap-4"><div><h2 className="font-black">{order.customerName}</h2><p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500"><Phone className="h-3.5 w-3.5" />{order.customerPhone}</p>{order.customerAddress && <p className="mt-1 flex items-start gap-1.5 text-xs text-gray-500"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{order.customerAddress}</p>}</div><div className="text-right"><p className="font-mono text-lg font-black">{currency}{order.total.toFixed(2)}</p><p className="mt-1 text-[10px] font-black uppercase text-gray-400">{order.fulfilment.replace('_', ' ')} · {order.paymentMethod.replaceAll('_', ' ')}</p></div></div>
      <div className="mt-4 divide-y divide-gray-100 border-y border-gray-100 dark:divide-white/5 dark:border-white/5">{order.items.map((item, index) => <div key={`${item.productId}:${item.variantId || index}`} className="flex justify-between gap-3 py-2.5 text-xs"><span><strong>{item.quantity} ×</strong> {item.name}{item.variantName ? ` · ${item.variantName}` : ''}</span><span className="shrink-0 font-mono font-bold">{currency}{item.total.toFixed(2)}</span></div>)}</div>
      {order.customerNote && <div className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-900"><strong>Kitchen note:</strong> {order.customerNote}</div>}
      {actions[order.status]?.length ? <div className="mt-4 flex justify-end gap-2">{actions[order.status]!.map(item => <button key={item.action} type="button" disabled={busy || !canManage} onClick={() => onAction(item.action)} className={`min-h-10 rounded-md px-4 text-xs font-black disabled:opacity-40 ${item.primary ? 'bg-emerald-500 text-white' : 'border border-gray-200 text-gray-600 dark:border-white/10 dark:text-gray-300'}`}>{busy ? 'Updating...' : item.label}</button>)}</div> : null}
    </div>
  </article>;
};
