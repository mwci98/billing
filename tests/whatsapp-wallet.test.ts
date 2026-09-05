import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/whatsapp-wallet';
test('wallet rejects unsupported HTTP methods', async () => { const res: any = {statusCode: 0, body: undefined, status(code: number) { this.statusCode = code; return this; }, json(value: any) { this.body = value; return this; }}; await handler({method: 'POST'}, res); assert.equal(res.statusCode, 405); assert.deepEqual(res.body, {error: 'Method not allowed'}); });
