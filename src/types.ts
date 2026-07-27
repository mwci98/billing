/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  ADMIN = 'Admin',
  STAFF = 'Staff'
}

export interface StaffPermissions {
  canBill: boolean;
  canPurchase: boolean;
  canManageProducts: boolean;
  canManageCustomers: boolean;
  canViewDashboard: boolean;
  canViewFinancials: boolean;
}

export interface Staff {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
  permissions: StaffPermissions;
  passcodeHash: string;
  active: boolean;
  createdAt: string;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId?: string;
  permissions?: StaffPermissions;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  imeiNumbers?: string[];
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
  sourcingType?: 'Purchased' | 'Manufactured' | 'Both'; // Origin of product
  manufacturingCost?: number; // Direct production/raw material cost per unit
  batchNo?: string; // Production batch number
  productionNotes?: string; // Assembly or recipe notes
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
  entryType?: 'Supplier Purchase' | 'In-House Production';
  batchNo?: string;
  productionNotes?: string;
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
  gstNumber?: string;
  address?: string;
  outstandingBalance: number;
  createdAt: string;
}

export interface InventoryTransaction {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  type: 'Stock In' | 'Stock Out' | 'Sale' | 'Purchase Entry' | 'Adjustment' | 'In-House Production';
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
  invoiceSignature?: string;
  loyaltyPointsPerDollar: number; // conversion rate
  planTier?: 'Free' | 'Basic' | 'Pro' | 'Enterprise';
  tenantId?: string;
  storeBranch?: string;
  subscriptionStatus?: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
  trialStartedAt?: string;
  trialEndsAt?: string;
  razorpaySubscriptionId?: string;
  subscriptionCurrentEnd?: string;
  onboardingCompleted?: boolean;
  ownerName?: string;
  businessType?: string;
  website?: string;
  storeBranches?: SaaSStore[];
  activeStoreId?: string;
}

export interface SaaSStore {
  id: string;
  name: string;
  branchCode: string;
  city: string;
  status: 'Active' | 'Inactive';
}

export interface SaaSPlan {
  name: 'Free' | 'Basic' | 'Pro' | 'Enterprise';
  priceYearly: number;
  maxProducts: number;
  maxMonthlySales: number;
  multiBranch: boolean;
  cloudBackup: boolean;
  customBranding: boolean;
  features: string[];
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
