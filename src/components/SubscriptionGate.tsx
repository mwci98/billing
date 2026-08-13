import React, {useCallback, useEffect, useState} from 'react';
import {CheckCircle2, CreditCard, Loader2, LockKeyhole, LogOut, ShieldCheck} from 'lucide-react';
import {useAppState} from '../lib/stateContext';
import {UserRole} from '../types';
import {isInternalTestingAccount, isInternalWorkspace} from '../lib/internalEntitlements';

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

// Razorpay fetches this public URL to display the merchant mark in Checkout.
const RAZORPAY_CHECKOUT_LOGO = 'https://qpos.neospec.co.in/icons/qpos-icon-source.png';
const RAZORPAY_THEME_COLOR = '#00BC7D';

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

  const hasInternalAccess = isInternalTestingAccount(currentUser.email) || isInternalWorkspace(currentUser.tenantId || settings.tenantId);
  const trialEnd = settings.trialEndsAt ? new Date(settings.trialEndsAt).getTime() : Number.POSITIVE_INFINITY;
  const remainingMs = trialEnd - Date.now();
  const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
  const isActive = settings.subscriptionStatus === 'active';
  const isTrialing = settings.subscriptionStatus === 'trialing' || !settings.subscriptionStatus;
  const isBlocked = !hasInternalAccess && !isActive && (!isTrialing || remainingMs <= 0);
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
          storeName: settings.storeName,
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
        name: 'QPOS',
        image: RAZORPAY_CHECKOUT_LOGO,
        description: 'QPOS Basic Plan · ₹6,000/year',
        prefill: {name: currentUser.name, email: currentUser.email},
        theme: {color: RAZORPAY_THEME_COLOR},
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
      {children}

      {isBlocked && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0A0A0B]/95 p-4 backdrop-blur-xl">
          <div className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/10 bg-[#141416] shadow-2xl">
            <div className={`grid ${isOwner ? 'md:grid-cols-[0.9fr_1.1fr]' : ''}`}>
              <section className="relative overflow-hidden bg-emerald-500 p-7 text-white sm:p-9">
                <div className="absolute -right-14 -top-16 h-52 w-52 rounded-full border-[28px] border-white/10" />
                <div className="relative">
                  <img src="/icons/qpos-logo.svg" alt="QPOS" className="h-12 w-12 rounded-2xl bg-white p-1.5 shadow-sm" />
                  <p className="mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-white/75">QPOS subscription</p>
                  <h2 className="mt-2 text-3xl font-black leading-tight">
                    {isOwner ? 'Keep your store running.' : 'Store subscription required'}
                  </h2>
                  <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/85">
                    {isOwner
                      ? 'Restore billing, inventory, reports, and staff access with one yearly plan.'
                      : 'The store owner needs to renew the QPOS subscription before staff can continue working.'}
                  </p>
                  {isOwner && <div className="mt-8 rounded-2xl border border-white/50 bg-white/10 p-4 backdrop-blur-sm">
                    <p className="text-[10px] font-black uppercase tracking-wider text-white/75">Today&apos;s checkout</p>
                    <div className="mt-1 flex items-baseline justify-between gap-3">
                      <span className="text-sm font-bold">Basic plan</span>
                      <span className="font-mono text-xl font-black">₹6,000/year</span>
                    </div>
                  </div>}
                </div>
              </section>

              <section className="p-7 sm:p-9">
                {isOwner ? <>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">Plan overview</p>
                  <h3 className="mt-2 text-2xl font-black text-white">Basic Plan</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">One subscription covers this workspace and its staff accounts.</p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {['Fast billing and GST invoices', 'Inventory and stock control', 'Restaurant and retail workflows', 'Reports, staff, and workspaces'].map(feature => (
                      <div key={feature} className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-xs font-semibold text-gray-200">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        {feature}
                      </div>
                    ))}
                  </div>
                  <button onClick={startSubscription} disabled={loading}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-black text-black transition hover:bg-gray-100 disabled:opacity-50">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    Continue to secure payment
                  </button>
                  <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-gray-500"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Payment is processed securely by Razorpay</p>
                </> : <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400"><LockKeyhole className="h-6 w-6" /></div>
                  <h3 className="mt-5 text-2xl font-black text-white">Access is paused</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">Please contact your store owner or manager to renew the subscription and restore your staff access.</p>
                </>}
                <button onClick={logout}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-xs font-bold text-gray-400 transition hover:bg-white/5">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
