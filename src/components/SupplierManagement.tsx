/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Plus, Search, Edit2, Trash2, Landmark, PhoneCall, History, X 
} from 'lucide-react';
import { useAppState } from '../lib/stateContext';
import { Supplier } from '../types';

export const SupplierManagement: React.FC = () => {
  const { suppliers, addSupplier, editSupplier, deleteSupplier, purchases, settings } = useAppState();

  const [search, setSearch] = useState<string>('');
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<Supplier | null>(null);

  // Form states
  const [name, setName] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [outstandingBalance, setOutstandingBalance] = useState<string>('0');

  // Supplier purchase history pop toggle
  const [historyViewerSupplier, setHistoryViewerSupplier] = useState<Supplier | null>(null);

  const openAddModal = () => {
    setEditingItem(null);
    setName('');
    setCompanyName('');
    setPhone('');
    setEmail('');
    setOutstandingBalance('0');
    setIsFormOpen(true);
  };

  const openEditModal = (s: Supplier) => {
    setEditingItem(s);
    setName(s.name);
    setCompanyName(s.companyName);
    setPhone(s.phone);
    setEmail(s.email || '');
    setOutstandingBalance(s.outstandingBalance.toString());
    setIsFormOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !companyName || !phone) {
      alert("Name, company, and phone are essential supplier definitions!");
      return;
    }

    const payload = {
      name,
      companyName,
      phone,
      email: email || undefined,
      outstandingBalance: parseFloat(outstandingBalance) || 0
    };

    if (editingItem) {
      editSupplier(editingItem.id, payload);
    } else {
      addSupplier(payload);
    }
    setIsFormOpen(false);
  };

  const handleSettlePayments = (supp: Supplier) => {
    const settleAmt = prompt(`Pay Supplier. Outstanding Balance due to "${supp.companyName}" is ${settings.currency}${supp.outstandingBalance.toFixed(2)}.\nEnter payment payout amount:`);
    if (settleAmt === null) return;
    const payVal = parseFloat(settleAmt) || 0;
    if (payVal <= 0) {
      alert("Enter a valid positive payout amount!");
      return;
    }
    const nextBal = Math.max(0, supp.outstandingBalance - payVal);
    editSupplier(supp.id, { outstandingBalance: nextBal });
    alert(`Vendor checkout payout of ${settings.currency}{payVal.toFixed(2)} settled. Balance left: ${settings.currency}${nextBal.toFixed(2)}! ✔`);
  };

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.companyName.toLowerCase().includes(search.toLowerCase()) ||
    s.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-950 p-6 rounded-3xl border border-gray-100 dark:border-gray-900 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-gray-950 dark:text-white">Wholesalers & suppliers ledger</h2>
          <p className="text-xs text-gray-400">Track company contacts, restocking invoices total balances, and cash outstanding tallies</p>
        </div>

        <button
          id="supp-add-btn"
          onClick={openAddModal}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-5 py-3 text-xs font-semibold text-white shadow-md cursor-pointer hover:scale-95 transition duration-150"
        >
          <Plus className="h-4 w-4 stroke-[3.5px]" />
          <span>Add B2B Partner</span>
        </button>
      </div>

      {/* List section */}
      <div className="rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-6 shadow-sm space-y-4">
        
        <div className="relative max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -track-y-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            id="supp-list-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search partners by company name, numeric phone..."
            className="w-full rounded-xl border border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 p-2.5 pl-10 text-xs focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="overflow-x-auto min-h-[14rem]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-105 text-gray-400 uppercase tracking-widest text-[9px] font-bold">
                <th className="py-2.5">Supplier Details</th>
                <th className="py-2.5">Distributor phone</th>
                <th className="py-2.5">Company contact</th>
                <th className="py-2.5 font-mono">Outstanding Account balance</th>
                <th className="py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-900/40">
              {filtered.map((s) => {
                const hasBalance = s.outstandingBalance > 0;
                return (
                  <tr key={s.id} className="text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50/20">
                    <td className="py-3">
                      <p className="font-bold text-gray-950 dark:text-white">{s.companyName}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{s.email || 'No email register'}</p>
                    </td>
                    <td className="py-3 font-mono">{s.phone}</td>
                    <td className="py-3">{s.name} (Manager)</td>
                    <td className="py-3 font-mono">
                      {hasBalance ? (
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-red-500">
                            {settings.currency}{s.outstandingBalance.toFixed(2)}
                          </span>
                          <button
                            id={`supp-settle-btn-${s.id}`}
                            onClick={() => handleSettlePayments(s)}
                            className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg px-2 py-0.5 text-[9px] font-bold tracking-tight uppercase"
                          >
                            Pay Payout
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 font-semibold italic">Settled ☕</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          id={`supp-history-btn-${s.id}`}
                          onClick={() => setHistoryViewerSupplier(s)}
                          title="View supplier purchases history bills"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition cursor-pointer"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        
                        <button
                          id={`supp-edit-btn-${s.id}`}
                          onClick={() => openEditModal(s)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition cursor-pointer"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>

                        <button
                          id={`supp-delete-btn-${s.id}`}
                          onClick={() => {
                            if (confirm(`Are you sure you want to remove supplier company "${s.companyName}"?`)) {
                              deleteSupplier(s.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* FORM MODAL: Add/Edit Suppliers */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-gray-950 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-900 shadow-2xl p-6 relative">
            <button
              onClick={() => setIsFormOpen(false)}
              className="absolute top-4 right-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-black mb-1">{editingItem ? 'Edit B2B Partner' : 'Add Wholesale Partner'}</h3>
            <p className="text-xs text-gray-450 mb-4">Complete company criteria specs</p>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Company/Entity Title</label>
                <input
                  id="form-supp-company"
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Bayer Pharma wholesale corp"
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Rep contact full name</label>
                <input
                  id="form-supp-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. David Hasselhoff"
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Distributor Telephone</label>
                <input
                  id="form-supp-phone"
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 1800555019"
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-slate-500 mb-1">Supplier Business Email</label>
                <input
                  id="form-supp-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. wholesale@bayer.be"
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Outstanding account balance ({settings.currency})</label>
                <input
                  id="form-supp-balance"
                  type="number"
                  step="0.01"
                  value={outstandingBalance}
                  onChange={(e) => setOutstandingBalance(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-3 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-semibold border border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  id="form-supp-submit"
                  type="submit"
                  className="rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 px-5 py-2 text-xs font-bold shadow-md cursor-pointer"
                >
                  Save Wholesaler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OVERLAY: Buyer personal Invoice History viewer */}
      {historyViewerSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-gray-950 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-900 shadow-2xl p-6 relative">
            <button
              onClick={() => setHistoryViewerSupplier(null)}
              className="absolute top-4 right-4 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-black mb-1">Restock Purchase histories</h3>
            <p className="text-xs text-slate-450 mb-3">Checking invoices supplied by {historyViewerSupplier.companyName}</p>

            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {purchases.filter(p => p.supplierId === historyViewerSupplier.id).length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-10 font-bold">This vendor has zero active restock bills registered.</p>
              ) : (
                purchases.filter(p => p.supplierId === historyViewerSupplier.id).map((pur) => (
                  <div key={pur.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 p-3.5 border border-gray-100 dark:border-gray-950 rounded-2xl text-xs space-y-1">
                    <div>
                      <p className="font-mono text-blue-500 font-bold">Purchase Bill #{pur.id}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">{new Date(pur.date).toLocaleString()}</p>
                      <p className="text-[10px] text-gray-500 font-semibold">{pur.items.length} Product line rows • Settlement: {pur.paymentStatus}</p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-gray-940 dark:text-white">{settings.currency}{pur.total.toFixed(2)}</p>
                      <span className="text-[10px] text-red-500 font-semibold font-mono">Dues: {settings.currency}{pur.dueAmount.toFixed(2)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
