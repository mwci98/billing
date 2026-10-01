import {createHash} from 'node:crypto';
import {walletDoc, WHATSAPP_INVOICE_PRICE_PAISE} from '../../../api/_whatsapp-wallet.js';

export const debitOperationId = (workspace: string, invoice: string) => createHash('sha256').update(`${workspace}|${invoice}|whatsapp_invoice_delivery`).digest('hex');
const operationDoc = (db: any, workspace: string, id: string) => db.doc(`users/${workspace}/whatsapp_wallet/operations/${id}`);

export async function reserveDebit(db: any, workspace: string, invoice: string) {
  const id = debitOperationId(workspace, invoice);
  let result: any;
  await db.runTransaction(async (tx: any) => {
    const opRef = operationDoc(db, workspace, id);
    const walletRef = walletDoc(db, workspace);
    const opSnap = await tx.get(opRef);
    const op = opSnap?.exists ? opSnap.data() : undefined;
    if (op?.state === 'completed') { result = {id, state: 'completed', messageId: op.messageId, remainingBalance: op.remainingBalance}; return; }
    if (op?.state === 'reserved' || op?.state === 'handoff_unknown') { result = {id, state: op.state}; return; }
    const walletSnap = await tx.get(walletRef);
    const current = walletSnap?.exists ? walletSnap.data() || {} : {};
    const balance = Number(current.balancePaise || 0);
    if (balance < WHATSAPP_INVOICE_PRICE_PAISE) throw new Error('WALLET_INSUFFICIENT');
    const remainingBalance = balance - WHATSAPP_INVOICE_PRICE_PAISE;
    tx.set(walletRef, {balancePaise: remainingBalance, totalSpentPaise: Number(current.totalSpentPaise || 0) + WHATSAPP_INVOICE_PRICE_PAISE, updatedAt: new Date().toISOString()}, {merge: true});
    tx.set(opRef, {operationId: id, invoiceNumber: invoice, operationType: 'invoice_delivery', state: 'reserved', amountPaise: WHATSAPP_INVOICE_PRICE_PAISE, reservedAt: new Date().toISOString(), remainingBalance}, {merge: true});
    result = {id, state: 'reserved', fresh: true, remainingBalance};
  });
  return result;
}

export async function completeDebit(db: any, workspace: string, id: string, messageId: string) {
  await db.runTransaction(async (tx: any) => tx.set(operationDoc(db, workspace, id), {state: 'completed', messageId: messageId || '', completedAt: new Date().toISOString()}, {merge: true}));
}
export async function releaseDebit(db: any, workspace: string, id: string) {
  await db.runTransaction(async (tx: any) => {
    const opRef = operationDoc(db, workspace, id); const walletRef = walletDoc(db, workspace); const opSnap = await tx.get(opRef); const walletSnap = await tx.get(walletRef);
    const op = opSnap.data() || {}; if (op.state !== 'reserved') return;
    const wallet = walletSnap.data() || {}; tx.set(walletRef, {balancePaise: Number(wallet.balancePaise || 0) + WHATSAPP_INVOICE_PRICE_PAISE, totalSpentPaise: Math.max(0, Number(wallet.totalSpentPaise || 0) - WHATSAPP_INVOICE_PRICE_PAISE), updatedAt: new Date().toISOString()}, {merge: true});
    tx.set(opRef, {state: 'released', releasedAt: new Date().toISOString()}, {merge: true});
  });
}
export async function markHandoffUnknown(db: any, workspace: string, id: string) { await db.runTransaction(async (tx: any) => tx.set(operationDoc(db, workspace, id), {state: 'handoff_unknown', updatedAt: new Date().toISOString()}, {merge: true})); }
