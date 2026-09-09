import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/barcode/lookup';

const response = () => ({statusCode: 0, body: undefined as any, headers: {} as Record<string, string>, status(code: number) { this.statusCode = code; return this; }, json(value: any) { this.body = value; return this; }, setHeader(name: string, value: string) { this.headers[name] = value; }});

test('barcode lookup rejects unsupported methods', async () => { const res = response(); await handler({method: 'PUT'}, res); assert.equal(res.statusCode, 405); });

test('barcode lookup validates barcode length', async () => { const res = response(); await handler({method: 'GET', query: {code: '123'}}, res); assert.equal(res.statusCode, 400); assert.match(res.body.error, /complete retail barcode/); });

test('barcode lookup returns transformed UPC product data without live calls', async () => {
  const oldFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (url: any) => { calls += 1; assert.match(String(url), /upcitemdb/); return {ok: true, text: async () => JSON.stringify({items: [{title: 'Test Product', brand: 'Test Brand', category: 'Accessories', description: 'A test item', images: ['https://image.test/item.jpg']}]})}; }) as any;
  const res = response();
  try { await handler({method: 'GET', query: {code: '123456789012'}}, res); } finally { globalThis.fetch = oldFetch; }
  assert.equal(calls, 1); assert.equal(res.statusCode, 200); assert.deepEqual(res.body, {found: true, barcode: '123456789012', name: 'Test Product', brand: 'Test Brand', category: 'Accessories', description: 'A test item', image: 'https://image.test/item.jpg', source: 'UPCitemdb'});
});

test('barcode product-image mode returns parsed Gemini fields from a mocked response', async () => {
  const previousKey = process.env.GEMINI_API_KEY; const oldFetch = globalThis.fetch; process.env.GEMINI_API_KEY = 'test-key';
  globalThis.fetch = (async () => ({ok: true, json: async () => ({candidates: [{content: {parts: [{text: JSON.stringify({found: true, name: 'Test Phone', brand: 'Test', model: 'X1', category: 'Smartphones', unit: 'Unit', barcode: '123456789012', taxRate: 18, trackInventoryByImei: true, description: 'Test phone'})}]}}]})})) as any;
  const res = response();
  try { await handler({method: 'POST', body: {image: 'data:image/png;base64,AAAA'}}, res); } finally { globalThis.fetch = oldFetch; if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey; }
  assert.equal(res.statusCode, 200); assert.equal(res.body.name, 'Test Phone'); assert.equal(res.body.trackInventoryByImei, true); assert.equal(res.body.source, 'Gemini Vision');
});
