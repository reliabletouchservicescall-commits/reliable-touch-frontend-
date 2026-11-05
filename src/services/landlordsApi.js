import axiosClient from '../lib/axios'

// Team side — signed in (admin, follow-up managers, a company's managers)
export const landlordLinksApi = {
  forLead: (leadId) => axiosClient.get(`/landlord-links/lead/${leadId}`),
  upsert: (leadId, data) => axiosClient.post(`/landlord-links/lead/${leadId}`, data),
  shared: (id, via) => axiosClient.post(`/landlord-links/${id}/shared`, { via }),
  withdraw: (id) => axiosClient.post(`/landlord-links/${id}/withdraw`),
  shareApplications: (id, applicationIds) => axiosClient.post(`/landlord-links/${id}/applications`, { applicationIds }),
}

// Landlord side — the private link, no sign-in. ?preview lets the team look without counting.
export const landlordApi = {
  open: (token, preview) => axiosClient.get(`/public/landlord/${token}`, { params: preview ? { preview: 1 } : undefined }),
  save: (token, data) => axiosClient.patch(`/public/landlord/${token}`, data),
  upload: (token, key, files) => {
    const fd = new FormData()
    fd.append('key', key)
    ;[...files].forEach((f) => fd.append('files', f))
    return axiosClient.post(`/public/landlord/${token}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  remove: (token, docId) => axiosClient.delete(`/public/landlord/${token}/documents/${docId}`),
  sign: (token, data) => axiosClient.post(`/public/landlord/${token}/sign`, data),
  application: (token, appId) => axiosClient.get(`/public/landlord/${token}/applications/${appId}`),
  decide: (token, appId, decision, note) => axiosClient.post(`/public/landlord/${token}/applications/${appId}/decision`, { decision, note }),
  // Streamed view-only (see landlords.service streamDocument)
  documentUrl: (token, appId, docId) => `${axiosClient.defaults.baseURL?.replace(/\/$/, '')}/public/landlord/${token}/applications/${appId}/documents/${docId}`,
}
