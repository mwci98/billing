import {getAdminDb} from './_firebase-admin.js';

export const WHATSAPP_INVOICE_PRICE_PAISE = 200;

const emailScope = (email: string) => email.toLowerCase().trim().replace(/[^a-zA-Z0-9]/g, '_');

export async function verifyWalletAccess(idToken: string, requestedScope: string) {
  const firebaseApiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!firebaseApiKey) {
    throw new Error('Firebase authentication is not configured on the QPOS server.');
  }
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`, {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({idToken}),
  });
  const payload = await response.json().catch(() => ({}));
  const email = String(payload.users?.[0]?.email || '');
  if (!response.ok || !email || !requestedScope) return null;

  const db = getAdminDb();
  const identityScope = emailScope(email);
  const directory = await db.doc(`staff_directory/${identityScope}`).get();
  const staff = directory.exists ? directory.data() as any : null;
  const ownerScope = staff?.tenantId || identityScope;
  const allowedScope = staff?.workspaceScope || ownerScope;
  const ownerCanAccessBranch = ownerScope === identityScope && requestedScope.startsWith(`${ownerScope}__store__`);
  if (requestedScope !== allowedScope && !ownerCanAccessBranch) return null;
  return {db, email, ownerScope, workspaceScope: requestedScope};
}

export const walletDoc = (db: ReturnType<typeof getAdminDb>, workspaceScope: string) =>
  db.doc(`users/${workspaceScope}/whatsapp_wallet/active`);

export async function getWallet(db: ReturnType<typeof getAdminDb>, workspaceScope: string) {
  const snapshot = await walletDoc(db, workspaceScope).get();
  const value = snapshot.exists ? snapshot.data() as any : {};
  return {
    balancePaise: Number(value.balancePaise || 0),
    totalSpentPaise: Number(value.totalSpentPaise || 0),
  };
}
