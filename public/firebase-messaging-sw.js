// Background push message handler — runs as a service worker
// Firebase config must be duplicated here (no access to import.meta.env in SW)
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey:            'AIzaSyBHWMxM5Df_Kkm2g_tm6yL0izc3hVWCXG4',
  authDomain:        'reliable-touch-crm.firebaseapp.com',
  projectId:         'reliable-touch-crm',
  storageBucket:     'reliable-touch-crm.firebasestorage.app',
  messagingSenderId: '71581047019',
  appId:             '1:71581047019:web:fa666850e656e05d0b46ae',
})

const messaging = firebase.messaging()

// Show a native OS notification when the tab is in background / closed
messaging.onBackgroundMessage((payload) => {
  const { title = 'Reliable Touch', body = '' } = payload.notification ?? {}
  self.registration.showNotification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data ?? {},
  })
})

// Open or focus the app when the user clicks the background notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        const existing = windowClients.find((c) => c.url.includes(self.location.origin))
        if (existing) return existing.focus()
        return clients.openWindow('/')
      })
  )
})
