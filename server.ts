import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const handlers: Record<string, () => Promise<any>> = {
  '/api/public-store': () => import('./api/public-store.js'),
  '/api/public-invoice': () => import('./api/public-invoice.js'),
  '/api/table-store': () => import('./api/table-store.js'),
  '/api/whatsapp-wallet': () => import('./api/whatsapp-wallet.js'),
  '/api/barcode/lookup': () => import('./api/barcode/lookup.js'),
  '/api/communications/send-whatsapp-invoice': () => import('./api/communications/send-whatsapp-invoice.js'),
  '/api/online-orders/action': () => import('./api/online-orders/action.js'),
  '/api/online-orders/create': () => import('./api/online-orders/create.js'),
  '/api/online-orders/status': () => import('./api/online-orders/status.js'),
  '/api/public-invoices/create': () => import('./api/public-invoices/create.js'),
  '/api/razorpay/create-addon-order': () => import('./api/razorpay/create-addon-order.js'),
  '/api/razorpay/create-subscription': () => import('./api/razorpay/create-subscription.js'),
  '/api/razorpay/create-whatsapp-wallet-order': () => import('./api/razorpay/create-whatsapp-wallet-order.js'),
  '/api/razorpay/verify-addon-payment': () => import('./api/razorpay/verify-addon-payment.js'),
  '/api/razorpay/verify-whatsapp-wallet-payment': () => import('./api/razorpay/verify-whatsapp-wallet-payment.js'),
  '/api/razorpay/verify': () => import('./api/razorpay/verify.js'),
  '/api/razorpay/webhook': () => import('./api/razorpay/webhook.js'),
};

app.use('/api/razorpay/webhook', express.raw({type: '*/*', limit: '15mb'}));
app.use('/api', express.json({limit: '15mb'}));
app.use('/api', express.urlencoded({extended: true, limit: '15mb'}));

app.use('/api', async (req, res, next) => {
  const routePath = `${req.baseUrl}${req.path}`;
  const load = handlers[routePath];
  if (!load) return next();
  try {
    const module = await load();
    const body = req.body;
    const request: any = {...req, body, headers: req.headers, method: req.method};
    if (routePath === '/api/razorpay/webhook') request[Symbol.asyncIterator] = async function* () { yield Buffer.isBuffer(body) ? body : Buffer.from(body || ''); };
    await module.default(request, res);
  } catch (error) {
    console.error('API handler failed:', req.path, error);
    if (!res.headersSent) res.status(500).json({error: 'Internal server error.'});
  }
});

app.use(express.static(path.join(root, 'dist')));
app.get('*', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));

const port = Number(process.env.PORT || 3002);
app.listen(port, '0.0.0.0', () => console.log(`QPOS API server listening on ${port}`));
