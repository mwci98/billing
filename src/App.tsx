/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Package, ListChecks, 
  Users, Truck, BarChart3, Settings, LogOut, Sun, Moon, 
  Menu, X, Bell, UserCheck, ShieldAlert, Wifi
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
    toast
  } = useAppState();

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState<boolean>(false);

  // Unauthenticated screen guard gate
  if (!currentUser) {
    return (
      <div className={isDarkMode ? 'dark bg-[#0A0A0B]' : ''}>
        <div className="bg-gray-50 dark:bg-[#0A0A0B] min-h-screen text-gray-900 dark:text-[#E0E0E0] font-sans flex items-center justify-center p-4">
          <AuthScreen />
        </div>
      </div>
    );
  }

  // Check role authorization flags
  const isAdmin = currentUser.role === UserRole.ADMIN;

  // Custom Sidebar navigation list
  const sidebarItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, minRole: UserRole.STAFF },
    { id: 'pos', name: 'POS Billing', icon: ShoppingCart, minRole: UserRole.STAFF },
    { id: 'products', name: 'SKU Products', icon: ListChecks, minRole: UserRole.STAFF },
    { id: 'inventory', name: 'Restock Inventory', icon: Package, minRole: UserRole.STAFF },
    { id: 'customers', name: 'Customers Loyalty', icon: Users, minRole: UserRole.STAFF },
    { id: 'suppliers', name: 'B2B Suppliers', icon: Truck, minRole: UserRole.STAFF },
    { id: 'reports', name: 'Spreadsheet Reports', icon: BarChart3, minRole: UserRole.ADMIN },
    { id: 'settings', name: 'Store Config', icon: Settings, minRole: UserRole.ADMIN },
  ];

  // Map Active View/Tab panel
  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'pos':
        return <POSBilling />;
      case 'products':
        return <ProductManagement />;
      case 'inventory':
        return <InventoryManagement />;
      case 'customers':
        return <CustomerManagement />;
      case 'suppliers':
        return <SupplierManagement />;
      case 'reports':
        if (!isAdmin) return <SecurityBarrier />;
        return <ReportsView />;
      case 'settings':
        if (!isAdmin) return <SecurityBarrier />;
        return <SettingsPage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className={isDarkMode ? 'dark bg-[#0A0A0B] text-[#E0E0E0] min-h-screen font-sans' : 'bg-gray-50 text-gray-900 min-h-screen font-sans'}>
      {/* Gorgeous luxury custom toast notification alert */}
      {toast && (
        <div id="visual-toast" className="fixed top-6 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-3.5 rounded-2xl bg-[#141416]/95 border border-white/10 backdrop-blur-md px-6 py-4 shadow-2xl text-xs max-w-md w-[90%] md:w-auto transition-all duration-300 transform scale-100 font-sans">
          <span className={`text-base h-7 w-7 rounded-lg flex items-center justify-center font-bold font-mono shrink-0 select-none ${
            toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
            toast.type === 'error' ? 'bg-red-500/10 text-red-400' :
            toast.type === 'warning' ? 'bg-amber-500/10 text-amber-400' : 'bg-[#E2E2E2]/10 text-[#E2E2E2]'
          }`}>
            {toast.type === 'success' ? '✔' : toast.type === 'error' ? '✕' : toast.type === 'warning' ? '⚠️' : 'ℹ'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-serif text-[10px] uppercase text-white/40 tracking-wider font-semibold">Terminal Operation Msg</p>
            <p className="text-white text-[11.5px] font-medium tracking-wide leading-normal truncate">{toast.message}</p>
          </div>
        </div>
      )}
      <div className="flex min-h-screen">
        
        {/* MOBILE SIDEBAR DROPDOWN DRAWER */}
        <div className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden transition duration-240 ${
          isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`} onClick={() => setIsSidebarOpen(false)} />

        {/* PERSISTENT SIDEBAR COMPONENT */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-[#111112] border-r border-gray-100 dark:border-white/5 p-5 flex flex-col justify-between transition-transform duration-250 lg:static lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div>
            {/* Sidebar header store Title */}
            <div className="flex items-center justify-between pb-6 mb-4 border-b border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-md bg-white text-black flex items-center justify-center font-serif text-base font-bold italic shadow-xs">
                  {settings.storeName ? settings.storeName.charAt(0).toUpperCase() : 'B'}
                </span>
                <div>
                  <h1 className="text-sm font-black tracking-wider uppercase text-gray-900 dark:text-[#F2F2F2] truncate max-w-[10rem]">
                    {settings.storeName}
                  </h1>
                  <p className="text-[9px] uppercase tracking-tighter text-gray-400 dark:text-white/40 font-bold leading-tight">PWA Enterprise Terminal</p>
                </div>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* User Session Profile tag cards */}
            <div className="bg-gray-50 dark:bg-gray-900/40 p-3.5 rounded-2xl mb-6 border border-gray-100 dark:border-gray-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="rounded-xl h-9 w-9 bg-emerald-500 text-white flex items-center justify-center font-bold font-mono shadow-sm">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-gray-900 dark:text-white truncate leading-tight">{currentUser.name}</h4>
                  <p className="text-[9px] font-bold text-emerald-500 uppercase flex items-center gap-0.5 mt-0.5 font-mono">
                    <UserCheck className="h-3 w-3 shrink-0" />
                    {currentUser.role}
                  </p>
                </div>
              </div>
            </div>

            {/* Sidebar menus */}
            <nav className="space-y-1.5">
              {sidebarItems.map((item) => {
                const hasPerm = currentUser.role === UserRole.ADMIN || item.minRole === UserRole.STAFF;
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
                    className={`nav-sidebar-btn w-full gap-3 rounded-2xl px-4 py-3 text-xs font-semibold cursor-pointer flex items-center transition duration-150 relative ${
                      isActive 
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/10 scale-[1.01]' 
                        : 'text-gray-550 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-900/35'
                    }`}
                  >
                    <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-white' : 'text-emerald-500'}`} />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar bottom logout button actions */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-900 space-y-2">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="w-full flex items-center justify-between rounded-xl p-2.5 text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer"
            >
              <span className="font-semibold">Visual mode</span>
              {isDarkMode ? <Sun className="h-4.5 w-4.5 text-amber-500 animate-spin" /> : <Moon className="h-4.5 w-4.5 text-slate-500" />}
            </button>
            
            <button
              id="sidebar-logout-btn"
              onClick={logout}
              className="w-full flex items-center gap-2.5 rounded-2xl bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 p-3 text-xs font-black cursor-pointer transition"
            >
              <LogOut className="h-4.5 w-4.5" />
              <span>Exit system</span>
            </button>
          </div>
        </aside>

        {/* DYNAMIC SCROLL CONTAINER & LAYOUT CONTENT AREA */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          
          {/* TOP GLOBAL SYSTEM ACTIONS HEADER */}
          <header className="border-b border-gray-100 dark:border-white/5 bg-white dark:bg-[#0A0A0B] sticky top-0 z-30 px-6 py-4.5 flex items-center justify-between gap-4">
            
            <div className="flex items-center gap-3">
              <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-1.5 rounded-xl border border-gray-150 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900">
                <Menu className="h-5 w-5" />
              </button>
              
              <div className="hidden sm:block">
                <h2 className="text-xs font-bold font-mono tracking-wider text-gray-400 uppercase">System Active Shell</h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200">Terminal Server online: Port 3000</span>
                </div>
              </div>
            </div>

            {/* Live alerts warnings badge, Sync logs, notifications trigger */}
            <div className="flex items-center gap-2 text-xs font-semibold relative">
              
              {/* Sync Cloud online status indicators */}
              <div className="rounded-xl px-3 py-2 bg-gray-55/40 dark:bg-gray-900/60 flex items-center gap-1.5 text-gray-500 font-mono text-[10px]">
                <Wifi className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                <span className="hidden md:inline uppercase">{isFirebaseConnected ? 'Firebase Realtime Connected' : 'Local Offline Mode'}</span>
              </div>

              {/* Real-time stock / expiry notifications tray */}
              <button 
                id="header-notif-bell-btn"
                onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)}
                className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-55 dark:hover:bg-gray-900 text-gray-600 dark:text-gray-300 relative cursor-pointer"
              >
                <Bell className="h-4.5 w-4.5" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-black animate-bounce">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>

              {/* Notification Overlay dropdown */}
              {isNotifDropdownOpen && (
                <div className="absolute top-12 right-0 z-50 w-72 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-900 rounded-2xl shadow-xl p-4 font-medium text-gray-800 dark:text-white">
                  <span className="block text-[11px] uppercase tracking-wider font-extrabold text-gray-400 border-b border-gray-100 pb-2 mb-2">SYSTEM ALERTS ({notifications.length})</span>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-[10px] text-gray-400 py-4 text-center font-bold">Zero active stock violations</p>
                    ) : (
                      notifications.slice(0, 5).map(n => (
                        <div key={n.id} className="relative flex justify-between gap-1 p-2 rounded-xl bg-amber-50/40 dark:bg-amber-950/25 border border-amber-500/10 text-[10px]">
                          <div>
                            <p className="font-bold text-gray-850 dark:text-gray-100 flex items-center gap-1">
                              ⚠️ Low Stock
                            </p>
                            <p className="text-gray-450 text-[9px] font-semibold mt-0.5 italic leading-tight">{n.message}</p>
                          </div>
                          {!n.read && (
                            <button 
                              onClick={() => markNotificationRead(n.id)}
                              className="text-[9px] uppercase font-bold text-emerald-500 hover:text-emerald-600"
                            >
                              Dismiss
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </header>

          {/* MAIN DYNAMIC CONTENT COMPONENT SCREEN VIEW OUTLET */}
          <main className="flex-1 p-6 max-w-7xl mx-auto w-full transition-all duration-300">
            {renderActiveScreen()}
          </main>
        </div>
      </div>
    </div>
  );
};

// Simple visual security barrier if staff toggles reports
const SecurityBarrier: React.FC = () => (
  <div className="rounded-3xl border border-red-500/10 bg-red-50/50 dark:bg-red-950/15 p-12 text-center max-w-md mx-auto space-y-4">
    <div className="mx-auto rounded-full bg-red-100 dark:bg-red-900/50 text-red-500 p-4 w-16 h-16 flex items-center justify-center animate-bounce">
      <ShieldAlert className="h-8 w-8 stroke-[2px]" />
    </div>
    <h3 className="text-lg font-black text-gray-950 dark:text-white">Administrative clearance Required</h3>
    <p className="text-xs text-gray-400 leading-relaxed">
      You are logged in as Checkout Staff. Reports, spreadheets downloads, and store global settings configurations are restricted to Admin login accounts only.
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
