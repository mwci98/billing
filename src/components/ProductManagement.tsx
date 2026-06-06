/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Plus, Edit2, Trash2, Search, ArrowUpDown, Tag, Barcode,
  Calendar, Layers, Info, Filter, ArrowRightLeft, Eye, X, Camera
} from 'lucide-react';
import { useAppState } from '../lib/stateContext';
import { Product } from '../types';
import { BarcodeGenerator, QRGenerator } from './BarcodeGenerator';
import { CameraScanner } from './CameraScanner';

export const ProductManagement: React.FC = () => {
  const { products, addProduct, editProduct, deleteProduct, settings, triggerToast } = useAppState();

  // Search states
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  
  // Modal configurations
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<Product | null>(null);
  const [activeLabels, setActiveLabels] = useState<Product | null>(null);
  const [isBarcodeCameraOpen, setIsBarcodeCameraOpen] = useState<boolean>(false);

  // Form inputs
  const [name, setName] = useState<string>('');
  const [sku, setSku] = useState<string>('');
  const [barcode, setBarcode] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [brand, setBrand] = useState<string>('');
  const [unit, setUnit] = useState<string>('Box');
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [sellingPrice, setSellingPrice] = useState<string>('');
  const [taxRate, setTaxRate] = useState<string>('18');
  const [stock, setStock] = useState<string>('0');
  const [lowStockAlert, setLowStockAlert] = useState<string>('5');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('📦');

  const handlePullBarcodeInfo = (barcodeToLookup: string) => {
    if (!barcodeToLookup) {
      triggerToast("Please enter a barcode to scan or lookup!", "warning");
      return;
    }
    
    // 1. Look up in current products list first
    const existingProduct = products.find(p => p.barcode === barcodeToLookup);
    if (existingProduct) {
      setName(existingProduct.name);
      setCategory(existingProduct.category);
      setBrand(existingProduct.brand);
      setUnit(existingProduct.unit);
      setPurchasePrice(existingProduct.purchasePrice.toString());
      setSellingPrice(existingProduct.sellingPrice.toString());
      setTaxRate(existingProduct.taxRate.toString());
      setImageUrl(existingProduct.imageUrl || '📦');
      triggerToast(`Pulled details from existing product "${existingProduct.name}"!`, "success");
      return;
    }

    // 2. Look up in Global Mock Commercial Barcode Directory
    const mockRegistry: Record<string, Partial<Product>> = {
      "400110": { name: "Organic Whole Wheat Bread", category: "Bakery", brand: "Harvest Farms", unit: "Loaf (400g)", purchasePrice: 1.80, sellingPrice: 3.50, imageUrl: "🍞" },
      "400120": { name: "Fresh Premium Whole Milk", category: "Dairy", brand: "Dairy Pure", unit: "Bottle (1L)", purchasePrice: 1.10, sellingPrice: 2.20, imageUrl: "🥛" },
      "400130": { name: "Gluten-Free Oats Cereal", category: "Cereals", brand: "Nature Choice", unit: "Box (500g)", purchasePrice: 2.90, sellingPrice: 5.99, imageUrl: "🥣" },
      "400140": { name: "Extra Virgin Olive Oil", category: "Groceries", brand: "Filippo Berio", unit: "Bottle (500ml)", purchasePrice: 6.50, sellingPrice: 11.99, imageUrl: "🫒" },
      "400150": { name: "Alka-Seltzer Effervescent", category: "Pharmacy", brand: "Bayer", unit: "Box (24 Tabs)", purchasePrice: 3.20, sellingPrice: 7.50, imageUrl: "💊" },
      "5449000000996": { name: "Coca-Cola Classic Slim Can", category: "Beverages", brand: "Coca-Cola Co.", unit: "Can (330ml)", purchasePrice: 0.65, sellingPrice: 1.25, imageUrl: "🍾" },
      "012000042456": { name: "Pepsi Cola Classic Sweetener", category: "Beverages", brand: "PepsiCo", unit: "Can (355ml)", purchasePrice: 0.60, sellingPrice: 1.20, imageUrl: "🍾" },
      "7622300443431": { name: "Oreo Original Chocolate Creme", category: "Snacks", brand: "Mondelēz", unit: "Pack (120g)", purchasePrice: 0.95, sellingPrice: 1.99, imageUrl: "🍫" },
      "028400070560": { name: "Lays Classic Salted Chips", category: "Snacks", brand: "Frito-Lay", unit: "Bag (150g)", purchasePrice: 1.20, sellingPrice: 2.49, imageUrl: "🍿" },
      "400160": { name: "Sponge Cake Sweet Slices", category: "Bakery", brand: "Sunblest", unit: "Pack (250g)", purchasePrice: 2.00, sellingPrice: 3.99, imageUrl: "🍰" },
      "400170": { name: "Greek Style Strawberry Yogurt", category: "Dairy", brand: "Fage", unit: "Tub (450g)", purchasePrice: 1.40, sellingPrice: 2.75, imageUrl: "🥛" },
      "400180": { name: "Premium Arabica Coffee Ground", category: "Cereals", brand: "Lavazza", unit: "Bag (250g)", purchasePrice: 4.50, sellingPrice: 8.99, imageUrl: "☕" },
      "400190": { name: "Double Action Toothpaste Mint", category: "Pharmacy", brand: "Colgate", unit: "Tube (100g)", purchasePrice: 1.10, sellingPrice: 2.50, imageUrl: "🪥" }
    };

    const matchedSim = mockRegistry[barcodeToLookup];
    if (matchedSim) {
      setName(matchedSim.name || "");
      setCategory(matchedSim.category || "Groceries");
      setBrand(matchedSim.brand || "Commercial");
      setUnit(matchedSim.unit || "Piece");
      setPurchasePrice((matchedSim.purchasePrice || 0).toString());
      setSellingPrice((matchedSim.sellingPrice || 0).toString());
      setImageUrl(matchedSim.imageUrl || "📦");
      triggerToast(`Pulled information for "${matchedSim.name}" from scanned barcode!`, "success");
      return;
    }

    // 3. Fallback: Intelligent auto-generator
    const codeVal = parseInt(barcodeToLookup.replace(/\D/g, '')) || 0;
    if (codeVal > 0) {
      const isBeverage = codeVal % 5 === 0;
      const isSnack = codeVal % 3 === 0;
      const isPharma = codeVal % 7 === 0;
      const isBakery = codeVal % 4 === 0;
      
      let generatedName = "Commercial Retail Item";
      let genCategory = "Groceries";
      let genBrand = "Universal Brands";
      let genUnit = "Piece";
      let genEmoji = "📦";
      let genCost = 2.50;
      let genSell = 4.99;

      if (isBeverage) {
        generatedName = `Carbonated Cola Fusion ${codeVal % 1000}`;
        genCategory = "Beverages";
        genBrand = "AquaFresh Co.";
        genUnit = "Bottle (500ml)";
        genEmoji = "🍾";
        genCost = 0.85;
        genSell = 1.75;
      } else if (isSnack) {
        generatedName = `Salty Crisps Mix Vol ${(codeVal % 12) + 1}`;
        genCategory = "Snacks";
        genBrand = "CrunchyBites";
        genUnit = "Bag (120g)";
        genEmoji = "🍿";
        genCost = 1.10;
        genSell = 2.25;
      } else if (isPharma) {
        generatedName = `Active Echinacea Daily Tabs`;
        genCategory = "Pharmacy";
        genBrand = "MediPure Labs";
        genUnit = "Pack (30 Tabs)";
        genEmoji = "💊";
        genCost = 5.20;
        genSell = 9.99;
      } else if (isBakery) {
        generatedName = `Sweet Glazed Brioche Loaf`;
        genCategory = "Bakery";
        genBrand = "Flourist Bakeries";
        genUnit = "Bag (500g)";
        genEmoji = "🍞";
        genCost = 1.60;
        genSell = 3.20;
      } else {
        generatedName = `Premium Brand SKU ${codeVal % 1000}`;
        genCategory = "Groceries";
        genBrand = "Imperial Group";
        genUnit = "Unit Pack";
        genEmoji = "📦";
        genCost = 4.25;
        genSell = 8.50;
      }

      setName(generatedName);
      setCategory(genCategory);
      setBrand(genBrand);
      setUnit(genUnit);
      setPurchasePrice(genCost.toFixed(2));
      setSellingPrice(genSell.toFixed(2));
      setImageUrl(genEmoji);
      triggerToast(`Auto-decoded metadata! Pulled plausible definition: "${generatedName}"`, "info");
    } else {
      triggerToast(`No auto-decodable data found. Fill in definitions manually or use numeric codes.`, "warning");
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setName('');
    // Auto generate cool SKUs & Barcodes optionally
    const autoId = Math.floor(Math.random() * 900000) + 100000;
    setSku(`SKU-${autoId}`);
    setBarcode(`${autoId}`);
    setCategory('General');
    setBrand('Premium');
    setUnit('Piece');
    setPurchasePrice('1.50');
    setSellingPrice('2.99');
    setTaxRate('18');
    setStock('20');
    setLowStockAlert('5');
    setExpiryDate('');
    setImageUrl('📦');
    setIsFormOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingItem(p);
    setName(p.name);
    setSku(p.sku);
    setBarcode(p.barcode);
    setCategory(p.category);
    setBrand(p.brand);
    setUnit(p.unit);
    setPurchasePrice(p.purchasePrice.toString());
    setSellingPrice(p.sellingPrice.toString());
    setTaxRate(p.taxRate.toString());
    setStock(p.stock.toString());
    setLowStockAlert(p.lowStockAlert.toString());
    setExpiryDate(p.expiryDate || '');
    setImageUrl(p.imageUrl || '📦');
    setIsFormOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !sku || !barcode || !sellingPrice) {
      alert("Please fill in all core fields!");
      return;
    }

    const payload = {
      name,
      sku,
      barcode,
      category,
      brand,
      unit,
      purchasePrice: parseFloat(purchasePrice) || 0,
      sellingPrice: parseFloat(sellingPrice) || 0,
      taxRate: parseFloat(taxRate) || 0,
      stock: parseInt(stock) || 0,
      lowStockAlert: parseInt(lowStockAlert) || 0,
      expiryDate: expiryDate || undefined,
      imageUrl
    };

    if (editingItem) {
      editProduct(editingItem.id, payload);
    } else {
      addProduct(payload);
    }
    setIsFormOpen(false);
  };

  // Image emoji array presets
  const emojiPresets = ['📦', '🍞', '🥛', '🥣', '🫒', '💊', '🍾', '🍎', '🍉', '🥩', '🧴', '🥫', '🍫', '🧼'];

  // Categorizations lists
  const categoriesList = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.sku.toLowerCase().includes(search.toLowerCase()) ||
                          p.barcode.includes(search);
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      
      {/* 1. Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-950 p-6 rounded-3xl border border-gray-100 dark:border-gray-900 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-gray-950 dark:text-white">Active Product Catalog</h2>
          <p className="text-xs text-gray-400">Total stored listings: {products.length} standard items</p>
        </div>

        <button
          id="prod-add-new-btn"
          onClick={openAddModal}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-5 py-3 text-xs font-semibold text-white shadow-md shadow-emerald-500/10 cursor-pointer transition active:scale-95"
        >
          <Plus className="h-4 w-4 stroke-[3px]" />
          <span>Register New SKU</span>
        </button>
      </div>

      {/* 2. Filters & List display */}
      <div className="rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 shadow-sm overflow-hidden p-6 space-y-4">
        
        <div className="flex flex-col md:flex-row gap-3.5 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -track-y-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              id="prod-list-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by SKU, barcode, title..."
              className="w-full rounded-xl border border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 p-2.5 pl-10 text-xs focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <Filter className="h-4 w-4 text-gray-400 shrink-0" />
            <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-[20rem] sm:max-w-none">
              {categoriesList.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition border cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'bg-gray-50 text-gray-505 dark:bg-gray-900 dark:text-gray-400 border-gray-100 hover:bg-gray-100 dark:border-gray-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Catalog Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-900 text-gray-400 uppercase tracking-wider text-[9px] font-extrabold">
                <th className="py-3 px-2">Preview</th>
                <th className="py-3">Details</th>
                <th className="py-3">SKU & BAR</th>
                <th className="py-3">Category</th>
                <th className="py-3 font-mono">Buy Price</th>
                <th className="py-3 font-mono">Sell Price (Tax)</th>
                <th className="py-3">Stock count</th>
                <th className="py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-900/35">
              {filtered.map((p) => {
                const nearLowStock = p.stock <= p.lowStockAlert;
                return (
                  <tr key={p.id} className="text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50/40 dark:hover:bg-gray-900/10">
                    <td className="py-3 px-2 text-2xl">{p.imageUrl || '📦'}</td>
                    <td className="py-3 min-w-[8rem]">
                      <p className="font-bold text-gray-900 dark:text-white">{p.name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Brand: {p.brand} • Unit: {p.unit}</p>
                    </td>
                    <td className="py-3 font-mono max-w-[6rem] truncate pr-2">
                      <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">{p.sku}</p>
                      <p className="text-[10px] text-emerald-500 truncate flex items-center gap-0.5">
                        <Barcode className="h-3 w-3 inline" /> {p.barcode}
                      </p>
                    </td>
                    <td className="py-3">
                      <span className="rounded-md bg-gray-50 dark:bg-gray-900 px-2 py-0.5 text-[10px]">
                        {p.category}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-gray-400">
                      {settings.currency}{p.purchasePrice.toFixed(2)}
                    </td>
                    <td className="py-3 font-mono">
                      <p className="font-bold">{settings.currency}{p.sellingPrice.toFixed(2)}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">+{p.taxRate}% GST</p>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2.5 w-2.5 rounded-full ${nearLowStock ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
                        <span>{p.stock} units</span>
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          id={`prod-labels-btn-${p.id}`}
                          onClick={() => setActiveLabels(p)}
                          title="Generate printable labels, barcodes & QR"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition cursor-pointer"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        
                        <button
                          id={`prod-edit-btn-${p.id}`}
                          onClick={() => openEditModal(p)}
                          className="p-1.5 rounded-lg text-gray-450 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition cursor-pointer"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>

                        <button
                          id={`prod-delete-btn-${p.id}`}
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete Product "${p.name}"?`)) {
                              deleteProduct(p.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Add/Edit Product registration */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-gray-950 text-gray-900 dark:text-white border border-gray-100 dark:border-gray-900 shadow-2xl p-6 relative">
            <button
              onClick={() => setIsFormOpen(false)}
              className="absolute top-4 right-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-black mb-1">{editingItem ? 'Edit Product SKU' : 'Register New Inventory SKU'}</h3>
            <p className="text-xs text-gray-400 mb-5">Fill in standard retail criteria definitions below</p>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold mb-1">Product Title</label>
                  <input
                    id="form-prod-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Organic Whole Wheat Bread..."
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">SKU identifier Code</label>
                  <input
                    id="form-prod-sku"
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 flex items-center justify-between">
                    <span>EAN Barcode Code</span>
                    <span className="text-[10px] text-gray-400 font-mono">Webcam or simulated scan</span>
                  </label>
                  <div className="relative">
                    <input
                      id="form-prod-barcode"
                      type="text"
                      required
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder="e.g. 101010"
                      className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 pr-10 text-xs font-mono text-white focus:border-emerald-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      id="scan-barcode-modal-btn"
                      onClick={() => setIsBarcodeCameraOpen(true)}
                      className="absolute right-2 top-1/2 -track-y-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-white/5 active:scale-95 transition cursor-pointer"
                      title="Scan Barcode via Camera"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <button
                      type="button"
                      id="pull-barcode-info-btn"
                      onClick={() => handlePullBarcodeInfo(barcode)}
                      className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 flex items-center gap-1 transition active:scale-95 cursor-pointer bg-emerald-500/10 dark:bg-emerald-950/30 px-2.5 py-1 rounded-lg border border-emerald-500/20 shadow-sm"
                    >
                      ⚡ Pull Info from Barcode
                    </button>
                    {barcode && products.some(p => p.barcode === barcode) && (
                      <span className="text-[9px] text-emerald-400 font-bold bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-500/10 animate-pulse">Catalog Match</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Category</label>
                  <input
                    id="form-prod-category"
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Bakery, Dairy, Groceries..."
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Brand Name</label>
                  <input
                    id="form-prod-brand"
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Harvest Farms..."
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Unit Weight/Size</label>
                  <input
                    id="form-prod-unit"
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="Loaf (400g), Bottle (1L)..."
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Stock on Hand</label>
                  <input
                    id="form-prod-stock"
                    type="number"
                    disabled={!!editingItem} // Use inventory stock in/out panel to adjust active accounts
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono text-white disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Purchase Cost ({settings.currency})</label>
                  <input
                    id="form-prod-purchase-price"
                    type="number"
                    step="0.01"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">POS Selling Price ({settings.currency})</label>
                  <input
                    id="form-prod-selling-price"
                    type="number"
                    step="0.01"
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">GST/Tax Rate (%)</label>
                  <select
                    id="form-prod-tax-rate"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs text-white"
                  >
                    <option value="0">0% Exempt</option>
                    <option value="5">5% Basic</option>
                    <option value="12">12% Standard</option>
                    <option value="18">18% Standard High</option>
                    <option value="28">28% Luxury Tax</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Low Stock Warning Limits</label>
                  <input
                    id="form-prod-low-stock"
                    type="number"
                    value={lowStockAlert}
                    onChange={(e) => setLowStockAlert(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Expiry Date (Optional)</label>
                  <input
                    id="form-prod-expiry"
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-2">Display Icon/Emoji</label>
                  <div className="flex gap-2 items-center flex-wrap">
                    {emojiPresets.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setImageUrl(emoji)}
                        className={`text-xl p-1 rounded-lg border hover:bg-gray-100 transition ${
                          imageUrl === emoji ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'border-gray-200 bg-transparent'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 justify-end pt-4 border-t border-gray-100 dark:border-gray-900">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-900 transition"
                >
                  Cancel definitions
                </button>
                <button
                  id="form-prod-submit-btn"
                  type="submit"
                  className="rounded-xl bg-emerald-500 hover:bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md cursor-pointer"
                >
                  Confirm Specifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Printable Labels Barcodes QR Overlay */}
      {activeLabels && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white text-gray-900 border border-gray-100 shadow-2xl p-6 relative">
            <button
              onClick={() => setActiveLabels(null)}
              className="absolute top-4 right-4 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center mb-5 pb-3 border-b border-gray-100">
              <h4 className="text-sm font-bold">Printable Shelf Labels</h4>
              <p className="text-[10px] text-gray-450 mt-0.5">Unified standard EAN barcodes & micro matrix QR code</p>
            </div>

            {/* Shelf tag printable box */}
            <div id="printable-shelf-label" className="border border-gray-200 border-dashed rounded-2xl p-4 bg-gray-50/40 text-center space-y-4 max-h-[22rem] overflow-y-auto">
              <div>
                <h3 className="font-extrabold text-sm text-gray-900 truncate uppercase tracking-tight">{activeLabels.name}</h3>
                <p className="font-mono text-[9px] text-gray-400 uppercase font-semibold mt-0.5">SKU: {activeLabels.sku} • Category: {activeLabels.category}</p>
              </div>

              <div className="flex gap-4 items-center justify-center py-2 bg-white rounded-xl p-3 shadow-inner">
                <BarcodeGenerator value={activeLabels.barcode} sku={activeLabels.sku} size="md" />
                <QRGenerator value={`http://pos.quickmart.com/p/${activeLabels.id}`} size={70} />
              </div>

              <div className="text-center">
                <p className="text-[9px] text-gray-450 uppercase font-semibold">Invoiced Value</p>
                <p className="text-xl font-black text-emerald-600 font-mono tracking-tight">{settings.currency}{activeLabels.sellingPrice.toFixed(2)}</p>
                <p className="text-[8px] text-gray-400 font-medium">Incl. {activeLabels.taxRate}% GST lines • Brand: {activeLabels.brand}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                onClick={() => {
                  const labelContents = document.getElementById('printable-shelf-label')?.innerHTML;
                  if (labelContents) {
                    const printWind = window.open('', '_blank');
                    if (printWind) {
                      printWind.document.write(`<html><head><title>Retail Shelf Labels</title><style>body {font-family: monospace; text-align: center; padding: 40px; margin: auto; border: 1px dashed #ccc; width: 280px;}</style></head><body>${labelContents}</body></html>`);
                      printWind.document.close();
                      printWind.print();
                    }
                  }
                }}
                className="rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center py-3 text-xs font-semibold cursor-pointer"
              >
                Trigger Print
              </button>
              
              <button
                onClick={() => setActiveLabels(null)}
                className="rounded-xl bg-gray-900 hover:bg-gray-800 text-white flex items-center justify-center py-3 text-xs font-semibold cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Web Camera Scanner Overlay portal */}
      {isBarcodeCameraOpen && (
        <CameraScanner
          onScanSuccess={(scannedCode) => {
            setBarcode(scannedCode);
            setIsBarcodeCameraOpen(false);
            // Immediately pull metadata upon successful scan
            handlePullBarcodeInfo(scannedCode);
          }}
          onClose={() => setIsBarcodeCameraOpen(false)}
        />
      )}
    </div>
  );
};
