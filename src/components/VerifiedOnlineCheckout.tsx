import React, {useEffect, useMemo, useState} from 'react';
import {ArrowLeft, Check, MapPin, ShoppingBag, Truck, X} from 'lucide-react';
import {CustomerOtpConfirmation, sendCustomerOtp, verifyCustomerOtp} from '../lib/customerPhoneAuth';
import {PublicStorePayload, PublicStoreProduct} from '../lib/publicStore';

interface CartLine {product: PublicStoreProduct; quantity: number; variant?: {id: string; name: string; price: number}}
interface LocationCheck {key: string; name: string; city: string; unavailable: CartLine[]}

interface Props {
  slug: string;
  payload: PublicStorePayload;
  cart: CartLine[];
  subtotal: number;
  total: number;
  locationChecks: LocationCheck[];
  selectedLocation: string;
  setSelectedLocation: (value: string) => void;
  fulfilment: 'PICKUP' | 'DELIVERY';
  setFulfilment: (value: 'PICKUP' | 'DELIVERY') => void;
  customerName: string;
  setCustomerName: (value: string) => void;
  mobile: string;
  setMobile: (value: string) => void;
  address: string;
  setAddress: (value: string) => void;
  customerNote: string;
  setCustomerNote: (value: string) => void;
  tableMode?: boolean;
  paymentMethod: 'COD' | 'PAY_AT_STORE' | 'ONLINE';
  setPaymentMethod: (value: 'COD' | 'PAY_AT_STORE' | 'ONLINE') => void;
  onClose: () => void;
  onSubmitted: (idToken?: string) => Promise<void>;
  submittedOrder?: {orderNumber: string; status: string};
}

export const VerifiedOnlineCheckout: React.FC<Props> = props => {
  const otpEnabled = import.meta.env.VITE_ONLINE_ORDER_OTP_ENABLED === 'true';
  const [otpConfirmation, setOtpConfirmation] = useState<CustomerOtpConfirmation | null>(null);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selectedCheck = props.locationChecks.find(location => location.key === props.selectedLocation);
  const belowMinimum = props.fulfilment === 'DELIVERY' && props.subtotal < props.payload.store.minimumOrder;
  const isRestaurant = props.payload.store.mode === 'Restaurant';
  const availablePayments = useMemo(() => props.payload.store.paymentMethods.filter(method => method !== 'ONLINE'), [props.payload.store.paymentMethods]);

  useEffect(() => {
    if (availablePayments.length && !availablePayments.includes(props.paymentMethod)) props.setPaymentMethod(availablePayments[0]);
  }, [availablePayments, props.paymentMethod, props.setPaymentMethod]);

  const requestOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCheck || selectedCheck.unavailable.length || belowMinimum || !availablePayments.length) return;
    setBusy(true); setError('');
    try {
      if (otpEnabled) setOtpConfirmation(await sendCustomerOtp(props.mobile, 'qpos-order-recaptcha'));
      else await props.onSubmitted();
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not send the verification code'); }
    finally { setBusy(false); }
  };

  const submitOrder = async () => {
    if (!otpConfirmation) return;
    setBusy(true); setError('');
    try { await props.onSubmitted(await verifyCustomerOtp(otpConfirmation, otp)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The order could not be submitted'); }
    finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-6" onMouseDown={event => event.target === event.currentTarget && props.onClose()}><section className="max-h-[92dvh] w-full overflow-y-auto rounded-t-md bg-white shadow-2xl sm:max-w-lg sm:rounded-md">
    {props.submittedOrder ? <div className="p-8 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-7 w-7" /></div><h2 className="mt-5 text-xl font-black">Order received</h2><p className="mt-2 text-sm text-gray-500">Order <strong>{props.submittedOrder.orderNumber}</strong> is waiting for store confirmation.</p><button type="button" onClick={props.onClose} className="mt-6 h-12 w-full rounded-md bg-gray-950 text-sm font-black text-white">Continue shopping</button></div> : <form onSubmit={requestOtp}>
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white p-4"><button type="button" onClick={props.onClose} className="flex h-10 w-10 items-center justify-center" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button><h2 className="flex-1 text-lg font-black">Checkout</h2><button type="button" onClick={props.onClose} className="flex h-10 w-10 items-center justify-center" aria-label="Close"><X className="h-5 w-5" /></button></div>
      <div className="space-y-6 p-4">
        <Section title="1. Fulfilment"><div className="grid grid-cols-2 gap-2">{props.payload.store.pickupEnabled && <Choice active={props.fulfilment === 'PICKUP'} onClick={() => props.setFulfilment('PICKUP')} icon={<ShoppingBag className="h-4 w-4" />} label={isRestaurant ? (props.tableMode ? 'At this table' : 'Takeaway') : 'Store pickup'} />}{props.payload.store.deliveryEnabled && !props.tableMode && <Choice active={props.fulfilment === 'DELIVERY'} onClick={() => props.setFulfilment('DELIVERY')} icon={<Truck className="h-4 w-4" />} label="Local delivery" />}</div></Section>
        <Section title={isRestaurant ? '2. Choose one outlet' : '2. One fulfilment location'}><div className="space-y-2">{props.locationChecks.map(location => <button type="button" key={location.key} disabled={location.unavailable.length > 0} onClick={() => props.setSelectedLocation(location.key)} className={`w-full rounded-md border p-3 text-left ${props.selectedLocation === location.key ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'} disabled:bg-gray-50 disabled:text-gray-400`}><span className="flex items-center gap-2 text-sm font-black"><MapPin className="h-4 w-4" />{location.name}</span><span className="mt-1 block text-[11px]">{location.unavailable.length ? `${location.unavailable.length} cart item unavailable` : `${location.city || (isRestaurant ? 'Outlet' : 'Store')} · Complete ${isRestaurant ? 'order' : 'cart'} available`}</span></button>)}</div></Section>
        <Section title="3. Customer details"><div className="grid gap-2"><input required value={props.customerName} onChange={event => props.setCustomerName(event.target.value)} placeholder="Full name" className="verified-field" /><input required type="tel" inputMode="tel" value={props.mobile} onChange={event => props.setMobile(event.target.value)} placeholder="Mobile number" className="verified-field" />{props.fulfilment === 'DELIVERY' && <textarea required rows={3} value={props.address} onChange={event => props.setAddress(event.target.value)} placeholder="Delivery address" className="verified-field resize-none" />}</div></Section>
        {isRestaurant && <Section title="4. Kitchen instructions (optional)"><textarea rows={2} maxLength={300} value={props.customerNote} onChange={event => props.setCustomerNote(event.target.value)} placeholder="Less spicy, no onion, allergy note..." className="verified-field resize-none" /></Section>}
        <Section title={isRestaurant ? '5. Payment' : '4. Payment'}>{availablePayments.length ? <select value={props.paymentMethod} onChange={event => props.setPaymentMethod(event.target.value as Props['paymentMethod'])} className="verified-field">{availablePayments.map(method => <option key={method} value={method}>{method === 'COD' ? (props.tableMode ? 'Pay at table' : 'Cash on delivery') : isRestaurant ? 'Pay at outlet' : 'Pay at store'}</option>)}</select> : <p className="rounded-md bg-amber-50 p-3 text-xs font-bold text-amber-800">Online payment checkout is not active yet. Ask the store to enable Cash on delivery or Pay at store.</p>}</Section>
        <div className="rounded-md bg-gray-50 p-4 text-sm"><Row label="Items" value={String(props.cart.reduce((sum, line) => sum + line.quantity, 0))} /><Row label="Subtotal" value={`${props.payload.store.currency}${props.subtotal.toFixed(2)}`} />{props.fulfilment === 'DELIVERY' && <Row label="Delivery" value={`${props.payload.store.currency}${props.payload.store.deliveryCharge.toFixed(2)}`} />}<div className="mt-3 flex justify-between border-t border-gray-200 pt-3 font-black"><span>Total</span><span className="font-mono">{props.payload.store.currency}{props.total.toFixed(2)}</span></div></div>
        {otpEnabled && otpConfirmation && <Section title="5. Verify mobile"><div className="flex gap-2"><input autoFocus required inputMode="numeric" maxLength={6} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, ''))} placeholder="6-digit OTP" className="verified-field min-w-0 flex-1" /><button type="button" disabled={busy || otp.length !== 6} onClick={() => void submitOrder()} className="rounded-md bg-emerald-500 px-5 text-xs font-black text-white disabled:bg-gray-200">Verify</button></div><button type="button" onClick={() => setOtpConfirmation(null)} className="mt-2 text-xs font-bold text-gray-500">Change mobile number</button></Section>}
        {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
        {otpEnabled && <div id="qpos-order-recaptcha" />}
      </div>
      {!otpConfirmation && <div className="sticky bottom-0 border-t border-gray-200 bg-white p-4"><button type="submit" disabled={busy || !props.selectedLocation || selectedCheck?.unavailable.length !== 0 || belowMinimum || !availablePayments.length} className="h-12 w-full rounded-md bg-emerald-500 text-sm font-black text-white disabled:bg-gray-200 disabled:text-gray-500">{busy ? (otpEnabled ? 'Sending code...' : 'Placing order...') : `${otpEnabled ? 'Verify mobile & submit' : 'Place order'} · ${props.payload.store.currency}${props.total.toFixed(2)}`}</button>{belowMinimum && <p className="mt-2 text-center text-[11px] font-bold text-amber-700">Minimum delivery order is {props.payload.store.currency}{props.payload.store.minimumOrder.toFixed(2)}</p>}</div>}
    </form>}
    <style>{`.verified-field{width:100%;border:1px solid #e5e7eb;border-radius:.375rem;background:#fff;padding:.8rem;font-size:.875rem;outline:none}.verified-field:focus{border-color:#10b981}`}</style>
  </section></div>;
};

const Section = ({title, children}: {title: string; children: React.ReactNode}) => <div><p className="mb-2 text-xs font-black uppercase text-gray-500">{title}</p>{children}</div>;
const Choice = ({active, onClick, icon, label}: {active: boolean; onClick: () => void; icon: React.ReactNode; label: string}) => <button type="button" onClick={onClick} className={`flex min-h-12 items-center justify-center gap-2 rounded-md border text-xs font-black ${active ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200'}`}>{icon}{label}</button>;
const Row = ({label, value}: {label: string; value: string}) => <div className="mb-2 flex justify-between"><span>{label}</span><span className="font-mono">{value}</span></div>;
