import axiosClient from '../lib/axios'

// The Bin's unlock token is short-lived, page-scoped, and sent explicitly per call
// (never wired into the shared axios instance) — unlocking the Bin has nothing to do
// with the admin's own login session, so it shouldn't ride along on every other request.
function binHeaders(token) {
  return { headers: { 'X-Bin-Token': token } }
}

export const binApi = {
  // Access / OTP — gated by adminOnly on the backend, no bin token needed yet.
  requestAccessOtp: (password) => axiosClient.post('/bin/access/request-otp', { password }),
  verifyAccessOtp: (otp) => axiosClient.post('/bin/access/verify-otp', { otp }),
  requestChangePasswordOtp: (currentPassword) => axiosClient.post('/bin/access/change-password/request-otp', { currentPassword }),
  changePassword: (otp, newPassword) => axiosClient.post('/bin/access/change-password', { otp, newPassword }),
  requestForgotPasswordOtp: () => axiosClient.post('/bin/access/forgot-password/request-otp'),
  resetPassword: (otp, newPassword) => axiosClient.post('/bin/access/reset-password', { otp, newPassword }),

  // Bin contents — require the unlock token from verifyAccessOtp/resetPassword.
  listItems: (token, params) => axiosClient.get('/bin/items', { params, ...binHeaders(token) }),
  restoreItem: (token, id) => axiosClient.post(`/bin/items/${id}/restore`, {}, binHeaders(token)),
  permanentlyDelete: (token, id) => axiosClient.delete(`/bin/items/${id}`, binHeaders(token)),
  emptyBin: (token, modelName) => axiosClient.delete('/bin/items', { params: modelName ? { modelName } : undefined, ...binHeaders(token) }),
}
