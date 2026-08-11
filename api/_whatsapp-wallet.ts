import {getAdminDb} from './_firebase-admin';

export const WHATSAPP_INVOICE_PRICE_PAISE = 200;
const FIREBASE_API_KEY = 'AIzaSyBca_Gy8lvnaqSJXjjYrY71T_IWa2ZjyCk';

const emailScope = (email: string) => email.toLowerCase().trim().replace(/[^a-zA-Z0-9]/g, '_');

export async function verifyWalletAccess(idToken: string, requestedScope: string) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
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
