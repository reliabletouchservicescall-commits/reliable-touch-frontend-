import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import {
  PhoneOff, Search, X, Loader2, AlertTriangle, Phone,
  ShieldAlert, ShieldCheck, User, Clock, FileText, Send, CheckCircle2, XCircle,
  Plus, Inbox, Check, Ban, TriangleAlert,
} from 'lucide-react'
import { dncApi } from '../../services/dncApi'
import { blockRequestsApi } from '../../services/blockRequestsApi'
import { contactsApi } from '../../services/contactsApi'
import { useAuthStore } from '../../store/authStore'
import SidePanel from '../../components/common/SidePanel'
import { Field, inputCls, getApiErrorMessage } from '../../components/leads/leadShared'

const REQUEST_STATUS_META = {
  pending:   { label: 'Pending Review', color: '#F59E0B', Icon: Clock },
  approved:  { label: 'Blocked',        color: '#EF4444', Icon: CheckCircle2 },
  dismissed: { label: 'Dismissed',      color: '#6B7280', Icon: XCircle },
}

function useDebounce(value, delay = 400) {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return d
}

function resolveUser(obj) {
  return obj && typeof obj === 'object' && obj.firstName ? obj : null
}

/* ─── Phone Checker ──────────────────────────────────────────────────────── */

function PhoneChecker() {
  const [phone, setPhone] = useState('')
  const [result, setResult] = useState(null)
  const [checking, setChecking] = useState(false)

  async function handleCheck(e) {
    e.preventDefault()
    const val = phone.trim()
    if (!val) return
    setChecking(true)
    setResult(null)
    try {
      const res = await dncApi.check(val)
      setResult(res.data.data)
    } catch {
      toast.error('Failed to check phone number')
    } finally {
      setChecking(false)
    }
  }

  const isDnc = result?.isDnc

  return (
    <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4">
      <p className="text-xs font-bold text-[#111111] dark:text-white mb-3">Quick check before you dial</p>
      <form onSubmit={handleCheck} className="flex gap-2">
        <div className="relative flex-1">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" />
          <input
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setResult(null) }}
            placeholder="+27831234567"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#EF4444] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={!phone.trim() || checking}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-50 flex items-center gap-2"
        >
          {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </button>
      </form>

      {result && (
        <div className={`flex items-center gap-2.5 mt-3 p-3 rounded-xl ${isDnc ? 'bg-[#EF4444]/8' : 'bg-[#10B981]/8'}`}>
          {isDnc ? <ShieldAlert className="w-4 h-4 text-[#EF4444] flex-shrink-0" /> : <ShieldCheck className="w-4 h-4 text-[#10B981] flex-shrink-0" />}
          <p className={`text-xs font-semibold ${isDnc ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
            {isDnc ? 'Blocked — do not call' : 'Clear — safe to contact'}
          </p>
        </div>
      )}
    </div>
  )
}

/* ─── Request Block Panel ────────────────────────────────────────────────── */
// A plain agent can't block a number directly — this submits a request with a reason,
// reviewed by their own company manager (or admin). A manager can use it too, for a
// number they personally want to flag.

function RequestBlockPanel({ onClose, onSaved }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const debouncedSearch = useDebounce(search)

  const { data: contactsData, isFetching } = useQuery({
    queryKey: ['agency-contacts-search', debouncedSearch],
    queryFn: () => contactsApi.list({ search: debouncedSearch, limit: 8 }).then((r) => r.data.data),
    enabled: debouncedSearch.length > 1 && !selected,
  })
  const results = (contactsData?.contacts ?? []).filter((c) => c.phone)

  const mut = useMutation({
    mutationFn: () => blockRequestsApi.create(selected._id, reason.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agency-my-block-requests'] })
      qc.invalidateQueries({ queryKey: ['agency-team-block-requests'] })
      toast.success('Block request submitted')
      onSaved()
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to send block request')),
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!selected) { setError('Select a contact first'); return }
    if (reason.trim().length < 3) { setError('Add a reason — at least 3 characters'); return }
    setError('')
    mut.mutate()
  }

  return (
    <SidePanel
      onClose={onClose}
      icon={PhoneOff}
      iconColor="#EF4444"
      title="Request a Block"
      subtitle="Your company manager (or admin) reviews it before it takes effect"
      widthClass="sm:max-w-sm"
      footer={
        <>
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            Cancel
          </button>
          <button
            type="submit"
            form="agency-request-block-form"
            disabled={mut.isPending}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Request
          </button>
        </>
      }
    >
      <div className="px-5 py-5 space-y-5">
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#EF4444]/6 border border-[#EF4444]/20">
          <ShieldAlert className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5" strokeWidth={1.75} />
          <p className="text-xs text-[#EF4444] leading-relaxed">
            Only request a block when the contact has explicitly asked not to be called
            again. It will be reviewed before the number is actually blocked.
          </p>
        </div>

        <form id="agency-request-block-form" onSubmit={handleSubmit} className="space-y-5">
          <Field label="Contact" required>
            {selected ? (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#F5F5F4] dark:bg-[#202020]">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">{selected.name}</p>
                  <p className="text-xs font-mono text-[#6B7280] dark:text-[#A1A1AA]">{selected.phone}</p>
                </div>
                <button type="button" onClick={() => { setSelected(null); setSearch('') }} className="text-[#6B7280] hover:text-[#111111] dark:hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search contacts by name or phone…"
                  className={inputCls(false)}
                />
                {search.length > 1 && (
                  <div className="mt-1.5 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] max-h-48 overflow-y-auto divide-y divide-[#F5F5F4] dark:divide-[#202020]">
                    {isFetching ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-[#6B7280]" />
                      </div>
                    ) : results.length === 0 ? (
                      <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] text-center py-4">No matching contacts</p>
                    ) : (
                      results.map((c) => (
                        <button
                          key={c._id}
                          type="button"
                          onClick={() => { setSelected(c); setError('') }}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-[#F5F5F4] dark:hover:bg-[#202020]"
                        >
                          <span className="text-sm text-[#111111] dark:text-white truncate">{c.name}</span>
                          <span className="text-xs font-mono text-[#6B7280] dark:text-[#A1A1AA] flex-shrink-0">{c.phone}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </Field>

          <Field label="Reason" required error={error} hint={`${reason.length}/500`}>
            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); if (error) setError('') }}
              placeholder="e.g. Asked to be removed during the call"
              rows={4}
              className={`${inputCls(Boolean(error))} resize-none`}
            />
          </Field>
        </form>
      </div>
    </SidePanel>
  )
}

/* ─── Add DNC Drawer (manager only — direct block) ───────────────────────── */

function AddDncDrawer({ onClose, onSaved }) {
  const [form, setForm] = useState({ phone: '', reason: '' })
  const [errors, setErrors] = useState({})
  const qc = useQueryClient()

  const mut = useMutation({
    mutationFn: (data) => dncApi.add(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agency-dnc'] })
      toast.success('Number added to Do Not Call list')
      onSaved()
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to add to DNC list')),
  })

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }))
  }

  function validate() {
    const errs = {}
    if (!form.phone.trim()) errs.phone = 'Phone number is required'
    if (form.reason.length > 300) errs.reason = 'Reason must be under 300 characters'
    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    mut.mutate({ phone: form.phone.trim(), reason: form.reason.trim() || null })
  }

  return (
    <SidePanel
      onClose={onClose}
      icon={PhoneOff}
      iconColor="#EF4444"
      title="Add to Do Not Call"
      subtitle="Block a phone number from being contacted"
      widthClass="sm:max-w-sm"
      footer={
        <>
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            Cancel
          </button>
          <button
            type="submit"
            form="agency-add-dnc-form"
            disabled={mut.isPending}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            <PhoneOff className="w-4 h-4" /> Block Number
          </button>
        </>
      }
    >
      <div className="px-5 py-5 space-y-5">
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#EF4444]/6 border border-[#EF4444]/20">
          <TriangleAlert className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5" strokeWidth={1.75} />
          <p className="text-xs text-[#EF4444] leading-relaxed">
            Adding a number blocks all future contact attempts system-wide. Only add numbers where the contact has explicitly opted out.
          </p>
        </div>

        <form id="agency-add-dnc-form" onSubmit={handleSubmit} className="space-y-5">
          <Field label="Phone Number" required error={errors.phone}>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" strokeWidth={1.75} />
              <input
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+27831234567"
                className={`pl-9 ${inputCls(Boolean(errors.phone))}`}
              />
            </div>
          </Field>

          <Field label="Reason for Blocking" error={errors.reason} hint={`${form.reason.length}/300`}>
            <textarea
              value={form.reason}
              onChange={(e) => set('reason', e.target.value)}
              placeholder="e.g. Contact requested removal during call"
              rows={4}
              className={`${inputCls(Boolean(errors.reason))} resize-none`}
            />
          </Field>
        </form>
      </div>
    </SidePanel>
  )
}

/* ─── Pending Team Block Requests (manager only) ─────────────────────────── */

function BlockRequestCard({ request, onResolve, isPending }) {
  const [note, setNote] = useState('')
  const caller = resolveUser(request.requestedBy)
  const contact = request.contactId && typeof request.contactId === 'object' ? request.contactId : null

  return (
    <div className="p-4 rounded-xl bg-[#FFFBEB] dark:bg-[#F59E0B]/8 border border-[#F59E0B]/25">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#111111] dark:text-white truncate">{contact?.name ?? 'Unknown contact'}</p>
          <p className="text-xs font-mono text-[#6B7280] dark:text-[#A1A1AA]">{request.phone}</p>
        </div>
        {caller && (
          <span className="flex items-center gap-1 text-[10px] text-[#6B7280] dark:text-[#A1A1AA] flex-shrink-0">
            <User className="w-3 h-3" /> {caller.firstName} {caller.lastName}
          </span>
        )}
      </div>

      <div className="flex items-start gap-1.5 mb-3">
        <FileText className="w-3.5 h-3.5 text-[#F59E0B] mt-0.5 flex-shrink-0" />
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] leading-relaxed">"{request.reason}"</p>
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note back to your agent…"
        className="w-full mb-3 px-3 py-2 rounded-lg text-xs bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 outline-none focus:border-[#F59E0B]"
      />

      <div className="flex gap-2">
        <button
          onClick={() => onResolve(request._id, 'dismiss', note)}
          disabled={isPending}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] disabled:opacity-50"
        >
          <Ban className="w-3.5 h-3.5" /> Dismiss
        </button>
        <button
          onClick={() => onResolve(request._id, 'approve', note)}
          disabled={isPending}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-60"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Approve & Block
        </button>
      </div>
    </div>
  )
}

function PendingTeamBlockRequests() {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['agency-team-block-requests', 'pending'],
    queryFn: () => blockRequestsApi.list({ status: 'pending', limit: 20 }),
    staleTime: 15_000,
  })
  const requests = data?.requests ?? []

  const mut = useMutation({
    mutationFn: ({ id, action, adminNote }) => blockRequestsApi.resolve(id, { action, adminNote: adminNote || undefined }),
    onSuccess: (_res, { action }) => {
      qc.invalidateQueries({ queryKey: ['agency-team-block-requests'] })
      qc.invalidateQueries({ queryKey: ['agency-my-block-requests'] })
      qc.invalidateQueries({ queryKey: ['agency-dnc'] })
      toast.success(action === 'approve' ? 'Number blocked' : 'Request dismissed')
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to resolve request')),
  })

  if (requests.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Inbox className="w-4 h-4 text-[#F59E0B]" strokeWidth={1.75} />
        <p className="text-sm font-bold text-[#111111] dark:text-white">Pending Team Requests</p>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B]">{requests.length}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {requests.map((r) => (
          <BlockRequestCard
            key={r._id}
            request={r}
            onResolve={(id, action, adminNote) => mut.mutate({ id, action, adminNote })}
            isPending={mut.isPending && mut.variables?.id === r._id}
          />
        ))}
      </div>
    </div>
  )
}

/* ─── My Block Requests ──────────────────────────────────────────────────── */

function MyBlockRequests() {
  const { data, isLoading } = useQuery({
    queryKey: ['agency-my-block-requests'],
    queryFn: () => blockRequestsApi.myRequests({ limit: 20 }),
    staleTime: 15_000,
  })
  const requests = data?.requests ?? []
  if (isLoading || requests.length === 0) return null

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-2.5">
        My Block Requests
      </p>
      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] divide-y divide-[#F5F5F4] dark:divide-[#202020] overflow-hidden">
        {requests.map((r) => {
          const meta = REQUEST_STATUS_META[r.status]
          const contact = r.contactId && typeof r.contactId === 'object' ? r.contactId : null
          return (
            <div key={r._id} className="flex items-start gap-3 px-4 py-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5" style={{ backgroundColor: `${meta.color}15` }}>
                <meta.Icon className="w-4 h-4" style={{ color: meta.color }} strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">{contact?.name ?? r.phone}</p>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ color: meta.color, backgroundColor: `${meta.color}15` }}>
                    {meta.label}
                  </span>
                </div>
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">"{r.reason}"</p>
                {r.adminNote && (
                  <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] mt-1 italic">Note: "{r.adminNote}"</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── DNC Card (read-only — removal stays admin-only) ────────────────────── */

function DncCard({ entry }) {
  const blocker = resolveUser(entry.blockedBy)
  const blockedDate = new Date(entry.blockedAt ?? entry.createdAt)

  return (
    <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#EF4444]/10 flex items-center justify-center">
          <PhoneOff className="w-4 h-4 text-[#EF4444]" strokeWidth={1.75} />
        </div>
        <p className="text-sm font-bold text-[#111111] dark:text-white font-mono truncate">{entry.phone}</p>
      </div>

      {entry.reason && (
        <div className="flex items-start gap-1.5 mt-3">
          <FileText className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#A1A1AA] mt-0.5 flex-shrink-0" />
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] leading-relaxed">{entry.reason}</p>
        </div>
      )}

      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-3 pt-3 border-t border-[#F5F5F4] dark:border-[#202020]">
        {blocker && (
          <span className="flex items-center gap-1 text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
            <User className="w-3 h-3 flex-shrink-0" />
            {blocker.firstName} {blocker.lastName}
          </span>
        )}
        <span className="flex items-center gap-1 text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
          <Clock className="w-3 h-3 flex-shrink-0" />
          {format(blockedDate, 'd MMM yyyy')} ({formatDistanceToNow(blockedDate, { addSuffix: true })})
        </span>
      </div>
    </div>
  )
}

/* ─── Empty state ────────────────────────────────────────────────────────── */

function EmptyState({ hasFilters, onRequest }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-[#10B981]/10 flex items-center justify-center mb-4">
        <ShieldCheck className="w-8 h-8 text-[#10B981]" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">
        {hasFilters ? 'No results found' : 'DNC list is empty'}
      </h3>
      <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mb-6 max-w-xs">
        {hasFilters ? 'Try a different search term.' : 'Numbers blocked here are removed from every caller\'s contact list, system-wide.'}
      </p>
      {!hasFilters && (
        <button onClick={onRequest} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626]">
          <Send className="w-4 h-4" /> Request a Block
        </button>
      )}
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export default function DncPage() {
  const { user } = useAuthStore()
  const isManager = Boolean(user?.isAgencyManager)

  const [search, setSearch] = useState('')
  const [showRequest, setShowRequest] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const debouncedSearch = useDebounce(search)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['agency-dnc', { search: debouncedSearch }],
    queryFn: () => dncApi.list({ search: debouncedSearch || undefined, limit: 100 }).then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })

  const entries = data?.entries ?? []
  const total = data?.total ?? 0
  const hasFilters = Boolean(search)

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-5 sm:px-8 pt-6 pb-0 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-[#111111] dark:text-white tracking-tight flex items-center gap-2.5">
              <PhoneOff className="w-5 h-5 text-[#EF4444]" strokeWidth={1.75} />
              Do Not Call List
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
              {isLoading ? 'Loading…' : `${total} blocked number${total !== 1 ? 's' : ''} · shared across the whole system`}
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {isManager && (
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#EF4444] border border-[#EF4444]/30 hover:bg-[#EF4444]/5 transition-all"
              >
                <Plus className="w-4 h-4" /> Block Number
              </button>
            )}
            <button
              onClick={() => setShowRequest(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
            >
              <Send className="w-4 h-4" /> Request a Block
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-5 bg-[#FAFAF9] dark:bg-[#0B0B0B] space-y-5">
        {isManager && <PendingTeamBlockRequests />}
        <PhoneChecker />
        <MyBlockRequests />

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search phone or reason…"
            className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 focus:border-[#EF4444] focus:ring-2 focus:ring-[#EF4444]/15 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111] dark:hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {isError && (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444]">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Failed to load DNC list.
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState hasFilters={hasFilters} onRequest={() => setShowRequest(true)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {entries.map((entry) => <DncCard key={entry._id} entry={entry} />)}
          </div>
        )}
      </div>

      {showRequest && (
        <RequestBlockPanel onClose={() => setShowRequest(false)} onSaved={() => setShowRequest(false)} />
      )}
      {showAdd && (
        <AddDncDrawer onClose={() => setShowAdd(false)} onSaved={() => setShowAdd(false)} />
      )}
    </div>
  )
}
