import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/public-invoices/create';
import {adminStoreAdapter} from '../src/server/adapters/store';

const response = () => ({statusCode: 0, body: undefined as any, status(code: number) { this.statusCode = code; return this; }, json(value: any) { this.body = value; return this; }});

test('public invoice creation rejects unsupported methods', async () => {
  const res = response();
  await handler({method: 'GET'}, res);
  assert.equal(res.statusCode, 405);
  assert.deepEqual(res.body, {error: 'Method not allowed'});
});

test('public invoice creation rejects missing authentication', async () => {
  const res = response();
  await handler({method: 'POST', headers: {}, body: {}}, res);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, {error: 'Sign in is required to create an invoice link.'});
});

test('public invoice creation rejects incomplete input without writing', async () => {
  const previousSecret = process.env.PUBLIC_INVOICE_SECRET;
  process.env.PUBLIC_INVOICE_SECRET = 'test-secret';
  const res = response();
  await handler({method: 'POST', headers: {authorization: 'Bearer token'}, body: {}}, res);
  if (previousSecret === undefined) delete process.env.PUBLIC_INVOICE_SECRET; else process.env.PUBLIC_INVOICE_SECRET = previousSecret;
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {error: 'Invoice link details are incomplete.'});
});

test('public invoice creation creates a signed link and stores PDF chunks', async () => {
  const previousSecret = process.env.PUBLIC_INVOICE_SECRET;
  const previousFetch = globalThis.fetch;
  process.env.PUBLIC_INVOICE_SECRET = 'test-secret';
  let committed = false;
  const batch = {delete: () => {}, set: () => {}, commit: async () => { committed = true; }};
  const publicInvoiceRef = {collection: () => ({get: async () => ({docs: []}), doc: () => ({})})};
  const fakeDb: any = {
    doc: (path: string) => path.startsWith('users/owner/public_invoices/')
      ? publicInvoiceRef
      : {get: async () => path.startsWith('staff_directory/')
        ? {exists: true, data: () => ({tenantId: 'owner', workspaceScope: 'owner'})}
        : {exists: true, data: () => ({id: 'sale-1'})}},
    batch: () => batch,
  };
  globalThis.fetch = (async () => ({ok: true, json: async () => ({users: [{email: 'owner@example.com'}]})})) as any;
  adminStoreAdapter.setDbForTests(() => fakeDb);
  try {
    const res = response();
    await handler({method: 'POST', headers: {authorization: 'Bearer token', 'x-firebase-api-key': 'test-key'}, body: {workspaceScope: 'owner', saleId: 'sale-1', invoice: {storeName: 'Test Store'}, pdfBase64: Buffer.from('%PDF-test').toString('base64'), fileName: 'invoice.pdf'}}, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.body.url, /^https:\/\/qpos\.neospec\.co\.in\/i\//);
    assert.equal(typeof res.body.expiresAt, 'number');
    assert.equal(committed, true);
  } finally {
    globalThis.fetch = previousFetch;
    adminStoreAdapter.reset();
    if (previousSecret === undefined) delete process.env.PUBLIC_INVOICE_SECRET; else process.env.PUBLIC_INVOICE_SECRET = previousSecret;
  }
});
