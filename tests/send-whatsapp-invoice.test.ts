import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/communications/send-whatsapp-invoice';
test('WhatsApp invoice rejects missing authentication', async () => { const res: any = {statusCode: 0, body: undefined, status(code: number) { this.statusCode = code; return this; }, json(value: any) { this.body = value; return this; }}; await handler({method: 'POST', headers: {}, body: {}}, res); assert.equal(res.statusCode, 401); assert.equal(res.body.error, 'Sign in is required to send an invoice.'); });
