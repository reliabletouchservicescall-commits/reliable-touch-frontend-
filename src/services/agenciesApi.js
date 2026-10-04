import axiosClient from '../lib/axios'

export const agenciesApi = {
  list:      (params)     => axiosClient.get('/agencies', { params }),
  getById:   (id)         => axiosClient.get(`/agencies/${id}`),
  create:    (data)       => axiosClient.post('/agencies', data),
  update:    (id, data)   => axiosClient.patch(`/agencies/${id}`, data),
  remove:    (id)         => axiosClient.delete(`/agencies/${id}`),
  listTeam:  (id)         => axiosClient.get(`/agencies/${id}/team`),
  myTeam:    ()           => axiosClient.get('/agencies/mine/team'),
  addTeamMember:       (id, data)          => axiosClient.post(`/agencies/${id}/team`, data),
  setTeamMemberActive: (id, userId, isActive) => axiosClient.patch(`/agencies/${id}/team/${userId}`, { isActive }),
}
