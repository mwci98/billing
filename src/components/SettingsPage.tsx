/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Building2, PhoneCall, Receipt, Landmark, Award, ShieldCheck, 
  HelpCircle, Settings, Save, DownloadCloud, UploadCloud, Info
} from 'lucide-react';
import { useAppState } from '../lib/stateContext';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, products, customers, suppliers, sales, purchases, transactions } = useAppState();

  // Form states initialized with setting configs
  const [storeName, setStoreName] = useState<string>(settings.storeName);
  const [address, setAddress] = useState<string>(settings.address);
  const [phone, setPhone] = useState<string>(settings.phone);
  const [currency, setCurrency] = useState<string>(settings.currency);
  const [gstNumber, setGstNumber] = useState<string>(settings.gstNumber);
  const [loyaltyPointsPerDollar, setLoyaltyPointsPerDollar] = useState<string>(settings.loyaltyPointsPerDollar.toString());
  const [receiptHeader, setReceiptHeader] = useState<string>(settings.receiptHeader);
  const [receiptFooter, setReceiptFooter] = useState<string>(settings.receiptFooter);

  // Status logs
  const [statusMsg, setStatusMsg] = useState<string>('');

  const handleSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      storeName,
      address,
      phone,
      currency,
      gstNumber,
      loyaltyPointsPerDollar: parseFloat(loyaltyPointsPerDollar) || 1,
      receiptHeader,
      receiptFooter
    });
    setStatusMsg('Store settings saved successfully! ✔');
    setTimeout(() => setStatusMsg(''), 4000);
  };

  // Database Backup export utilities
  const handleExportBackup = () => {
    const fullBackup = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      settings,
      products,
      customers,
      suppliers,
      sales,
      purchases,
      transactions
    };

    const strContent = JSON.stringify(fullBackup, null, 2);
    const blob = new Blob([strContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `martpos-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Database backup import utility
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.settings || !parsed.products || !parsed.customers) {
          alert("Invalid backup configuration format! Core tables are missing inside the imported JSON.");
          return;
        }

        // Apply backup values into localStorage database structures
        localStorage.setItem('martpos_settings', JSON.stringify(parsed.settings));
        localStorage.setItem('martpos_products', JSON.stringify(parsed.products));
        localStorage.setItem('martpos_customers', JSON.stringify(parsed.customers));
        if (parsed.suppliers) localStorage.setItem('martpos_suppliers', JSON.stringify(parsed.suppliers));
        if (parsed.sales) localStorage.setItem('martpos_sales', JSON.stringify(parsed.sales));
        if (parsed.purchases) localStorage.setItem('martpos_purchases', JSON.stringify(parsed.purchases));
        if (parsed.transactions) localStorage.setItem('martpos_transactions', JSON.stringify(parsed.transactions));

        alert("Database backup imported successfully! Page will now reload to synchronize values.");
        window.location.reload();
      } catch (err) {
        alert("Verification failed: JSON parse error in imported backup file!");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
      
      {/* Primary configuration column */}
      <form onSubmit={handleSettingsSubmit} className="lg:col-span-8 rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-6 shadow-sm space-y-6">
        <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-950">
          <div>
            <h3 className="text-xl font-black text-gray-950 dark:text-white">Mart Operating Configurations</h3>
            <p className="text-xs text-gray-400">Modify store details, receipt headers/footers, and loyalty points tiers</p>
          </div>
          
          <button
            id="settings-save-btn"
            type="submit"
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm cursor-pointer transition active:scale-95 select-none"
          >
            <Save className="h-4 w-4" />
            <span>Apply Config</span>
          </button>
        </div>

        {statusMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-500/10 text-emerald-600 rounded-xl text-xs font-semibold animate-fade-in flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> <span>{statusMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
          
          {/* Store name */}
          <div>
            <label className="block text-gray-450 mb-1 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Company Store Name
            </label>
            <input
              id="set-store-name"
              type="text"
              required
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs text-white"
            />
          </div>

          {/* Sizing currencies */}
          <div>
            <label className="block text-gray-450 mb-1 flex items-center gap-1.5">
              <Landmark className="h-3.5 w-3.5" /> Currency Symbol Prefer
            </label>
            <input
              id="set-currency"
              type="text"
              required
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="$"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono text-white"
            />
          </div>

          {/* Store Phone */}
          <div>
            <label className="block text-gray-450 mb-1 flex items-center gap-1.5">
              <PhoneCall className="h-3.5 w-3.5" /> Customer Support Phone
            </label>
            <input
              id="set-phone"
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono text-white"
            />
          </div>

          {/* GST Register Taxes */}
          <div>
            <label className="block text-gray-450 mb-1 flex items-center gap-1.5">
              <Landmark className="h-3.5 w-3.5" /> Corporate GSTIN / TAX ID
            </label>
            <input
              id="set-gst"
              type="text"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
              placeholder="e.g. 07AAAAA1111A1Z1"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono text-white"
            />
          </div>

          {/* Loyalty system Multiplier */}
          <div className="sm:col-span-2">
            <label className="block text-gray-450 mb-1 flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-amber-500" /> Reward Multiplier (loyalty points accrued per Currency unit spent)
            </label>
            <input
              id="set-loyalty-multiplier"
              type="number"
              step="0.1"
              value={loyaltyPointsPerDollar}
              onChange={(e) => setLoyaltyPointsPerDollar(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono text-white"
            />
          </div>

          {/* Full address details */}
          <div className="sm:col-span-2">
            <label className="block text-gray-450 mb-1">Company physical Address line</label>
            <input
              id="set-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 p-2.5 text-xs text-white"
            />
          </div>

          {/* Printed receipt greetings custom messages */}
          <div className="sm:col-span-2 border-t border-gray-100 dark:border-gray-900 pt-5 space-y-4">
            <span className="block text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Receipt className="h-4 w-4 text-emerald-500" /> Printable Receipt Settings
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Custom Header Subtitle Quote</label>
                <textarea
                  id="set-receipt-header"
                  rows={2}
                  value={receiptHeader}
                  onChange={(e) => setReceiptHeader(e.target.value)}
                  placeholder="e.g. Welcome to Organic Mart!"
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Invoice Footer Greeting</label>
                <textarea
                  id="set-receipt-footer"
                  rows={2}
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  placeholder="e.g. Thank you! Visit us again."
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2 text-xs text-white"
                />
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Database sync parameters import/export triggers (4 cols) */}
      <div className="lg:col-span-4 rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-6 shadow-sm space-y-5">
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">Import & Export backups</h4>
          <p className="text-[10px] text-gray-400 mt-1">Export, download, and backup your entire catalog datasets offline to local files safely</p>
        </div>

        <div className="space-y-3 pt-2">
          {/* Export database JSON trigger */}
          <button
            id="backup-export-btn"
            onClick={handleExportBackup}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-850 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 py-3.5 text-xs font-bold cursor-pointer transition active:scale-95"
          >
            <DownloadCloud className="h-4.5 w-4.5 text-emerald-500 animate-bounce" />
            <span>Download entire Offline backup</span>
          </button>

          {/* Import database JSON triggers */}
          <div className="relative">
            <label className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-850 border border-gray-200 dark:border-gray-800 text-gray-805 dark:text-gray-200 py-3.5 text-xs font-bold cursor-pointer transition active:scale-95">
              <UploadCloud className="h-4.5 w-4.5 text-blue-500 animate-pulse" />
              <span>Import local backup file</span>
              <input
                id="backup-import-file-selector"
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-900 bg-opacity-40 rounded-2xl text-[10px] font-medium text-gray-400 space-y-2.5">
          <p className="font-bold flex items-center gap-1 text-gray-600 dark:text-gray-300">
            <Info className="h-4 w-4 text-emerald-500" /> offline Database metrics:
          </p>
          <div className="grid grid-cols-2 gap-1.5 font-mono">
            <span>SKU types:</span> <span className="font-bold text-gray-850 dark:text-gray-150">{products.length} registered</span>
            <span>Customers Database:</span> <span className="font-bold text-gray-850 dark:text-gray-150">{customers.length} registered</span>
            <span>B2B Supplies:</span> <span className="font-bold text-gray-850 dark:text-gray-150">{suppliers.length} registered</span>
            <span>Invoice histories:</span> <span className="font-bold text-gray-850 dark:text-gray-150">{sales.length} invoices</span>
          </div>
        </div>
      </div>
    </div>
  );
};
