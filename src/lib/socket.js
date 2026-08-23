import { io } from 'socket.io-client'

// In dev the vite proxy forwards /socket.io to localhost:5000
// In prod set VITE_SOCKET_URL to the backend base URL
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin

let socket = null

export function getSocket() {
  return socket
}

export function connectSocket(token) {
  if (socket?.connected) return socket

  socket = io(SOCKET_URL, {
    auth: { token },
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
