export interface PublicStoreProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  brand: string;
  unit: string;
  image: string;
  description: string;
  price: number;
  variants: Array<{id: string; name: string; price: number}>;
  availability: Record<string, number>;
}

export interface PublicStorePayload {
  store: {
    mode: 'Retail' | 'Restaurant';
    name: string;
    logo: string;
    description: string;
    contactNumber: string;
    whatsappNumber: string;
    currency: string;
    pickupEnabled: boolean;
    deliveryEnabled: boolean;
    deliveryCharge: number;
    minimumOrder: number;
    maximumDeliveryDistanceKm?: number;
    paymentMethods: Array<'COD' | 'PAY_AT_STORE' | 'ONLINE'>;
  };
  locations: Array<{key: string; name: string; city: string; developmentScope?: string}>;
  products: PublicStoreProduct[];
  table?: {token: string; name: string; locationKey: string};
}

export const loadTableStore = async (token: string) => {
  let mapping: any;
  try {
    const response = await fetch(`/api/table-store?token=${encodeURIComponent(token)}`);
    mapping = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(mapping.error || 'This table QR is unavailable');
  } catch (error) {
    if (!import.meta.env.DEV) throw error;
    const [{db}, {doc, getDoc}] = await Promise.all([import('./firebase'), import('firebase/firestore')]);
    const snapshot = await getDoc(doc(db, 'public_tables', token));
    mapping = snapshot.data();
    if (!snapshot.exists() || !mapping?.active) throw new Error('This table QR is unavailable');
  }
  const payload = await loadPublicStore(mapping.slug);
  return {...payload, table: {token, name: String(mapping.tableName || 'Table'), locationKey: String(mapping.locationKey || '')}};
};

export const loadPublicStore = async (slug: string): Promise<PublicStorePayload> => {
  try {
    const response = await fetch(`/api/public-store?slug=${encodeURIComponent(slug)}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.store || !Array.isArray(payload?.products) || !Array.isArray(payload?.locations)) {
      throw new Error(payload.error || 'The online store could not be loaded');
    }
    return payload as PublicStorePayload;
  } catch (error) {
    if (import.meta.env.DEV) {
      const preview = loadLocalPublicStorePreview(slug);
      if (preview) return preview;
      if (slug === 'preview-store') return developmentPreviewStore;
      const firestorePreview = await loadDevelopmentFirestoreStore(slug);
      if (firestorePreview) return firestorePreview;
    }
    throw error;
  }
};

const loadDevelopmentFirestoreStore = async (slug: string): Promise<PublicStorePayload | null> => {
  try {
    const [{db}, {collection, doc, getDoc, getDocs}] = await Promise.all([
      import('./firebase'),
      import('firebase/firestore'),
    ]);
    const registrySnapshot = await getDoc(doc(db, 'public_stores', slug));
    const registry = registrySnapshot.data();
    if (!registrySnapshot.exists() || !registry?.enabled || !registry?.ownerScope) return null;
    const ownerScope = String(registry.ownerScope);
    const settingsSnapshot = await getDoc(doc(db, 'users', ownerScope, 'store_settings', 'active'));
    if (!settingsSnapshot.exists()) return null;
    const settings = settingsSnapshot.data() as any;
    const branches = Array.isArray(settings.storeBranches) ? settings.storeBranches : [];
    const originBranch = branches.find((branch: any) => branch.id === registry.locationId);
    const store = originBranch?.configuration?.onlineStore || settings.onlineStore;
    if (!store?.enabled || store.slug !== slug) return null;
    const primaryId = settings.tenantId || ownerScope;
    const mode = (value: unknown) => /restaurant|cafe|food/i.test(String(value || '')) ? 'Restaurant' : /service/i.test(String(value || '')) ? 'Service' : /manufactur|production/i.test(String(value || '')) ? 'Manufacturing' : /hybrid|both/i.test(String(value || '')) ? 'Hybrid' : 'Retail';
    const locationMode = (id: string) => {
      const primary = id === 'primary-store' || id === primaryId || id === ownerScope;
      const branch = branches.find((item: any) => item.id === id);
      return mode(primary ? settings.businessType : branch?.configuration?.businessType);
    };
    const catalogMode = store.catalogMode || locationMode(store.originLocationId || registry.locationId || primaryId);
    const configuredIds: string[] = Array.isArray(store.participatingLocationIds) ? store.participatingLocationIds : [];
    const participatingIds = catalogMode === 'Restaurant' ? configuredIds : configuredIds.filter(id => locationMode(id) === catalogMode);
    if (!participatingIds.length) participatingIds.push(store.originLocationId || registry.locationId || primaryId);
    const locations = participatingIds.map(id => {
      const primary = id === 'primary-store' || id === primaryId || id === ownerScope;
      const branch = branches.find((item: any) => item.id === id);
      const key = primary ? 'main' : String(branch?.branchCode || id).toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const scope = primary ? ownerScope : `${ownerScope}__store__${String(id).toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      return {key, scope, name: primary ? settings.storeName : branch?.name || 'Store location', city: primary ? settings.address || '' : branch?.city || ''};
    });
    const snapshots = await Promise.all(locations.map(location => getDocs(collection(db, 'users', location.scope, 'products'))));
    const products = new Map<string, PublicStoreProduct>();
    snapshots.forEach((snapshot, index) => snapshot.docs.forEach(productDocument => {
      const product = productDocument.data() as any;
      const restaurant = catalogMode === 'Restaurant';
      if (restaurant && product.itemType !== 'Service') return;
      if (restaurant ? product.showOnline === false : product.showOnline !== true) return;
      const existing = products.get(productDocument.id) || {id: productDocument.id, name: product.name, sku: product.sku || '', category: product.category || 'General', brand: product.brand || '', unit: product.unit || 'unit', image: product.onlineImage || product.imageUrl || '', description: product.onlineDescription || '', price: Number.isFinite(Number(product.onlinePrice)) ? Number(product.onlinePrice) : Number(product.sellingPrice || 0), variants: product.menuVariants || [], availability: {}};
      existing.availability[locations[index].key] = restaurant || product.itemType === 'Service' ? 9999 : Math.max(0, Number(product.stock || 0) - Number(product.reservedStock || 0));
      products.set(productDocument.id, existing);
    }));
    return {store: {mode: catalogMode === 'Restaurant' ? 'Restaurant' : 'Retail', name: store.publicName || settings.storeName, logo: store.logo || '', description: store.description || '', contactNumber: store.contactNumber || '', whatsappNumber: store.whatsappNumber || '', currency: settings.currency || '₹', pickupEnabled: Boolean(store.pickupEnabled), deliveryEnabled: Boolean(store.deliveryEnabled), deliveryCharge: Number(store.deliveryCharge || 0), minimumOrder: Number(store.minimumOrder || 0), maximumDeliveryDistanceKm: store.maximumDeliveryDistanceKm, paymentMethods: store.paymentMethods || []}, locations: locations.map(({key, scope, name, city}) => ({key, name, city, developmentScope: scope})), products: Array.from(products.values())};
  } catch (error) {
    console.warn('Local public store preview could not read Firestore:', error);
    return null;
  }
};

const developmentPreviewStore: PublicStorePayload = {
  store: {mode: 'Retail', name: 'QPOS Preview Store', logo: '', description: 'Mobile storefront preview', contactNumber: '', whatsappNumber: '', currency: '₹', pickupEnabled: true, deliveryEnabled: true, deliveryCharge: 60, minimumOrder: 500, paymentMethods: ['COD', 'PAY_AT_STORE']},
  locations: [{key: 'main', name: 'Kohima Store', city: 'Kohima'}, {key: 'dmr', name: 'Dimapur Store', city: 'Dimapur'}],
  products: [
    {id: 'preview-phone', name: 'Vivo Y75 5G 8GB / 128GB', sku: 'VY75', category: 'Smartphones', brand: 'Vivo', unit: 'piece', image: '📱', description: '5G smartphone with all-day battery.', price: 23999, variants: [{id: 'silver', name: 'Silver', price: 23999}, {id: 'black', name: 'Black', price: 24499}], availability: {main: 3, dmr: 0}},
    {id: 'preview-charger', name: '20W Fast Charger', sku: 'CH20', category: 'Accessories', brand: 'QPOS', unit: 'piece', image: '🔌', description: 'Compact USB-C fast charger.', price: 1299, variants: [], availability: {main: 6, dmr: 8}},
  ],
};

// Vite does not run Vercel API functions. This uses only the signed-in owner's
// local cache to make the public route testable during development.
const loadLocalPublicStorePreview = (slug: string): PublicStorePayload | null => {
  const settingsKey = Object.keys(localStorage).find(key => {
    if (!/^pos_.+_settings$/.test(key)) return false;
    try {
      const candidate = JSON.parse(localStorage.getItem(key) || '{}');
      return candidate.onlineStore?.slug === slug || candidate.storeBranches?.some((branch: any) => branch.configuration?.onlineStore?.slug === slug);
    } catch { return false; }
  });
  if (!settingsKey) return null;
  const settings = JSON.parse(localStorage.getItem(settingsKey) || '{}');
  const branches = Array.isArray(settings.storeBranches) ? settings.storeBranches : [];
  const originBranch = branches.find((branch: any) => branch.configuration?.onlineStore?.slug === slug);
  const store = originBranch?.configuration?.onlineStore || settings.onlineStore;
  if (!store?.enabled) return null;
  const ownerScope = settingsKey.slice(4, -9);
  const businessMode = (value: unknown) => {
    const normalized = String(value || '').toLowerCase();
    if (/restaurant|cafe|food/.test(normalized)) return 'Restaurant';
    if (normalized.includes('service')) return 'Service';
    if (/manufactur|production/.test(normalized)) return 'Manufacturing';
    if (/hybrid|both/.test(normalized)) return 'Hybrid';
    return 'Retail';
  };
  const primaryId = settings.tenantId || ownerScope;
  const locationMode = (id: string) => {
    const primary = id === 'primary-store' || id === primaryId || id === ownerScope;
    const branch = branches.find((item: any) => item.id === id);
    return businessMode(primary ? settings.businessType : branch?.configuration?.businessType);
  };
  const configuredIds = store.participatingLocationIds || [];
  const legacyHasRestaurantOutlet = branches.some((branch: any) => configuredIds.includes(branch.id) && locationMode(branch.id) === 'Restaurant');
  const catalogMode = store.catalogMode || (legacyHasRestaurantOutlet ? 'Restaurant' : locationMode(store.originLocationId || primaryId));
  const participatingIds = catalogMode === 'Restaurant' ? configuredIds : configuredIds.filter((id: string) => locationMode(id) === catalogMode);
  if (!participatingIds.length && store.originLocationId) participatingIds.push(store.originLocationId);
  const isRestaurant = catalogMode === 'Restaurant';
  const locations = participatingIds.map((id: string) => {
    const branch = branches.find((item: any) => item.id === id);
    const primary = id === 'primary-store' || id === settings.tenantId || id === ownerScope;
    const key = primary ? 'main' : String(branch?.branchCode || id).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const scope = primary ? ownerScope : `${ownerScope}__store__${String(id).toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    return {key, scope, name: primary ? settings.storeName : branch?.name || 'Store location', city: primary ? settings.address || '' : branch?.city || ''};
  });
  const products = new Map<string, PublicStoreProduct>();
  const scopedProductKeys = Object.keys(localStorage).filter(key => key.startsWith(`pos_${ownerScope}`) && key.endsWith('_products'));
  locations.forEach((location: any) => {
    const exactKey = `pos_${location.scope}_products`;
    const cacheKey = localStorage.getItem(exactKey) !== null
      ? exactKey
      : locations.length === 1 && scopedProductKeys.length === 1
        ? scopedProductKeys[0]
        : exactKey;
    const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
    cached.filter((product: any) => {
      if (isRestaurant && product.itemType !== 'Service') return false;
      return isRestaurant ? product.showOnline !== false : product.showOnline === true;
    }).forEach((product: any) => {
      const existing = products.get(product.id) || {id: product.id, name: product.name, sku: product.sku || '', category: product.category || 'General', brand: product.brand || '', unit: product.unit || 'unit', image: product.onlineImage || product.imageUrl || '', description: product.onlineDescription || '', price: Number.isFinite(Number(product.onlinePrice)) ? Number(product.onlinePrice) : Number(product.sellingPrice || 0), variants: product.menuVariants || [], availability: {}};
      existing.availability[location.key] = product.itemType === 'Service' ? 9999 : Math.max(0, Number(product.stock || 0) - Number(product.reservedStock || 0));
      products.set(product.id, existing);
    });
  });
  return {store: {mode: isRestaurant ? 'Restaurant' : 'Retail', name: store.publicName || settings.storeName, logo: store.logo || '', description: store.description || '', contactNumber: store.contactNumber || '', whatsappNumber: store.whatsappNumber || '', currency: settings.currency || '₹', pickupEnabled: Boolean(store.pickupEnabled), deliveryEnabled: Boolean(store.deliveryEnabled), deliveryCharge: Number(store.deliveryCharge || 0), minimumOrder: Number(store.minimumOrder || 0), maximumDeliveryDistanceKm: store.maximumDeliveryDistanceKm, paymentMethods: store.paymentMethods || []}, locations: locations.map(({key, scope, name, city}: any) => ({key, name, city, developmentScope: scope})), products: Array.from(products.values())};
};

export const createDevelopmentOnlineOrder = async (input: {
  slug: string;
  payload: PublicStorePayload;
  locationKey: string;
  idempotencyKey: string;
  fulfilment: 'PICKUP' | 'DELIVERY';
  paymentMethod: 'COD' | 'PAY_AT_STORE';
  tableToken?: string;
  payloadTableName?: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  customerNote?: string;
  items: Array<{productId: string; variantId?: string; quantity: number}>;
}) => {
  if (!import.meta.env.DEV) throw new Error('Development order fallback is unavailable');
  const location = input.payload.locations.find(item => item.key === input.locationKey);
  if (!location?.developmentScope) throw new Error('Reload the store and try again');
  const [{db}, {doc, runTransaction}] = await Promise.all([import('./firebase'), import('firebase/firestore')]);
  const orderId = `ord-dev-${input.idempotencyKey.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`;
  const orderRef = doc(db, 'users', location.developmentScope, 'online_orders', orderId);
  return runTransaction(db, async transaction => {
    const existing = await transaction.get(orderRef);
    if (existing.exists()) return existing.data() as {orderNumber: string; status: string; trackingToken?: string};
    const productRefs = input.items.map(item => doc(db, 'users', location.developmentScope!, 'products', item.productId));
    const snapshots = await Promise.all(productRefs.map(reference => transaction.get(reference)));
    let subtotal = 0;
    let taxAmount = 0;
    const items = input.items.map((requested, index) => {
      const snapshot = snapshots[index];
      if (!snapshot.exists()) throw new Error('A product is no longer available');
      const product = snapshot.data() as any;
      const variant = requested.variantId ? (product.menuVariants || []).find((item: any) => item.id === requested.variantId) : undefined;
      const unitPrice = Number(variant?.price ?? product.onlinePrice ?? product.sellingPrice ?? 0);
      const taxRate = Number(product.taxRate || 0);
      const inclusiveTotal = unitPrice * requested.quantity;
      const taxableTotal = inclusiveTotal / (1 + taxRate / 100);
      const lineTax = inclusiveTotal - taxableTotal;
      const available = product.itemType === 'Service' ? 9999 : Number(product.stock || 0) - Number(product.reservedStock || 0);
      if (available < requested.quantity) throw new Error('Stock changed. Review the cart and location');
      subtotal += taxableTotal;
      taxAmount += lineTax;
      return {productId: snapshot.id, name: product.name, sku: product.sku || '', quantity: requested.quantity, unitPrice, taxRate, taxAmount: lineTax, total: taxableTotal, ...(variant ? {variantId: variant.id, variantName: variant.name} : {})};
    });
    const now = new Date().toISOString();
    const deliveryCharge = input.fulfilment === 'DELIVERY' ? input.payload.store.deliveryCharge : 0;
    const order = {id: orderId, orderNumber: `ON-${new Date().getFullYear()}-${String(Date.now()).slice(-7)}`, source: input.tableToken ? 'TABLE_QR' : 'ONLINE_STORE', businessMode: input.payload.store.mode, ...(input.tableToken ? {tableToken: input.tableToken, tableName: input.payloadTableName} : {}), storeSlug: input.slug, workspaceScope: location.developmentScope, locationKey: location.key, locationName: location.name, customerName: input.customerName.trim(), customerPhone: input.customerPhone, ...(input.customerAddress ? {customerAddress: input.customerAddress.trim()} : {}), ...(input.customerNote ? {customerNote: input.customerNote.trim().slice(0, 300)} : {}), fulfilment: input.fulfilment, paymentMethod: input.paymentMethod, paymentStatus: 'UNPAID', status: 'PENDING_CONFIRMATION', items, subtotal, taxAmount, deliveryCharge, total: subtotal + taxAmount + deliveryCharge, idempotencyKey: input.idempotencyKey, trackingToken: crypto.randomUUID().replace(/-/g, ''), reservationActive: false, createdAt: now, updatedAt: now, auditTrail: [{event: 'ORDER_CREATED', at: now, actor: 'CUSTOMER'}]};
    transaction.set(orderRef, order);
    return order;
  });
};
