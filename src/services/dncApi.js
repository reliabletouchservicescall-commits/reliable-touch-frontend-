import axiosClient from '../lib/axios'

export const dncApi = {
  list:   (params) => axiosClient.get('/dnc', { params }),
  check:  (phone)  => axiosClient.get(`/dnc/check/${encodeURIComponent(phone)}`),
  add:    (data)   => axiosClient.post('/dnc', data),
  remove: (id)     => axiosClient.delete(`/dnc/${id}`),
}
