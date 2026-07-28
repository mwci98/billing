/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Package, ListChecks, 
  Users, Truck, BarChart3, Settings, LogOut, Sun, Moon, 
  Menu, X, Bell, UserCheck, ShieldAlert, Wifi, Building2, Zap, UserCog, ArrowRight
} from 'lucide-react';
import { AppProvider, useAppState } from './lib/stateContext';
import { UserRole } from './types';
import { AuthScreen } from './components/AuthScreen';
import { Dashboard } from './components/Dashboard';
import { POSBilling } from './components/POSBilling';
import { ProductManagement } from './components/ProductManagement';
import { InventoryManagement } from './components/InventoryManagement';
import { CustomerManagement } from './components/CustomerManagement';
import { SupplierManagement } from './components/SupplierManagement';
import { ReportsView } from './components/ReportsView';
import { SettingsPage } from './components/SettingsPage';
import { SaaSManagerModal } from './components/SaaSManagerModal';
import { UserManagement } from './components/UserManagement';
import { StaffPermissions } from './types';
import { SubscriptionGate } from './components/SubscriptionGate';
import { BusinessOnboarding } from './components/BusinessOnboarding';
import { LandingPage } from './components/LandingPage';

// Inner wrapper component to access state Context keys cleanly
const AppContent: React.FC = () => {
  const { 
    currentUser, 
    logout, 
    activeTab, 
    setActiveTab, 
    isDarkMode, 
    setIsDarkMode,
    notifications,
    markNotificationRead,
    isFirebaseConnected,
    settings,
    activeStore,
    toast,
    hasPermission
  } = useAppState();

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState<boolean>(false);
  const [isSaaSModalOpen, setIsSaaSModalOpen] = useState<boolean>(false);
  const [showLogin, setShowLogin] = useState<boolean>(false);

  // Keep global theme selectors aligned with application state.
  // The authentication screen is intentionally always dark.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', currentUser ? isDarkMode : true);
    document.title = 'QuickPOS';
  }, [currentUser, isDarkMode]);

  // Unauthenticated screen guard gate
  if (!currentUser) {
    if (!showLogin) {
      return <LandingPage onGetStarted={() => setShowLogin(true)} />;
    }

    return (
      <div className="dark bg-[#0A0A0B] min-h-screen">
        <button
          type="button"
          onClick={() => setShowLogin(false)}
          className="fixed left-4 top-4 z-50 flex items-center gap-2 rounded-xl border border-white/10 bg-[#141416]/90 px-4 py-2.5 text-xs font-bold text-white/70 backdrop-blur-xl transition hover:border-white/20 hover:text-white sm:left-7 sm:top-7"
        >
          <ArrowRight className="h-3.5 w-3.5 rotate-180" />
          Back to home
        </button>
        <div className="bg-[#0A0A0B] min-h-screen text-[#E0E0E0] font-sans flex items-center justify-center p-4 pt-20">
          <AuthScreen />
        </div>
      </div>
    );
  }

  if (
    currentUser.role === UserRole.ADMIN &&
    settings.tenantId &&
    settings.onboardingCompleted !== true
  ) {
    return <BusinessOnboarding />;
  }

  // Check role authorization flags
  const isAdmin = currentUser.role === UserRole.ADMIN;

  // Custom Sidebar navigation list
  const sidebarItems: Array<{
    id: string;
    name: string;
    icon: React.ComponentType<{className?: string}>;
    permission?: keyof StaffPermissions;
    adminOnly?: boolean;
  }> = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, permission: 'canViewDashboard' },
    { id: 'pos', name: 'POS Billing', icon: ShoppingCart, permission: 'canBill' },
    { id: 'products', name: 'SKU Products', icon: ListChecks, permission: 'canManageProducts' },
    { id: 'inventory', name: 'Restock / Purchase', icon: Package, permission: 'canPurchase' },
    { id: 'customers', name: 'Customers Loyalty', icon: Users, permission: 'canManageCustomers' },
    { id: 'suppliers', name: 'B2B Suppliers', icon: Truck, permission: 'canManageCustomers' },
    { id: 'reports', name: 'Spreadsheet Reports', icon: BarChart3, permission: 'canViewFinancials' },
    { id: 'staff', name: 'Staff Access', icon: UserCog, adminOnly: true },
    { id: 'settings', name: 'Store Config', icon: Settings, adminOnly: true },
  ];

  const canAccessTab = (tab: string) => {
    const item = sidebarItems.find(entry => entry.id === tab);
    if (!item) return false;
    if (item.adminOnly) return isAdmin;
    return item.permission ? hasPermission(item.permission) : true;
  };

  // Map Active View/Tab panel
  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'dashboard':
        if (!canAccessTab('dashboard')) return <SecurityBarrier />;
        return <Dashboard />;
      case 'pos':
        if (!canAccessTab('pos')) return <SecurityBarrier />;
        return <POSBilling />;
      case 'products':
        if (!canAccessTab('products')) return <SecurityBarrier />;
        return <ProductManagement />;
      case 'inventory':
        if (!canAccessTab('inventory')) return <SecurityBarrier />;
        return <InventoryManagement />;
      case 'customers':
        if (!canAccessTab('customers')) return <SecurityBarrier />;
        return <CustomerManagement />;
      case 'suppliers':
        if (!canAccessTab('suppliers')) return <SecurityBarrier />;
        return <SupplierManagement />;
      case 'reports':
        if (!canAccessTab('reports')) return <SecurityBarrier />;
        return <ReportsView />;
      case 'staff':
        if (!isAdmin) return <SecurityBarrier />;
        return <UserManagement />;
      case 'settings':
        if (!isAdmin) return <SecurityBarrier />;
        return <SettingsPage />;
      default:
        return <Dashboard />;
    }
  };

  // Get active tab title for app header
  const currentTabItem = sidebarItems.find(i => i.id === activeTab);
  const activeTabTitle = currentTabItem ? currentTabItem.name : 'QuickPOS';

  return (
    <SubscriptionGate>
    <div className={isDarkMode ? 'app-shell dark bg-[#0A0A0B] text-[#E0E0E0] min-h-screen font-sans antialiased selection:bg-emerald-500 selection:text-white' : 'app-shell bg-gray-50 text-gray-900 min-h-screen font-sans antialiased selection:bg-emerald-500 selection:text-white'}>
      {/* Toast notification banner */}
      {toast && (
        <div id="visual-toast" className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-3 rounded-2xl bg-[#141416]/95 border border-white/10 backdrop-blur-xl px-5 py-3 shadow-2xl text-xs max-w-md w-[92%] md:w-auto transition-all duration-300 font-sans">
          <span className={`text-sm h-7 w-7 rounded-xl flex items-center justify-center font-bold font-mono shrink-0 select-none ${
            toast.type === 'success' ? 'bg-emerald-500/15 text-emerald-400' :
            toast.type === 'error' ? 'bg-red-500/15 text-red-400' :
            toast.type === 'warning' ? 'bg-amber-500/15 text-amber-400' : 'bg-[#E2E2E2]/15 text-[#E2E2E2]'
          }`}>
            {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : toast.type === 'warning' ? '!' : 'i'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] uppercase tracking-wider text-white/50 font-bold">POS App Notification</p>
            <p className="text-white text-xs font-semibold truncate">{toast.message}</p>
          </div>
        </div>
      )}

      <div className="flex min-h-screen">
        
        {/* MOBILE SIDEBAR BACKDROP */}
        <div className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity duration-200 ${
          isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`} onClick={() => setIsSidebarOpen(false)} />

        {/* SIDEBAR COMPONENT */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-[#111112] border-r border-gray-100 dark:border-white/5 p-5 flex flex-col justify-between transition-transform duration-200 ease-out lg:static lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div>
            {/* Sidebar header store Title */}
            <div className="flex items-center justify-between pb-5 mb-4 border-b border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white flex items-center justify-center font-black text-lg shadow-md shadow-emerald-500/20 shrink-0">
                  {settings.storeName ? settings.storeName.charAt(0).toUpperCase() : 'E'}
                </span>
                <div className="min-w-0">
                  <h1 className="text-xs font-extrabold tracking-wide uppercase text-gray-900 dark:text-[#F2F2F2] truncate max-w-[9.5rem]">
                    {settings.storeName}
                  </h1>
                  <p className="text-[9px] uppercase tracking-tight text-emerald-500 font-bold flex items-center gap-1 mt-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Smart App Terminal
                  </p>
                </div>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1.5 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900 active:scale-95">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* User Session Profile Card */}
            <div className="bg-gray-50 dark:bg-gray-900/40 p-3 rounded-2xl mb-5 border border-gray-100 dark:border-gray-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="rounded-xl h-9 w-9 bg-emerald-500 text-white flex items-center justify-center font-bold font-mono shadow-sm shrink-0">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">{currentUser.name}</h4>
                  <p className="text-[9px] font-bold text-emerald-500 uppercase flex items-center gap-0.5 mt-0.5 font-mono">
                    <UserCheck className="h-3 w-3 shrink-0" />
                    {currentUser.role}
                  </p>
                </div>
              </div>
            </div>

            {/* Sidebar menus */}
            <nav className="space-y-1">
              {sidebarItems.map((item) => {
                const hasPerm = item.adminOnly ? isAdmin : !item.permission || hasPermission(item.permission);
                if (!hasPerm) return null;
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    id={`sidebar-tab-${item.id}`}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsSidebarOpen(false);
                    }}
                    className={`nav-sidebar-btn w-full gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold cursor-pointer flex items-center transition duration-150 active:scale-98 ${
                      isActive 
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-900/50'
                    }`}
                  >
                    <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-white' : 'text-emerald-500'}`} />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar bottom actions */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-900 space-y-2">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="w-full flex items-center justify-between rounded-xl p-2.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer font-bold"
            >
              <span className="flex items-center gap-2">
                {isDarkMode ? <Moon className="h-4 w-4 text-emerald-400" /> : <Sun className="h-4 w-4 text-amber-500" />}
                Appearance Mode
              </span>
              <span className="text-[10px] text-gray-400 uppercase font-mono">{isDarkMode ? 'Dark' : 'Light'}</span>
            </button>
            
            <button
              id="sidebar-logout-btn"
              onClick={logout}
              className="w-full flex items-center gap-2.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 p-2.5 text-xs font-bold cursor-pointer transition active:scale-98"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Exit App Session</span>
            </button>
          </div>
        </aside>

        {/* MAIN DYNAMIC SHELL CONTAINER */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          
          {/* NATIVE APP TOP HEADER BAR */}
          <header className="border-b border-gray-100 dark:border-white/5 bg-white/90 dark:bg-[#0A0A0B]/90 backdrop-blur-md sticky top-0 z-30 px-4 md:px-6 py-3 flex items-center justify-between gap-3">
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsSidebarOpen(true)} 
                className="p-2 rounded-xl bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 active:scale-95 cursor-pointer"
                aria-label="Open Navigation Drawer"
              >
                <Menu className="h-5 w-5 stroke-[2.2]" />
              </button>
              
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm md:text-base font-extrabold text-gray-900 dark:text-white leading-none">
                    {activeTabTitle}
                  </h2>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hidden sm:inline-block">
                    PRO APP
                  </span>
                </div>
                <p className="text-[10px] font-mono text-gray-400 mt-0.5 hidden sm:block">
                  <span className="text-emerald-500 font-bold">{currentUser.email}</span> • {settings.storeName || 'Isolated Business SaaS'}
                </p>
              </div>
            </div>

            {/* Top header status tools & notifications bell */}
            <div className="flex items-center gap-2 text-xs font-semibold">
              
              {/* SaaS Multi-Branch Selector Button */}
              <button
                onClick={() => setIsSaaSModalOpen(true)}
                className="rounded-xl px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 font-bold transition-all active:scale-95 cursor-pointer"
                title="Manage SaaS Store Branches & Subscription Plans"
              >
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="max-w-[120px] truncate hidden md:inline">{activeStore.name}</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-white text-[9px] font-black uppercase tracking-wider">
                  {settings.subscriptionStatus === 'active'
                    ? 'Basic'
                    : settings.subscriptionStatus === 'trialing'
                      ? 'Trial'
                      : 'Expired'}
                </span>
              </button>

              {/* Online connection status badge */}
              <div className="rounded-xl px-2.5 py-1.5 bg-gray-100 dark:bg-gray-900 flex items-center gap-1.5 text-gray-600 dark:text-gray-300 font-mono text-[10px]">
                <Wifi className="h-3.5 w-3.5 text-emerald-500 animate-pulse shrink-0" />
                <span className="hidden sm:inline font-bold uppercase">{isFirebaseConnected ? 'Cloud Syncing' : 'Local Offline'}</span>
              </div>

              {/* Theme Quick Toggle Button */}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 rounded-xl bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 active:scale-95 cursor-pointer"
                title="Toggle Dark / Light Theme"
              >
                {isDarkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-gray-600" />}
              </button>

              {/* Real-time notifications dropdown */}
              <div className="relative">
                <button 
                  id="header-notif-bell-btn"
                  onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)}
                  className="p-2 rounded-xl bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800 active:scale-95 relative cursor-pointer"
                >
                  <Bell className="h-4 w-4" />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute -top-1 -right-1 h-4.5 w-4.5 rounded-full bg-red-500 text-white flex items-center justify-center text-[9px] font-black animate-bounce">
                      {notifications.filter(n => !n.read).length}
                    </span>
                  )}
                </button>

                {/* Notifications overlay menu */}
                {isNotifDropdownOpen && (
                  <div className="absolute top-11 right-0 z-50 w-72 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-4 font-sans text-gray-800 dark:text-white">
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-900 pb-2 mb-2">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-gray-400">Stock Notifications ({notifications.length})</span>
                      <button onClick={() => setIsNotifDropdownOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xs">✕</button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="text-xs text-gray-400 py-6 text-center font-medium">All stock levels healthy</p>
                      ) : (
                        notifications.slice(0, 5).map(n => (
                          <div key={n.id} className="flex justify-between items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                            <div>
                              <p className="font-bold text-gray-900 dark:text-gray-100">⚠️ Low Inventory</p>
                              <p className="text-gray-500 dark:text-gray-400 text-[10px] mt-0.5 leading-snug">{n.message}</p>
                            </div>
                            {!n.read && (
                              <button 
                                onClick={() => markNotificationRead(n.id)}
                                className="text-[10px] uppercase font-bold text-emerald-500 hover:text-emerald-600 shrink-0"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </header>

          {/* MAIN APPLICATION VIEW PORT (with safe bottom padding for fixed mobile dock) */}
          <main className="flex-1 p-3.5 sm:p-5 lg:p-6 max-w-7xl mx-auto w-full pb-28 lg:pb-8">
            {renderActiveScreen()}
          </main>
        </div>

      </div>

      {/* NATIVE APP BOTTOM NAVIGATION DOCK (VISIBLE ON MOBILE & TABLET) */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#111112]/95 backdrop-blur-lg border-t border-gray-200/80 dark:border-white/10 px-2 py-1.5 flex items-center justify-around lg:hidden shadow-2xl">
        {canAccessTab('pos') && (
        <button
          onClick={() => setActiveTab('pos')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl cursor-pointer transition active:scale-95 ${
            activeTab === 'pos' 
              ? 'text-emerald-500 font-bold' 
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
          }`}
        >
          <ShoppingCart className="h-5 w-5 stroke-[2.2]" />
          <span className="text-[10px] mt-1 font-semibold">POS Billing</span>
        </button>
        )}

        {canAccessTab('products') && (
        <button
          onClick={() => setActiveTab('products')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl cursor-pointer transition active:scale-95 ${
            activeTab === 'products' 
              ? 'text-emerald-500 font-bold' 
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
          }`}
        >
          <ListChecks className="h-5 w-5 stroke-[2.2]" />
          <span className="text-[10px] mt-1 font-semibold">Products</span>
        </button>
        )}

        {canAccessTab('inventory') && (
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl cursor-pointer transition active:scale-95 ${
            activeTab === 'inventory' 
              ? 'text-emerald-500 font-bold' 
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
          }`}
        >
          <Package className="h-5 w-5 stroke-[2.2]" />
          <span className="text-[10px] mt-1 font-semibold">Restock</span>
        </button>
        )}

        {canAccessTab('dashboard') && (
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl cursor-pointer transition active:scale-95 ${
            activeTab === 'dashboard' 
              ? 'text-emerald-500 font-bold' 
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
          }`}
        >
          <LayoutDashboard className="h-5 w-5 stroke-[2.2]" />
          <span className="text-[10px] mt-1 font-semibold">Dashboard</span>
        </button>
        )}

        <button
          onClick={() => setIsSidebarOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-xl cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 active:scale-95"
        >
          <Menu className="h-5 w-5 stroke-[2.2]" />
          <span className="text-[10px] mt-1 font-semibold">More</span>
        </button>
      </nav>

      {/* SaaS Multi-Branch & Subscription Manager Modal */}
      <SaaSManagerModal 
        isOpen={isSaaSModalOpen} 
        onClose={() => setIsSaaSModalOpen(false)} 
      />
    </div>
    </SubscriptionGate>
  );
};

// Visual security barrier for any route outside the staff member's permissions.
const SecurityBarrier: React.FC = () => (
  <div className="rounded-3xl border border-red-500/10 bg-red-50/50 dark:bg-red-950/15 p-12 text-center max-w-md mx-auto space-y-4">
    <div className="mx-auto rounded-full bg-red-100 dark:bg-red-900/50 text-red-500 p-4 w-16 h-16 flex items-center justify-center animate-bounce">
      <ShieldAlert className="h-8 w-8 stroke-[2px]" />
    </div>
    <h3 className="text-lg font-black text-gray-950 dark:text-white">Permission required</h3>
    <p className="text-xs text-gray-400 leading-relaxed">
      Your staff account does not have access to this area. Ask the store owner to update your permissions under Staff Access.
    </p>
  </div>
);

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
