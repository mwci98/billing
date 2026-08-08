import React, {useMemo, useState} from 'react';
import {Armchair, ChefHat, Grid2X2, List, Minus, Plus, Printer, ReceiptText, Search, ShoppingBag, Trash2, Truck, UsersRound, UtensilsCrossed, WalletCards, X} from 'lucide-react';
import {useAppState} from '../lib/stateContext';
import {Product, Sale, SaleItem} from '../types';

type OrderType = NonNullable<Sale['orderType']>;
type MenuVariant = NonNullable<Product['menuVariants']>[number];
type CartLine = {product: Product; quantity: number; variant?: MenuVariant};
const isMenuImage = (value?: string) => Boolean(value && (value.startsWith('data:image/') || value.startsWith('https://') || value.startsWith('http://')));

export const RestaurantBilling: React.FC = () => {
  const {products, sales, addSale, editSale, currentUser, settings, triggerToast} = useAppState();
  const [orderType, setOrderType] = useState<OrderType>('Dine In');
  const [tableNumber, setTableNumber] = useState('1');
  const [guestCount, setGuestCount] = useState(2);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [menuView, setMenuView] = useState<'grid' | 'compact'>('grid');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [kitchenNotes, setKitchenNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card'>('Cash');
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);
  const [completedOrder, setCompletedOrder] = useState<Sale | null>(null);
  const [editingOrder, setEditingOrder] = useState<Sale | null>(null);

  const categories = useMemo(() => ['All', ...Array.from(new Set(products.map(product => product.category).filter(Boolean)))], [products]);
  const menuProducts = products.filter(product =>
    (product.itemType === 'Service' || product.stock > 0) &&
    (category === 'All' || product.category === category) &&
    `${product.name} ${product.category}`.toLowerCase().includes(search.trim().toLowerCase())
  );
  const linePrice = (line: CartLine) => line.variant?.price ?? line.product.sellingPrice;
  const lineKey = (line: CartLine) => `${line.product.id}:${line.variant?.id || 'base'}`;
  const subtotal = cart.reduce((sum, line) => sum + (linePrice(line) * line.quantity) / (1 + line.product.taxRate / 100), 0);
  const grossTotal = cart.reduce((sum, line) => sum + linePrice(line) * line.quantity, 0);
  const taxAmount = grossTotal - subtotal;
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const restaurantOrders = sales.filter(sale => Boolean(sale.orderType));
  const openOrders = restaurantOrders.filter(sale => sale.status === 'Pending');

  function addItem(product: Product) {
    if (product.menuVariants?.length) {
      setVariantProduct(product);
      return;
    }
    addItemVariant(product);
  }

  function addItemVariant(product: Product, variant?: MenuVariant) {
    const key = `${product.id}:${variant?.id || 'base'}`;
    setCart(current => {
      const existing = current.find(line => lineKey(line) === key);
      return existing
        ? current.map(line => lineKey(line) === key ? {...line, quantity: line.quantity + 1} : line)
        : [...current, {product, variant, quantity: 1}];
    });
    setVariantProduct(null);
  }

  function changeQuantity(key: string, delta: number) {
    setCart(current => current.map(line => lineKey(line) === key ? {...line, quantity: line.quantity + delta} : line).filter(line => line.quantity > 0));
  }

  function validateOrder() {
    if (!cart.length) return triggerToast('Add at least one menu item to the order.', 'warning');
    if (orderType === 'Dine In' && !tableNumber.trim()) return triggerToast('Enter a table number.', 'warning');
    const unavailable = cart.find(line => {
      if (line.product.itemType === 'Service') return false;
      const reservedQuantity = editingOrder?.items
        .filter(item => item.productId === line.product.id)
        .reduce((sum, item) => sum + item.quantity, 0) || 0;
      const requestedQuantity = cart
        .filter(item => item.product.id === line.product.id)
        .reduce((sum, item) => sum + item.quantity, 0);
      return requestedQuantity > line.product.stock + reservedQuantity;
    });
    if (unavailable) return triggerToast(`${unavailable.product.name} does not have enough stock.`, 'error');
    return true;
  }

  function buildItems(): SaleItem[] {
    return cart.map(line => {
      const gross = linePrice(line) * line.quantity;
      const taxable = gross / (1 + line.product.taxRate / 100);
      return {productId: line.product.id, name: line.variant ? `${line.product.name} - ${line.variant.name}` : line.product.name, sku: line.product.sku, barcode: line.product.barcode, price: taxable / line.quantity, quantity: line.quantity, taxRate: line.product.taxRate, taxAmount: gross - taxable, total: taxable, ...(line.variant ? {menuVariantId: line.variant.id, menuVariantName: line.variant.name} : {})};
    });
  }

  function orderData(status: Sale['status'], method = paymentMethod) {
    const paymentDetails = status === 'Completed' ? (method === 'Cash' ? {cashAmount: grossTotal} : method === 'Card' ? {cardAmount: grossTotal} : {upiAmount: grossTotal}) : {};
    return {
      customerName: orderType === 'Dine In' ? `Table ${tableNumber}` : `${orderType} Guest`,
      items: buildItems(), subtotal, taxAmount, discount: 0, total: grossTotal, paymentMethod: method, paymentDetails,
      loyaltyPointsEarned: 0, authId: currentUser?.id || 'restaurant-staff', employeeName: currentUser?.name || 'Restaurant staff', status,
      orderType, tableNumber: orderType === 'Dine In' ? tableNumber.trim() : undefined, guestCount: orderType === 'Dine In' ? guestCount : undefined, kitchenNotes: kitchenNotes.trim() || undefined,
    };
  }

  function clearEditor() {
    setCart([]);
    setKitchenNotes('');
    setEditingOrder(null);
  }

  function saveOpenOrder() {
    if (!validateOrder()) return;
    if (editingOrder) {
      editSale(editingOrder.id, orderData('Pending'));
      triggerToast('Open order updated. You can settle it when the guest is ready.', 'success');
    } else {
      addSale(orderData('Pending'));
      triggerToast('Order saved as open and unpaid.', 'success');
    }
    clearEditor();
  }

  function editOpenOrder(order: Sale) {
    const restoredCart = order.items.flatMap(item => {
      const product = products.find(candidate => candidate.id === item.productId);
      if (!product) return [];
      const variant = item.menuVariantId ? product.menuVariants?.find(candidate => candidate.id === item.menuVariantId) : product.menuVariants?.find(candidate => candidate.name === item.menuVariantName);
      return [{product, quantity: item.quantity, variant}];
    });
    if (!restoredCart.length) return triggerToast('The menu items for this order are no longer available.', 'error');
    setCart(restoredCart);
    setOrderType(order.orderType || 'Dine In');
    setTableNumber(order.tableNumber || '1');
    setGuestCount(order.guestCount || 1);
    setKitchenNotes(order.kitchenNotes || '');
    setPaymentMethod(order.paymentMethod === 'UPI' || order.paymentMethod === 'Card' ? order.paymentMethod : 'Cash');
    setEditingOrder(order);
    window.scrollTo({top: 0, behavior: 'smooth'});
  }

  function settleOrder() {
    if (!editingOrder) return triggerToast('Save the order first, then reopen it to settle payment.', 'warning');
    if (!validateOrder()) return;
    const paymentDetails = paymentMethod === 'Cash' ? {cashAmount: grossTotal} : paymentMethod === 'Card' ? {cardAmount: grossTotal} : {upiAmount: grossTotal};
    const completed: Sale = {...editingOrder, ...orderData('Completed'), paymentDetails, status: 'Completed'};
    editSale(editingOrder.id, completed);
    setCompletedOrder(completed);
    triggerToast(`${orderType} order settled successfully.`, 'success');
    clearEditor();
  }

  function settleSavedOrder(order: Sale, method: 'Cash' | 'UPI' | 'Card') {
    if (order.status !== 'Pending') return triggerToast('This order has already been settled.', 'warning');
    const paymentDetails = method === 'Cash' ? {cashAmount: order.total} : method === 'Card' ? {cardAmount: order.total} : {upiAmount: order.total};
    const completed: Sale = {...order, paymentMethod: method, paymentDetails, status: 'Completed'};
    editSale(order.id, completed);
    if (editingOrder?.id === order.id) clearEditor();
    setCompletedOrder(completed);
    triggerToast(`${order.customerName} settled by ${method}.`, 'success');
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#141416] sm:p-5 xl:flex-row xl:items-end xl:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-500">Restaurant service desk</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">{editingOrder ? 'Update guest order' : 'New guest order'}</h1><p className="mt-1 text-sm text-gray-500">Save first as an open order. Edit, settle, and print when the guest is ready.</p></div>
        <div className="grid w-full grid-cols-3 gap-1.5 rounded-2xl border border-gray-200 bg-gray-50 p-1.5 dark:border-white/10 dark:bg-white/[0.035] sm:w-auto sm:min-w-[25rem]">
          <OrderTypeButton active={orderType === 'Dine In'} icon={UtensilsCrossed} label="Dine in" onClick={() => setOrderType('Dine In')} />
          <OrderTypeButton active={orderType === 'Takeaway'} icon={ShoppingBag} label="Takeaway" onClick={() => setOrderType('Takeaway')} />
          <OrderTypeButton active={orderType === 'Delivery'} icon={Truck} label="Delivery" onClick={() => setOrderType('Delivery')} />
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="space-y-4">
          {orderType === 'Dine In' && <div className="grid grid-cols-2 gap-2 rounded-3xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-[#141416] sm:gap-3 sm:p-4"><Field icon={Armchair} label="Table"><input value={tableNumber} onChange={event => setTableNumber(event.target.value)} className="restaurant-input !px-3 !py-2.5" placeholder="Table no." /></Field><Field icon={UsersRound} label="Guests"><input type="number" min="1" value={guestCount} onChange={event => setGuestCount(Math.max(1, Number(event.target.value)))} className="restaurant-input !px-3 !py-2.5" /></Field></div>}
          <div className="rounded-3xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-[#141416] sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search the menu..." className="restaurant-input pl-10" /></div><div className="flex min-w-0 items-center gap-2"><div className="touch-scroll flex min-w-0 flex-1 gap-2 overflow-x-auto">{categories.map(item => <button key={item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-xl px-4 py-3 text-xs font-bold ${category === item ? 'bg-emerald-500 text-[#07110D]' : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-300'}`}>{item}</button>)}</div><div className="flex shrink-0 rounded-xl border border-gray-200 p-1 dark:border-white/10"><button type="button" onClick={() => setMenuView('grid')} aria-label="Use menu card view" className={`rounded-lg p-2 ${menuView === 'grid' ? 'bg-emerald-500 text-[#07110D]' : 'text-gray-400'}`}><Grid2X2 className="h-4 w-4" /></button><button type="button" onClick={() => setMenuView('compact')} aria-label="Use compact menu list view" className={`rounded-lg p-2 ${menuView === 'compact' ? 'bg-emerald-500 text-[#07110D]' : 'text-gray-400'}`}><List className="h-4 w-4" /></button></div></div></div>
            {menuProducts.length ? <div className={`mt-5 grid gap-3 ${menuView === 'compact' ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'}`}>{menuProducts.map(product => <button key={product.id} onClick={() => addItem(product)} className={`group overflow-hidden rounded-2xl border border-gray-200 text-left transition hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.025] ${menuView === 'compact' ? 'flex items-center' : ''}`}><div className={`flex items-center justify-center overflow-hidden bg-emerald-500/5 ${menuView === 'compact' ? 'h-20 w-24 shrink-0' : 'h-28 w-full'}`}>{isMenuImage(product.imageUrl) ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <span className="text-4xl">{product.imageUrl || <ChefHat className="h-8 w-8 text-emerald-500" />}</span>}</div><div className={`min-w-0 flex-1 ${menuView === 'compact' ? 'p-3' : 'p-4'}`}><p className="line-clamp-2 text-sm font-black">{product.name}</p><div className="mt-2 flex items-center justify-between gap-2"><span className="truncate text-[10px] font-bold uppercase text-gray-400">{product.menuVariants?.length ? `${product.menuVariants.length} choices` : product.category}</span><span className="shrink-0 font-mono text-sm font-black text-emerald-500">{product.menuVariants?.length ? 'From ' : ''}{settings.currency}{Math.min(product.sellingPrice, ...(product.menuVariants || []).map(variant => variant.price)).toFixed(2)}</span></div></div></button>)}</div> : <div className="flex min-h-64 flex-col items-center justify-center text-center text-gray-500"><ChefHat className="mb-3 h-8 w-8 opacity-40" /><p className="font-bold">No menu items found</p><p className="mt-1 text-xs">Add dishes in Menu Items or change the filter.</p></div>}
          </div>
        </section>

        <aside className="xl:sticky xl:top-20 xl:self-start"><div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#141416]">
          <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-white/10"><div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{editingOrder ? `Editing ${editingOrder.id}` : 'Current ticket'}</p><h2 className="mt-1 font-black">{orderType === 'Dine In' ? `Table ${tableNumber || '--'}` : orderType}</h2></div><div className="flex items-center gap-2">{editingOrder && <button onClick={clearEditor} className="text-xs font-bold text-gray-400 hover:text-red-500">Cancel</button>}<span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-500">{itemCount} items</span></div></div>
          <div className="max-h-[32vh] min-h-0 space-y-3 overflow-y-auto p-4">{cart.length ? cart.map(line => <div key={lineKey(line)} className="flex gap-3 rounded-2xl bg-gray-50 p-3 dark:bg-white/[0.035]"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{line.product.name}</p>{line.variant && <p className="mt-0.5 text-[10px] font-bold uppercase text-gray-400">{line.variant.name}</p>}<p className="mt-1 font-mono text-xs text-emerald-500">{settings.currency}{(linePrice(line) * line.quantity).toFixed(2)}</p></div><div className="flex items-center gap-1"><button onClick={() => changeQuantity(lineKey(line), -1)} className="ticket-button">{line.quantity === 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}</button><span className="w-7 text-center text-sm font-black">{line.quantity}</span><button onClick={() => changeQuantity(lineKey(line), 1)} className="ticket-button"><Plus className="h-3.5 w-3.5" /></button></div></div>) : <div className="flex min-h-32 flex-col items-center justify-center py-7 text-center text-gray-400"><UtensilsCrossed className="mb-2.5 h-6 w-6 opacity-40" /><p className="text-sm font-bold">Ticket is empty</p><p className="mt-1 text-xs">Tap menu items to add them.</p></div>}</div>
          <div className="border-t border-gray-200 p-5 dark:border-white/10"><label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Kitchen note</label><textarea value={kitchenNotes} onChange={event => setKitchenNotes(event.target.value)} placeholder="No onion, extra spicy, serve together..." className="restaurant-input mt-2 min-h-20 resize-none" /><div className="mt-4 space-y-2 text-xs"><TotalRow label="Subtotal" value={subtotal} currency={settings.currency} /><TotalRow label="GST" value={taxAmount} currency={settings.currency} /><div className="my-3 border-t border-dashed border-gray-300 dark:border-white/10" /><div className="flex items-end justify-between"><span className="font-bold">Grand total</span><span className="font-mono text-2xl font-black">{settings.currency}{grossTotal.toFixed(2)}</span></div></div>{editingOrder && <div className="mt-5 grid grid-cols-3 gap-2">{(['Cash', 'UPI', 'Card'] as const).map(method => <button key={method} onClick={() => setPaymentMethod(method)} className={`rounded-xl border px-2 py-2.5 text-xs font-bold ${paymentMethod === method ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-gray-200 text-gray-500 dark:border-white/10'}`}>{method}</button>)}</div>}<button onClick={saveOpenOrder} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500 py-3.5 text-sm font-black text-emerald-500 transition hover:bg-emerald-500/10"><ReceiptText className="h-4 w-4" />{editingOrder ? 'Update open order' : 'Save open order'}</button>{editingOrder && <button onClick={settleOrder} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-4 text-sm font-black text-[#07110D] transition hover:bg-emerald-400"><WalletCards className="h-4 w-4" />Settle & print {settings.currency}{grossTotal.toFixed(2)}</button>}</div>
        </div></aside>
      </div>

      <OrderShelf title="Open orders" subtitle="Pending tickets disappear from this queue after settlement" orders={openOrders} currency={settings.currency} actionLabel="Edit order" onAction={editOpenOrder} onSettle={settleSavedOrder} emptyText="No open orders. New unpaid tickets will appear here." />

      {variantProduct && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#141416]">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Choose a variant</p><h3 className="mt-1 text-xl font-black">{variantProduct.name}</h3></div>
              <button onClick={() => setVariantProduct(null)} className="rounded-xl px-3 py-2 text-xs font-bold text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5">Cancel</button>
            </div>
            <div className="mt-5 grid gap-2">
              {variantProduct.menuVariants?.map(variant => (
                <button key={variant.id} onClick={() => addItemVariant(variantProduct, variant)} className="flex items-center justify-between rounded-2xl border border-gray-200 p-4 text-left transition hover:border-emerald-500/50 hover:bg-emerald-500/5 dark:border-white/10">
                  <span className="font-bold">{variant.name}</span>
                  <span className="font-mono font-black text-emerald-500">{settings.currency}{variant.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {completedOrder && (
        <ThermalReceipt sale={completedOrder} storeName={settings.storeName} address={settings.address} phone={settings.phone} gstNumber={settings.gstNumber} currency={settings.currency} footer={settings.receiptFooter} onClose={() => setCompletedOrder(null)} />
      )}
    </div>
  );
};

function OrderTypeButton({active, icon: Icon, label, onClick}: {active: boolean; icon: typeof UtensilsCrossed; label: string; onClick: () => void}) { return <button onClick={onClick} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${active ? 'bg-emerald-500 text-[#07110D]' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'}`}><Icon className="h-4 w-4" />{label}</button>; }
function Field({icon: Icon, label, children}: {icon: typeof Armchair; label: string; children: React.ReactNode}) { return <label><span className="mb-1.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400"><Icon className="h-3.5 w-3.5" />{label}</span>{children}</label>; }
function TotalRow({label, value, currency}: {label: string; value: number; currency: string}) { return <div className="flex justify-between text-gray-500"><span>{label}</span><span className="font-mono font-bold text-gray-800 dark:text-gray-200">{currency}{value.toFixed(2)}</span></div>; }

function OrderShelf({title, subtitle, orders, currency, actionLabel, onAction, secondaryActionLabel, onSecondaryAction, onSettle, paymentLabel = 'Settle payment', emptyText}: {title: string; subtitle: string; orders: Sale[]; currency: string; actionLabel: string; onAction: (sale: Sale) => void; secondaryActionLabel?: string; onSecondaryAction?: (sale: Sale) => void; onSettle?: (sale: Sale, method: 'Cash' | 'UPI' | 'Card') => void; paymentLabel?: string; emptyText: string}) {
  return <div className="rounded-3xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-[#141416] sm:p-5">
    <div className="flex items-end justify-between gap-3"><div><h2 className="font-black">{title}</h2><p className="mt-1 text-xs text-gray-500">{subtitle}</p></div><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-black text-gray-500 dark:bg-white/5">{orders.length}</span></div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {orders.length ? orders.map(order => <div key={order.id} className="rounded-2xl border border-gray-200 p-3 dark:border-white/10">
        <div className="flex items-center justify-between gap-3"><span className="min-w-0"><span className="block truncate text-sm font-black">{order.tableNumber ? `Table ${order.tableNumber}` : order.orderType}</span><span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-gray-400">{order.items.reduce((sum, item) => sum + item.quantity, 0)} items · {new Date(order.date).toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})}</span></span><span className="shrink-0 font-mono text-sm font-black text-emerald-500">{currency}{order.total.toFixed(2)}</span></div>
        <div className={`mt-3 grid gap-1.5 ${onSecondaryAction ? 'grid-cols-2' : 'grid-cols-1'}`}><button onClick={() => onAction(order)} className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-black uppercase text-gray-500 transition hover:border-emerald-500/50 hover:text-emerald-500 dark:border-white/10">{actionLabel}</button>{onSecondaryAction && <button onClick={() => onSecondaryAction(order)} className="rounded-xl border border-amber-500/30 px-3 py-2 text-xs font-black uppercase text-amber-500 transition hover:bg-amber-500/10">{secondaryActionLabel}</button>}</div>
        {onSettle && <div className="mt-2"><p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400">{paymentLabel}</p><div className="grid grid-cols-3 gap-1.5">{(['Cash', 'UPI', 'Card'] as const).map(method => <button key={method} onClick={() => onSettle(order, method)} className={`rounded-lg px-2 py-2 text-[10px] font-black uppercase transition ${order.paymentMethod === method && order.status === 'Completed' ? 'bg-emerald-500 text-[#07110D]' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-[#07110D]'}`}>{method}</button>)}</div></div>}
      </div>) : <p className="py-4 text-sm text-gray-400">{emptyText}</p>}
    </div>
  </div>;
}

function ThermalReceipt({sale, storeName, address, phone, gstNumber, currency, footer, onClose}: {sale: Sale; storeName: string; address: string; phone: string; gstNumber: string; currency: string; footer: string; onClose: () => void}) {
  function printReceipt() {
    document.documentElement.classList.add('thermal-printing');
    const cleanup = () => document.documentElement.classList.remove('thermal-printing');
    window.addEventListener('afterprint', cleanup, {once: true});
    window.print();
    window.setTimeout(cleanup, 1000);
  }

  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center">
    <div className="max-h-[95vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-gray-100 p-3 shadow-2xl">
      <div className="sticky top-0 z-10 mb-3 flex items-center justify-between rounded-2xl bg-white px-3 py-2.5 !text-[#111827] shadow-sm"><div className="flex items-center gap-2 !text-[#111827]"><ReceiptText className="h-4 w-4" /><span className="text-sm font-black !text-[#111827]">Thermal receipt</span></div><button onClick={onClose} aria-label="Close thermal receipt" className="flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2 text-xs font-black !text-[#111827] transition hover:bg-gray-200"><X className="h-4 w-4" /><span>Close</span></button></div>
      <div className="thermal-receipt mx-auto w-[80mm] max-w-full bg-white px-[5mm] py-[5mm] font-mono text-[10px] leading-tight text-black">
        <div className="text-center"><h2 className="text-base font-black uppercase">{storeName}</h2>{address && <p className="mt-1 whitespace-pre-line">{address}</p>}{phone && <p>Phone: {phone}</p>}{gstNumber && <p>GSTIN: {gstNumber}</p>}</div>
        <div className="my-3 border-t border-dashed border-black" />
        <div className="grid grid-cols-2 gap-1"><span>Receipt</span><span className="text-right">{sale.id}</span><span>Date</span><span className="text-right">{new Date(sale.date).toLocaleString('en-IN')}</span><span>Order</span><span className="text-right">{sale.orderType}</span>{sale.tableNumber && <><span>Table / Guests</span><span className="text-right">{sale.tableNumber} / {sale.guestCount || 1}</span></>}</div>
        <div className="my-3 border-t border-dashed border-black" />
        <div className="grid grid-cols-[1fr_28px_62px] gap-1 border-b border-black pb-1 font-black"><span>ITEM</span><span className="text-center">QTY</span><span className="text-right">AMOUNT</span></div>
        <div>{sale.items.map((item, index) => <div key={`${item.productId}-${index}`} className="grid grid-cols-[1fr_28px_62px] gap-1 border-b border-dotted border-gray-400 py-1.5"><span>{item.name}<span className="block text-[8px]">@ {currency}{((item.total + item.taxAmount) / item.quantity).toFixed(2)}</span></span><span className="text-center">{item.quantity}</span><span className="text-right">{currency}{(item.total + item.taxAmount).toFixed(2)}</span></div>)}</div>
        <div className="ml-auto mt-3 w-44 space-y-1"><ReceiptRow label="Subtotal" value={`${currency}${sale.subtotal.toFixed(2)}`} /><ReceiptRow label="GST" value={`${currency}${sale.taxAmount.toFixed(2)}`} /><div className="border-t border-black pt-1 text-xs font-black"><ReceiptRow label="TOTAL" value={`${currency}${sale.total.toFixed(2)}`} /></div><ReceiptRow label="Paid via" value={sale.paymentMethod} /></div>
        <div className="my-3 border-t border-dashed border-black" />
        <div className="text-center">{footer || 'Thank you. Please visit again.'}<p className="mt-2 text-[8px]">Powered by QPOS</p></div>
      </div>
      <button onClick={printReceipt} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-sm font-black text-[#07110D]"><Printer className="h-4 w-4" />Print 80mm receipt</button>
    </div>
  </div>;
}

function ReceiptRow({label, value}: {label: string; value: string}) { return <div className="flex justify-between gap-3"><span>{label}</span><span className="text-right font-bold">{value}</span></div>; }
