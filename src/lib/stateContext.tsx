/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Product, Customer, Supplier, Sale, Purchase, 
  InventoryTransaction, StoreSettings, POSNotification, UserRole, SaaSStore, SaaSPlan,
  Staff, StaffPermissions, AppUser, OnlineStoreConfig
} from '../types';
import { 
  INITIAL_PRODUCTS, INITIAL_CUSTOMERS, INITIAL_SUPPLIERS, 
  INITIAL_SETTINGS, INITIAL_SALES, INITIAL_PURCHASES, INITIAL_TRANSACTIONS 
} from './demoData';
import { db, auth, authPersistenceReady, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, deleteDoc, collection, onSnapshot, writeBatch, getDoc, runTransaction } from 'firebase/firestore';
import { getSerializedUnits, productUsesImeiTracking } from './serializedInventory';

const DEFAULT_SAAS_STORES: SaaSStore[] = [
  { id: 'primary-store', name: 'Primary Store', branchCode: 'MAIN', city: 'Primary location', status: 'Active' }
];

const DEFAULT_SAAS_PLANS: SaaSPlan[] = [
  {
    name: 'Basic',
    priceYearly: 6000,
    maxProducts: 1000,
    maxMonthlySales: 5000,
    multiBranch: true,
    cloudBackup: true,
    customBranding: true,
    features: ['5-Day Free Trial', 'Multi-Branch Support', 'Firebase Real-Time DB', 'Inventory Audit Logs', 'Staff Permission Controls', 'Custom Tax & Loyalty Engine']
  }
];

const DEFAULT_STAFF_PERMISSIONS: StaffPermissions = {
  canBill: true,
  canPurchase: true,
  canManageProducts: true,
  canManageCustomers: true,
  canViewDashboard: false,
  canViewFinancials: false,
  canManageOnlineStore: false,
  canViewOnlineOrders: false,
  canManageOnlineOrders: false,
  canManageTableQr: false
};

const TRIAL_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

// This account is limited to an isolated workspace with safe sample data for Google Play review.
const PLAY_REVIEW_EMAIL = 'play-review@qpos.neospec.co.in';
const PLAY_REVIEW_PASSCODE_HASH = 'b74d1c11fe0ace8315148fbe594f70d141046d7e60d73afb34463ebc455fe72a';
const PLAY_REVIEW_SEED_VERSION = '1';

const omitUndefinedFields = <T,>(value: T): T => {
  if (Array.isArray(value)) {
    return value.filter(item => item !== undefined).map(item => omitUndefinedFields(item)) as T;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, fieldValue]) => fieldValue !== undefined)
        .map(([key, fieldValue]) => [key, omitUndefinedFields(fieldValue)])
    ) as T;
  }
  return value;
};

const migrateLegacyQposBranding = (settings: StoreSettings): StoreSettings => ({
  ...settings,
  storeName: settings.storeName.replace(/\bquick\s*pos\b/gi, 'QPOS'),
  receiptHeader: settings.receiptHeader.replace(/\bquick\s*pos\b/gi, 'QPOS'),
  receiptFooter: settings.receiptFooter.replace(/\bquick\s*pos\b/gi, 'QPOS')
});

interface AppContextType {
  // Auth Session State
  currentUser: AppUser | null;
  login: (email: string, role: UserRole, name?: string, passcode?: string) => Promise<boolean>;
  logout: () => void;
  isFirebaseConnected: boolean;

  // SaaS Workspace & Tier Context
  activeStore: SaaSStore;
  saasStores: SaaSStore[];
  saasPlans: SaaSPlan[];
  switchStoreBranch: (storeId: string) => void;
  addStoreBranch: (store: Pick<SaaSStore, 'name' | 'branchCode' | 'city'>) => void;
  completeStoreBranchSetup: (configuration: NonNullable<SaaSStore['configuration']> & {storeName: string}) => void;
  upgradeSaaSPlan: (planName: 'Free' | 'Basic' | 'Pro' | 'Enterprise') => void;

  // Business Data Store
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  sales: Sale[];
  purchases: Purchase[];
  transactions: InventoryTransaction[];
  settings: StoreSettings;
  notifications: POSNotification[];
  staff: Staff[];

  // Mutators / Actions
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Product;
  editProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addSale: (sale: Omit<Sale, 'id' | 'date'>) => Sale;
  editSale: (id: string, sale: Partial<Sale>) => void;
  deleteSale: (id: string) => void;
  addPurchase: (purchase: Omit<Purchase, 'id' | 'date'>) => void;
  adjustStock: (productId: string, quantity: number, type: 'Stock In' | 'Stock Out' | 'Adjustment', description: string) => void;
  
  // Contacts
  addCustomer: (customer: Omit<Customer, 'id' | 'totalSpent' | 'outstandingDue' | 'createdAt'> & {outstandingDue?: number}) => Customer;
  editCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addSupplier: (supplier: Omit<Supplier, 'id' | 'outstandingBalance' | 'createdAt'>) => Supplier;
  editSupplier: (id: string, supplier: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;
  addStaff: (staff: Omit<Staff, 'id' | 'tenantId' | 'role' | 'passcodeHash' | 'createdAt'>, passcode: string) => Promise<boolean>;
  updateStaff: (id: string, staff: Partial<Pick<Staff, 'name' | 'permissions' | 'active'>>, passcode?: string) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  hasPermission: (permission: keyof StaffPermissions) => boolean;

  // Settings
  updateSettings: (settings: StoreSettings) => void;
  updateOnlineStore: (configuration: OnlineStoreConfig) => Promise<boolean>;
  deleteAllMockupData: () => Promise<void>;

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

  // SaaS Workspace & Store Branch State
  const [saasStores, setSaaSStores] = useState<SaaSStore[]>(DEFAULT_SAAS_STORES);
  const [activeStore, setActiveStore] = useState<SaaSStore>(DEFAULT_SAAS_STORES[0]);

  // Authenticated State (Role-based)
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

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
  const [staff, setStaff] = useState<Staff[]>([]);

  const getDeviceStoreKey = (user: AppUser | null) => {
    const accountScope = user?.email
      ? user.email.toLowerCase().trim().replace(/[^a-zA-Z0-9]/g, '_')
      : 'anonymous';
    return `qpos_device_active_store_${accountScope}`;
  };

  useEffect(() => {
    const tenantId = settings.tenantId || getUserScope(currentUser);
    const primaryStore: SaaSStore = {
      id: tenantId,
      name: settings.storeName || 'Primary Store',
      branchCode: settings.storeBranch || 'MAIN',
      city: settings.address || 'Primary location',
      status: 'Active'
    };
    const branches = settings.storeBranches?.length
      ? settings.storeBranches
      : [primaryStore];
    const assignedStore = currentUser?.role === UserRole.STAFF && currentUser.workspaceScope
      ? branches.find(store => {
          const storeScope = store.id === tenantId || store.id === 'primary-store'
            ? tenantId
            : `${tenantId}__store__${store.id.toLowerCase().trim().replace(/[^a-zA-Z0-9_-]/g, '_')}`;
          return storeScope === currentUser.workspaceScope;
        })
      : undefined;
    const deviceStoreId = localStorage.getItem(getDeviceStoreKey(currentUser));
    const selected = assignedStore
      || branches.find(store => store.id === deviceStoreId)
      || branches.find(store => store.id === activeStore.id)
      || branches[0];
    setSaaSStores(branches);
    setActiveStore(selected);
  }, [
    currentUser,
    settings.address,
    settings.storeBranch,
    settings.storeBranches,
    settings.storeName,
    settings.tenantId
  ]);

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

  // User Tenant Data Scope Resolver
  const getUserScope = (user: AppUser | null): string => {
    if (!user || !user.email) return 'default_store';
    if (user.tenantId) return user.tenantId;
    return user.email.toLowerCase().trim().replace(/[^a-zA-Z0-9]/g, '_');
  };

  // The primary workspace keeps the legacy tenant path so existing data is
  // preserved. Every additional store receives its own isolated data scope.
  const getWorkspaceScope = (): string => {
    if (currentUser?.workspaceScope) return currentUser.workspaceScope;
    const ownerScope = getUserScope(currentUser);
    const primaryStoreId = settings.tenantId || ownerScope;
    const storeId = activeStore?.id;
    if (!storeId || storeId === 'primary-store' || storeId === primaryStoreId || storeId === ownerScope) {
      return ownerScope;
    }
    const safeStoreId = storeId.toLowerCase().trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${ownerScope}__store__${safeStoreId}`;
  };

  const getStoreWorkspaceScope = (storeId: string): string => {
    const ownerScope = getUserScope(currentUser);
    const primaryStoreId = settings.tenantId || ownerScope;
    if (!storeId || storeId === 'primary-store' || storeId === primaryStoreId || storeId === ownerScope) {
      return ownerScope;
    }
    const safeStoreId = storeId.toLowerCase().trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${ownerScope}__store__${safeStoreId}`;
  };

  const initialiseEmptyStoreCache = (storeId: string) => {
    const scope = getStoreWorkspaceScope(storeId);
    ['products', 'customers', 'suppliers', 'sales', 'purchases', 'transactions', 'staff'].forEach(key => {
      localStorage.setItem(`pos_${scope}_${key}`, JSON.stringify([]));
    });
  };

  // 1. User Tenant Data Scope Hydration & Live Firestore Snapshot Listeners
  useEffect(() => {
    const ownerScope = getUserScope(currentUser);
    const scope = getWorkspaceScope();
    const scopeKey = (key: string) => `pos_${scope}_${key}`;
    const ownerScopeKey = (key: string) => `pos_${ownerScope}_${key}`;

    // Initialize darkmode
    const savedTheme = localStorage.getItem('pos_dark_mode');
    if (savedTheme === 'true') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    // Load local storage data for current scope
    const localProducts = localStorage.getItem(scopeKey('products'));
    const localCustomers = localStorage.getItem(scopeKey('customers'));
    const localSuppliers = localStorage.getItem(scopeKey('suppliers'));
    const localSales = localStorage.getItem(scopeKey('sales'));
    const localPurchases = localStorage.getItem(scopeKey('purchases'));
    const localTransactions = localStorage.getItem(scopeKey('transactions'));
    const localSettings = localStorage.getItem(ownerScopeKey('settings'));
    const localStaff = localStorage.getItem(scopeKey('staff'));
    const isPlayReviewWorkspace = currentUser?.email?.toLowerCase() === PLAY_REVIEW_EMAIL;
    const reviewSeedKey = ownerScopeKey('play_review_seed_version');
    const shouldSeedPlayReview = isPlayReviewWorkspace
      && localStorage.getItem(reviewSeedKey) !== PLAY_REVIEW_SEED_VERSION;
    const hydrateCollection = <T,>(key: string, cached: string | null, sample: T[]) => {
      const value = shouldSeedPlayReview
        ? structuredClone(sample)
        : cached
          ? JSON.parse(cached) as T[]
          : [];
      localStorage.setItem(scopeKey(key), JSON.stringify(value));
      return value;
    };

    setProducts(hydrateCollection('products', localProducts, INITIAL_PRODUCTS));
    setCustomers(hydrateCollection('customers', localCustomers, INITIAL_CUSTOMERS));
    setSuppliers(hydrateCollection('suppliers', localSuppliers, INITIAL_SUPPLIERS));
    setSales(hydrateCollection('sales', localSales, INITIAL_SALES));
    setPurchases(hydrateCollection('purchases', localPurchases, INITIAL_PURCHASES));
    setTransactions(hydrateCollection('transactions', localTransactions, INITIAL_TRANSACTIONS));
    if (shouldSeedPlayReview) localStorage.setItem(reviewSeedKey, PLAY_REVIEW_SEED_VERSION);

    if (localSettings) {
      const parsed = migrateLegacyQposBranding(JSON.parse(localSettings) as StoreSettings);
      if (shouldSeedPlayReview) {
        parsed.storeName = 'QPOS Demo Store';
        parsed.email = PLAY_REVIEW_EMAIL;
        parsed.businessType = 'Retail';
        parsed.onboardingCompleted = true;
        parsed.subscriptionStatus = 'active';
        parsed.planTier = 'Basic';
      }
      parsed.tenantId = parsed.tenantId || ownerScope;
      parsed.onboardingCompleted = parsed.onboardingCompleted ?? false;
      if (!parsed.trialStartedAt && parsed.subscriptionStatus !== 'active') {
        const trialStartedAt = new Date();
        parsed.trialStartedAt = trialStartedAt.toISOString();
        parsed.trialEndsAt = new Date(trialStartedAt.getTime() + TRIAL_DURATION_MS).toISOString();
        parsed.subscriptionStatus = 'trialing';
        parsed.planTier = 'Basic';
        setDoc(doc(db, 'users', ownerScope, 'store_settings', 'active'), parsed, {merge: true})
          .catch(error => handleFirestoreError(error, OperationType.UPDATE, `users/${ownerScope}/store_settings`));
      }
      if (parsed.currency === '$' || !parsed.currency) parsed.currency = '₹';
      setSettings(parsed);
      localStorage.setItem(ownerScopeKey('settings'), JSON.stringify(parsed));
    } else {
      const trialStartedAt = new Date();
      const userCustomSettings: StoreSettings = {
        ...INITIAL_SETTINGS,
        tenantId: ownerScope,
        planTier: 'Basic',
        subscriptionStatus: 'trialing',
        trialStartedAt: trialStartedAt.toISOString(),
        trialEndsAt: new Date(trialStartedAt.getTime() + TRIAL_DURATION_MS).toISOString(),
        onboardingCompleted: isPlayReviewWorkspace,
        storeName: isPlayReviewWorkspace ? 'QPOS Demo Store' : currentUser?.name ? `${currentUser.name}'s QPOS` : INITIAL_SETTINGS.storeName,
        email: isPlayReviewWorkspace ? PLAY_REVIEW_EMAIL : currentUser?.email || INITIAL_SETTINGS.email,
        businessType: isPlayReviewWorkspace ? 'Retail' : INITIAL_SETTINGS.businessType,
        currency: '₹'
      };
      setSettings(userCustomSettings);
      localStorage.setItem(ownerScopeKey('settings'), JSON.stringify(userCustomSettings));
      getDoc(doc(db, 'users', ownerScope, 'store_settings', 'active'))
        .then(existing => {
          if (existing.exists()) {
            const remote = existing.data() as StoreSettings;
            const remoteSettings = migrateLegacyQposBranding({
              ...remote,
              tenantId: remote.tenantId || ownerScope,
              onboardingCompleted: remote.onboardingCompleted ?? false
            });
            setSettings(remoteSettings);
            localStorage.setItem(ownerScopeKey('settings'), JSON.stringify(remoteSettings));
            if (!remote.tenantId || remote.onboardingCompleted === undefined || remoteSettings.storeName !== remote.storeName) {
              setDoc(doc(db, 'users', ownerScope, 'store_settings', 'active'), remoteSettings, {merge: true});
            }
          } else {
            setDoc(doc(db, 'users', ownerScope, 'store_settings', 'active'), userCustomSettings);
          }
        })
        .catch(error => handleFirestoreError(error, OperationType.GET, `users/${ownerScope}/store_settings`));
    }

    if (localStaff) {
      setStaff(JSON.parse(localStaff));
    } else {
      setStaff([]);
    }

    // Connect real-time Firestore listeners to user tenant subcollections
    const unsubProducts = onSnapshot(
      collection(db, 'users', scope, 'products'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: Product[] = snapshot.docs.map(doc => doc.data() as Product);
          setProducts(list);
          localStorage.setItem(scopeKey('products'), JSON.stringify(list));
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `users/${scope}/products`)
    );

    const unsubSales = onSnapshot(
      collection(db, 'users', scope, 'sales'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: Sale[] = snapshot.docs.map(doc => doc.data() as Sale);
          setSales(list);
          localStorage.setItem(scopeKey('sales'), JSON.stringify(list));
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `users/${scope}/sales`)
    );

    const unsubCustomers = onSnapshot(
      collection(db, 'users', scope, 'customers'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: Customer[] = snapshot.docs.map(doc => doc.data() as Customer);
          setCustomers(list);
          localStorage.setItem(scopeKey('customers'), JSON.stringify(list));
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `users/${scope}/customers`)
    );

    const unsubSuppliers = onSnapshot(
      collection(db, 'users', scope, 'suppliers'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: Supplier[] = snapshot.docs.map(doc => doc.data() as Supplier);
          setSuppliers(list);
          localStorage.setItem(scopeKey('suppliers'), JSON.stringify(list));
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `users/${scope}/suppliers`)
    );

    const unsubPurchases = onSnapshot(
      collection(db, 'users', scope, 'purchases'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: Purchase[] = snapshot.docs.map(purchaseDoc => purchaseDoc.data() as Purchase);
          setPurchases(list);
          localStorage.setItem(scopeKey('purchases'), JSON.stringify(list));
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `users/${scope}/purchases`)
    );

    const unsubTransactions = onSnapshot(
      collection(db, 'users', scope, 'inventory_transactions'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: InventoryTransaction[] = snapshot.docs.map(transactionDoc => transactionDoc.data() as InventoryTransaction);
          setTransactions(list);
          localStorage.setItem(scopeKey('transactions'), JSON.stringify(list));
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `users/${scope}/inventory_transactions`)
    );

    const unsubSettings = onSnapshot(
      collection(db, 'users', ownerScope, 'store_settings'),
      (snapshot) => {
        if (!snapshot.empty) {
          const sDoc = snapshot.docs.find(d => d.id === 'active');
          if (sDoc) {
            const remote = sDoc.data() as StoreSettings;
            const data = migrateLegacyQposBranding({
              ...remote,
              tenantId: remote.tenantId || ownerScope,
              onboardingCompleted: remote.onboardingCompleted ?? false
            });
            setSettings(data);
            localStorage.setItem(ownerScopeKey('settings'), JSON.stringify(data));
            if (!remote.tenantId || remote.onboardingCompleted === undefined || data.storeName !== remote.storeName) {
              setDoc(doc(db, 'users', ownerScope, 'store_settings', 'active'), data, {merge: true});
            }
          }
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `users/${ownerScope}/store_settings`)
    );

    const unsubStaff = onSnapshot(
      collection(db, 'users', scope, 'staff'),
      (snapshot) => {
        const list: Staff[] = snapshot.docs.map(staffDoc => staffDoc.data() as Staff);
        setStaff(list);
        localStorage.setItem(scopeKey('staff'), JSON.stringify(list));
      },
      (error) => handleFirestoreError(error, OperationType.GET, `users/${scope}/staff`)
    );

    return () => {
      unsubProducts();
      unsubSales();
      unsubCustomers();
      unsubSuppliers();
      unsubPurchases();
      unsubTransactions();
      unsubSettings();
      unsubStaff();
    };
  }, [currentUser, activeStore.id]);

  // Firebase Auth state listener
  useEffect(() => {
    let unsubAuth = () => {};
    let disposed = false;

    const initialiseAuth = async () => {
      await authPersistenceReady.catch(() => undefined);
      if (disposed) return;

      try {
        const storedSession = JSON.parse(localStorage.getItem('pos_active_user') || 'null') as AppUser | null;
        if (storedSession?.email && storedSession?.tenantId && storedSession?.role) {
          setCurrentUser(storedSession);
        }
      } catch {
        localStorage.removeItem('pos_active_user');
      }

      unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
        if (!firebaseUser) return;
        setIsFirebaseConnected(true);
        const firebaseEmail = firebaseUser.email?.toLowerCase() || 'operator@shop.com';
        let directoryStaff: Staff | undefined;
        try {
          directoryStaff = JSON.parse(localStorage.getItem('pos_staff_directory') || '{}')[firebaseEmail];
        } catch {
          directoryStaff = undefined;
        }
        const session: AppUser = {
          id: firebaseUser.uid,
          name: directoryStaff?.name || firebaseUser.displayName || firebaseEmail.split('@')[0] || 'Store Operator',
          email: firebaseEmail,
          role: directoryStaff ? UserRole.STAFF : UserRole.ADMIN,
          tenantId: directoryStaff?.tenantId || firebaseEmail.replace(/[^a-zA-Z0-9]/g, '_'),
          workspaceScope: directoryStaff?.workspaceScope,
          permissions: directoryStaff?.permissions
        };
        setCurrentUser(session);
        localStorage.setItem('pos_active_user', JSON.stringify(session));
      });
    };

    void initialiseAuth();
    return () => {
      disposed = true;
      unsubAuth();
    };
  }, []);

  // Sync state mutations helper
  const saveLocalAndState = <T,>(keyName: string, data: T, setter: React.Dispatch<React.SetStateAction<T>>) => {
    setter(data);
    const scope = keyName === 'settings' ? getUserScope(currentUser) : getWorkspaceScope();
    localStorage.setItem(`pos_${scope}_${keyName}`, JSON.stringify(data));
  };

  // 2. Automated Smart Notification Engine based on Live Catalog
  useEffect(() => {
    if (products.length === 0) return;

    const list: POSNotification[] = [];
    const today = new Date();
    const tenDaysFromNow = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000);

    products.forEach((prod) => {
      if (prod.itemType === 'Service') return;
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

  const normalizeEmail = (email: string) => email.toLowerCase().trim();
  const directoryIdForEmail = (email: string) => normalizeEmail(email).replace(/[^a-zA-Z0-9]/g, '_');
  const hashPasscode = async (passcode: string) => {
    const bytes = new TextEncoder().encode(passcode);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
  };

  const readLocalStaffDirectory = (): Record<string, Staff> => {
    try {
      return JSON.parse(localStorage.getItem('pos_staff_directory') || '{}');
    } catch {
      return {};
    }
  };

  const writeLocalStaffDirectory = (directory: Record<string, Staff>) => {
    localStorage.setItem('pos_staff_directory', JSON.stringify(directory));
  };

  // 3. Authentications System
  const login = async (email: string, role: UserRole, name?: string, passcode?: string): Promise<boolean> => {
    const formattedEmail = normalizeEmail(email);
    let staffAccount = readLocalStaffDirectory()[formattedEmail];

    if (!staffAccount) {
      try {
        const directoryDoc = await getDoc(doc(db, 'staff_directory', directoryIdForEmail(formattedEmail)));
        if (directoryDoc.exists()) {
          staffAccount = directoryDoc.data() as Staff;
          writeLocalStaffDirectory({
            ...readLocalStaffDirectory(),
            [formattedEmail]: staffAccount
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `staff_directory/${directoryIdForEmail(formattedEmail)}`);
      }
    }

    if (staffAccount) {
      if (!staffAccount.active) {
        triggerToast('This staff account has been disabled by the owner.', 'error');
        return false;
      }
      const authenticatedWithGoogle = auth.currentUser?.email?.toLowerCase() === formattedEmail;
      if (!authenticatedWithGoogle && (!passcode || await hashPasscode(passcode) !== staffAccount.passcodeHash)) {
        triggerToast('Invalid staff email or passcode.', 'error');
        return false;
      }
      const staffSession: AppUser = {
        id: staffAccount.id,
        email: staffAccount.email,
        name: staffAccount.name,
        role: UserRole.STAFF,
        tenantId: staffAccount.tenantId,
        workspaceScope: staffAccount.workspaceScope,
        permissions: staffAccount.permissions
      };
      saveLocalAndState('active_user', staffSession, setCurrentUser);
      setActiveTab(staffAccount.permissions.canBill ? 'pos' : staffAccount.permissions.canPurchase ? 'inventory' : 'products');
      triggerToast(`Authenticated as ${staffAccount.name}`, 'success');
      return true;
    }

    if (formattedEmail === PLAY_REVIEW_EMAIL) {
      if (!passcode || await hashPasscode(passcode) !== PLAY_REVIEW_PASSCODE_HASH) {
        triggerToast('Invalid review access credentials.', 'error');
        return false;
      }
      const reviewSession: AppUser = {
        id: 'qpos-play-reviewer',
        email: PLAY_REVIEW_EMAIL,
        name: 'Google Play Reviewer',
        role: UserRole.STAFF,
        tenantId: 'qpos_play_review',
        workspaceScope: 'qpos_play_review',
        permissions: {
          ...DEFAULT_STAFF_PERMISSIONS,
          canViewDashboard: true,
          canViewFinancials: true,
          canManageOnlineStore: true,
          canViewOnlineOrders: true,
          canManageOnlineOrders: true,
          canManageTableQr: true
        }
      };
      saveLocalAndState('active_user', reviewSession, setCurrentUser);
      setActiveTab('pos');
      triggerToast('Authenticated in the QPOS demonstration workspace.', 'success');
      return true;
    }

    if (role === UserRole.STAFF && formattedEmail !== 'staff@shop.com') {
      triggerToast('No active staff account exists for this email.', 'error');
      return false;
    }

    const cleanName = name || (role === UserRole.ADMIN ? 'Administrator' : 'Billing Staff');
    const userSession: AppUser = {
      id: `usr_${formattedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
      email: formattedEmail,
      name: cleanName,
      role,
      tenantId: formattedEmail.replace(/[^a-zA-Z0-9]/g, '_'),
      ...(role === UserRole.STAFF ? {permissions: DEFAULT_STAFF_PERMISSIONS} : {})
    };
    saveLocalAndState('active_user', userSession, setCurrentUser);
    triggerToast(`Authenticated as ${cleanName} (${formattedEmail})`, "success");
    return true;
  };

  const hasPermission = (permission: keyof StaffPermissions) =>
    currentUser?.role === UserRole.ADMIN ||
    Boolean((currentUser?.permissions || DEFAULT_STAFF_PERMISSIONS)[permission]);

  const addStaff = async (
    staffInput: Omit<Staff, 'id' | 'tenantId' | 'role' | 'passcodeHash' | 'createdAt'>,
    passcode: string
  ): Promise<boolean> => {
    if (currentUser?.role !== UserRole.ADMIN) return false;
    const email = normalizeEmail(staffInput.email);
    if (staff.some(member => member.email === email)) {
      triggerToast('A staff account with this email already exists.', 'error');
      return false;
    }
    const scope = getWorkspaceScope();
    const ownerScope = getUserScope(currentUser);
    const newStaff: Staff = {
      ...staffInput,
      id: `staff-${Date.now()}`,
      email,
      role: UserRole.STAFF,
      tenantId: ownerScope,
      workspaceScope: scope,
      passcodeHash: await hashPasscode(passcode),
      createdAt: new Date().toISOString()
    };
    const updated = [newStaff, ...staff];
    setStaff(updated);
    localStorage.setItem(`pos_${scope}_staff`, JSON.stringify(updated));
    writeLocalStaffDirectory({...readLocalStaffDirectory(), [email]: newStaff});
    await Promise.all([
      setDoc(doc(db, 'users', scope, 'staff', newStaff.id), newStaff),
      setDoc(doc(db, 'staff_directory', directoryIdForEmail(email)), newStaff)
    ]);
    triggerToast(`${newStaff.name} can now sign in as staff.`, 'success');
    return true;
  };

  const updateStaff = async (
    id: string,
    changes: Partial<Pick<Staff, 'name' | 'permissions' | 'active'>>,
    passcode?: string
  ) => {
    if (currentUser?.role !== UserRole.ADMIN) return;
    const scope = getWorkspaceScope();
    const existing = staff.find(member => member.id === id);
    if (!existing) return;
    const updatedMember: Staff = {
      ...existing,
      ...changes,
      ...(passcode ? {passcodeHash: await hashPasscode(passcode)} : {})
    };
    const updated = staff.map(member => member.id === id ? updatedMember : member);
    setStaff(updated);
    localStorage.setItem(`pos_${scope}_staff`, JSON.stringify(updated));
    writeLocalStaffDirectory({...readLocalStaffDirectory(), [updatedMember.email]: updatedMember});
    await Promise.all([
      setDoc(doc(db, 'users', scope, 'staff', id), updatedMember),
      setDoc(doc(db, 'staff_directory', directoryIdForEmail(updatedMember.email)), updatedMember)
    ]);
    triggerToast('Staff permissions updated.', 'success');
  };

  const deleteStaff = async (id: string) => {
    if (currentUser?.role !== UserRole.ADMIN) return;
    const scope = getWorkspaceScope();
    const existing = staff.find(member => member.id === id);
    if (!existing) return;
    const updated = staff.filter(member => member.id !== id);
    setStaff(updated);
    localStorage.setItem(`pos_${scope}_staff`, JSON.stringify(updated));
    const directory = readLocalStaffDirectory();
    delete directory[existing.email];
    writeLocalStaffDirectory(directory);
    await Promise.all([
      deleteDoc(doc(db, 'users', scope, 'staff', id)),
      deleteDoc(doc(db, 'staff_directory', directoryIdForEmail(existing.email)))
    ]);
    triggerToast('Staff access removed.', 'success');
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("Firebase signout error:", e);
    }
    setCurrentUser(null);
    localStorage.removeItem('pos_active_user');
    setActiveTab('dashboard');
  };

  // 4. Product mutators with direct Firestore Cloud persistence
  const addProduct = (p: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Product => {
    const scope = getWorkspaceScope();
    const newProd = omitUndefinedFields({
      ...p,
      id: `prod-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }) as Product;

    setProducts((prev) => {
      const updated = [newProd, ...prev];
      localStorage.setItem(`pos_${scope}_products`, JSON.stringify(updated));
      return updated;
    });

    // Direct Firestore write scoped by user tenant
    setDoc(doc(db, 'users', scope, 'products', newProd.id), newProd).catch(e => handleFirestoreError(e, OperationType.CREATE, `users/${scope}/products`));

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

    return newProd;
  };

  const editProduct = (id: string, p: Partial<Product>) => {
    const scope = getWorkspaceScope();
    setProducts((prev) => {
      const updated = prev.map((prod) => {
        if (prod.id === id) {
          const merged = omitUndefinedFields({
            ...prod,
            ...p,
            updatedAt: new Date().toISOString()
          }) as Product;
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
          setDoc(doc(db, 'users', scope, 'products', id), merged).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${scope}/products`));
          return merged;
        }
        return prod;
      });
      localStorage.setItem(`pos_${scope}_products`, JSON.stringify(updated));
      return updated;
    });
  };

  const deleteProduct = (id: string) => {
    const scope = getWorkspaceScope();
    setProducts((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      localStorage.setItem(`pos_${scope}_products`, JSON.stringify(updated));
      deleteDoc(doc(db, 'users', scope, 'products', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${scope}/products`));
      return updated;
    });
  };

  // 5. Transaction log helpers
  const addTransaction = (
    productId: string,
    prodName: string,
    sku: string,
    type: 'Stock In' | 'Stock Out' | 'Sale' | 'Purchase Entry' | 'Adjustment' | 'In-House Production',
    quantity: number,
    prev: number,
    next: number,
    desc: string
  ) => {
    const scope = getWorkspaceScope();
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
      localStorage.setItem(`pos_${scope}_transactions`, JSON.stringify(newList));
      return newList;
    });

    setDoc(doc(db, 'users', scope, 'inventory_transactions', newTx.id), newTx).catch(e => handleFirestoreError(e, OperationType.CREATE, `users/${scope}/inventory_transactions`));
  };

  // 6. POS Sales Billing Compiler
  const addSale = (s: Omit<Sale, 'id' | 'date'>): Sale => {
    const scope = getWorkspaceScope();
    const saleId = `sale-${Math.floor(100000 + Math.random() * 900000)}`;
    const newSale = omitUndefinedFields<Sale>({
      ...s,
      id: saleId,
      date: new Date().toISOString()
    });

    // Update real-time product stock counts atomically and write audit logs
    setProducts((prevProducts) => {
      const updatedProducts = prevProducts.map((prod) => {
        const soldItems = s.items.filter((item) => item.productId === prod.id);
        if (soldItems.length > 0) {
          if (prod.itemType === 'Service') return prod;
          const totalSoldQty = soldItems.reduce((acc, item) => acc + item.quantity, 0);
          const soldUnitIds = new Set(
            soldItems.flatMap(item => item.serializedUnits?.map(unit => unit.unitId) || [])
          );
          const serializedUnits = productUsesImeiTracking(prod)
            ? getSerializedUnits(prod).map(unit => soldUnitIds.has(unit.id) ? {
                ...unit,
                status: 'Sold' as const,
                soldAt: newSale.date,
                saleId
              } : unit)
            : prod.serializedUnits;
          const nextStock = productUsesImeiTracking(prod)
            ? (serializedUnits || []).filter(unit => unit.status === 'In Stock' || unit.status === 'Returned').length
            : Math.max(0, prod.stock - totalSoldQty);
          
          addTransaction(
            prod.id,
            prod.name,
            prod.sku,
            'Sale',
            totalSoldQty,
            prod.stock,
            nextStock,
            `POS Bill #${saleId} client sale.`
          );
          
          const updatedP = {
            ...prod,
            stock: nextStock,
            ...(serializedUnits ? {
              serializedUnits,
              imeiNumbers: serializedUnits
                .filter(unit => unit.status !== 'Sold')
                .flatMap(unit => [unit.imei1, unit.imei2].filter(Boolean) as string[])
            } : {}),
            updatedAt: new Date().toISOString()
          };
          
          setDoc(doc(db, 'users', scope, 'products', prod.id), updatedP)
            .catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${scope}/products`));
            
          return updatedP;
        }
        return prod;
      });

      localStorage.setItem(`pos_${scope}_products`, JSON.stringify(updatedProducts));
      return updatedProducts;
    });

    // Record sales history
    setSales((prevSales) => {
      const updatedSales = [newSale, ...prevSales];
      localStorage.setItem(`pos_${scope}_sales`, JSON.stringify(updatedSales));
      setDoc(doc(db, 'users', scope, 'sales', newSale.id), newSale)
        .catch(e => handleFirestoreError(e, OperationType.CREATE, `users/${scope}/sales`));
      return updatedSales;
    });

    // Update customer records (Loyalty points & spent totals)
    if (s.customerId) {
      setCustomers((prevCustomers) => {
        const updatedCustomers = prevCustomers.map((c) => {
          if (c.id === s.customerId) {
            const addPoints = s.loyaltyPointsEarned || Math.floor(s.total * settings.loyaltyPointsPerDollar);
            const updatedC = {
              ...c,
              loyaltyPoints: c.loyaltyPoints + addPoints,
              totalSpent: c.totalSpent + s.total,
              outstandingDue: s.paymentMethod === 'Split' && s.paymentDetails?.referenceNo?.includes('Credit')
                ? c.outstandingDue + (s.total - (s.paymentDetails.cashAmount || 0) - (s.paymentDetails.cardAmount || 0))
                : c.outstandingDue
            };
            setDoc(doc(db, 'users', scope, 'customers', c.id), updatedC)
              .catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${scope}/customers`));
            return updatedC;
          }
          return c;
        });
        localStorage.setItem(`pos_${scope}_customers`, JSON.stringify(updatedCustomers));
        return updatedCustomers;
      });
    }

    return newSale;
  };

  const editSale = (id: string, changes: Partial<Sale>) => {
    const scope = getWorkspaceScope();
    const originalSale = sales.find(sale => sale.id === id);
    let changedSale: Sale | null = null;
    const updatedSales = sales.map((sale) => {
      if (sale.id !== id) return sale;
      changedSale = omitUndefinedFields({...sale, ...changes}) as Sale;
      return changedSale;
    });
    if (!changedSale) return;
    saveLocalAndState('sales', updatedSales, setSales);
    setDoc(doc(db, 'users', scope, 'sales', id), changedSale)
      .catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${scope}/sales`));
    if (changes.items && originalSale) {
      setProducts((currentProducts) => {
        const adjustedProducts = currentProducts.map((product) => {
          if (product.itemType === 'Service') return product;
          const oldLines = originalSale.items.filter(item => item.productId === product.id);
          const newLines = changedSale!.items.filter(item => item.productId === product.id);
          const oldQuantity = oldLines.reduce((sum, item) => sum + item.quantity, 0);
          const newQuantity = newLines.reduce((sum, item) => sum + item.quantity, 0);
          if (oldQuantity === newQuantity) return product;

          let serializedUnits = product.serializedUnits;
          let nextStock = product.stock + oldQuantity - newQuantity;
          if (productUsesImeiTracking(product)) {
            const retainedSoldIds = new Set(
              newLines.flatMap(item => item.serializedUnits?.map(unit => unit.unitId) || [])
            );
            const originallySoldIds = new Set(
              oldLines.flatMap(item => item.serializedUnits?.map(unit => unit.unitId) || [])
            );
            serializedUnits = getSerializedUnits(product).map(unit => {
              if (retainedSoldIds.has(unit.id)) {
                return {...unit, status: 'Sold' as const, saleId: id, soldAt: changedSale!.date};
              }
              if (originallySoldIds.has(unit.id) && unit.saleId === id) {
                const {saleId: _saleId, soldAt: _soldAt, ...availableUnit} = unit;
                return {...availableUnit, status: 'Returned' as const};
              }
              return unit;
            });
            nextStock = serializedUnits.filter(unit => unit.status === 'In Stock' || unit.status === 'Returned').length;
          }

          const adjustedProduct = omitUndefinedFields({
            ...product,
            stock: Math.max(0, nextStock),
            serializedUnits,
            ...(serializedUnits ? {
              imeiNumbers: serializedUnits
                .filter(unit => unit.status !== 'Sold')
                .flatMap(unit => [unit.imei1, unit.imei2].filter(Boolean) as string[])
            } : {}),
            updatedAt: new Date().toISOString()
          }) as Product;
          setDoc(doc(db, 'users', scope, 'products', product.id), adjustedProduct)
            .catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${scope}/products`));
          addTransaction(
            product.id,
            product.name,
            product.sku,
            'Adjustment',
            oldQuantity - newQuantity,
            product.stock,
            adjustedProduct.stock,
            `Invoice ${id} edited; stock reconciled.`
          );
          return adjustedProduct;
        });
        localStorage.setItem(`pos_${scope}_products`, JSON.stringify(adjustedProducts));
        return adjustedProducts;
      });
    }
    if (originalSale && (
      originalSale.customerId !== changedSale.customerId ||
      originalSale.total !== changedSale.total
    )) {
      const updatedCustomers = customers.map(customer => {
        let updatedCustomer = customer;
        if (originalSale.customerId && customer.id === originalSale.customerId) {
          updatedCustomer = {
            ...updatedCustomer,
            totalSpent: Math.max(0, updatedCustomer.totalSpent - originalSale.total),
            loyaltyPoints: originalSale.customerId === changedSale!.customerId
              ? updatedCustomer.loyaltyPoints
              : Math.max(0, updatedCustomer.loyaltyPoints - originalSale.loyaltyPointsEarned)
          };
        }
        if (changedSale!.customerId && customer.id === changedSale!.customerId) {
          updatedCustomer = {
            ...updatedCustomer,
            totalSpent: updatedCustomer.totalSpent + changedSale!.total,
            loyaltyPoints: originalSale.customerId === changedSale!.customerId
              ? updatedCustomer.loyaltyPoints
              : updatedCustomer.loyaltyPoints + changedSale!.loyaltyPointsEarned
          };
        }
        if (updatedCustomer === customer) return customer;
        setDoc(doc(db, 'users', scope, 'customers', customer.id), updatedCustomer)
          .catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${scope}/customers`));
        return updatedCustomer;
      });
      saveLocalAndState('customers', updatedCustomers, setCustomers);
    }
  };

  const deleteSale = (id: string) => {
    const scope = getWorkspaceScope();
    const sale = sales.find(entry => entry.id === id);
    if (!sale) return;

    setProducts((currentProducts) => {
      const restoredProducts = currentProducts.map((product) => {
        if (product.itemType === 'Service') return product;
        const soldLines = sale.items.filter(item => item.productId === product.id);
        if (!soldLines.length) return product;
        const quantityToRestore = soldLines.reduce((sum, item) => sum + item.quantity, 0);
        const serializedUnits = productUsesImeiTracking(product)
          ? getSerializedUnits(product).map(unit => {
              if (unit.saleId !== sale.id) return unit;
              const {soldAt: _soldAt, saleId: _saleId, ...availableUnit} = unit;
              return {...availableUnit, status: 'Returned' as const};
            })
          : product.serializedUnits;
        const restoredStock = productUsesImeiTracking(product)
          ? (serializedUnits || []).filter(unit => unit.status === 'In Stock' || unit.status === 'Returned').length
          : product.stock + quantityToRestore;
        const restoredProduct = omitUndefinedFields({
          ...product,
          stock: restoredStock,
          serializedUnits,
          ...(serializedUnits ? {
            imeiNumbers: serializedUnits
              .filter(unit => unit.status !== 'Sold')
              .flatMap(unit => [unit.imei1, unit.imei2].filter(Boolean) as string[])
          } : {}),
          updatedAt: new Date().toISOString()
        }) as Product;
        setDoc(doc(db, 'users', scope, 'products', product.id), restoredProduct)
          .catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${scope}/products`));
        addTransaction(
          product.id,
          product.name,
          product.sku,
          'Adjustment',
          quantityToRestore,
          product.stock,
          restoredStock,
          `Invoice ${sale.id} deleted; stock restored.`
        );
        return restoredProduct;
      });
      localStorage.setItem(`pos_${scope}_products`, JSON.stringify(restoredProducts));
      return restoredProducts;
    });

    const updatedSales = sales.filter(entry => entry.id !== id);
    saveLocalAndState('sales', updatedSales, setSales);
    deleteDoc(doc(db, 'users', scope, 'sales', id))
      .catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${scope}/sales`));
    if (sale.customerId) {
      const updatedCustomers = customers.map(customer => {
        if (customer.id !== sale.customerId) return customer;
        const updatedCustomer = {
          ...customer,
          totalSpent: Math.max(0, customer.totalSpent - sale.total),
          loyaltyPoints: Math.max(0, customer.loyaltyPoints - sale.loyaltyPointsEarned)
        };
        setDoc(doc(db, 'users', scope, 'customers', customer.id), updatedCustomer)
          .catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${scope}/customers`));
        return updatedCustomer;
      });
      saveLocalAndState('customers', updatedCustomers, setCustomers);
    }
  };

  // 7. Purchase entry restock catalog
  const addPurchase = (p: Omit<Purchase, 'id' | 'date'>) => {
    const scope = getWorkspaceScope();
    const purchaseId = `pur-${Math.floor(2000 + Math.random() * 8000)}`;
    const newPurchase: Purchase = {
      ...p,
      id: purchaseId,
      date: new Date().toISOString()
    };

    // Increase product inventory stock on arrivals atomically
    setProducts((prevProducts) => {
      const updatedProducts = prevProducts.map((prod) => {
        const purchasedItems = p.items.filter((item) => item.productId === prod.id);
        if (purchasedItems.length > 0) {
          const totalPurchasedQty = purchasedItems.reduce((acc, item) => acc + item.quantity, 0);
          const incomingSerializedUnits = purchasedItems.flatMap(item => item.serializedUnits || []);
          const serializedUnits = incomingSerializedUnits.length
            ? [...getSerializedUnits(prod), ...incomingSerializedUnits]
            : prod.serializedUnits;
          const nextStock = serializedUnits
            ? serializedUnits.filter(unit => unit.status === 'In Stock' || unit.status === 'Returned').length
            : prod.stock + totalPurchasedQty;
          
          addTransaction(
            prod.id,
            prod.name,
            prod.sku,
            p.entryType === 'In-House Production' ? 'In-House Production' : 'Purchase Entry',
            totalPurchasedQty,
            prod.stock,
            nextStock,
            p.entryType === 'In-House Production'
              ? `In-House Batch ${p.batchNo || purchaseId}: Produced ${totalPurchasedQty} ${prod.unit || 'units'}.`
              : `Purchase Invoice #${purchaseId} stocking.`
          );
          
          const lastPurchased = purchasedItems[purchasedItems.length - 1];
          const updatedP = {
            ...prod,
            stock: nextStock,
            ...(serializedUnits ? {
              trackInventoryByImei: true,
              serializedUnits,
              imeiNumbers: serializedUnits
                .filter(unit => unit.status !== 'Sold')
                .flatMap(unit => [unit.imei1, unit.imei2].filter(Boolean) as string[])
            } : {}),
            purchasePrice: lastPurchased.purchasePrice || prod.purchasePrice,
            updatedAt: new Date().toISOString()
          };
          
          setDoc(doc(db, 'users', scope, 'products', prod.id), updatedP)
            .catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${scope}/products`));
            
          return updatedP;
        }
        return prod;
      });

      localStorage.setItem(`pos_${scope}_products`, JSON.stringify(updatedProducts));
      return updatedProducts;
    });

    // Save purchases ledger
    setPurchases((prevPurchases) => {
      const updatedPurchases = [newPurchase, ...prevPurchases];
      localStorage.setItem(`pos_${scope}_purchases`, JSON.stringify(updatedPurchases));
      setDoc(doc(db, 'users', scope, 'purchases', newPurchase.id), newPurchase)
        .catch(e => handleFirestoreError(e, OperationType.CREATE, `users/${scope}/purchases`));
      return updatedPurchases;
    });

    // Increase outstanding balance inside Supplier fields
    if (p.supplierId && p.supplierId !== 'in_house_unit') {
      setSuppliers((prevSuppliers) => {
        const updatedSuppliers = prevSuppliers.map((s) => {
          if (s.id === p.supplierId) {
            const updatedS = {
              ...s,
              outstandingBalance: s.outstandingBalance + p.dueAmount
            };
            setDoc(doc(db, 'users', scope, 'suppliers', s.id), updatedS)
              .catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${scope}/suppliers`));
            return updatedS;
          }
          return s;
        });
        localStorage.setItem(`pos_${scope}_suppliers`, JSON.stringify(updatedSuppliers));
        return updatedSuppliers;
      });
    }
  };

  // Stock Adjuster helper
  const adjustStock = (productId: string, quantity: number, type: 'Stock In' | 'Stock Out' | 'Adjustment' | 'In-House Production', description: string) => {
    const scope = getWorkspaceScope();

    setProducts((prevProducts) => {
      const targetProduct = prevProducts.find((prod) => prod.id === productId);
      if (!targetProduct) return prevProducts;
      if (productUsesImeiTracking(targetProduct)) {
        return prevProducts;
      }

      let delta = quantity;
      if (type === 'Stock Out') {
        delta = -Math.abs(quantity);
      } else if (type === 'Adjustment') {
        delta = quantity - targetProduct.stock;
      }

      const nextStock = Math.max(0, targetProduct.stock + delta);
      
      const updatedProducts = prevProducts.map((prod) => {
        if (prod.id === productId) {
          const updatedP = {
            ...prod,
            stock: nextStock,
            updatedAt: new Date().toISOString()
          };
          setDoc(doc(db, 'users', scope, 'products', productId), updatedP)
            .catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${scope}/products`));
          return updatedP;
        }
        return prod;
      });

      localStorage.setItem(`pos_${scope}_products`, JSON.stringify(updatedProducts));

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

      return updatedProducts;
    });
  };

  // 8. Contact management list controllers
  const addCustomer = (c: Omit<Customer, 'id' | 'totalSpent' | 'outstandingDue' | 'createdAt'> & {outstandingDue?: number}): Customer => {
    const scope = getWorkspaceScope();
    const newCust = omitUndefinedFields({
      ...c,
      id: `cust-${Date.now()}`,
      totalSpent: 0,
      outstandingDue: c.outstandingDue || 0,
      createdAt: new Date().toISOString()
    }) as Customer;
    const updated = [newCust, ...customers];
    saveLocalAndState('customers', updated, setCustomers);

    setDoc(doc(db, 'users', scope, 'customers', newCust.id), newCust).catch(e => handleFirestoreError(e, OperationType.CREATE, `users/${scope}/customers`));
    return newCust;
  };

  const editCustomer = (id: string, c: Partial<Customer>) => {
    const scope = getWorkspaceScope();
    let updatedC: Customer | null = null;
    const updated = customers.map((cust) => {
      if (cust.id === id) {
        updatedC = omitUndefinedFields({ ...cust, ...c }) as Customer;
        return updatedC;
      }
      return cust;
    });
    saveLocalAndState('customers', updated, setCustomers);

    if (updatedC) {
      setDoc(doc(db, 'users', scope, 'customers', id), updatedC).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${scope}/customers`));
    }
  };

  const deleteCustomer = (id: string) => {
    const scope = getWorkspaceScope();
    const updated = customers.filter((cust) => cust.id !== id);
    saveLocalAndState('customers', updated, setCustomers);

    deleteDoc(doc(db, 'users', scope, 'customers', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${scope}/customers`));
  };

  const addSupplier = (s: Omit<Supplier, 'id' | 'outstandingBalance' | 'createdAt'>): Supplier => {
    const scope = getWorkspaceScope();
    const newSupp: Supplier = {
      ...s,
      id: `supp-${Date.now()}`,
      outstandingBalance: 0,
      createdAt: new Date().toISOString()
    };
    const updated = [newSupp, ...suppliers];
    saveLocalAndState('suppliers', updated, setSuppliers);

    setDoc(doc(db, 'users', scope, 'suppliers', newSupp.id), newSupp).catch(e => handleFirestoreError(e, OperationType.CREATE, `users/${scope}/suppliers`));
    return newSupp;
  };

  const editSupplier = (id: string, s: Partial<Supplier>) => {
    const scope = getWorkspaceScope();
    let updatedS: Supplier | null = null;
    const updated = suppliers.map((supp) => {
      if (supp.id === id) {
        updatedS = { ...supp, ...s };
        return updatedS;
      }
      return supp;
    });
    saveLocalAndState('suppliers', updated, setSuppliers);

    if (updatedS) {
      setDoc(doc(db, 'users', scope, 'suppliers', id), updatedS).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${scope}/suppliers`));
    }
  };

  const deleteSupplier = (id: string) => {
    const scope = getWorkspaceScope();
    const updated = suppliers.filter((supp) => supp.id !== id);
    saveLocalAndState('suppliers', updated, setSuppliers);

    deleteDoc(doc(db, 'users', scope, 'suppliers', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${scope}/suppliers`));
  };

  // Settings
  const updateSettings = (newSettings: StoreSettings) => {
    const scope = getUserScope(currentUser);
    const primaryStoreId = settings.tenantId || scope;
    const isPrimaryStore = !activeStore?.id || activeStore.id === 'primary-store' || activeStore.id === primaryStoreId || activeStore.id === scope;

    if (!isPrimaryStore) {
      const updatedStore: SaaSStore = {
        ...activeStore,
        name: newSettings.storeName.trim() || activeStore.name,
        city: newSettings.address.trim() || activeStore.city,
        configuration: {
          ...activeStore.configuration,
          ownerName: newSettings.ownerName,
          businessType: newSettings.businessType,
          phone: newSettings.phone,
          email: newSettings.email,
          address: newSettings.address,
          gstNumber: newSettings.gstNumber,
          website: newSettings.website,
          currency: newSettings.currency,
          receiptHeader: newSettings.receiptHeader,
          receiptFooter: newSettings.receiptFooter,
          invoiceSignature: newSettings.invoiceSignature,
          showBankDetailsOnInvoice: newSettings.showBankDetailsOnInvoice,
          bankAccountHolder: newSettings.bankAccountHolder,
          bankName: newSettings.bankName,
          bankAccountNumber: newSettings.bankAccountNumber,
          bankBranch: newSettings.bankBranch,
          bankIfsc: newSettings.bankIfsc,
          loyaltyPointsPerDollar: newSettings.loyaltyPointsPerDollar,
          upiId: newSettings.upiId,
          upiPayeeName: newSettings.upiPayeeName,
          whatsappInvoiceEnabled: newSettings.whatsappInvoiceEnabled,
          dashboardWidgets: newSettings.dashboardWidgets
        }
      };
      const storeBranches = saasStores.map(store => store.id === updatedStore.id ? updatedStore : store);
      const sharedSettings = {...settings, storeBranches};
      setSaaSStores(storeBranches);
      setActiveStore(updatedStore);
      saveLocalAndState('settings', sharedSettings, setSettings);
      setDoc(doc(db, 'users', scope, 'store_settings', 'active'), sharedSettings).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${scope}/store_settings`));
      return;
    }

    // The selected workspace is a device preference. Never sync it through
    // Firestore, otherwise a store switch on one terminal changes every
    // terminal logged into the same owner account.
    const { activeStoreId: _legacyActiveStoreId, ...sharedSettings } = newSettings;
    saveLocalAndState('settings', sharedSettings as StoreSettings, setSettings);
    setDoc(doc(db, 'users', scope, 'store_settings', 'active'), sharedSettings).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${scope}/store_settings`));
  };

  const updateOnlineStore = async (configuration: OnlineStoreConfig): Promise<boolean> => {
    const ownerScope = getUserScope(currentUser);
    const primaryStoreId = settings.tenantId || ownerScope;
    const isPrimaryLocation = !activeStore?.id || activeStore.id === 'primary-store' || activeStore.id === primaryStoreId || activeStore.id === ownerScope;
    const currentLocationConfig = isPrimaryLocation ? settings.onlineStore : activeStore.configuration?.onlineStore;
    const previousSlug = currentLocationConfig?.slug;
    const registryRef = doc(db, 'public_stores', configuration.slug);
    let nextActiveStore = activeStore;
    let sharedSettings: StoreSettings;
    if (isPrimaryLocation) {
      sharedSettings = {...settings, onlineStore: configuration};
    } else {
      nextActiveStore = {...activeStore, configuration: {...activeStore.configuration, onlineStore: configuration}};
      const storeBranches = saasStores.map(store => store.id === activeStore.id ? nextActiveStore : store);
      if (settings.onlineStore?.slug === configuration.slug) {
        const {onlineStore: _migratedOwnerStore, ...ownerSettings} = settings;
        sharedSettings = {...ownerSettings, storeBranches};
      } else {
        sharedSettings = {...settings, storeBranches};
      }
    }
    try {
      await runTransaction(db, async transaction => {
        const registrySnapshot = await transaction.get(registryRef);
        const registry = registrySnapshot.data();
        if (registrySnapshot.exists() && (
          registry?.ownerScope !== ownerScope ||
          (registry?.locationId && registry.locationId !== configuration.originLocationId)
        )) {
          throw new Error('SLUG_TAKEN');
        }
        transaction.set(doc(db, 'users', ownerScope, 'store_settings', 'active'), sharedSettings);
        transaction.set(registryRef, {ownerScope, locationId: configuration.originLocationId || activeStore.id, slug: configuration.slug, enabled: configuration.enabled, updatedAt: new Date().toISOString()});
        if (previousSlug && previousSlug !== configuration.slug) transaction.delete(doc(db, 'public_stores', previousSlug));
      });
      saveLocalAndState('settings', sharedSettings, setSettings);
      if (!isPrimaryLocation) {
        setActiveStore(nextActiveStore);
        setSaaSStores(sharedSettings.storeBranches || []);
      }
      return true;
    } catch (error) {
      if (error instanceof Error && error.message === 'SLUG_TAKEN') {
        triggerToast('That public store address is already in use.', 'error');
        return false;
      }
      handleFirestoreError(error, OperationType.UPDATE, `users/${ownerScope}/store_settings`);
      triggerToast('Online Store settings could not be published.', 'error');
      return false;
    }
  };

  const deleteAllMockupData = async () => {
    const scope = getWorkspaceScope();

    // Clear React states
    setProducts([]);
    setCustomers([]);
    setSuppliers([]);
    setSales([]);
    setPurchases([]);
    setTransactions([]);
    setNotifications([]);

    // Clear scoped localStorage
    localStorage.setItem(`pos_${scope}_products`, JSON.stringify([]));
    localStorage.setItem(`pos_${scope}_customers`, JSON.stringify([]));
    localStorage.setItem(`pos_${scope}_suppliers`, JSON.stringify([]));
    localStorage.setItem(`pos_${scope}_sales`, JSON.stringify([]));
    localStorage.setItem(`pos_${scope}_purchases`, JSON.stringify([]));
    localStorage.setItem(`pos_${scope}_transactions`, JSON.stringify([]));

    // Clear legacy keys
    ['pos_products', 'pos_customers', 'pos_suppliers', 'pos_sales', 'pos_purchases', 'pos_transactions', 'pos_settings', 'martpos_products', 'martpos_customers'].forEach(k => {
      localStorage.removeItem(k);
    });

    triggerToast("All mockup and demo data deleted! Database is completely empty.", "success");
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
      const scope = getWorkspaceScope();

      // Back up this workspace's operational data without mixing store branches.
      products.slice(0, 25).forEach(prod => {
        const prodRef = doc(db, 'users', scope, 'products', prod.id);
        batch.set(prodRef, prod);
      });
      customers.slice(0, 25).forEach(customer => {
        batch.set(doc(db, 'users', scope, 'customers', customer.id), customer);
      });
      suppliers.slice(0, 25).forEach(supplier => {
        batch.set(doc(db, 'users', scope, 'suppliers', supplier.id), supplier);
      });
      sales.slice(0, 25).forEach(sale => {
        batch.set(doc(db, 'users', scope, 'sales', sale.id), sale);
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

  const switchStoreBranch = (storeId: string) => {
    if (currentUser?.role === UserRole.STAFF && currentUser.workspaceScope !== getStoreWorkspaceScope(storeId)) {
      triggerToast('Staff can only access their assigned workspace.', 'error');
      return;
    }
    const target = saasStores.find(s => s.id === storeId);
    if (target) {
      if (target.onboardingCompleted !== true && getStoreWorkspaceScope(target.id) !== getUserScope(currentUser)) {
        initialiseEmptyStoreCache(target.id);
      }
      // Never leave the previous workspace's figures visible while the new
      // workspace cache and Firestore listeners are being attached.
      setProducts([]);
      setCustomers([]);
      setSuppliers([]);
      setSales([]);
      setPurchases([]);
      setTransactions([]);
      setStaff([]);
      setNotifications([]);
      setActiveStore(target);
      localStorage.setItem(getDeviceStoreKey(currentUser), target.id);
      triggerToast(`Switched workspace branch to ${target.name}`, 'info');
    }
  };

  const addStoreBranch = (store: Pick<SaaSStore, 'name' | 'branchCode' | 'city'>) => {
    const primaryStore: SaaSStore = {
      id: settings.tenantId || getUserScope(currentUser),
      name: settings.storeName || 'Primary Store',
      branchCode: settings.storeBranch || 'MAIN',
      city: settings.address || 'Primary location',
      status: 'Active'
    };
    const existingBranches = settings.storeBranches?.length
      ? settings.storeBranches
      : [primaryStore];
    const newStore: SaaSStore = {
      ...store,
      id: `branch-${Date.now()}`,
      branchCode: store.branchCode.trim().toUpperCase(),
      status: 'Active',
      onboardingCompleted: false
    };
    const storeBranches = [...existingBranches, newStore];
    initialiseEmptyStoreCache(newStore.id);
    setProducts([]);
    setCustomers([]);
    setSuppliers([]);
    setSales([]);
    setPurchases([]);
    setTransactions([]);
    setStaff([]);
    setNotifications([]);
    setSaaSStores(storeBranches);
    setActiveStore(newStore);
    localStorage.setItem(getDeviceStoreKey(currentUser), newStore.id);
    const sharedSettings = {...settings, storeBranches};
    const ownerScope = getUserScope(currentUser);
    saveLocalAndState('settings', sharedSettings, setSettings);
    setDoc(doc(db, 'users', ownerScope, 'store_settings', 'active'), sharedSettings).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${ownerScope}/store_settings`));
    triggerToast(`${newStore.name} added and activated.`, 'success');
  };

  const completeStoreBranchSetup = (
    configuration: NonNullable<SaaSStore['configuration']> & {storeName: string}
  ) => {
    const updatedStore: SaaSStore = {
      ...activeStore,
      name: configuration.storeName.trim(),
      city: configuration.address?.trim() || activeStore.city,
      onboardingCompleted: true,
      configuration: {
        ownerName: configuration.ownerName,
        businessType: configuration.businessType,
        phone: configuration.phone,
        email: configuration.email,
        address: configuration.address,
        gstNumber: configuration.gstNumber,
        website: configuration.website,
        currency: configuration.currency,
        receiptHeader: configuration.receiptHeader,
        receiptFooter: configuration.receiptFooter,
        invoiceSignature: configuration.invoiceSignature,
        showBankDetailsOnInvoice: configuration.showBankDetailsOnInvoice,
        bankAccountHolder: configuration.bankAccountHolder,
        bankName: configuration.bankName,
        bankAccountNumber: configuration.bankAccountNumber,
        bankBranch: configuration.bankBranch,
        bankIfsc: configuration.bankIfsc,
        upiId: configuration.upiId,
        upiPayeeName: configuration.upiPayeeName,
        whatsappInvoiceEnabled: configuration.whatsappInvoiceEnabled
      }
    };
    const storeBranches = saasStores.map(store => store.id === activeStore.id ? updatedStore : store);
    setSaaSStores(storeBranches);
    setActiveStore(updatedStore);
    localStorage.setItem(getDeviceStoreKey(currentUser), updatedStore.id);
    const sharedSettings = {...settings, storeBranches};
    const ownerScope = getUserScope(currentUser);
    saveLocalAndState('settings', sharedSettings, setSettings);
    setDoc(doc(db, 'users', ownerScope, 'store_settings', 'active'), sharedSettings).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${ownerScope}/store_settings`));
    setActiveTab('dashboard');
    triggerToast(`${updatedStore.name} is configured and ready.`, 'success');
  };

  const upgradeSaaSPlan = (planName: 'Free' | 'Basic' | 'Pro' | 'Enterprise') => {
    const updated = { ...settings, planTier: planName };
    updateSettings(updated);
    triggerToast(`SaaS Workspace upgraded to ${planName} Plan! 🚀`, 'success');
  };

  const ownerScope = getUserScope(currentUser);
  const primaryStoreId = settings.tenantId || ownerScope;
  const isPrimaryStore = !activeStore?.id || activeStore.id === 'primary-store' || activeStore.id === primaryStoreId || activeStore.id === ownerScope;
  const effectiveSettings: StoreSettings = isPrimaryStore ? settings : {
    ...settings,
    ...activeStore.configuration,
    storeName: activeStore.name,
    address: activeStore.configuration?.address || activeStore.city,
    phone: activeStore.configuration?.phone || '',
    email: activeStore.configuration?.email || '',
    gstNumber: activeStore.configuration?.gstNumber || '',
    website: activeStore.configuration?.website || '',
    receiptHeader: activeStore.configuration?.receiptHeader || activeStore.name,
    receiptFooter: activeStore.configuration?.receiptFooter || '',
    // Payment QR details belong to a workspace and must never inherit a sibling store's UPI account.
    upiId: activeStore.configuration?.upiId || '',
    upiPayeeName: activeStore.configuration?.upiPayeeName || activeStore.name,
    whatsappInvoiceEnabled: activeStore.configuration?.whatsappInvoiceEnabled ?? false,
    businessType: activeStore.configuration?.businessType || 'Retail',
    currency: activeStore.configuration?.currency || '₹',
    loyaltyPointsPerDollar: activeStore.configuration?.loyaltyPointsPerDollar ?? settings.loyaltyPointsPerDollar,
    dashboardWidgets: activeStore.configuration?.dashboardWidgets || settings.dashboardWidgets
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        login,
        logout,
        isFirebaseConnected,

        activeStore,
        saasStores,
        saasPlans: DEFAULT_SAAS_PLANS,
        switchStoreBranch,
        addStoreBranch,
        completeStoreBranchSetup,
        upgradeSaaSPlan,

        products,
        customers,
        suppliers,
        sales,
        purchases,
        transactions,
        settings: effectiveSettings,
        notifications,
        staff,

        addProduct,
        editProduct,
        deleteProduct,
        addSale,
        editSale,
        deleteSale,
        addPurchase,
        adjustStock,

        addCustomer,
        editCustomer,
        deleteCustomer,
        addSupplier,
        editSupplier,
        deleteSupplier,
        addStaff,
        updateStaff,
        deleteStaff,
        hasPermission,

        updateSettings,
        updateOnlineStore,
        deleteAllMockupData,

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
