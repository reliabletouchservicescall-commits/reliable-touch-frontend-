import axiosClient from '../lib/axios'

export const notificationsApi = {
  list: (params = {}) =>
    axiosClient.get('/notifications', { params }).then((r) => r.data.data),

  unreadCount: () =>
    axiosClient
      .get('/notifications', { params: { unread: 'true', limit: 1 } })
      .then((r) => r.data.data.total),

  markRead: (id) =>
    axiosClient.patch(`/notifications/${id}/read`).then((r) => r.data.data),

  markAllRead: () =>
    axiosClient.patch('/notifications/read-all').then((r) => r.data.data),
}
