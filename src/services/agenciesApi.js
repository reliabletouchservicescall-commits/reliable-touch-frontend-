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
  resetTeamMemberPassword: (id, userId, password) => axiosClient.patch(`/agencies/${id}/team/${userId}/password`, { password }),
  setTeamMemberAdmin: (id, userId, isAgencyAdmin) => axiosClient.patch(`/agencies/${id}/team/${userId}/admin`, { isAgencyAdmin }),

  // Company profile — logo, brand colour, registered details
  myProfile:     ()         => axiosClient.get('/agencies/mine/profile'),
  getProfile:    (id)       => axiosClient.get(`/agencies/${id}/profile`),
  updateProfile: (id, data) => axiosClient.patch(`/agencies/${id}/profile`, data),
  uploadLogo: (id, file, primaryColor) => {
    const fd = new FormData()
    fd.append('logo', file)
    if (primaryColor) fd.append('primaryColor', primaryColor)
    return axiosClient.post(`/agencies/${id}/logo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  removeLogo: (id) => axiosClient.delete(`/agencies/${id}/logo`),
}
