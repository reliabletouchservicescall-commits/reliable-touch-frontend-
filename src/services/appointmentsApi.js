import axiosClient from '../lib/axios'

export const appointmentsApi = {
  list:      (params) => axiosClient.get('/appointments', { params }),
  today:     ()       => axiosClient.get('/appointments/today'),
  tomorrow:  ()       => axiosClient.get('/appointments/tomorrow'),
  assignees: ()       => axiosClient.get('/appointments/assignees'),
  getById:   (id)     => axiosClient.get(`/appointments/${id}`),
  create:    (data)   => axiosClient.post('/appointments', data),
  update:    (id, data) => axiosClient.patch(`/appointments/${id}`, data),
}
