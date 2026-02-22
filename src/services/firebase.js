import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAe-PAuB9GlFX4YlJoFPrfJ9m-NPTW4Ejs',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'bhada-api.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'bhada-api',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'bhada-api.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '478743960698',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:478743960698:web:f20eee2387d9aa81e0efc3',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-ZN80LXX0MP',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const clearRecaptcha = () => {
  if (window.recaptchaVerifier) {
    try { window.recaptchaVerifier.clear(); } catch (_) {}
    window.recaptchaVerifier = null;
  }
};

export const sendOTP = async (phoneNumber, containerId = 'recaptcha-container') => {
  clearRecaptcha();
  const container = document.getElementById(containerId);
  if (!container) throw new Error(`reCAPTCHA container #${containerId} not found`);

  // Use 'normal' (visible checkbox) reCAPTCHA — this avoids auth/invalid-app-credential
  // which happens with invisible reCAPTCHA when app domain is not whitelisted in Firebase.
  // For test/dev: add localhost to Firebase Console → Authentication → Settings → Authorized Domains
  // For test phone numbers: add them in Firebase Console → Authentication → Sign-in method → Phone → Test phone numbers
  window.recaptchaVerifier = new RecaptchaVerifier(auth, container, {
    size: 'normal',
    callback: () => {},
    'expired-callback': clearRecaptcha,
  });

  await window.recaptchaVerifier.render();
  return signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
};

export const verifyOTP = async (confirmationResult, otp) => {
  const result = await confirmationResult.confirm(otp);
  return result.user.getIdToken();
};

export { clearRecaptcha };
export default app;
