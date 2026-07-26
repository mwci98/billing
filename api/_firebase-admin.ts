import {cert, getApps, initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawCredentials) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured.');
  }
  const credentials = JSON.parse(rawCredentials);
  return initializeApp({credential: cert(credentials)});
}

export function getAdminDb() {
  return getFirestore(getAdminApp(), process.env.FIREBASE_DATABASE_ID);
}

export async function updateTenantSubscription(
  tenantId: string,
  subscription: Record<string, unknown>,
) {
  await getAdminDb()
    .doc(`users/${tenantId}/store_settings/active`)
    .set(subscription, {merge: true});
}
