export type HomepageFaqEntry = {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
};

export const homepageFaqEntries: HomepageFaqEntry[] = [
  {
    id: 'trial-pricing',
    question: 'What does QPOS cost?',
    answer: 'QPOS has a 20-day free trial. The Basic plan is ₹6,000 per year, and an additional store workspace is ₹500 as a one-time add-on.',
    keywords: ['price', 'pricing', 'cost', 'plan', 'subscription', 'trial', 'free', 'basic', '6000', '500'],
  },
  {
    id: 'online-store',
    question: 'Do I get an online store?',
    answer: 'Yes. Restaurant mode includes one public online ordering storefront during the 20-day free trial. Customers can view the menu and place pickup or local-delivery orders using COD or pay-at-store. QPOS also supports online order management and table QR ordering. Online card payments are not included.',
    keywords: ['online store', 'online ordering', 'storefront', 'ordering site', 'public menu', 'pickup', 'local delivery'],
  },
  {
    id: 'kohima-local',
    question: 'Is QPOS available for businesses in Kohima?',
    answer: 'Yes. QPOS is billing, POS and inventory management software available to retail, service, hybrid and restaurant businesses in Kohima and elsewhere in India. Its cloud-connected web workspace can be used on supported phones, tablets and desktop computers.',
    keywords: ['kohima', 'nagaland', 'local business', 'available in kohima'],
  },
  {
    id: 'business-modes',
    question: 'Which businesses can use QPOS?',
    answer: 'QPOS supports Retail, Service, Hybrid and Restaurant workspaces. Hybrid mode lets a business bill products and services together.',
    keywords: ['business', 'retail', 'service', 'hybrid', 'restaurant', 'mode', 'shop', 'store'],
  },
  {
    id: 'gst-billing',
    question: 'Does QPOS support GST invoices?',
    answer: 'Yes. QPOS supports GST billing, tax details, discounts, customer information, branded invoices, printing and PDF downloads. Your business should still review its tax settings and compliance.',
    keywords: ['gst', 'tax', 'invoice', 'billing', 'bill', 'discount', 'pdf', 'print'],
  },
  {
    id: 'proposals',
    question: 'How do proposals work?',
    answer: 'Retail and Service businesses can create, edit, print and download proposals. An accepted proposal converts once into an invoice, and product stock is not reduced until conversion.',
    keywords: ['proposal', 'quotation', 'quote', 'estimate', 'convert', 'stock'],
  },
  {
    id: 'inventory',
    question: 'What inventory tools are included?',
    answer: 'QPOS covers products and services, categories, images, SKU and barcode lookup, purchases, suppliers, transactions, low-stock and expiry alerts, plus IMEI and serial-number tracking.',
    keywords: ['inventory', 'stock', 'product', 'sku', 'barcode', 'camera', 'purchase', 'supplier', 'expiry', 'imei', 'serial'],
  },
  {
    id: 'restaurant',
    question: 'What restaurant features are available?',
    answer: 'Restaurant mode includes tables, open orders, dine-in, takeaway and delivery, variants, kitchen notes, order editing, settlement, 80mm receipts, table QR ordering, and one online ordering storefront during the trial. The storefront supports COD or pay-at-store workflows, not online card payments.',
    keywords: ['restaurant', 'table', 'dine', 'takeaway', 'delivery', 'kitchen', 'menu', 'order', 'receipt', 'qr'],
  },
  {
    id: 'payments',
    question: 'Which payment workflows are supported?',
    answer: 'QPOS can record Cash, UPI and split payments, along with customer credit and outstanding dues. The public restaurant storefront supports COD or pay-at-store workflows.',
    keywords: ['payment', 'cash', 'upi', 'split', 'credit', 'due', 'cod', 'pay'],
  },
  {
    id: 'reports',
    question: 'Which reports can I view?',
    answer: 'QPOS provides weekly, monthly and yearly sales views, GST and estimated-profit reporting, a month selector, and sales or GST CSV exports.',
    keywords: ['report', 'sales', 'weekly', 'monthly', 'yearly', 'profit', 'csv', 'export'],
  },
  {
    id: 'stores-staff',
    question: 'Can I manage stores and staff?',
    answer: 'Yes. QPOS supports separated store workspaces, workspace switching, staff roles and permissions. Customer, stock and operational data stay in the appropriate workspace.',
    keywords: ['multi', 'store', 'workspace', 'branch', 'staff', 'employee', 'role', 'permission'],
  },
  {
    id: 'devices-pwa',
    question: 'Which devices can run QPOS?',
    answer: 'QPOS is an installable web app designed for phones, tablets and desktop computers. It also includes dark mode, notifications and backup/restore tools.',
    keywords: ['device', 'phone', 'mobile', 'tablet', 'desktop', 'computer', 'pwa', 'install', 'dark', 'backup'],
  },
];

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9₹]+/g, ' ').trim();

const tokens = (value: string) => new Set(normalize(value).split(/\s+/).filter(Boolean));

const overlap = (left: Set<string>, right: Set<string>) => {
  let total = 0;
  left.forEach(token => {
    if (right.has(token)) total += 1;
  });
  return total;
};

export const findHomepageFaqAnswer = (input: string) => {
  const normalized = normalize(input);
  if (!normalized) return null;
  const exact = homepageFaqEntries.find(entry => normalize(entry.question) === normalized);
  if (exact) return exact;

  const words = tokens(normalized);
  const ranked = homepageFaqEntries
    .map(entry => {
      const keywordMatches = entry.keywords.reduce((score, keyword) => {
        const normalizedKeyword = normalize(keyword);
        return score + (
          words.has(normalizedKeyword)
            ? 1
            : normalizedKeyword.length >= 5 && normalized.includes(normalizedKeyword)
              ? 1
              : 0
        );
      }, 0);
      const questionOverlap = overlap(words, tokens(entry.question));
      const answerOverlap = overlap(words, tokens(entry.answer));
      return {
        entry,
        keywordMatches,
        questionOverlap,
        answerOverlap,
        specificity: entry.keywords.length,
      };
    })
    .sort((a, b) =>
      b.keywordMatches - a.keywordMatches ||
      b.questionOverlap - a.questionOverlap ||
      b.answerOverlap - a.answerOverlap ||
      b.specificity - a.specificity ||
      a.entry.id.localeCompare(b.entry.id),
    );
  return ranked[0]?.keywordMatches > 0 ? ranked[0].entry : null;
};

export const unknownHomepageFaqAnswer = 'I could not match that to the QPOS information on this page. Try one of the suggested questions, start the free trial, or contact Neospec Services for a specific product question.';
