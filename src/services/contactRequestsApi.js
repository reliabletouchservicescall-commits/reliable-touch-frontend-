import api from '../lib/axios'

export const contactRequestsApi = {
  // Cold caller submits a request
  create: (message) =>
    api.post('/contact-requests', { message }).then((r) => r.data.data.request),

  // Cold caller checks own pending request
  myPending: () =>
    api.get('/contact-requests/my-pending').then((r) => r.data.data.request),

  // Admin lists requests
  list: (params = {}) =>
    api.get('/contact-requests', { params }).then((r) => r.data.data),

  // Admin updates status
  updateStatus: (id, body) =>
    api.patch(`/contact-requests/${id}`, body).then((r) => r.data.data.request),
}
