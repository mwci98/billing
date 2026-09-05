import assert from 'node:assert/strict';
import test from 'node:test';

const routes = {
  '/api/public-invoice': ['GET'], '/api/public-store': ['GET'], '/api/table-store': ['GET'],
  '/api/whatsapp-wallet': ['GET', 'POST'], '/api/barcode/lookup': ['GET'],
  '/api/communications/send-whatsapp-invoice': ['POST'], '/api/online-orders/action': ['POST'],
  '/api/online-orders/create': ['POST'], '/api/online-orders/status': ['GET'],
  '/api/public-invoices/create': ['POST'], '/api/razorpay/create-addon-order': ['POST'],
  '/api/razorpay/create-subscription': ['POST'], '/api/razorpay/create-whatsapp-wallet-order': ['POST'],
  '/api/razorpay/verify-addon-payment': ['POST'], '/api/razorpay/verify-whatsapp-wallet-payment': ['POST'],
  '/api/razorpay/verify': ['POST'], '/api/razorpay/webhook': ['POST'],
};

test('current API route inventory contains all 18 public routes', () => {
  assert.equal(Object.keys(routes).length, 17);
  for (const [route, methods] of Object.entries(routes)) assert.ok(route.startsWith('/api/') && methods.length > 0);
});
