import {hashValue, ownerScopeFromToken, verifyBearer} from '../_online-store.js';
import {getAdminDb} from '../_firebase-admin.js';

const transitions: Record<string, Record<string, string>> = {
  ACCEPT: {PENDING_CONFIRMATION: 'ACCEPTED'},
  REJECT: {PENDING_CONFIRMATION: 'REJECTED'},
  START_PREPARING: {ACCEPTED: 'PREPARING'},
  MARK_READY: {PREPARING: 'READY'},
  COMPLETE: {READY: 'COMPLETED'},
  CANCEL: {PENDING_CONFIRMATION: 'CANCELLED', ACCEPTED: 'CANCELLED', PREPARING: 'CANCELLED', READY: 'CANCELLED'},
};

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') return response.status(405).json({error: 'Method not allowed'});
  try {
    const decoded = await verifyBearer(request);
    const workspaceScope = String(request.body?.workspaceScope || '');
    const orderId = String(request.body?.orderId || '');
    const action = String(request.body?.action || '').toUpperCase();
    if (!/^[a-zA-Z0-9_-]{3,180}$/.test(workspaceScope) || !/^ord-[a-zA-Z0-9-]+$/.test(orderId) || !transitions[action]) {
      return response.status(400).json({error: 'Invalid order action'});
    }
    const ownerScope = workspaceScope.split('__store__')[0];
    const db = getAdminDb();
    const ownerSettings = (await db.doc(`users/${ownerScope}/store_settings/active`).get()).data() || {};
    const tokenOwnerScope = ownerScopeFromToken(decoded);
    if (tokenOwnerScope !== ownerScope && String(ownerSettings.email || '').toLowerCase() !== String(decoded.email || '').toLowerCase()) {
      return response.status(403).json({error: 'This account cannot manage that location'});
    }

    const orderRef = db.doc(`users/${workspaceScope}/online_orders/${orderId}`);
    const outcome = await db.runTransaction(async transaction => {
      const orderSnapshot = await transaction.get(orderRef);
      if (!orderSnapshot.exists) throw new Error('ORDER_NOT_FOUND');
      const order = orderSnapshot.data() as any;
      const nextStatus = transitions[action][order.status];
      if (!nextStatus) throw new Error('INVALID_TRANSITION');
      const quantities = new Map<string, number>();
      order.items.forEach((item: any) => quantities.set(item.productId, (quantities.get(item.productId) || 0) + Number(item.quantity || 0)));
      const productRefs = Array.from(quantities.keys()).map(productId => db.doc(`users/${workspaceScope}/products/${productId}`));
      const customerId = `online-${hashValue(order.customerPhone).slice(0, 16)}`;
      const customerRef = db.doc(`users/${workspaceScope}/customers/${customerId}`);
      const [customerSnapshot, ...productSnapshots] = await Promise.all([transaction.get(customerRef), ...productRefs.map((ref: any) => transaction.get(ref))]);
      const now = new Date().toISOString();
      const actor = String(decoded.email || decoded.uid || 'OWNER');

      if (action === 'ACCEPT') {
        productSnapshots.forEach((snapshot: any, index: number) => {
          if (!snapshot.exists) throw new Error('PRODUCT_UNAVAILABLE');
          const product = snapshot.data();
          if (product.itemType === 'Service') return;
          const requested = Number(quantities.get(snapshot.id) || 0);
          const available = Number(product.stock || 0) - Number(product.reservedStock || 0);
          if (available < requested) throw new Error('STOCK_CHANGED');
        });
        productSnapshots.forEach((snapshot: any, index: number) => {
          const product = snapshot.data();
          if (product.itemType === 'Service') return;
          transaction.update(snapshot.ref, {reservedStock: Number(product.reservedStock || 0) + Number(quantities.get(snapshot.id) || 0), updatedAt: now});
        });
      }

      const releasesReservation = action === 'CANCEL' && order.reservationActive;
      if (releasesReservation) {
        productSnapshots.forEach((snapshot: any, index: number) => {
          if (!snapshot.exists || snapshot.data().itemType === 'Service') return;
          transaction.update(snapshot.ref, {reservedStock: Math.max(0, Number(snapshot.data().reservedStock || 0) - Number(quantities.get(snapshot.id) || 0)), updatedAt: now});
        });
      }

      let saleId: string | undefined;
      if (action === 'COMPLETE') {
        saleId = `sale-${Math.floor(100000 + Math.random() * 900000)}`;
        productSnapshots.forEach((snapshot: any, index: number) => {
          if (!snapshot.exists) throw new Error('PRODUCT_UNAVAILABLE');
          const product = snapshot.data();
          if (product.itemType === 'Service') return;
          const quantity = Number(quantities.get(snapshot.id) || 0);
          if (Number(product.stock || 0) < quantity || Number(product.reservedStock || 0) < quantity) throw new Error('RESERVATION_MISSING');
          let serializedUnits = product.serializedUnits;
          if (product.trackInventoryByImei || product.inventoryTrackingType === 'imei' || product.inventoryTrackingType === 'serial') {
            let remaining = quantity;
            serializedUnits = (serializedUnits || []).map((unit: any) => {
              if (remaining > 0 && (unit.status === 'In Stock' || unit.status === 'Returned')) {
                remaining -= 1;
                return {...unit, status: 'Sold', soldAt: now, saleId};
              }
              return unit;
            });
            if (remaining > 0) throw new Error('SERIAL_ASSIGNMENT_FAILED');
          }
          const nextStock = Number(product.stock || 0) - quantity;
          transaction.update(snapshot.ref, {stock: nextStock, reservedStock: Math.max(0, Number(product.reservedStock || 0) - quantity), ...(serializedUnits ? {serializedUnits, imeiNumbers: serializedUnits.filter((unit: any) => unit.status !== 'Sold').flatMap((unit: any) => [unit.imei1, unit.imei2].filter(Boolean))} : {}), updatedAt: now});
          const transactionId = `tx-${Date.now()}-${index}`;
          transaction.set(db.doc(`users/${workspaceScope}/inventory_transactions/${transactionId}`), {id: transactionId, productId: snapshot.id, productName: product.name, sku: product.sku || '', type: 'Sale', quantity, previousStock: Number(product.stock || 0), newStock: nextStock, description: `Online order ${order.orderNumber} completed.`, date: now, operatorId: decoded.uid, operatorName: actor});
        });
        const saleItems = order.items.map((item: any) => ({productId: item.productId, name: item.name, sku: item.sku, barcode: '', price: Number(item.total) / Number(item.quantity), quantity: item.quantity, taxRate: item.taxRate, taxAmount: item.taxAmount, total: item.total, ...(item.variantId ? {menuVariantId: item.variantId, menuVariantName: item.variantName} : {})}));
        if (Number(order.deliveryCharge || 0) > 0) saleItems.push({productId: 'online-delivery', name: 'Local delivery', sku: 'DELIVERY', barcode: '', price: order.deliveryCharge, quantity: 1, taxRate: 0, taxAmount: 0, total: order.deliveryCharge});
        const paymentMethod = order.paymentMethod === 'ONLINE' ? 'UPI' : 'Cash';
        const restaurantFields = order.businessMode === 'Restaurant' ? {orderType: order.fulfilment === 'DELIVERY' ? 'Delivery' : 'Takeaway', kitchenNotes: order.customerNote || undefined} : {};
        const sale = {id: saleId, customerId, customerName: order.customerName, customerPhone: order.customerPhone, ...(order.customerAddress ? {customerShippingAddress: order.customerAddress} : {}), items: saleItems, subtotal: Number(order.subtotal) + Number(order.deliveryCharge || 0), taxAmount: order.taxAmount, discount: 0, total: order.total, paymentMethod, paymentDetails: paymentMethod === 'Cash' ? {cashAmount: order.total} : {upiAmount: order.total, referenceNo: order.paymentReference || 'Online payment'}, loyaltyPointsEarned: 0, date: now, authId: decoded.uid, employeeName: actor, status: 'Completed', source: 'ONLINE_STORE', onlineOrderId: order.id, ...restaurantFields};
        transaction.create(db.doc(`users/${workspaceScope}/sales/${saleId}`), sale);
        const customer = customerSnapshot.data();
        transaction.set(customerRef, customer ? {...customer, name: order.customerName, phone: order.customerPhone, shippingAddress: order.customerAddress || customer.shippingAddress, totalSpent: Number(customer.totalSpent || 0) + Number(order.total)} : {id: sale.customerId, name: order.customerName, phone: order.customerPhone, ...(order.customerAddress ? {shippingAddress: order.customerAddress} : {}), loyaltyPoints: 0, totalSpent: Number(order.total), outstandingDue: 0, createdAt: now});
      }

      const actionEvent = {event: action === 'ACCEPT' ? 'ORDER_ACCEPTED' : action === 'REJECT' ? 'ORDER_REJECTED' : action === 'CANCEL' ? 'ORDER_CANCELLED' : action === 'COMPLETE' ? 'ORDER_COMPLETED' : `ORDER_${nextStatus}`, at: now, actor};
      const inventoryEvents = action === 'ACCEPT'
        ? [{event: 'STOCK_RESERVED', at: now, actor}]
        : releasesReservation
          ? [{event: 'STOCK_RELEASED', at: now, actor}]
          : [];
      const update = {status: nextStatus, updatedAt: now, reservationActive: action === 'ACCEPT' ? true : action === 'COMPLETE' || releasesReservation ? false : Boolean(order.reservationActive), ...(action === 'COMPLETE' ? {paymentStatus: 'PAID'} : {}), ...(saleId ? {saleId} : {}), auditTrail: [...(order.auditTrail || []), actionEvent, ...inventoryEvents]};
      transaction.update(orderRef, update);
      return {...update, orderNumber: order.orderNumber};
    });
    return response.status(200).json(outcome);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const messages: Record<string, [number, string]> = {AUTH_REQUIRED: [401, 'Sign in with Google to manage online orders'], ORDER_NOT_FOUND: [404, 'Order not found'], INVALID_TRANSITION: [409, 'That action is not available for this order'], PRODUCT_UNAVAILABLE: [409, 'A product no longer exists'], STOCK_CHANGED: [409, 'Not enough available stock to accept this order'], RESERVATION_MISSING: [409, 'The stock reservation is incomplete'], SERIAL_ASSIGNMENT_FAILED: [409, 'Serialized stock could not be assigned']};
    const mapped = messages[code];
    if (mapped) return response.status(mapped[0]).json({error: mapped[1]});
    console.error('Online order action failed:', error);
    return response.status(500).json({error: 'The order could not be updated'});
  }
}
