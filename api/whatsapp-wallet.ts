import {getWallet, verifyWalletAccess, WHATSAPP_INVOICE_PRICE_PAISE} from './_whatsapp-wallet.js';

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') return response.status(405).json({error: 'Method not allowed'});
  const idToken = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const workspaceScope = String(request.query.workspaceScope || '');
  const firebaseApiKey = String(request.headers['x-firebase-api-key'] || '');
  try {
    const access = await verifyWalletAccess(idToken, workspaceScope, firebaseApiKey);
    if (!access) return response.status(401).json({error: 'Sign in is required to view the WhatsApp wallet.'});
    const wallet = await getWallet(access.db, workspaceScope);
    return response.status(200).json({...wallet, invoicePricePaise: WHATSAPP_INVOICE_PRICE_PAISE});
  } catch (error) {
    console.error('WhatsApp wallet lookup failed:', error);
    return response.status(503).json({error: error instanceof Error ? error.message : 'Could not load the WhatsApp wallet.'});
  }
}
