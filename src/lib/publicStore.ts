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
  locations: Array<{key: string; name: string; city: string}>;
  products: PublicStoreProduct[];
}

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
    }
    throw error;
  }
};

const developmentPreviewStore: PublicStorePayload = {
  store: {name: 'QPOS Preview Store', logo: '', description: 'Mobile storefront preview', contactNumber: '', whatsappNumber: '', currency: '₹', pickupEnabled: true, deliveryEnabled: true, deliveryCharge: 60, minimumOrder: 500, paymentMethods: ['COD', 'PAY_AT_STORE']},
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
    if (!key.startsWith('pos_') || !key.endsWith('_settings')) return false;
    try { return JSON.parse(localStorage.getItem(key) || '{}').onlineStore?.slug === slug; } catch { return false; }
  });
  if (!settingsKey) return null;
  const settings = JSON.parse(localStorage.getItem(settingsKey) || '{}');
  const store = settings.onlineStore;
  const isRestaurant = String(settings.businessType || '').toLowerCase().includes('restaurant');
  if (!store?.enabled) return null;
  const ownerScope = settingsKey.slice(4, -9);
  const branches = Array.isArray(settings.storeBranches) ? settings.storeBranches : [];
  const locations = (store.participatingLocationIds || []).map((id: string) => {
    const branch = branches.find((item: any) => item.id === id);
    const primary = id === 'primary-store' || id === settings.tenantId || id === ownerScope;
    const key = primary ? 'main' : String(branch?.branchCode || id).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const scope = primary ? ownerScope : `${ownerScope}__store__${String(id).toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    return {key, scope, name: primary ? settings.storeName : branch?.name || 'Store location', city: primary ? settings.address || '' : branch?.city || ''};
  });
  const products = new Map<string, PublicStoreProduct>();
  locations.forEach((location: any) => {
    const cached = JSON.parse(localStorage.getItem(`pos_${location.scope}_products`) || '[]');
    cached.filter((product: any) => isRestaurant ? product.showOnline !== false : product.showOnline === true).forEach((product: any) => {
      const existing = products.get(product.id) || {id: product.id, name: product.name, sku: product.sku || '', category: product.category || 'General', brand: product.brand || '', unit: product.unit || 'unit', image: product.onlineImage || product.imageUrl || '', description: product.onlineDescription || '', price: Number.isFinite(Number(product.onlinePrice)) ? Number(product.onlinePrice) : Number(product.sellingPrice || 0), variants: product.menuVariants || [], availability: {}};
      existing.availability[location.key] = product.itemType === 'Service' ? 9999 : Math.max(0, Number(product.stock || 0));
      products.set(product.id, existing);
    });
  });
  return {store: {name: store.publicName || settings.storeName, logo: store.logo || '', description: store.description || '', contactNumber: store.contactNumber || '', whatsappNumber: store.whatsappNumber || '', currency: settings.currency || '₹', pickupEnabled: Boolean(store.pickupEnabled), deliveryEnabled: Boolean(store.deliveryEnabled), deliveryCharge: Number(store.deliveryCharge || 0), minimumOrder: Number(store.minimumOrder || 0), maximumDeliveryDistanceKm: store.maximumDeliveryDistanceKm, paymentMethods: store.paymentMethods || []}, locations: locations.map(({key, name, city}: any) => ({key, name, city})), products: Array.from(products.values())};
};
