import axiosClient from '../lib/axios'

export const leadsApi = {
  list: (params) => axiosClient.get('/leads', { params }),
  getById: (id) => axiosClient.get(`/leads/${id}`),
  create: (data) => axiosClient.post('/leads', data),
  update: (id, data) => axiosClient.patch(`/leads/${id}`, data),
  updateStatus: (id, data) => axiosClient.patch(`/leads/${id}/status`, data),
  remove: (id) => axiosClient.delete(`/leads/${id}`),
}
