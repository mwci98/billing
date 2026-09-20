import {adminStoreAdapter} from './store.js';

type PaymentRecord = {
  providerPaymentId?: string;
  providerOrderId?: string;
  providerSubscriptionId?: string;
  tenantId: string;
  operation: string;
  processedAt: string;
};

export async function processPaymentOnce<T>(
  key: string,
  record: PaymentRecord,
  effect: (transaction: any) => Promise<T> | T,
): Promise<{duplicate: boolean; value?: T}> {
  const db = adminStoreAdapter.getDb() as any;
  return db.runTransaction(async (transaction: any) => {
    const ref = db.doc(`payment_idempotency/${key}`);
    const existing = await transaction.get(ref);
    if (existing?.exists) return {duplicate: true};
    const value = await effect(transaction);
    transaction.create(ref, record);
    return {duplicate: false, value};
  });
}
