import {getAdminDb} from './_firebase-admin.js';

const slugPattern = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/;

const publicLocationKey = (id: string, branchCode?: string) => {
  if (id === 'primary-store') return 'main';
  const candidate = String(branchCode || id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return candidate || 'location';
};

const workspaceScope = (ownerScope: string, locationId: string, primaryStoreId?: string) => {
  if (!locationId || locationId === 'primary-store' || locationId === primaryStoreId || locationId === ownerScope) return ownerScope;
  return `${ownerScope}__store__${locationId.toLowerCase().trim().replace(/[^a-zA-Z0-9_-]/g, '_')}`;
};

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') return response.status(405).json({error: 'Method not allowed'});
  const slug = String(request.query?.slug || '').trim().toLowerCase();
  if (!slugPattern.test(slug)) return response.status(400).json({error: 'Invalid store address'});

  try {
    const db = getAdminDb();
    const registrySnapshot = await db.doc(`public_stores/${slug}`).get();
    const registry = registrySnapshot.data();
    if (!registrySnapshot.exists || !registry?.enabled || !registry?.ownerScope) {
      return response.status(404).json({error: 'This online store is unavailable'});
    }

    const ownerScope = String(registry.ownerScope);
    const settingsSnapshot = await db.doc(`users/${ownerScope}/store_settings/active`).get();
    const settings = settingsSnapshot.data() || {};
    const branches = Array.isArray(settings.storeBranches) ? settings.storeBranches : [];
    const primaryId = String(settings.tenantId || ownerScope);
    const registryLocationId = String(registry.locationId || '');
    const originBranch = branches.find((branch: any) => String(branch.id) === registryLocationId);
    const store = originBranch?.configuration?.onlineStore || settings.onlineStore || {};
    if (!settingsSnapshot.exists || !store.enabled || store.slug !== slug) {
      return response.status(404).json({error: 'This online store is unavailable'});
    }
    const businessMode = (value: unknown) => {
      const normalized = String(value || '').toLowerCase();
      if (/restaurant|cafe|food/.test(normalized)) return 'Restaurant';
      if (normalized.includes('service')) return 'Service';
      if (/manufactur|production/.test(normalized)) return 'Manufacturing';
      if (/hybrid|both/.test(normalized)) return 'Hybrid';
      return 'Retail';
    };
    const locationMode = (id: string) => {
      const primary = id === 'primary-store' || id === primaryId || id === ownerScope;
      const branch = branches.find((item: any) => String(item.id) === id);
      return businessMode(primary ? settings.businessType : branch?.configuration?.businessType);
    };
    const catalogMode = String(store.catalogMode || locationMode(store.originLocationId || registryLocationId || primaryId));
    const configuredIds = Array.isArray(store.participatingLocationIds) ? store.participatingLocationIds.map(String) : [];
    const participatingIds = configuredIds.filter((id: string) => locationMode(id) === catalogMode);
    if (!participatingIds.length && (store.originLocationId || registryLocationId)) participatingIds.push(String(store.originLocationId || registryLocationId));
    const isRestaurant = catalogMode === 'Restaurant';
    const locationDefinitions = participatingIds.map((id: string) => {
      const branch = branches.find((item: any) => String(item.id) === id);
      const primary = id === 'primary-store' || id === primaryId || id === ownerScope;
      return {
        id,
        key: publicLocationKey(id, branch?.branchCode),
        name: primary ? String(settings.storeName || store.publicName) : String(branch?.name || 'Store location'),
        city: primary ? String(settings.city || settings.address || '') : String(branch?.city || ''),
        scope: workspaceScope(ownerScope, id, primaryId),
      };
    });

    const productSnapshots = await Promise.all(locationDefinitions.map(location => db.collection(`users/${location.scope}/products`).get()));
    const publicProducts = new Map<string, any>();
    productSnapshots.forEach((snapshot, index) => {
      const location = locationDefinitions[index];
      snapshot.docs.forEach(document => {
        const product = document.data();
        if (isRestaurant && product.itemType !== 'Service') return;
        if (isRestaurant ? product.showOnline === false : product.showOnline !== true) return;
        const existing = publicProducts.get(document.id) || {
          id: document.id,
          name: String(product.name || 'Product'),
          sku: String(product.sku || ''),
          category: String(product.category || 'General'),
          brand: String(product.brand || ''),
          unit: String(product.unit || 'unit'),
          image: String(product.onlineImage || product.imageUrl || ''),
          description: String(product.onlineDescription || ''),
          price: Number.isFinite(Number(product.onlinePrice)) ? Number(product.onlinePrice) : Number(product.sellingPrice || 0),
          variants: Array.isArray(product.menuVariants)
            ? product.menuVariants.map((variant: any) => ({id: String(variant.id), name: String(variant.name), price: Number(variant.price || 0)}))
            : [],
          availability: {},
        };
        existing.availability[location.key] = product.itemType === 'Service' ? 9999 : Math.max(0, Number(product.stock || 0));
        publicProducts.set(document.id, existing);
      });
    });

    response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=120');
    return response.status(200).json({
      store: {
        name: String(store.publicName || settings.storeName || 'Online Store'),
        logo: String(store.logo || ''),
        description: String(store.description || ''),
        contactNumber: String(store.contactNumber || ''),
        whatsappNumber: String(store.whatsappNumber || ''),
        currency: String(settings.currency || '₹'),
        pickupEnabled: Boolean(store.pickupEnabled),
        deliveryEnabled: Boolean(store.deliveryEnabled),
        deliveryCharge: Math.max(0, Number(store.deliveryCharge || 0)),
        minimumOrder: Math.max(0, Number(store.minimumOrder || 0)),
        maximumDeliveryDistanceKm: Number(store.maximumDeliveryDistanceKm || 0) || undefined,
        paymentMethods: Array.isArray(store.paymentMethods) ? store.paymentMethods : [],
      },
      locations: locationDefinitions.map(({key, name, city}) => ({key, name, city})),
      products: Array.from(publicProducts.values()),
    });
  } catch (error) {
    console.error('Public store lookup failed:', error);
    return response.status(500).json({error: 'The online store could not be loaded'});
  }
}
