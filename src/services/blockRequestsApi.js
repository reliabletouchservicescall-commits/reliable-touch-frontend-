import api from '../lib/axios'

export const blockRequestsApi = {
  // Cold caller submits a request
  create: (contactId, reason) =>
    api.post('/block-requests', { contactId, reason }).then((r) => r.data.data.request),

  // Cold caller's own request history
  myRequests: (params = {}) =>
    api.get('/block-requests/my', { params }).then((r) => r.data.data),

  // Admin lists requests
  list: (params = {}) =>
    api.get('/block-requests', { params }).then((r) => r.data.data),

  // Admin approves or dismisses
  resolve: (id, body) =>
    api.patch(`/block-requests/${id}`, body).then((r) => r.data.data.request),
}
