/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Plus, Search, Edit2, Trash2, Trophy, Coins, Wallet, History, X 
} from 'lucide-react';
import { useAppState } from '../lib/stateContext';
import { Customer } from '../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { getBusinessMode } from '../lib/businessMode';

export const CustomerManagement: React.FC = () => {
  const { customers, addCustomer, editCustomer, deleteCustomer, sales, settings, activeStore, triggerToast } = useAppState();
  const isServiceBusiness = getBusinessMode(activeStore.configuration?.businessType || settings.businessType) === 'Service';

  const [search, setSearch] = useState<string>('');
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<Customer | null>(null);

  // Form states
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [customerType, setCustomerType] = useState<'Individual' | 'Business'>('Business');
  const [gstNumber, setGstNumber] = useState<string>('');
  const [panNumber, setPanNumber] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [stateCode, setStateCode] = useState<string>('');
  const [billingAddress, setBillingAddress] = useState<string>('');
  const [shippingAddress, setShippingAddress] = useState<string>('');
  const [loyaltyPoints, setLoyaltyPoints] = useState<string>('0');
  const [outstandingDue, setOutstandingDue] = useState<string>('0');

  // Delete & Settle modal states
  const [custToDelete, setCustToDelete] = useState<Customer | null>(null);
  const [custToSettle, setCustToSettle] = useState<Customer | null>(null);
  const [settleAmountInput, setSettleAmountInput] = useState<string>('');

  // Customer transactions history viewer
  const [historyViewerCustomer, setHistoryViewerCustomer] = useState<Customer | null>(null);

  const openAddModal = () => {
    setEditingItem(null);
    setName('');
    setPhone('');
    setEmail('');
    setCompanyName('');
    setCustomerType(isServiceBusiness ? 'Business' : 'Individual');
    setGstNumber('');
    setPanNumber('');
    setState('');
    setStateCode('');
    setBillingAddress('');
    setShippingAddress('');
    setLoyaltyPoints('0');
    setOutstandingDue('0');
    setIsFormOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingItem(c);
    setName(c.name);
    setPhone(c.phone);
    setEmail(c.email || '');
    setCompanyName(c.companyName || '');
    setCustomerType(c.customerType || (isServiceBusiness ? 'Business' : 'Individual'));
    setGstNumber(c.gstNumber || '');
    setPanNumber(c.panNumber || '');
    setState(c.state || '');
    setStateCode(c.stateCode || '');
    setBillingAddress(c.billingAddress || '');
    setShippingAddress(c.shippingAddress || '');
    setLoyaltyPoints(c.loyaltyPoints.toString());
    setOutstandingDue(c.outstandingDue.toString());
    setIsFormOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      triggerToast("Name and phone number are required!", "warning");
      return;
    }

    const payload = {
      name,
      phone,
      email: email || undefined,
      companyName: companyName || undefined,
      customerType,
      gstNumber: gstNumber.trim().toUpperCase() || undefined,
      panNumber: panNumber.trim().toUpperCase() || undefined,
      state: state || undefined,
      stateCode: stateCode || undefined,
      billingAddress: billingAddress || undefined,
      shippingAddress: shippingAddress || undefined,
      loyaltyPoints: parseInt(loyaltyPoints) || 0,
      outstandingDue: parseFloat(outstandingDue) || 0
    };

    if (editingItem) {
      editCustomer(editingItem.id, payload);
      triggerToast(`Customer "${name}" profile updated!`, 'success');
    } else {
      addCustomer(payload);
      triggerToast(`Customer "${name}" registered successfully!`, 'success');
    }
    setIsFormOpen(false);
  };

  const openSettleModal = (cust: Customer) => {
    setCustToSettle(cust);
    setSettleAmountInput(cust.outstandingDue.toString());
  };

  const processSettleDue = () => {
    if (!custToSettle) return;
    const payValue = parseFloat(settleAmountInput) || 0;
    if (payValue <= 0) {
      triggerToast("Please enter a valid positive payment amount!", "warning");
      return;
    }
    const nextDue = Math.max(0, custToSettle.outstandingDue - payValue);
    editCustomer(custToSettle.id, { outstandingDue: nextDue });
    triggerToast(`Settled payment of ${settings.currency}${payValue.toFixed(2)} for ${custToSettle.name}. Remaining due: ${settings.currency}${nextDue.toFixed(2)}! ✔`, 'success');
    setCustToSettle(null);
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    Boolean(c.companyName?.toLowerCase().includes(search.toLowerCase())) ||
    Boolean(c.gstNumber?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-950 p-6 rounded-3xl border border-gray-100 dark:border-gray-900 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-gray-950 dark:text-white">{isServiceBusiness ? 'Client Register' : 'Customer Loyalty Register'}</h2>
          <p className="text-xs text-gray-400">
            {isServiceBusiness
              ? 'Manage client contacts, GST identity, state, billing addresses, invoices, and outstanding balances'
              : 'Manage registered members, loyalty points, and outstanding credit totals'}
          </p>
        </div>

        <button
          id="cust-register-btn"
          onClick={openAddModal}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-5 py-3 text-xs font-semibold text-white shadow-md cursor-pointer cursor-pointer hover:scale-95 transition duration-150"
        >
          <Plus className="h-4 w-4 stroke-[3.5px]" />
          <span>{isServiceBusiness ? 'Add client' : 'Register customer'}</span>
        </button>
      </div>

      {/* Main ledger list */}
      <div className="rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-6 shadow-sm space-y-4">
        
        <div className="relative max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -track-y-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            id="cust-list-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isServiceBusiness ? 'Search by client, company, phone, or GSTIN...' : 'Search by name or phone number...'}
            className="w-full rounded-xl border border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 p-2.5 pl-10 text-xs focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="overflow-x-auto min-h-[14rem]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-105 text-gray-400 uppercase tracking-widest text-[9px] font-bold">
                <th className="py-2.5">{isServiceBusiness ? 'Client / Company' : 'Customer Name'}</th>
                <th className="py-2.5">Contact phone</th>
                {isServiceBusiness ? (
                  <>
                    <th className="py-2.5">GSTIN / PAN</th>
                    <th className="py-2.5">State</th>
                  </>
                ) : (
                  <>
                    <th className="py-2.5 font-mono">Loyalty Stars</th>
                    <th className="py-2.5 font-mono">Accumulated Spend</th>
                  </>
                )}
                <th className="py-2.5 font-mono">outstanding Due Credits</th>
                <th className="py-2.5 text-right">Ledger actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-900/40">
              {filtered.map((c) => {
                const userSales = sales.filter(s => s.customerId === c.id);
                const hasDue = c.outstandingDue > 0;
                return (
                  <tr key={c.id} className="text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50/20">
                    <td className="py-3">
                      <p className="font-bold text-gray-950 dark:text-white">{c.name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {isServiceBusiness ? c.companyName || c.email || 'Individual client' : c.email || 'No email attached'}
                      </p>
                    </td>
                    <td className="py-3 font-mono text-gray-800 dark:text-gray-200">{c.phone}</td>
                    {isServiceBusiness ? (
                      <>
                        <td className="py-3">
                          <p className="font-mono text-[11px]">{c.gstNumber || 'Unregistered'}</p>
                          {c.panNumber && <p className="text-[9px] text-gray-400 mt-0.5">PAN: {c.panNumber}</p>}
                        </td>
                        <td className="py-3">
                          <p>{c.state || 'Not specified'}</p>
                          {c.stateCode && <p className="text-[9px] text-gray-400">Code: {c.stateCode}</p>}
                        </td>
                      </>
                    ) : (
                    <>
                    <td className="py-3 font-mono">
                      <span className="inline-flex items-center gap-1.5 text-amber-500 font-bold">
                        <Trophy className="h-3.5 w-3.5 shrink-0" />
                        <span>{c.loyaltyPoints} Stars</span>
                      </span>
                    </td>
                    <td className="py-3 font-mono text-gray-800 dark:text-gray-200">
                      {settings.currency}{(c.totalSpent || 0).toFixed(2)}
                    </td>
                    </>
                    )}
                    <td className="py-3 font-mono">
                      {hasDue ? (
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-red-500">
                            {settings.currency}{c.outstandingDue.toFixed(2)}
                          </span>
                          <button
                            id={`cust-settle-btn-${c.id}`}
                            onClick={() => openSettleModal(c)}
                            className="bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 rounded-lg px-2 py-0.5 text-[9px] font-bold tracking-tight uppercase cursor-pointer"
                          >
                            Pay settle
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 font-semibold italic">Cleared ✔</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          id={`cust-history-btn-${c.id}`}
                          onClick={() => setHistoryViewerCustomer(c)}
                          title="View user purchase history receipts"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition cursor-pointer"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        
                        <button
                          id={`cust-edit-btn-${c.id}`}
                          onClick={() => openEditModal(c)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition cursor-pointer"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>

                        <button
                          id={`cust-delete-btn-${c.id}`}
                          onClick={() => setCustToDelete(c)}
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

      {/* FORM MODAL: Add/Edit Customers */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-gray-950 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-900 shadow-2xl p-6 relative">
            <button
              onClick={() => setIsFormOpen(false)}
              className="absolute top-4 right-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-black mb-1">
              {editingItem
                ? `Edit ${isServiceBusiness ? 'Client' : 'Customer'}`
                : `Add New ${isServiceBusiness ? 'Client' : 'Customer'}`}
            </h3>
            <p className="text-xs text-gray-450 mb-4">
              {isServiceBusiness ? 'These details can be used for GST invoices and client records.' : 'Store customer and loyalty details.'}
            </p>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {isServiceBusiness && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Client Type</label>
                    <select
                      value={customerType}
                      onChange={(e) => setCustomerType(e.target.value as 'Individual' | 'Business')}
                      className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs"
                    >
                      <option value="Business">Business / Company</option>
                      <option value="Individual">Individual</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Business / Company Name</label>
                    <input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. ABC Technologies Pvt Ltd"
                      className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">{isServiceBusiness ? 'Contact Person' : 'Full Name'}</label>
                <input
                  id="form-cust-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Active Contact Phone</label>
                <input
                  id="form-cust-phone"
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9812345678"
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono text-white"
                />
              </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-slate-500 mb-1">Email address</label>
                <input
                  id="form-cust-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. jdoe@gmail.com"
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs text-white"
                />
              </div>

              {isServiceBusiness && (
                <div>
                  <label className="block text-xs font-semibold mb-1">GSTIN</label>
                  <input
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                    maxLength={15}
                    placeholder="15-character GSTIN"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono uppercase"
                  />
                </div>
              )}
              </div>

              {isServiceBusiness && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">PAN</label>
                      <input
                        value={panNumber}
                        onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                        maxLength={10}
                        placeholder="PAN number"
                        className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">State</label>
                      <input
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="e.g. West Bengal"
                        className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">GST State Code</label>
                      <input
                        value={stateCode}
                        onChange={(e) => setStateCode(e.target.value.replace(/\D/g, '').slice(0, 2))}
                        placeholder="e.g. 19"
                        className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Billing Address</label>
                      <textarea
                        value={billingAddress}
                        onChange={(e) => setBillingAddress(e.target.value)}
                        rows={3}
                        placeholder="Address used on invoices"
                        className="w-full resize-none rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Shipping / Service Address</label>
                      <textarea
                        value={shippingAddress}
                        onChange={(e) => setShippingAddress(e.target.value)}
                        rows={3}
                        placeholder="Optional, if different"
                        className="w-full resize-none rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                {!isServiceBusiness && <div>
                  <label className="block text-xs font-semibold mb-1">Loyalty Stars</label>
                  <input
                    id="form-cust-points"
                    type="number"
                    value={loyaltyPoints}
                    onChange={(e) => setLoyaltyPoints(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono text-white"
                  />
                </div>}

                <div className={isServiceBusiness ? 'col-span-2 sm:col-span-1' : ''}>
                  <label className="block text-xs font-semibold mb-1">Credit Due ({settings.currency})</label>
                  <input
                    id="form-cust-due"
                    type="number"
                    step="0.01"
                    value={outstandingDue}
                    onChange={(e) => setOutstandingDue(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono text-white"
                  />
                </div>
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
                  id="form-cust-submit"
                  type="submit"
                  className="rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 px-5 py-2 text-xs font-bold shadow-md cursor-pointer"
                >
                  {editingItem ? 'Save Changes' : `Add ${isServiceBusiness ? 'Client' : 'Customer'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OVERLAY: Buyer personal Invoice History viewer */}
      {historyViewerCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-gray-950 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-900 shadow-2xl p-6 relative">
            <button
              onClick={() => setHistoryViewerCustomer(null)}
              className="absolute top-4 right-4 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-black mb-1">Receipt Logs history</h3>
            <p className="text-xs text-slate-450 mb-3">Checking invoices created under {historyViewerCustomer.name}</p>

            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {sales.filter(s => s.customerId === historyViewerCustomer.id).length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-10 font-bold">This client holds zero active invoices currently.</p>
              ) : (
                sales.filter(s => s.customerId === historyViewerCustomer.id).map((sale) => (
                  <div key={sale.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 p-3.5 border border-gray-100 dark:border-gray-950 rounded-2xl text-xs space-y-1">
                    <div>
                      <p className="font-mono text-emerald-500 font-bold">POS Bill #{sale.id}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">{new Date(sale.date).toLocaleString()}</p>
                      <p className="text-[10px] text-gray-500 font-semibold">{sale.items.length} Product line lines • payment: {sale.paymentMethod}</p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-gray-900 dark:text-white">{settings.currency}{sale.total.toFixed(2)}</p>
                      <span className="text-[10px] text-emerald-500 font-semibold">Stars accrued: +{sale.loyaltyPointsEarned}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY: Customer Credit Settle Modal */}
      {custToSettle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-gray-950 text-gray-950 dark:text-white border border-gray-100 dark:border-gray-900 shadow-2xl p-6 relative space-y-4">
            <button
              onClick={() => setCustToSettle(null)}
              className="absolute top-4 right-4 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900 transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <h3 className="text-base font-bold">Settle Customer Credit Due</h3>
              <p className="text-xs text-gray-400 mt-0.5">{custToSettle.name} • Total Due: <strong className="text-red-500 font-mono">{settings.currency}{custToSettle.outstandingDue.toFixed(2)}</strong></p>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-500">Payment Amount Received ({settings.currency})</label>
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
                onClick={() => setCustToSettle(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-500 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={processSettleDue}
                className="px-4 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-md cursor-pointer"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Client / Customer Modal */}
      <ConfirmDeleteModal
        isOpen={!!custToDelete}
        title={`Remove ${isServiceBusiness ? 'Client' : 'Customer'} Profile`}
        message={`Are you sure you want to remove ${isServiceBusiness ? 'client' : 'customer'} "${custToDelete?.name}" from this workspace?`}
        itemName={custToDelete?.name}
        onConfirm={() => {
          if (custToDelete) {
            deleteCustomer(custToDelete.id);
            triggerToast(`${isServiceBusiness ? 'Client' : 'Customer'} "${custToDelete.name}" deleted.`, 'success');
            setCustToDelete(null);
          }
        }}
        onClose={() => setCustToDelete(null)}
      />
    </div>
  );
};
