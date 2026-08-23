import axiosClient from '../lib/axios'

export const callLogsApi = {
  list:            (params)      => axiosClient.get('/call-logs', { params }),
  create:          (data)        => axiosClient.post('/call-logs', data),
  update:          (id, data)    => axiosClient.patch(`/call-logs/${id}`, data),
  remove:          (id)          => axiosClient.delete(`/call-logs/${id}`),
  listByContact:   (contactId)   => axiosClient.get(`/call-logs/contact/${contactId}`),
}
