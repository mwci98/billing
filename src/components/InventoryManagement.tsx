/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ArrowRightLeft, AlertTriangle, PackagePlus, Plus, Search,
  Calendar, Users, Eye, History, FileDown, PlusCircle, Sliders
} from 'lucide-react';
import { useAppState } from '../lib/stateContext';

export const InventoryManagement: React.FC = () => {
  const { 
    products, 
    suppliers, 
    purchases, 
    addPurchase, 
    transactions, 
    adjustStock, 
    settings 
  } = useAppState();

  // Active sub tab inside Inventory
  const [invSubTab, setInvSubTab] = useState<'adjust' | 'purchase' | 'logs'>('adjust');

  // Search states
  const [prodSearch, setProdSearch] = useState<string>('');
  const [maxStockFilter, setMaxStockFilter] = useState<number>(100);

  // 1. Manual Adjust Form States
  const [selectedProdId, setSelectedProdId] = useState<string>('');
  const [adjustQty, setAdjustQty] = useState<string>('5');
  const [adjustType, setAdjustType] = useState<'Stock In' | 'Stock Out' | 'Adjustment'>('Stock In');
  const [adjustDesc, setAdjustDesc] = useState<string>('Periodic warehouse physical count adjustment.');

  // 2. Buy Entry Form States (supplier Purchase invoicing)
  const [buySupplierId, setBuySupplierId] = useState<string>('');
  const [buyItems, setBuyItems] = useState<{ productId: string; quantity: number; purchasePrice: number }[]>([]);
  const [activeAddProdId, setActiveAddProdId] = useState<string>('');
  const [activeAddQty, setActiveAddQty] = useState<string>('10');
  const [activeAddCost, setActiveAddCost] = useState<string>('1.00');
  const [payStatus, setPayStatus] = useState<'Paid' | 'Partially Paid' | 'Unpaid'>('Paid');
  const [balanceDue, setBalanceDue] = useState<string>('0');

  // Manual Adjust confirm click
  const handleConfirmAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProdId || !adjustQty) {
      alert("Please specify product and quantity!");
      return;
    }
    const qty = parseInt(adjustQty) || 0;
    if (qty <= 0) {
      alert("Quantity must be greater than zero!");
      return;
    }
    adjustStock(selectedProdId, qty, adjustType, adjustDesc);
    alert("Inventory adjustment registered successfully! Stock is corrected. ✔");
    setSelectedProdId('');
    setAdjustQty('5');
    setAdjustDesc('Periodic warehouse physical count adjustment.');
  };

  // Add temp line to purchase invoice
  const handleAddTempPurchaseLine = () => {
    if (!activeAddProdId || !activeAddQty) {
      alert("Please specify line item product and incoming quantity!");
      return;
    }
    const p = products.find(prod => prod.id === activeAddProdId);
    if (!p) return;

    setBuyItems([...buyItems, {
      productId: activeAddProdId,
      quantity: parseInt(activeAddQty) || 1,
      purchasePrice: parseFloat(activeAddCost) || p.purchasePrice
    }]);

    setActiveAddProdId('');
    setActiveAddQty('10');
    setActiveAddCost('1.00');
  };

  const handleRemoveTempPurchaseLine = (idx: number) => {
    setBuyItems(buyItems.filter((_, i) => i !== idx));
  };

  // Compile final purchase incoming
  const handleSubmitPurchaseBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!buySupplierId) {
      alert("Please select a registered B2B Supplier!");
      return;
    }
    if (buyItems.length === 0) {
      alert("Your restocking bill sheet has no line items!");
      return;
    }

    const supplierRef = suppliers.find(s => s.id === buySupplierId);
    const supplierName = supplierRef ? supplierRef.name : 'Unknown distributor';

    // Calculate sum aggregates
    const subtotal = buyItems.reduce((sum, item) => sum + (item.purchasePrice * item.quantity), 0);
    const taxAmount = subtotal * 0.12; // Flat 12% purchase invoices fallback
    const total = subtotal + taxAmount;
    const dueAmount = payStatus === 'Paid' ? 0 : payStatus === 'Unpaid' ? total : parseFloat(balanceDue) || total * 0.5;

    // Convert items to purchases standard
    const itemsPayload = buyItems.map((item) => {
      const p = products.find(prod => prod.id === item.productId);
      return {
        productId: item.productId,
        name: p ? p.name : 'Unknown Product',
        quantity: item.quantity,
        purchasePrice: item.purchasePrice,
        taxRate: 12,
        taxAmount: item.purchasePrice * item.quantity * 0.12,
        total: (item.purchasePrice * item.quantity) * 1.12
      };
    });

    addPurchase({
      supplierId: buySupplierId,
      supplierName,
      items: itemsPayload,
      subtotal,
      taxAmount,
      total,
      status: 'Received',
      paymentStatus: payStatus,
      dueAmount
    });

    alert(`Restock Purchase bill created successfully! New quantities entered. Invoice aggregate: ${settings.currency}${total.toFixed(2)} ✔`);
    setBuySupplierId('');
    setBuyItems([]);
  };

  return (
    <div className="space-y-6">
      
      {/* Tab toggle buttons bar */}
      <div className="flex flex-col md:flex-row shadow-sm rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-3 items-center justify-between gap-4">
        <div className="flex gap-1 bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-2xl w-full md:w-auto">
          <button
            onClick={() => setInvSubTab('adjust')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
              invSubTab === 'adjust' ? 'bg-white dark:bg-gray-950 text-emerald-500 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <ArrowRightLeft className="h-4 w-4" />
            <span>Stock Corrections</span>
          </button>
          
          <button
            onClick={() => setInvSubTab('purchase')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
              invSubTab === 'purchase' ? 'bg-white dark:bg-gray-950 text-emerald-500 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <PackagePlus className="h-4 w-4" />
            <span>Restocking Purchase</span>
          </button>

          <button
            onClick={() => setInvSubTab('logs')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition ${
              invSubTab === 'logs' ? 'bg-white dark:bg-gray-950 text-emerald-500 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Audit Ledger</span>
          </button>
        </div>

        <span className="text-[10px] font-mono bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 px-3 py-1 rounded-full border border-amber-500/10 font-bold uppercase tracking-wider flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" /> Expiry Trackers Active
        </span>
      </div>

      {/* VIEW A: MANUAL ADJUSTMENTS */}
      {invSubTab === 'adjust' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <form onSubmit={handleConfirmAdjust} className="md:col-span-5 rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gray-950 dark:text-white">Correct Stock on-Shelf</h3>
              <p className="text-xs text-gray-400">Manual stock-in, stock-out, or absolute adjustments logging</p>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Select Target Product</label>
              <select
                id="adjust-product-select"
                required
                value={selectedProdId}
                onChange={(e) => setSelectedProdId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs text-gray-900 dark:text-white"
              >
                <option value="" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">-- Choose item --</option>
                {products.map(prod => (
                  <option key={prod.id} value={prod.id} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                    {prod.name} (On-Shelf: {prod.stock} {prod.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 col-span-1">Action Type</label>
                <select
                  id="adjust-type-select"
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs text-gray-900 dark:text-white"
                >
                  <option value="Stock In">Stock In (+Add)</option>
                  <option value="Stock Out">Stock Out (-Deduct)</option>
                  <option value="Adjustment">Set Absolute (=Set)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Count Units</label>
                <input
                  id="adjust-qty-input"
                  type="number"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Audit Description Reason</label>
              <textarea
                id="adjust-desc-input"
                rows={3}
                value={adjustDesc}
                onChange={(e) => setAdjustDesc(e.target.value)}
                placeholder="Write specific reasons (e.g. Broken loaf disposed, annual recount align...)"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2 text-xs text-gray-900 dark:text-white"
              />
            </div>

            <button
              id="confirm-adjust-btn"
              type="submit"
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white p-3 text-xs font-extrabold cursor-pointer transition shadow-md shadow-emerald-600/20"
            >
              Log Stock Correction
            </button>
          </form>

          {/* Quick list of stock levels */}
          <div className="md:col-span-7 rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-6 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-gray-100 dark:border-gray-900">
              <h3 className="text-sm font-bold text-gray-850 dark:text-white uppercase tracking-wider">Stock Shelf Quick-Gauge</h3>
              
              {/* Interactive Stock Range Filter Slider */}
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800">
                <Sliders className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 font-mono whitespace-nowrap">
                  Max Stock: {maxStockFilter}
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={maxStockFilter}
                  onChange={(e) => setMaxStockFilter(parseInt(e.target.value) || 0)}
                  className="w-24 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  title="Slide to filter stock count limit"
                />
              </div>
            </div>

            <div className="space-y-3 max-h-[19rem] overflow-y-auto">
              {products.filter(p => p.stock <= maxStockFilter).length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400 font-medium">
                  No items found with stock ≤ {maxStockFilter} units.
                </div>
              ) : (
                products.filter(p => p.stock <= maxStockFilter).map(prod => {
                  const nearLow = prod.stock <= prod.lowStockAlert;
                  return (
                  <div key={prod.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 bg-opacity-40 p-3 rounded-2xl border border-gray-100 dark:border-gray-900 text-xs">
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-gray-850 dark:text-gray-100">{prod.name}</p>
                      <p className="font-mono text-[10px] text-gray-400 mt-0.5">SKU: {prod.sku}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className={`font-mono font-bold ${nearLow ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {prod.stock} {prod.unit}s
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Alert limit: {prod.lowStockAlert}</p>
                      </div>

                      <div className="flex items-center gap-1 pl-2 border-l border-gray-200 dark:border-gray-800">
                        <button
                          type="button"
                          onClick={() => adjustStock(prod.id, Math.max(0, prod.stock - 1), 'Adjustment', 'Quick gauge stock decrease')}
                          className="h-6 w-6 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 font-black text-xs cursor-pointer select-none"
                          title="Decrease stock count by 1"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustStock(prod.id, prod.stock + 1, 'Adjustment', 'Quick gauge stock increase')}
                          className="h-6 w-6 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 font-black text-xs cursor-pointer select-none"
                          title="Increase stock count by 1"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW B: B2B PURCHASE RESTOCKS */}
      {invSubTab === 'purchase' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleSubmitPurchaseBill} className="lg:col-span-12 rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-6 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-12 border-b border-gray-100 dark:border-gray-900 pb-3">
              <h3 className="text-lg font-bold text-gray-950 dark:text-white">Distributors Restocking Entry</h3>
              <p className="text-xs text-gray-400">Add batches of incoming quantities of products supplied by regular Vendors</p>
            </div>

            {/* Select Supplier */}
            <div className="md:col-span-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">1. Select supplier company</label>
                <select
                  id="pur-supplier-select"
                  required
                  value={buySupplierId}
                  onChange={(e) => setBuySupplierId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs text-gray-900 dark:text-white"
                >
                  <option value="">-- Choose Distributor --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.companyName})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Payment Settlement Status</label>
                <select
                  id="pur-payment-status"
                  value={payStatus}
                  onChange={(e) => setPayStatus(e.target.value as any)}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs text-gray-900 dark:text-white"
                >
                  <option value="Paid">Fully Paid (Settled)</option>
                  <option value="Unpaid">Unpaid (Post Credit)</option>
                  <option value="Partially Paid">Partially Paid</option>
                </select>
              </div>

              {payStatus === 'Partially Paid' && (
                <div>
                  <label className="block text-xs font-semibold mb-1">Enter outstanding Due Balance</label>
                  <input
                    type="number"
                    value={balanceDue}
                    onChange={(e) => setBalanceDue(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-205 bg-gray-50 p-2.5 text-xs font-mono text-gray-700"
                  />
                </div>
              )}
            </div>

            {/* Restock items sheet editor (Add block) */}
            <div className="md:col-span-8 bg-gray-50 dark:bg-gray-900 bg-opacity-30 rounded-2xl border border-gray-100 dark:border-gray-900 p-5 space-y-4">
              <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">2. Create restock ledger details:</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 pt-0.5">
                <div className="sm:col-span-6">
                  <label className="block text-[10px] font-medium text-gray-400">Choice Product</label>
                  <select
                    id="pur-add-prod-select"
                    value={activeAddProdId}
                    onChange={(e) => setActiveAddProdId(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-905 p-2 text-xs text-white"
                  >
                    <option value="">-- Choose --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-medium text-gray-400">Arrival Units</label>
                  <input
                    id="pur-add-qty"
                    type="number"
                    value={activeAddQty}
                    onChange={(e) => setActiveAddQty(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-905 p-2 text-xs font-mono text-white"
                  />
                </div>

                <div className="sm:col-span-3 flex items-end">
                  <button
                    id="pur-add-line-temp-btn"
                    type="button"
                    onClick={handleAddTempPurchaseLine}
                    className="w-full text-center py-2.5 rounded-xl border border-dashed border-emerald-500 hover:bg-emerald-50 text-emerald-500 font-bold text-xs cursor-pointer select-none"
                  >
                    + Add row
                  </button>
                </div>
              </div>

              {/* Temp details tabular list */}
              <div className="border-t border-gray-100 dark:border-gray-850 pt-3">
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 mb-2">Restock Invoice Preview Ledger</span>
                
                {buyItems.length === 0 ? (
                  <p className="text-center text-[11px] text-gray-400 py-6">Invoice lines empty. Add item rows above.</p>
                ) : (
                  <div className="space-y-2">
                    {buyItems.map((item, index) => {
                      const p = products.find(prod => prod.id === item.productId);
                      return (
                        <div key={index} className="flex justify-between items-center text-xs bg-white dark:bg-gray-950 px-3 py-2 border border-gray-50 dark:border-gray-900 rounded-xl">
                          <span className="font-bold text-gray-800 dark:text-gray-200 truncate pr-2 flex-1">{p ? p.name : 'Unknown'}</span>
                          <span className="font-mono text-gray-450 mr-6">Units: {item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTempPurchaseLine(index)}
                            className="text-red-500 font-semibold hover:bg-red-50 p-1 rounded"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 dark:border-gray-850 pt-3 flex justify-end">
                <button
                  id="submit-pur-bill-btn"
                  type="submit"
                  disabled={buyItems.length === 0}
                  className="rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-3 px-6 text-xs shadow-md shadow-emerald-500/10 cursor-pointer"
                >
                  Post restock purchase record
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* VIEW C: SYSTEM AUDIT LOGS LEDGER */}
      {invSubTab === 'logs' && (
        <div className="rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-6 shadow-sm overflow-hidden space-y-4">
          <div>
            <h3 className="text-lg font-bold text-gray-950 dark:text-white">Active Audits & Stock Movements</h3>
            <p className="text-xs text-gray-450">Complete sequence log registers trace for stock changes</p>
          </div>

          <div className="overflow-x-auto min-h-[14rem]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-gray-400 uppercase tracking-widest text-[9px] font-bold">
                  <th className="py-2.5">Date</th>
                  <th className="py-2.5">Product Details</th>
                  <th className="py-2.5">Action</th>
                  <th className="py-2.5">Qty Change</th>
                  <th className="py-2.5">Stock state</th>
                  <th className="py-2.5">operator details</th>
                  <th className="py-2.5 text-right">notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-900/40">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50/20">
                    <td className="py-3 font-mono text-[10px] text-gray-400">
                      {new Date(tx.date).toLocaleString()}
                    </td>
                    <td className="py-3">
                      <p className="font-bold text-gray-900 dark:text-white truncate max-w-[12rem]">{tx.productName}</p>
                      <p className="font-mono text-[9px] text-gray-400">SKU: {tx.sku}</p>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        tx.type === 'Stock In' || tx.type === 'Purchase Entry'
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                          : tx.type === 'Stock Out'
                          ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                          : 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 font-mono font-bold">
                      {tx.type === 'Stock In' || tx.type === 'Purchase Entry' ? `+` : `-`}
                      {tx.quantity}
                    </td>
                    <td className="py-3 font-mono text-gray-400">
                      {tx.previousStock} → <span className="font-bold text-gray-800 dark:text-gray-200">{tx.newStock}</span>
                    </td>
                    <td className="py-3 uppercase text-[10px] tracking-tight">{tx.operatorName}</td>
                    <td className="py-3 text-right max-w-[14rem] truncate text-gray-400 italic pr-1">
                      {tx.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
