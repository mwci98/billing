/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Plus, Edit2, Trash2, Search, ArrowUpDown, Tag, Barcode,
  Calendar, Layers, Info, Filter, ArrowRightLeft, Eye, X, Camera, Check, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAppState } from '../lib/stateContext';
import { Product } from '../types';
import { BarcodeGenerator, QRGenerator } from './BarcodeGenerator';
import { CameraScanner } from './CameraScanner';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { getBusinessMode, sourcingForBusinessMode } from '../lib/businessMode';
import {
  getSerializedUnits,
  makeSerializedUnit,
  normalizeScannerValue,
  parseSerializedUnitLines,
  productUsesImeiTracking
} from '../lib/serializedInventory';

const PRODUCT_BRANDS = [
  'Apple',
  'Samsung',
  'OPPO',
  'Vivo',
  'Xiaomi',
  'Redmi',
  'Realme',
  'OnePlus',
  'Nothing',
  'Google Pixel',
  'Motorola',
  'Nokia',
  'Honor',
  'Huawei',
  'Poco',
  'Infinix',
  'Tecno',
  'Lava',
  'Asus',
  'Sony',
  'Lenovo',
  'Microsoft',
  'Dell',
  'HP',
  'Acer',
  'LG',
  'Panasonic',
  'Jio',
  'Generic / Unbranded',
];

export const ProductManagement: React.FC = () => {
  const { products, addProduct, editProduct, deleteProduct, adjustStock, settings, activeStore, triggerToast } = useAppState();

  // Search & Filter states
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [sourcingFilter, setSourcingFilter] = useState<'All' | 'Purchased' | 'Manufactured' | 'Both'>('All');
  
  // Inline Stock Edit State
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editingStockVal, setEditingStockVal] = useState<string>('');
  
  // Category slider ref
  const prodCatSliderRef = React.useRef<HTMLDivElement | null>(null);

  const scrollProdCatSlider = (direction: 'left' | 'right') => {
    if (prodCatSliderRef.current) {
      prodCatSliderRef.current.scrollBy({
        left: direction === 'left' ? -200 : 200,
        behavior: 'smooth'
      });
    }
  };
  
  // Modal configurations
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<Product | null>(null);
  const [activeLabels, setActiveLabels] = useState<Product | null>(null);
  const [isBarcodeCameraOpen, setIsBarcodeCameraOpen] = useState<boolean>(false);
  const [scannerTarget, setScannerTarget] = useState<'barcode' | 'imei'>('barcode');
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

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
  const [sourcingType, setSourcingType] = useState<'Purchased' | 'Manufactured' | 'Both'>('Purchased');
  const [manufacturingCost, setManufacturingCost] = useState<string>('');
  const [batchNo, setBatchNo] = useState<string>('');
  const [productionNotes, setProductionNotes] = useState<string>('');
  const [imeiInput, setImeiInput] = useState<string>('');
  const [trackInventoryByImei, setTrackInventoryByImei] = useState<boolean>(false);
  const [itemType, setItemType] = useState<'Material' | 'Service'>('Material');
  const [isBarcodeLookupLoading, setIsBarcodeLookupLoading] = useState<boolean>(false);
  const businessMode = getBusinessMode(activeStore.configuration?.businessType || settings.businessType);
  const effectiveSourcingType = businessMode === 'Hybrid'
    ? sourcingType
    : sourcingForBusinessMode(businessMode);

  const handleLiveBarcodeLookup = async (barcodeToLookup: string) => {
    const cleanBarcode = barcodeToLookup.replace(/\D/g, '');
    if (!cleanBarcode) {
      triggerToast('Please scan or enter a barcode first.', 'warning');
      return;
    }

    const existingProduct = products.find(product => product.barcode === cleanBarcode);
    if (existingProduct) {
      setName(existingProduct.name);
      setSku(existingProduct.sku);
      setCategory(existingProduct.category);
      setBrand(existingProduct.brand);
      setUnit(existingProduct.unit);
      setPurchasePrice(existingProduct.purchasePrice.toString());
      setSellingPrice(existingProduct.sellingPrice.toString());
      setTaxRate(existingProduct.taxRate.toString());
      setImageUrl(existingProduct.imageUrl || '📦');
      triggerToast(`Loaded "${existingProduct.name}" from your catalog.`, 'success');
      return;
    }

    setIsBarcodeLookupLoading(true);
    try {
      const lookupResponse = await fetch(`/api/barcode/lookup?code=${encodeURIComponent(cleanBarcode)}`);
      const payload = await lookupResponse.json().catch(() => ({}));
      if (!lookupResponse.ok || !payload.found) {
        triggerToast(payload.error || 'No verified product information was found.', 'warning');
        return;
      }

      const externalCategory = String(payload.category || '');
      const isPhone = /phone|mobile|smartphone|cellular/i.test(`${payload.name} ${externalCategory}`);
      setName(String(payload.name || ''));
      setBrand(String(payload.brand || ''));
      setCategory(isPhone ? 'Smartphones' : externalCategory.split(' > ').pop() || 'General');
      setUnit('Unit');
      setSku(`SKU-${cleanBarcode.slice(-6)}`);
      setImageUrl(isPhone ? '📱' : '📦');
      triggerToast(
        `Loaded verified barcode details from ${payload.source}. Enter your prices, stock, GST and supplier.`,
        'success'
      );
    } catch {
      triggerToast('Unable to look up this barcode right now. Please try again.', 'error');
    } finally {
      setIsBarcodeLookupLoading(false);
    }
  };

  const handleDemoBarcodeInfo = (barcodeToLookup: string) => {
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

    // 2. Look up in Global Mock Commercial Barcode Directory for smart devices
    const mockRegistry: Record<string, Partial<Product>> = {
      "194253846200": { name: "iPhone 15 Pro Max (256GB - Natural Titanium)", category: "Smartphones", brand: "Apple", unit: "Unit", purchasePrice: 110000.00, sellingPrice: 134900.00, imageUrl: "📱" },
      "8806095304624": { name: "Samsung Galaxy S24 Ultra (512GB - Titanium Gray)", category: "Smartphones", brand: "Samsung", unit: "Unit", purchasePrice: 105000.00, sellingPrice: 129900.00, imageUrl: "📱" },
      "840244705353": { name: "Google Pixel 8 Pro (128GB - Obsidian)", category: "Smartphones", brand: "Google", unit: "Unit", purchasePrice: 72000.00, sellingPrice: 89990.00, imageUrl: "📱" },
      "195949052412": { name: "Apple AirPods Pro (2nd Generation - USB-C)", category: "Accessories", brand: "Apple", unit: "Unit", purchasePrice: 18000.00, sellingPrice: 24900.00, imageUrl: "🎧" },
      "848061066524": { name: "Anker Prime 20,000mAh Power Bank (200W)", category: "Powerbanks", brand: "Anker", unit: "Unit", purchasePrice: 6500.00, sellingPrice: 9999.00, imageUrl: "🔋" },
      "194252156935": { name: "Apple 20W USB-C Power Adapter", category: "Accessories", brand: "Apple", unit: "Unit", purchasePrice: 1100.00, sellingPrice: 1900.00, imageUrl: "🔌" },
      "6971639626354": { name: "OnePlus 12 (256GB - Emerald Green)", category: "Smartphones", brand: "OnePlus", unit: "Unit", purchasePrice: 52000.00, sellingPrice: 64999.00, imageUrl: "📱" },
      "190199268345": { name: "Apple iPad Air (M1 - 64GB - Space Gray)", category: "Tablets", brand: "Apple", unit: "Unit", purchasePrice: 42000.00, sellingPrice: 54900.00, imageUrl: "💻" },
      "194252818222": { name: "Apple Watch Series 9 (45mm GPS - Midnight)", category: "Smartwatches", brand: "Apple", unit: "Unit", purchasePrice: 28000.00, sellingPrice: 38900.00, imageUrl: "⌚" },
      "194253381023": { name: "Apple MacBook Air 13-inch (M3 - 8GB - 256GB)", category: "Laptops", brand: "Apple", unit: "Unit", purchasePrice: 88000.00, sellingPrice: 104900.00, imageUrl: "💻" },
      "400110": { name: "Apple iPhone 15 (128GB - Black)", category: "Smartphones", brand: "Apple", unit: "Unit", purchasePrice: 58000.00, sellingPrice: 71900.00, imageUrl: "📱" },
      "400120": { name: "Samsung Galaxy A55 5G (128GB - Awesome Navy)", category: "Smartphones", brand: "Samsung", unit: "Unit", purchasePrice: 29000.00, sellingPrice: 36999.00, imageUrl: "📱" },
      "400130": { name: "Sony WH-1000XM5 Noise Canceling Headphones", category: "Accessories", brand: "Sony", unit: "Unit", purchasePrice: 22000.00, sellingPrice: 29990.00, imageUrl: "🎧" },
      "400140": { name: "Belkin BoostCharge 3-in-1 Wireless MagSafe Dock", category: "Chargers", brand: "Belkin", unit: "Unit", purchasePrice: 6500.00, sellingPrice: 11900.00, imageUrl: "🔌" },
      "400150": { name: "Garmin Venu 3 Smartwatch (Slate Stainless Steel)", category: "Smartwatches", brand: "Garmin", unit: "Unit", purchasePrice: 28000.00, sellingPrice: 44900.00, imageUrl: "⌚" },
      "400160": { name: "SanDisk Extreme 1TB Portable External SSD", category: "Storage", brand: "SanDisk", unit: "Unit", purchasePrice: 7500.00, sellingPrice: 11990.00, imageUrl: "💾" }
    };

    const matchedSim = mockRegistry[barcodeToLookup];
    if (matchedSim) {
      setName(matchedSim.name || "");
      setCategory(matchedSim.category || "Smartphones");
      setBrand(matchedSim.brand || "Premium");
      setUnit(matchedSim.unit || "Unit");
      setPurchasePrice((matchedSim.purchasePrice || 0).toString());
      setSellingPrice((matchedSim.sellingPrice || 0).toString());
      setImageUrl(matchedSim.imageUrl || "📦");
      triggerToast(`Pulled information for "${matchedSim.name}" from scanned barcode!`, "success");
      return;
    }

    // 3. Fallback: Intelligent auto-generator for new electronics
    const codeVal = parseInt(barcodeToLookup.replace(/\D/g, '')) || 0;
    if (codeVal > 0) {
      const isPhone = codeVal % 4 === 0;
      const isAccessory = codeVal % 3 === 0;
      const isSmartwatch = codeVal % 5 === 0;
      const isTablet = codeVal % 7 === 0;
      
      let generatedName = "Commercial Retail Item";
      let genCategory = "Smartphones";
      let genBrand = "Universal Brands";
      let genUnit = "Unit";
      let genEmoji = "📱";
      let genCost = 450.00;
      let genSell = 599.00;

      if (isPhone) {
        generatedName = `Nova 5G Smart Handset (SKU-${codeVal % 1000})`;
        genCategory = "Smartphones";
        genBrand = "Nova Ltd";
        genUnit = "Unit";
        genEmoji = "📱";
        genCost = 350.00;
        genSell = 499.00;
      } else if (isAccessory) {
        generatedName = `TrueWireless Earbuds Neo Edition`;
        genCategory = "Accessories";
        genBrand = "SoundFlow";
        genUnit = "Unit";
        genEmoji = "🎧";
        genCost = 45.00;
        genSell = 89.00;
      } else if (isSmartwatch) {
        generatedName = `Chronos Outdoor Sport Smartwatch`;
        genCategory = "Smartwatches";
        genBrand = "ActiveLink";
        genUnit = "Unit";
        genEmoji = "⌚";
        genCost = 120.00;
        genSell = 229.00;
      } else if (isTablet) {
        generatedName = `SlateTab 10-inch IPS Display`;
        genCategory = "Tablets";
        genBrand = "TabTech";
        genUnit = "Unit";
        genEmoji = "💻";
        genCost = 180.00;
        genSell = 299.00;
      } else {
        generatedName = `MagSafe Multi-Port Power Brick 65W`;
        genCategory = "Chargers";
        genBrand = "VoltCharge";
        genUnit = "Unit";
        genEmoji = "🔌";
        genCost = 15.00;
        genSell = 29.99;
      }

      setName(generatedName);
      setCategory(genCategory);
      setBrand(genBrand);
      setUnit(genUnit);
      setPurchasePrice(genCost.toFixed(2));
      setSellingPrice(genSell.toFixed(2));
      setImageUrl(genEmoji);
      triggerToast(`Auto-decoded electronics barcode! Decoded plausibly: "${generatedName}"`, "info");
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
    setBrand('');
    setUnit('');
    setPurchasePrice('');
    setSellingPrice('');
    setTaxRate('18');
    setStock('');
    setLowStockAlert('');
    setExpiryDate('');
    setImageUrl('📦');
    setSourcingType(sourcingForBusinessMode(businessMode));
    setManufacturingCost('');
    setBatchNo('');
    setProductionNotes('');
    setImeiInput('');
    setTrackInventoryByImei(false);
    setItemType(businessMode === 'Service' ? 'Service' : 'Material');
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
    setSourcingType(p.sourcingType || 'Purchased');
    setManufacturingCost(p.manufacturingCost ? p.manufacturingCost.toString() : '');
    setBatchNo(p.batchNo || '');
    setProductionNotes(p.productionNotes || '');
    const units = getSerializedUnits(p);
    setTrackInventoryByImei(productUsesImeiTracking(p));
    setItemType(p.itemType || 'Material');
    setImeiInput(
      units
        .filter(unit => unit.status !== 'Sold')
        .map(unit => [unit.imei1, unit.imei2].filter(Boolean).join(', '))
        .join('\n')
    );
    setIsFormOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !sku || (itemType === 'Material' && !barcode) || !sellingPrice) {
      triggerToast("Please fill in all core fields!", "warning");
      return;
    }

    const parsedUnits = parseSerializedUnitLines(imeiInput);
    const imeiLines = imeiInput.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const invalidImeiLine = imeiLines.find(line => {
      const matches = line.match(/\d{15}/g) || [];
      return matches.length < 1 || matches.length > 2;
    });
    if (trackInventoryByImei && invalidImeiLine) {
      triggerToast('Each handset line must contain one or two valid 15-digit IMEIs.', 'warning');
      return;
    }
    const enteredImeis = parsedUnits.flatMap(unit => [unit.imei1, unit.imei2].filter(Boolean) as string[]);
    if (trackInventoryByImei && parsedUnits.length === 0 && !editingItem) {
      triggerToast('Add one handset per line with its 15-digit IMEI before saving.', 'warning');
      return;
    }
    if (new Set(enteredImeis).size !== enteredImeis.length) {
      triggerToast('The same IMEI was entered more than once.', 'warning');
      return;
    }
    const duplicateProduct = products.find(product =>
      product.id !== editingItem?.id &&
      getSerializedUnits(product).some(unit =>
        enteredImeis.includes(unit.imei1) || Boolean(unit.imei2 && enteredImeis.includes(unit.imei2))
      )
    );
    if (duplicateProduct) {
      triggerToast(`An IMEI is already registered under "${duplicateProduct.name}".`, 'error');
      return;
    }

    const previousUnits = editingItem ? getSerializedUnits(editingItem) : [];
    const retainedSoldUnits = previousUnits.filter(unit => unit.status === 'Sold');
    const availableUnits = parsedUnits.map(unit => {
      const existing = previousUnits.find(previous =>
        previous.imei1 === unit.imei1 || previous.imei2 === unit.imei1
      );
      return makeSerializedUnit(unit.imei1, unit.imei2, existing);
    });
    const serializedUnits = trackInventoryByImei ? [...retainedSoldUnits, ...availableUnits] : undefined;
    const availableStock = itemType === 'Service'
      ? 0
      : trackInventoryByImei
        ? availableUnits.filter(unit => unit.status === 'In Stock' || unit.status === 'Returned').length
        : (parseInt(stock) || 0);

    const payload = {
      name,
      sku,
      barcode,
      itemType,
      imeiNumbers: trackInventoryByImei ? enteredImeis : undefined,
      trackInventoryByImei,
      serializedUnits,
      category,
      brand,
      unit,
      purchasePrice: parseFloat(purchasePrice) || 0,
      sellingPrice: parseFloat(sellingPrice) || 0,
      taxRate: parseFloat(taxRate) || 0,
      stock: availableStock,
      lowStockAlert: parseInt(lowStockAlert) || 0,
      expiryDate: expiryDate || undefined,
      imageUrl,
      sourcingType: effectiveSourcingType,
      manufacturingCost: effectiveSourcingType !== 'Purchased' && manufacturingCost ? parseFloat(manufacturingCost) : undefined,
      batchNo: effectiveSourcingType !== 'Purchased' && batchNo ? batchNo : undefined,
      productionNotes: effectiveSourcingType !== 'Purchased' && productionNotes ? productionNotes : undefined
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
                          p.barcode.includes(search) ||
                          Boolean(getSerializedUnits(p).some(unit =>
                            unit.imei1.includes(search.replace(/\D/g, '')) ||
                            Boolean(unit.imei2?.includes(search.replace(/\D/g, '')))
                          ));
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
    const itemSourcing = p.sourcingType || 'Purchased';
    const matchesSourcing = businessMode !== 'Hybrid' || sourcingFilter === 'All' || itemSourcing === sourcingFilter;
    return matchesSearch && matchesCategory && matchesSourcing;
  });

  return (
    <div className="space-y-6">
      
      {/* 1. Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-950 p-6 rounded-3xl border border-gray-100 dark:border-gray-900 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-gray-950 dark:text-white">Services & Materials Catalog</h2>
          <p className="text-xs text-gray-400">Total billable catalog items: {products.length}</p>
        </div>

        <button
          id="prod-add-new-btn"
          onClick={openAddModal}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-5 py-3 text-xs font-semibold text-white shadow-md shadow-emerald-500/10 cursor-pointer transition active:scale-95"
        >
          <Plus className="h-4 w-4 stroke-[3px]" />
          <span>Add Service / Material</span>
        </button>
      </div>

      {/* 2. Filters & List display */}
      <div className="rounded-3xl border border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-950 shadow-sm overflow-hidden p-6 space-y-4">
        
        <div className="flex flex-col lg:flex-row gap-3.5 items-center justify-between">
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3.5 top-1/2 -track-y-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              id="prod-list-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search services, materials, SKU or barcode..."
              className="w-full rounded-xl border border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 p-2.5 pl-10 text-xs focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap md:flex-nowrap items-center gap-2 w-full lg:w-auto">
            {/* Origin/Sourcing Filter */}
            {businessMode === 'Hybrid' && <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-800 shrink-0">
              <button
                type="button"
                onClick={() => setSourcingFilter('All')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                  sourcingFilter === 'All'
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                All Origins
              </button>
              <button
                type="button"
                onClick={() => setSourcingFilter('Purchased')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition flex items-center gap-1 ${
                  sourcingFilter === 'Purchased'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span>🛒 Purchased</span>
              </button>
              <button
                type="button"
                onClick={() => setSourcingFilter('Manufactured')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition flex items-center gap-1 ${
                  sourcingFilter === 'Manufactured'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span>🏭 In-House</span>
              </button>
            </div>}

            {/* Category Slider */}
            <div className="flex items-center gap-1.5 w-full lg:w-auto bg-gray-50 dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={() => scrollProdCatSlider('left')}
                className="h-7 w-7 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center shrink-0 shadow-xs cursor-pointer active:scale-95 transition"
                title="Slide categories left"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              <div 
                ref={prodCatSliderRef}
                className="flex gap-1.5 overflow-x-auto py-0.5 scroll-smooth max-w-[14rem] sm:max-w-xs items-center"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {categoriesList.map((cat) => {
                  const count = cat === 'All' 
                    ? products.length 
                    : products.filter(p => p.category === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold whitespace-nowrap transition border flex items-center gap-1 cursor-pointer active:scale-95 ${
                        categoryFilter === cat
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                          : 'bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span>{cat}</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                        categoryFilter === cat
                          ? 'bg-white/20 text-white font-bold'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => scrollProdCatSlider('right')}
                className="h-7 w-7 rounded-lg bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center shrink-0 shadow-xs cursor-pointer active:scale-95 transition"
                title="Slide categories right"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
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
                <th className="hidden xl:table-cell py-3">SKU & BAR</th>
                <th className="hidden xl:table-cell py-3">Origin</th>
                <th className="hidden xl:table-cell py-3">Category</th>
                <th className="py-3 font-mono">Cost / Raw Cost</th>
                <th className="hidden xl:table-cell py-3 font-mono">Sell Price (Tax)</th>
                <th className="py-3">Stock count</th>
                <th className="py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-900/35">
              {filtered.map((p) => {
                const nearLowStock = p.itemType !== 'Service' && p.stock <= p.lowStockAlert;
                const src = p.sourcingType || 'Purchased';
                return (
                  <tr key={p.id} className="text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50/40 dark:hover:bg-gray-900/10">
                    <td className="py-3 px-2 text-2xl">{p.imageUrl || '📦'}</td>
                    <td className="py-3 min-w-[8rem]">
                      <p className="font-bold text-gray-900 dark:text-white">{p.name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {p.itemType === 'Service'
                          ? `${p.brand ? `Provider: ${p.brand} · ` : ''}Billing unit: ${p.unit}`
                          : `Brand: ${p.brand || 'Unbranded'} · Unit: ${p.unit}`}
                      </p>
                      {productUsesImeiTracking(p) && (
                        <p className="text-[9px] text-emerald-500 mt-0.5">
                          {getSerializedUnits(p).filter(unit => unit.status !== 'Sold').length} available ·{' '}
                          {getSerializedUnits(p).filter(unit => unit.status === 'Sold').length} sold
                        </p>
                      )}
                    </td>
                    <td className="hidden xl:table-cell py-3 font-mono max-w-[6rem] truncate pr-2">
                      <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">{p.sku}</p>
                      <p className="text-[10px] text-emerald-500 truncate flex items-center gap-0.5">
                        <Barcode className="h-3 w-3 inline" /> {p.barcode}
                      </p>
                    </td>
                    <td className="hidden xl:table-cell py-3">
                      {p.itemType === 'Service' ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                          Service
                        </span>
                      ) : src === 'Manufactured' ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                          🏭 In-House
                        </span>
                      ) : src === 'Both' ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-900/60 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-400">
                          ⚙️ Hybrid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-400">
                          🛒 Purchased
                        </span>
                      )}
                    </td>
                    <td className="hidden xl:table-cell py-3">
                      <span className="rounded-md bg-gray-50 dark:bg-gray-900 px-2 py-0.5 text-[10px]">
                        {p.category}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-gray-400">
                      {p.itemType === 'Service' ? '—' : `${settings.currency}${p.purchasePrice.toFixed(2)}`}
                      {p.sourcingType === 'Manufactured' && p.manufacturingCost && (
                        <span className="block text-[9px] text-amber-500 font-bold">Mat: {settings.currency}{p.manufacturingCost.toFixed(2)}</span>
                      )}
                    </td>
                    <td className="hidden xl:table-cell py-3 font-mono">
                      <p className="font-bold">{settings.currency}{p.sellingPrice.toFixed(2)}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Incl. {p.taxRate}% GST</p>
                    </td>
                    <td className="py-3">
                      {p.itemType === 'Service' ? (
                        <span className="inline-flex rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-500">
                          Not tracked
                        </span>
                      ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          id={`stock-dec-${p.id}`}
                          onClick={() => {
                            if (p.stock > 0) {
                              adjustStock(p.id, p.stock - 1, 'Adjustment', 'Quick stock decrease');
                              triggerToast(`Updated ${p.name} stock to ${p.stock - 1}`, 'info');
                            }
                          }}
                          disabled={p.stock <= 0}
                          className="h-6 w-6 rounded border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 flex items-center justify-center font-black text-xs cursor-pointer disabled:opacity-30 shrink-0 select-none active:scale-95"
                          title="Decrease stock count"
                        >
                          -
                        </button>

                        {editingStockId === p.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={editingStockVal}
                              onChange={(e) => setEditingStockVal(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const val = parseInt(editingStockVal);
                                  if (!isNaN(val) && val >= 0) {
                                    adjustStock(p.id, val, 'Adjustment', 'Direct manual stock count update');
                                    triggerToast(`Updated ${p.name} stock in hand to ${val}`, 'success');
                                  }
                                  setEditingStockId(null);
                                } else if (e.key === 'Escape') {
                                  setEditingStockId(null);
                                }
                              }}
                              className="w-16 rounded-md border border-emerald-500 bg-white dark:bg-gray-900 px-1.5 py-1 text-xs font-bold font-mono text-gray-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const val = parseInt(editingStockVal);
                                if (!isNaN(val) && val >= 0) {
                                  adjustStock(p.id, val, 'Adjustment', 'Direct manual stock count update');
                                  triggerToast(`Updated ${p.name} stock in hand to ${val}`, 'success');
                                }
                                setEditingStockId(null);
                              }}
                              className="p-1 rounded bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer"
                              title="Save new stock"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingStockId(null)}
                              className="p-1 rounded bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-300 cursor-pointer"
                              title="Cancel"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            id={`stock-val-btn-${p.id}`}
                            onClick={() => {
                              setEditingStockId(p.id);
                              setEditingStockVal(p.stock.toString());
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-transparent hover:border-gray-200 dark:hover:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition"
                            title="Click to edit stock in hand directly"
                          >
                            <span className={`h-2 w-2 rounded-full shrink-0 ${nearLowStock ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
                            <span className="font-extrabold font-mono text-xs text-gray-950 dark:text-white">
                              {p.stock}
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium">{p.unit}s</span>
                            <Edit2 className="h-3 w-3 text-emerald-500 opacity-60 hover:opacity-100 ml-0.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          id={`stock-inc-${p.id}`}
                          onClick={() => {
                            adjustStock(p.id, p.stock + 1, 'Adjustment', 'Quick stock increase');
                            triggerToast(`Updated ${p.name} stock to ${p.stock + 1}`, 'info');
                          }}
                          className="h-6 w-6 rounded border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 flex items-center justify-center font-black text-xs cursor-pointer select-none active:scale-95 shrink-0"
                          title="Increase stock count"
                        >
                          +
                        </button>
                      </div>
                      )}
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
                          onClick={() => setProductToDelete(p)}
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
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-2 sm:p-4 overflow-y-auto">
          <div className="my-auto w-full max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-3xl bg-white dark:bg-gray-950 text-gray-900 dark:text-white border border-gray-100 dark:border-gray-900 shadow-2xl p-4 sm:p-6 relative">
            <button
              onClick={() => setIsFormOpen(false)}
              className="absolute top-4 right-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-black mb-1">
              {editingItem ? 'Edit Billing Item' : 'Add Service or Material'}
            </h3>
            <p className="text-xs text-gray-400 mb-5">Choose the item type so only relevant information is requested.</p>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {(
                  <div className="col-span-2 rounded-2xl border border-gray-200 bg-gray-50 p-3.5 dark:border-gray-800 dark:bg-gray-900/60">
                    <label className="block text-xs font-bold">Billing item type</label>
                    <p className="mt-1 text-[11px] text-gray-400">Services are invoiced without stock deduction. Materials continue using inventory.</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {(['Service', 'Material'] as const).map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setItemType(type);
                            if (type === 'Service') {
                              setTrackInventoryByImei(false);
                              setStock('0');
                              setCategory('Services');
                              setUnit('Job');
                            }
                          }}
                          className={`rounded-xl border p-3 text-xs font-bold transition ${
                            itemType === type
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                              : 'border-gray-200 bg-white text-gray-500 dark:border-gray-800 dark:bg-gray-950'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sourcing / Origin Selection */}
                {businessMode === 'Hybrid' && <div className="col-span-2 p-3.5 bg-gray-50 dark:bg-gray-900/60 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-2">
                  <label className="block text-xs font-bold text-gray-900 dark:text-white">Product Origin & Sourcing Mode</label>
                  <p className="text-[11px] text-gray-400">Specify whether this item is purchased from external B2B suppliers or produced/assembled in-house.</p>
                  
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setSourcingType('Purchased')}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        sourcingType === 'Purchased'
                          ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 ring-1 ring-blue-500'
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-600 dark:text-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      <p className="text-xs font-bold flex items-center gap-1">🛒 Purchased</p>
                      <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">Sourced from vendor/supplier</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSourcingType('Manufactured')}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        sourcingType === 'Manufactured'
                          ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 ring-1 ring-amber-500'
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-600 dark:text-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      <p className="text-xs font-bold flex items-center gap-1">🏭 Self-Manufactured</p>
                      <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">Produced/Assembled in-house</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSourcingType('Both')}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        sourcingType === 'Both'
                          ? 'border-purple-500 bg-purple-50/70 dark:bg-purple-950/40 text-purple-900 dark:text-purple-100 ring-1 ring-purple-500'
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-600 dark:text-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      <p className="text-xs font-bold flex items-center gap-1">⚙️ Hybrid / Both</p>
                      <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">Purchased & produced locally</p>
                    </button>
                  </div>
                </div>}

                <div className="col-span-2">
                  <label className="block text-xs font-semibold mb-1">
                    {itemType === 'Service' ? 'Service Description' : 'Product Title'}
                  </label>
                  <input
                    id="form-prod-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={itemType === 'Service' ? 'e.g. Website development or repair labour' : 'e.g. Organic Whole Wheat Bread...'}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs text-gray-900 dark:text-white"
                  />
                </div>

                {itemType === 'Material' && <div className="col-span-2">
                  <label className="mb-2 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs font-semibold dark:border-gray-800 dark:bg-gray-900">
                    <span>
                      Track every handset by IMEI
                      <span className="mt-0.5 block text-[10px] font-normal text-gray-400">Recommended for phones and cellular devices</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={trackInventoryByImei}
                      onChange={(event) => setTrackInventoryByImei(event.target.checked)}
                      className="h-4 w-4 accent-emerald-500"
                    />
                  </label>
                  {trackInventoryByImei && (
                    <>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-xs font-semibold">Handset IMEI inventory</label>
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                          {parseSerializedUnitLines(imeiInput).length} handsets
                        </span>
                      </div>
                      <textarea
                        id="form-prod-imei"
                        rows={5}
                        value={imeiInput}
                        onChange={(e) => setImeiInput(e.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Tab') {
                            event.preventDefault();
                            setImeiInput(current => `${current.trimEnd()}\n`);
                          }
                        }}
                        placeholder={'One handset per line:\nIMEI 1\nIMEI 1, IMEI 2  (dual SIM)'}
                        className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setScannerTarget('imei');
                          setIsBarcodeCameraOpen(true);
                        }}
                        className="mt-2 inline-flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        Scan handset IMEI
                      </button>
                      <p className="mt-1 text-[10px] text-gray-400">
                        Each line is one physical device. Stock is calculated automatically from available handset records. Sold IMEIs cannot be removed here.
                      </p>
                    </>
                  )}
                </div>}

                <div>
                  <label className="block text-xs font-semibold mb-1">SKU identifier Code</label>
                  <input
                    id="form-prod-sku"
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono text-gray-900 dark:text-white"
                  />
                </div>

                {itemType === 'Material' && <div>
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
                      onFocus={(e) => e.currentTarget.select()}
                      onClick={(e) => e.currentTarget.select()}
                      placeholder="e.g. 101010"
                      className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 pr-10 text-xs font-mono text-gray-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      id="scan-barcode-modal-btn"
                      onClick={() => {
                        setScannerTarget('barcode');
                        setIsBarcodeCameraOpen(true);
                      }}
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
                      onClick={() => void handleLiveBarcodeLookup(barcode)}
                      disabled={isBarcodeLookupLoading}
                      className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 flex items-center gap-1 transition active:scale-95 cursor-pointer bg-emerald-500/10 dark:bg-emerald-950/30 px-2.5 py-1 rounded-lg border border-emerald-500/20 shadow-sm"
                    >
                      {isBarcodeLookupLoading ? 'Looking up…' : '⚡ Pull Info from Barcode'}
                    </button>
                    {barcode && products.some(p => p.barcode === barcode) && (
                      <span className="text-[9px] text-emerald-400 font-bold bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-500/10 animate-pulse">Catalog Match</span>
                    )}
                  </div>
                </div>}

                <div>
                  <label className="block text-xs font-semibold mb-1">Category</label>
                  <input
                    id="form-prod-category"
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Bakery, Dairy, Groceries..."
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    {itemType === 'Service' ? 'Department / Service Provider (Optional)' : 'Brand Name'}
                  </label>
                  {itemType === 'Service' ? (
                    <input
                      id="form-prod-brand"
                      type="text"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="e.g. Web Team, Workshop, Consultant"
                      className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs text-gray-900 dark:text-white"
                    />
                  ) : (
                    <select
                      id="form-prod-brand"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs text-gray-900 dark:text-white"
                    >
                      <option value="">Select brand</option>
                      {brand && !PRODUCT_BRANDS.includes(brand) && <option value={brand}>{brand}</option>}
                      {PRODUCT_BRANDS.map((brandName) => (
                        <option key={brandName} value={brandName}>{brandName}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    {itemType === 'Service' ? 'Billing Unit' : 'Unit Weight/Size'}
                  </label>
                  <input
                    id="form-prod-unit"
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder={itemType === 'Service' ? 'Job, Hour, Visit, Month...' : 'Loaf (400g), Bottle (1L)...'}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs text-gray-900 dark:text-white"
                  />
                </div>

                {itemType === 'Material' && <div>
                  <label className="block text-xs font-semibold mb-1">
                    Stock on Hand {trackInventoryByImei && <span className="text-emerald-500">(automatic)</span>}
                  </label>
                  <input
                    id="form-prod-stock"
                    type="number"
                    disabled={Boolean(editingItem || trackInventoryByImei)} // Serialized stock is derived from handset records.
                    value={trackInventoryByImei ? parseSerializedUnitLines(imeiInput).length : stock}
                    onChange={(e) => setStock(e.target.value)}
                    placeholder={trackInventoryByImei ? 'Calculated from IMEIs' : 'Enter opening stock'}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono text-gray-900 dark:text-white disabled:opacity-50"
                  />
                </div>}

                {itemType === 'Material' && <div>
                  <label className="block text-xs font-semibold mb-1">
                    {effectiveSourcingType === 'Manufactured' ? `Production / Raw Cost (${settings.currency})` : `Supplier Buy Price incl. GST (${settings.currency})`}
                  </label>
                  <input
                    id="form-prod-purchase-price"
                    type="number"
                    step="0.01"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="Enter purchase price"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono text-gray-900 dark:text-white"
                  />
                </div>}

                {(effectiveSourcingType === 'Manufactured' || effectiveSourcingType === 'Both') && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold mb-1 text-amber-600 dark:text-amber-400">Raw Material Cost / Unit ({settings.currency})</label>
                      <input
                        id="form-prod-mfg-cost"
                        type="number"
                        step="0.01"
                        value={manufacturingCost}
                        onChange={(e) => setManufacturingCost(e.target.value)}
                        placeholder="Direct production cost..."
                        className="w-full rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-2.5 text-xs font-mono text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1 text-amber-600 dark:text-amber-400">Production Batch Code</label>
                      <input
                        id="form-prod-batch-no"
                        type="text"
                        value={batchNo}
                        onChange={(e) => setBatchNo(e.target.value)}
                        placeholder="e.g. BATCH-2026-001"
                        className="w-full rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-2.5 text-xs font-mono text-gray-900 dark:text-white"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-semibold mb-1 text-amber-600 dark:text-amber-400">Manufacturing / Assembly Notes & Recipe</label>
                      <input
                        id="form-prod-notes"
                        type="text"
                        value={productionNotes}
                        onChange={(e) => setProductionNotes(e.target.value)}
                        placeholder="e.g. Assembled in Workshop A using Component X + Component Y..."
                        className="w-full rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-2.5 text-xs text-gray-900 dark:text-white"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    {itemType === 'Service' ? 'Service Fee incl. GST' : 'POS Selling Price incl. GST'} ({settings.currency})
                  </label>
                  <input
                    id="form-prod-selling-price"
                    type="number"
                    step="0.01"
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    placeholder="Enter selling price"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">GST/Tax Rate (%)</label>
                  <select
                    id="form-prod-tax-rate"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs text-gray-900 dark:text-white"
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>

                {itemType === 'Material' && <div>
                  <label className="block text-xs font-semibold mb-1">Low Stock Warning Limits</label>
                  <input
                    id="form-prod-low-stock"
                    type="number"
                    value={lowStockAlert}
                    onChange={(e) => setLowStockAlert(e.target.value)}
                    placeholder="Optional warning quantity"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-mono text-gray-900 dark:text-white"
                  />
                </div>}

                {itemType === 'Material' && <div>
                  <label className="block text-xs font-semibold mb-1">Expiry Date (Optional)</label>
                  <input
                    id="form-prod-expiry"
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-2.5 text-xs text-gray-900 dark:text-white font-mono"
                  />
                </div>}

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
          <div className="light-preview w-full max-w-sm rounded-3xl bg-white text-gray-900 border border-gray-100 shadow-2xl p-6 relative">
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
                <QRGenerator value={`https://qpos.neospec.co.in/p/${activeLabels.id}`} size={70} />
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
            const normalizedCode = normalizeScannerValue(scannedCode);
            if (scannerTarget === 'imei') {
              if (!/^\d{15}$/.test(normalizedCode)) {
                triggerToast('The scanned value is not a valid 15-digit IMEI.', 'warning');
                return;
              }
              const existingImeis = parseSerializedUnitLines(imeiInput)
                .flatMap(unit => [unit.imei1, unit.imei2].filter(Boolean));
              if (existingImeis.includes(normalizedCode)) {
                triggerToast('That IMEI is already entered for this product.', 'warning');
                setIsBarcodeCameraOpen(false);
                return;
              }
              setImeiInput(current => `${current.trimEnd()}${current.trim() ? '\n' : ''}${normalizedCode}`);
              triggerToast(`IMEI ${normalizedCode} added as a handset.`, 'success');
            } else {
              setBarcode(normalizedCode);
              // Immediately pull metadata upon successful product barcode scan
              void handleLiveBarcodeLookup(normalizedCode);
            }
            setIsBarcodeCameraOpen(false);
          }}
          onClose={() => setIsBarcodeCameraOpen(false)}
        />
      )}

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!productToDelete}
        title="Delete Catalog Item"
        message={`Are you sure you want to permanently delete "${productToDelete?.name}" from the catalog?`}
        itemName={productToDelete?.name}
        onConfirm={() => {
          if (productToDelete) {
            deleteProduct(productToDelete.id);
            triggerToast(`Product "${productToDelete.name}" deleted successfully! ✔`, 'success');
            setProductToDelete(null);
          }
        }}
        onClose={() => setProductToDelete(null)}
      />
    </div>
  );
};
