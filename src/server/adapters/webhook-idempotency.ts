import {adminStoreAdapter} from './store.js';

type EventState = 'processing' | 'processed' | 'failed';
type EventRecord = {eventId: string; eventType: string; state: EventState; processedAt?: string; updatedAt: string; error?: string};

export async function claimWebhookEvent(eventId: string, eventType: string) {
  const db = adminStoreAdapter.getDb() as any;
  return db.runTransaction(async (transaction: any) => {
    const ref = db.doc(`razorpay_webhook_events/${eventId}`);
    const snapshot = await transaction.get(ref);
    const current = snapshot?.exists ? snapshot.data?.() : undefined;
    if (current?.state === 'processed' || current?.state === 'processing') return {duplicate: true, ref};
    const record: EventRecord = {eventId, eventType, state: 'processing', updatedAt: new Date().toISOString()};
    if (snapshot?.exists) transaction.set(ref, record, {merge: true});
    else transaction.create(ref, record);
    return {duplicate: false, ref};
  });
}

export async function completeWebhookEvent(ref: any, eventId: string, eventType: string) {
  const db = adminStoreAdapter.getDb() as any;
  await db.runTransaction(async (transaction: any) => {
    transaction.set(ref, {eventId, eventType, state: 'processed', processedAt: new Date().toISOString(), updatedAt: new Date().toISOString()}, {merge: true});
  });
}

export async function failWebhookEvent(ref: any, error: unknown) {
  const db = adminStoreAdapter.getDb() as any;
  await db.runTransaction(async (transaction: any) => {
    transaction.set(ref, {state: 'failed', error: error instanceof Error ? error.message : 'Webhook processing failed', updatedAt: new Date().toISOString()}, {merge: true});
  });
}
