import {FieldValue} from 'firebase-admin/firestore';
import {hashValue, resolveStore, token, verifyBearer} from '../_online-store.js';

const cleanText = (value: unknown, max: number) => String(value || '').trim().replace(/[<>]/g, '').slice(0, max);

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') return response.status(405).json({error: 'Method not allowed'});
  try {
    const otpEnabled = process.env.ONLINE_ORDER_OTP_ENABLED === 'true';
    const decoded = otpEnabled ? await verifyBearer(request) : null;
    const verifiedPhone = String(otpEnabled ? decoded?.phone_number : request.body?.customerPhone || '').replace(/[\s()-]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(verifiedPhone)) return response.status(400).json({error: 'Enter a valid mobile number with country code'});

    const slug = cleanText(request.body?.slug, 60).toLowerCase();
    const locationKey = cleanText(request.body?.locationKey, 80).toLowerCase();
    const idempotencyKey = cleanText(request.body?.idempotencyKey, 100);
    const fulfilment = request.body?.fulfilment === 'DELIVERY' ? 'DELIVERY' : 'PICKUP';
    const paymentMethod = request.body?.paymentMethod;
    const requestedItems = Array.isArray(request.body?.items) ? request.body.items : [];
    if (!/^[a-z0-9-]{3,60}$/.test(slug) || !locationKey || idempotencyKey.length < 16 || !requestedItems.length || requestedItems.length > 30) {
      return response.status(400).json({error: 'Order details are incomplete'});
    }
    if (!['COD', 'PAY_AT_STORE'].includes(paymentMethod)) {
      return response.status(409).json({error: 'Online payment must be verified before this order can be submitted'});
    }
    const {db, store, locationDefinitions} = await resolveStore(slug);
    const location = locationDefinitions.find(item => item.key === locationKey);
    if (!location) return response.status(400).json({error: 'Choose a participating store location'});
    if (fulfilment === 'PICKUP' && !store.pickupEnabled) return response.status(400).json({error: 'Store pickup is unavailable'});
    if (fulfilment === 'DELIVERY' && !store.deliveryEnabled) return response.status(400).json({error: 'Delivery is unavailable'});
    if (!store.paymentMethods?.includes(paymentMethod)) return response.status(400).json({error: 'That payment method is unavailable'});

    const normalizedItems = requestedItems.map((item: any) => ({
      productId: cleanText(item.productId, 120),
      variantId: item.variantId ? cleanText(item.variantId, 120) : undefined,
      quantity: Math.floor(Number(item.quantity)),
    }));
    if (normalizedItems.some(item => !item.productId || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20)) {
      return response.status(400).json({error: 'Each item quantity must be between 1 and 20'});
    }
    const duplicateKey = hashValue(`${location.scope}:${idempotencyKey}`);
    const phoneRateKey = hashValue(`${process.env.ORDER_RATE_LIMIT_SALT || 'qpos'}:${slug}:${verifiedPhone}`);
    const idempotencyRef = db.doc(`users/${location.scope}/online_order_idempotency/${duplicateKey}`);
    const rateRef = db.doc(`public_order_rate_limits/${phoneRateKey}`);
    const productRefs = normalizedItems.map(item => db.doc(`users/${location.scope}/products/${item.productId}`));
    const now = new Date();
    const createdAt = now.toISOString();
    const orderId = `ord-${now.getTime().toString(36)}-${token().slice(0, 6)}`;
    const orderRef = db.doc(`users/${location.scope}/online_orders/${orderId}`);
    const result = await db.runTransaction(async transaction => {
      const [idempotencySnapshot, rateSnapshot, ...productSnapshots] = await Promise.all([
        transaction.get(idempotencyRef),
        transaction.get(rateRef),
        ...productRefs.map(ref => transaction.get(ref)),
      ]);
      if (idempotencySnapshot.exists) {
        const existingOrderId = String(idempotencySnapshot.data()?.orderId || '');
        const existing = existingOrderId ? await transaction.get(db.doc(`users/${location.scope}/online_orders/${existingOrderId}`)) : null;
        if (existing?.exists) return existing.data();
      }
      const rate = rateSnapshot.data() || {};
      const windowStartedAt = Number(rate.windowStartedAt || 0);
      const inWindow = Date.now() - windowStartedAt < 15 * 60 * 1000;
      const attempts = inWindow ? Number(rate.attempts || 0) : 0;
      if (attempts >= 5) throw new Error('RATE_LIMITED');

      let subtotal = 0;
      let taxAmount = 0;
      const items = normalizedItems.map((requested, index) => {
        const snapshot = productSnapshots[index];
        if (!snapshot.exists) throw new Error('PRODUCT_UNAVAILABLE');
        const product = snapshot.data() || {};
        if (product.showOnline === false) throw new Error('PRODUCT_UNAVAILABLE');
        const available = product.itemType === 'Service' ? 9999 : Number(product.stock || 0) - Number(product.reservedStock || 0);
        if (available < requested.quantity) throw new Error('STOCK_CHANGED');
        const variants = Array.isArray(product.menuVariants) ? product.menuVariants : [];
        const variant = requested.variantId ? variants.find((item: any) => String(item.id) === requested.variantId) : undefined;
        if (variants.length && !variant) throw new Error('VARIANT_REQUIRED');
        const inclusivePrice = Number(variant?.price ?? (Number.isFinite(Number(product.onlinePrice)) ? product.onlinePrice : product.sellingPrice) ?? 0);
        const rate = Math.max(0, Number(product.taxRate || 0));
        const lineInclusive = inclusivePrice * requested.quantity;
        const lineTaxable = lineInclusive / (1 + rate / 100);
        const lineTax = lineInclusive - lineTaxable;
        subtotal += lineTaxable;
        taxAmount += lineTax;
        return {productId: snapshot.id, name: cleanText(product.name, 160), sku: cleanText(product.sku, 80), quantity: requested.quantity, unitPrice: inclusivePrice, taxRate: rate, taxAmount: lineTax, total: lineTaxable, ...(variant ? {variantId: String(variant.id), variantName: cleanText(variant.name, 80)} : {})};
      });
      const deliveryCharge = fulfilment === 'DELIVERY' ? Math.max(0, Number(store.deliveryCharge || 0)) : 0;
      const merchandiseTotal = subtotal + taxAmount;
      if (fulfilment === 'DELIVERY' && merchandiseTotal < Number(store.minimumOrder || 0)) throw new Error('MINIMUM_ORDER');
      const trackingToken = token();
      const order = {id: orderId, orderNumber: `ON-${now.getFullYear()}-${String(now.getTime()).slice(-7)}`, source: 'ONLINE_STORE', storeSlug: slug, workspaceScope: location.scope, locationKey, locationName: location.name, customerName: cleanText(request.body?.customerName, 100), customerPhone: verifiedPhone, ...(fulfilment === 'DELIVERY' ? {customerAddress: cleanText(request.body?.customerAddress, 500)} : {}), fulfilment, paymentMethod, paymentStatus: 'UNPAID', status: 'PENDING_CONFIRMATION', items, subtotal, taxAmount, deliveryCharge, total: merchandiseTotal + deliveryCharge, idempotencyKey, trackingToken, reservationActive: false, createdAt, updatedAt: createdAt, auditTrail: [{event: 'ORDER_CREATED', at: createdAt, actor: 'CUSTOMER'}]};
      if (!order.customerName || (fulfilment === 'DELIVERY' && !order.customerAddress)) throw new Error('CUSTOMER_DETAILS');
      transaction.create(orderRef, order);
      transaction.set(idempotencyRef, {orderId, createdAt, expiresAt: Date.now() + 24 * 60 * 60 * 1000});
      transaction.set(rateRef, {attempts: attempts + 1, windowStartedAt: inWindow ? windowStartedAt : Date.now(), updatedAt: FieldValue.serverTimestamp()});
      transaction.set(db.doc(`public_order_receipts/${trackingToken}`), {workspaceScope: location.scope, orderId, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000});
      return order;
    });
    return response.status(201).json({orderId: result.id, orderNumber: result.orderNumber, trackingToken: result.trackingToken, status: result.status});
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const messages: Record<string, [number, string]> = {
      AUTH_REQUIRED: [401, 'Verify the customer mobile number first'],
      RATE_LIMITED: [429, 'Too many order attempts. Please wait 15 minutes'],
      PRODUCT_UNAVAILABLE: [409, 'A product is no longer available'],
      STOCK_CHANGED: [409, 'Stock changed. Review the cart and location'],
      VARIANT_REQUIRED: [400, 'Choose an option for every product'],
      MINIMUM_ORDER: [400, 'The delivery minimum has not been reached'],
      CUSTOMER_DETAILS: [400, 'Customer details are incomplete'],
      STORE_UNAVAILABLE: [404, 'This online store is unavailable'],
    };
    const mapped = messages[code];
    if (mapped) return response.status(mapped[0]).json({error: mapped[1]});
    console.error('Online order creation failed:', error);
    return response.status(500).json({error: 'The order could not be submitted'});
  }
}
