import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, isSupported } from 'firebase/messaging'
import { FIREBASE_CONFIG } from './runtimeEnv'

const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG)

// Messaging is only available in supported browsers (not SSR, not Safari < 16.4)
let messagingPromise = null
export function getFirebaseMessaging() {
  if (!messagingPromise) {
    messagingPromise = isSupported().then((supported) => {
      if (!supported) return null
      return getMessaging(app)
    })
  }
  return messagingPromise
}

export default app
