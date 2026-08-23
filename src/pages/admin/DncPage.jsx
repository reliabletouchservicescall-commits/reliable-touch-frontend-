import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, formatDistanceToNow, startOfMonth, startOfWeek, isAfter } from 'date-fns'
import {
  PhoneOff, Search, X, Trash2, AlertTriangle, Loader2,
  Phone, ShieldAlert, ShieldCheck, Shield, User, Clock,
  Plus, SlidersHorizontal, ChevronLeft, ChevronRight,
  TriangleAlert, RotateCcw, FileText,
} from 'lucide-react'
import { dncApi } from '../../services/dncApi'

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function useDebounce(value, delay = 400) {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return d
}

function inputCls(hasError) {
  return [
    'w-full px-4 py-2.5 rounded-xl text-sm',
    'bg-[#F5F5F4] dark:bg-[#202020] border',
    hasError ? 'border-[#EF4444]' : 'border-transparent focus:border-[#F95C4B]',
    'focus:bg-white dark:focus:bg-[#181818]',
    'text-[#111111] dark:text-white',
    'placeholder:text-[#6B7280]/50 dark:placeholder:text-[#A1A1AA]/40',
    'outline-none ring-2 ring-transparent focus:ring-[#F95C4B]/20 transition-all',
  ].join(' ')
}

function resolveUser(obj) {
  if (!obj || typeof obj !== 'object') return null
  if (obj.firstName) return obj
  return null
}

const SORT_OPTIONS = [
  { value: '-blockedAt', label: 'Recently blocked' },
  { value: 'blockedAt',  label: 'Oldest first' },
  { value: 'phone',      label: 'Phone A-Z' },
]

/* ─── Stat Card ───────────────────────────────────────────────────────────── */

function StatCard({ label, value, icon: Icon, color, sub, isLoading }) {
  return (
    <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
          <Icon className="w-5 h-5" style={{ color }} strokeWidth={1.75} />
        </div>
      </div>
      {isLoading ? (
        <div className="h-8 w-14 rounded-lg bg-[#F5F5F4] dark:bg-[#202020] animate-pulse mb-1" />
      ) : (
        <p className="text-2xl font-bold text-[#111111] dark:text-white">{value}</p>
      )}
      <p className="text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-[#6B7280]/70 dark:text-[#A1A1AA]/70 mt-0.5">{sub}</p>}
    </div>
  )
}

/* ─── Phone Checker ───────────────────────────────────────────────────────── */

function PhoneChecker() {
  const [phone, setPhone]     = useState('')
  const [result, setResult]   = useState(null)
  const [checking, setChecking] = useState(false)
  const inputRef = useRef(null)

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

  function handleClear() {
    setPhone('')
    setResult(null)
    inputRef.current?.focus()
  }

  const isDnc   = result?.isDnc
  const entry   = result?.entry
  const blocker = entry ? resolveUser(entry.blockedBy) : null

  return (
    <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#F95C4B]/10 flex items-center justify-center">
          <Shield className="w-4 h-4 text-[#F95C4B]" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-sm font-bold text-[#111111] dark:text-white">Phone Number Checker</p>
          <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">Instantly check if a number is on the DNC list</p>
        </div>
      </div>

      <form onSubmit={handleCheck} className="flex gap-2">
        <div className="relative flex-1">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" strokeWidth={1.75} />
          <input
            ref={inputRef}
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setResult(null) }}
            placeholder="+27831234567"
            className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#F95C4B] focus:bg-white dark:focus:bg-[#181818] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 outline-none ring-2 ring-transparent focus:ring-[#F95C4B]/20 transition-all"
          />
          {phone && (
            <button type="button" onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111] dark:hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={!phone.trim() || checking}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
        >
          {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Check
        </button>
      </form>

      {/* Result */}
      {result && (
        <div className={[
          'mt-4 rounded-xl border p-4 transition-all',
          isDnc
            ? 'border-[#EF4444]/30 bg-[#EF4444]/5 dark:bg-[#EF4444]/8'
            : 'border-[#10B981]/30 bg-[#10B981]/5 dark:bg-[#10B981]/8',
        ].join(' ')}>
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isDnc ? 'bg-[#EF4444]/15' : 'bg-[#10B981]/15'}`}>
              {isDnc
                ? <ShieldAlert className="w-5 h-5 text-[#EF4444]" strokeWidth={1.75} />
                : <ShieldCheck className="w-5 h-5 text-[#10B981]" strokeWidth={1.75} />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${isDnc ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                {isDnc ? 'BLOCKED — Do Not Call' : 'CLEAR — Safe to Contact'}
              </p>
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] font-mono mt-0.5">{phone.trim()}</p>
              {isDnc && entry && (
                <div className="mt-2.5 space-y-1.5">
                  {entry.reason && (
                    <div className="flex items-start gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#EF4444]/70 mt-0.5 flex-shrink-0" strokeWidth={1.75} />
                      <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{entry.reason}</p>
                    </div>
                  )}
                  {blocker && (
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#EF4444]/70 flex-shrink-0" strokeWidth={1.75} />
                      <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
                        Blocked by {blocker.firstName} {blocker.lastName}
                      </p>
                    </div>
                  )}
                  {entry.blockedAt && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#EF4444]/70 flex-shrink-0" strokeWidth={1.75} />
                      <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
                        {format(new Date(entry.blockedAt), 'd MMM yyyy')} ({formatDistanceToNow(new Date(entry.blockedAt), { addSuffix: true })})
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Add DNC Drawer ──────────────────────────────────────────────────────── */

function AddDncDrawer({ onClose, onSaved }) {
  const [form, setForm]     = useState({ phone: '', reason: '' })
  const [errors, setErrors] = useState({})
  const qc = useQueryClient()

  const mut = useMutation({
    mutationFn: (data) => dncApi.add(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dnc'] })
      qc.invalidateQueries({ queryKey: ['dnc-stats'] })
      toast.success('Number added to Do Not Call list')
      onSaved()
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to add to DNC list'),
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
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[460px] flex flex-col bg-white dark:bg-[#181818] shadow-2xl border-l border-[#E5E7EB] dark:border-[#2A2A2A]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EF4444]/10 flex items-center justify-center">
              <PhoneOff className="w-5 h-5 text-[#EF4444]" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#111111] dark:text-white">Add to Do Not Call</h2>
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Block a phone number from being contacted</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning notice */}
        <div className="mx-6 mt-5 flex items-start gap-3 p-4 rounded-xl bg-[#EF4444]/6 border border-[#EF4444]/20">
          <TriangleAlert className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5" strokeWidth={1.75} />
          <p className="text-xs text-[#EF4444] leading-relaxed">
            Adding a number blocks all future contact attempts. Cold callers will be warned before calling this number. Only add numbers where the contact has explicitly opted out.
          </p>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form id="add-dnc-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-1.5">
                Phone Number <span className="text-[#EF4444]">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" strokeWidth={1.75} />
                <input
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="+27831234567"
                  className={`pl-9 ${inputCls(errors.phone)}`}
                />
              </div>
              {errors.phone && <p className="mt-1 text-xs text-[#EF4444]">{errors.phone}</p>}
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-1.5">
                Reason for Blocking
              </label>
              <textarea
                value={form.reason}
                onChange={(e) => set('reason', e.target.value)}
                placeholder="e.g. Contact requested removal during call on 14 Aug 2026"
                rows={4}
                className={`${inputCls(errors.reason)} resize-none`}
              />
              <div className="flex justify-between mt-1">
                {errors.reason
                  ? <p className="text-xs text-[#EF4444]">{errors.reason}</p>
                  : <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">Document why this number was blocked</p>
                }
                <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">{form.reason.length}/300</p>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E5E7EB] dark:border-[#2A2A2A] flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            Cancel
          </button>
          <button
            type="submit"
            form="add-dnc-form"
            disabled={mut.isPending}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            <PhoneOff className="w-4 h-4" />
            Block Number
          </button>
        </div>
      </div>
    </>
  )
}

/* ─── Remove Dialog ───────────────────────────────────────────────────────── */

function RemoveDialog({ entry, onClose, onRemoved }) {
  const qc  = useQueryClient()
  const mut = useMutation({
    mutationFn: () => dncApi.remove(entry._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dnc'] })
      qc.invalidateQueries({ queryKey: ['dnc-stats'] })
      toast.success('Number removed from Do Not Call list')
      onRemoved()
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to remove entry'),
  })

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl overflow-hidden">
          {/* Red top bar */}
          <div className="h-1.5 bg-[#F59E0B]" />
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-[#F59E0B]" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="font-bold text-[#111111] dark:text-white">Remove from DNC List</h3>
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">This will allow the number to be contacted again</p>
              </div>
            </div>

            {/* Entry info */}
            <div className="p-4 rounded-xl bg-[#F5F5F4] dark:bg-[#111111] border border-[#E5E7EB] dark:border-[#2A2A2A] mb-4 space-y-2">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" strokeWidth={1.75} />
                <span className="text-sm font-bold text-[#111111] dark:text-white font-mono">{entry.phone}</span>
              </div>
              {entry.reason && (
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] pl-6 leading-relaxed">{entry.reason}</p>
              )}
            </div>

            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#F59E0B]/8 border border-[#F59E0B]/20 mb-5">
              <TriangleAlert className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" strokeWidth={1.75} />
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] leading-relaxed">
                Removing this number means cold callers will be able to contact this person again. Only do this if the contact has explicitly agreed to be re-contacted.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
                Keep Blocked
              </button>
              <button
                onClick={() => mut.mutate()}
                disabled={mut.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Remove from DNC
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── DNC Table Row ───────────────────────────────────────────────────────── */

function DncRow({ entry, onRemove }) {
  const blocker = resolveUser(entry.blockedBy)
  const blockedDate = new Date(entry.blockedAt ?? entry.createdAt)

  return (
    <tr className="group hover:bg-[#FEF2F2] dark:hover:bg-[#EF4444]/5 transition-colors">
      {/* Phone */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#EF4444]/10 flex items-center justify-center flex-shrink-0">
            <PhoneOff className="w-4 h-4 text-[#EF4444]" strokeWidth={1.75} />
          </div>
          <span className="text-sm font-bold text-[#111111] dark:text-white font-mono tracking-wide">
            {entry.phone}
          </span>
        </div>
      </td>

      {/* Reason */}
      <td className="px-4 py-4 max-w-[260px]">
        {entry.reason ? (
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] line-clamp-2 leading-relaxed">
            {entry.reason}
          </p>
        ) : (
          <span className="text-xs text-[#6B7280]/50 dark:text-[#A1A1AA]/50 italic">No reason given</span>
        )}
      </td>

      {/* Blocked by */}
      <td className="px-4 py-4">
        {blocker ? (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#F95C4B]/15 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-[#F95C4B]">
                {blocker.firstName?.[0]}{blocker.lastName?.[0]}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#111111] dark:text-white">
                {blocker.firstName} {blocker.lastName}
              </p>
              <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">{blocker.email}</p>
            </div>
          </div>
        ) : (
          <span className="text-xs text-[#6B7280]/50 dark:text-[#A1A1AA]/50 italic">Unknown</span>
        )}
      </td>

      {/* Blocked date */}
      <td className="px-4 py-4">
        <div>
          <p className="text-sm text-[#111111] dark:text-white whitespace-nowrap">
            {format(blockedDate, 'd MMM yyyy')}
          </p>
          <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
            {formatDistanceToNow(blockedDate, { addSuffix: true })}
          </p>
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-4">
        <button
          title="Remove from DNC list"
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#F59E0B] bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 transition-all"
        >
          <RotateCcw className="w-3 h-3" strokeWidth={2} />
          Unblock
        </button>
      </td>
    </tr>
  )
}

/* ─── Empty State ─────────────────────────────────────────────────────────── */

function EmptyState({ hasFilters, onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#10B981]/10 flex items-center justify-center mb-4">
        <ShieldCheck className="w-8 h-8 text-[#10B981]" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">
        {hasFilters ? 'No results found' : 'DNC list is empty'}
      </h3>
      <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mb-6 max-w-xs leading-relaxed">
        {hasFilters
          ? 'No numbers match your search. Try a different term.'
          : 'No numbers have been blocked yet. Numbers added here will be protected from future contact attempts.'}
      </p>
      {!hasFilters && (
        <button onClick={onAdd} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626]">
          <PhoneOff className="w-4 h-4" /> Block a Number
        </button>
      )}
    </div>
  )
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */

export default function DncPage() {
  const [search,    setSearch]   = useState('')
  const [sort,      setSort]     = useState('-blockedAt')
  const [page,      setPage]     = useState(1)
  const [showAdd,   setShowAdd]  = useState(false)
  const [toRemove,  setToRemove] = useState(null)

  const debouncedSearch = useDebounce(search)
  useEffect(() => { setPage(1) }, [debouncedSearch, sort])

  /* Main list query */
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dnc', { page, search: debouncedSearch, sort }],
    queryFn: () =>
      dncApi.list({ page, limit: 20, search: debouncedSearch || undefined, sort })
        .then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })

  /* Unfiltered total for stat cards */
  const { data: statsData } = useQuery({
    queryKey: ['dnc-stats'],
    queryFn: async () => {
      const all = await dncApi.list({ limit: 100 }).then((r) => r.data.data)
      const entries = all.entries ?? []
      const monthStart = startOfMonth(new Date())
      const weekStart  = startOfWeek(new Date(), { weekStartsOn: 1 })
      return {
        total:     all.total,
        thisMonth: entries.filter((e) => isAfter(new Date(e.blockedAt ?? e.createdAt), monthStart)).length,
        thisWeek:  entries.filter((e) => isAfter(new Date(e.blockedAt ?? e.createdAt), weekStart)).length,
      }
    },
    staleTime: 30_000,
  })

  const entries    = data?.entries    ?? []
  const total      = data?.total      ?? 0
  const totalPages = data?.totalPages ?? 1
  const hasFilters = Boolean(search)

  function pageNums(cur, tot) {
    if (tot <= 7) return Array.from({ length: tot }, (_, i) => i + 1)
    const pages = [1]
    if (cur > 3) pages.push('...')
    for (let p = Math.max(2, cur - 1); p <= Math.min(tot - 1, cur + 1); p++) pages.push(p)
    if (cur < tot - 2) pages.push('...')
    pages.push(tot)
    return pages
  }

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="px-5 sm:px-8 pt-6 pb-5 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#111111] dark:text-white tracking-tight flex items-center gap-2.5">
              <PhoneOff className="w-5 h-5 text-[#EF4444]" strokeWidth={1.75} />
              Do Not Call List
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
              {isLoading ? 'Loading...' : `${total} blocked number${total !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all self-start"
          >
            <Plus className="w-4 h-4" />
            Block Number
          </button>
        </div>

        {/* Compliance banner */}
        <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-[#EF4444]/5 border border-[#EF4444]/15">
          <ShieldAlert className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5" strokeWidth={1.75} />
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] leading-relaxed">
            <span className="font-semibold text-[#EF4444]">Compliance notice:</span>{' '}
            Numbers on this list have explicitly requested no further contact. Cold callers are blocked from logging calls to these numbers. Only remove a number if the contact has directly consented to being re-contacted.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="px-5 sm:px-8 py-5 space-y-5">

          {/* ── Top row: Stats + Checker ─────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Stat cards */}
            <div className="grid grid-cols-3 lg:grid-cols-1 gap-3 lg:col-span-1">
              <StatCard
                label="Total Blocked"
                value={statsData?.total ?? '—'}
                icon={PhoneOff}
                color="#EF4444"
                isLoading={!statsData}
              />
              <StatCard
                label="Added This Month"
                value={statsData?.thisMonth ?? '—'}
                icon={AlertTriangle}
                color="#F59E0B"
                isLoading={!statsData}
              />
              <StatCard
                label="Added This Week"
                value={statsData?.thisWeek ?? '—'}
                icon={Clock}
                color="#8B5CF6"
                isLoading={!statsData}
              />
            </div>

            {/* Phone checker — takes up 2/3 */}
            <div className="lg:col-span-2">
              <PhoneChecker />
            </div>
          </div>

          {/* ── Toolbar ─────────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search phone number or reason..."
                className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 dark:placeholder:text-[#A1A1AA]/40 focus:border-[#EF4444] focus:ring-2 focus:ring-[#EF4444]/15 outline-none"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111] dark:hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] self-start">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#A1A1AA] flex-shrink-0" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="bg-transparent text-[#111111] dark:text-white text-sm outline-none cursor-pointer"
              >
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* ── Table ───────────────────────────────────────────────────── */}
          {isError && (
            <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444]">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Failed to load DNC list. Please try refreshing.
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 animate-spin text-[#EF4444]" />
            </div>
          ) : entries.length === 0 ? (
            <EmptyState hasFilters={hasFilters} onAdd={() => setShowAdd(true)} />
          ) : (
            <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-[#FEF2F2] dark:bg-[#EF4444]/5 border-b border-[#EF4444]/20">
                    <tr>
                      <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#EF4444]">Phone Number</th>
                      <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#EF4444]">Reason</th>
                      <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#EF4444]">Blocked By</th>
                      <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#EF4444]">Blocked Date</th>
                      <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#EF4444]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#FEF2F2] dark:divide-[#EF4444]/8">
                    {entries.map((entry) => (
                      <DncRow
                        key={entry._id}
                        entry={entry}
                        onRemove={() => setToRemove(entry)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
                  <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
                    Page {page} of {totalPages} &mdash; {total} blocked numbers
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="w-8 h-8 rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {pageNums(page, totalPages).map((p, i) =>
                      p === '...' ? (
                        <span key={`e${i}`} className="w-8 text-center text-xs text-[#6B7280]">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={[
                            'w-8 h-8 rounded-lg text-xs font-semibold transition-all',
                            p === page
                              ? 'bg-[#EF4444] text-white shadow-sm'
                              : 'border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]',
                          ].join(' ')}
                        >
                          {p}
                        </button>
                      )
                    )}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="w-8 h-8 rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Overlays ─────────────────────────────────────────────────────── */}
      {showAdd && (
        <AddDncDrawer onClose={() => setShowAdd(false)} onSaved={() => setShowAdd(false)} />
      )}
      {toRemove && (
        <RemoveDialog entry={toRemove} onClose={() => setToRemove(null)} onRemoved={() => setToRemove(null)} />
      )}
    </div>
  )
}
