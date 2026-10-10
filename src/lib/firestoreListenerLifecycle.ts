export type AuthResolution = 'initializing' | 'authenticated' | 'signed_out';

export const workspaceListenerKey = ({
  authResolution,
  userId,
  ownerScope,
  workspaceScope,
}: {
  authResolution: AuthResolution;
  userId?: string | null;
  ownerScope?: string | null;
  workspaceScope?: string | null;
}) => {
  if (authResolution !== 'authenticated' || !userId || !ownerScope || !workspaceScope) return null;
  if (ownerScope === 'default_store' || workspaceScope === 'default_store') return null;
  return `${userId}:${ownerScope}:${workspaceScope}`;
};

export const createSubscriptionLifecycle = () => {
  let activeKey: string | null = null;
  let stopActive: (() => void) | null = null;

  return {
    update(nextKey: string | null, start: () => () => void) {
      if (nextKey === activeKey) return false;
      stopActive?.();
      activeKey = nextKey;
      stopActive = nextKey ? start() : null;
      return true;
    },
    dispose() {
      stopActive?.();
      stopActive = null;
      activeKey = null;
    },
    activeKey() {
      return activeKey;
    },
  };
};
