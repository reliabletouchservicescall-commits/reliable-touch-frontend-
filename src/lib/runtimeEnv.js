// Cloudflare's Workers Build environment does not currently inject the VITE_* build-time
// variables from the (gitignored) local .env file — they only exist on this machine. When
// they're missing, Vite bakes `undefined` into the production bundle, `axios.js` falls back
// to a relative baseURL, and every API call silently resolves against the frontend's own
// origin instead of the real backend. Cloudflare Workers Assets only serves GET/HEAD, so
// that showed up as a 405 on login that looked like a backend problem but wasn't one.
//
// These fallbacks keep production working even if the dashboard's env vars are never set,
// while still letting an explicitly configured VITE_* value take priority.
const FALLBACK_API_BASE_URL = 'https://backend.api.reliabletouchservices.co.za'

const FALLBACK_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBHWMxM5Df_Kkm2g_tm6yL0izc3hVWCXG4',
  authDomain: 'reliable-touch-crm.firebaseapp.com',
  projectId: 'reliable-touch-crm',
  storageBucket: 'reliable-touch-crm.firebasestorage.app',
  messagingSenderId: '71581047019',
  appId: '1:71581047019:web:fa666850e656e05d0b46ae',
  measurementId: 'G-1KWZCXQKQL',
}

function resolve(envValue, fallback, label) {
  if (envValue) return envValue
  if (import.meta.env.PROD) {
    console.warn(
      `[env] ${label} was not set at build time — using the built-in production fallback. ` +
      `Set it in your deployment's environment variables to override.`
    )
  }
  return fallback
}

export const API_BASE_URL = resolve(import.meta.env.VITE_API_BASE_URL, FALLBACK_API_BASE_URL, 'VITE_API_BASE_URL')
export const SOCKET_URL = resolve(import.meta.env.VITE_SOCKET_URL, FALLBACK_API_BASE_URL, 'VITE_SOCKET_URL')

export const FIREBASE_CONFIG = {
  apiKey: resolve(import.meta.env.VITE_FIREBASE_API_KEY, FALLBACK_FIREBASE_CONFIG.apiKey, 'VITE_FIREBASE_API_KEY'),
  authDomain: resolve(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, FALLBACK_FIREBASE_CONFIG.authDomain, 'VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: resolve(import.meta.env.VITE_FIREBASE_PROJECT_ID, FALLBACK_FIREBASE_CONFIG.projectId, 'VITE_FIREBASE_PROJECT_ID'),
  storageBucket: resolve(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, FALLBACK_FIREBASE_CONFIG.storageBucket, 'VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: resolve(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, FALLBACK_FIREBASE_CONFIG.messagingSenderId, 'VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: resolve(import.meta.env.VITE_FIREBASE_APP_ID, FALLBACK_FIREBASE_CONFIG.appId, 'VITE_FIREBASE_APP_ID'),
  measurementId: resolve(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, FALLBACK_FIREBASE_CONFIG.measurementId, 'VITE_FIREBASE_MEASUREMENT_ID'),
}
