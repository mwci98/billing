/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Product, Customer, Supplier, Sale, Purchase, 
  InventoryTransaction, StoreSettings, POSNotification, UserRole, SaaSStore, SaaSPlan,
  Staff, StaffPermissions, AppUser
} from '../types';
import { 
  INITIAL_PRODUCTS, INITIAL_CUSTOMERS, INITIAL_SUPPLIERS, 
  INITIAL_SETTINGS, INITIAL_SALES, INITIAL_PURCHASES, INITIAL_TRANSACTIONS 
} from './demoData';
import { db, auth, authPersistenceReady, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, deleteDoc, collection, onSnapshot, writeBatch, getDoc } from 'firebase/firestore';

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
  canViewFinancials: false
};

const TRIAL_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

const omitUndefinedFields = <T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
  ) as T;

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
  addPurchase: (purchase: Omit<Purchase, 'id' | 'date'>) => void;
  adjustStock: (productId: string, quantity: number, type: 'Stock In' | 'Stock Out' | 'Adjustment', description: string) => void;
  
  // Contacts
  addCustomer: (customer: Omit<Customer, 'id' | 'totalSpent' | 'outstandingDue' | 'createdAt'>) => Customer;
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
    const selected = branches.find(store => store.id === settings.activeStoreId)
      || branches.find(store => store.id === activeStore.id)
      || branches[0];
    setSaaSStores(branches);
    setActiveStore(selected);
  }, [
    currentUser,
    settings.activeStoreId,
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

  // 1. User Tenant Data Scope Hydration & Live Firestore Snapshot Listeners
  useEffect(() => {
    const scope = getUserScope(currentUser);
    const scopeKey = (key: string) => `pos_${scope}_${key}`;

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
    const localSettings = localStorage.getItem(scopeKey('settings'));
    const localStaff = localStorage.getItem(scopeKey('staff'));

    if (localProducts) {
      setProducts(JSON.parse(localProducts));
    } else {
      setProducts([]);
      localStorage.setItem(scopeKey('products'), JSON.stringify([]));
    }

    if (localCustomers) {
      setCustomers(JSON.parse(localCustomers));
    } else {
      setCustomers([]);
      localStorage.setItem(scopeKey('customers'), JSON.stringify([]));
    }

    if (localSuppliers) {
      setSuppliers(JSON.parse(localSuppliers));
    } else {
      setSuppliers([]);
      localStorage.setItem(scopeKey('suppliers'), JSON.stringify([]));
    }

    if (localSales) {
      setSales(JSON.parse(localSales));
    } else {
      setSales([]);
      localStorage.setItem(scopeKey('sales'), JSON.stringify([]));
    }

    if (localPurchases) {
      setPurchases(JSON.parse(localPurchases));
    } else {
      setPurchases([]);
      localStorage.setItem(scopeKey('purchases'), JSON.stringify([]));
    }

    if (localTransactions) {
      setTransactions(JSON.parse(localTransactions));
    } else {
      setTransactions([]);
      localStorage.setItem(scopeKey('transactions'), JSON.stringify([]));
    }

    if (localSettings) {
      const parsed = JSON.parse(localSettings);
      parsed.tenantId = parsed.tenantId || scope;
      parsed.onboardingCompleted = parsed.onboardingCompleted ?? false;
      if (!parsed.trialStartedAt && parsed.subscriptionStatus !== 'active') {
        const trialStartedAt = new Date();
        parsed.trialStartedAt = trialStartedAt.toISOString();
        parsed.trialEndsAt = new Date(trialStartedAt.getTime() + TRIAL_DURATION_MS).toISOString();
        parsed.subscriptionStatus = 'trialing';
        parsed.planTier = 'Basic';
        setDoc(doc(db, 'users', scope, 'store_settings', 'active'), parsed, {merge: true})
          .catch(error => handleFirestoreError(error, OperationType.UPDATE, `users/${scope}/store_settings`));
      }
      if (parsed.currency === '$' || !parsed.currency) parsed.currency = '₹';
      setSettings(parsed);
    } else {
      const trialStartedAt = new Date();
      const userCustomSettings: StoreSettings = {
        ...INITIAL_SETTINGS,
        tenantId: scope,
        planTier: 'Basic',
        subscriptionStatus: 'trialing',
        trialStartedAt: trialStartedAt.toISOString(),
        trialEndsAt: new Date(trialStartedAt.getTime() + TRIAL_DURATION_MS).toISOString(),
        onboardingCompleted: false,
        storeName: currentUser?.name ? `${currentUser.name}'s QPOS` : INITIAL_SETTINGS.storeName,
        email: currentUser?.email || INITIAL_SETTINGS.email,
        currency: '₹'
      };
      setSettings(userCustomSettings);
      localStorage.setItem(scopeKey('settings'), JSON.stringify(userCustomSettings));
      getDoc(doc(db, 'users', scope, 'store_settings', 'active'))
        .then(existing => {
          if (existing.exists()) {
            const remote = existing.data() as StoreSettings;
            const remoteSettings: StoreSettings = {
              ...remote,
              tenantId: remote.tenantId || scope,
              onboardingCompleted: remote.onboardingCompleted ?? false
            };
            setSettings(remoteSettings);
            localStorage.setItem(scopeKey('settings'), JSON.stringify(remoteSettings));
            if (!remote.tenantId || remote.onboardingCompleted === undefined) {
              setDoc(doc(db, 'users', scope, 'store_settings', 'active'), remoteSettings, {merge: true});
            }
          } else {
            setDoc(doc(db, 'users', scope, 'store_settings', 'active'), userCustomSettings);
          }
        })
        .catch(error => handleFirestoreError(error, OperationType.GET, `users/${scope}/store_settings`));
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

    const unsubSettings = onSnapshot(
      collection(db, 'users', scope, 'store_settings'),
      (snapshot) => {
        if (!snapshot.empty) {
          const sDoc = snapshot.docs.find(d => d.id === 'active');
          if (sDoc) {
            const remote = sDoc.data() as StoreSettings;
            const data: StoreSettings = {
              ...remote,
              tenantId: remote.tenantId || scope,
              onboardingCompleted: remote.onboardingCompleted ?? false
            };
            setSettings(data);
            localStorage.setItem(scopeKey('settings'), JSON.stringify(data));
            if (!remote.tenantId || remote.onboardingCompleted === undefined) {
              setDoc(doc(db, 'users', scope, 'store_settings', 'active'), data, {merge: true});
            }
          }
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `users/${scope}/store_settings`)
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
      unsubSettings();
      unsubStaff();
    };
  }, [currentUser]);

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
    const scope = getUserScope(currentUser);
    localStorage.setItem(`pos_${scope}_${keyName}`, JSON.stringify(data));
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
        permissions: staffAccount.permissions
      };
      saveLocalAndState('active_user', staffSession, setCurrentUser);
      setActiveTab(staffAccount.permissions.canBill ? 'pos' : staffAccount.permissions.canPurchase ? 'inventory' : 'products');
      triggerToast(`Authenticated as ${staffAccount.name}`, 'success');
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
    const scope = getUserScope(currentUser);
    const newStaff: Staff = {
      ...staffInput,
      id: `staff-${Date.now()}`,
      email,
      role: UserRole.STAFF,
      tenantId: scope,
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
    const scope = getUserScope(currentUser);
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
    const scope = getUserScope(currentUser);
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
    const scope = getUserScope(currentUser);
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
    const scope = getUserScope(currentUser);
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
    const scope = getUserScope(currentUser);
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
    const scope = getUserScope(currentUser);
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
    const scope = getUserScope(currentUser);
    const saleId = `sale-${Math.floor(100000 + Math.random() * 900000)}`;
    const newSale: Sale = {
      ...s,
      id: saleId,
      date: new Date().toISOString()
    };

    // Update real-time product stock counts atomically and write audit logs
    setProducts((prevProducts) => {
      const updatedProducts = prevProducts.map((prod) => {
        const soldItems = s.items.filter((item) => item.productId === prod.id);
        if (soldItems.length > 0) {
          const totalSoldQty = soldItems.reduce((acc, item) => acc + item.quantity, 0);
          const nextStock = Math.max(0, prod.stock - totalSoldQty);
          
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

  // 7. Purchase entry restock catalog
  const addPurchase = (p: Omit<Purchase, 'id' | 'date'>) => {
    const scope = getUserScope(currentUser);
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
          const nextStock = prod.stock + totalPurchasedQty;
          
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
    const scope = getUserScope(currentUser);

    setProducts((prevProducts) => {
      const targetProduct = prevProducts.find((prod) => prod.id === productId);
      if (!targetProduct) return prevProducts;

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
  const addCustomer = (c: Omit<Customer, 'id' | 'totalSpent' | 'outstandingDue' | 'createdAt'>): Customer => {
    const scope = getUserScope(currentUser);
    const newCust: Customer = {
      ...c,
      id: `cust-${Date.now()}`,
      totalSpent: 0,
      outstandingDue: 0,
      createdAt: new Date().toISOString()
    };
    const updated = [newCust, ...customers];
    saveLocalAndState('customers', updated, setCustomers);

    setDoc(doc(db, 'users', scope, 'customers', newCust.id), newCust).catch(e => handleFirestoreError(e, OperationType.CREATE, `users/${scope}/customers`));
    return newCust;
  };

  const editCustomer = (id: string, c: Partial<Customer>) => {
    const scope = getUserScope(currentUser);
    let updatedC: Customer | null = null;
    const updated = customers.map((cust) => {
      if (cust.id === id) {
        updatedC = { ...cust, ...c };
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
    const scope = getUserScope(currentUser);
    const updated = customers.filter((cust) => cust.id !== id);
    saveLocalAndState('customers', updated, setCustomers);

    deleteDoc(doc(db, 'users', scope, 'customers', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${scope}/customers`));
  };

  const addSupplier = (s: Omit<Supplier, 'id' | 'outstandingBalance' | 'createdAt'>): Supplier => {
    const scope = getUserScope(currentUser);
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
    const scope = getUserScope(currentUser);
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
    const scope = getUserScope(currentUser);
    const updated = suppliers.filter((supp) => supp.id !== id);
    saveLocalAndState('suppliers', updated, setSuppliers);

    deleteDoc(doc(db, 'users', scope, 'suppliers', id)).catch(e => handleFirestoreError(e, OperationType.DELETE, `users/${scope}/suppliers`));
  };

  // Settings
  const updateSettings = (newSettings: StoreSettings) => {
    const scope = getUserScope(currentUser);
    saveLocalAndState('settings', newSettings, setSettings);
    setDoc(doc(db, 'users', scope, 'store_settings', 'active'), newSettings).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${scope}/store_settings`));
  };

  const deleteAllMockupData = async () => {
    const scope = getUserScope(currentUser);

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

  const switchStoreBranch = (storeId: string) => {
    const target = saasStores.find(s => s.id === storeId);
    if (target) {
      setActiveStore(target);
      updateSettings({...settings, activeStoreId: target.id});
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
      status: 'Active'
    };
    const storeBranches = [...existingBranches, newStore];
    setSaaSStores(storeBranches);
    setActiveStore(newStore);
    updateSettings({
      ...settings,
      storeBranches,
      activeStoreId: newStore.id
    });
    triggerToast(`${newStore.name} added and activated.`, 'success');
  };

  const upgradeSaaSPlan = (planName: 'Free' | 'Basic' | 'Pro' | 'Enterprise') => {
    const updated = { ...settings, planTier: planName };
    updateSettings(updated);
    triggerToast(`SaaS Workspace upgraded to ${planName} Plan! 🚀`, 'success');
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
        upgradeSaaSPlan,

        products,
        customers,
        suppliers,
        sales,
        purchases,
        transactions,
        settings,
        notifications,
        staff,

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
        addStaff,
        updateStaff,
        deleteStaff,
        hasPermission,

        updateSettings,
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
