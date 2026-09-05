import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/barcode/lookup';
test('barcode lookup reports unavailable AI configuration without contacting services', async () => { const previous = process.env.GEMINI_API_KEY; delete process.env.GEMINI_API_KEY; const res: any = {statusCode: 0, body: undefined, status(code: number) { this.statusCode = code; return this; }, json(value: any) { this.body = value; return this; }}; await handler({method: 'POST', body: {mode: 'product-image'}}, res); if (previous) process.env.GEMINI_API_KEY = previous; assert.equal(res.statusCode, 503); assert.equal(res.body.found, false); });
