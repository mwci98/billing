export interface RazorpayAdapter {createOrder: (...args: any[]) => Promise<any>; verifySignature: (...args: any[]) => Promise<any>}

const lookup = async (path: string) => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error('RAZORPAY_NOT_CONFIGURED');
  const result = await fetch(`https://api.razorpay.com/v1/${path}`, {headers: {Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`}});
  const body = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error('RAZORPAY_LOOKUP_FAILED');
  return body;
};
export const razorpayLookup = {order: (id: string) => lookup(`orders/${encodeURIComponent(id)}`), payment: (id: string) => lookup(`payments/${encodeURIComponent(id)}`), subscription: (id: string) => lookup(`subscriptions/${encodeURIComponent(id)}`)};
export const setRazorpayLookupForTests = (value: Partial<typeof razorpayLookup>) => { Object.assign(razorpayLookup, value); };
export const resetRazorpayLookupForTests = () => { razorpayLookup.order = (id: string) => lookup(`orders/${encodeURIComponent(id)}`); razorpayLookup.payment = (id: string) => lookup(`payments/${encodeURIComponent(id)}`); razorpayLookup.subscription = (id: string) => lookup(`subscriptions/${encodeURIComponent(id)}`); };

export const razorpayAdapter: RazorpayAdapter = {
  async createOrder(...args) { const {default: handler} = await import('../../../api/razorpay/create-subscription.js'); return handler(args[0], args[1]); },
  async verifySignature(...args) { const {default: handler} = await import('../../../api/razorpay/webhook.js'); return handler(args[0], args[1]); },
};
