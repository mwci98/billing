import React, {useEffect, useMemo, useState} from 'react';
import {Copy, ExternalLink, ImagePlus, MapPin, Save, Share2, Store, Truck, WalletCards} from 'lucide-react';
import QRCode from 'qrcode';
import {useAppState} from '../lib/stateContext';
import {OnlineStoreConfig} from '../types';
import {compressProductImage} from '../lib/productImage';

const normalizeSlug = (value: string) => value
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9-]+/g, '-')
  .replace(/-{2,}/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 60);

export const OnlineStoreSettings: React.FC = () => {
  const {settings, saasStores, updateOnlineStore, triggerToast} = useAppState();
  const fallbackLocation = saasStores[0]?.id ? [saasStores[0].id] : [];
  const initial = settings.onlineStore;
  const [config, setConfig] = useState<OnlineStoreConfig>(() => initial || ({
    enabled: false,
    publicName: settings.storeName,
    description: '',
    contactNumber: settings.phone,
    whatsappNumber: settings.phone,
    slug: normalizeSlug(settings.storeName),
    participatingLocationIds: fallbackLocation,
    pickupEnabled: true,
    deliveryEnabled: false,
    deliveryCharge: 0,
    minimumOrder: 0,
    paymentMethods: ['COD', 'PAY_AT_STORE']
  }));
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [processingLogo, setProcessingLogo] = useState(false);
  const publicUrl = useMemo(() => `${window.location.origin}/store/${config.slug || 'your-store'}`, [config.slug]);

  useEffect(() => {
    if (!config.slug) return setQrDataUrl('');
    void QRCode.toDataURL(publicUrl, {width: 220, margin: 1, color: {dark: '#111827', light: '#ffffff'}})
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [config.slug, publicUrl]);

  const update = <K extends keyof OnlineStoreConfig>(key: K, value: OnlineStoreConfig[K]) =>
    setConfig(current => ({...current, [key]: value}));

  const toggleLocation = (id: string) => update(
    'participatingLocationIds',
    config.participatingLocationIds.includes(id)
      ? config.participatingLocationIds.filter(locationId => locationId !== id)
      : [...config.participatingLocationIds, id]
  );

  const togglePayment = (method: OnlineStoreConfig['paymentMethods'][number]) => update(
    'paymentMethods',
    config.paymentMethods.includes(method)
      ? config.paymentMethods.filter(item => item !== method)
      : [...config.paymentMethods, method]
  );

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const slug = normalizeSlug(config.slug);
    if (!config.publicName.trim() || slug.length < 3) return triggerToast('Enter a store name and a public slug of at least 3 characters.', 'warning');
    if (config.participatingLocationIds.length === 0) return triggerToast('Select at least one participating QPOS location.', 'warning');
    if (!config.pickupEnabled && !config.deliveryEnabled) return triggerToast('Enable pickup or local delivery.', 'warning');
    if (config.paymentMethods.length === 0) return triggerToast('Select at least one payment method.', 'warning');
    const saved = {...config, slug, publicName: config.publicName.trim(), description: config.description.trim()};
    setConfig(saved);
    if (await updateOnlineStore(saved)) triggerToast('Online Store settings saved and published.', 'success');
  };

  const copyUrl = async () => {
    await navigator.clipboard.writeText(publicUrl);
    triggerToast('Public store URL copied.', 'success');
  };

  const shareUrl = async () => {
    if (navigator.share) await navigator.share({title: config.publicName, url: publicUrl});
    else await copyUrl();
  };

  const uploadLogo = async (file?: File) => {
    if (!file) return;
    setProcessingLogo(true);
    try {
      update('logo', await compressProductImage(file));
    } catch {
      triggerToast('Could not process that logo.', 'error');
    } finally {
      setProcessingLogo(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-5 pb-16">
      <header className="flex flex-col gap-4 border-b border-gray-200 pb-5 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><Store className="h-5 w-5 text-emerald-500" /><h2 className="text-xl font-black">Online Store</h2></div>
          <p className="mt-1 text-xs text-gray-500">Publish selected products from the same QPOS catalogue and locations.</p>
        </div>
        <label className="flex cursor-pointer items-center gap-3 text-xs font-bold">
          <span>{config.enabled ? 'Store enabled' : 'Store disabled'}</span>
          <input type="checkbox" checked={config.enabled} onChange={event => update('enabled', event.target.checked)} className="h-5 w-5 accent-emerald-500" />
        </label>
      </header>

      <section className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Public store name"><input value={config.publicName} onChange={event => update('publicName', event.target.value)} className="online-input" /></Field>
            <Field label="Public store slug"><div className="flex items-center rounded-xl border border-gray-200 bg-gray-50 px-3 dark:border-gray-800 dark:bg-gray-900"><span className="text-xs text-gray-400">/store/</span><input value={config.slug} onChange={event => update('slug', normalizeSlug(event.target.value))} className="min-w-0 flex-1 bg-transparent py-3 text-xs font-mono outline-none" /></div></Field>
            <Field label="Contact number"><input type="tel" value={config.contactNumber} onChange={event => update('contactNumber', event.target.value)} className="online-input" /></Field>
            <Field label="WhatsApp number"><input type="tel" value={config.whatsappNumber} onChange={event => update('whatsappNumber', event.target.value)} className="online-input" /></Field>
          </div>
          <Field label="Store description"><textarea rows={3} value={config.description} onChange={event => update('description', event.target.value)} className="online-input resize-none" placeholder="Short public description of this business" /></Field>
          <div>
            <p className="mb-2 text-xs font-bold">Store logo</p>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800">{config.logo ? <img src={config.logo} alt="Store logo" className="h-full w-full object-contain" /> : <Store className="h-6 w-6 text-gray-300" />}</div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold dark:border-gray-800"><ImagePlus className="h-4 w-4" />{processingLogo ? 'Processing...' : 'Choose logo'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={processingLogo} onChange={event => void uploadLogo(event.target.files?.[0])} className="hidden" /></label>
            </div>
          </div>
        </div>

        <aside className="border-l-0 border-gray-200 lg:border-l lg:pl-5 dark:border-gray-800">
          <p className="text-xs font-bold">Public link</p>
          <p className="mt-2 break-all font-mono text-[10px] text-gray-500">{publicUrl}</p>
          {qrDataUrl && <img src={qrDataUrl} alt="Online store QR code" className="mx-auto mt-4 h-40 w-40" />}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void copyUrl()} className="online-action"><Copy className="h-4 w-4" />Copy</button>
            <button type="button" onClick={() => void shareUrl()} className="online-action"><Share2 className="h-4 w-4" />Share</button>
          </div>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600"><ExternalLink className="h-3.5 w-3.5" />Open public storefront</a>
        </aside>
      </section>

      <section className="border-t border-gray-200 pt-5 dark:border-gray-800">
        <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-emerald-500" /><h3 className="text-sm font-black">Participating locations</h3></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{saasStores.map(location => <label key={location.id} className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-200 px-3 py-3 text-xs dark:border-gray-800"><span><strong className="block">{location.name}</strong><span className="text-[10px] text-gray-400">{location.city}</span></span><input type="checkbox" checked={config.participatingLocationIds.includes(location.id)} onChange={() => toggleLocation(location.id)} className="h-4 w-4 accent-emerald-500" /></label>)}</div>
      </section>

      <section className="grid gap-5 border-t border-gray-200 pt-5 dark:border-gray-800 lg:grid-cols-2">
        <div><div className="flex items-center gap-2"><Truck className="h-4 w-4 text-emerald-500" /><h3 className="text-sm font-black">Fulfilment</h3></div><div className="mt-3 space-y-2"><Toggle label="Store pickup" checked={config.pickupEnabled} onChange={value => update('pickupEnabled', value)} /><Toggle label="Local delivery" checked={config.deliveryEnabled} onChange={value => update('deliveryEnabled', value)} /></div>{config.deliveryEnabled && <div className="mt-3 grid grid-cols-3 gap-2"><NumberField label="Charge" value={config.deliveryCharge} onChange={value => update('deliveryCharge', value)} /><NumberField label="Minimum" value={config.minimumOrder} onChange={value => update('minimumOrder', value)} /><NumberField label="Max km" value={config.maximumDeliveryDistanceKm || 0} onChange={value => update('maximumDeliveryDistanceKm', value || undefined)} /></div>}</div>
        <div><div className="flex items-center gap-2"><WalletCards className="h-4 w-4 text-emerald-500" /><h3 className="text-sm font-black">Payment methods</h3></div><div className="mt-3 grid gap-2 sm:grid-cols-3">{([['COD', 'Cash on delivery'], ['PAY_AT_STORE', 'Pay at store'], ['ONLINE', 'Online payment']] as const).map(([method, label]) => <Toggle key={method} label={label} checked={config.paymentMethods.includes(method)} onChange={() => togglePayment(method)} />)}</div></div>
      </section>

      <div className="flex justify-center border-t border-gray-200 pt-5 dark:border-gray-800"><button type="submit" className="inline-flex min-w-48 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-white hover:bg-emerald-600"><Save className="h-4 w-4" />Save Online Store</button></div>
      <style>{`.online-input{width:100%;border:1px solid rgb(229 231 235);border-radius:.75rem;background:rgb(249 250 251);padding:.75rem;font-size:.75rem;outline:none}.dark .online-input{border-color:rgb(31 41 55);background:rgb(17 24 39)}.online-action{display:flex;align-items:center;justify-content:center;gap:.375rem;border:1px solid rgb(229 231 235);border-radius:.75rem;padding:.625rem;font-size:.75rem;font-weight:700}.dark .online-action{border-color:rgb(31 41 55)}`}</style>
    </form>
  );
};

const Field = ({label, children}: {label: string; children: React.ReactNode}) => <label className="block"><span className="mb-1.5 block text-xs font-bold">{label}</span>{children}</label>;
const Toggle: React.FC<{label: string; checked: boolean; onChange: (value: boolean) => void}> = ({label, checked, onChange}) => <label className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-200 px-3 py-3 text-xs font-bold dark:border-gray-800"><span>{label}</span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="h-4 w-4 accent-emerald-500" /></label>;
const NumberField = ({label, value, onChange}: {label: string; value: number; onChange: (value: number) => void}) => <label><span className="mb-1 block text-[10px] font-bold text-gray-500">{label}</span><input type="number" min="0" step="0.01" value={value} onChange={event => onChange(Math.max(0, Number(event.target.value)))} className="online-input font-mono" /></label>;
