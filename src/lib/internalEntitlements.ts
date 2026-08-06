const INTERNAL_TEST_ACCOUNTS = new Set([
  'jiv.dasgupta09@gmail.com',
  'mobilezonekohima@gmail.com'
]);

export const isInternalTestingAccount = (email?: string | null) =>
  Boolean(email && INTERNAL_TEST_ACCOUNTS.has(email.trim().toLowerCase()));
