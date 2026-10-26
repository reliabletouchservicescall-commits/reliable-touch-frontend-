import axiosClient from '../lib/axios'

export const leadsApi = {
  list: (params) => axiosClient.get('/leads', { params }),
  getById: (id) => axiosClient.get(`/leads/${id}`),
  create: (data) => axiosClient.post('/leads', data),
  update: (id, data) => axiosClient.patch(`/leads/${id}`, data),
  updateStatus: (id, data) => axiosClient.patch(`/leads/${id}/status`, data),
  remove: (id) => axiosClient.delete(`/leads/${id}`),
  addComment: (id, text) => axiosClient.post(`/leads/${id}/comments`, { text }),
  getComments: (id) => axiosClient.get(`/leads/${id}/comments`),
  followUpManagers: () => axiosClient.get('/leads/follow-up-managers'),
  getStats: (params) => axiosClient.get('/leads/stats', { params }),
  // Role-scoped report for the leads screen's insight panels (see LeadsHub.jsx)
  insights: (params) => axiosClient.get('/leads/insights', { params }),
  agencyCounts: (params) => axiosClient.get('/leads/agency-counts', { params }),
  // Companies + agents a lead can be handed to — admin and follow-up manager
  assignees: () => axiosClient.get('/leads/assignees'),
  getLinkPreview: (url) => axiosClient.get('/leads/link-preview', { params: { url } }),
  // Full audit trail: status moves (who, from → to, why), field edits, calls, comments
  history: (id) => axiosClient.get(`/leads/${id}/history`),
  // Admin: hand to agent / assign follow-up / change stage for many leads at once
  bulk: (data) => axiosClient.post('/leads/bulk', data),
  // The lead's deal (Deal Tracker) — admin / the company working it
  updateDeal: (id, data) => axiosClient.patch(`/leads/${id}/deal`, data),
}
