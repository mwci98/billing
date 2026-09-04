import {createHash, randomBytes} from 'node:crypto';
import {getAdminAuth, getAdminDb} from './_firebase-admin.js';

export const hashValue = (value: string) => createHash('sha256').update(value).digest('hex');
export const token = () => randomBytes(24).toString('base64url');

export const verifyBearer = async (request: any) => {
  const bearer = String(request.headers?.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) throw new Error('AUTH_REQUIRED');
  return getAdminAuth().verifyIdToken(bearer);
};

export const ownerScopeFromToken = (decoded: any) => {
  const email = String(decoded.email || '').toLowerCase().trim();
  if (!email) throw new Error('OWNER_EMAIL_REQUIRED');
  return email.replace(/[^a-zA-Z0-9]/g, '_');
};

export const resolveStore = async (slug: string) => {
  const db = getAdminDb();
  const registrySnapshot = await db.doc(`public_stores/${slug}`).get();
  const registry = registrySnapshot.data();
  if (!registrySnapshot.exists || !registry?.enabled || !registry.ownerScope) throw new Error('STORE_UNAVAILABLE');
  const ownerScope = String(registry.ownerScope);
  const settingsSnapshot = await db.doc(`users/${ownerScope}/store_settings/active`).get();
  const settings = settingsSnapshot.data() || {};
  const branches = Array.isArray(settings.storeBranches) ? settings.storeBranches : [];
  const originBranch = branches.find((branch: any) => branch.id === registry.locationId);
  const store = originBranch?.configuration?.onlineStore || settings.onlineStore;
  if (!store?.enabled || store.slug !== slug) throw new Error('STORE_UNAVAILABLE');
  const primaryId = settings.tenantId || ownerScope;
  const locationDefinitions = (store.participatingLocationIds || []).map((id: string) => {
    const branch = branches.find((item: any) => item.id === id);
    const primary = id === 'primary-store' || id === primaryId || id === ownerScope;
    const key = primary ? 'main' : String(branch?.branchCode || id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const scope = primary ? ownerScope : `${ownerScope}__store__${String(id).toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    return {id, key, scope, name: primary ? settings.storeName || store.publicName : branch?.name || 'Store location'};
  });
  return {db, ownerScope, settings, store, locationDefinitions};
};
