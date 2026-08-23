import axiosClient from '../lib/axios'

export const agenciesApi = {
  list:     (params)     => axiosClient.get('/agencies', { params }),
  getById:  (id)         => axiosClient.get(`/agencies/${id}`),
  create:   (data)       => axiosClient.post('/agencies', data),
  update:   (id, data)   => axiosClient.patch(`/agencies/${id}`, data),
  remove:   (id)         => axiosClient.delete(`/agencies/${id}`),
}
