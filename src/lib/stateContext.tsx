/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Product, Customer, Supplier, Sale, Purchase, 
  InventoryTransaction, StoreSettings, POSNotification, UserRole 
} from '../types';
import { 
  INITIAL_PRODUCTS, INITIAL_CUSTOMERS, INITIAL_SUPPLIERS, 
  INITIAL_SETTINGS, INITIAL_SALES, INITIAL_PURCHASES, INITIAL_TRANSACTIONS 
} from './demoData';
import { db, auth } from './firebase';
import { doc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';

interface AppContextType {
  // Auth Session State
  currentUser: { id: string; name: string; email: string; role: UserRole } | null;
  login: (email: string, role: UserRole, name?: string) => Promise<boolean>;
  logout: () => void;
  isFirebaseConnected: boolean;

  // Business Data Store
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  sales: Sale[];
  purchases: Purchase[];
  transactions: InventoryTransaction[];
  settings: StoreSettings;
  notifications: POSNotification[];

  // Mutators / Actions
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  editProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addSale: (sale: Omit<Sale, 'id' | 'date'>) => Sale;
  addPurchase: (purchase: Omit<Purchase, 'id' | 'date'>) => void;
  adjustStock: (productId: string, quantity: number, type: 'Stock In' | 'Stock Out' | 'Adjustment', description: string) => void;
  
  // Contacts
  addCustomer: (customer: Omit<Customer, 'id' | 'totalSpent' | 'outstandingDue' | 'createdAt'>) => Customer;
  editCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addSupplier: (supplier: Omit<Supplier, 'id' | 'outstandingBalance' | 'createdAt'>) => void;
  editSupplier: (id: string, supplier: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;

  // Settings
  updateSettings: (settings: StoreSettings) => void;

  // Backup & Synclists
  syncWithCloud: () => Promise<boolean>;
  restoreFromBackup: (jsonData: string) => boolean;
  exportDatabaseJson: () => string;
  clearAllNotifications: () => void;
  markNotificationRead: (id: string) => void;

  // Custom visual toast alerts
  toast: { message: string; type: 'success' | 'error' | 'warning' | 'info' } | null;
  triggerToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;

  // Current view or tabs helper
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // Darkmode switch helper
  isDarkMode: boolean;
  setIsDarkMode: (mode: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Active Navigation
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Authenticated State (Role-based)
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string; role: UserRole } | null>(() => {
    const savedUser = localStorage.getItem('pos_active_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(true);

  // Core Data Lists
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(INITIAL_SETTINGS);
  const [notifications, setNotifications] = useState<POSNotification[]>([]);

  // Toast notifier state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  const triggerToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToast({ message, type });
  };

  // Auto clean up toast timer
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // 1. Initial State Hydration (LocalStorage offline-first pattern)
  useEffect(() => {
    const localProducts = localStorage.getItem('pos_products');
    const localCustomers = localStorage.getItem('pos_customers');
    const localSuppliers = localStorage.getItem('pos_suppliers');
    const localSales = localStorage.getItem('pos_sales');
    const localPurchases = localStorage.getItem('pos_purchases');
    const localTransactions = localStorage.getItem('pos_transactions');
    const localSettings = localStorage.getItem('pos_settings');

    if (localProducts) setProducts(JSON.parse(localProducts));
    else {
      setProducts(INITIAL_PRODUCTS);
      localStorage.setItem('pos_products', JSON.stringify(INITIAL_PRODUCTS));
    }

    if (localCustomers) setCustomers(JSON.parse(localCustomers));
    else {
      setCustomers(INITIAL_CUSTOMERS);
      localStorage.setItem('pos_customers', JSON.stringify(INITIAL_CUSTOMERS));
    }

    if (localSuppliers) setSuppliers(JSON.parse(localSuppliers));
    else {
      setSuppliers(INITIAL_SUPPLIERS);
      localStorage.setItem('pos_suppliers', JSON.stringify(INITIAL_SUPPLIERS));
    }

    if (localSales) setSales(JSON.parse(localSales));
    else {
      setSales(INITIAL_SALES);
      localStorage.setItem('pos_sales', JSON.stringify(INITIAL_SALES));
    }

    if (localPurchases) setPurchases(JSON.parse(localPurchases));
    else {
      setPurchases(INITIAL_PURCHASES);
      localStorage.setItem('pos_purchases', JSON.stringify(INITIAL_PURCHASES));
    }

    if (localTransactions) setTransactions(JSON.parse(localTransactions));
    else {
      setTransactions(INITIAL_TRANSACTIONS);
      localStorage.setItem('pos_transactions', JSON.stringify(INITIAL_TRANSACTIONS));
    }

    if (localSettings) setSettings(JSON.parse(localSettings));
    else {
      setSettings(INITIAL_SETTINGS);
      localStorage.setItem('pos_settings', JSON.stringify(INITIAL_SETTINGS));
    }

    // Initialize darkmode
    const savedTheme = localStorage.getItem('pos_dark_mode');
    if (savedTheme === 'true') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Sync state mutations helper
  const saveLocalAndState = <T,>(key: string, data: T, setter: React.Dispatch<React.SetStateAction<T>>) => {
    setter(data);
    localStorage.setItem(key, JSON.stringify(data));
  };

  // 2. Automated Smart Notification Engine based on Live Catalog
  useEffect(() => {
    if (products.length === 0) return;

    const list: POSNotification[] = [];
    const today = new Date();
    const tenDaysFromNow = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000);

    products.forEach((prod) => {
      // 1. Out of stock alert
      if (prod.stock === 0) {
        list.push({
          id: `notif-out-${prod.id}`,
          type: 'out_of_stock',
          title: '🔥 Out of Stock Alert',
          message: `Product "${prod.name}" (${prod.sku}) is completely carrying 0 stock. Restock needed immediately.`,
          date: new Date().toISOString(),
          read: false,
          referenceId: prod.id
        });
      }
      // 2. Low stock alert
      else if (prod.stock <= prod.lowStockAlert) {
        list.push({
          id: `notif-low-${prod.id}`,
          type: 'low_stock',
          title: '⚠️ Low Stock Alert',
          message: `Product "${prod.name}" has only ${prod.stock} ${prod.unit} left. (Threshold: ${prod.lowStockAlert})`,
          date: new Date().toISOString(),
          read: false,
          referenceId: prod.id
        });
      }

      // 3. Expiry alert
      if (prod.expiryDate) {
        const exp = new Date(prod.expiryDate);
        if (exp < today) {
          list.push({
            id: `notif-exp-${prod.id}`,
            type: 'expiry_alert',
            title: '🚨 Product Expired',
            message: `Product "${prod.name}" has expired on ${prod.expiryDate}. Please dispose or isolate immediately!`,
            date: new Date().toISOString(),
            read: false,
            referenceId: prod.id
          });
        } else if (exp <= tenDaysFromNow) {
          list.push({
            id: `notif-expwarn-${prod.id}`,
            type: 'expiry_alert',
            title: '⏳ Fast Expiring Product',
            message: `Product "${prod.name}" is expiring on ${prod.expiryDate} (under 10 days left).`,
            date: new Date().toISOString(),
            read: false,
            referenceId: prod.id
          });
        }
      }
    });

    // 4. Due payment alert on Customers
    customers.forEach((cust) => {
      if (cust.outstandingDue > 10) {
        list.push({
          id: `notif-cust-${cust.id}`,
          type: 'due_payment',
          title: '💳 Customer Credit Due',
          message: `${cust.name} has outstanding due payment of ${settings.currency}${cust.outstandingDue.toFixed(2)}.`,
          date: new Date().toISOString(),
          read: false,
          referenceId: cust.id
        });
      }
    });

    setNotifications(list);
  }, [products, customers, settings.currency]);

  // Handle Dark mode transition
  const toggleDarkMode = (mode: boolean) => {
    setIsDarkMode(mode);
    localStorage.setItem('pos_dark_mode', mode ? 'true' : 'false');
    if (mode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // 3. Authentications System
  const login = async (email: string, role: UserRole, name?: string): Promise<boolean> => {
    const formattedEmail = email.toLowerCase().trim();
    const cleanName = name || (role === UserRole.ADMIN ? 'Administrator' : 'Billing Staff');
    const userSession = {
      id: role === UserRole.ADMIN ? 'admin-1' : 'employee-1',
      email: formattedEmail,
      name: cleanName,
      role: role
    };
    saveLocalAndState('pos_active_user', userSession, setCurrentUser);
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('pos_active_user');
    setActiveTab('dashboard');
  };

  // 4. Product mutators
  const addProduct = (p: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newProd: Product = {
      ...p,
      id: `prod-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const updated = [newProd, ...products];
    saveLocalAndState('pos_products', updated, setProducts);

    // Stock transaction log
    addTransaction(
      newProd.id,
      newProd.name,
      newProd.sku,
      'Stock In',
      newProd.stock,
      0,
      newProd.stock,
      'Initial stock registration count.'
    );
  };

  const editProduct = (id: string, p: Partial<Product>) => {
    const updated = products.map((prod) => {
      if (prod.id === id) {
        const merged = { ...prod, ...p, updatedAt: new Date().toISOString() };
        // Log transaction if stock modified
        if (p.stock !== undefined && p.stock !== prod.stock) {
          const delta = p.stock - prod.stock;
          addTransaction(
            prod.id,
            prod.name,
            prod.sku,
            delta > 0 ? 'Stock In' : 'Stock Out',
            Math.abs(delta),
            prod.stock,
            p.stock,
            'Manual product edit adjustment.'
          );
        }
        return merged;
      }
      return prod;
    });
    saveLocalAndState('pos_products', updated, setProducts);
  };

  const deleteProduct = (id: string) => {
    const updated = products.filter((p) => p.id !== id);
    saveLocalAndState('pos_products', updated, setProducts);
  };

  // 5. Transaction log helpers
  const addTransaction = (
    productId: string,
    prodName: string,
    sku: string,
    type: 'Stock In' | 'Stock Out' | 'Sale' | 'Purchase Entry' | 'Adjustment',
    quantity: number,
    prev: number,
    next: number,
    desc: string
  ) => {
    const newTx: InventoryTransaction = {
      id: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      productId,
      productName: prodName,
      sku,
      type,
      quantity,
      previousStock: prev,
      newStock: next,
      description: desc,
      date: new Date().toISOString(),
      operatorId: currentUser?.id || 'system-1',
      operatorName: currentUser?.name || 'Automated System'
    };

    setTransactions((prevTx) => {
      const newList = [newTx, ...prevTx];
      localStorage.setItem('pos_transactions', JSON.stringify(newList));
      return newList;
    });
  };

  // 6. POS Sales Billing Compiler
  const addSale = (s: Omit<Sale, 'id' | 'date'>): Sale => {
    const saleId = `sale-${Math.floor(100000 + Math.random() * 900000)}`;
    const newSale: Sale = {
      ...s,
      id: saleId,
      date: new Date().toISOString()
    };

    // Update real-time product stock counts and write audit logs
    const updatedProducts = products.map((prod) => {
      const soldItem = s.items.find((item) => item.productId === prod.id);
      if (soldItem) {
        const nextStock = Math.max(0, prod.stock - soldItem.quantity);
        addTransaction(
          prod.id,
          prod.name,
          prod.sku,
          'Sale',
          soldItem.quantity,
          prod.stock,
          nextStock,
          `POS Bill #${saleId} client sale.`
        );
        return {
          ...prod,
          stock: nextStock,
          updatedAt: new Date().toISOString()
        };
      }
      return prod;
    });
    saveLocalAndState('pos_products', updatedProducts, setProducts);

    // Record sales history
    const updatedSales = [newSale, ...sales];
    saveLocalAndState('pos_sales', updatedSales, setSales);

    // Update customer records (Loyalty points & spent totals)
    if (s.customerId) {
      const updatedCustomers = customers.map((c) => {
        if (c.id === s.customerId) {
          const addPoints = s.loyaltyPointsEarned || Math.floor(s.total * settings.loyaltyPointsPerDollar);
          return {
            ...c,
            loyaltyPoints: c.loyaltyPoints + addPoints,
            totalSpent: c.totalSpent + s.total,
            outstandingDue: s.paymentMethod === 'Split' && s.paymentDetails?.referenceNo?.includes('Credit')
              ? c.outstandingDue + (s.total - (s.paymentDetails.cashAmount || 0) - (s.paymentDetails.cardAmount || 0))
              : c.outstandingDue
          };
        }
        return c;
      });
      saveLocalAndState('pos_customers', updatedCustomers, setCustomers);
    }

    return newSale;
  };

  // 7. Purchase entry restock catalog
  const addPurchase = (p: Omit<Purchase, 'id' | 'date'>) => {
    const purchaseId = `pur-${Math.floor(2000 + Math.random() * 8000)}`;
    const newPurchase: Purchase = {
      ...p,
      id: purchaseId,
      date: new Date().toISOString()
    };

    // Increase product inventory stock on arrivals
    const updatedProducts = products.map((prod) => {
      const purchasedItem = p.items.find((item) => item.productId === prod.id);
      if (purchasedItem) {
        const nextStock = prod.stock + purchasedItem.quantity;
        addTransaction(
          prod.id,
          prod.name,
          prod.sku,
          'Purchase Entry',
          purchasedItem.quantity,
          prod.stock,
          nextStock,
          `Purchase Invoice #${purchaseId} stocking.`
        );
        return {
          ...prod,
          stock: nextStock,
          purchasePrice: purchasedItem.purchasePrice, // Adaptive current purchase price setup
          updatedAt: new Date().toISOString()
        };
      }
      return prod;
    });
    saveLocalAndState('pos_products', updatedProducts, setProducts);

    // Save purchases ledger
    const updatedPurchases = [newPurchase, ...purchases];
    saveLocalAndState('pos_purchases', updatedPurchases, setPurchases);

    // Increase outstanding balance inside Supplier fields
    if (p.supplierId) {
      const updatedSuppliers = suppliers.map((s) => {
        if (s.id === p.supplierId) {
          return {
            ...s,
            outstandingBalance: s.outstandingBalance + p.dueAmount
          };
        }
        return s;
      });
      saveLocalAndState('pos_suppliers', updatedSuppliers, setSuppliers);
    }
  };

  // Stock Adjuster helper
  const adjustStock = (productId: string, quantity: number, type: 'Stock In' | 'Stock Out' | 'Adjustment', description: string) => {
    const targetProduct = products.find((prod) => prod.id === productId);
    if (!targetProduct) return;

    let delta = quantity;
    if (type === 'Stock Out') {
      delta = -Math.abs(quantity);
    } else if (type === 'Adjustment') {
      delta = quantity - targetProduct.stock;
    }

    const nextStock = Math.max(0, targetProduct.stock + delta);
    
    const updated = products.map((prod) => {
      if (prod.id === productId) {
        return {
          ...prod,
          stock: nextStock,
          updatedAt: new Date().toISOString()
        };
      }
      return prod;
    });

    saveLocalAndState('pos_products', updated, setProducts);

    addTransaction(
      productId,
      targetProduct.name,
      targetProduct.sku,
      type,
      Math.abs(delta),
      targetProduct.stock,
      nextStock,
      description || `Inventory manual adjustment (${type}).`
    );
  };

  // 8. Contact management list controllers
  const addCustomer = (c: Omit<Customer, 'id' | 'totalSpent' | 'outstandingDue' | 'createdAt'>): Customer => {
    const newCust: Customer = {
      ...c,
      id: `cust-${Date.now()}`,
      totalSpent: 0,
      outstandingDue: 0,
      createdAt: new Date().toISOString()
    };
    const updated = [newCust, ...customers];
    saveLocalAndState('pos_customers', updated, setCustomers);
    return newCust;
  };

  const editCustomer = (id: string, c: Partial<Customer>) => {
    const updated = customers.map((cust) => cust.id === id ? { ...cust, ...c } : cust);
    saveLocalAndState('pos_customers', updated, setCustomers);
  };

  const deleteCustomer = (id: string) => {
    const updated = customers.filter((cust) => cust.id !== id);
    saveLocalAndState('pos_customers', updated, setCustomers);
  };

  const addSupplier = (s: Omit<Supplier, 'id' | 'outstandingBalance' | 'createdAt'>) => {
    const newSupp: Supplier = {
      ...s,
      id: `supp-${Date.now()}`,
      outstandingBalance: 0,
      createdAt: new Date().toISOString()
    };
    const updated = [newSupp, ...suppliers];
    saveLocalAndState('pos_suppliers', updated, setSuppliers);
  };

  const editSupplier = (id: string, s: Partial<Supplier>) => {
    const updated = suppliers.map((supp) => supp.id === id ? { ...supp, ...s } : supp);
    saveLocalAndState('pos_suppliers', updated, setSuppliers);
  };

  const deleteSupplier = (id: string) => {
    const updated = suppliers.filter((supp) => supp.id !== id);
    saveLocalAndState('pos_suppliers', updated, setSuppliers);
  };

  // Settings
  const updateSettings = (newSettings: StoreSettings) => {
    saveLocalAndState('pos_settings', newSettings, setSettings);
  };

  // 9. Database Backup & Client Sync Flow
  const exportDatabaseJson = (): string => {
    const backupObj = {
      products,
      customers,
      suppliers,
      sales,
      purchases,
      transactions,
      settings,
      backupDate: new Date().toISOString(),
      version: '1.0.0'
    };
    return JSON.stringify(backupObj, null, 2);
  };

  const restoreFromBackup = (jsonData: string): boolean => {
    try {
      const parsed = JSON.parse(jsonData);
      if (!parsed.products || !parsed.settings) return false;

      if (parsed.products) saveLocalAndState('pos_products', parsed.products, setProducts);
      if (parsed.customers) saveLocalAndState('pos_customers', parsed.customers, setCustomers);
      if (parsed.suppliers) saveLocalAndState('pos_suppliers', parsed.suppliers, setSuppliers);
      if (parsed.sales) saveLocalAndState('pos_sales', parsed.sales, setSales);
      if (parsed.purchases) saveLocalAndState('pos_purchases', parsed.purchases, setPurchases);
      if (parsed.transactions) saveLocalAndState('pos_transactions', parsed.transactions, setTransactions);
      if (parsed.settings) saveLocalAndState('pos_settings', parsed.settings, setSettings);
      
      return true;
    } catch (e) {
      console.error('Backup restore fail:', e);
      return false;
    }
  };

  const syncWithCloud = async (): Promise<boolean> => {
    try {
      // Sync store profiles, products, and logs with Firestore database
      if (!auth.currentUser) {
        setIsFirebaseConnected(false);
        return false;
      }

      const batch = writeBatch(db);

      // Back up settings
      const settingsRef = doc(db, 'store_settings', 'active');
      batch.set(settingsRef, { ...settings, updatedAt: new Date().toISOString() });

      // Back up products (take up to first 25 for batch security limit)
      products.slice(0, 25).forEach(prod => {
        const prodRef = doc(db, 'products', prod.id);
        batch.set(prodRef, prod);
      });

      // Synchronize batch
      await batch.commit();
      setIsFirebaseConnected(true);
      return true;
    } catch (e) {
      console.error('Cloud Sync encountered constraint:', e);
      setIsFirebaseConnected(false);
      return false;
    }
  };

  // Clear or mark read notifications
  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => 
      prev.map((n) => n.id === id ? { ...n, read: true } : n)
    );
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        login,
        logout,
        isFirebaseConnected,

        products,
        customers,
        suppliers,
        sales,
        purchases,
        transactions,
        settings,
        notifications,

        addProduct,
        editProduct,
        deleteProduct,
        addSale,
        addPurchase,
        adjustStock,

        addCustomer,
        editCustomer,
        deleteCustomer,
        addSupplier,
        editSupplier,
        deleteSupplier,

        updateSettings,

        syncWithCloud,
        restoreFromBackup,
        exportDatabaseJson,
        clearAllNotifications,
        markNotificationRead,

        toast,
        triggerToast,

        activeTab,
        setActiveTab,
        isDarkMode,
        setIsDarkMode: toggleDarkMode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppProvider');
  }
  return context;
};
