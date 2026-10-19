import { config } from '../config/env';

/**
 * Firebase Phone Auth for the website (used when the API runs AUTH_MODE=firebase).
 * The SDK is loaded from Google's CDN only when a shopper signs in, so it adds
 * nothing to the page weight otherwise.
 */
const SDK = 'https://www.gstatic.com/firebasejs/10.14.1';

interface Confirmation {
  confirm(code: string): Promise<{ user: { getIdToken(): Promise<string> } }>;
}

let pending: Confirmation | null = null;

export const firebaseConfigured = () => !!(config.firebase.apiKey && config.firebase.projectId);

export async function sendFirebaseOtp(phone: string, buttonId: string): Promise<void> {
  const app = await import(/* @vite-ignore */ `${SDK}/firebase-app.js`);
  const auth = await import(/* @vite-ignore */ `${SDK}/firebase-auth.js`);
  const fb = app.getApps().length ? app.getApp() : app.initializeApp(config.firebase);
  const a = auth.getAuth(fb);
  const verifier = new auth.RecaptchaVerifier(a, buttonId, { size: 'invisible' });
  const digits = phone.replace(/\D/g, '').slice(-10);
  pending = await auth.signInWithPhoneNumber(a, `+91${digits}`, verifier);
}

export async function confirmFirebaseOtp(code: string): Promise<string> {
  if (!pending) throw new Error('Request a new OTP first');
  const cred = await pending.confirm(code);
  return cred.user.getIdToken();
}
