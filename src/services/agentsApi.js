import axiosClient from '../lib/axios'

export const agentsApi = {
  myDashboard:    ()           => axiosClient.get('/agents/me/dashboard'),
  myLeads:        (params)     => axiosClient.get('/agents/me/leads', { params }),
  myAppointments: (params)     => axiosClient.get('/agents/me/appointments', { params }),
  createVisit:    (data)       => axiosClient.post('/agents/visits', data),
  listVisits:     (params)     => axiosClient.get('/agents/visits', { params }),
  getVisit:       (id)         => axiosClient.get(`/agents/visits/${id}`),
  updateVisit:    (id, data)   => axiosClient.patch(`/agents/visits/${id}`, data),
}
