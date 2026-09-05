import {adminStoreAdapter} from '../src/server/adapters/store.js';

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') return response.status(405).json({error: 'Method not allowed'});
  const token = String(request.query?.token || '');
  if (!/^[a-zA-Z0-9]{30,80}$/.test(token)) return response.status(404).json({error: 'Table not found'});
  try {
    const snapshot = await adminStoreAdapter.getDb().doc(`public_tables/${token}`).get();
    const table = snapshot.data();
    if (!snapshot.exists || !table?.active || !table.slug) return response.status(404).json({error: 'Table not found'});
    response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30');
    return response.status(200).json({slug: table.slug, locationKey: table.locationKey, tableName: table.tableName});
  } catch { return response.status(500).json({error: 'The table could not be loaded'}); }
}
