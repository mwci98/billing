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
  Boolean(product.trackInventoryByImei || product.serializedUnits?.length || product.imeiNumbers?.length);

export const parseSerializedUnitLines = (input: string): Array<{ imei1: string; imei2?: string }> =>
  input
    .split(/\r?\n/)
    .map(line => line.match(/\d{15}/g) || [])
    .filter(values => values.length > 0)
    .map(values => ({ imei1: values[0], ...(values[1] ? { imei2: values[1] } : {}) }));

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
