import assert from 'node:assert/strict';
import test from 'node:test';
import {findHomepageFaqAnswer, homepageFaqEntries, unknownHomepageFaqAnswer} from '../src/lib/homepageFaq';

test('FAQ knowledge covers verified homepage topics', () => {
  assert.ok(homepageFaqEntries.length >= 10);
  assert.match(findHomepageFaqAnswer('How much is QPOS after the free trial?')?.answer ?? '', /20-day free trial.*₹6,000 per year/);
  assert.match(findHomepageFaqAnswer('Do quotations reduce stock?')?.answer ?? '', /not reduced until conversion/);
  assert.match(findHomepageFaqAnswer('Can restaurants use table QR ordering?')?.answer ?? '', /table QR ordering/);
  assert.match(findHomepageFaqAnswer('monthly GST csv reports')?.answer ?? '', /CSV exports/);
});

test('FAQ matching is deterministic and ignores punctuation and case', () => {
  const first = findHomepageFaqAnswer('GST INVOICE???');
  const second = findHomepageFaqAnswer('gst invoice');
  assert.equal(first?.id, 'gst-billing');
  assert.equal(first?.id, second?.id);
});

test('specific product questions beat generic business-mode matches', () => {
  assert.equal(findHomepageFaqAnswer('restaurant features')?.id, 'restaurant');
  assert.equal(findHomepageFaqAnswer('What restaurant features are available?')?.id, 'restaurant');
  assert.equal(findHomepageFaqAnswer('How do proposals work?')?.id, 'proposals');
  assert.equal(findHomepageFaqAnswer('proposal stock conversion')?.id, 'proposals');
  assert.equal(findHomepageFaqAnswer('What does QPOS cost?')?.id, 'trial-pricing');
  assert.equal(findHomepageFaqAnswer('monthly sales reports')?.id, 'reports');
  assert.equal(findHomepageFaqAnswer('Do I get an online store?')?.id, 'online-store');
  assert.equal(findHomepageFaqAnswer('online ordering site')?.id, 'online-store');
  assert.match(findHomepageFaqAnswer('public storefront for pickup')?.answer ?? '', /COD or pay-at-store/);
  assert.equal(findHomepageFaqAnswer('billing software in Kohima')?.id, 'kohima-local');
});

test('unknown and empty questions do not invent an answer', () => {
  assert.equal(findHomepageFaqAnswer(''), null);
  assert.equal(findHomepageFaqAnswer('quantum satellite payroll'), null);
  assert.match(unknownHomepageFaqAnswer, /could not match/i);
  assert.match(unknownHomepageFaqAnswer, /contact Neospec Services/i);
});
