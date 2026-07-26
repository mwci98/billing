import React, { useState } from 'react';
import { 
  Building2, CheckCircle2, Shield, Zap, Database, 
  Layers, ArrowUpRight, Check, X, Sparkles, Globe, MapPin, Server
} from 'lucide-react';
import { useAppState } from '../lib/stateContext';

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
    upgradeSaaSPlan, 
    settings, 
    products, 
    sales, 
    customers, 
    suppliers,
    currentUser,
    isFirebaseConnected,
    syncWithCloud
  } = useAppState();

  const [activeTab, setActiveTab] = useState<'branches' | 'plans' | 'database'>('branches');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentPlanTier = settings.planTier || 'Pro';

  const handleManualSync = async () => {
    setIsSyncing(true);
    await syncWithCloud();
    setTimeout(() => setIsSyncing(false), 600);
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
                  SaaS Enterprise Workspace Manager
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {currentPlanTier} Tier
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-white/60 mt-0.5">
                Multi-tenant store branches & Firebase Firestore cloud persistence
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
            Store Branches ({saasStores.length})
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
          <button
            onClick={() => setActiveTab('database')}
            className={`py-3.5 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'database' 
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' 
                : 'border-transparent text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Database className="h-4 w-4" />
            Firebase DB Inspector
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* TAB 1: STORE BRANCHES */}
          {activeTab === 'branches' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Active Store Locations</h3>
                  <p className="text-xs text-gray-500 dark:text-white/50">Switch seamlessly between your multi-branch POS outlets</p>
                </div>
                <span className="text-xs text-gray-400 font-mono">Tenant ID: {settings.tenantId || 'tenant-main-01'}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {saasStores.map((store) => {
                  const isActive = store.id === activeStore.id;
                  return (
                    <div 
                      key={store.id}
                      onClick={() => switchStoreBranch(store.id)}
                      className={`p-5 rounded-2xl border transition-all cursor-pointer relative ${
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
                              {isActive ? 'Active Workspace' : 'Click to Switch'}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-gray-500 font-mono">
                              {store.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-between text-xs text-blue-600 dark:text-blue-400">
                <div className="flex items-center gap-2.5">
                  <Globe className="h-4 w-4 text-blue-500" />
                  <span>Cross-branch inventory sync is enabled across all registered store locations.</span>
                </div>
                <span className="font-bold uppercase tracking-wider text-[10px]">Live Sync Active</span>
              </div>
            </div>
          )}

          {/* TAB 2: SUBSCRIPTION PLANS */}
          {activeTab === 'plans' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Choose Your SaaS Tier</h3>
                <p className="text-xs text-gray-500 dark:text-white/50">Scale catalog limits, multi-location branches, and cloud backups</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {saasPlans.map((plan) => {
                  const isCurrent = currentPlanTier === plan.name;
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
                          <span className="text-2xl font-black text-gray-900 dark:text-white">₹{plan.priceMonthly.toLocaleString('en-IN')}</span>
                          <span className="text-xs text-gray-500 dark:text-white/50">/month</span>
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
                        disabled={isCurrent}
                        onClick={() => upgradeSaaSPlan(plan.name as any)}
                        className={`mt-6 w-full py-2.5 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                          isCurrent 
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 cursor-default' 
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20 active:scale-[0.98]'
                        }`}
                      >
                        {isCurrent ? (
                          <>
                            <Check className="h-4 w-4" />
                            Current Tier
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

          {/* TAB 3: FIREBASE DATABASE INSPECTOR */}
          {activeTab === 'database' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center font-bold shrink-0">
                    <Server className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white">Firebase Firestore Cloud Database</h4>
                    <p className="text-[11px] text-gray-500 font-mono mt-0.5">Project ID: ai-studio-6936ecb8-f4bb-4b22-88cd-421a5053b2cd</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                    isFirebaseConnected 
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                      : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                  }`}>
                    <span className={`h-2 w-2 rounded-full ${isFirebaseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    {isFirebaseConnected ? 'Firestore Connected' : 'Connecting Cloud...'}
                  </span>
                  
                  <button
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                  >
                    <Database className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Force Cloud Sync'}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider text-gray-400">
                  Real-time Firestore Collections Status
                </h4>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase font-mono">Collection: products</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white mt-1">{products.length} Docs</p>
                    <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1 mt-1">
                      <Check className="h-3 w-3" /> Live Listener Active
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase font-mono">Collection: sales</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white mt-1">{sales.length} Docs</p>
                    <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1 mt-1">
                      <Check className="h-3 w-3" /> Live Listener Active
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase font-mono">Collection: customers</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white mt-1">{customers.length} Docs</p>
                    <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1 mt-1">
                      <Check className="h-3 w-3" /> Live Listener Active
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase font-mono">Collection: suppliers</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white mt-1">{suppliers.length} Docs</p>
                    <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1 mt-1">
                      <Check className="h-3 w-3" /> Live Listener Active
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-3 text-xs text-emerald-700 dark:text-emerald-300">
                <Shield className="h-5 w-5 text-emerald-500 shrink-0" />
                <div>
                  <span className="font-bold">Firestore Security Rules Enforced:</span>
                  <p className="text-gray-500 dark:text-white/60 text-[11px] mt-0.5">
                    Data isolation enabled for authenticated user email <span className="font-mono text-emerald-500 font-semibold">{currentUser?.email}</span>.
                  </p>
                </div>
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
