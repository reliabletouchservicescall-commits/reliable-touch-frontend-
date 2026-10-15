import { io } from 'socket.io-client'
import { SOCKET_URL } from './runtimeEnv'
import { useAuthStore } from '../store/authStore'

let socket = null

export function getSocket() {
  return socket
}

export function connectSocket(token) {
  if (socket?.connected) return socket

  socket = io(SOCKET_URL, {
    // A function, not a fixed object: Socket.IO calls it on every (re)connect, so a
    // reconnect after the 15-minute access token expired picks up the refreshed token
    // instead of being rejected with the stale one it was created with.
    auth: (cb) => cb({ token: useAuthStore.getState().accessToken ?? token }),
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    transports: ['websocket', 'polling'],
  })

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
