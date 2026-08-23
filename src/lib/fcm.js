import { getToken, onMessage } from 'firebase/messaging'
import { toast } from 'sonner'
import { getFirebaseMessaging } from './firebase'
import axiosClient from './axios'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

/**
 * Request notification permission, get the FCM token, and register it with
 * the backend. Safe to call multiple times — exits early if already granted.
 */
export async function initFCM() {
  if (!('Notification' in window)) return
  if (!VAPID_KEY || VAPID_KEY === 'your_vapid_key_here') {
    console.warn('[FCM] VITE_FIREBASE_VAPID_KEY not configured — push disabled')
    return
  }

  const messaging = await getFirebaseMessaging()
  if (!messaging) return

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.info('[FCM] Notification permission denied')
      return
    }

    await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.ready,
    })

    if (token) {
      await axiosClient.post('/notifications/register-device', { fcmToken: token })
      console.info('[FCM] Push token registered')
    }
  } catch (err) {
    console.warn('[FCM] init error:', err.message)
  }
}

/**
 * Subscribe to foreground push messages and show them as sonner toasts.
 * Returns an unsubscribe function.
 */
export async function subscribeForegroundMessages() {
  const messaging = await getFirebaseMessaging()
  if (!messaging) return () => {}

  return onMessage(messaging, (payload) => {
    const { title = 'Notification', body = '' } = payload.notification ?? {}
    toast.info(title, {
      description: body,
      duration: 6000,
    })
  })
}
