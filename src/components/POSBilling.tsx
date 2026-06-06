/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Barcode, Camera, Plus, Minus, Trash2, 
  ShoppingBag, CreditCard, Sparkles, UserPlus, 
  Receipt, Landmark, ReceiptText, ChevronRight, X
} from 'lucide-react';
import { useAppState } from '../lib/stateContext';
import { Product, SaleItem, Customer } from '../types';
import { CameraScanner } from './CameraScanner';
import { BarcodeGenerator } from './BarcodeGenerator';

export const POSBilling: React.FC = () => {
  const { 
    products, 
    customers, 
    addCustomer, 
    addSale, 
    settings, 
    currentUser,
    triggerToast
  } = useAppState();

  // Search filter
  const [productSearch, setProductSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Customer Attachment
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [attachedCustomer, setAttachedCustomer] = useState<Customer | null>(null);
  const [isAddingCustomer, setIsAddingCustomer] = useState<boolean>(false);
  
  // Quick customer registration details
  const [newCustName, setNewCustName] = useState<string>('');
  const [newCustPhone, setNewCustPhone] = useState<string>('');

  // Cart Active State
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [discountInput, setDiscountInput] = useState<string>('0');
  const [paymentOption, setPaymentOption] = useState<'Cash' | 'UPI' | 'Card' | 'Split'>('Cash');

  // Split payment allocations
  const [splitCash, setSplitCash] = useState<string>('');
  const [splitCard, setSplitCard] = useState<string>('');
  const [splitUpi, setSplitUpi] = useState<string>('');

  // Scanner modal toggle
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [barcodeInput, setBarcodeInput] = useState<string>('');

  // Receipt Modal anchor
  const [activeReceipt, setActiveReceipt] = useState<any | null>(null);

  // Focus ref for barcodes
  const barcodeFieldRef = useRef<HTMLInputElement | null>(null);

  // Auto-focus barcode scanner hook
  useEffect(() => {
    if (barcodeFieldRef.current) {
      barcodeFieldRef.current.focus();
    }
  }, []);

  // 1. Barcode Injection Handler (Keyboard scanners press enter, triggering standard form submissions)
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput) return;
    injectItemByBarcode(barcodeInput);
    setBarcodeInput('');
  };

  const injectItemByBarcode = (code: string) => {
    const p = products.find(prod => prod.barcode === code.trim() || prod.sku.toLowerCase() === code.trim().toLowerCase());
    if (p) {
      if (p.stock <= 0) {
        triggerToast(`Product "${p.name}" is completely out of stock!`, 'error');
        return;
      }
      addToCart(p);
      triggerToast(`Added ${p.name} to transaction cart via barcode scan ✔`, 'success');
    } else {
      triggerToast(`No product matched with barcode or SKU: ${code}`, 'error');
    }
  };

  // 2. Active category list
  const categoriesList = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  // 3. Cart Mutators
  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        triggerToast(`Cannot add more. Restocking threshold reached. Stock Left: ${product.stock}`, 'warning');
        return;
      }
      setCart(cart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const deductFromCart = (productId: string) => {
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;
    if (item.quantity > 1) {
      setCart(cart.map(i => i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i));
    } else {
      removeFromCart(productId);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(i => i.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountInput('0');
    setAttachedCustomer(null);
    setPaymentOption('Cash');
    setSplitCash('');
    setSplitCard('');
    setSplitUpi('');
  };

  // 4. Client Search & filters
  const filteredProducts = products.filter((p) => {
    const matchQuery = p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                       p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
                       p.barcode.includes(productSearch);
    const matchCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchQuery && matchCategory;
  });

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.includes(customerSearch)
  );

  // 5. Total calculations
  const calculateCartSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.product.sellingPrice * item.quantity), 0);
  };

  const calculateCartTax = () => {
    return cart.reduce((sum, item) => {
      const itemSubtotal = item.product.sellingPrice * item.quantity;
      const taxPart = itemSubtotal * (item.product.taxRate / 100);
      return sum + taxPart;
    }, 0);
  };

  const subtotal = calculateCartSubtotal();
  const taxAmount = calculateCartTax();
  const discount = parseFloat(discountInput) || 0;
  const netTotal = Math.max(0, subtotal + taxAmount - discount);

  // 6. Fast Quick Customer creation inside screen
  const handleAddNewCustomer = () => {
    if (!newCustName || !newCustPhone) {
      triggerToast("Please fill in both customer name and phone!", "warning");
      return;
    }
    const created = addCustomer({
      name: newCustName,
      phone: newCustPhone,
      loyaltyPoints: 0
    });
    setAttachedCustomer(created);
    setNewCustName('');
    setNewCustPhone('');
    setIsAddingCustomer(false);
    triggerToast(`Customer ${created.name} registered and attached!`, 'success');
  };

  // 7. POS Invoice submit billing checkouts
  const handleBillCheckout = () => {
    if (cart.length === 0) {
      triggerToast("No items inside point of sale catalog cart!", "warning");
      return;
    }

    // Prepare sale structures
    const saleItems: SaleItem[] = cart.map((item) => {
      const rawPrice = item.product.sellingPrice;
      const rate = item.product.taxRate;
      const tAmount = rawPrice * item.quantity * (rate / 100);
      const totalCost = (rawPrice * item.quantity) + tAmount;
      return {
        productId: item.product.id,
        name: item.product.name,
        sku: item.product.sku,
        barcode: item.product.barcode,
        price: rawPrice,
        quantity: item.quantity,
        taxRate: rate,
        taxAmount: tAmount,
        total: totalCost
      };
    });

    const calculatedPoints = Math.floor(netTotal * settings.loyaltyPointsPerDollar);

    const paymentDetails: any = {};
    if (paymentOption === 'Split') {
      paymentDetails.cashAmount = parseFloat(splitCash) || 0;
      paymentDetails.cardAmount = parseFloat(splitCard) || 0;
      paymentDetails.upiAmount = parseFloat(splitUpi) || 0;
      
      const allocated = paymentDetails.cashAmount + paymentDetails.cardAmount + paymentDetails.upiAmount;
      if (Math.abs(allocated - netTotal) > 0.5) {
        // Allow treating remainder as customer credit due, else reject mismatch
        if (!attachedCustomer) {
          triggerToast(`Split payments mapping (${settings.currency}${allocated.toFixed(2)}) must exactly match net bill (${settings.currency}${netTotal.toFixed(2)}) for non-registered walk-ins!`, 'error');
          return;
        } else {
          // Treat deficit as customer credit sale tracking
          paymentDetails.referenceNo = 'Credit Due outstanding';
        }
      }
    } else if (paymentOption === 'Cash') {
      paymentDetails.cashAmount = netTotal;
    } else if (paymentOption === 'Card') {
      paymentDetails.cardAmount = netTotal;
    } else {
      paymentDetails.upiAmount = netTotal;
    }

    const saleRecord = addSale({
      customerId: attachedCustomer?.id || undefined,
      customerName: attachedCustomer?.name || 'Walk-in Customer',
      items: saleItems,
      subtotal,
      taxAmount,
      discount,
      total: netTotal,
      paymentMethod: paymentOption,
      paymentDetails,
      loyaltyPointsEarned: calculatedPoints,
      authId: currentUser?.id || 'emp-01',
      employeeName: currentUser?.name || 'Checkout staff',
      status: 'Completed'
    });

    // Populate Receipt visualizer modal
    setActiveReceipt(saleRecord);
    clearCart();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-10rem)]">
      
      {/* LEFT: Fast Product search & fast selections catalog (8 cols) */}
      <div className="lg:col-span-7 space-y-4">
        
        {/* Rapid Search Bar actions */}
        <div className="flex flex-col md:flex-row gap-3 rounded-2xl bg-white dark:bg-gray-950 p-4 border border-gray-100 dark:border-gray-900 shadow-sm">
          {/* Barcode scanner action key */}
          <form onSubmit={handleBarcodeSubmit} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Barcode className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={barcodeFieldRef}
                id="pos-barcode-search"
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan / Type Barcode SKU..."
                className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 py-2.5 pl-10 pr-4 text-xs font-mono text-gray-900 dark:text-white placeholder-gray-400 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            
            <button
              id="pos-camera-scanner-btn"
              type="button"
              onClick={() => setIsCameraActive(true)}
              className="flex items-center gap-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-950 px-3.5 text-xs font-semibold cursor-pointer"
            >
              <Camera className="h-4 w-4 text-emerald-500 animate-pulse" />
              <span className="hidden md:inline">Open Camera</span>
            </button>
          </form>

          <div className="relative md:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              id="pos-text-search"
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Filter by name..."
              className="w-full rounded-xl border border-gray-205 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 py-2.5 pl-9 pr-4 text-xs text-gray-800 dark:text-white"
            />
          </div>
        </div>

        {/* Rapid Barcode Injection Simulation Tags */}
        <div className="rounded-2xl bg-white dark:bg-[#141416]/90 p-4 border border-gray-100 dark:border-white/5 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-white/40 font-bold flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500 animate-pulse" />
              Rapid Barcode Simulation Tags
            </span>
            <span className="text-[9px] text-gray-400 dark:text-white/30 font-mono">Tap tag to inject simulated scan</span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                id={`simulate-scan-${p.sku}`}
                onClick={() => injectItemByBarcode(p.barcode)}
                className="flex items-center gap-1.5 rounded-lg bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 hover:border-emerald-500/40 border border-gray-100 dark:border-white/5 px-2.5 py-1.5 text-[10px] font-mono transition cursor-pointer select-none text-gray-700 dark:text-gray-300 active:scale-95 shrink-0"
                title={`Scan ${p.name}`}
              >
                <span>{p.imageUrl || '📦'}</span>
                <span className="font-sans font-semibold text-gray-950 dark:text-[#F2F2F2]">{p.name}</span>
                <span className="text-[9px] text-gray-400 dark:text-emerald-400 font-mono font-bold">[{p.barcode}]</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Category Slider badges */}
        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
          {categoriesList.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat || 'All')}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition cursor-pointer border ${
                selectedCategory === cat
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/10'
                  : 'bg-white text-gray-600 dark:bg-gray-950 dark:text-gray-400 border-gray-100 dark:border-gray-900 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product Grid catalog */}
        <div id="pos-product-catalog" className="grid grid-cols-2 md:grid-cols-3 gap-3.5 overflow-y-auto max-h-[35rem] pr-1.5">
          {filteredProducts.map((p) => {
            const outOfStock = p.stock <= 0;
            const nearLowStock = p.stock <= p.lowStockAlert;
            return (
              <button
                key={p.id}
                disabled={outOfStock}
                onClick={() => addToCart(p)}
                className={`relative group flex flex-col justify-between text-left rounded-3xl bg-white dark:bg-gray-950 p-4 border border-gray-100 dark:border-gray-900 hover:border-emerald-500 dark:hover:border-emerald-600 hover:shadow-lg transition duration-200 active:scale-97 cursor-pointer ${
                  outOfStock ? 'opacity-50 grayscale cursor-not-allowed' : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{p.imageUrl || '📦'}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                      outOfStock 
                        ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400' 
                        : nearLowStock
                        ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                    }`}>
                      {outOfStock ? 'Out of stock' : nearLowStock ? `Low stock (${p.stock})` : `${p.stock} units`}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-gray-800 dark:text-gray-100 leading-tight group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition line-clamp-2">
                    {p.name}
                  </h4>
                  <p className="font-mono text-[9px] text-gray-400 mt-1 uppercase tracking-tight truncate">SKU: {p.sku}</p>
                </div>

                <div className="flex items-end justify-between mt-4 pb-0.5 pt-1.5 border-t border-gray-50 dark:border-gray-900/40 w-full">
                  <div>
                    <p className="text-[10px] text-gray-400 font-medium">Retail Price</p>
                    <p className="text-sm font-extrabold text-gray-950 dark:text-white">
                      {settings.currency}{p.sellingPrice.toFixed(2)}
                    </p>
                  </div>
                  
                  <div className="rounded-lg bg-emerald-500 text-white p-1 group-hover:scale-110 transition duration-150 shadow-md shadow-emerald-500/10">
                    <Plus className="h-4 w-4 stroke-[3px]" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT: Active POS Invoice Cart Panel & checkout steps (5 cols) */}
      <div className="lg:col-span-5 flex flex-col rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 shadow-sm overflow-hidden h-full">
        
        {/* Panel Cart Title */}
        <div className="border-b border-gray-100 dark:border-gray-900 p-5 bg-gray-50/50 dark:bg-gray-900/15 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-gray-850 dark:text-white uppercase tracking-wider">Active POS Cart ({cart.length})</h3>
          </div>
          {cart.length > 0 && (
            <button 
              id="pos-clear-cart-btn"
              onClick={clearCart}
              className="text-xs font-semibold text-red-500 hover:text-red-600 transition"
            >
              Reset Terminal
            </button>
          )}
        </div>

        {/* POS Cart items table list */}
        <div className="flex-1 overflow-y-auto max-h-[16rem] p-5 space-y-3 font-medium">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
              <ReceiptText className="h-10 w-10 text-gray-300 dark:text-gray-800 stroke-[1.5px] mb-3" />
              <p className="text-xs font-semibold">Your terminal cart is empty</p>
              <p className="text-[10px] text-gray-500 mt-1 max-w-[12rem]">
                Scan bar items or toggle the left catalog cards to draft an invoice.
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/35 p-3 rounded-2xl border border-gray-100 dark:border-gray-900">
                <div className="min-w-0 flex-1 pr-2">
                  <h5 className="text-xs font-semibold tracking-tight text-gray-800 dark:text-gray-100 truncate">{item.product.name}</h5>
                  <p className="font-mono text-[9px] text-gray-400 mt-0.5">
                    {settings.currency}{item.product.sellingPrice.toFixed(2)} + {item.product.taxRate}% GST
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => deductFromCart(item.product.id)}
                    className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 active:scale-90 transition"
                  >
                    <Minus className="h-3 w-3 stroke-[2.5px]" />
                  </button>
                  <span className="font-mono text-xs font-bold text-gray-900 dark:text-white px-1">{item.quantity}</span>
                  <button
                    onClick={() => addToCart(item.product.id === item.product.id ? item.product : item.product)}
                    className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 active:scale-90 transition"
                  >
                    <Plus className="h-3 w-3 stroke-[2.5px]" />
                  </button>

                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="rounded-lg p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition ml-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Attached Customer Management inline */}
        <div className="border-t border-gray-100 dark:border-gray-900 p-5 bg-gray-50/20 dark:bg-gray-950/40">
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <span className="text-gray-400">Attached Loyalty Customer</span>
            {!attachedCustomer && !isAddingCustomer && (
              <button 
                id="pos-cust-reg-toggle-btn"
                onClick={() => setIsAddingCustomer(true)} 
                className="text-emerald-500 hover:text-emerald-600 flex items-center gap-0.5"
              >
                <UserPlus className="h-3 w-3" /> Register New
              </button>
            )}
          </div>

          {/* New register form overlay */}
          {isAddingCustomer && (
            <div className="bg-white dark:bg-gray-900 p-3 rounded-2xl border border-emerald-500/20 space-y-2 mb-3 shadow-inner">
              <input
                id="pos-cust-reg-name"
                type="text"
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                placeholder="Full Name..."
                className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 p-2 text-xs text-gray-800"
              />
              <input
                id="pos-cust-reg-phone"
                type="text"
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
                placeholder="10-digit Phone..."
                className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 p-2 text-xs text-gray-800"
              />
              <div className="flex items-center gap-1.5 justify-end">
                <button
                  onClick={() => setIsAddingCustomer(false)}
                  className="px-2.5 py-1 text-[10px] text-gray-400 font-semibold uppercase hover:bg-gray-50 rounded"
                >
                  Cancel
                </button>
                <button
                  id="pos-cust-reg-submit"
                  onClick={handleAddNewCustomer}
                  className="px-3 py-1 text-[10px] bg-emerald-500 text-white font-semibold rounded-lg uppercase shadow-sm shadow-emerald-500/10 hover:bg-emerald-600"
                >
                  Add Card
                </button>
              </div>
            </div>
          )}

          {attachedCustomer ? (
            <div className="flex items-center justify-between bg-emerald-50/40 dark:bg-emerald-950/20 p-3 rounded-2xl border border-emerald-500/10">
              <div className="min-w-0">
                <span className="text-xs font-bold text-gray-800 dark:text-emerald-300 flex items-center gap-1">
                  🌟 {attachedCustomer.name}
                </span>
                <span className="text-[10px] text-gray-400 font-mono">Phone: {attachedCustomer.phone} • Points: {attachedCustomer.loyaltyPoints}</span>
              </div>
              <button
                onClick={() => setAttachedCustomer(null)}
                className="rounded-lg p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                id="pos-search-customer-input"
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search customers database by numeric phone..."
                className="w-full rounded-xl border border-gray-205 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 p-2 text-xs text-gray-800 dark:text-white"
              />
              
              {customerSearch && (
                <div className="absolute z-10 top-10 left-0 right-0 max-h-36 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl p-1 font-medium">
                  {filteredCustomers.length === 0 ? (
                    <p className="text-[10px] text-gray-400 text-center py-3">No member matched</p>
                  ) : (
                    filteredCustomers.map(cust => (
                      <button
                        key={cust.id}
                        type="button"
                        onClick={() => {
                          setAttachedCustomer(cust);
                          setCustomerSearch('');
                        }}
                        className="w-full text-left p-2 rounded-lg text-xs hover:bg-gray-50 dark:hover:bg-gray-800/50 flex justify-between cursor-pointer"
                      >
                        <span className="font-bold text-gray-700 dark:text-gray-300">{cust.name} ({cust.phone})</span>
                        <span className="text-[10px] font-semibold text-emerald-500">Points: {cust.loyaltyPoints}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pricing Subtotals, Loyalty points warnings, Split-method dropdown and payment checkbox trigger */}
        <div className="border-t border-gray-100 dark:border-gray-900 p-5 bg-gray-50/30 dark:bg-gray-900/10 space-y-3">
          
          <div className="space-y-1.5 text-xs font-semibold text-gray-500">
            <div className="flex items-center justify-between">
              <span>Gross Cart Total</span>
              <span className="font-mono">{settings.currency}{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Estimated Tax (GST Lines)</span>
              <span className="font-mono text-gray-450">+{settings.currency}{taxAmount.toFixed(2)}</span>
            </div>
            
            {/* Discount Inputs */}
            <div className="flex items-center justify-between pt-1 font-medium">
              <span>Flat Discount Code</span>
              <div className="flex items-center bg-transparent border border-gray-200 dark:border-gray-800 rounded-lg px-2 py-0.5 max-w-[80px]">
                <span className="text-[10px] mr-1 text-gray-400 font-bold">{settings.currency}</span>
                <input
                  id="pos-discount-input"
                  type="number"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  className="w-full bg-transparent text-right font-mono text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-dashed border-gray-200 dark:border-gray-800 pt-2 text-sm font-extrabold text-gray-900 dark:text-white">
              <span>Net Invoiced Bill</span>
              <span className="font-mono text-emerald-500">{settings.currency}{netTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Option Selector */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Payment channel</label>
            <div className="grid grid-cols-4 gap-1">
              {['Cash', 'UPI', 'Card', 'Split'].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setPaymentOption(opt as any)}
                  className={`rounded-xl py-2 text-center text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1 ${
                    paymentOption === opt
                      ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-950 dark:border-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-55 dark:bg-gray-950 dark:border-gray-800 dark:text-gray-400'
                  }`}
                >
                  {opt === 'Cash' ? '💵' : opt === 'UPI' ? '📲' : opt === 'Card' ? '💳' : '🥞'}
                  <span className="hidden sm:inline">{opt}</span>
                </button>
              ))}
            </div>
          </div>

          {/* If Split Payment, expand cash card upi boxes */}
          {paymentOption === 'Split' && (
            <div className="p-3 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-slate-200 space-y-2">
              <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Allocate split amounts ({settings.currency}{netTotal.toFixed(2)}):</span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[9px] font-medium text-gray-400">Cash part</label>
                  <input
                    type="number"
                    value={splitCash}
                    onChange={(e) => setSplitCash(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50/50 p-1.5 text-xs text-right"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-medium text-gray-400 font-mono">Card part</label>
                  <input
                    type="number"
                    value={splitCard}
                    onChange={(e) => setSplitCard(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50/50 p-1.5 text-xs text-right"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-medium text-gray-400 font-mono">UPI part</label>
                  <input
                    type="number"
                    value={splitUpi}
                    onChange={(e) => setSplitUpi(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50/50 p-1.5 text-xs text-right"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Submits bill */}
          <button
            id="pos-checkout-btn"
            disabled={cart.length === 0}
            onClick={handleBillCheckout}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3.5 text-sm font-extrabold cursor-pointer transition active:scale-97 shadow-lg shadow-emerald-500/10"
          >
            <Receipt className="h-5 w-5 stroke-[2.5px]" />
            <span>Generate Billings Invoice & Deduct Stock</span>
          </button>
        </div>
      </div>

      {/* Camera scanner Dialog Overlay */}
      {isCameraActive && (
        <CameraScanner
          onScanSuccess={(code) => {
            injectItemByBarcode(code);
            setIsCameraActive(false);
          }}
          onClose={() => setIsCameraActive(false)}
        />
      )}

      {/* Corporate Thermal / standard printed Invoice Receipt Dialog */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-sm rounded-3xl bg-white text-gray-900 border border-gray-100 shadow-2xl p-6 relative">
            <button
              onClick={() => setActiveReceipt(null)}
              className="absolute top-4 right-4 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Print trigger helper */}
            <div className="text-center mb-4 pb-4 border-b border-dashed border-gray-200">
              <span className="inline-flex rounded-full bg-emerald-50 text-emerald-600 px-3 py-1 text-xs font-bold uppercase mb-2">
                Sale Approved ✔
              </span>
              <h4 className="text-sm font-bold">Print Invoice Receipt</h4>
              <p className="text-[10px] text-gray-400 mt-0.5">Dual layout thermal printer support active</p>
            </div>

            {/* Printable Frame Area */}
            <div id="printable-pos-receipt" className="border border-gray-250 p-4 bg-gray-50/40 rounded-2xl font-mono text-center text-xs space-y-4 max-h-[24rem] overflow-y-auto">
              
              {/* Receipt Header details */}
              <div>
                <h2 className="text-base font-black tracking-tight">{settings.storeName}</h2>
                <p className="text-[9px] text-gray-500 font-bold mt-1 max-w-[12rem] mx-auto">{settings.address}</p>
                <p className="text-[9px] text-gray-500 mt-0.5">Phone: {settings.phone}</p>
                {settings.gstNumber && <p className="text-[9px] text-gray-500">GSTIN: {settings.gstNumber}</p>}
              </div>

              <div className="border-t border-dashed border-gray-300 py-1.5 text-left text-[9px] space-y-0.5">
                <div className="flex justify-between"><span>Bill Ref:</span> <span className="font-bold">{activeReceipt.id}</span></div>
                <div className="flex justify-between"><span>Date:</span> <span>{new Date(activeReceipt.date).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Operator:</span> <span className="uppercase">{activeReceipt.employeeName}</span></div>
                <div className="flex justify-between"><span>Customer:</span> <span className="uppercase">{activeReceipt.customerName}</span></div>
              </div>

              {/* Items tabular panel */}
              <div className="border-t border-dashed border-gray-300 pt-2 text-left text-[10px]">
                <div className="flex justify-between font-bold border-b border-dashed border-gray-300 pb-1 text-[9px]">
                  <span className="w-2/5">ITEM</span>
                  <span className="w-1/5 text-right">QTY</span>
                  <span className="w-1/5 text-right">PRICE</span>
                  <span className="w-1/5 text-right">TOTAL</span>
                </div>
                
                <div className="space-y-1.5 py-1 text-[9px]">
                  {activeReceipt.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between">
                      <span className="w-2/5 truncate">{item.name}</span>
                      <span className="w-1/5 text-right">{item.quantity}</span>
                      <span className="w-1/5 text-right">{settings.currency}{item.price.toFixed(2)}</span>
                      <span className="w-1/5 text-right font-bold">{settings.currency}{item.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals split */}
              <div className="border-t border-dashed border-gray-300 pt-2 text-[10px] space-y-1">
                <div className="flex justify-between text-[9px]">
                  <span>Subtotal:</span>
                  <span>{settings.currency}{activeReceipt.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[9px]">
                  <span>Tax Amount:</span>
                  <span>{settings.currency}{activeReceipt.taxAmount.toFixed(2)}</span>
                </div>
                {activeReceipt.discount > 0 && (
                  <div className="flex justify-between text-[9px]">
                    <span>Discount:</span>
                    <span>-{settings.currency}{activeReceipt.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-black pt-1 border-t border-dashed border-gray-200">
                  <span>GRAND TOTAL:</span>
                  <span>{settings.currency}{activeReceipt.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-gray-300 pt-2 text-[9px]">
                <p className="font-bold uppercase">PAY CHANNEL: {activeReceipt.paymentMethod}</p>
                {activeReceipt.paymentDetails.cashAmount && <p>Cash Recv: {settings.currency}{activeReceipt.paymentDetails.cashAmount.toFixed(2)}</p>}
                
                {activeReceipt.loyaltyPointsEarned > 0 && (
                  <p className="text-emerald-600 font-bold mt-1.5">★ Points Credited: +{activeReceipt.loyaltyPointsEarned}</p>
                )}
              </div>

              {/* Barcode Footer receipt */}
              <div className="border-t border-dashed border-gray-350 p-2 flex flex-col items-center">
                <BarcodeGenerator value={activeReceipt.id} size="sm" />
              </div>

              <div className="text-[8px] text-gray-400 mt-2 whitespace-pre-line leading-relaxed">
                {settings.receiptHeader}
                {'\n'}
                {settings.receiptFooter}
              </div>
            </div>

            {/* Print execute triggers */}
            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                onClick={() => {
                  const printContents = document.getElementById('printable-pos-receipt')?.innerHTML;
                  const originalContents = document.body.innerHTML;
                  if (printContents) {
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`<html><head><title>Thermal POS Bill Printer</title><style>body {font-family: monospace; padding: 20px; width: 300px; margin: auto; text-align: center;}</style></head><body>${printContents}</body></html>`);
                      printWindow.document.close();
                      printWindow.print();
                    }
                  }
                }}
                className="rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center gap-1 py-3 text-xs font-semibold cursor-pointer"
              >
                <PrinterIcon className="h-4 w-4" />
                <span>Thermal Output</span>
              </button>
              
              <button
                onClick={() => setActiveReceipt(null)}
                className="rounded-xl bg-gray-900 hover:bg-gray-800 text-white flex items-center justify-center gap-1 py-3 text-xs font-semibold cursor-pointer"
              >
                Done Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Internal icon helpers for printer graphics
const PrinterIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <path d="M6 9V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5" />
    <rect x="6" y="14" width="12" height="8" rx="1" />
  </svg>
);
