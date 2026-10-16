import assert from 'node:assert/strict';
import test from 'node:test';
import {Product, Proposal} from '../src/types';
import {PROPOSAL_DOCUMENT_TITLE, validateProposalConversion} from '../src/lib/proposalWorkflow';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1', name: 'Consulting package', sku: 'SVC-1', barcode: '', itemType: 'Service', category: 'Services', brand: '', unit: 'Hour', purchasePrice: 0, sellingPrice: 1000, taxRate: 18, stock: 0, lowStockAlert: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01', ...overrides
});
const proposal = (overrides: Partial<Proposal> = {}): Proposal => ({
  id: 'proposal-1', customerName: 'Acme', items: [{productId: 'p1', name: 'Consulting package', sku: 'SVC-1', barcode: '', price: 1000, quantity: 1, taxRate: 18, taxAmount: 180, total: 1000}], subtotal: 1000, taxAmount: 180, discount: 0, total: 1180, createdAt: '2026-01-01', updatedAt: '2026-01-01', validUntil: '2026-02-01', status: 'Draft', authId: 'u1', employeeName: 'Owner', ...overrides
});

test('service proposals convert without requiring inventory', () => {
  assert.doesNotThrow(() => validateProposalConversion(proposal(), [product()]));
});

test('conversion rejects insufficient stock without mutating product or proposal', () => {
  const inventory = product({itemType: 'Material', stock: 1});
  const draft = proposal({items: [{...proposal().items[0], quantity: 2}]});
  const before = JSON.stringify({inventory, draft});
  assert.throws(() => validateProposalConversion(draft, [inventory]), /Insufficient stock/);
  assert.equal(JSON.stringify({inventory, draft}), before);
});

test('converted proposals cannot be converted again', () => {
  assert.throws(() => validateProposalConversion(proposal({status: 'Converted', convertedSaleId: 'sale-1'}), [product()]), /already been converted/);
});

test('serialized inventory is revalidated at conversion time', () => {
  const serialized = product({itemType: 'Material', stock: 1, inventoryTrackingType: 'serial', serializedUnits: [{id: 'unit-1', imei1: 'SN1', status: 'Sold', addedAt: '2026-01-01'}]});
  const draft = proposal({items: [{...proposal().items[0], serializedUnits: [{unitId: 'unit-1', imei1: 'SN1', trackingType: 'serial'}]}]});
  assert.throws(() => validateProposalConversion(draft, [serialized]), /no longer available/);
});

test('proposal documents use explicit non-invoice labeling', () => {
  assert.equal(PROPOSAL_DOCUMENT_TITLE, 'PROPOSAL / QUOTATION');
});
