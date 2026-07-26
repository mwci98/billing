import React, {useCallback, useEffect, useState} from 'react';
import {Clock3, CreditCard, Loader2, LockKeyhole, LogOut, ShieldCheck} from 'lucide-react';
import {useAppState} from '../lib/stateContext';
import {UserRole} from '../types';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {open: () => void};
  }
}

async function loadRazorpayCheckout() {
  if (window.Razorpay) return true;
  return new Promise<boolean>(resolve => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

async function readApiResponse(response: Response) {
  const body = await response.text();
  if (!body) return {};

  try {
    return JSON.parse(body) as Record<string, any>;
  } catch {
    throw new Error(
      response.ok
        ? 'The payment server returned an invalid response. Please try again.'
        : `The payment service is temporarily unavailable (${response.status}). Please try again.`,
    );
  }
}

export const SubscriptionGate: React.FC<{children: React.ReactNode}> = ({children}) => {
  const {settings, currentUser, updateSettings, logout, triggerToast} = useAppState();
  const [loading, setLoading] = useState(false);

  if (!currentUser) return <>{children}</>;

  const trialEnd = settings.trialEndsAt ? new Date(settings.trialEndsAt).getTime() : Number.POSITIVE_INFINITY;
  const remainingMs = trialEnd - Date.now();
  const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
  const isActive = settings.subscriptionStatus === 'active';
  const isTrialing = settings.subscriptionStatus === 'trialing' || !settings.subscriptionStatus;
  const isBlocked = !isActive && (!isTrialing || remainingMs <= 0);
  const isOwner = currentUser.role === UserRole.ADMIN;

  const startSubscription = useCallback(async () => {
    if (!isOwner || loading) return;
    setLoading(true);
    try {
      const checkoutLoaded = await loadRazorpayCheckout();
      if (!checkoutLoaded || !window.Razorpay) {
        throw new Error('Razorpay Checkout could not be loaded.');
      }

      const createResponse = await fetch('/api/razorpay/create-subscription', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          tenantId: currentUser.tenantId || settings.tenantId,
          email: currentUser.email,
          name: currentUser.name,
        }),
      });
      const subscription = await readApiResponse(createResponse);
      if (!createResponse.ok) {
        throw new Error(
          subscription.error ||
          (createResponse.status === 503
            ? 'Razorpay is not configured yet. Add the Razorpay keys in Vercel to enable upgrades.'
            : 'Unable to start subscription. Please try again.'),
        );
      }

      const checkout = new window.Razorpay({
        key: subscription.keyId,
        subscription_id: subscription.subscriptionId,
        name: 'QuickPOS',
        description: 'Basic Plan · ₹6,000 per year',
        prefill: {name: currentUser.name, email: currentUser.email},
        theme: {color: '#10B981'},
        handler: async (payment: any) => {
          const verificationResponse = await fetch('/api/razorpay/verify', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              tenantId: currentUser.tenantId || settings.tenantId,
              razorpayPaymentId: payment.razorpay_payment_id,
              razorpaySubscriptionId: payment.razorpay_subscription_id,
              razorpaySignature: payment.razorpay_signature,
            }),
          });
          const verification = await readApiResponse(verificationResponse);
          if (!verificationResponse.ok || !verification.verified) {
            triggerToast(verification.error || 'Payment verification failed.', 'error');
            return;
          }
          updateSettings({
            ...settings,
            planTier: 'Basic',
            subscriptionStatus: 'active',
            razorpaySubscriptionId: verification.razorpaySubscriptionId,
          });
          triggerToast('Basic subscription activated successfully.', 'success');
        },
        modal: {ondismiss: () => setLoading(false)},
      });
      checkout.open();
    } catch (error) {
      triggerToast(error instanceof Error ? error.message : 'Unable to start subscription.', 'error');
      setLoading(false);
    }
  }, [currentUser, isOwner, loading, settings, triggerToast, updateSettings]);

  useEffect(() => {
    const handleSubscriptionRequest = () => {
      void startSubscription();
    };

    window.addEventListener('start-pro-subscription', handleSubscriptionRequest);
    return () => window.removeEventListener('start-pro-subscription', handleSubscriptionRequest);
  }, [startSubscription]);

  return (
    <>
      {isTrialing && Boolean(settings.trialEndsAt) && !isBlocked && (
        <div className="fixed top-16 right-4 z-40 rounded-xl border border-amber-500/20 bg-amber-500/10 backdrop-blur-xl px-3 py-2 text-[10px] font-bold text-amber-500 shadow-lg">
          <span className="flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" />
            Basic trial · {remainingDays} {remainingDays === 1 ? 'day' : 'days'} remaining
          </span>
        </div>
      )}

      {children}

      {isBlocked && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0A0A0B]/95 p-4 backdrop-blur-xl">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#141416] p-7 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
              {isOwner ? <CreditCard className="h-7 w-7" /> : <LockKeyhole className="h-7 w-7" />}
            </div>
            <h2 className="mt-5 text-2xl font-black text-white">Your 5-day trial has ended</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              {isOwner
                ? 'Subscribe to the Basic plan to restore access for your store and all staff accounts.'
                : 'The store owner must activate a subscription before staff can continue working.'}
            </p>

            <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-left">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">Basic Plan</span>
                <span className="font-mono text-lg font-black text-emerald-400">₹6,000/year</span>
              </div>
              <p className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Recurring billing secured by Razorpay
              </p>
            </div>

            {isOwner && (
              <button onClick={startSubscription} disabled={loading}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                Subscribe with Razorpay
              </button>
            )}
            <button onClick={logout}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-xs font-bold text-gray-400 hover:bg-white/5">
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </>
  );
};
