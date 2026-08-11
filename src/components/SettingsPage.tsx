/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { 
  Building2, PhoneCall, Receipt, Landmark, Award, ShieldCheck, 
  HelpCircle, Settings, Save, DownloadCloud, UploadCloud, Info, Trash2, AlertTriangle, CreditCard, Loader2
} from 'lucide-react';
import { useAppState } from '../lib/stateContext';
import { BusinessMode, getBusinessMode } from '../lib/businessMode';
import { DashboardWidgetSettings } from '../types';
import { auth } from '../lib/firebase';

const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetSettings = {
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

const DASHBOARD_WIDGET_OPTIONS: Array<{ key: keyof DashboardWidgetSettings; label: string }> = [
  { key: 'revenue', label: "Today's Revenue" },
  { key: 'totalSales', label: 'Total Sales' },
  { key: 'catalogItems', label: 'Catalog Items' },
  { key: 'lowStock', label: 'Low Stock Alert' },
  { key: 'customers', label: 'Total Customers' },
  { key: 'profit', label: 'Estimated Profit' },
  { key: 'weeklyRevenue', label: 'Weekly Revenue Trend' },
  { key: 'topSellingSkus', label: 'Top-Selling SKUs' },
  { key: 'salesRegister', label: 'Sales Register' }
];

const WHATSAPP_INVOICE_PRICE_PAISE = 200;

async function loadRazorpayCheckout() {
  if (window.Razorpay) return true;
  return new Promise<boolean>(resolve => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

async function readPaymentApiResponse(response: Response) {
  const body = await response.text();
  if (!body) return {} as Record<string, any>;
  try {
    return JSON.parse(body) as Record<string, any>;
  } catch {
    throw new Error('The payment server returned an invalid response.');
  }
}

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, products, customers, suppliers, sales, purchases, transactions, triggerToast, deleteAllMockupData, currentUser, activeStore } = useAppState();
  const [showConfirmDelete, setShowConfirmDelete] = useState<boolean>(false);

  // Form states initialized with setting configs
  const [storeName, setStoreName] = useState<string>(settings.storeName);
  const [address, setAddress] = useState<string>(settings.address);
  const [phone, setPhone] = useState<string>(settings.phone);
  const [currency, setCurrency] = useState<string>(settings.currency);
  const [gstNumber, setGstNumber] = useState<string>(settings.gstNumber);
  const [loyaltyPointsPerDollar, setLoyaltyPointsPerDollar] = useState<string>(settings.loyaltyPointsPerDollar.toString());
  const [receiptHeader, setReceiptHeader] = useState<string>(settings.receiptHeader);
  const [receiptFooter, setReceiptFooter] = useState<string>(settings.receiptFooter);
  const [invoiceSignature, setInvoiceSignature] = useState<string>(settings.invoiceSignature || '');
  const [showBankDetailsOnInvoice, setShowBankDetailsOnInvoice] = useState<boolean>(settings.showBankDetailsOnInvoice ?? false);
  const [bankAccountHolder, setBankAccountHolder] = useState<string>(settings.bankAccountHolder || '');
  const [bankName, setBankName] = useState<string>(settings.bankName || '');
  const [bankAccountNumber, setBankAccountNumber] = useState<string>(settings.bankAccountNumber || '');
  const [bankBranch, setBankBranch] = useState<string>(settings.bankBranch || '');
  const [bankIfsc, setBankIfsc] = useState<string>(settings.bankIfsc || '');
  const [upiId, setUpiId] = useState<string>(settings.upiId || '');
  const [upiPayeeName, setUpiPayeeName] = useState<string>(settings.upiPayeeName || settings.storeName);
  const [whatsappInvoiceEnabled, setWhatsappInvoiceEnabled] = useState<boolean>(settings.whatsappInvoiceEnabled ?? false);
  const [whatsappWalletBalance, setWhatsappWalletBalance] = useState<number | null>(null);
  const [isLoadingWhatsappWallet, setIsLoadingWhatsappWallet] = useState(false);
  const [isAddingWhatsappCredit, setIsAddingWhatsappCredit] = useState(false);
  const [businessType, setBusinessType] = useState<BusinessMode>(getBusinessMode(settings.businessType));
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidgetSettings>(() => ({
    ...DEFAULT_DASHBOARD_WIDGETS,
    ...settings.dashboardWidgets
  }));

  // Status logs
  const [statusMsg, setStatusMsg] = useState<string>('');

  const whatsappWorkspaceScope = (() => {
    if (currentUser?.workspaceScope) return currentUser.workspaceScope;
    const ownerScope = currentUser?.tenantId || currentUser?.email?.toLowerCase().trim().replace(/[^a-zA-Z0-9]/g, '_') || '';
    const primaryStoreId = settings.tenantId || ownerScope;
    if (!ownerScope || activeStore.id === 'primary-store' || activeStore.id === primaryStoreId || activeStore.id === ownerScope) return ownerScope;
    const safeStoreId = activeStore.id.toLowerCase().trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${ownerScope}__store__${safeStoreId}`;
  })();

  const loadWhatsappWallet = async () => {
    const user = auth.currentUser;
    if (!user || !whatsappWorkspaceScope) return;
    setIsLoadingWhatsappWallet(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/whatsapp-wallet?workspaceScope=${encodeURIComponent(whatsappWorkspaceScope)}`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      const wallet = await readPaymentApiResponse(response);
      if (!response.ok) throw new Error(wallet.error || 'Unable to load the WhatsApp wallet.');
      setWhatsappWalletBalance(Number(wallet.balancePaise || 0));
    } catch (error) {
      setWhatsappWalletBalance(null);
    } finally {
      setIsLoadingWhatsappWallet(false);
    }
  };

  useEffect(() => {
    void loadWhatsappWallet();
  }, [whatsappWorkspaceScope, currentUser?.email]);

  const addWhatsappCredit = async (amountPaise: number) => {
    const user = auth.currentUser;
    if (!user || !whatsappWorkspaceScope || isAddingWhatsappCredit) {
      triggerToast('Sign in again before adding WhatsApp credit.', 'warning');
      return;
    }
    setIsAddingWhatsappCredit(true);
    try {
      const checkoutLoaded = await loadRazorpayCheckout();
      if (!checkoutLoaded || !window.Razorpay) throw new Error('Razorpay Checkout could not be loaded.');
      const token = await user.getIdToken();
      const orderResponse = await fetch('/api/razorpay/create-whatsapp-wallet-order', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
        body: JSON.stringify({workspaceScope: whatsappWorkspaceScope, amountPaise}),
      });
      const order = await readPaymentApiResponse(orderResponse);
      if (!orderResponse.ok) throw new Error(order.error || 'Unable to start the WhatsApp credit payment.');
      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: 'QPOS',
        description: `WhatsApp invoice credit - Rs ${(amountPaise / 100).toFixed(0)}`,
        prefill: {name: currentUser?.name, email: currentUser?.email},
        theme: {color: '#10B981'},
        handler: async (payment: any) => {
          try {
            const verificationResponse = await fetch('/api/razorpay/verify-whatsapp-wallet-payment', {
              method: 'POST',
              headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
              body: JSON.stringify({
                workspaceScope: whatsappWorkspaceScope,
                razorpayOrderId: payment.razorpay_order_id,
                razorpayPaymentId: payment.razorpay_payment_id,
                razorpaySignature: payment.razorpay_signature,
              }),
            });
            const verification = await readPaymentApiResponse(verificationResponse);
            if (!verificationResponse.ok || !verification.verified) throw new Error(verification.error || 'Credit payment verification failed.');
            setWhatsappWalletBalance(Number(verification.balancePaise || 0));
            triggerToast('WhatsApp invoice credit added.', 'success');
          } catch (error) {
            triggerToast(error instanceof Error ? error.message : 'Credit payment verification failed.', 'error');
          } finally {
            setIsAddingWhatsappCredit(false);
          }
        },
        modal: {ondismiss: () => setIsAddingWhatsappCredit(false)},
      });
      checkout.open();
    } catch (error) {
      triggerToast(error instanceof Error ? error.message : 'Unable to add WhatsApp credit.', 'error');
      setIsAddingWhatsappCredit(false);
    }
  };

  const handleSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (showBankDetailsOnInvoice && (!bankName.trim() || !bankAccountNumber.trim() || !bankIfsc.trim())) {
      triggerToast('Complete the bank name, account number, and IFSC before showing bank details on invoices.', 'warning');
      return;
    }
    if (whatsappInvoiceEnabled && whatsappWalletBalance !== null && whatsappWalletBalance < WHATSAPP_INVOICE_PRICE_PAISE) {
      triggerToast('Add WhatsApp invoice credit before enabling this option.', 'warning');
      return;
    }
    updateSettings({
      ...settings,
      storeName,
      address,
      phone,
      currency,
      gstNumber,
      loyaltyPointsPerDollar: parseFloat(loyaltyPointsPerDollar) || 1,
      receiptHeader,
      receiptFooter,
      invoiceSignature,
      showBankDetailsOnInvoice,
      bankAccountHolder: bankAccountHolder.trim(),
      bankName: bankName.trim(),
      bankAccountNumber: bankAccountNumber.trim(),
      bankBranch: bankBranch.trim(),
      bankIfsc: bankIfsc.trim().toUpperCase(),
      upiId: upiId.trim().toLowerCase(),
      upiPayeeName: upiPayeeName.trim() || storeName.trim(),
      whatsappInvoiceEnabled,
      businessType,
      dashboardWidgets
    });
    setStatusMsg('Store settings saved successfully! ✔');
    setTimeout(() => setStatusMsg(''), 4000);
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      triggerToast('Please select a PNG, JPG, or WebP signature image.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      triggerToast('Signature image must be smaller than 5 MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 1000 / image.width, 400 / image.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          triggerToast('Unable to process the signature image.', 'error');
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        const sampleSize = Math.max(2, Math.min(12, Math.floor(Math.min(canvas.width, canvas.height) * 0.08)));
        const cornerStarts = [
          [0, 0],
          [canvas.width - sampleSize, 0],
          [0, canvas.height - sampleSize],
          [canvas.width - sampleSize, canvas.height - sampleSize]
        ];
        let red = 0;
        let green = 0;
        let blue = 0;
        let samples = 0;
        cornerStarts.forEach(([startX, startY]) => {
          for (let y = startY; y < startY + sampleSize; y += 1) {
            for (let x = startX; x < startX + sampleSize; x += 1) {
              const index = (y * canvas.width + x) * 4;
              if (pixels.data[index + 3] > 20) {
                red += pixels.data[index];
                green += pixels.data[index + 1];
                blue += pixels.data[index + 2];
                samples += 1;
              }
            }
          }
        });
        const background = samples
          ? [red / samples, green / samples, blue / samples]
          : [255, 255, 255];
        let minX = canvas.width;
        let minY = canvas.height;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < canvas.height; y += 1) {
          for (let x = 0; x < canvas.width; x += 1) {
            const index = (y * canvas.width + x) * 4;
            const originalAlpha = pixels.data[index + 3];
            if (originalAlpha <= 20) continue;
            const distance = Math.sqrt(
              (pixels.data[index] - background[0]) ** 2 +
              (pixels.data[index + 1] - background[1]) ** 2 +
              (pixels.data[index + 2] - background[2]) ** 2
            );
            const alphaFactor = Math.max(0, Math.min(1, (distance - 18) / 47));
            pixels.data[index + 3] = Math.round(originalAlpha * alphaFactor);
            if (pixels.data[index + 3] > 20) {
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
            }
          }
        }

        if (maxX < minX || maxY < minY) {
          triggerToast('No clear signature was detected. Please use a higher-contrast image.', 'error');
          return;
        }
        context.putImageData(pixels, 0, 0);
        const padding = 6;
        const cropX = Math.max(0, minX - padding);
        const cropY = Math.max(0, minY - padding);
        const cropWidth = Math.min(canvas.width - cropX, maxX - minX + 1 + padding * 2);
        const cropHeight = Math.min(canvas.height - cropY, maxY - minY + 1 + padding * 2);
        const outputScale = Math.min(1, 600 / cropWidth, 160 / cropHeight);
        const output = document.createElement('canvas');
        output.width = Math.max(1, Math.round(cropWidth * outputScale));
        output.height = Math.max(1, Math.round(cropHeight * outputScale));
        const outputContext = output.getContext('2d');
        if (!outputContext) {
          triggerToast('Unable to process the signature image.', 'error');
          return;
        }
        outputContext.drawImage(
          canvas,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          0,
          0,
          output.width,
          output.height
        );
        const dataUrl = output.toDataURL('image/png');
        if (dataUrl.length > 500_000) {
          triggerToast('The processed signature is still too large. Please use a simpler image.', 'error');
          return;
        }
        setInvoiceSignature(dataUrl);
        triggerToast('Signature ready. Select Apply Config to save it.', 'success');
      };
      image.onerror = () => triggerToast('Unable to read the selected signature image.', 'error');
      image.src = reader.result as string;
    };
    reader.onerror = () => triggerToast('Unable to read the selected signature image.', 'error');
    reader.readAsDataURL(file);
    e.target.value = '';
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
    link.download = `qpos-backup-${new Date().toISOString().split('T')[0]}.json`;
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
          triggerToast("Invalid backup configuration format! Core tables are missing inside the imported JSON.", "error");
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

        triggerToast("Database backup imported successfully! Reloading application...", "success");
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } catch (err) {
        triggerToast("Verification failed: JSON parse error in imported backup file!", "error");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pb-12">
      
      {/* Primary configuration column */}
      <form onSubmit={handleSettingsSubmit} className="md:col-span-12 lg:col-span-8 rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-6 shadow-sm space-y-6">
        <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-950">
          <div>
            <h3 className="text-xl font-black text-gray-950 dark:text-white">Store Operating Configurations</h3>
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

          <div>
            <label className="block text-gray-450 mb-1 flex items-center gap-1.5">
              <Settings className="h-3.5 w-3.5" /> Business Operating Mode
            </label>
            <select
              id="set-business-mode"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value as BusinessMode)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs text-white"
            >
              <option value="Retail">Retail</option>
              <option value="Manufacturing">Manufacturing</option>
              <option value="Hybrid">Hybrid</option>
              <option value="Service">Service + Material</option>
              <option value="Restaurant">Restaurant / Cafe</option>
            </select>
            <p className="mt-1 text-[9px] font-medium text-gray-400">Controls which inventory and sourcing tools are shown.</p>
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
              placeholder="₹"
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

          <div className="sm:col-span-2 border-t border-gray-100 dark:border-gray-900 pt-5">
            <span className="block text-xs font-bold text-gray-400 uppercase tracking-widest">
              Dashboard Visibility
            </span>
            <p className="mt-1 text-[10px] font-normal text-gray-400">
              Choose which cards and sections are visible on your dashboard.
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DASHBOARD_WIDGET_OPTIONS.map(({ key, label }) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-3 py-2.5"
                >
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{label}</span>
                  <input
                    type="checkbox"
                    checked={dashboardWidgets[key]}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setDashboardWidgets((current) => ({ ...current, [key]: checked }));
                    }}
                    className="h-4 w-4 accent-emerald-500"
                  />
                </label>
              ))}
            </div>
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
                  placeholder="e.g. Welcome to our store!"
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

            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-200">
                    <Landmark className="h-4 w-4 text-emerald-500" />
                    Show Bank Details on Invoice
                  </p>
                  <p className="mt-1 text-[10px] font-normal text-gray-400">
                    Enable this only when customers should see your settlement account on printed and PDF invoices.
                  </p>
                </div>
                <button
                  id="set-show-bank-details"
                  type="button"
                  role="switch"
                  aria-checked={showBankDetailsOnInvoice}
                  onClick={() => setShowBankDetailsOnInvoice(value => !value)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${showBankDetailsOnInvoice ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                ><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${showBankDetailsOnInvoice ? 'left-6' : 'left-1'}`} /></button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-gray-400">Account Holder</label>
                  <input
                    type="text"
                    value={bankAccountHolder}
                    onChange={(event) => setBankAccountHolder(event.target.value)}
                    placeholder="Company or account holder name"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-gray-400">Bank Name</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(event) => setBankName(event.target.value)}
                    placeholder="e.g. HDFC Bank"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-gray-400">Account Number</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={bankAccountNumber}
                    onChange={(event) => setBankAccountNumber(event.target.value.replace(/\s/g, ''))}
                    placeholder="Bank account number"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs font-mono text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-gray-400">IFSC Code</label>
                  <input
                    type="text"
                    value={bankIfsc}
                    onChange={(event) => setBankIfsc(event.target.value.toUpperCase())}
                    placeholder="e.g. HDFC0000240"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs font-mono uppercase text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[10px] font-bold uppercase text-gray-400">Branch</label>
                  <input
                    type="text"
                    value={bankBranch}
                    onChange={(event) => setBankBranch(event.target.value)}
                    placeholder="Bank branch name or location"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {showBankDetailsOnInvoice && (!bankName.trim() || !bankAccountNumber.trim() || !bankIfsc.trim()) && (
                <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  Complete the bank name, account number, and IFSC before enabling invoice display.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
              <p className="text-xs font-bold text-gray-700 dark:text-gray-200">UPI payment QR on invoices</p>
              <p className="mt-1 text-[10px] text-gray-400">Customers scan the invoice QR to pay this workspace directly. QPOS does not receive the payment.</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-gray-400">UPI ID</label>
                  <input value={upiId} onChange={(event) => setUpiId(event.target.value)} placeholder="shop@upi" className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-gray-400">UPI payee name</label>
                  <input value={upiPayeeName} onChange={(event) => setUpiPayeeName(event.target.value)} placeholder="Your shop name" className="w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white" />
                </div>
              </div>
            </div>

            {businessType !== 'Restaurant' && <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-200">Send retail invoices by WhatsApp</p>
                  <p className="mt-1 text-[10px] text-gray-400">Uses the Neospec CRM WhatsApp Business number. Rs 2 is deducted only after WhatsApp accepts an invoice delivery.</p>
                </div>
                <button type="button" role="switch" aria-checked={whatsappInvoiceEnabled} onClick={() => setWhatsappInvoiceEnabled(value => !value)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${whatsappInvoiceEnabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${whatsappInvoiceEnabled ? 'left-6' : 'left-1'}`} /></button>
              </div>
              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 dark:border-emerald-950 dark:bg-emerald-950/20">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-emerald-600" />
                    <div>
                      <p className="text-[11px] font-bold text-gray-800 dark:text-gray-100">WhatsApp invoice wallet</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">This balance belongs only to {activeStore.name}.</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Available credit</p>
                    <p className="font-mono text-sm font-bold text-emerald-600">
                      {isLoadingWhatsappWallet ? 'Loading...' : whatsappWalletBalance === null ? 'Unavailable' : `Rs ${(whatsappWalletBalance / 100).toFixed(2)}`}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[10000, 20000, 50000].map(amountPaise => (
                    <button
                      key={amountPaise}
                      type="button"
                      onClick={() => void addWhatsappCredit(amountPaise)}
                      disabled={isAddingWhatsappCredit}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isAddingWhatsappCredit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                      Add Rs {amountPaise / 100}
                    </button>
                  ))}
                  <button type="button" onClick={() => void loadWhatsappWallet()} className="rounded-lg border border-emerald-200 px-3 py-2 text-[10px] font-bold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900 dark:text-emerald-400">
                    Refresh balance
                  </button>
                </div>
              </div>
            </div>}

            <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-200">Authorised Invoice Signature</p>
                  <p className="mt-1 text-[10px] font-normal text-gray-400">PNG with a transparent background works best. Maximum source size: 5 MB.</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gray-100 dark:bg-gray-900 px-3 py-2 text-[10px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-800">
                    <UploadCloud className="h-4 w-4 text-emerald-500" />
                    <span>{invoiceSignature ? 'Replace Signature' : 'Upload Signature'}</span>
                    <input
                      id="set-invoice-signature"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleSignatureUpload}
                      className="hidden"
                    />
                  </label>
                  {invoiceSignature && (
                    <button
                      type="button"
                      onClick={() => setInvoiceSignature('')}
                      className="rounded-xl border border-rose-200 dark:border-rose-900/60 p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      title="Remove invoice signature"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              {invoiceSignature && (
                <div className="mt-4 flex min-h-20 items-center justify-center rounded-xl bg-white p-3">
                  <img
                    src={invoiceSignature}
                    alt="Authorised invoice signature preview"
                    className="max-h-16 max-w-full object-contain"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* Database sync parameters import/export triggers (4 cols) */}
      <div className="md:col-span-12 lg:col-span-4 rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 p-6 shadow-sm space-y-5">
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

          {/* Delete All Mockup Data trigger */}
          <button
            id="delete-all-mockup-btn"
            type="button"
            onClick={() => setShowConfirmDelete(true)}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 py-3.5 text-xs font-bold cursor-pointer transition active:scale-95 mt-4"
          >
            <Trash2 className="h-4.5 w-4.5 text-rose-500" />
            <span>Delete All Mockup & Demo Data</span>
          </button>
        </div>

        {/* Confirmation Modal for deleting mockup */}
        {showConfirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-3xl bg-white dark:bg-gray-950 p-6 border border-gray-100 dark:border-gray-900 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-rose-500">
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-900/60">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-white">Delete All Mockup Data?</h4>
                  <p className="text-xs text-gray-400">This action cannot be undone.</p>
                </div>
              </div>

              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                This will permanently delete all demo products, mockup transactions, sample customers, suppliers, sales, and inventory logs from your workspace database.
              </p>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-900">
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(false)}
                  className="rounded-xl bg-gray-100 dark:bg-gray-900 px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await deleteAllMockupData();
                    setShowConfirmDelete(false);
                  }}
                  className="rounded-xl bg-rose-500 hover:bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition cursor-pointer"
                >
                  Confirm Delete All Data
                </button>
              </div>
            </div>
          </div>
        )}

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
