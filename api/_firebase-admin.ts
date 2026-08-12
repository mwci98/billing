import {cert, getApps, initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';

// QPOS is provisioned with a named Firestore database rather than "(default)".
const QPOS_FIRESTORE_DATABASE_ID = 'ai-studio-6936ecb8-f4bb-4b22-88cd-421a5053b2cd';

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawCredentials) {
    throw new Error('Secure wallet setup is incomplete. Add FIREBASE_SERVICE_ACCOUNT_JSON in the QPOS Vercel project.');
  }
  const credentials = JSON.parse(rawCredentials);
  return initializeApp({credential: cert(credentials)});
}

export function getAdminDb() {
  return getFirestore(getAdminApp(), process.env.FIREBASE_DATABASE_ID || QPOS_FIRESTORE_DATABASE_ID);
}

export async function getVerifiedFirebaseUser(idToken: string) {
  // Load Auth only inside authenticated routes. This keeps lightweight API routes
  // from failing during Vercel's module initialization.
  const {getAuth} = await import('firebase-admin/auth');
  const token = await getAuth(getAdminApp()).verifyIdToken(idToken);
  if (!token.email) throw new Error('The signed-in Firebase user has no email address.');
  return {email: token.email};
}

export async function updateTenantSubscription(
  tenantId: string,
  subscription: Record<string, unknown>,
) {
  await getAdminDb()
    .doc(`users/${tenantId}/store_settings/active`)
    .set(subscription, {merge: true});
}
