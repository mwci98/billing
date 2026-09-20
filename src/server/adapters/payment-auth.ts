import {verifyBearer, ownerScopeFromToken} from '../../../api/_online-store.js';
import {adminStoreAdapter} from './store.js';

export async function authorizePaymentWorkspace(request: any, requestedTenant: string) {
  const decoded = await verifyBearer(request);
  const ownerScope = String(decoded.tenantId || ownerScopeFromToken(decoded));
  const requested = String(requestedTenant || ownerScope);
  if (requested !== ownerScope && !requested.startsWith(`${ownerScope}__store__`)) {
    const db = adminStoreAdapter.getDb();
    const settings = (await db.doc(`users/${ownerScope}/store_settings/active`).get()).data() || {};
    if (String(settings.tenantId || '') !== requested) throw new Error('WORKSPACE_FORBIDDEN');
  }
  return {decoded, tenantId: requested, email: String(decoded.email || '')};
}
