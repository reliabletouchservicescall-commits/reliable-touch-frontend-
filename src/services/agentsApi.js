import axiosClient from '../lib/axios'

export const agentsApi = {
  createVisit: (data)      => axiosClient.post('/agents/visits', data),
  listVisits:  (params)    => axiosClient.get('/agents/visits', { params }),
  getVisit:    (id)        => axiosClient.get(`/agents/visits/${id}`),
  updateVisit: (id, data)  => axiosClient.patch(`/agents/visits/${id}`, data),
}
