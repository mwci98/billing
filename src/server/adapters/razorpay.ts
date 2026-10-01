export interface RazorpayAdapter {createOrder: (...args: any[]) => Promise<any>; verifySignature: (...args: any[]) => Promise<any>}

export const razorpayAdapter: RazorpayAdapter = {
  async createOrder(...args) { const {default: handler} = await import('../../../api/razorpay/create-subscription.js'); return handler(args[0], args[1]); },
  async verifySignature(...args) { const {default: handler} = await import('../../../api/razorpay/webhook.js'); return handler(args[0], args[1]); },
};
