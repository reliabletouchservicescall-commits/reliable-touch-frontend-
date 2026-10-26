import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { callLogsApi } from '../services/callLogsApi'
import { useAuthStore } from '../store/authStore'
import { reportActivity, clearActivity } from './livePresence'

/**
 * "Call → record the outcome" flow that holds up on every phone.
 *
 * Why it's built this way:
 *  - iPhone (Safari, and especially the app added to the home screen) only reliably opens
 *    the dialer from a real tap on a real `tel:` link. Starting it from code
 *    (window.location.href = 'tel:…' after preventDefault) is often silently ignored. So
 *    the Call buttons stay plain <a href={telHref(...)}> links and call `startCall` from
 *    onClick WITHOUT preventing the default.
 *  - Android (Samsung in particular) freezes or even discards the browser tab while the
 *    phone app is in front. Anything that waits on a network reply before opening the
 *    outcome sheet can stall, fail, or be wiped by a reload. So the sheet opens
 *    immediately on tap, and the pending call is saved to localStorage — if the tab is
 *    reloaded or restored, the sheet comes straight back.
 *  - The placeholder call log ('no_answer') is still created at tap time, but nothing
 *    depends on it arriving. When the outcome is saved we use its id if we have it,
 *    otherwise look it up on the server by its exact calledAt (so a reply lost in the
 *    background never causes a duplicate), and only create a log if none exists.
 */

const STORAGE_KEY = 'rt:pending-call'
const MAX_AGE_MS = 6 * 60 * 60 * 1000 // a call left unrecorded for 6h is stale — drop it

/** `tel:` URL with everything but digits and a leading + stripped ("082 123-4567" → tel:0821234567). */
export function telHref(phone) {
  const raw = String(phone ?? '').trim()
  const digits = raw.replace(/[^\d+]/g, '')
  return `tel:${digits.startsWith('+') ? `+${digits.slice(1).replace(/\+/g, '')}` : digits.replace(/\+/g, '')}`
}

function readStored(userId) {
  try {
    const call = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (!call || call.userId !== userId) return null
    if (Date.now() - new Date(call.startedAt).getTime() > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return call
  } catch {
    return null
  }
}

function writeStored(call) {
  try {
    if (call) localStorage.setItem(STORAGE_KEY, JSON.stringify(call))
    else localStorage.removeItem(STORAGE_KEY)
  } catch { /* private mode / storage full — the in-memory state still works */ }
}

// Just what the outcome sheet and lead drawer need — keeps storage small and serialisable.
function snapshot(contact) {
  const { _id, name, phone, altPhone, address, area, sectionalScheme, unitNumber, idNumber, preferredPhone, status } = contact
  return { _id, name, phone, altPhone, address, area, sectionalScheme, unitNumber, idNumber, preferredPhone, status }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * @param {string[][]} invalidateKeys  React Query keys to refresh once a call is logged/updated.
 * @returns {{
 *   activeCall: null | { contact, startedAt, logId },
 *   startCall: (contact, dialedPhone?, { leadId }?) => void,
 *   saveOutcome: ({ outcome, notes }) => Promise<string>,  // resolves to the call log id
 *   skip: () => void,
 *   finish: () => void,
 * }}
 */
export function useCallFlow(invalidateKeys = []) {
  const qc = useQueryClient()
  const userId = useAuthStore((s) => s.user?._id)
  const [activeCall, setActiveCall] = useState(() => readStored(userId))
  const createRef = useRef(null) // in-flight placeholder create: { startedAt, promise }
  const keysRef = useRef(invalidateKeys)
  keysRef.current = invalidateKeys

  // Admin's live floor shows "On call 4:12" from the tap on Call until the outcome is saved
  useEffect(() => {
    if (activeCall) {
      reportActivity('on_call', { since: activeCall.startedAt, leadId: activeCall.leadId ?? null, contactName: activeCall.contact?.name ?? null })
    } else {
      clearActivity('on_call')
    }
  }, [activeCall?.startedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    keysRef.current.forEach((queryKey) => qc.invalidateQueries({ queryKey }))
  }, [qc])

  // Coming back from the phone app: the tab may have been restored from the back/forward
  // cache, or the user may have switched accounts — re-sync the sheet with storage.
  useEffect(() => {
    const sync = () => {
      if (document.visibilityState !== 'visible') return
      const stored = readStored(userId)
      setActiveCall((cur) => (cur && stored && cur.startedAt === stored.startedAt ? cur : stored))
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('pageshow', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('pageshow', sync)
    }
  }, [userId])

  const rememberLogId = useCallback((startedAt, logId) => {
    setActiveCall((cur) => {
      if (!cur || cur.startedAt !== startedAt) return cur
      const next = { ...cur, logId }
      writeStored(next)
      return next
    })
  }, [])

  // Placeholder log, retried a few times — the first attempt often runs while the tab is
  // being backgrounded. Resolves to the log id, or null if it never got through.
  const createPlaceholder = useCallback((call) => {
    const run = async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await callLogsApi.create({ contactId: call.contact._id, outcome: 'no_answer', calledAt: call.startedAt, leadId: call.leadId ?? undefined })
          const id = res.data?.data?.callLog?._id ?? null
          if (id) { rememberLogId(call.startedAt, id); refresh() }
          return id
        } catch (err) {
          if (err.response && err.response.status < 500) return null // rejected (e.g. 403) — retrying won't help
          await wait(1500 * (attempt + 1))
        }
      }
      return null
    }
    const promise = run()
    createRef.current = { startedAt: call.startedAt, promise }
    return promise
  }, [rememberLogId, refresh])

  // `leadId` (optional) — the call is about this lead, so it's logged against it
  const startCall = useCallback((contact, dialedPhone, { leadId = null } = {}) => {
    const call = {
      userId,
      startedAt: new Date().toISOString(),
      logId: null,
      leadId,
      contact: { ...snapshot(contact), dialedPhone: dialedPhone ?? contact.phone },
    }
    writeStored(call)       // survives the tab being discarded while the dialer is open
    setActiveCall(call)     // sheet is already up when the caller comes back
    createPlaceholder(call) // fire-and-forget; nothing waits on it
  }, [userId, createPlaceholder])

  // Find this call's log id: known already → in-flight create → server lookup by the exact
  // calledAt we sent (covers a create that succeeded but whose reply was lost).
  const resolveLogId = useCallback(async (call) => {
    if (call.logId) return call.logId
    if (createRef.current?.startedAt === call.startedAt) {
      const id = await Promise.race([createRef.current.promise, wait(8000).then(() => null)])
      if (id) return id
    }
    try {
      const res = await callLogsApi.listByContact(call.contact._id)
      const target = new Date(call.startedAt).getTime()
      const match = (res.data?.data?.callLogs ?? []).find((l) =>
        new Date(l.calledAt).getTime() === target && (l.calledBy?._id ?? l.calledBy) === userId)
      return match?._id ?? null
    } catch {
      return null
    }
  }, [userId])

  const saveOutcome = useCallback(async ({ outcome, notes }) => {
    const call = activeCall
    if (!call) throw new Error('No call in progress')
    const logId = await resolveLogId(call)
    let id = logId
    if (logId) {
      await callLogsApi.update(logId, { outcome, notes: notes || undefined })
    } else {
      const res = await callLogsApi.create({ contactId: call.contact._id, outcome, notes: notes || undefined, calledAt: call.startedAt, leadId: call.leadId ?? undefined })
      id = res.data?.data?.callLog?._id ?? null
    }
    refresh()
    return id
  }, [activeCall, resolveLogId, refresh])

  const finish = useCallback(() => {
    writeStored(null)
    setActiveCall(null)
  }, [])

  // "Skip for now" — close at once, but make sure the dialled call is still counted
  // (as the default no-answer) in case the placeholder never reached the server.
  const skip = useCallback(() => {
    const call = activeCall
    finish()
    if (!call) return
    resolveLogId(call).then((id) => {
      if (id) return
      return callLogsApi.create({ contactId: call.contact._id, outcome: 'no_answer', calledAt: call.startedAt, leadId: call.leadId ?? undefined }).then(refresh)
    }).catch(() => {})
  }, [activeCall, finish, resolveLogId, refresh])

  return { activeCall, startCall, saveOutcome, skip, finish }
}
