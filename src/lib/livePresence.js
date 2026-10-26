import { useEffect } from 'react'
import { getSocket } from './socket'

// Tells the server what this person is busy with, for the admin dashboard's "On the floor
// now" (see backend lib/presence.js), and which leads they have open, so they see others
// typing / changing it live (room lead:<id>). Everything is remembered here and re-sent
// whenever the socket (re)connects, so a dropped connection doesn't lose it.

let current = null            // { kind, leadId, leadName, contactName, since }
const watched = new Map()     // leadId → number of open views
const listeners = new Set()   // (event, payload) handlers for lead:typing / lead:changed
let boundSocket = null

function emit(event, payload) {
  const s = getSocket()
  if (s?.connected) s.emit(event, payload)
}

function bind() {
  const s = getSocket()
  if (!s || s === boundSocket) return
  boundSocket = s
  s.on('connect', () => {
    watched.forEach((_, id) => s.emit('lead:watch', id))
    if (current) s.emit('presence:activity', current)
  })
  s.on('lead:typing', (p) => listeners.forEach((fn) => fn('lead:typing', p)))
  s.on('lead:changed', (p) => listeners.forEach((fn) => fn('lead:changed', p)))
}

/** Called once the socket exists, so a reconnect re-sends what we're doing */
export const attachPresence = bind

/** kind: 'on_call' | 'viewing' | 'editing' | 'typing' */
export function reportActivity(kind, data = {}) {
  bind()
  // Viewing a lead never replaces an active call
  if (current?.kind === 'on_call' && kind !== 'on_call') return
  current = { kind, ...data, since: data.since ?? (current?.kind === kind && current?.leadId === data.leadId ? current.since : new Date().toISOString()) }
  emit('presence:activity', current)
}

export function clearActivity(kind) {
  if (kind && current?.kind !== kind) return
  current = null
  emit('presence:clear', { kind })
}

export function watchLead(leadId) {
  if (!leadId) return
  bind()
  const n = watched.get(leadId) ?? 0
  watched.set(leadId, n + 1)
  if (n === 0) emit('lead:watch', leadId)
}

export function unwatchLead(leadId) {
  const n = watched.get(leadId) ?? 0
  if (n <= 1) { watched.delete(leadId); emit('lead:unwatch', leadId) }
  else watched.set(leadId, n - 1)
}

export function sendTyping(leadId, leadName, isTyping) {
  emit('lead:typing', { leadId, leadName, isTyping })
}

export function onLeadEvent(fn) {
  bind()
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Open a lead: join its live room and show "viewing <lead>" on the admin's floor. */
export function useLeadPresence(lead) {
  const id = lead?._id
  const name = lead?.landlordName
  useEffect(() => {
    if (!id) return undefined
    watchLead(id)
    reportActivity('viewing', { leadId: id, leadName: name })
    return () => {
      unwatchLead(id)
      if (current?.leadId === id && current.kind !== 'on_call') clearActivity()
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
}
