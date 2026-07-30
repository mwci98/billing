import React, {useState} from 'react';
import {
  ArrowLeft, ArrowRight, Building2, Check, Landmark, MapPin,
  Receipt, Rocket, Store, UserRound
} from 'lucide-react';
import {useAppState} from '../lib/stateContext';
import {BusinessMode, getBusinessMode} from '../lib/businessMode';
import {isInternalTestingAccount} from '../lib/internalEntitlements';

const steps = ['Business', 'Compliance', 'POS setup'];

export const BusinessOnboarding: React.FC = () => {
  const {settings, currentUser, activeStore, updateSettings, completeStoreBranchSetup} = useAppState();
  const hasInternalAccess = isInternalTestingAccount(currentUser?.email);
  const isPrimaryWorkspace =
    activeStore.id === 'primary-store' ||
    activeStore.id === (settings.tenantId || currentUser?.tenantId);
  const branchConfiguration = activeStore.configuration;
  const [step, setStep] = useState(0);
  const [storeName, setStoreName] = useState(isPrimaryWorkspace ? settings.storeName || '' : activeStore.name || '');
  const [ownerName, setOwnerName] = useState(
    branchConfiguration?.ownerName || (isPrimaryWorkspace ? settings.ownerName : '') || currentUser?.name || ''
  );
  const [businessType, setBusinessType] = useState<BusinessMode>(
    getBusinessMode(branchConfiguration?.businessType || (isPrimaryWorkspace ? settings.businessType : 'Retail'))
  );
  const [phone, setPhone] = useState(branchConfiguration?.phone || (isPrimaryWorkspace ? settings.phone : '') || '');
  const [email, setEmail] = useState(
    branchConfiguration?.email || (isPrimaryWorkspace ? settings.email : '') || ''
  );
  const [address, setAddress] = useState(branchConfiguration?.address || (isPrimaryWorkspace ? settings.address : activeStore.city) || '');
  const [gstNumber, setGstNumber] = useState(branchConfiguration?.gstNumber || (isPrimaryWorkspace ? settings.gstNumber : '') || '');
  const [website, setWebsite] = useState(branchConfiguration?.website || (isPrimaryWorkspace ? settings.website : '') || '');
  const [currency, setCurrency] = useState(branchConfiguration?.currency || (isPrimaryWorkspace ? settings.currency : '₹') || '₹');
  const [receiptHeader, setReceiptHeader] = useState(
    branchConfiguration?.receiptHeader || (isPrimaryWorkspace ? settings.receiptHeader : '') || ''
  );
  const [receiptFooter, setReceiptFooter] = useState(
    branchConfiguration?.receiptFooter || (isPrimaryWorkspace ? settings.receiptFooter : '') || ''
  );

  const completeSetup = () => {
    if (!isPrimaryWorkspace) {
      completeStoreBranchSetup({
        storeName: storeName.trim(),
        ownerName: ownerName.trim(),
        businessType,
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        gstNumber: gstNumber.trim(),
        website: website.trim(),
        currency,
        receiptHeader: receiptHeader.trim(),
        receiptFooter: receiptFooter.trim()
      });
      return;
    }
    updateSettings({
      ...settings,
      storeName: storeName.trim(),
      ownerName: ownerName.trim(),
      businessType,
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      gstNumber: gstNumber.trim(),
      website: website.trim(),
      currency,
      receiptHeader: receiptHeader.trim(),
      receiptFooter: receiptFooter.trim(),
      tenantId: settings.tenantId || currentUser?.tenantId,
      onboardingCompleted: true,
    });
  };

  const canContinue =
    step === 0 ? Boolean(storeName.trim() && ownerName.trim() && businessType) :
    step === 1 ? Boolean(phone.trim() && email.trim() && address.trim()) :
    Boolean(currency && receiptHeader.trim() && receiptFooter.trim());

  return (
    <div className="dark min-h-screen bg-[#0A0A0B] px-4 py-8 text-white sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-500/20">
            <Store className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-3xl font-black">
            {isPrimaryWorkspace ? 'Set up your business' : `Configure ${activeStore.name}`}
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Complete these details once to prepare this isolated POS workspace.
          </p>
          <span className="mt-3 inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-400">
            {hasInternalAccess ? 'Internal testing access · no trial expiry' : 'Your 5-day Basic trial starts now'}
          </span>
        </div>

        <div className="mt-8 flex items-center justify-center">
          {steps.map((label, index) => (
            <React.Fragment key={label}>
              <div className="flex flex-col items-center gap-1.5">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-black ${
                  index < step ? 'border-emerald-500 bg-emerald-500 text-white' :
                  index === step ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' :
                  'border-white/10 bg-white/5 text-gray-500'
                }`}>
                  {index < step ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                <span className={`text-[10px] font-bold ${index <= step ? 'text-gray-200' : 'text-gray-600'}`}>{label}</span>
              </div>
              {index < steps.length - 1 && (
                <div className={`mx-3 mb-5 h-px w-16 sm:w-28 ${index < step ? 'bg-emerald-500' : 'bg-white/10'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-[#141416] p-5 shadow-2xl sm:p-8">
          {step === 0 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-emerald-500" />
                <div>
                  <h2 className="font-bold">Business identity</h2>
                  <p className="text-xs text-gray-400">Tell us who operates this workspace.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Business / store name" value={storeName} onChange={setStoreName} icon={<Store />} required />
                <Field label="Owner name" value={ownerName} onChange={setOwnerName} icon={<UserRound />} required />
                <label className="sm:col-span-2 text-xs font-bold text-gray-300">
                  Business operating mode
                  <select value={businessType} onChange={event => setBusinessType(event.target.value as BusinessMode)}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#18181B] p-3 text-sm text-white">
                    <option value="Retail">Retail — buy from suppliers and sell</option>
                    <option value="Manufacturing">Manufacturing — produce items in-house</option>
                    <option value="Hybrid">Hybrid — purchase and manufacture</option>
                  </select>
                  <span className="mt-1.5 block text-[10px] font-medium leading-4 text-gray-500">
                    QPOS will hide tools that are not relevant to this mode.
                  </span>
                </label>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <Landmark className="h-5 w-5 text-emerald-500" />
                <div>
                  <h2 className="font-bold">Contact and compliance</h2>
                  <p className="text-xs text-gray-400">These details appear on business documents and receipts.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Business phone" value={phone} onChange={setPhone} required />
                <Field label="Business email" value={email} onChange={setEmail} type="email" required />
                <Field label="GSTIN / Tax ID" value={gstNumber} onChange={setGstNumber} icon={<Landmark />} />
                <Field label="Website (optional)" value={website} onChange={setWebsite} />
                <div className="sm:col-span-2">
                  <Field label="Full business address" value={address} onChange={setAddress} icon={<MapPin />} required />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <Receipt className="h-5 w-5 text-emerald-500" />
                <div>
                  <h2 className="font-bold">POS and receipt preferences</h2>
                  <p className="text-xs text-gray-400">Choose how invoices should look for customers.</p>
                </div>
              </div>
              <div className="space-y-4">
                <label className="block text-xs font-bold text-gray-300">
                  Currency
                  <select value={currency} onChange={event => setCurrency(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#18181B] p-3 text-sm text-white">
                    <option value="₹">₹ — Indian Rupee</option>
                    <option value="$">$ — US Dollar</option>
                    <option value="€">€ — Euro</option>
                    <option value="£">£ — British Pound</option>
                  </select>
                </label>
                <TextArea label="Receipt header" value={receiptHeader} onChange={setReceiptHeader} />
                <TextArea label="Receipt footer" value={receiptFooter} onChange={setReceiptFooter} />
              </div>
            </div>
          )}

          <div className="mt-7 flex items-center justify-between border-t border-white/5 pt-5">
            <button type="button" disabled={step === 0} onClick={() => setStep(current => current - 1)}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-400 hover:bg-white/5 disabled:opacity-0">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            {step < steps.length - 1 ? (
              <button type="button" disabled={!canContinue} onClick={() => setStep(current => current + 1)}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-40">
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" disabled={!canContinue} onClick={completeSetup}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-40">
                Launch my workspace <Rocket className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  icon?: React.ReactElement<{className?: string}>;
}

function Field({label, value, onChange, type = 'text', required, icon}: FieldProps) {
  return (
    <label className="block text-xs font-bold text-gray-300">
      {label}{required && <span className="text-emerald-500"> *</span>}
      <div className="relative mt-1.5">
        {icon && React.cloneElement(icon, {className: 'absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500'})}
        <input type={type} required={required} value={value} onChange={event => onChange(event.target.value)}
          className={`w-full rounded-xl border border-white/10 bg-[#18181B] p-3 text-sm text-white outline-none focus:border-emerald-500 ${icon ? 'pl-10' : ''}`} />
      </div>
    </label>
  );
}

function TextArea({label, value, onChange}: Pick<FieldProps, 'label' | 'value' | 'onChange'>) {
  return (
    <label className="block text-xs font-bold text-gray-300">
      {label} <span className="text-emerald-500">*</span>
      <textarea required rows={3} value={value} onChange={event => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#18181B] p-3 text-sm text-white outline-none focus:border-emerald-500" />
    </label>
  );
}
