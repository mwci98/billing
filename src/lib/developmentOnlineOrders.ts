import {doc, runTransaction} from 'firebase/firestore';
import {db} from './firebase';
import {OnlineOrder} from '../types';

export type DevelopmentOrderAction = 'ACCEPT' | 'REJECT' | 'START_PREPARING' | 'MARK_READY' | 'COMPLETE' | 'CANCEL';

const transitions: Record<DevelopmentOrderAction, Partial<Record<OnlineOrder['status'], OnlineOrder['status']>>> = {
  ACCEPT: {PENDING_CONFIRMATION: 'ACCEPTED'},
  REJECT: {PENDING_CONFIRMATION: 'REJECTED'},
  START_PREPARING: {ACCEPTED: 'PREPARING'},
  MARK_READY: {PREPARING: 'READY'},
  COMPLETE: {READY: 'COMPLETED'},
  CANCEL: {PENDING_CONFIRMATION: 'CANCELLED', ACCEPTED: 'CANCELLED', PREPARING: 'CANCELLED', READY: 'CANCELLED'}
};

export const updateDevelopmentOnlineOrder = async (order: OnlineOrder, action: DevelopmentOrderAction, actor: {id: string; name: string}) => {
  if (!import.meta.env.DEV) throw new Error('Development order actions are unavailable');
  const orderRef = doc(db, 'users', order.workspaceScope, 'online_orders', order.id);
  return runTransaction(db, async transaction => {
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists()) throw new Error('Order not found');
    const current = orderSnapshot.data() as OnlineOrder;
    const nextStatus = transitions[action][current.status];
    if (!nextStatus) throw new Error('That action is not available for this order');
    const quantities = new Map<string, number>();
    current.items.forEach(item => quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity));
    const productRefs = Array.from(quantities.keys()).map(productId => doc(db, 'users', current.workspaceScope, 'products', productId));
    const productSnapshots = await Promise.all(productRefs.map(reference => transaction.get(reference)));
    const now = new Date().toISOString();

    if (action === 'ACCEPT') {
      productSnapshots.forEach(snapshot => {
        if (!snapshot.exists()) throw new Error('A product no longer exists');
        const product = snapshot.data();
        if (product.itemType !== 'Service' && Number(product.stock || 0) - Number(product.reservedStock || 0) < Number(quantities.get(snapshot.id) || 0)) throw new Error('Not enough available stock to accept this order');
      });
      productSnapshots.forEach(snapshot => {
        const product = snapshot.data();
        if (product.itemType !== 'Service') transaction.update(snapshot.ref, {reservedStock: Number(product.reservedStock || 0) + Number(quantities.get(snapshot.id) || 0), updatedAt: now});
      });
    }

    const release = action === 'CANCEL' && current.reservationActive;
    if (release) productSnapshots.forEach(snapshot => {
      if (!snapshot.exists() || snapshot.data().itemType === 'Service') return;
      transaction.update(snapshot.ref, {reservedStock: Math.max(0, Number(snapshot.data().reservedStock || 0) - Number(quantities.get(snapshot.id) || 0)), updatedAt: now});
    });

    let saleId: string | undefined;
    if (action === 'COMPLETE') {
      saleId = `sale-${Math.floor(100000 + Math.random() * 900000)}`;
      productSnapshots.forEach((snapshot, index) => {
        if (!snapshot.exists()) throw new Error('A product no longer exists');
        const product = snapshot.data();
        if (product.itemType === 'Service') return;
        const quantity = Number(quantities.get(snapshot.id) || 0);
        if (Number(product.stock || 0) < quantity || Number(product.reservedStock || 0) < quantity) throw new Error('The stock reservation is incomplete');
        const nextStock = Number(product.stock || 0) - quantity;
        transaction.update(snapshot.ref, {stock: nextStock, reservedStock: Math.max(0, Number(product.reservedStock || 0) - quantity), updatedAt: now});
        const transactionId = `tx-${Date.now()}-${index}`;
        transaction.set(doc(db, 'users', current.workspaceScope, 'inventory_transactions', transactionId), {id: transactionId, productId: snapshot.id, productName: product.name, sku: product.sku || '', type: 'Sale', quantity, previousStock: Number(product.stock || 0), newStock: nextStock, description: `Online order ${current.orderNumber} completed.`, date: now, operatorId: actor.id, operatorName: actor.name});
      });
      const saleItems = current.items.map(item => ({productId: item.productId, name: item.variantName ? `${item.name} - ${item.variantName}` : item.name, sku: item.sku, barcode: '', price: item.total / item.quantity, quantity: item.quantity, taxRate: item.taxRate, taxAmount: item.taxAmount, total: item.total, ...(item.variantId ? {menuVariantId: item.variantId, menuVariantName: item.variantName} : {})}));
      const paymentMethod = current.paymentMethod === 'ONLINE' ? 'UPI' : 'Cash';
      const restaurantFields = current.businessMode === 'Restaurant' ? {orderType: current.fulfilment === 'DELIVERY' ? 'Delivery' : 'Takeaway', kitchenNotes: current.customerNote || undefined} : {};
      transaction.set(doc(db, 'users', current.workspaceScope, 'sales', saleId), {id: saleId, customerName: current.customerName, customerPhone: current.customerPhone, items: saleItems, subtotal: current.subtotal + current.deliveryCharge, taxAmount: current.taxAmount, discount: 0, total: current.total, paymentMethod, paymentDetails: paymentMethod === 'Cash' ? {cashAmount: current.total} : {upiAmount: current.total}, loyaltyPointsEarned: 0, date: now, authId: actor.id, employeeName: actor.name, status: 'Completed', source: 'ONLINE_STORE', onlineOrderId: current.id, ...restaurantFields});
    }

    const event = action === 'ACCEPT' ? 'ORDER_ACCEPTED' : action === 'REJECT' ? 'ORDER_REJECTED' : action === 'CANCEL' ? 'ORDER_CANCELLED' : action === 'COMPLETE' ? 'ORDER_COMPLETED' : `ORDER_${nextStatus}`;
    const auditTrail = [...(current.auditTrail || []), {event, at: now, actor: actor.name}, ...(action === 'ACCEPT' ? [{event: 'STOCK_RESERVED', at: now, actor: actor.name}] : release ? [{event: 'STOCK_RELEASED', at: now, actor: actor.name}] : [])];
    transaction.update(orderRef, {status: nextStatus, updatedAt: now, reservationActive: action === 'ACCEPT' ? true : action === 'COMPLETE' || release ? false : current.reservationActive, ...(action === 'COMPLETE' ? {paymentStatus: 'PAID'} : {}), ...(saleId ? {saleId} : {}), auditTrail});
    return nextStatus;
  });
};
