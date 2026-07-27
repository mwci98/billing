/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Barcode, Camera, Plus, Minus, Trash2, 
  ShoppingBag, CreditCard, Sparkles, UserPlus, 
  Receipt, Landmark, ReceiptText, ChevronRight, ChevronLeft, X, Sliders, Percent
} from 'lucide-react';
import { useAppState } from '../lib/stateContext';
import { Product, SaleItem, Customer } from '../types';
import { CameraScanner } from './CameraScanner';
import { BarcodeGenerator } from './BarcodeGenerator';
import { TallyInvoiceModal } from './TallyInvoiceModal';

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
  const [cart, setCart] = useState<{ product: Product; quantity: number; customPrice?: number }[]>([]);
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

  // Category slider scroll ref
  const categorySliderRef = useRef<HTMLDivElement | null>(null);

  // Focus ref for barcodes
  const barcodeFieldRef = useRef<HTMLInputElement | null>(null);

  // Discount percentage slider state (0 - 50%)
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  // Toggle to show/hide out-of-stock items (default: false, hide out of stock)
  const [showOutOfStock, setShowOutOfStock] = useState<boolean>(false);

  const scrollCategorySlider = (direction: 'left' | 'right') => {
    if (categorySliderRef.current) {
      categorySliderRef.current.scrollBy({
        left: direction === 'left' ? -220 : 220,
        behavior: 'smooth'
      });
    }
  };

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

  // Helper to get active item unit price (custom price override or default catalog selling price)
  const getItemPrice = (item: { product: Product; customPrice?: number }) => {
    return item.customPrice !== undefined ? item.customPrice : item.product.sellingPrice;
  };

  const updateCartItemPrice = (productId: string, newPrice: number) => {
    setCart(cart.map(item => item.product.id === productId ? { ...item, customPrice: Math.max(0, newPrice) } : item));
  };

  // 3. Cart Mutators
  const addToCart = (product: Product) => {
    const currentProduct = products.find(p => p.id === product.id) || product;
    if (currentProduct.stock <= 0) {
      triggerToast(`Product "${currentProduct.name}" is completely out of stock!`, 'error');
      return;
    }

    const existing = cart.find(item => item.product.id === currentProduct.id);
    if (existing) {
      if (existing.quantity >= currentProduct.stock) {
        triggerToast(`Cannot add more. Max stock available: ${currentProduct.stock}`, 'warning');
        return;
      }
      setCart(cart.map(item => item.product.id === currentProduct.id ? { ...item, product: currentProduct, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { product: currentProduct, quantity: 1, customPrice: currentProduct.sellingPrice }]);
    }
  };

  const updateCartQuantity = (productId: string, newQty: number) => {
    const currentProduct = products.find(p => p.id === productId);
    const maxStock = currentProduct ? currentProduct.stock : 99999;

    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    if (newQty > maxStock) {
      triggerToast(`Quantity capped at max stock available: ${maxStock}`, 'warning');
      setCart(cart.map(item => item.product.id === productId ? { ...item, quantity: maxStock } : item));
      return;
    }

    setCart(cart.map(item => item.product.id === productId ? { ...item, quantity: newQty } : item));
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

  // 4. Client Search & filters (Only show products when user searches or selects a category)
  const hasSearchActive = productSearch.trim().length > 0 || selectedCategory !== 'All';

  const filteredProducts = hasSearchActive
    ? products.filter((p) => {
        const matchQuery = !productSearch.trim() ||
                           p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                           p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
                           p.barcode.includes(productSearch);
        const matchCategory = selectedCategory === 'All' || p.category === selectedCategory;
        const matchStock = showOutOfStock || p.stock > 0;
        return matchQuery && matchCategory && matchStock;
      })
    : [];

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.includes(customerSearch)
  );

  // 5. Total calculations
  const calculateCartSubtotal = () => {
    return cart.reduce((sum, item) => sum + (getItemPrice(item) * item.quantity), 0);
  };

  const calculateCartTax = () => {
    return cart.reduce((sum, item) => {
      const price = getItemPrice(item);
      const itemSubtotal = price * item.quantity;
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
      const rawPrice = getItemPrice(item);
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
      ...(attachedCustomer?.id ? { customerId: attachedCustomer.id } : {}),
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
    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:min-h-[calc(100vh-10rem)]">
      
      {/* LEFT: Fast Product search & fast selections catalog (7 cols on tablet/desktop) */}
      <div className="md:col-span-7 space-y-4">
        
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
              className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-3.5 py-2.5 text-xs font-bold shadow-sm shadow-emerald-600/20 transition active:scale-95 cursor-pointer shrink-0"
            >
              <Camera className="h-4 w-4 text-white animate-pulse shrink-0" />
              <span className="hidden md:inline text-white font-bold">Scanner</span>
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

        {/* Dynamic Category Slider with Interactive Scroll Controls */}
        {hasSearchActive && (
        <div className="flex items-center gap-1.5 bg-white dark:bg-gray-950 p-2.5 rounded-2xl border border-gray-100 dark:border-gray-900 shadow-sm">
          <button
            type="button"
            id="cat-slider-left-btn"
            onClick={() => scrollCategorySlider('left')}
            className="h-8 w-8 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center shrink-0 shadow-xs cursor-pointer active:scale-95 transition"
            title="Slide categories left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div 
            ref={categorySliderRef}
            className="flex gap-2 overflow-x-auto py-1 scroll-smooth no-scrollbar flex-1 items-center"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {categoriesList.map((cat) => {
              const count = cat === 'All' 
                ? products.filter(p => showOutOfStock || p.stock > 0).length 
                : products.filter(p => (showOutOfStock || p.stock > 0) && p.category === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat || 'All')}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition cursor-pointer border flex items-center gap-1.5 active:scale-98 ${
                    selectedCategory === cat
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20'
                      : 'bg-gray-50 text-gray-700 dark:bg-gray-900/60 dark:text-gray-300 border-gray-200 dark:border-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-900'
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                    selectedCategory === cat
                      ? 'bg-white/20 text-white font-bold'
                      : 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            id="cat-slider-right-btn"
            onClick={() => scrollCategorySlider('right')}
            className="h-8 w-8 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center shrink-0 shadow-xs cursor-pointer active:scale-95 transition"
            title="Slide categories right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Toggle Out Of Stock Filter */}
          <button
            type="button"
            onClick={() => setShowOutOfStock(!showOutOfStock)}
            className={`h-8 px-2.5 rounded-xl border text-[10px] font-bold font-mono transition cursor-pointer shrink-0 flex items-center gap-1 active:scale-95 ${
              showOutOfStock 
                ? 'bg-amber-500/15 text-amber-500 border-amber-500/30' 
                : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
            }`}
            title="Toggle showing out-of-stock items in POS catalog"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${showOutOfStock ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <span>{showOutOfStock ? 'Showing Out-of-Stock' : 'In Stock Only'}</span>
          </button>
        </div>
        )}

        {/* Product Grid catalog */}
        {!hasSearchActive ? (
          null
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-3xl bg-white dark:bg-[#141416]/90 border border-gray-100 dark:border-white/5 p-8 shadow-sm">
            <div className="rounded-full bg-gray-100 dark:bg-white/5 p-4 text-gray-400 mb-4">
              <X className="h-8 w-8 stroke-[1.5]" />
            </div>
            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">No Product Match</h4>
            <p className="text-xs text-gray-400 dark:text-gray-450 mt-1 max-w-sm leading-relaxed px-4">
              No products found matching <strong className="text-emerald-500 font-semibold">{productSearch || selectedCategory}</strong>. Try choosing another category or resetting filters.
            </p>
          </div>
        ) : (
          <div id="pos-product-catalog" className="flex flex-col gap-2.5 overflow-y-auto max-h-[35rem] pr-1.5 font-sans">
            {filteredProducts.map((p) => {
              const outOfStock = p.stock <= 0;
              const nearLowStock = p.stock <= p.lowStockAlert;
              return (
                <button
                  key={p.id}
                  disabled={outOfStock}
                  onClick={() => addToCart(p)}
                  className={`relative group flex items-center justify-between text-left rounded-2xl bg-white dark:bg-gray-950 p-3 border border-gray-100 dark:border-gray-900 hover:border-emerald-500 dark:hover:border-emerald-600 hover:shadow-md transition duration-150 active:scale-99 cursor-pointer ${
                    outOfStock ? 'opacity-50 grayscale cursor-not-allowed' : ''
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <span className="text-2xl shrink-0 p-2 bg-gray-50 dark:bg-white/5 rounded-xl block">{p.imageUrl || '📦'}</span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-gray-800 dark:text-gray-100 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition truncate pr-2">
                        {p.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[9px] text-gray-400 uppercase tracking-tight">SKU: {p.sku}</span>
                        <span className="text-gray-300 dark:text-gray-700 text-[10px]">•</span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{p.brand}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 pl-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold ${
                      outOfStock 
                        ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400' 
                        : nearLowStock
                        ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 animate-pulse'
                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                    }`}>
                      {outOfStock ? 'Out of stock' : nearLowStock ? `Low: ${p.stock}` : `${p.stock} units`}
                    </span>

                    <div className="text-right min-w-[70px]">
                      <p className="text-[9px] text-gray-400 font-medium">Price</p>
                      <p className="text-xs font-black text-gray-950 dark:text-white">
                        {settings.currency}{p.sellingPrice.toFixed(2)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-emerald-500 text-white p-2 group-hover:scale-105 transition duration-155 shadow-md shadow-emerald-500/10">
                      <Plus className="h-3.5 w-3.5 stroke-[3px]" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT: Active POS Invoice Cart Panel & checkout steps (5 cols on tablet/desktop) */}
      <div className="md:col-span-5 flex flex-col rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 shadow-sm overflow-hidden h-auto self-start md:h-full md:self-stretch">
        
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
        <div className="flex-none md:flex-1 overflow-y-auto min-h-[12rem] max-h-[16rem] p-4 sm:p-5 space-y-3 font-medium">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 sm:py-16 text-center text-gray-400">
              <ReceiptText className="h-10 w-10 text-gray-300 dark:text-gray-800 stroke-[1.5px] mb-3" />
              <p className="text-xs font-semibold">Your terminal cart is empty</p>
              <p className="text-[10px] text-gray-500 mt-1 max-w-[12rem]">
                Scan bar items or toggle the left catalog cards to draft an invoice.
              </p>
            </div>
          ) : (
            cart.map((item) => {
              const currentPrice = getItemPrice(item);
              const isPriceOverridden = item.customPrice !== undefined && item.customPrice !== item.product.sellingPrice;
              return (
                <div key={item.product.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50 dark:bg-gray-900/35 p-3 rounded-2xl border border-gray-100 dark:border-gray-900 gap-2">
                  <div className="min-w-0 flex-1 pr-1">
                    <h5 className="text-xs font-semibold tracking-tight text-gray-800 dark:text-gray-100 truncate">{item.product.name}</h5>
                    
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <div className="flex items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-0.5 shadow-2xs">
                        <span className="text-[10px] text-gray-400 font-bold mr-1">{settings.currency}</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={currentPrice}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            updateCartItemPrice(item.product.id, isNaN(val) ? 0 : val);
                          }}
                          className="w-20 text-xs font-mono font-bold bg-transparent text-emerald-600 dark:text-emerald-400 focus:outline-none"
                          title="Click to edit unit selling price for this item"
                        />
                      </div>
                      <span className="text-[9px] text-gray-400 font-mono">+ {item.product.taxRate}% GST</span>
                      {isPriceOverridden && (
                        <button
                          type="button"
                          onClick={() => updateCartItemPrice(item.product.id, item.product.sellingPrice)}
                          className="text-[9px] text-amber-500 hover:text-amber-600 dark:hover:text-amber-400 font-mono underline cursor-pointer"
                          title="Reset to catalog original price"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => deductFromCart(item.product.id)}
                      className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-90 transition cursor-pointer"
                      title="Decrease quantity"
                    >
                      <Minus className="h-3 w-3 stroke-[2.5px]" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={products.find(p => p.id === item.product.id)?.stock || 99999}
                      value={item.quantity}
                      onChange={(e) => updateCartQuantity(item.product.id, parseInt(e.target.value) || 0)}
                      className="w-12 text-center font-mono text-xs font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-0.5 focus:border-emerald-500 focus:outline-none"
                    />
                    <button
                      onClick={() => addToCart(item.product)}
                      className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-90 transition cursor-pointer"
                      title="Increase quantity"
                    >
                      <Plus className="h-3 w-3 stroke-[2.5px]" />
                    </button>

                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="rounded-lg p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition ml-1 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
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
            
            {/* Interactive Discount Slider & Inputs */}
            <div className="pt-2 border-t border-dashed border-gray-200 dark:border-gray-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                  <Sliders className="h-3.5 w-3.5 text-emerald-500" />
                  Discount Slider ({discountPercent}%)
                </span>
                <div className="flex items-center bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-2 py-0.5 max-w-[90px]">
                  <span className="text-[10px] mr-1 text-gray-400 font-bold">{settings.currency}</span>
                  <input
                    id="pos-discount-input"
                    type="number"
                    value={discountInput}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setDiscountInput(e.target.value);
                      const gross = subtotal + taxAmount;
                      if (gross > 0) {
                        const pct = Math.min(100, Math.max(0, Math.round((val / gross) * 100)));
                        setDiscountPercent(pct);
                      }
                    }}
                    className="w-full bg-transparent text-right font-mono text-xs focus:outline-none font-bold text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Range Slider Control */}
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={discountPercent}
                  onChange={(e) => {
                    const pct = parseInt(e.target.value) || 0;
                    setDiscountPercent(pct);
                    const gross = subtotal + taxAmount;
                    const calculated = Math.round((gross * pct) / 100);
                    setDiscountInput(calculated.toString());
                  }}
                  className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              {/* Quick Discount Presets */}
              <div className="flex items-center gap-1 justify-between pt-0.5">
                {[0, 5, 10, 15, 20].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setDiscountPercent(p);
                      const gross = subtotal + taxAmount;
                      const calculated = Math.round((gross * p) / 100);
                      setDiscountInput(calculated.toString());
                    }}
                    className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded-md border transition cursor-pointer ${
                      discountPercent === p
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {p}%
                  </button>
                ))}
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

      {/* Official Tally A5 GST Tax Invoice Modal */}
      {activeReceipt && (
        <TallyInvoiceModal
          activeReceipt={activeReceipt}
          settings={settings}
          onClose={() => setActiveReceipt(null)}
        />
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
