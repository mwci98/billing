import {updateTenantSubscription} from '../../../api/_firebase-admin.js';

type SubscriptionUpdater = typeof updateTenantSubscription;
let updater: SubscriptionUpdater = updateTenantSubscription;

export const subscriptionAdapter = {
  update: (tenantId: string, subscription: Record<string, unknown>) => updater(tenantId, subscription),
  setUpdaterForTests: (factory: SubscriptionUpdater) => { updater = factory; },
  reset: () => { updater = updateTenantSubscription; },
};
