export interface WhatsAppAdapter {sendInvoice: (...args: any[]) => Promise<any>}

export const whatsappAdapter: WhatsAppAdapter = {
  async sendInvoice(...args) { const {default: handler} = await import('../../../api/communications/send-whatsapp-invoice.js'); return handler(args[0], args[1]); },
};
