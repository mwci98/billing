import {adminStoreAdapter} from '../../src/server/adapters/store.js';

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') return response.status(405).json({error: 'Method not allowed'});
  const trackingToken = String(request.query?.token || '');
  if (!/^[a-zA-Z0-9_-]{20,80}$/.test(trackingToken)) return response.status(404).json({error: 'Order not found'});
  const db = adminStoreAdapter.getDb();
  const receiptSnapshot = await db.doc(`public_order_receipts/${trackingToken}`).get();
  const receipt = receiptSnapshot.data();
  if (!receiptSnapshot.exists || Number(receipt?.expiresAt || 0) < Date.now()) return response.status(404).json({error: 'Order not found'});
  const orderSnapshot = await db.doc(`users/${receipt?.workspaceScope}/online_orders/${receipt?.orderId}`).get();
  const order = orderSnapshot.data();
  if (!orderSnapshot.exists) return response.status(404).json({error: 'Order not found'});
  response.setHeader('Cache-Control', 'private, no-store');
  return response.status(200).json({orderNumber: order?.orderNumber, status: order?.status, locationName: order?.locationName, fulfilment: order?.fulfilment, total: order?.total, updatedAt: order?.updatedAt});
}
