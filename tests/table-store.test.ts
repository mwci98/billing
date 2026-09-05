import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/table-store';
import {adminStoreAdapter} from '../src/server/adapters/store';
const response = () => ({statusCode: 0, body: undefined as any, headers: {} as Record<string, string>, status(code: number) { this.statusCode = code; return this; }, json(value: any) { this.body = value; return this; }, setHeader(name: string, value: string) { this.headers[name] = value; }});
test('table store resolves an active table QR', async () => { const token = 'a'.repeat(32); const fakeDb: any = {doc: () => ({get: async () => ({exists: true, data: () => ({active: true, slug: 'wow', locationKey: 'main', tableName: 'Table 5'})})})}; adminStoreAdapter.setDbForTests(() => fakeDb); const res = response(); await handler({method: 'GET', query: {token}}, res); adminStoreAdapter.reset(); assert.equal(res.statusCode, 200); assert.deepEqual(res.body, {slug: 'wow', locationKey: 'main', tableName: 'Table 5'}); });
