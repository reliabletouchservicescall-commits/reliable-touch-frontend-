import axiosClient from '../lib/axios'

export const areasApi = {
  list:    (params)    => axiosClient.get('/areas', { params }),
  getById: (id)        => axiosClient.get(`/areas/${id}`),
  create:  (data)      => axiosClient.post('/areas', data),
  update:  (id, data)  => axiosClient.patch(`/areas/${id}`, data),
  remove:  (id)        => axiosClient.delete(`/areas/${id}`),
}
