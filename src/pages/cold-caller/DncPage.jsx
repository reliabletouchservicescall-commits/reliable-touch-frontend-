import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import {
  PhoneOff, Search, X, Plus, Loader2, AlertTriangle, Phone,
  ShieldAlert, ShieldCheck, User, Clock, FileText,
} from 'lucide-react'
import { dncApi } from '../../services/dncApi'
import SidePanel from '../../components/common/SidePanel'
import { Field, inputCls } from '../../components/leads/leadShared'

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

/* ─── Add DNC Panel ──────────────────────────────────────────────────────── */

function AddDncPanel({ onClose, onSaved }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ phone: '', reason: '' })
  const [errors, setErrors] = useState({})

  const mut = useMutation({
    mutationFn: (data) => dncApi.add(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dnc'] })
      qc.invalidateQueries({ queryKey: ['my-contacts'] })
      toast.success('Number added to Do Not Call list')
      onSaved()
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to add to DNC list'),
  })

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = {}
    if (!form.phone.trim()) errs.phone = 'Phone number is required'
    if (form.reason.length > 300) errs.reason = 'Reason must be under 300 characters'
    if (Object.keys(errs).length) { setErrors(errs); return }
    mut.mutate({ phone: form.phone.trim(), reason: form.reason.trim() || null })
  }

  return (
    <SidePanel
      onClose={onClose}
      icon={PhoneOff}
      iconColor="#EF4444"
      title="Block a Number"
      subtitle="Add to the Do Not Call list"
      widthClass="sm:max-w-sm"
      footer={
        <>
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            Cancel
          </button>
          <button
            type="submit"
            form="add-dnc-form"
            disabled={mut.isPending}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Block Number
          </button>
        </>
      }
    >
      <div className="px-5 py-5 space-y-5">
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#EF4444]/6 border border-[#EF4444]/20">
          <ShieldAlert className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5" strokeWidth={1.75} />
          <p className="text-xs text-[#EF4444] leading-relaxed">
            Only add numbers where the contact has explicitly asked not to be called again.
            This immediately removes any matching contact from every cold caller's list.
          </p>
        </div>

        <form id="add-dnc-form" onSubmit={handleSubmit} className="space-y-5">
          <Field label="Phone Number" required error={errors.phone}>
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+27831234567" className={inputCls(errors.phone)} />
          </Field>
          <Field label="Reason" error={errors.reason} hint={`${form.reason.length}/300`}>
            <textarea
              value={form.reason}
              onChange={(e) => set('reason', e.target.value)}
              placeholder="e.g. Asked to be removed during the call"
              rows={4}
              className={`${inputCls(errors.reason)} resize-none`}
            />
          </Field>
        </form>
      </div>
    </SidePanel>
  )
}

/* ─── DNC Card ───────────────────────────────────────────────────────────── */

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

function EmptyState({ hasFilters, onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-[#10B981]/10 flex items-center justify-center mb-4">
        <ShieldCheck className="w-8 h-8 text-[#10B981]" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">
        {hasFilters ? 'No results found' : 'DNC list is empty'}
      </h3>
      <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mb-6 max-w-xs">
        {hasFilters ? 'Try a different search term.' : 'Numbers blocked here are removed from every cold caller\'s contact list.'}
      </p>
      {!hasFilters && (
        <button onClick={onAdd} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626]">
          <PhoneOff className="w-4 h-4" /> Block a Number
        </button>
      )}
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export default function ColdCallerDncPage() {
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const debouncedSearch = useDebounce(search)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dnc', { search: debouncedSearch }],
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
              {isLoading ? 'Loading…' : `${total} blocked number${total !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] shadow-sm hover:shadow-md active:scale-[0.98] transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Block Number
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-5 bg-[#FAFAF9] dark:bg-[#0B0B0B] space-y-5">
        <PhoneChecker />

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
          <EmptyState hasFilters={hasFilters} onAdd={() => setShowAdd(true)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {entries.map((entry) => <DncCard key={entry._id} entry={entry} />)}
          </div>
        )}
      </div>

      {showAdd && (
        <AddDncPanel onClose={() => setShowAdd(false)} onSaved={() => setShowAdd(false)} />
      )}
    </div>
  )
}
