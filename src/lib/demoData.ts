/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Customer, Supplier, Sale, Purchase, InventoryTransaction, StoreSettings } from '../types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'iPhone 15 Pro Max (256GB - Natural Titanium)',
    sku: 'IPHONE-15PM-256',
    barcode: '194253846200',
    category: 'Smartphones',
    brand: 'Apple',
    unit: 'Unit',
    purchasePrice: 110000.00,
    sellingPrice: 134900.00,
    taxRate: 18, // 18% GST electronics
    stock: 15,
    lowStockAlert: 5,
    expiryDate: '',
    imageUrl: '📱',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-2',
    name: 'Samsung Galaxy S24 Ultra (512GB - Titanium Gray)',
    sku: 'SAMP-S24U-512',
    barcode: '8806095304624',
    category: 'Smartphones',
    brand: 'Samsung',
    unit: 'Unit',
    purchasePrice: 105000.00,
    sellingPrice: 129900.00,
    taxRate: 18,
    stock: 4, // low stock alert!
    lowStockAlert: 5,
    expiryDate: '',
    imageUrl: '📱',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-3',
    name: 'Google Pixel 8 Pro (128GB - Obsidian)',
    sku: 'PIXEL-8P-128',
    barcode: '840244705353',
    category: 'Smartphones',
    brand: 'Google',
    unit: 'Unit',
    purchasePrice: 72000.00,
    sellingPrice: 89990.00,
    taxRate: 18,
    stock: 12,
    lowStockAlert: 3,
    expiryDate: '',
    imageUrl: '📱',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-4',
    name: 'Apple AirPods Pro (2nd Generation - USB-C)',
    sku: 'AIRPODS-PRO-GEN2',
    barcode: '195949052412',
    category: 'Accessories',
    brand: 'Apple',
    unit: 'Unit',
    purchasePrice: 18000.00,
    sellingPrice: 24900.00,
    taxRate: 18,
    stock: 25,
    lowStockAlert: 8,
    expiryDate: '',
    imageUrl: '🎧',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-5',
    name: 'Anker Prime 20,000mAh Power Bank (200W)',
    sku: 'ANKER-PRIME-20K',
    barcode: '848061066524',
    category: 'Powerbanks',
    brand: 'Anker',
    unit: 'Unit',
    purchasePrice: 6500.00,
    sellingPrice: 9999.00,
    taxRate: 18,
    stock: 2, // low stock!
    lowStockAlert: 5,
    expiryDate: '',
    imageUrl: '🔋',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-6',
    name: 'Apple 20W USB-C Power Adapter',
    sku: 'APPLE-20W-CHARGER',
    barcode: '194252156935',
    category: 'Accessories',
    brand: 'Apple',
    unit: 'Unit',
    purchasePrice: 1100.00,
    sellingPrice: 1900.00,
    taxRate: 18,
    stock: 45,
    lowStockAlert: 10,
    expiryDate: '',
    imageUrl: '🔌',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-7',
    name: 'OnePlus 12 (256GB - Emerald Green)',
    sku: 'ONEPLUS-12-256',
    barcode: '6971639626354',
    category: 'Smartphones',
    brand: 'OnePlus',
    unit: 'Unit',
    purchasePrice: 52000.00,
    sellingPrice: 64999.00,
    taxRate: 18,
    stock: 8,
    lowStockAlert: 3,
    expiryDate: '',
    imageUrl: '📱',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    name: 'John Doe',
    phone: '9876543210',
    email: 'john.doe@gmail.com',
    loyaltyPoints: 120,
    totalSpent: 350.50,
    outstandingDue: 0,
    createdAt: new Date().toISOString()
  },
  {
    id: 'cust-2',
    name: 'Priya Sharma',
    phone: '9812345678',
    email: 'priya05@gmail.com',
    loyaltyPoints: 450,
    totalSpent: 1240.00,
    outstandingDue: 45.00, // Due for credit sale!
    createdAt: new Date().toISOString()
  },
  {
    id: 'cust-3',
    name: 'Sarah Jenkins',
    phone: '9900112233',
    email: 'sarah.j@hotmail.com',
    loyaltyPoints: 15,
    totalSpent: 45.00,
    outstandingDue: 0,
    createdAt: new Date().toISOString()
  }
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'supp-1',
    name: 'Apple Global Logistics',
    companyName: 'Apple Inc. Sales',
    phone: '1-800-MY-APPLE',
    email: 'channel_sales@apple.com',
    outstandingBalance: 12000.00,
    createdAt: new Date().toISOString()
  },
  {
    id: 'supp-2',
    name: 'Samsung Mobile Distribution',
    companyName: 'Samsung Electronics Co.',
    phone: '1-800-SAMSUNG',
    email: 'b2b.partners@samsung.com',
    outstandingBalance: 0,
    createdAt: new Date().toISOString()
  },
  {
    id: 'supp-3',
    name: 'Anker Premium Wholesale',
    companyName: 'Innovations Ltd',
    phone: '1-800-349-2653',
    email: 'wholesale@anker.com',
    outstandingBalance: 450.00,
    createdAt: new Date().toISOString()
  }
];

export const INITIAL_SETTINGS: StoreSettings = {
  storeName: 'QPOS',
  phone: '+91 98765 43210',
  email: 'support@qpos.neospec.co.in',
  address: '88 Tech Boulevard, Sector 62, Noida, UP 201309',
  gstNumber: '07AAAAA1111A1Z1', // Mock Electronics GSTIN
  currency: '₹',
  receiptHeader: 'WELCOME TO QPOS!\nTHANK YOU FOR SHOPPING WITH US',
  receiptFooter: 'Receipt generated by QPOS.\nPlease retain this invoice for your records.',
  loyaltyPointsPerDollar: 1 // ₹100 spend = loyalty point for premium gear
};

export const INITIAL_SALES: Sale[] = [
  {
    id: 'sale-1001',
    customerId: 'cust-1',
    customerName: 'John Doe',
    items: [
      {
        productId: 'prod-1',
        name: 'iPhone 15 Pro Max (256GB - Natural Titanium)',
        sku: 'IPHONE-15PM-256',
        barcode: '194253846200',
        price: 134900.00,
        quantity: 1,
        taxRate: 18,
        taxAmount: 24282.00,
        total: 159182.00
      },
      {
        productId: 'prod-6',
        name: 'Apple 20W USB-C Power Adapter',
        sku: 'APPLE-20W-CHARGER',
        barcode: '194252156935',
        price: 1900.00,
        quantity: 1,
        taxRate: 18,
        taxAmount: 342.00,
        total: 2242.00
      }
    ],
    subtotal: 136800.00,
    taxAmount: 24624.00,
    discount: 2000.00, // special package discount
    total: 159424.00,
    paymentMethod: 'UPI',
    paymentDetails: {
      referenceNo: 'UPI-8801938210'
    },
    loyaltyPointsEarned: 1594,
    date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
    authId: 'employee-1',
    employeeName: 'Staff Member',
    status: 'Completed'
  },
  {
    id: 'sale-1002',
    customerId: 'cust-2',
    customerName: 'Priya Sharma',
    items: [
      {
        productId: 'prod-4',
        name: 'Apple AirPods Pro (2nd Generation - USB-C)',
        sku: 'AIRPODS-PRO-GEN2',
        barcode: '195949052412',
        price: 24900.00,
        quantity: 1,
        taxRate: 18,
        taxAmount: 4482.00,
        total: 29382.00
      }
    ],
    subtotal: 24900.00,
    taxAmount: 4482.00,
    discount: 0,
    total: 29382.00,
    paymentMethod: 'UPI',
    paymentDetails: {
      referenceNo: 'UPI-9831730193'
    },
    loyaltyPointsEarned: 293,
    date: new Date().toISOString(), // Today
    authId: 'employee-1',
    employeeName: 'Staff Member',
    status: 'Completed'
  }
];

export const INITIAL_PURCHASES: Purchase[] = [
  {
    id: 'pur-2001',
    supplierId: 'supp-1',
    supplierName: 'Agro Farms Distributor',
    items: [
      {
        productId: 'prod-1',
        name: 'Organic Whole Wheat Bread',
        quantity: 50,
        purchasePrice: 1.80,
        taxRate: 5,
        taxAmount: 4.50,
        total: 94.50
      }
    ],
    subtotal: 90.00,
    taxAmount: 4.50,
    total: 94.50,
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'Received',
    paymentStatus: 'Paid',
    dueAmount: 0
  }
];

export const INITIAL_TRANSACTIONS: InventoryTransaction[] = [
  {
    id: 'tx-301',
    productId: 'prod-1',
    productName: 'Organic Whole Wheat Bread',
    sku: 'WHEAT-BREAD-01',
    type: 'Adjustment',
    quantity: 10,
    previousStock: 14,
    newStock: 24,
    description: 'Initial inventory shelf alignment count',
    date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    operatorId: 'admin-1',
    operatorName: 'System Admin'
  }
];
