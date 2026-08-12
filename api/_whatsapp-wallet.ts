import {getAdminDb, getVerifiedFirebaseUser} from './_firebase-admin.js';

export const WHATSAPP_INVOICE_PRICE_PAISE = 200;

const emailScope = (email: string) => email.toLowerCase().trim().replace(/[^a-zA-Z0-9]/g, '_');

export async function verifyWalletAccess(idToken: string, requestedScope: string) {
  if (!idToken || !requestedScope) return null;
  let user: {email: string};
  try {
    user = await getVerifiedFirebaseUser(idToken);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown Firebase Admin verification error.';
    throw new Error(`Wallet authentication server setup failed: ${reason}`);
  }
  const email = user.email;

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
