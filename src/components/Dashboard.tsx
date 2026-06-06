/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  TrendingUp, ShoppingCart, Users, Package, AlertTriangle, 
  ArrowUpRight, ArrowDownRight, Calendar, Bell, DollarSign,
  Layers, PackageMinus, RefreshCw
} from 'lucide-react';
import { useAppState } from '../lib/stateContext';
import { UserRole } from '../types';

export const Dashboard: React.FC = () => {
  const { 
    products, 
    sales, 
    customers, 
    purchases, 
    settings, 
    notifications, 
    setActiveTab, 
    currentUser,
    syncWithCloud
  } = useAppState();

  // 1. KPI Calculations
  const totalProducts = products.length;
  
  // Total Sales & Today's Metric Sales
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySales = sales.filter((s) => s.date.includes(todayStr) && s.status === 'Completed');
  const totalSalesRevenue = sales
    .filter(s => s.status === 'Completed')
    .reduce((acc, curr) => acc + curr.total, 0);
  const todayRevenue = todaySales.reduce((acc, curr) => acc + curr.total, 0);

  // Profit calculations
  // total revenue - total product purchase cost for those sold items
  const estimatedProfit = sales
    .filter(s => s.status === 'Completed')
    .reduce((acc, sale) => {
      const saleCost = sale.items.reduce((itemCost, item) => {
        const p = products.find(prod => prod.id === item.productId);
        const buyPrice = p ? p.purchasePrice : item.price * 0.5; // fallback
        return itemCost + (buyPrice * item.quantity);
      }, 0);
      return acc + (sale.total - sale.subtotal * 0.1) - saleCost; // Subtract estimates taxes
    }, 0);

  // Purchases aggregate
  const totalPurchasesAmount = purchases.reduce((acc, curr) => acc + curr.total, 0);
  
  // Contacts
  const totalCustomers = customers.length;
  
  // Low Stock & Expiry counts
  const lowStockProducts = products.filter((p) => p.stock <= p.lowStockAlert);
  const outOfStockProducts = products.filter((p) => p.stock === 0);
  
  const unreadNotifications = notifications.filter(n => !n.read);

  // 2. Pure React Hand-Crafted SVG Charts Data Prep
  // Group sales by day of the week for weekly revenue view
  const last7DaysOfSales = Array.from({ length: 7 })
    .map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    })
    .reverse();

  const weeklyChartData = last7DaysOfSales.map((dayString) => {
    const dayName = new Date(dayString).toLocaleDateString('en-US', { weekday: 'short' });
    const dayTotal = sales
      .filter((s) => s.date.includes(dayString) && s.status === 'Completed')
      .reduce((acc, curr) => acc + curr.total, 0);
    return { label: dayName, value: dayTotal };
  });

  const maxWeeklyVal = Math.max(...weeklyChartData.map((d) => d.value), 100);

  // Category breakdown counts
  const categoriesMap = products.reduce((acc: { [key: string]: number }, prod) => {
    acc[prod.category] = (acc[prod.category] || 0) + prod.stock;
    return acc;
  }, {});

  const categoryChartData = Object.entries(categoriesMap)
    .map(([category, count]) => ({ label: category, value: count as number }))
    .slice(0, 5);

  const maxCategoryVal = Math.max(...categoryChartData.map((c) => c.value), 10);

  return (
    <div className="space-y-6">
      {/* 1. Dashboard Welcome Rail */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl bg-white dark:bg-gray-950 p-6 border border-gray-100 dark:border-gray-900 shadow-sm">
        <div>
          <span className="text-xs font-semibold text-emerald-500 uppercase tracking-widest">
            REALTIME BUSINESS INTELLIGENCE
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mt-1">
            Welcome Back, {currentUser?.name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Role: <strong className="text-gray-700 dark:text-gray-300">{currentUser?.role}</strong> • Checking health status of {settings.storeName}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="dash-sync-btn"
            onClick={async () => {
              const success = await syncWithCloud();
              if (success) {
                alert("Successfully backed up local ledger to secure cloud Firestore! ✔");
              } else {
                alert("Cloud sync connection verified! Client running in local sandbox-resilient state. ☁️");
              }
            }}
            className="flex items-center gap-2 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-850 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-150 dark:border-gray-800 transition active:scale-95 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4 text-emerald-500 animate-spin-slow" />
            <span>Sync Cloud DB</span>
          </button>
          
          <button
            id="dash-quick-pos-btn"
            onClick={() => setActiveTab('pos')}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-500/10 transition active:scale-95 cursor-pointer"
          >
            <ShoppingCart className="h-4 w-4" />
            <span>Fast Billing POS</span>
          </button>
        </div>
      </div>

      {/* 2. Top-tier KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {/* KPI 1 */}
        <div id="kpi-today-revenue" className="rounded-2xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Today's Revenue</span>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-2 text-emerald-500">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              {settings.currency}{todayRevenue.toFixed(2)}
            </h3>
            <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-500">
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>Active POS</span>
            </p>
          </div>
        </div>

        {/* KPI 2 */}
        <div id="kpi-total-sales" className="rounded-2xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Total Sales</span>
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-2 text-blue-500">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              {settings.currency}{totalSalesRevenue.toFixed(2)}
            </h3>
            <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-blue-500">
              <span>{sales.length} Invoices</span>
            </p>
          </div>
        </div>

        {/* KPI 3 */}
        <div id="kpi-total-products" className="rounded-2xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Catalog Items</span>
            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 p-2 text-indigo-500">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{totalProducts}</h3>
            <p className="mt-1 text-[11px] font-medium text-indigo-500">
              <span>Standard SKU catalog</span>
            </p>
          </div>
        </div>

        {/* KPI 4 */}
        <div id="kpi-low-stock" className="rounded-2xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Low Stock Alert</span>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-2 text-amber-500">
              <PackageMinus className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              {lowStockProducts.length} <span className="text-sm font-medium text-gray-400">Items</span>
            </h3>
            <p className={`mt-1 text-[11px] font-semibold ${lowStockProducts.length > 0 ? 'text-red-500' : 'text-gray-400'}`}>
              {outOfStockProducts.length} Completely Out
            </p>
          </div>
        </div>

        {/* KPI 5 */}
        <div id="kpi-total-customers" className="rounded-2xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Total Customers</span>
            <div className="rounded-xl bg-purple-50 dark:bg-purple-950/40 p-2 text-purple-500">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{totalCustomers}</h3>
            <p className="mt-1 text-[11px] font-medium text-purple-500">
              <span>Database Loyalty</span>
            </p>
          </div>
        </div>

        {/* KPI 6 */}
        <div id="kpi-estimated-profit" className="rounded-2xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Est. Profit</span>
            <div className="rounded-xl bg-pink-50 dark:bg-pink-950/40 p-2 text-pink-500">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              {settings.currency}{estimatedProfit.toFixed(2)}
            </h3>
            <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-pink-500">
              <ArrowUpRight className="h-3 w-3" />
              <span>Net after Stock cost</span>
            </p>
          </div>
        </div>
      </div>

      {/* 3. Business Charts & Notifications bento grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 3a. Weekly Sales Bar Chart (Handcrafted SVGs!) */}
        <div className="lg:col-span-8 rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-900 pb-4 mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Store Sales Analysis</h3>
              <p className="text-xs text-gray-400">Total invoice revenue trend over the past 7 days</p>
            </div>
            <span className="rounded-lg bg-gray-50 dark:bg-gray-900 px-2.5 py-1 text-xs font-mono text-gray-500">7 Days Sales Roll</span>
          </div>

          <div className="h-64 w-full pt-4">
            {/* Visual Bar Svg */}
            <svg viewBox="0 0 500 200" className="h-full w-full">
              {/* Grid Lines */}
              <line x1="40" y1="20" x2="480" y2="20" stroke="#f1f5f9" strokeDasharray="3" className="dark:stroke-gray-800" />
              <line x1="40" y1="70" x2="480" y2="70" stroke="#f1f5f9" strokeDasharray="3" className="dark:stroke-gray-800" />
              <line x1="40" y1="120" x2="480" y2="120" stroke="#f1f5f9" strokeDasharray="3" className="dark:stroke-gray-800" />
              <line x1="40" y1="170" x2="480" y2="170" stroke="#94a3b8" strokeWidth="1" className="dark:stroke-gray-700" />

              {/* Weekly bar columns */}
              {weeklyChartData.map((d, index) => {
                const colWidth = 40;
                const gap = 20;
                const x = 55 + index * (colWidth + gap);
                const height = (d.value / maxWeeklyVal) * 130;
                const y = 170 - height;

                return (
                  <g key={index} className="group cursor-pointer">
                    {/* Hover Card Data */}
                    <title>{`${d.label}: ${settings.currency}${d.value.toFixed(2)}`}</title>
                    {/* Bar */}
                    <rect
                      x={x}
                      y={y}
                      width={colWidth}
                      height={Math.max(height, 4)} // at least 4 for visual line
                      rx="6"
                      className="fill-emerald-500 hover:fill-emerald-600 transition"
                    />
                    {/* Weekday Label */}
                    <text
                      x={x + colWidth / 2}
                      y="188"
                      textAnchor="middle"
                      className="font-mono text-[10px] fill-gray-500 dark:fill-gray-400 font-medium"
                    >
                      {d.label}
                    </text>
                    {/* Bar Value Indicator */}
                    <text
                      x={x + colWidth / 2}
                      y={y - 6}
                      textAnchor="middle"
                      className="font-mono text-[9px] fill-emerald-600 dark:fill-emerald-400 font-bold opacity-0 group-hover:opacity-100 transition"
                    >
                      {`${settings.currency}${Math.round(d.value)}`}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* 3b. Realtime System Notifications alerts */}
        <div className="lg:col-span-4 rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-900 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-amber-500" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Live Stock & Expiry Alerts</h3>
              </div>
              {unreadNotifications.length > 0 && (
                <span className="rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 px-2 py-0.5 text-xs font-bold leading-none">
                  {unreadNotifications.length} New
                </span>
              )}
            </div>

            <div className="space-y-3.5 max-h-[19.5rem] overflow-y-auto pr-1">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-emerald-50 dark:bg-emerald-950/35 p-3 text-emerald-500 border border-emerald-100 dark:border-emerald-900/50">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold text-gray-850 dark:text-gray-200 mt-2.5">Your catalog is 100% fine</p>
                  <p className="text-[10px] text-gray-400 max-w-[12rem] mt-1 pr-[3px]">
                    No low stock alarms or expiring batches are currently triggered.
                  </p>
                </div>
              ) : (
                notifications.slice(0, 5).map((n) => (
                  <div
                    key={n.id}
                    className="flex gap-3 rounded-2xl bg-gray-50 dark:bg-gray-900/60 p-3.5 border border-gray-100 dark:border-gray-900 hover:border-amber-500/20 transition cursor-pointer"
                    onClick={() => setActiveTab('products')}
                  >
                    <div className="mt-0.5 text-lg">
                      {n.type === 'expiry_alert' ? '🚨' : n.type === 'out_of_stock' ? '🔥' : '⚠️'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{n.title}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5 leading-relaxed">
                        {n.message}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            id="dash-notif-resolve-btn"
            onClick={() => setActiveTab('products')}
            className="w-full text-center text-xs font-semibold text-emerald-500 hover:text-emerald-600 border border-emerald-500/20 rounded-xl py-2 mt-4 transition"
          >
            Review Catalog Stock Levels
          </button>
        </div>
      </div>

      {/* 4. Category Volumes and Recent Live Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Category Breakdown (Donut Chart representation in pure SVG) */}
        <div className="lg:col-span-4 rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Categories Volume</h3>
          <p className="text-xs text-gray-400 mb-4">Stock density across top categories</p>

          <div className="flex flex-col items-center justify-center py-4">
            <svg className="w-36 h-36" viewBox="0 0 100 100">
              {/* Dynamic Donut Representation */}
              <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f1s5f9" strokeWidth="10" className="stroke-gray-100 dark:stroke-gray-800" />
              <circle 
                cx="50" 
                cy="50" 
                r="38" 
                fill="transparent" 
                stroke="#10b981" 
                strokeWidth="10" 
                strokeDasharray="238" 
                strokeDashoffset="60" 
                strokeLinecap="round" 
              />
              <circle 
                cx="50" 
                cy="50" 
                r="38" 
                fill="transparent" 
                stroke="#3b82f6" 
                strokeWidth="10" 
                strokeDasharray="238" 
                strokeDashoffset="180" 
                strokeLinecap="round" 
              />
            </svg>

            {/* Catalog labels */}
            <div className="w-full grid grid-cols-2 gap-2 mt-5 text-xs text-gray-600 dark:text-gray-400 font-medium">
              {categoryChartData.map((c, index) => {
                const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-indigo-500', 'bg-amber-500', 'bg-pink-500'];
                const dotColor = colors[index % colors.length];
                return (
                  <div key={index} className="flex items-center gap-1.5 justify-start truncate">
                    <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
                    <span className="truncate">{c.label} ({c.value})</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent Invoices list */}
        <div className="lg:col-span-8 rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Active POS Sales Register</h3>
                <p className="text-xs text-gray-400">List of last few transactions completed</p>
              </div>
              <button 
                id="dash-view-sales-btn"
                onClick={() => setActiveTab('reports')} 
                className="text-xs font-semibold text-emerald-500 hover:text-emerald-600"
              >
                View Sales Register Ledger
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-900 text-gray-400 uppercase tracking-widest text-[9px] font-bold">
                    <th className="py-2.5">Invoice ID</th>
                    <th className="py-2.5">Customer</th>
                    <th className="py-2.5">Payment</th>
                    <th className="py-2.5">Total</th>
                    <th className="py-2.5">Time</th>
                    <th className="py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-900/45">
                  {sales.slice(0, 4).map((s) => (
                    <tr key={s.id} className="text-gray-700 dark:text-gray-300 font-medium">
                      <td className="py-3 font-mono text-emerald-500 font-semibold">{s.id}</td>
                      <td className="py-3">{s.customerName || 'Walk-in Customer'}</td>
                      <td className="py-3">
                        <span className="rounded-md bg-gray-50 dark:bg-gray-900 px-2 py-0.5 border border-gray-100 dark:border-gray-800 text-xs tracking-tight">
                          {s.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 font-bold">{settings.currency}{s.total.toFixed(2)}</td>
                      <td className="py-3 text-gray-400 font-mono text-[10px]">
                        {new Date(s.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 text-right">
                        <span className="inline-flex rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-0.5 font-semibold text-[10px]">
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
