import {getAdminDb} from '../_firebase-admin.js';

const FIREBASE_API_KEY = 'AIzaSyBca_Gy8lvnaqSJXjjYrY71T_IWa2ZjyCk';
const PUBLIC_LINK_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

type LinkPayload = {
  scope: string;
  saleId: string;
  expiresAt: number;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeGst?: string;
  currency: string;
};

const base64Url = (value: string) => Buffer.from(value).toString('base64url');

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Buffer.from(signature).toString('base64url');
}

async function getFirebaseUser(idToken: string) {
  const result = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({idToken}),
  });
  const payload = await result.json().catch(() => ({}));
  return result.ok ? payload.users?.[0] : null;
}

const emailScope = (email: string) => email.toLowerCase().trim().replace(/[^a-zA-Z0-9]/g, '_');

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') return response.status(405).json({error: 'Method not allowed'});

  const token = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const secret = process.env.PUBLIC_INVOICE_SECRET || process.env.CRM_WEBHOOK_SECRET;
  if (!token) return response.status(401).json({error: 'Sign in is required to create an invoice link.'});
  if (!secret) return response.status(503).json({error: 'Public invoice links are not configured yet.'});

  try {
    const user = await getFirebaseUser(token);
    const email = String(user?.email || '');
    const body = request.body || {};
    const scope = String(body.workspaceScope || '');
    const saleId = String(body.saleId || '');
    const invoice = body.invoice || {};
    if (!email || !scope || !saleId || !invoice.storeName) {
      return response.status(400).json({error: 'Invoice link details are incomplete.'});
    }

    const db = getAdminDb();
    const identityScope = emailScope(email);
    const directory = await db.doc(`staff_directory/${identityScope}`).get();
    const staff = directory.exists ? directory.data() as any : null;
    const ownerScope = staff?.tenantId || identityScope;
    const allowedScope = staff?.workspaceScope || ownerScope;
    if (scope !== allowedScope && !(ownerScope === identityScope && scope.startsWith(`${ownerScope}__store__`))) {
      return response.status(403).json({error: 'You do not have access to this workspace invoice.'});
    }
    const sale = await db.doc(`users/${scope}/sales/${saleId}`).get();
    if (!sale.exists) return response.status(404).json({error: 'Invoice was not found.'});

    const payload: LinkPayload = {
      scope,
      saleId,
      expiresAt: Date.now() + PUBLIC_LINK_LIFETIME_MS,
      storeName: String(invoice.storeName),
      storeAddress: invoice.storeAddress ? String(invoice.storeAddress) : undefined,
      storePhone: invoice.storePhone ? String(invoice.storePhone) : undefined,
      storeGst: invoice.storeGst ? String(invoice.storeGst) : undefined,
      currency: String(invoice.currency || '₹'),
    };
    const encoded = base64Url(JSON.stringify(payload));
    const signature = await sign(encoded, secret);
    return response.status(200).json({url: `https://qpos.neospec.co.in/i/${encoded}.${signature}`, expiresAt: payload.expiresAt});
  } catch (error) {
    console.error('Public invoice link creation failed:', error);
    return response.status(500).json({error: 'Could not create the public invoice link.'});
  }
}
