export type BusinessMode = 'Retail' | 'Manufacturing' | 'Hybrid' | 'Service';

export const getBusinessMode = (value?: string): BusinessMode => {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('service')) return 'Service';
  if (normalized.includes('hybrid') || normalized.includes('both')) return 'Hybrid';
  if (normalized.includes('manufactur') || normalized.includes('production')) return 'Manufacturing';
  return 'Retail';
};

export const sourcingForBusinessMode = (
  mode: BusinessMode,
): 'Purchased' | 'Manufactured' | 'Both' => {
  if (mode === 'Manufacturing') return 'Manufactured';
  if (mode === 'Hybrid') return 'Both';
  return 'Purchased';
};
