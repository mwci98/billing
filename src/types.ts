/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  ADMIN = 'Admin',
  STAFF = 'Staff'
}

export interface Staff {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  taxRate: number; // e.g. 18 for 18% GST
  stock: number;
  lowStockAlert: number;
  expiryDate?: string; // YYYY-MM-DD
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  productId: string;
  name: string;
  sku: string;
  barcode: string;
  price: number;
  quantity: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export interface Sale {
  id: string;
  customerId?: string;
  customerName?: string;
  items: SaleItem[];
  subtotal: number;
  taxAmount: number;
  discount: number;
  total: number;
  paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Split';
  paymentDetails: {
    cashAmount?: number;
    upiAmount?: number;
    cardAmount?: number;
    referenceNo?: string;
  };
  loyaltyPointsEarned: number;
  date: string;
  authId: string;
  employeeName: string;
  status: 'Completed' | 'Pending' | 'Cancelled';
}

export interface PurchaseItem {
  productId: string;
  name: string;
  quantity: number;
  purchasePrice: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export interface Purchase {
  id: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  date: string;
  status: 'Received' | 'Ordered' | 'Pending';
  paymentStatus: 'Paid' | 'Partially Paid' | 'Unpaid';
  dueAmount: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  loyaltyPoints: number;
  totalSpent: number;
  outstandingDue: number;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  companyName: string;
  phone: string;
  email?: string;
  outstandingBalance: number;
  createdAt: string;
}

export interface InventoryTransaction {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  type: 'Stock In' | 'Stock Out' | 'Sale' | 'Purchase Entry' | 'Adjustment';
  quantity: number;
  previousStock: number;
  newStock: number;
  description: string;
  date: string;
  operatorId: string;
  operatorName: string;
}

export interface StoreSettings {
  storeName: string;
  phone: string;
  email: string;
  address: string;
  gstNumber: string;
  currency: string; // e.g. "₹", "$", "€"
  receiptHeader: string;
  receiptFooter: string;
  loyaltyPointsPerDollar: number; // conversion rate
}

export interface POSNotification {
  id: string;
  type: 'low_stock' | 'out_of_stock' | 'expiry_alert' | 'due_payment';
  title: string;
  message: string;
  date: string;
  read: boolean;
  referenceId?: string; // e.g. productId
}
