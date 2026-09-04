import React, {useEffect, useMemo, useState} from 'react';
import {ArrowLeft, Check, ChevronRight, MapPin, Minus, PackageSearch, Plus, Search, ShoppingBag, Store, Truck, X} from 'lucide-react';
import {loadPublicStore, PublicStorePayload, PublicStoreProduct} from '../lib/publicStore';

interface CartLine {
  product: PublicStoreProduct;
  quantity: number;
  variant?: {id: string; name: string; price: number};
}

const imageValue = (value: string, name: string, className: string) => {
  const isImage = value.startsWith('data:image/') || /^https?:\/\//i.test(value) || value.startsWith('/');
  return isImage ? <img src={value} alt={name} className={`${className} object-cover`} /> : <span className="text-3xl">{value || '📦'}</span>;
};

const lineKey = (line: Pick<CartLine, 'product' | 'variant'>) => `${line.product.id}:${line.variant?.id || 'default'}`;

export const PublicStorefront: React.FC<{slug: string}> = ({slug}) => {
  const [payload, setPayload] = useState<PublicStorePayload | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState<PublicStoreProduct | null>(null);
  const [cart, setCart] = useState<CartLine[]>(() => {
    try { return JSON.parse(localStorage.getItem(`qpos-store-cart:${slug}`) || '[]'); } catch { return []; }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [fulfilment, setFulfilment] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [customerName, setCustomerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'PAY_AT_STORE' | 'ONLINE'>('PAY_AT_STORE');
  const [checkoutReady, setCheckoutReady] = useState(false);

  useEffect(() => {
    document.getElementById('qpos-startup-splash')?.remove();
  }, []);

  useEffect(() => {
    let active = true;
    loadPublicStore(slug).then(data => {
      if (!active) return;
      setPayload(data);
      setFulfilment(data.store.pickupEnabled ? 'PICKUP' : 'DELIVERY');
      setPaymentMethod(data.store.paymentMethods[0] || 'PAY_AT_STORE');
      document.title = `${data.store.name} | QPOS`;
    }).catch(reason => active && setError(reason instanceof Error ? reason.message : 'Store unavailable'));
    return () => { active = false; };
  }, [slug]);

  useEffect(() => localStorage.setItem(`qpos-store-cart:${slug}`, JSON.stringify(cart)), [cart, slug]);

  const categories = useMemo(() => ['All', ...Array.from(new Set(payload?.products.map(product => product.category) || []))], [payload]);
  const visibleProducts = useMemo(() => (payload?.products || []).filter(product => {
    const query = search.trim().toLowerCase();
    return (category === 'All' || product.category === category) && (!query || `${product.name} ${product.brand} ${product.category}`.toLowerCase().includes(query));
  }), [payload, search, category]);
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce((sum, line) => sum + (line.variant?.price ?? line.product.price) * line.quantity, 0);
  const total = subtotal + (fulfilment === 'DELIVERY' ? payload?.store.deliveryCharge || 0 : 0);
  const locationChecks = useMemo(() => (payload?.locations || []).map(location => {
    const unavailable = cart.filter(line => (line.product.availability[location.key] || 0) < line.quantity);
    return {...location, unavailable};
  }), [payload, cart]);
  const selectedCheck = locationChecks.find(location => location.key === selectedLocation);

  const addToCart = (product: PublicStoreProduct, variant?: CartLine['variant']) => {
    const key = `${product.id}:${variant?.id || 'default'}`;
    setCart(current => {
      const existing = current.find(line => lineKey(line) === key);
      return existing
        ? current.map(line => lineKey(line) === key ? {...line, quantity: line.quantity + 1} : line)
        : [...current, {product, variant, quantity: 1}];
    });
    setSelectedProduct(null);
  };

  const changeQuantity = (key: string, delta: number) => setCart(current => current
    .map(line => lineKey(line) === key ? {...line, quantity: Math.max(0, line.quantity + delta)} : line)
    .filter(line => line.quantity > 0));

  const beginCheckout = () => {
    setCartOpen(false);
    setCheckoutOpen(true);
    if (!selectedLocation) setSelectedLocation(locationChecks.find(location => location.unavailable.length === 0)?.key || '');
  };

  const reviewCheckout = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCheck || selectedCheck.unavailable.length) return;
    const draft = {slug, cart: cart.map(line => ({productId: line.product.id, variantId: line.variant?.id, quantity: line.quantity})), selectedLocation, fulfilment, customerName, mobile, address, paymentMethod, subtotal, total, createdAt: new Date().toISOString()};
    sessionStorage.setItem(`qpos-checkout-draft:${slug}`, JSON.stringify(draft));
    setCheckoutReady(true);
  };

  if (error) return <StoreState icon={<PackageSearch />} title="Store unavailable" message={error} />;
  if (!payload) return <StoreState icon={<Store />} title="Opening store" message="Loading the latest catalogue and availability..." loading />;

  return (
    <div className="min-h-[100dvh] bg-[#f5f7f8] pb-28 text-gray-950">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-white">{payload.store.logo ? imageValue(payload.store.logo, payload.store.name, 'h-full w-full') : <Store className="h-5 w-5 text-emerald-600" />}</div>
          <div className="min-w-0 flex-1"><h1 className="truncate text-base font-black sm:text-lg">{payload.store.name}</h1><p className="truncate text-[11px] text-gray-500">{payload.store.description || 'Order directly from this QPOS store'}</p></div>
          <button type="button" onClick={() => setCartOpen(true)} className="relative flex h-11 w-11 items-center justify-center rounded-md bg-gray-950 text-white" aria-label="Open cart"><ShoppingBag className="h-5 w-5" />{cartCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-black">{cartCount}</span>}</button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="relative"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search products" className="h-12 w-full rounded-md border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-emerald-500" /></div>
        <div className="touch-scroll mt-3 flex gap-2 overflow-x-auto pb-2">{categories.map(item => <button key={item} type="button" onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${category === item ? 'bg-gray-950 text-white' : 'border border-gray-200 bg-white text-gray-600'}`}>{item}</button>)}</div>

        {visibleProducts.length ? <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">{visibleProducts.map(product => {
          const available = Math.max(0, ...Object.values(product.availability).map(Number));
          return <article key={product.id} className="min-w-0 overflow-hidden rounded-md border border-gray-200 bg-white">
            <button type="button" onClick={() => setSelectedProduct(product)} className="block w-full text-left"><div className="flex aspect-square items-center justify-center overflow-hidden bg-gray-50">{imageValue(product.image, product.name, 'h-full w-full')}</div><div className="p-3"><p className="line-clamp-2 min-h-10 text-sm font-black leading-5">{product.name}</p><p className="mt-1 truncate text-[10px] font-semibold uppercase text-gray-400">{product.brand || product.category}</p><div className="mt-3 flex items-end justify-between gap-2"><span className="font-mono text-sm font-black text-emerald-700">{payload.store.currency}{product.price.toFixed(2)}</span><ChevronRight className="h-4 w-4 text-gray-400" /></div></div></button>
            <div className="px-3 pb-3"><button type="button" disabled={available < 1} onClick={() => product.variants.length ? setSelectedProduct(product) : addToCart(product)} className="h-10 w-full rounded-md bg-emerald-500 text-xs font-black text-white disabled:bg-gray-200 disabled:text-gray-500">{available < 1 ? 'Unavailable' : product.variants.length ? 'Choose option' : 'Add to cart'}</button></div>
          </article>;
        })}</div> : <div className="py-24 text-center"><PackageSearch className="mx-auto h-9 w-9 text-gray-300" /><p className="mt-3 font-bold">No matching products</p></div>}
      </main>

      {cartCount > 0 && <div className="fixed inset-x-0 bottom-4 z-20 px-4"><button type="button" onClick={() => setCartOpen(true)} className="mx-auto flex h-14 w-full max-w-md items-center justify-between rounded-md bg-gray-950 px-5 text-white shadow-2xl"><span className="text-sm font-black">{cartCount} {cartCount === 1 ? 'item' : 'items'}</span><span className="font-mono text-sm font-black">View cart · {payload.store.currency}{subtotal.toFixed(2)}</span></button></div>}

      {selectedProduct && <ProductSheet product={selectedProduct} currency={payload.store.currency} onClose={() => setSelectedProduct(null)} onAdd={addToCart} />}
      {cartOpen && <CartSheet cart={cart} currency={payload.store.currency} subtotal={subtotal} onClose={() => setCartOpen(false)} onChange={changeQuantity} onCheckout={beginCheckout} />}
      {checkoutOpen && <CheckoutSheet payload={payload} cart={cart} subtotal={subtotal} total={total} locationChecks={locationChecks} selectedLocation={selectedLocation} setSelectedLocation={setSelectedLocation} fulfilment={fulfilment} setFulfilment={setFulfilment} customerName={customerName} setCustomerName={setCustomerName} mobile={mobile} setMobile={setMobile} address={address} setAddress={setAddress} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} ready={checkoutReady} onBack={() => {setCheckoutOpen(false); setCheckoutReady(false);}} onSubmit={reviewCheckout} />}
    </div>
  );
};

const Sheet = ({children, onClose}: {children: React.ReactNode; onClose: () => void}) => <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-6" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="max-h-[92dvh] w-full overflow-y-auto rounded-t-md bg-white shadow-2xl sm:max-w-lg sm:rounded-md">{children}</section></div>;

const ProductSheet = ({product, currency, onClose, onAdd}: {product: PublicStoreProduct; currency: string; onClose: () => void; onAdd: (product: PublicStoreProduct, variant?: CartLine['variant']) => void}) => {
  const [variant, setVariant] = useState(product.variants[0]);
  return <Sheet onClose={onClose}><div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-gray-50">{imageValue(product.image, product.name, 'h-full w-full')}<button type="button" onClick={onClose} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow" aria-label="Close"><X className="h-5 w-5" /></button></div><div className="p-5"><p className="text-xs font-bold uppercase text-emerald-600">{product.category}</p><h2 className="mt-1 text-xl font-black">{product.name}</h2><p className="mt-2 text-sm leading-6 text-gray-500">{product.description || `${product.brand} ${product.unit}`}</p>{product.variants.length > 0 && <div className="mt-5"><p className="text-xs font-black">Choose an option</p><div className="mt-2 grid gap-2">{product.variants.map(item => <button type="button" key={item.id} onClick={() => setVariant(item)} className={`flex min-h-12 items-center justify-between rounded-md border px-4 text-sm ${variant?.id === item.id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'}`}><span className="font-bold">{item.name}</span><span className="font-mono">{currency}{item.price.toFixed(2)}</span></button>)}</div></div>}<button type="button" onClick={() => onAdd(product, variant)} className="mt-6 h-12 w-full rounded-md bg-emerald-500 text-sm font-black text-white">Add to cart · {currency}{(variant?.price ?? product.price).toFixed(2)}</button></div></Sheet>;
};

const CartSheet = ({cart, currency, subtotal, onClose, onChange, onCheckout}: {cart: CartLine[]; currency: string; subtotal: number; onClose: () => void; onChange: (key: string, delta: number) => void; onCheckout: () => void}) => <Sheet onClose={onClose}><div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white p-4"><h2 className="text-lg font-black">Your cart</h2><button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center" aria-label="Close cart"><X className="h-5 w-5" /></button></div><div className="space-y-4 p-4">{cart.map(line => <div key={lineKey(line)} className="flex gap-3"><div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-50">{imageValue(line.product.image, line.product.name, 'h-full w-full')}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{line.product.name}</p><p className="text-[11px] text-gray-500">{line.variant?.name || line.product.unit}</p><p className="mt-1 font-mono text-xs font-black">{currency}{((line.variant?.price ?? line.product.price) * line.quantity).toFixed(2)}</p></div><div className="flex h-10 items-center rounded-md border border-gray-200"><button type="button" onClick={() => onChange(lineKey(line), -1)} className="flex h-10 w-9 items-center justify-center" aria-label="Decrease quantity"><Minus className="h-3.5 w-3.5" /></button><span className="w-7 text-center text-xs font-black">{line.quantity}</span><button type="button" onClick={() => onChange(lineKey(line), 1)} className="flex h-10 w-9 items-center justify-center" aria-label="Increase quantity"><Plus className="h-3.5 w-3.5" /></button></div></div>)}</div><div className="sticky bottom-0 border-t border-gray-200 bg-white p-4"><div className="mb-3 flex justify-between text-sm"><span>Subtotal</span><strong className="font-mono">{currency}{subtotal.toFixed(2)}</strong></div><button type="button" disabled={!cart.length} onClick={onCheckout} className="h-12 w-full rounded-md bg-gray-950 text-sm font-black text-white disabled:bg-gray-200">Continue to checkout</button></div></Sheet>;

interface CheckoutProps {payload: PublicStorePayload; cart: CartLine[]; subtotal: number; total: number; locationChecks: Array<{key: string; name: string; city: string; unavailable: CartLine[]}>; selectedLocation: string; setSelectedLocation: (value: string) => void; fulfilment: 'PICKUP' | 'DELIVERY'; setFulfilment: (value: 'PICKUP' | 'DELIVERY') => void; customerName: string; setCustomerName: (value: string) => void; mobile: string; setMobile: (value: string) => void; address: string; setAddress: (value: string) => void; paymentMethod: 'COD' | 'PAY_AT_STORE' | 'ONLINE'; setPaymentMethod: (value: 'COD' | 'PAY_AT_STORE' | 'ONLINE') => void; ready: boolean; onBack: () => void; onSubmit: (event: React.FormEvent) => void;}
const CheckoutSheet: React.FC<CheckoutProps> = ({payload, cart, subtotal, total, locationChecks, selectedLocation, setSelectedLocation, fulfilment, setFulfilment, customerName, setCustomerName, mobile, setMobile, address, setAddress, paymentMethod, setPaymentMethod, ready, onBack, onSubmit}) => <Sheet onClose={onBack}>{ready ? <div className="p-8 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-7 w-7" /></div><h2 className="mt-5 text-xl font-black">Checkout details ready</h2><p className="mt-2 text-sm leading-6 text-gray-500">Your cart and fulfilment choice are saved. Mobile verification and final order submission are added in Phase 3.</p><button type="button" onClick={onBack} className="mt-6 h-12 w-full rounded-md bg-gray-950 text-sm font-black text-white">Return to store</button></div> : <form onSubmit={onSubmit}><div className="sticky top-0 flex items-center gap-3 border-b border-gray-200 bg-white p-4"><button type="button" onClick={onBack} className="flex h-10 w-10 items-center justify-center" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button><h2 className="text-lg font-black">Checkout</h2></div><div className="space-y-6 p-4"><div><p className="text-xs font-black uppercase text-gray-500">1. Fulfilment</p><div className="mt-2 grid grid-cols-2 gap-2">{payload.store.pickupEnabled && <Choice active={fulfilment === 'PICKUP'} onClick={() => setFulfilment('PICKUP')} icon={<ShoppingBag className="h-4 w-4" />} label="Store pickup" />}{payload.store.deliveryEnabled && <Choice active={fulfilment === 'DELIVERY'} onClick={() => setFulfilment('DELIVERY')} icon={<Truck className="h-4 w-4" />} label="Local delivery" />}</div></div><div><p className="text-xs font-black uppercase text-gray-500">2. Choose one location</p><div className="mt-2 space-y-2">{locationChecks.map(location => <button type="button" key={location.key} disabled={location.unavailable.length > 0} onClick={() => setSelectedLocation(location.key)} className={`w-full rounded-md border p-3 text-left ${selectedLocation === location.key ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'} disabled:bg-gray-50 disabled:text-gray-400`}><span className="flex items-center gap-2 text-sm font-black"><MapPin className="h-4 w-4" />{location.name}</span><span className="mt-1 block text-[11px]">{location.unavailable.length ? `${location.unavailable.length} cart ${location.unavailable.length === 1 ? 'item is' : 'items are'} unavailable` : `${location.city || 'Store'} · Complete cart available`}</span></button>)}</div></div><div><p className="text-xs font-black uppercase text-gray-500">3. Your details</p><div className="mt-2 grid gap-2"><input required value={customerName} onChange={event => setCustomerName(event.target.value)} placeholder="Full name" className="store-field" /><input required type="tel" inputMode="numeric" pattern="[0-9+ ]{10,15}" value={mobile} onChange={event => setMobile(event.target.value)} placeholder="Mobile number" className="store-field" />{fulfilment === 'DELIVERY' && <textarea required rows={3} value={address} onChange={event => setAddress(event.target.value)} placeholder="Delivery address" className="store-field resize-none" />}</div></div><div><p className="text-xs font-black uppercase text-gray-500">4. Payment</p><select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value as CheckoutProps['paymentMethod'])} className="store-field mt-2">{payload.store.paymentMethods.map(method => <option key={method} value={method}>{method === 'COD' ? 'Cash on delivery' : method === 'PAY_AT_STORE' ? 'Pay at store' : 'Online payment'}</option>)}</select></div><div className="rounded-md bg-gray-50 p-4 text-sm"><div className="flex justify-between"><span>Items</span><span>{cart.reduce((sum, line) => sum + line.quantity, 0)}</span></div><div className="mt-2 flex justify-between"><span>Subtotal</span><span className="font-mono">{payload.store.currency}{subtotal.toFixed(2)}</span></div>{fulfilment === 'DELIVERY' && <div className="mt-2 flex justify-between"><span>Delivery</span><span className="font-mono">{payload.store.currency}{payload.store.deliveryCharge.toFixed(2)}</span></div>}<div className="mt-3 flex justify-between border-t border-gray-200 pt-3 font-black"><span>Total</span><span className="font-mono">{payload.store.currency}{total.toFixed(2)}</span></div></div></div><div className="sticky bottom-0 border-t border-gray-200 bg-white p-4"><button type="submit" disabled={!selectedLocation || locationChecks.find(item => item.key === selectedLocation)?.unavailable.length !== 0 || (fulfilment === 'DELIVERY' && subtotal < payload.store.minimumOrder)} className="h-12 w-full rounded-md bg-emerald-500 text-sm font-black text-white disabled:bg-gray-200 disabled:text-gray-500">Review order · {payload.store.currency}{total.toFixed(2)}</button>{fulfilment === 'DELIVERY' && subtotal < payload.store.minimumOrder && <p className="mt-2 text-center text-[11px] font-bold text-amber-700">Minimum delivery order is {payload.store.currency}{payload.store.minimumOrder.toFixed(2)}</p>}</div></form>}<style>{`.store-field{width:100%;border:1px solid #e5e7eb;border-radius:.375rem;background:#fff;padding:.8rem;font-size:.875rem;outline:none}.store-field:focus{border-color:#10b981}`}</style></Sheet>;

const Choice = ({active, onClick, icon, label}: {active: boolean; onClick: () => void; icon: React.ReactNode; label: string}) => <button type="button" onClick={onClick} className={`flex min-h-12 items-center justify-center gap-2 rounded-md border text-xs font-black ${active ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200'}`}>{icon}{label}</button>;
const StoreState = ({icon, title, message, loading}: {icon: React.ReactNode; title: string; message: string; loading?: boolean}) => <div className="flex min-h-[100dvh] items-center justify-center bg-[#f5f7f8] p-6 text-center"><div><div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-white text-emerald-600 shadow-sm ${loading ? 'animate-pulse' : ''}`}>{icon}</div><h1 className="mt-5 text-xl font-black">{title}</h1><p className="mt-2 max-w-sm text-sm text-gray-500">{message}</p></div></div>;
