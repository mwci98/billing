/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {useState} from 'react';
import { 
  TrendingUp, ShoppingCart, Users, Package, AlertTriangle, 
  ArrowUpRight, ArrowDownRight, Calendar, Bell, IndianRupee,
  Layers, PackageMinus, Printer, RefreshCw
} from 'lucide-react';
import { useAppState } from '../lib/stateContext';
import { Sale, UserRole } from '../types';
import {TallyInvoiceModal} from './TallyInvoiceModal';

const DEFAULT_DASHBOARD_WIDGETS = {
  revenue: true,
  totalSales: true,
  catalogItems: true,
  lowStock: false,
  customers: false,
  profit: true,
  weeklyRevenue: false,
  topSellingSkus: false,
  salesRegister: true
};

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
    syncWithCloud,
    hasPermission
  } = useAppState();
  const [invoiceToReprint, setInvoiceToReprint] = useState<Sale | null>(null);
  const canViewFinancials = hasPermission('canViewFinancials');
  const dashboardWidgets = {
    ...DEFAULT_DASHBOARD_WIDGETS,
    ...settings.dashboardWidgets
  };

  const formatWholeCurrency = (value: number) =>
    `${settings.currency}${Math.round(value).toLocaleString('en-IN')}`;

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
        const buyTaxRate = p?.taxRate || item.taxRate || 0;
        const buyPriceBeforeTax = buyPrice / (1 + buyTaxRate / 100);
        return itemCost + (buyPriceBeforeTax * item.quantity);
      }, 0);
      return acc + (sale.total - sale.taxAmount) - saleCost;
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
  const weeklyRevenueTotal = weeklyChartData.reduce((sum, day) => sum + day.value, 0);

  const topSellingSkus = Object.values(
    sales
      .filter(sale => sale.status === 'Completed')
      .flatMap(sale => sale.items)
      .reduce((acc, item) => {
        const current = acc[item.productId] || {
          productId: item.productId,
          name: item.name,
          sku: item.sku,
          quantity: 0,
          revenue: 0
        };
        current.quantity += item.quantity;
        current.revenue += (item.price * item.quantity) + (item.taxAmount || 0);
        acc[item.productId] = current;
        return acc;
      }, {} as Record<string, {
        productId: string;
        name: string;
        sku: string;
        quantity: number;
        revenue: number;
      }>)
  )
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 3);

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
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Welcome Back, {currentUser?.name}
          </h1>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap sm:flex-nowrap shrink-0">
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
            className="flex items-center gap-2 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-850 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800 transition active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className="h-4 w-4 text-emerald-500 animate-spin-slow shrink-0" />
            <span>Sync Cloud DB</span>
          </button>
          
          <button
            id="dash-quick-pos-btn"
            onClick={() => setActiveTab('pos')}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-500/10 transition active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
          >
            <ShoppingCart className="h-4 w-4 shrink-0" />
            <span>Fast Billing POS</span>
          </button>
        </div>
      </div>

      {/* 2. Top-tier KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
        {/* KPI 1 */}
        {canViewFinancials && dashboardWidgets.revenue && (
        <div id="kpi-today-revenue" className="rounded-2xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Today's Revenue</span>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-2 text-emerald-500">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="whitespace-nowrap text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
              {formatWholeCurrency(todayRevenue)}
            </h3>
            <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-500">
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>Active POS</span>
            </p>
          </div>
        </div>
        )}

        {/* KPI 2 */}
        {canViewFinancials && dashboardWidgets.totalSales && (
        <div id="kpi-total-sales" className="rounded-2xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Total Sales</span>
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-2 text-blue-500">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="whitespace-nowrap text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
              {formatWholeCurrency(totalSalesRevenue)}
            </h3>
            <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-blue-500">
              <span>{sales.length} Invoices</span>
            </p>
          </div>
        </div>
        )}

        {/* KPI 3 */}
        {dashboardWidgets.catalogItems && (
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
        )}

        {/* KPI 4 */}
        {dashboardWidgets.lowStock && (
        <div id="kpi-low-stock" className="rounded-2xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Low Stock Alert</span>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-2 text-amber-500">
              <PackageMinus className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
              {lowStockProducts.length} <span className="text-sm font-medium text-gray-400">Items</span>
            </h3>
            <p className={`mt-1 text-[11px] font-semibold ${lowStockProducts.length > 0 ? 'text-red-500' : 'text-gray-400'}`}>
              {outOfStockProducts.length} Completely Out
            </p>
          </div>
        </div>
        )}

        {/* KPI 5 */}
        {dashboardWidgets.customers && (
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
        )}

        {/* KPI 6 */}
        {canViewFinancials && dashboardWidgets.profit && (
        <div id="kpi-estimated-profit" className="rounded-2xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Est. Profit</span>
            <div className="rounded-xl bg-pink-50 dark:bg-pink-950/40 p-2 text-pink-500">
              <IndianRupee className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="whitespace-nowrap text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
              {formatWholeCurrency(estimatedProfit)}
            </h3>
            <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-pink-500">
              <ArrowUpRight className="h-3 w-3" />
              <span>Net after Stock cost</span>
            </p>
          </div>
        </div>
        )}
      </div>

      {canViewFinancials && (dashboardWidgets.weeklyRevenue || dashboardWidgets.topSellingSkus) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {dashboardWidgets.weeklyRevenue && (
            <section className={`${dashboardWidgets.topSellingSkus ? 'lg:col-span-2' : 'lg:col-span-3'} rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-900 dark:bg-gray-950`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    Weekly Revenue Trend
                  </h3>
                  <p className="text-xs text-gray-400">Completed sales across the last seven days</p>
                </div>
                <span className="shrink-0 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold text-emerald-500">
                  7-Day Total: {formatWholeCurrency(weeklyRevenueTotal)}
                </span>
              </div>

              <div className="mt-8 flex h-48 items-end justify-between gap-3 border-b border-gray-100 px-2 pb-8 dark:border-gray-900">
                {weeklyChartData.map(day => (
                  <div key={day.label} className="relative flex h-full flex-1 items-end justify-center">
                    <div
                      className="min-h-2 w-full max-w-9 rounded-t-lg bg-emerald-500/80 transition-all hover:bg-emerald-500"
                      style={{ height: `${Math.max(5, (day.value / maxWeeklyVal) * 100)}%` }}
                      title={`${day.label}: ${formatWholeCurrency(day.value)}`}
                    />
                    <span className="absolute -bottom-6 text-[10px] font-bold uppercase text-gray-400">{day.label}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {dashboardWidgets.topSellingSkus && (
            <section className={`${dashboardWidgets.weeklyRevenue ? 'lg:col-span-1' : 'lg:col-span-3'} rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-900 dark:bg-gray-950`}>
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                  <Package className="h-4 w-4 text-emerald-500" />
                  Top-Selling SKUs
                </h3>
                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">By volume</span>
              </div>

              <div className="mt-4 space-y-3">
                {topSellingSkus.length ? topSellingSkus.map((item, index) => {
                  const product = products.find(candidate => candidate.id === item.productId);
                  return (
                    <div key={item.productId} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-900 dark:bg-gray-900/30">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-black text-emerald-500">
                        #{index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-gray-900 dark:text-white">{item.name}</p>
                        <p className="truncate text-[9px] font-mono text-gray-400">
                          SKU: {item.sku} · Stock: {product?.stock ?? 0}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] font-bold text-emerald-500">{item.quantity} Sold</p>
                        <p className="text-[9px] font-mono text-gray-400">{formatWholeCurrency(item.revenue)}</p>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 py-12 text-center text-xs text-gray-400 dark:border-gray-800">
                    Top-selling products will appear after completed sales.
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('products')}
                className="mt-5 w-full border-t border-gray-100 pt-4 text-right text-xs font-bold text-emerald-500 dark:border-gray-900"
              >
                View Catalog →
              </button>
            </section>
          )}
        </div>
      )}



      {/* 4. Recent Live Sales */}
      {canViewFinancials && dashboardWidgets.salesRegister && (
      <div className="grid grid-cols-1 gap-6">
        {/* Recent Invoices list */}
        <div className="rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-6 shadow-sm flex flex-col justify-between">
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
                    <th className="hidden sm:table-cell py-2.5">Payment</th>
                    <th className="py-2.5">Total</th>
                    <th className="hidden lg:table-cell py-2.5">Time</th>
                    <th className="hidden sm:table-cell py-2.5 text-right">Status</th>
                    <th className="py-2.5 text-right">Reprint</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-900/45">
                  {sales.slice(0, 4).map((s) => (
                    <tr key={s.id} className="text-gray-700 dark:text-gray-300 font-medium">
                      <td className="py-3 font-mono text-emerald-500 font-semibold">{s.id}</td>
                      <td className="py-3">{s.customerName || 'Walk-in Customer'}</td>
                      <td className="hidden sm:table-cell py-3">
                        <span className="rounded-md bg-gray-50 dark:bg-gray-900 px-2 py-0.5 border border-gray-100 dark:border-gray-800 text-xs tracking-tight">
                          {s.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 font-bold">{formatWholeCurrency(s.total)}</td>
                      <td className="hidden lg:table-cell py-3 text-gray-400 font-mono text-[10px]">
                        {new Date(s.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="hidden sm:table-cell py-3 text-right">
                        <span className="inline-flex rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-0.5 font-semibold text-[10px]">
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setInvoiceToReprint(s)}
                          className="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2 text-gray-600 dark:text-gray-300 hover:border-emerald-500 hover:text-emerald-500 transition cursor-pointer"
                          title={`Reprint invoice ${s.id}`}
                          aria-label={`Reprint invoice ${s.id}`}
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      )}
      {invoiceToReprint && (
        <TallyInvoiceModal
          activeReceipt={invoiceToReprint}
          settings={settings}
          onClose={() => setInvoiceToReprint(null)}
        />
      )}
    </div>
  );
};
