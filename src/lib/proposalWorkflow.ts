import {Product, Proposal} from '../types';
import {getAvailableSerializedUnits, productUsesImeiTracking} from './serializedInventory';

export const PROPOSAL_DOCUMENT_TITLE = 'PROPOSAL / QUOTATION';
export const proposalStatusLabel = (status: Proposal['status']): string => status === 'Draft' ? 'Open' : status;

export const validateProposalConversion = (proposal: Proposal, products: Product[]): void => {
  if (proposal.status === 'Converted') throw new Error('Proposal has already been converted.');
  proposal.items.forEach(item => {
    const product = products.find(candidate => candidate.id === item.productId);
    if (!product) throw new Error(`Product "${item.name}" no longer exists.`);
    if (product.itemType === 'Service') return;
    if (product.stock - (product.reservedStock || 0) < item.quantity) throw new Error(`Insufficient stock for "${item.name}".`);
    if (productUsesImeiTracking(product)) {
      const requested = item.serializedUnits?.map(unit => unit.unitId) || [];
      const available = new Set(getAvailableSerializedUnits(product).map(unit => unit.id));
      if (requested.length !== item.quantity || requested.some(unitId => !available.has(unitId))) {
        throw new Error(`A serial number for "${item.name}" is no longer available.`);
      }
    }
  });
};
