import axiosClient from '../lib/axios'

export const commissionsApi = {
  list:       (params) => axiosClient.get('/commissions', { params }),
  getById:    (id)     => axiosClient.get(`/commissions/${id}`),
  update:     (id, data) => axiosClient.patch(`/commissions/${id}`, data),
  initiatePaynow: (id) => axiosClient.post(`/commissions/${id}/pay`),
}
