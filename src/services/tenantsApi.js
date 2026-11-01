import axiosClient from '../lib/axios'

// Team side — signed in
export const tenantsApi = {
  list:          (params)          => axiosClient.get('/tenant-applications', { params }),
  listedRentals: (search)          => axiosClient.get('/tenant-applications/listed-rentals', { params: { search } }),
  forLead:       (leadId)          => axiosClient.get(`/tenant-applications/lead/${leadId}`),
  create:        (leadId, data)    => axiosClient.post(`/tenant-applications/lead/${leadId}`, data),
  get:           (id)              => axiosClient.get(`/tenant-applications/${id}`),
  shared:        (id, via)         => axiosClient.post(`/tenant-applications/${id}/shared`, { via }),
  remind:        (id)              => axiosClient.post(`/tenant-applications/${id}/remind`),
  requestChanges:(id, data)        => axiosClient.post(`/tenant-applications/${id}/request-changes`, data),
  resolveIssue:  (id, issueId)     => axiosClient.post(`/tenant-applications/${id}/issues/${issueId}/resolve`),
  decide:        (id, decision, reason) => axiosClient.post(`/tenant-applications/${id}/decision`, { decision, reason }),
  reopen:        (id)              => axiosClient.post(`/tenant-applications/${id}/reopen`),
  withdraw:      (id)              => axiosClient.post(`/tenant-applications/${id}/withdraw`),
}

// Tenant side — the private link, no sign-in. A team member opening it with ?assist (to fill it
// in for the tenant) or ?preview sends that along, so the server records it in their name.
let mode = null
export const setApplyMode = (m) => { mode = ['assist', 'preview'].includes(m) ? m : null }
const cfg = (extra = {}) => ({ ...extra, headers: { ...(extra.headers ?? {}), ...(mode ? { 'x-rt-mode': mode } : {}) } })

export const applyApi = {
  open:     (token)          => axiosClient.get(`/public/apply/${token}`, cfg()),
  save:     (token, data)    => axiosClient.patch(`/public/apply/${token}`, data, cfg()),
  upload:   (token, key, files, who = 'main') => {
    const fd = new FormData()
    fd.append('key', key)
    fd.append('who', who)
    ;[...files].forEach((f) => fd.append('files', f))
    return axiosClient.post(`/public/apply/${token}/documents`, fd, cfg({ headers: { 'Content-Type': 'multipart/form-data' } }))
  },
  remove:   (token, docId)   => axiosClient.delete(`/public/apply/${token}/documents/${docId}`, cfg()),
  submit:   (token, data)    => axiosClient.post(`/public/apply/${token}/submit`, data, cfg()),
  // Renting together
  addCo:    (token, data)        => axiosClient.post(`/public/apply/${token}/co`, data, cfg()),
  updateCo: (token, coId, data)  => axiosClient.patch(`/public/apply/${token}/co/${coId}`, data, cfg()),
  removeCo: (token, coId)        => axiosClient.delete(`/public/apply/${token}/co/${coId}`, cfg()),
  shareCo:  (token, coId, data)  => axiosClient.post(`/public/apply/${token}/co/${coId}/shared`, data, cfg()),
  submitCo: (token, data)        => axiosClient.post(`/public/apply/${token}/co-submit`, data, cfg()),
}
