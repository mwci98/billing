const INTERNAL_TEST_ACCOUNTS = new Set([
  'jiv.dasgupta09@gmail.com',
  'jivdasgupta09@gmail.com',
  'mobilezonekohima@gmail.com'
]);

export const isInternalTestingAccount = (email?: string | null) =>
  Boolean(email && INTERNAL_TEST_ACCOUNTS.has(email.trim().toLowerCase()));

// Staff sessions retain the owner's tenant scope. This lets an internal workspace
// bypass subscription testing without granting the same bypass to unrelated staff.
export const isInternalWorkspace = (tenantId?: string | null) => {
  if (!tenantId) return false;
  const normalizedTenantId = tenantId.trim().toLowerCase();
  return [...INTERNAL_TEST_ACCOUNTS].some(email =>
    email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() === normalizedTenantId,
  );
};
