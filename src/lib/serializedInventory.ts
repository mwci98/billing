import { Product, SerializedInventoryUnit } from '../types';

export const getSerializedUnits = (product: Product): SerializedInventoryUnit[] => {
  if (product.serializedUnits?.length) return product.serializedUnits;
  return (product.imeiNumbers || []).map((imei, index) => ({
    id: `legacy-${product.id}-${index}-${imei}`,
    imei1: imei,
    status: 'In Stock' as const,
    addedAt: product.createdAt || new Date().toISOString()
  }));
};

export const getAvailableSerializedUnits = (product: Product) =>
  getSerializedUnits(product).filter(unit => unit.status === 'In Stock' || unit.status === 'Returned');

export const productUsesImeiTracking = (product: Product) =>
  Boolean(product.inventoryTrackingType && product.inventoryTrackingType !== 'none') ||
  Boolean(product.trackInventoryByImei || product.serializedUnits?.length || product.imeiNumbers?.length);

export const getInventoryTrackingType = (product: Product): 'none' | 'imei' | 'serial' => {
  if (product.inventoryTrackingType) return product.inventoryTrackingType;
  return productUsesImeiTracking(product) ? 'imei' : 'none';
};

export const parseSerializedUnitLines = (
  input: string,
  trackingType: 'imei' | 'serial' = 'imei'
): Array<{ imei1: string; imei2?: string }> => input
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean)
  .map(line => {
    if (trackingType === 'serial') return {imei1: line};
    const values = line.match(/\d{15}/g) || [];
    return values.length ? {imei1: values[0], ...(values[1] ? {imei2: values[1]} : {})} : null;
  })
  .filter((unit): unit is {imei1: string; imei2?: string} => Boolean(unit));

export const makeSerializedUnit = (
  imei1: string,
  imei2?: string,
  existing?: SerializedInventoryUnit
): SerializedInventoryUnit => existing || {
  id: `imei-${imei1}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  imei1,
  ...(imei2 ? { imei2 } : {}),
  status: 'In Stock',
  addedAt: new Date().toISOString()
};

export const normalizeScannerValue = (value: string) => {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  // Hardware scanners can prepend symbology identifiers such as ]C1.
  // IMEIs are always 15 digits, so use the final 15 numeric characters.
  if (digits.length >= 15) return digits.slice(-15);
  return trimmed;
};
