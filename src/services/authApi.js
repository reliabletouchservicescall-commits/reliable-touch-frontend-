import axiosClient from '../lib/axios'
import { useAuthStore } from '../store/authStore'

export const authApi = {
  login: (email, password) =>
    axiosClient.post('/auth/login', { email, password }),

  register: (data) =>
    axiosClient.post('/auth/register', data),

  getMe: () =>
    axiosClient.get('/auth/me'),

  refresh: (refreshToken) =>
    axiosClient.post('/auth/refresh', { refreshToken }),

  // Sends this device's refresh token so only this session ends — other devices stay signed in
  logout: () =>
    axiosClient.post('/auth/logout', { refreshToken: useAuthStore.getState().refreshToken ?? undefined }),
}
