import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/public-invoice';
test('public invoice rejects an invalid signed token', async () => { const res: any = {statusCode: 0, body: undefined, status(code: number) { this.statusCode = code; return this; }, send(value: any) { this.body = value; return this; }}; await handler({query: {token: 'invalid'}}, res); assert.equal(res.statusCode, 404); assert.equal(res.body, 'Invoice link is invalid.'); });
