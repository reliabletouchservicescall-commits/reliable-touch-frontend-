import axiosClient from '../lib/axios'

export const contactsApi = {
  list:      (params) => axiosClient.get('/contacts', { params }),
  getById:   (id)     => axiosClient.get(`/contacts/${id}`),
  create:    (data)   => axiosClient.post('/contacts', data),
  update:    (id, data) => axiosClient.patch(`/contacts/${id}`, data),
  remove:    (id)     => axiosClient.delete(`/contacts/${id}`),
  listSchemes: ()     => axiosClient.get('/contacts/schemes'),
  listFiles:  ()      => axiosClient.get('/contacts/files'),
  import:    (formData) => axiosClient.post('/contacts/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  assignByRange:  (data) => axiosClient.post('/contacts/assign-by-range', data),
  assignByScheme: (data) => axiosClient.post('/contacts/assign-by-scheme', data),
}
