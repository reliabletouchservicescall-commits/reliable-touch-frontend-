import axiosClient from '../lib/axios'

export const leaseRenewalsApi = {
  list:    (params)    => axiosClient.get('/lease-renewals', { params }),
  getById: (id)        => axiosClient.get(`/lease-renewals/${id}`),
  update:  (id, data)  => axiosClient.patch(`/lease-renewals/${id}`, data),
}
