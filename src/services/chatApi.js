import api from '../lib/axios'

export const chatApi = {
  listConversations: () =>
    api.get('/chat/conversations').then((r) => r.data.data),

  openConversation: (userId) =>
    api.post('/chat/conversations', { userId }).then((r) => r.data.data),

  getConversation: (id) =>
    api.get(`/chat/conversations/${id}`).then((r) => r.data.data),

  getMessages: (id, params = {}) =>
    api.get(`/chat/conversations/${id}/messages`, { params }).then((r) => r.data.data),

  markRead: (id) =>
    api.post(`/chat/conversations/${id}/read`).then((r) => r.data.data),

  unreadCount: () =>
    api.get('/chat/unread-count').then((r) => r.data.data.count),

  myConversation: () =>
    api.get('/chat/my-conversation').then((r) => r.data.data),

  uploadAttachments: (conversationId, files, onProgress) => {
    const fd = new FormData()
    files.forEach((f) => fd.append('files', f))
    return api.post(`/chat/conversations/${conversationId}/attachments`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total))
      },
    }).then((r) => r.data.data.attachments)
  },
}
