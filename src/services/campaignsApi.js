import axiosClient from '../lib/axios'

export const campaignsApi = {
  list:    (params) => axiosClient.get('/campaigns', { params }),
  getById: (id)     => axiosClient.get(`/campaigns/${id}`),
  create:  (data)   => axiosClient.post('/campaigns', data),
  update:  (id, data) => axiosClient.patch(`/campaigns/${id}`, data),
  remove:  (id)     => axiosClient.delete(`/campaigns/${id}`),
}
