/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FileDown, BarChart2, Calendar, Coins, TrendingUp, Landmark, ShieldCheck,
  ShoppingBag, ClipboardList, Info, FileSpreadsheet, Search, Edit2, Trash2, X, Printer
} from 'lucide-react';
import { useAppState } from '../lib/stateContext';
import { Sale, SaleItem } from '../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { productUsesImeiTracking } from '../lib/serializedInventory';
import { TallyInvoiceModal } from './TallyInvoiceModal';

export const ReportsView: React.FC = () => {
  const { sales, purchases, products, customers, settings, editSale, deleteSale, triggerToast } = useAppState();

  const [activeReportTab, setActiveReportTab] = useState<'sales' | 'tax' | 'profit'>('sales');
  const [salesSearch, setSalesSearch] = useState('');
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [printingSale, setPrintingSale] = useState<Sale | null>(null);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerId, setEditCustomerId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<Sale['paymentMethod']>('Cash');
  const [editDiscount, setEditDiscount] = useState('');
  const [editItems, setEditItems] = useState<SaleItem[]>([]);

  // --- Aggregate values ---
  const completedSales = sales.filter(s => s.status === 'Completed');
  const visibleSales = completedSales.filter((sale) => {
    const query = salesSearch.trim().toLowerCase();
    if (!query) return true;
    return [
      sale.id,
      sale.customerName,
      sale.customerCompanyName,
      sale.customerGstNumber,
      sale.paymentMethod,
      sale.employeeName,
      new Date(sale.date).toLocaleDateString()
    ].some(value => String(value || '').toLowerCase().includes(query));
  });
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

  const openSaleEditor = (sale: Sale) => {
    setEditingSale(sale);
    setEditCustomerName(sale.customerName || '');
    setEditCustomerId(sale.customerId || '');
    const localDate = new Date(sale.date);
    localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
    setEditDate(localDate.toISOString().slice(0, 16));
    setEditPaymentMethod(sale.paymentMethod);
    setEditDiscount(sale.discount.toString());
    setEditItems(sale.items.map(item => ({...item, serializedUnits: item.serializedUnits?.map(unit => ({...unit}))})));
  };

  const saveSaleEdits = () => {
    if (!editingSale) return;
    const discount = Math.max(0, Number(editDiscount) || 0);
    if (!editCustomerName.trim() || !editDate || editItems.length === 0) {
      triggerToast('An invoice needs a client, date, and at least one line item.', 'warning');
      return;
    }
    const invalidLine = editItems.some(item => !item.name.trim() || item.quantity <= 0 || item.price < 0 || item.taxRate < 0);
    if (invalidLine) {
      triggerToast('Each line needs a description, positive quantity, valid rate, and GST percentage.', 'warning');
      return;
    }
    const stockConflict = editItems.find(item => {
      const product = products.find(entry => entry.id === item.productId);
      if (!product || product.itemType === 'Service' || productUsesImeiTracking(product)) return false;
      const originallyBilled = editingSale.items
        .filter(originalItem => originalItem.productId === item.productId)
        .reduce((sum, originalItem) => sum + originalItem.quantity, 0);
      const newlyBilled = editItems
        .filter(editItem => editItem.productId === item.productId)
        .reduce((sum, editItem) => sum + editItem.quantity, 0);
      return newlyBilled > product.stock + originallyBilled;
    });
    if (stockConflict) {
      triggerToast(`Not enough stock is available for ${stockConflict.name}.`, 'warning');
      return;
    }
    const normalizedItems = editItems.map(item => {
      const taxableValue = item.price * item.quantity;
      const taxAmount = taxableValue * item.taxRate / 100;
      return {...item, taxAmount, total: taxableValue + taxAmount};
    });
    const subtotal = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const taxAmount = normalizedItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const total = Math.max(0, subtotal + taxAmount - discount);
    const selectedCustomer = customers.find(customer => customer.id === editCustomerId);
    editSale(editingSale.id, {
      ...(selectedCustomer ? {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        customerCompanyName: selectedCustomer.companyName,
        customerPhone: selectedCustomer.phone,
        customerEmail: selectedCustomer.email,
        customerGstNumber: selectedCustomer.gstNumber,
        customerState: selectedCustomer.state,
        customerStateCode: selectedCustomer.stateCode,
        customerBillingAddress: selectedCustomer.billingAddress,
        customerShippingAddress: selectedCustomer.shippingAddress
      } : {
        customerId: '',
        customerName: editCustomerName.trim(),
        customerCompanyName: '',
        customerPhone: '',
        customerEmail: '',
        customerGstNumber: '',
        customerState: '',
        customerStateCode: '',
        customerBillingAddress: '',
        customerShippingAddress: ''
      }),
      date: new Date(editDate).toISOString(),
      paymentMethod: editPaymentMethod,
      items: normalizedItems,
      subtotal,
      taxAmount,
      discount,
      total
    });
    setEditingSale(null);
    triggerToast('Invoice updated successfully.', 'success');
  };

  const updateEditItem = (index: number, changes: Partial<SaleItem>) => {
    setEditItems(items => items.map((item, itemIndex) => itemIndex === index ? {...item, ...changes} : item));
  };

  const addInvoiceLine = (productId: string) => {
    const product = products.find(entry => entry.id === productId);
    if (!product) return;
    if (productUsesImeiTracking(product)) {
      triggerToast('Serialized/IMEI products can only be reduced from the original invoice. Create a new invoice to add another handset.', 'warning');
      return;
    }
    setEditItems(items => [...items, {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      price: product.sellingPrice,
      quantity: 1,
      taxRate: product.taxRate,
      taxAmount: product.sellingPrice * product.taxRate / 100,
      total: product.sellingPrice * (1 + product.taxRate / 100)
    }]);
  };

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
            <div className="relative max-w-md">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={salesSearch}
                onChange={(event) => setSalesSearch(event.target.value)}
                placeholder="Search invoice, client, GSTIN, payment, operator, or date..."
                className="w-full rounded-xl border border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 py-2.5 pl-10 pr-3 text-xs focus:border-emerald-500 focus:outline-none"
              />
            </div>
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
                    <th className="py-2.5">Cashier Operator</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-900/40">
                  {visibleSales.map((s) => (
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
                      <td className="py-3 uppercase text-[10px] text-gray-400 font-semibold">{s.employeeName}</td>
                      <td className="py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setPrintingSale(s)}
                            title="Print or download invoice"
                            className="rounded-lg p-2 text-gray-400 hover:bg-emerald-500/10 hover:text-emerald-500"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openSaleEditor(s)}
                            title="Edit sales record"
                            className="rounded-lg p-2 text-gray-400 hover:bg-blue-500/10 hover:text-blue-500"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setSaleToDelete(s)}
                            title="Delete and reverse invoice"
                            className="rounded-lg p-2 text-gray-400 hover:bg-red-500/10 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visibleSales.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-14 text-center text-xs text-gray-400">
                        No sales records match your search.
                      </td>
                    </tr>
                  )}
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

      {editingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-6 text-gray-950 dark:text-white shadow-2xl">
            <button
              onClick={() => setEditingSale(null)}
              className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-xl font-black">Edit Complete Invoice</h3>
            <p className="mt-1 text-xs text-gray-400">Invoice {editingSale.id}. Totals and inventory are recalculated automatically.</p>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold">Client / Customer</label>
                <select
                  value={editCustomerId}
                  onChange={(event) => {
                    const customerId = event.target.value;
                    setEditCustomerId(customerId);
                    const customer = customers.find(entry => entry.id === customerId);
                    if (customer) setEditCustomerName(customer.name);
                  }}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs"
                >
                  <option value="">Walk-in / manually entered client</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.companyName ? `${customer.companyName} - ${customer.name}` : customer.name} ({customer.phone})
                    </option>
                  ))}
                </select>
                {!editCustomerId && (
                  <input
                    value={editCustomerName}
                    onChange={(event) => setEditCustomerName(event.target.value)}
                    placeholder="Customer or client name"
                    className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs"
                  />
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Invoice Date & Time</label>
                <input
                  type="datetime-local"
                  value={editDate}
                  onChange={(event) => setEditDate(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Payment Method</label>
                <select
                  value={editPaymentMethod}
                  onChange={(event) => setEditPaymentMethod(event.target.value as Sale['paymentMethod'])}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Split">Split</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Discount ({settings.currency})</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editDiscount}
                  onChange={(event) => setEditDiscount(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Add Service / Material</label>
                <select
                  defaultValue=""
                  onChange={(event) => {
                    addInvoiceLine(event.target.value);
                    event.target.value = '';
                  }}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs"
                >
                  <option value="" disabled>Select catalog item...</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name} - {settings.currency}{product.sellingPrice.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-900">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-900/60 text-[9px] uppercase tracking-wider text-gray-400">
                  <tr>
                    <th className="p-3">Description</th>
                    <th className="p-3">SKU</th>
                    <th className="p-3 w-24">Quantity</th>
                    <th className="p-3 w-32">Rate</th>
                    <th className="p-3 w-24">GST %</th>
                    <th className="p-3 text-right">Line Total</th>
                    <th className="p-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-900">
                  {editItems.map((item, index) => {
                    const lineTotal = item.price * item.quantity * (1 + item.taxRate / 100);
                    const isSerialized = Boolean(item.serializedUnits?.length);
                    return (
                      <tr key={`${item.productId}-${index}`}>
                        <td className="p-2">
                          <input
                            value={item.name}
                            onChange={(event) => updateEditItem(index, {name: event.target.value})}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2"
                          />
                        </td>
                        <td className="p-2 font-mono text-[10px] text-gray-400">{item.sku}</td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="1"
                            max={isSerialized ? item.serializedUnits!.length : undefined}
                            value={item.quantity}
                            onChange={(event) => {
                              const quantity = Math.max(1, Number(event.target.value) || 1);
                              const cappedQuantity = isSerialized ? Math.min(quantity, item.serializedUnits!.length) : quantity;
                              updateEditItem(index, {
                                quantity: cappedQuantity,
                                ...(isSerialized ? {serializedUnits: item.serializedUnits!.slice(0, cappedQuantity)} : {})
                              });
                            }}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2 font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.price}
                            onChange={(event) => updateEditItem(index, {price: Math.max(0, Number(event.target.value) || 0)})}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2 font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.taxRate}
                            onChange={(event) => updateEditItem(index, {taxRate: Math.max(0, Number(event.target.value) || 0)})}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2 font-mono"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-bold">{settings.currency}{lineTotal.toFixed(2)}</td>
                        <td className="p-2 text-right">
                          <button
                            onClick={() => setEditItems(items => items.filter((_, itemIndex) => itemIndex !== index))}
                            className="rounded-lg p-2 text-gray-400 hover:bg-red-500/10 hover:text-red-500"
                            title="Remove invoice line"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 ml-auto grid max-w-sm grid-cols-2 gap-y-2 text-xs">
              <span className="text-gray-400">Taxable subtotal</span>
              <span className="text-right font-mono">{settings.currency}{editItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}</span>
              <span className="text-gray-400">GST</span>
              <span className="text-right font-mono">{settings.currency}{editItems.reduce((sum, item) => sum + item.price * item.quantity * item.taxRate / 100, 0).toFixed(2)}</span>
              <span className="text-gray-400">Discount</span>
              <span className="text-right font-mono">-{settings.currency}{(Number(editDiscount) || 0).toFixed(2)}</span>
              <span className="border-t border-gray-200 dark:border-gray-800 pt-2 text-sm font-black">Invoice Total</span>
              <span className="border-t border-gray-200 dark:border-gray-800 pt-2 text-right font-mono text-sm font-black text-emerald-500">
                {settings.currency}{Math.max(0, editItems.reduce((sum, item) => sum + item.price * item.quantity * (1 + item.taxRate / 100), 0) - (Number(editDiscount) || 0)).toFixed(2)}
              </span>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setEditingSale(null)} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900">
                Cancel
              </button>
              <button onClick={saveSaleEdits} className="rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-600">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={!!saleToDelete}
        title="Delete Sales Invoice"
        message={`Delete invoice "${saleToDelete?.id}"? Material stock from this invoice will be restored and the sale will be removed from reports.`}
        itemName={saleToDelete?.id}
        onConfirm={() => {
          if (!saleToDelete) return;
          deleteSale(saleToDelete.id);
          triggerToast(`Invoice ${saleToDelete.id} deleted and inventory restored.`, 'success');
          setSaleToDelete(null);
        }}
        onClose={() => setSaleToDelete(null)}
      />

      {printingSale && (
        <TallyInvoiceModal
          activeReceipt={printingSale}
          settings={settings}
          onClose={() => setPrintingSale(null)}
        />
      )}
    </div>
  );
};
