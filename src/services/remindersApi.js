import axiosClient from '../lib/axios'

// Your own reminders — they are listed in the Diary (GET /reports/agent-diary)
export const remindersApi = {
  create: (data) => axiosClient.post('/reminders', data),
  update: (id, data) => axiosClient.patch(`/reminders/${id}`, data),
  remove: (id) => axiosClient.delete(`/reminders/${id}`),
}
