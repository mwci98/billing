import React, { useState } from 'react';
import { 
  Building2, CheckCircle2, Zap,
  Layers, Check, X, Sparkles, Globe, MapPin, CreditCard, Plus, Loader2
} from 'lucide-react';
import { useAppState } from '../lib/stateContext';

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

async function readApiResponse(response: Response) {
  const body = await response.text();
  if (!body) return {};
  try {
    return JSON.parse(body) as Record<string, any>;
  } catch {
    throw new Error('The payment server returned an invalid response.');
  }
}

interface SaaSManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SaaSManagerModal: React.FC<SaaSManagerModalProps> = ({ isOpen, onClose }) => {
  const { 
    activeStore, 
    saasStores, 
    saasPlans, 
    switchStoreBranch, 
    addStoreBranch,
    upgradeSaaSPlan, 
    settings, 
    currentUser,
    isFirebaseConnected,
    triggerToast
  } = useAppState();

  const [activeTab, setActiveTab] = useState<'branches' | 'plans'>('branches');
  const [isBuyingStore, setIsBuyingStore] = useState(false);
  const [showStoreForm, setShowStoreForm] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [storeCity, setStoreCity] = useState('');

  if (!isOpen) return null;

  const purchaseStoreAddon = async () => {
    if (!currentUser || isBuyingStore) return;
    setIsBuyingStore(true);
    try {
      const checkoutLoaded = await loadRazorpayCheckout();
      if (!checkoutLoaded || !window.Razorpay) {
        throw new Error('Razorpay Checkout could not be loaded.');
      }

      const orderResponse = await fetch('/api/razorpay/create-addon-order', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          tenantId: currentUser.tenantId || settings.tenantId,
          email: currentUser.email,
        }),
      });
      const order = await readApiResponse(orderResponse);
      if (!orderResponse.ok) throw new Error(order.error || 'Unable to start the add-on payment.');

      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: settings.storeName || 'Quick Point of Sales',
        description: 'Additional store add-on · one-time ₹500',
        prefill: {name: currentUser.name, email: currentUser.email},
        theme: {color: '#10B981'},
        handler: async (payment: any) => {
          const verificationResponse = await fetch('/api/razorpay/verify-addon-payment', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              razorpayOrderId: payment.razorpay_order_id,
              razorpayPaymentId: payment.razorpay_payment_id,
              razorpaySignature: payment.razorpay_signature,
            }),
          });
          const verification = await readApiResponse(verificationResponse);
          if (!verificationResponse.ok || !verification.verified) {
            triggerToast(verification.error || 'Add-on payment verification failed.', 'error');
            setIsBuyingStore(false);
            return;
          }
          setShowStoreForm(true);
          setIsBuyingStore(false);
          triggerToast('Payment verified. Enter the new store details.', 'success');
        },
        modal: {ondismiss: () => setIsBuyingStore(false)},
      });
      checkout.open();
    } catch (error) {
      triggerToast(error instanceof Error ? error.message : 'Unable to buy the store add-on.', 'error');
      setIsBuyingStore(false);
    }
  };

  const submitStore = (event: React.FormEvent) => {
    event.preventDefault();
    if (!storeName.trim() || !branchCode.trim() || !storeCity.trim()) {
      triggerToast('Enter the store name, branch code, and city.', 'warning');
      return;
    }
    addStoreBranch({
      name: storeName.trim(),
      branchCode: branchCode.trim(),
      city: storeCity.trim(),
    });
    setStoreName('');
    setBranchCode('');
    setStoreCity('');
    setShowStoreForm(false);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111112] border border-gray-200 dark:border-white/10 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden text-gray-900 dark:text-[#E0E0E0] font-sans">
        
        {/* MODAL HEADER */}
        <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-emerald-500/5 via-transparent to-emerald-500/5">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white flex items-center justify-center font-black shadow-lg shadow-emerald-500/20">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  SaaS Workspace & Subscription
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {settings.subscriptionStatus === 'active' ? 'Basic' : settings.subscriptionStatus === 'trialing' ? 'Trial' : 'Expired'}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-white/60 mt-0.5">
                Your isolated store workspace, trial, and Basic subscription
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="h-9 w-9 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-white/60 flex items-center justify-center transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* MODAL NAVIGATION TABS */}
        <div className="flex border-b border-gray-100 dark:border-white/5 px-6 gap-2 bg-gray-50/50 dark:bg-black/20">
          <button
            onClick={() => setActiveTab('branches')}
            className={`py-3.5 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'branches' 
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' 
                : 'border-transparent text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Building2 className="h-4 w-4" />
            Store Workspace
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`py-3.5 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'plans' 
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' 
                : 'border-transparent text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Zap className="h-4 w-4" />
            Subscription & Plans
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* TAB 1: STORE BRANCHES */}
          {activeTab === 'branches' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Store Workspaces</h3>
                  <p className="text-xs text-gray-500 dark:text-white/50">Select a store to switch the active workspace.</p>
                </div>
                <button
                  type="button"
                  onClick={purchaseStoreAddon}
                  disabled={isBuyingStore}
                  className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-600 disabled:opacity-50"
                >
                  {isBuyingStore ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add Store · ₹500 once
                </button>
              </div>

              {showStoreForm && (
                <form onSubmit={submitStore} className="grid grid-cols-1 gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:grid-cols-3">
                  <input
                    value={storeName}
                    onChange={event => setStoreName(event.target.value)}
                    placeholder="Store name"
                    aria-label="Store name"
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs dark:border-white/10 dark:bg-[#18181B]"
                  />
                  <input
                    value={branchCode}
                    onChange={event => setBranchCode(event.target.value)}
                    placeholder="Branch code"
                    aria-label="Branch code"
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs uppercase dark:border-white/10 dark:bg-[#18181B]"
                  />
                  <input
                    value={storeCity}
                    onChange={event => setStoreCity(event.target.value)}
                    placeholder="City / location"
                    aria-label="City or location"
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs dark:border-white/10 dark:bg-[#18181B]"
                  />
                  <div className="flex gap-2 sm:col-span-3 sm:justify-end">
                    <button type="button" onClick={() => setShowStoreForm(false)} className="rounded-xl px-4 py-2 text-xs font-bold text-gray-500">
                      Cancel
                    </button>
                    <button type="submit" className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white">
                      Create & Switch Store
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {saasStores.map((store) => {
                  const isActive = store.id === activeStore.id;
                  return (
                    <button
                      type="button"
                      key={store.id}
                      onClick={() => switchStoreBranch(store.id)}
                      className={`w-full p-5 rounded-2xl border text-left transition-all cursor-pointer relative ${
                        isActive 
                          ? 'bg-emerald-500/10 border-emerald-500 dark:border-emerald-500/50 shadow-lg shadow-emerald-500/5' 
                          : 'bg-gray-50 dark:bg-white/[0.02] border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/20'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 animate-pulse" />
                      )}
                      <div className="flex items-start gap-3">
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isActive ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-white/70'
                        }`}>
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">{store.name}</h4>
                          <p className="text-[10px] text-gray-500 dark:text-white/50 mt-0.5">{store.city} • Code: {store.branchCode}</p>
                          <div className="mt-3 flex items-center justify-between text-[10px]">
                            <span className={`font-semibold ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'}`}>
                              {isActive ? 'Active Workspace' : 'Workspace'}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-gray-500 font-mono">
                              {store.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-between text-xs text-blue-600 dark:text-blue-400">
                <div className="flex items-center gap-2.5">
                  <Globe className="h-4 w-4 text-blue-500" />
                  <span>Products, sales, purchases, and staff access are isolated inside this tenant workspace.</span>
                </div>
                <span className="font-bold uppercase tracking-wider text-[10px]">{isFirebaseConnected ? 'Cloud Connected' : 'Local Mode'}</span>
              </div>
            </div>
          )}

          {/* TAB 2: SUBSCRIPTION PLANS */}
          {activeTab === 'plans' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Basic Subscription</h3>
                <p className="text-xs text-gray-500 dark:text-white/50">Five-day free trial followed by ₹6,000 yearly recurring billing through Razorpay.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {saasPlans.map((plan) => {
                  const isCurrent = true;
                  const isSubscribed = settings.subscriptionStatus === 'active';
                  const canUpgradeTrial = !isSubscribed;
                  return (
                    <div 
                      key={plan.name}
                      className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                        isCurrent 
                          ? 'bg-emerald-500/10 border-emerald-500 shadow-xl shadow-emerald-500/10' 
                          : 'bg-gray-50 dark:bg-white/[0.02] border-gray-200 dark:border-white/5'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">{plan.name} Plan</h4>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500 text-white uppercase tracking-wider">
                              {settings.subscriptionStatus === 'active' ? 'Active' : 'Trial'}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex items-baseline gap-1">
                          <span className="text-2xl font-black text-gray-900 dark:text-white">₹{plan.priceYearly.toLocaleString('en-IN')}</span>
                          <span className="text-xs text-gray-500 dark:text-white/50">/year</span>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/5 space-y-2 text-xs">
                          {plan.features.map((feature, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-gray-600 dark:text-white/80">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        disabled={isSubscribed}
                        onClick={() => {
                          if (canUpgradeTrial) {
                            window.dispatchEvent(new Event('start-pro-subscription'));
                            return;
                          }
                          upgradeSaaSPlan(plan.name as any);
                        }}
                        className={`mt-6 w-full py-2.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                          isSubscribed
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 cursor-default' 
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20 active:scale-[0.98]'
                        }`}
                      >
                        {isSubscribed ? (
                          <>
                            <Check className="h-4 w-4" />
                            Current Tier
                          </>
                        ) : canUpgradeTrial ? (
                          <>
                            <CreditCard className="h-4 w-4" />
                            Upgrade to Basic
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            Upgrade to {plan.name}
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 px-6 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-black/40 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-gray-500 dark:text-white/50">
            <Layers className="h-4 w-4 text-emerald-500" />
            <span>Active Location: <strong className="text-gray-900 dark:text-white">{activeStore.name}</strong></span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 font-bold text-gray-800 dark:text-white transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
