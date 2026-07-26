/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Lock, Mail, BadgeAlert, Store, Loader2, ArrowRight
} from 'lucide-react';
import { useAppState } from '../lib/stateContext';
import { UserRole } from '../types';
import { auth } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

export const AuthScreen: React.FC = () => {
  const { login } = useAppState();
  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Google Login Auth method (Live Cloud Integration)
  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      // A new Google account owns a new tenant. Existing staff emails are
      // resolved by the staff directory inside the login action.
      const email = result.user.email || 'operator@shop.com';
      await login(email, UserRole.ADMIN, result.user.displayName || 'Business Owner');
    } catch (e: any) {
      console.warn("Google Sign-In blocked/cancelled. Using simulation standard fallback.", e);
      setErrorMsg('Google Sign-In was cancelled or popup was blocked in sandbox iframe.');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) {
      setErrorMsg('Please enter your business email address.');
      return;
    }
    
    const emailLower = emailInput.toLowerCase().trim();
    const isOwner = emailLower === 'jiv.dasgupta09@gmail.com' || emailLower.includes('admin') || emailLower.includes('owner');
    const role = isOwner ? UserRole.ADMIN : UserRole.STAFF;
    const name = emailLower.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    setLoading(true);
    setErrorMsg(null);
    const success = await login(
      emailLower,
      role,
      `${name} (${role === UserRole.ADMIN ? 'Owner' : 'Staff'})`,
      passwordInput
    );
    if (!success) {
      setErrorMsg('Staff account not found, disabled, or the passcode is incorrect.');
    }
    setLoading(false);
  };

  return (
    <div id="auth-panel" className="dark relative flex min-h-screen w-full items-center justify-center bg-[#0A0A0B] px-4 py-12 text-[#E0E0E0] transition-colors duration-150">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/25 via-transparent to-transparent pointer-events-none" />

      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
            <Store className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white">
            QuickMart Retail POS
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Realtime Billing & Inventory Management System
          </p>
        </div>

        {/* Auth Card */}
        <div className="overflow-hidden rounded-3xl bg-[#141416] shadow-xl border border-white/5 p-8 space-y-6">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/40 p-3.5 text-red-800 dark:text-red-300 text-xs">
              <BadgeAlert className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Credentials Form */}
          <form onSubmit={handleCustomFormSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Store Email (admin@shop.com / staff@shop.com)
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="login-email-input"
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="admin@shop.com"
                  className="block w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 pl-10 pr-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition duration-150"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Secure Password (admin123 / staff123)
                </label>
              </div>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="login-password-input"
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 pl-10 pr-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition duration-150"
                />
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 dark:bg-white p-3 text-sm font-semibold text-white dark:text-gray-950 hover:bg-gray-800 dark:hover:bg-gray-100 transition duration-150 cursor-pointer text-center"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span style={{ color: '#5ee9b5', fontSize: '15px', fontWeight: 'bold' }}>Authenticate Terminal</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-gray-100 dark:border-gray-800"></div>
            <span className="flex-shrink mx-4 text-xs font-mono text-gray-400">or single sign-on</span>
            <div className="flex-grow border-t border-gray-100 dark:border-gray-800"></div>
          </div>

          {/* Dynamic Google Auth SSO */}
          <button
            id="login-google-btn"
            type="button"
            disabled={loading}
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-250 dark:border-gray-800 bg-white dark:bg-gray-950 p-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition duration-150 cursor-pointer"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
            </svg>
            <span>Live Google Sign-In</span>
          </button>
        </div>

        <div className="text-center text-xs text-gray-400">
          <p>QuickMart Security: Active terminals log transactions with operator details.</p>
          <p>© 2026 QuickMart Enterprises Ltd.</p>
        </div>
      </div>
    </div>
  );
};
