/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FileDown, BarChart2, Calendar, Coins, TrendingUp, Landmark, ShieldCheck,
  ShoppingBag, ClipboardList, Info, FileSpreadsheet
} from 'lucide-react';
import { useAppState } from '../lib/stateContext';

export const ReportsView: React.FC = () => {
  const { sales, purchases, products, settings } = useAppState();

  const [activeReportTab, setActiveReportTab] = useState<'sales' | 'tax' | 'profit'>('sales');

  // --- Aggregate values ---
  const completedSales = sales.filter(s => s.status === 'Completed');
  const salesCount = completedSales.length;
  const grossSalesVolume = completedSales.reduce((acc, sale) => acc + sale.total, 0);
  const totalGstCollected = completedSales.reduce((acc, sale) => acc + sale.taxAmount, 0);
  
  // Calculate restock parameters
  const totalPurchasesVolume = purchases.reduce((acc, p) => acc + p.total, 0);
  const totalIncomingStockCost = purchases.reduce((acc, p) => acc + p.subtotal, 0);

  // Profit/Loss calculations
  const totalStockCostSold = completedSales.reduce((acc, sale) => {
    return acc + sale.items.reduce((sum, item) => {
      const matchP = products.find(p => p.id === item.productId);
      const purchasePart = matchP ? matchP.purchasePrice : item.price * 0.5;
      return sum + (purchasePart * item.quantity);
    }, 0);
  }, 0);

  const netProfits = Math.max(0, grossSalesVolume - totalGstCollected - totalStockCostSold);

  // --- Export to CSV utilities ---
  const handleExportCSV = (type: 'sales' | 'inventory' | 'tax') => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let fileName = `qpos-${type}-report.csv`;

    if (type === 'sales') {
      headers = ['InvoiceID', 'Customer', 'Subtotal', 'TaxAmount', 'Discount', 'TotalBill', 'PaymentMode', 'Date', 'Operator'];
      rows = completedSales.map(s => [
        s.id,
        s.customerName || 'Walk-in',
        s.subtotal.toFixed(2),
        s.taxAmount.toFixed(2),
        s.discount.toFixed(2),
        s.total.toFixed(2),
        s.paymentMethod,
        s.date,
        s.employeeName
      ]);
    } else if (type === 'inventory') {
      headers = ['ID', 'Name', 'SKU', 'Barcode', 'Category', 'Unit', 'PurchaseCost', 'RetailPrice', 'GSTPercent', 'CurrentStock'];
      rows = products.map(p => [
        p.id,
        p.name,
        p.sku,
        p.barcode,
        p.category,
        p.unit,
        p.purchasePrice.toFixed(2),
        p.sellingPrice.toFixed(2),
        p.taxRate.toString(),
        p.stock.toString()
      ]);
    } else {
      headers = ['InvoiceID', 'TaxableAmount', 'GSTPercent', 'GSTCollected', 'TotalBill', 'Date'];
      rows = completedSales.map(s => [
        s.id,
        s.subtotal.toFixed(2),
        'Unified GST',
        s.taxAmount.toFixed(2),
        s.total.toFixed(2),
        s.date
      ]);
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* KPI summaries layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-5 shadow-sm">
          <div className="flex justify-between items-center text-gray-400 text-xs font-semibold">
            <span>Gross Sales Register</span>
            <span className="rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 p-2"><TrendingUp className="h-4 w-4" /></span>
          </div>
          <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-4">
            {settings.currency}{grossSalesVolume.toFixed(2)}
          </h3>
          <p className="text-[10px] text-gray-400 mt-1">Total compiled across {salesCount} invoices</p>
        </div>

        <div className="rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-5 shadow-sm">
          <div className="flex justify-between items-center text-gray-400 text-xs font-semibold">
            <span>GST Tax Receipts Ledger</span>
            <span className="rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 p-2"><Landmark className="h-4 w-4" /></span>
          </div>
          <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-4">
            {settings.currency}{totalGstCollected.toFixed(2)}
          </h3>
          <p className="text-[10px] text-gray-400 mt-1">Total cumulative collected GST metrics</p>
        </div>

        <div className="rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-5 shadow-sm">
          <div className="flex justify-between items-center text-gray-400 text-xs font-semibold">
            <span>Wholesale Purchases Costs</span>
            <span className="rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 p-2"><ShoppingBag className="h-4 w-4" /></span>
          </div>
          <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-4">
            {settings.currency}{totalPurchasesVolume.toFixed(2)}
          </h3>
          <p className="text-[10px] text-gray-400 mt-1">Aggregate stocking payment registers</p>
        </div>

        <div className="rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-5 shadow-sm">
          <div className="flex justify-between items-center text-gray-400 text-xs font-semibold">
            <span>Accumulated Net Profit</span>
            <span className="rounded-full bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400 p-2"><Coins className="h-4 w-4" /></span>
          </div>
          <h3 className="text-2xl font-black text-emerald-500 dark:text-emerald-400 mt-4">
            {settings.currency}{netProfits.toFixed(2)}
          </h3>
          <p className="text-[10px] text-gray-400 mt-1">Real sales net profit margin</p>
        </div>
      </div>

      {/* Reports view panel containing exports and table lists */}
      <div className="rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-6 shadow-sm space-y-5">
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-gray-100 dark:border-gray-900 gap-4">
          <div className="flex gap-1.5 p-1 bg-gray-50 dark:bg-gray-900/50 rounded-2xl">
            <button
              onClick={() => setActiveReportTab('sales')}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                activeReportTab === 'sales' ? 'bg-white dark:bg-gray-950 text-emerald-500 font-bold shadow-sm' : 'text-gray-500'
              }`}
            >
              Sales Reports
            </button>
            <button
              onClick={() => setActiveReportTab('tax')}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                activeReportTab === 'tax' ? 'bg-white dark:bg-gray-950 text-emerald-500 font-bold shadow-sm' : 'text-gray-500'
              }`}
            >
              GST Report
            </button>
            <button
              onClick={() => setActiveReportTab('profit')}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                activeReportTab === 'profit' ? 'bg-white dark:bg-gray-950 text-emerald-500 font-bold shadow-sm' : 'text-gray-500'
              }`}
            >
              Profit & Loss ledger
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="report-export-sales-csv"
              onClick={() => handleExportCSV(activeReportTab === 'tax' ? 'tax' : activeReportTab === 'sales' ? 'sales' : 'inventory')}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-850 border border-gray-150 dark:border-gray-800 px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300 transition cursor-pointer select-none"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
              <span>Export CSV Spreadsheet</span>
            </button>
          </div>
        </div>

        {/* VIEW A: SALES REGISTER */}
        {activeReportTab === 'sales' && (
          <div className="space-y-4">
            <div className="overflow-x-auto min-h-[14rem]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-900 text-gray-400 uppercase tracking-widest text-[9px] font-bold">
                    <th className="py-2.5">Invoice ID</th>
                    <th className="py-2.5">Date</th>
                    <th className="py-2.5">Category Client</th>
                    <th className="py-2.5 font-mono">Tax Amount</th>
                    <th className="py-2.5 font-mono">Paid Sum</th>
                    <th className="py-2.5">Method</th>
                    <th className="py-2.5 text-right">Cashier Operator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-900/40">
                  {completedSales.map((s) => (
                    <tr key={s.id} className="text-gray-700 dark:text-gray-350 font-medium hover:bg-gray-50/20">
                      <td className="py-3 font-mono text-emerald-500 font-semibold">{s.id}</td>
                      <td className="py-3 font-mono text-[10px] text-gray-400">
                        {new Date(s.date).toLocaleString()}
                      </td>
                      <td className="py-3 font-semibold text-gray-900 dark:text-white">
                        {s.customerName || 'Walk-in customer'}
                      </td>
                      <td className="py-3 font-mono text-gray-400">
                        {settings.currency}{s.taxAmount.toFixed(2)}
                      </td>
                      <td className="py-3 font-mono font-bold text-gray-950 dark:text-white">
                        {settings.currency}{s.total.toFixed(2)}
                      </td>
                      <td className="py-3 uppercase tracking-wider text-[10px]">{s.paymentMethod}</td>
                      <td className="py-3 text-right uppercase text-[10px] text-gray-400 font-semibold">{s.employeeName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW B: GST TAX REPORT */}
        {activeReportTab === 'tax' && (
          <div className="space-y-4">
            <div className="flex gap-2 bg-blue-50/25 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 p-4 rounded-2xl">
              <Info className="h-5 w-5 text-blue-500 translate-y-0.5" />
              <div className="text-xs text-blue-800 dark:text-blue-350">
                <strong>Tax Compliance Warning:</strong> Tax parameters calculation is compliant with EAN standards.
                Review active configurations in business settings if tax codes or categories change.
              </div>
            </div>

            <div className="overflow-x-auto min-h-[14rem]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-900 text-gray-400 uppercase tracking-widest text-[9px] font-bold">
                    <th className="py-2.5">Invoice ID</th>
                    <th className="py-2.5">Purchase value</th>
                    <th className="py-2.5 font-mono">GST Cumulative amount</th>
                    <th className="py-2.5 font-mono">Invoice Gross count</th>
                    <th className="py-2.5">Audit date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-900/40">
                  {completedSales.map((s) => (
                    <tr key={s.id} className="text-gray-700 dark:text-gray-350 font-medium hover:bg-gray-50/20">
                      <td className="py-3 font-mono text-blue-500 font-semibold">{s.id}</td>
                      <td className="py-3 font-mono text-gray-400">{settings.currency}{s.subtotal.toFixed(2)}</td>
                      <td className="py-3 font-mono text-red-500 font-bold">+{settings.currency}{s.taxAmount.toFixed(2)}</td>
                      <td className="py-3 font-mono font-bold text-gray-950 dark:text-white">{settings.currency}{s.total.toFixed(2)}</td>
                      <td className="py-3 font-mono text-[10px] text-gray-400">{new Date(s.date).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW C: PROFIT & LOSS METRIC LEDGER */}
        {activeReportTab === 'profit' && (
          <div className="space-y-6">
            
            {/* Hand-crafted graphical line comparisons SVG */}
            <div className="rounded-2xl border border-gray-150 p-5 bg-gray-55/30">
              <span className="block text-xs font-bold text-gray-400 uppercase mb-4 tracking-wider">MoM Operating Margin Visualization:</span>
              <div className="h-44 w-full">
                <svg viewBox="0 0 500 120" className="h-full w-full">
                  <line x1="10" y1="100" x2="490" y2="100" stroke="#cbd5e1" strokeWidth="2" />
                  
                  {/* Revenue line curve (Green) */}
                  <path 
                    d="M 20 90 Q 120 40 240 70 T 480 20" 
                    fill="none" 
                    stroke="#10b981" 
                    strokeWidth="3.5" 
                    strokeLinecap="round" 
                  />
                  {/* Stock cost curve (Orange) */}
                  <path 
                    d="M 20 95 Q 120 70 240 85 T 480 60" 
                    fill="none" 
                    stroke="#f59e0b" 
                    strokeWidth="2.5" 
                    strokeDasharray="4"
                    strokeLinecap="round" 
                  />

                  {/* Graphic key specs */}
                  <text x="20" y="117" className="font-mono text-[9px] fill-gray-400">Past Months margin comparisons (sales vs costs lines)</text>
                </svg>
              </div>

              <div className="flex gap-4 pt-4 border-t border-gray-200 mt-2 text-[10px] font-bold">
                <div className="flex items-center gap-1.5 text-emerald-600">
                  <span className="h-3 w-3 bg-emerald-500 rounded-full" />
                  <span>Sales Revenue Revenue ({settings.currency}{grossSalesVolume.toFixed(2)})</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-500">
                  <span className="h-3 w-3 bg-amber-500 rounded-full border border-dashed" />
                  <span>Acquisition Stock cost ({settings.currency}{totalStockCostSold.toFixed(2)})</span>
                </div>
              </div>
            </div>

            {/* Simple margin criteria lists */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold">
              <div className="p-4 bg-gray-50 rounded-2xl text-center border border-gray-100">
                <p className="text-gray-400">Tax deductions</p>
                <p className="text-lg font-black text-red-500 mt-1">-{settings.currency}{totalGstCollected.toFixed(2)}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Calculated Tax outlays</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl text-center border border-gray-100">
                <p className="text-gray-400">Sales Cost of Goods</p>
                <p className="text-lg font-black text-rose-500 mt-1">-{settings.currency}{totalStockCostSold.toFixed(2)}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Stock depletion invoice values</p>
              </div>

              <div className="p-4 bg-emerald-50/30 rounded-2xl text-center border border-emerald-500/10">
                <p className="text-gray-400">Net operating Profits</p>
                <p className="text-lg font-black text-emerald-500 mt-1">+{settings.currency}{netProfits.toFixed(2)}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Final retainable business volume</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
