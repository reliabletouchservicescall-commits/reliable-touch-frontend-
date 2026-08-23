import axiosClient from '../lib/axios'

export const authApi = {
  login: (email, password) =>
    axiosClient.post('/auth/login', { email, password }),

  register: (data) =>
    axiosClient.post('/auth/register', data),

  getMe: () =>
    axiosClient.get('/auth/me'),

  refresh: (refreshToken) =>
    axiosClient.post('/auth/refresh', { refreshToken }),

  logout: () =>
    axiosClient.post('/auth/logout'),
}
