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
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

export const SupplierManagement: React.FC = () => {
  const { suppliers, addSupplier, editSupplier, deleteSupplier, purchases, settings, triggerToast } = useAppState();

  const [search, setSearch] = useState<string>('');
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<Supplier | null>(null);

  // Form states
  const [name, setName] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [gstNumber, setGstNumber] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [outstandingBalance, setOutstandingBalance] = useState<string>('0');

  // Modal states
  const [suppToDelete, setSuppToDelete] = useState<Supplier | null>(null);
  const [suppToSettle, setSuppToSettle] = useState<Supplier | null>(null);
  const [settleAmountInput, setSettleAmountInput] = useState<string>('');

  // Supplier purchase history pop toggle
  const [historyViewerSupplier, setHistoryViewerSupplier] = useState<Supplier | null>(null);

  const openAddModal = () => {
    setEditingItem(null);
    setName('');
    setCompanyName('');
    setPhone('');
    setEmail('');
    setGstNumber('');
    setAddress('');
    setOutstandingBalance('0');
    setIsFormOpen(true);
  };

  const openEditModal = (s: Supplier) => {
    setEditingItem(s);
    setName(s.name);
    setCompanyName(s.companyName);
    setPhone(s.phone);
    setEmail(s.email || '');
    setGstNumber(s.gstNumber || '');
    setAddress(s.address || '');
    setOutstandingBalance(s.outstandingBalance.toString());
    setIsFormOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !companyName || !phone) {
      triggerToast("Name, company, and phone are essential supplier definitions!", "warning");
      return;
    }

    const payload = {
      name,
      companyName,
      phone,
      email: email || undefined,
      gstNumber: gstNumber || undefined,
      address: address || undefined,
      outstandingBalance: parseFloat(outstandingBalance) || 0
    };

    if (editingItem) {
      editSupplier(editingItem.id, payload);
      triggerToast(`Supplier "${companyName}" details updated!`, 'success');
    } else {
      addSupplier(payload);
      triggerToast(`Supplier "${companyName}" added successfully!`, 'success');
    }
    setIsFormOpen(false);
  };

  const openSettleModal = (supp: Supplier) => {
    setSuppToSettle(supp);
    setSettleAmountInput(supp.outstandingBalance.toString());
  };

  const processSettlePayment = () => {
    if (!suppToSettle) return;
    const payVal = parseFloat(settleAmountInput) || 0;
    if (payVal <= 0) {
      triggerToast("Enter a valid positive payout amount!", "warning");
      return;
    }
    const nextBal = Math.max(0, suppToSettle.outstandingBalance - payVal);
    editSupplier(suppToSettle.id, { outstandingBalance: nextBal });
    triggerToast(`Payout of ${settings.currency}${payVal.toFixed(2)} to ${suppToSettle.companyName} settled. Balance left: ${settings.currency}${nextBal.toFixed(2)}! ✔`, 'success');
    setSuppToSettle(null);
  };

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.companyName.toLowerCase().includes(search.toLowerCase()) ||
    s.phone.includes(search) ||
    (s.gstNumber && s.gstNumber.toLowerCase().includes(search.toLowerCase())) ||
    (s.address && s.address.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-950 p-6 rounded-3xl border border-gray-100 dark:border-gray-900 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-gray-950 dark:text-white">Wholesalers & suppliers ledger</h2>
          <p className="text-xs text-gray-400">Track company contacts, GST numbers, addresses, restocking invoices, and outstanding tallies</p>
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
            placeholder="Search partners by company, GST, phone, address..."
            className="w-full rounded-xl border border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 p-2.5 pl-10 text-xs focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="overflow-x-auto min-h-[14rem]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-105 text-gray-400 uppercase tracking-widest text-[9px] font-bold">
                <th className="py-2.5">Supplier / Company</th>
                <th className="py-2.5">GSTIN / Address</th>
                <th className="py-2.5">Distributor Phone</th>
                <th className="py-2.5">Contact Person</th>
                <th className="py-2.5 font-mono">Outstanding Balance</th>
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
                      <p className="text-[10px] text-gray-400 mt-0.5">{s.email || 'No email registered'}</p>
                    </td>
                    <td className="py-3 max-w-[200px]">
                      {s.gstNumber && (
                        <p className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md inline-block mb-1">
                          GST: {s.gstNumber}
                        </p>
                      )}
                      {s.address ? (
                        <p className="text-[10px] text-gray-400 line-clamp-2">{s.address}</p>
                      ) : (
                        !s.gstNumber && <span className="text-[10px] text-gray-400 italic">No GST/Address</span>
                      )}
                    </td>
                    <td className="py-3 font-mono">{s.phone}</td>
                    <td className="py-3">{s.name}</td>
                    <td className="py-3 font-mono">
                      {hasBalance ? (
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-red-500">
                            {settings.currency}{s.outstandingBalance.toFixed(2)}
                          </span>
                          <button
                            id={`supp-settle-btn-${s.id}`}
                            onClick={() => openSettleModal(s)}
                            className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-lg px-2 py-0.5 text-[9px] font-bold tracking-tight uppercase cursor-pointer"
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
                          onClick={() => setSuppToDelete(s)}
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
                <label className="block text-xs font-semibold mb-1">GST Number (GSTIN)</label>
                <input
                  id="form-supp-gst"
                  type="text"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. 27AAAAA0000A1Z5"
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono text-gray-900 dark:text-white uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Business / Registered Address</label>
                <textarea
                  id="form-supp-address"
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Plot 42, Industrial Area, Sector 5..."
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

      {/* OVERLAY: Supplier Balance Settle Modal */}
      {suppToSettle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-gray-950 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-900 shadow-2xl p-6 relative space-y-4">
            <button
              onClick={() => setSuppToSettle(null)}
              className="absolute top-4 right-4 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <h3 className="text-base font-bold">Settle Supplier Balance</h3>
              <p className="text-xs text-gray-400 mt-0.5">{suppToSettle.companyName} • Balance Due: <strong className="text-red-500 font-mono">{settings.currency}{suppToSettle.outstandingBalance.toFixed(2)}</strong></p>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-500">Payout Amount Paid ({settings.currency})</label>
              <input
                type="number"
                value={settleAmountInput}
                onChange={(e) => setSettleAmountInput(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono font-bold text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSuppToSettle(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-500 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={processSettlePayment}
                className="px-4 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-md cursor-pointer"
              >
                Confirm Payout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Supplier Modal */}
      <ConfirmDeleteModal
        isOpen={!!suppToDelete}
        title="Remove Supplier Company"
        message={`Are you sure you want to remove supplier company "${suppToDelete?.companyName}" from the store register?`}
        itemName={suppToDelete?.companyName}
        onConfirm={() => {
          if (suppToDelete) {
            deleteSupplier(suppToDelete.id);
            triggerToast(`Supplier company "${suppToDelete.companyName}" deleted! ✔`, 'success');
            setSuppToDelete(null);
          }
        }}
        onClose={() => setSuppToDelete(null)}
      />
    </div>
  );
};
