import {getApp, getApps, initializeApp} from 'firebase/app';
import {ConfirmationResult, getAuth, RecaptchaVerifier, signInWithPhoneNumber} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const customerApp = getApps().some(app => app.name === 'qpos-customer-auth')
  ? getApp('qpos-customer-auth')
  : initializeApp(firebaseConfig, 'qpos-customer-auth');
const customerAuth = getAuth(customerApp);
let verifier: RecaptchaVerifier | null = null;

export const normalizeIndianMobile = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (value.trim().startsWith('+') && digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  throw new Error('Enter a valid mobile number with country code');
};

export const sendCustomerOtp = async (mobile: string, containerId: string) => {
  verifier?.clear();
  verifier = new RecaptchaVerifier(customerAuth, containerId, {size: 'invisible'});
  return signInWithPhoneNumber(customerAuth, normalizeIndianMobile(mobile), verifier);
};

export const verifyCustomerOtp = async (confirmation: ConfirmationResult, code: string) => {
  if (!/^\d{6}$/.test(code.trim())) throw new Error('Enter the 6-digit verification code');
  const credential = await confirmation.confirm(code.trim());
  return credential.user.getIdToken();
};

export type CustomerOtpConfirmation = ConfirmationResult;
