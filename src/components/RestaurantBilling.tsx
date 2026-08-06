import React, {useMemo, useState} from 'react';
import {Armchair, ChefHat, Minus, Plus, Search, ShoppingBag, Trash2, Truck, UsersRound, UtensilsCrossed, WalletCards} from 'lucide-react';
import {useAppState} from '../lib/stateContext';
import {Product, Sale, SaleItem} from '../types';

type OrderType = NonNullable<Sale['orderType']>;
type CartLine = {product: Product; quantity: number};

export const RestaurantBilling: React.FC = () => {
  const {products, addSale, currentUser, settings, triggerToast} = useAppState();
  const [orderType, setOrderType] = useState<OrderType>('Dine In');
  const [tableNumber, setTableNumber] = useState('1');
  const [guestCount, setGuestCount] = useState(2);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [kitchenNotes, setKitchenNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card'>('Cash');

  const categories = useMemo(() => ['All', ...Array.from(new Set(products.map(product => product.category).filter(Boolean)))], [products]);
  const menuProducts = products.filter(product =>
    (product.itemType === 'Service' || product.stock > 0) &&
    (category === 'All' || product.category === category) &&
    `${product.name} ${product.category}`.toLowerCase().includes(search.trim().toLowerCase())
  );
  const subtotal = cart.reduce((sum, line) => sum + (line.product.sellingPrice * line.quantity) / (1 + line.product.taxRate / 100), 0);
  const grossTotal = cart.reduce((sum, line) => sum + line.product.sellingPrice * line.quantity, 0);
  const taxAmount = grossTotal - subtotal;
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);

  function addItem(product: Product) {
    setCart(current => {
      const existing = current.find(line => line.product.id === product.id);
      return existing
        ? current.map(line => line.product.id === product.id ? {...line, quantity: line.quantity + 1} : line)
        : [...current, {product, quantity: 1}];
    });
  }

  function changeQuantity(productId: string, delta: number) {
    setCart(current => current.map(line => line.product.id === productId ? {...line, quantity: line.quantity + delta} : line).filter(line => line.quantity > 0));
  }

  function settleOrder() {
    if (!cart.length) return triggerToast('Add at least one menu item to the order.', 'warning');
    if (orderType === 'Dine In' && !tableNumber.trim()) return triggerToast('Enter a table number.', 'warning');
    const unavailable = cart.find(line => line.product.itemType !== 'Service' && line.quantity > line.product.stock);
    if (unavailable) return triggerToast(`${unavailable.product.name} does not have enough stock.`, 'error');

    const items: SaleItem[] = cart.map(line => {
      const gross = line.product.sellingPrice * line.quantity;
      const taxable = gross / (1 + line.product.taxRate / 100);
      return {productId: line.product.id, name: line.product.name, sku: line.product.sku, barcode: line.product.barcode, price: taxable / line.quantity, quantity: line.quantity, taxRate: line.product.taxRate, taxAmount: gross - taxable, total: taxable};
    });
    const paymentDetails = paymentMethod === 'Cash' ? {cashAmount: grossTotal} : paymentMethod === 'Card' ? {cardAmount: grossTotal} : {upiAmount: grossTotal};
    addSale({
      customerName: orderType === 'Dine In' ? `Table ${tableNumber}` : `${orderType} Guest`,
      items, subtotal, taxAmount, discount: 0, total: grossTotal, paymentMethod, paymentDetails,
      loyaltyPointsEarned: 0, authId: currentUser?.id || 'restaurant-staff', employeeName: currentUser?.name || 'Restaurant staff', status: 'Completed',
      orderType, ...(orderType === 'Dine In' ? {tableNumber: tableNumber.trim(), guestCount} : {}), ...(kitchenNotes.trim() ? {kitchenNotes: kitchenNotes.trim()} : {}),
    });
    triggerToast(`${orderType} order settled successfully.`, 'success');
    setCart([]);
    setKitchenNotes('');
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-500">Restaurant service desk</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">New guest order</h1><p className="mt-1 text-sm text-gray-500">Build the order by table, add kitchen instructions, and settle the ticket.</p></div>
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-gray-200 bg-white p-1.5 dark:border-white/10 dark:bg-[#141416]">
          <OrderTypeButton active={orderType === 'Dine In'} icon={UtensilsCrossed} label="Dine in" onClick={() => setOrderType('Dine In')} />
          <OrderTypeButton active={orderType === 'Takeaway'} icon={ShoppingBag} label="Takeaway" onClick={() => setOrderType('Takeaway')} />
          <OrderTypeButton active={orderType === 'Delivery'} icon={Truck} label="Delivery" onClick={() => setOrderType('Delivery')} />
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="space-y-4">
          {orderType === 'Dine In' && <div className="grid gap-3 rounded-3xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-[#141416] sm:grid-cols-2"><Field icon={Armchair} label="Table"><input value={tableNumber} onChange={event => setTableNumber(event.target.value)} className="restaurant-input" placeholder="Table number" /></Field><Field icon={UsersRound} label="Guests"><input type="number" min="1" value={guestCount} onChange={event => setGuestCount(Math.max(1, Number(event.target.value)))} className="restaurant-input" /></Field></div>}
          <div className="rounded-3xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-[#141416] sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search the menu..." className="restaurant-input pl-10" /></div><div className="flex gap-2 overflow-x-auto">{categories.map(item => <button key={item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-xl px-4 py-3 text-xs font-bold ${category === item ? 'bg-emerald-500 text-[#07110D]' : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-300'}`}>{item}</button>)}</div></div>
            {menuProducts.length ? <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">{menuProducts.map(product => <button key={product.id} onClick={() => addItem(product)} className="min-h-32 rounded-2xl border border-gray-200 p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.025]"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500"><ChefHat className="h-4 w-4" /></span><p className="mt-4 line-clamp-2 text-sm font-black">{product.name}</p><div className="mt-2 flex items-center justify-between gap-2"><span className="truncate text-[10px] font-bold uppercase text-gray-400">{product.category}</span><span className="font-mono text-sm font-black text-emerald-500">{settings.currency}{product.sellingPrice.toFixed(2)}</span></div></button>)}</div> : <div className="flex min-h-64 flex-col items-center justify-center text-center text-gray-500"><ChefHat className="mb-3 h-8 w-8 opacity-40" /><p className="font-bold">No menu items found</p><p className="mt-1 text-xs">Add dishes in Catalog Items or change the filter.</p></div>}
          </div>
        </section>

        <aside className="xl:sticky xl:top-20 xl:self-start"><div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#141416]">
          <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-white/10"><div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Current ticket</p><h2 className="mt-1 font-black">{orderType === 'Dine In' ? `Table ${tableNumber || '--'}` : orderType}</h2></div><span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-500">{itemCount} items</span></div>
          <div className="max-h-[38vh] min-h-48 space-y-3 overflow-y-auto p-4">{cart.length ? cart.map(line => <div key={line.product.id} className="flex gap-3 rounded-2xl bg-gray-50 p-3 dark:bg-white/[0.035]"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{line.product.name}</p><p className="mt-1 font-mono text-xs text-emerald-500">{settings.currency}{(line.product.sellingPrice * line.quantity).toFixed(2)}</p></div><div className="flex items-center gap-1"><button onClick={() => changeQuantity(line.product.id, -1)} className="ticket-button">{line.quantity === 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}</button><span className="w-7 text-center text-sm font-black">{line.quantity}</span><button onClick={() => changeQuantity(line.product.id, 1)} className="ticket-button"><Plus className="h-3.5 w-3.5" /></button></div></div>) : <div className="flex h-48 flex-col items-center justify-center text-center text-gray-400"><UtensilsCrossed className="mb-3 h-7 w-7 opacity-40" /><p className="text-sm font-bold">Ticket is empty</p><p className="mt-1 text-xs">Tap menu items to add them.</p></div>}</div>
          <div className="border-t border-gray-200 p-5 dark:border-white/10"><label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Kitchen note</label><textarea value={kitchenNotes} onChange={event => setKitchenNotes(event.target.value)} placeholder="No onion, extra spicy, serve together..." className="restaurant-input mt-2 min-h-20 resize-none" /><div className="mt-4 space-y-2 text-xs"><TotalRow label="Subtotal" value={subtotal} currency={settings.currency} /><TotalRow label="GST" value={taxAmount} currency={settings.currency} /><div className="my-3 border-t border-dashed border-gray-300 dark:border-white/10" /><div className="flex items-end justify-between"><span className="font-bold">Grand total</span><span className="font-mono text-2xl font-black">{settings.currency}{grossTotal.toFixed(2)}</span></div></div><div className="mt-5 grid grid-cols-3 gap-2">{(['Cash', 'UPI', 'Card'] as const).map(method => <button key={method} onClick={() => setPaymentMethod(method)} className={`rounded-xl border px-2 py-2.5 text-xs font-bold ${paymentMethod === method ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-gray-200 text-gray-500 dark:border-white/10'}`}>{method}</button>)}</div><button onClick={settleOrder} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-4 text-sm font-black text-[#07110D] transition hover:bg-emerald-400"><WalletCards className="h-4 w-4" />Settle {settings.currency}{grossTotal.toFixed(2)}</button></div>
        </div></aside>
      </div>
    </div>
  );
};

function OrderTypeButton({active, icon: Icon, label, onClick}: {active: boolean; icon: typeof UtensilsCrossed; label: string; onClick: () => void}) { return <button onClick={onClick} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${active ? 'bg-emerald-500 text-[#07110D]' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'}`}><Icon className="h-4 w-4" />{label}</button>; }
function Field({icon: Icon, label, children}: {icon: typeof Armchair; label: string; children: React.ReactNode}) { return <label><span className="mb-1.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400"><Icon className="h-3.5 w-3.5" />{label}</span>{children}</label>; }
function TotalRow({label, value, currency}: {label: string; value: number; currency: string}) { return <div className="flex justify-between text-gray-500"><span>{label}</span><span className="font-mono font-bold text-gray-800 dark:text-gray-200">{currency}{value.toFixed(2)}</span></div>; }
