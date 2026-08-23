import axiosClient from '../lib/axios'

export const usersApi = {
  list: (params) => axiosClient.get('/admin/users', { params }),
  getById: (id) => axiosClient.get(`/admin/users/${id}`),
  create: (data) => axiosClient.post('/admin/users', data),
  update: (id, data) => axiosClient.patch(`/admin/users/${id}`, data),
  deactivate: (id) => axiosClient.patch(`/admin/users/${id}/deactivate`),
  remove: (id) => axiosClient.delete(`/admin/users/${id}`),
  resetPassword: (id, password) => axiosClient.patch(`/admin/users/${id}/reset-password`, { password }),
  loginHistory: (id) => axiosClient.get(`/admin/users/${id}/login-history`),
}
