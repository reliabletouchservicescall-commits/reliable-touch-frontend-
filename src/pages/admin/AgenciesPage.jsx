import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Building2, Plus, Search, X, Pencil, Trash2, Loader2,
  Phone, Mail, CheckCircle2, XCircle, ChevronLeft, ChevronRight,
  DollarSign, Users, AlertTriangle, ToggleLeft, ToggleRight,
  TrendingUp, ShieldCheck,
} from 'lucide-react'
import { agenciesApi } from '../../services/agenciesApi'
import { commissionsApi } from '../../services/commissionsApi'
import { usersApi } from '../../services/usersApi'

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function fmtCurrency(n) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n ?? 0)
}

const AVATAR_COLORS = [
  '#F95C4B', '#3B82F6', '#10B981', '#8B5CF6',
  '#F59E0B', '#EC4899', '#06B6D4', '#84CC16',
]

function agencyColor(id = '') {
  const sum = [...id].reduce((s, c) => s + c.charCodeAt(0), 0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

function inputCls(hasErr) {
  return [
    'w-full px-4 py-2.5 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border transition-all outline-none',
    'text-[#111111] dark:text-white placeholder:text-[#6B7280]/50',
    'ring-2 ring-transparent focus:ring-[#F95C4B]/20 focus:bg-white dark:focus:bg-[#181818]',
    hasErr ? 'border-[#EF4444]' : 'border-transparent focus:border-[#F95C4B]',
  ].join(' ')
}

/* ─── Field wrapper ───────────────────────────────────────────────────────── */

function Field({ label, required, error, hint, children }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-1.5">
        {label}{required && <span className="text-[#F95C4B] ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[10px] text-[#6B7280]/70 dark:text-[#A1A1AA]/60">{hint}</p>}
      {error && <p className="mt-1 text-xs text-[#EF4444]">{error}</p>}
    </div>
  )
}

/* ─── Stat Card ───────────────────────────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, color, loading }) {
  return (
    <div className="bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + '18' }}>
        <Icon className="w-5 h-5" style={{ color }} strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        {loading
          ? <div className="h-6 w-10 rounded bg-[#F5F5F4] dark:bg-[#202020] animate-pulse mb-1" />
          : <p className="text-xl font-bold text-[#111111] dark:text-white">{value}</p>
        }
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] font-medium">{label}</p>
      </div>
    </div>
  )
}

/* ─── Agency Card ─────────────────────────────────────────────────────────── */

function AgencyCard({ agency, agentCount, commStats, onEdit, onDelete, onToggle, toggling }) {
  const color  = agencyColor(agency._id)
  const active = agency.isActive

  return (
    <div className={`bg-white dark:bg-[#181818] border rounded-2xl overflow-hidden transition-shadow hover:shadow-md ${
      active ? 'border-[#E5E7EB] dark:border-[#2A2A2A]' : 'border-[#E5E7EB]/60 dark:border-[#2A2A2A]/60 opacity-75'
    }`}>
      {/* Top accent bar */}
      <div className="h-1.5 w-full" style={{ backgroundColor: color }} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-bold shadow-sm"
            style={{ backgroundColor: color }}
          >
            {initials(agency.name)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-[#111111] dark:text-white leading-tight truncate">
                {agency.name}
              </p>
              <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                active
                  ? 'bg-[#10B981]/10 text-[#10B981]'
                  : 'bg-[#6B7280]/10 text-[#6B7280] dark:text-[#A1A1AA]'
              }`}>
                {active ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                {active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
              Since {format(new Date(agency.createdAt), 'MMM yyyy')}
            </p>
          </div>
        </div>

        {/* Contact info */}
        <div className="space-y-2 mb-4">
          {agency.contactEmail ? (
            <a
              href={`mailto:${agency.contactEmail}`}
              className="flex items-center gap-2 text-xs text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#F95C4B] transition-colors truncate group"
            >
              <Mail className="w-3.5 h-3.5 shrink-0 group-hover:text-[#F95C4B]" strokeWidth={1.75} />
              <span className="truncate">{agency.contactEmail}</span>
            </a>
          ) : (
            <p className="flex items-center gap-2 text-xs text-[#6B7280]/40 dark:text-[#A1A1AA]/40 italic">
              <Mail className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
              No email on file
            </p>
          )}

          {agency.contactPhone ? (
            <a
              href={`tel:${agency.contactPhone}`}
              className="flex items-center gap-2 text-xs text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#F95C4B] transition-colors group"
            >
              <Phone className="w-3.5 h-3.5 shrink-0 group-hover:text-[#F95C4B]" strokeWidth={1.75} />
              {agency.contactPhone}
            </a>
          ) : (
            <p className="flex items-center gap-2 text-xs text-[#6B7280]/40 dark:text-[#A1A1AA]/40 italic">
              <Phone className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
              No phone on file
            </p>
          )}
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-2 mb-4 py-3 border-t border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="text-center">
            <p className="text-base font-bold text-[#111111] dark:text-white">{agentCount ?? 0}</p>
            <p className="text-[9px] uppercase tracking-wide font-semibold text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">Agents</p>
          </div>
          <div className="text-center border-l border-r border-[#E5E7EB] dark:border-[#2A2A2A]">
            <p className="text-base font-bold text-[#111111] dark:text-white">{commStats?.total ?? 0}</p>
            <p className="text-[9px] uppercase tracking-wide font-semibold text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">Deals</p>
          </div>
          <div className="text-center">
            <p className={`text-base font-bold ${commStats?.pending > 0 ? 'text-[#F59E0B]' : 'text-[#111111] dark:text-white'}`}>
              {commStats?.pending ?? 0}
            </p>
            <p className="text-[9px] uppercase tracking-wide font-semibold text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">Pending</p>
          </div>
        </div>

        {/* Commission totals */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[9px] uppercase tracking-wide font-semibold text-[#6B7280] dark:text-[#A1A1AA]">Total Earned</p>
            <p className="text-sm font-bold text-[#10B981] mt-0.5">{fmtCurrency(commStats?.paidAmount)}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wide font-semibold text-[#6B7280] dark:text-[#A1A1AA]">Outstanding</p>
            <p className={`text-sm font-bold mt-0.5 ${commStats?.outstandingAmount > 0 ? 'text-[#F59E0B]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>
              {fmtCurrency(commStats?.outstandingAmount)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
          <button
            onClick={() => onEdit(agency)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] bg-[#F5F5F4] dark:bg-[#202020] hover:bg-[#EBEBEB] dark:hover:bg-[#2A2A2A] transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
            Edit
          </button>

          <button
            onClick={() => onToggle(agency)}
            disabled={toggling === agency._id}
            title={active ? 'Deactivate' : 'Activate'}
            className={`flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${
              active
                ? 'text-[#10B981] bg-[#10B981]/10 hover:bg-[#10B981]/20'
                : 'text-[#6B7280] bg-[#F5F5F4] dark:bg-[#202020] hover:bg-[#EBEBEB] dark:hover:bg-[#2A2A2A]'
            }`}
          >
            {toggling === agency._id
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : active ? <ToggleRight className="w-4 h-4" strokeWidth={2} /> : <ToggleLeft className="w-4 h-4" strokeWidth={2} />
            }
          </button>

          <button
            onClick={() => onDelete(agency)}
            title="Delete agency"
            className="flex items-center justify-center w-9 h-9 rounded-xl text-[#EF4444] bg-[#EF4444]/10 hover:bg-[#EF4444]/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Agency Form ─────────────────────────────────────────────────────────── */

const EMPTY_FORM = { name: '', contactEmail: '', contactPhone: '', isActive: true }

function AgencyForm({ id, initial, onSubmit, isPending }) {
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState({})

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }))
  }

  function validate() {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Agency name is required'
    else if (form.name.trim().length < 2) errs.name = 'Name must be at least 2 characters'
    if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail))
      errs.contactEmail = 'Enter a valid email address'
    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSubmit({
      name: form.name.trim(),
      contactEmail: form.contactEmail.trim() || null,
      contactPhone: form.contactPhone.trim() || null,
      isActive: form.isActive,
    })
  }

  return (
    <form id={id} onSubmit={handleSubmit} className="space-y-5">
      <Field label="Agency Name" required error={errors.name}>
        <input
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Prime Realty Group"
          className={inputCls(errors.name)}
        />
      </Field>

      <Field label="Contact Email" error={errors.contactEmail} hint="Used for commission invoicing">
        <input
          type="email"
          value={form.contactEmail}
          onChange={(e) => set('contactEmail', e.target.value)}
          placeholder="ops@agencyname.co.zw"
          className={inputCls(errors.contactEmail)}
        />
      </Field>

      <Field label="Contact Phone" hint="Include country code, e.g. +263771…">
        <input
          value={form.contactPhone}
          onChange={(e) => set('contactPhone', e.target.value)}
          placeholder="+263771000000"
          className={inputCls(false)}
        />
      </Field>

      <Field label="Status">
        <div className="flex gap-2">
          {[true, false].map((val) => (
            <button
              key={String(val)}
              type="button"
              onClick={() => set('isActive', val)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                form.isActive === val
                  ? val
                    ? 'border-[#10B981] bg-[#10B981]/10 text-[#10B981]'
                    : 'border-[#6B7280] bg-[#6B7280]/10 text-[#6B7280] dark:text-[#A1A1AA]'
                  : 'border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:border-[#6B7280]/40'
              }`}
            >
              {val ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {val ? 'Active' : 'Inactive'}
            </button>
          ))}
        </div>
      </Field>
    </form>
  )
}

/* ─── Drawer Shell ────────────────────────────────────────────────────────── */

function Drawer({ title, subtitle, iconBg, iconColor, Icon, formId, submitLabel, isPending, onClose, children }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[480px] flex flex-col bg-white dark:bg-[#181818] shadow-2xl border-l border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: iconBg }}>
              <Icon className="w-5 h-5" style={{ color: iconColor }} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#111111] dark:text-white">{title}</h2>
              {subtitle && <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate max-w-[260px]">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>

        <div className="px-6 py-4 border-t border-[#E5E7EB] dark:border-[#2A2A2A] flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            Cancel
          </button>
          <button type="submit" form={formId} disabled={isPending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-60 flex items-center justify-center gap-2">
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitLabel}
          </button>
        </div>
      </div>
    </>
  )
}

/* ─── Delete Confirm Modal ────────────────────────────────────────────────── */

function DeleteModal({ agency, isPending, onConfirm, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl w-full max-w-sm p-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#EF4444]/10 mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-[#EF4444]" strokeWidth={1.75} />
          </div>
          <h3 className="text-base font-bold text-[#111111] dark:text-white text-center mb-1">Delete Agency</h3>
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] text-center mb-6">
            Are you sure you want to delete <span className="font-semibold text-[#111111] dark:text-white">"{agency.name}"</span>?
            This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
              Cancel
            </button>
            <button onClick={onConfirm} disabled={isPending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-60 flex items-center justify-center gap-2">
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */

export default function AgenciesPage() {
  const qc = useQueryClient()

  const [search, setSearch]         = useState('')
  const [filter, setFilter]         = useState('all')   // 'all' | 'active' | 'inactive'
  const [page, setPage]             = useState(1)
  const [creating, setCreating]     = useState(false)
  const [editing, setEditing]       = useState(null)
  const [deleting, setDeleting]     = useState(null)
  const [toggling, setToggling]     = useState(null)

  /* ── Queries ─────────────────────────────────────────────────────────── */

  const agencyParams = useMemo(() => {
    const p = { page, limit: 12, sort: 'name' }
    if (search.trim()) p.search = search.trim()
    if (filter === 'active')   p.isActive = true
    if (filter === 'inactive') p.isActive = false
    return p
  }, [page, search, filter])

  const { data: agencyData, isLoading, isError } = useQuery({
    queryKey: ['agencies', agencyParams],
    queryFn:  () => agenciesApi.list(agencyParams).then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })

  // Fetch all commissions (up to 100) for per-agency stats
  const { data: commData } = useQuery({
    queryKey: ['commissions-all'],
    queryFn:  () => commissionsApi.list({ limit: 100 }).then((r) => r.data.data),
    staleTime: 60_000,
  })

  // Fetch all agency users for per-agency user count
  const { data: agentData } = useQuery({
    queryKey: ['agency-users-all'],
    queryFn:  () => usersApi.list({ role: 'agency', limit: 100 }).then((r) => r.data.data),
    staleTime: 60_000,
  })

  const agencies   = agencyData?.agencies   ?? []
  const total      = agencyData?.total      ?? 0
  const totalPages = agencyData?.totalPages ?? 1

  // Aggregate commission stats per agency
  const commByAgency = useMemo(() => {
    const map = {}
    for (const c of commData?.commissions ?? []) {
      const aid = c.agencyId?._id ?? c.agencyId
      if (!aid) continue
      if (!map[aid]) map[aid] = { total: 0, pending: 0, paidAmount: 0, outstandingAmount: 0 }
      map[aid].total++
      if (c.status === 'paid') map[aid].paidAmount += c.amount
      if (c.status === 'pending' || c.status === 'invoiced' || c.status === 'overdue') {
        map[aid].pending++
        map[aid].outstandingAmount += c.amount
      }
    }
    return map
  }, [commData])

  // Agent counts per agency
  const agentsByAgency = useMemo(() => {
    const map = {}
    for (const u of agentData?.users ?? []) {
      const aid = u.agencyId?._id ?? u.agencyId
      if (!aid) continue
      map[aid] = (map[aid] ?? 0) + 1
    }
    return map
  }, [agentData])

  // Summary stats (based on ALL agencies, not just current page)
  const activeCount   = agencyData?.agencies?.filter((a) => a.isActive).length ?? 0
  const inactiveCount = agencies.length - activeCount
  const totalPending  = Object.values(commByAgency).reduce((s, v) => s + v.pending, 0)

  /* ── Mutations ───────────────────────────────────────────────────────── */

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['agencies'] })
    qc.invalidateQueries({ queryKey: ['commissions-all'] })
  }

  const createMut = useMutation({
    mutationFn: (d) => agenciesApi.create(d),
    onSuccess: () => { invalidate(); toast.success('Agency created'); setCreating(false) },
    onError:   (e) => toast.error(e.response?.data?.message ?? 'Failed to create agency'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => agenciesApi.update(id, data),
    onSuccess: () => { invalidate(); toast.success('Agency updated'); setEditing(null) },
    onError:   (e) => toast.error(e.response?.data?.message ?? 'Failed to update agency'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => agenciesApi.remove(id),
    onSuccess: () => { invalidate(); toast.success('Agency deleted'); setDeleting(null) },
    onError:   (e) => toast.error(e.response?.data?.message ?? 'Failed to delete agency'),
  })

  async function handleToggle(agency) {
    setToggling(agency._id)
    try {
      await agenciesApi.update(agency._id, { isActive: !agency.isActive })
      invalidate()
      toast.success(`Agency ${agency.isActive ? 'deactivated' : 'activated'}`)
    } catch (e) {
      toast.error(e.response?.data?.message ?? 'Failed to update agency')
    } finally {
      setToggling(null)
    }
  }

  function handleSearchChange(val) {
    setSearch(val)
    setPage(1)
  }

  function handleFilterChange(val) {
    setFilter(val)
    setPage(1)
  }

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="min-h-full bg-[#FAFAF9] dark:bg-[#0B0B0B] p-4 sm:p-6 space-y-6">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#111111] dark:text-white">Agencies</h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
              {isLoading ? 'Loading…' : `${total} agenc${total === 1 ? 'y' : 'ies'} registered`}
            </p>
          </div>
        </div>

        <div className="sm:ml-auto flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]" strokeWidth={2} />
            <input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search agencies…"
              className="w-48 sm:w-56 pl-8 pr-8 py-2 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 outline-none focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/20 transition-all"
            />
            {search && (
              <button onClick={() => handleSearchChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111]">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Add button */}
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] transition-colors shadow-sm shadow-[#F95C4B]/25"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Add Agency
          </button>
        </div>
      </div>

      {/* ── Summary Stats ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Building2}   label="Total Agencies"     value={isLoading ? '—' : total}        color="#F95C4B" loading={isLoading} />
        <StatCard icon={ShieldCheck} label="Active"             value={isLoading ? '—' : activeCount}  color="#10B981" loading={isLoading} />
        <StatCard icon={Users}       label="Inactive"           value={isLoading ? '—' : inactiveCount} color="#6B7280" loading={isLoading} />
        <StatCard icon={TrendingUp}  label="Pending Commissions" value={isLoading ? '—' : totalPending} color="#F59E0B" loading={isLoading} />
      </div>

      {/* ── Filter Tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-1">
        {[
          { key: 'all',      label: 'All' },
          { key: 'active',   label: 'Active' },
          { key: 'inactive', label: 'Inactive' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => handleFilterChange(t.key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === t.key
                ? 'bg-[#F95C4B] text-white shadow-sm'
                : 'bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:border-[#F95C4B]/40 hover:text-[#F95C4B]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Grid / States ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] h-64 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertTriangle className="w-10 h-10 text-[#EF4444]" strokeWidth={1.5} />
          <p className="text-sm font-semibold text-[#111111] dark:text-white">Failed to load agencies</p>
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Check your connection and try again</p>
        </div>
      ) : agencies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#F5F5F4] dark:bg-[#202020] flex items-center justify-center">
            <Building2 className="w-8 h-8 text-[#6B7280]/30" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[#111111] dark:text-white mb-1">
              {search ? 'No agencies match your search' : 'No agencies yet'}
            </p>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
              {search ? 'Try a different name or email' : 'Add your first agency to get started'}
            </p>
          </div>
          {!search && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] transition-colors"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Add Agency
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agencies.map((agency) => (
            <AgencyCard
              key={agency._id}
              agency={agency}
              agentCount={agentsByAgency[agency._id] ?? 0}
              commStats={commByAgency[agency._id]}
              onEdit={setEditing}
              onDelete={setDeleting}
              onToggle={handleToggle}
              toggling={toggling}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Page {page} of {totalPages}</p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] disabled:opacity-40 hover:border-[#F95C4B]/40 hover:text-[#F95C4B] transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] disabled:opacity-40 hover:border-[#F95C4B]/40 hover:text-[#F95C4B] transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Create Drawer ────────────────────────────────────────────────── */}
      {creating && (
        <Drawer
          title="New Agency"
          subtitle="Add a property agency to the system"
          Icon={Building2}
          iconBg="#F95C4B18"
          iconColor="#F95C4B"
          formId="create-agency"
          submitLabel="Create Agency"
          isPending={createMut.isPending}
          onClose={() => setCreating(false)}
        >
          <AgencyForm
            id="create-agency"
            initial={EMPTY_FORM}
            onSubmit={(d) => createMut.mutate(d)}
            isPending={createMut.isPending}
          />
        </Drawer>
      )}

      {/* ── Edit Drawer ──────────────────────────────────────────────────── */}
      {editing && (
        <Drawer
          title="Edit Agency"
          subtitle={editing.name}
          Icon={Pencil}
          iconBg="#3B82F618"
          iconColor="#3B82F6"
          formId="edit-agency"
          submitLabel="Save Changes"
          isPending={updateMut.isPending}
          onClose={() => setEditing(null)}
        >
          <AgencyForm
            id="edit-agency"
            initial={{
              name: editing.name,
              contactEmail: editing.contactEmail ?? '',
              contactPhone: editing.contactPhone ?? '',
              isActive: editing.isActive,
            }}
            onSubmit={(d) => updateMut.mutate({ id: editing._id, data: d })}
            isPending={updateMut.isPending}
          />
        </Drawer>
      )}

      {/* ── Delete Modal ─────────────────────────────────────────────────── */}
      {deleting && (
        <DeleteModal
          agency={deleting}
          isPending={deleteMut.isPending}
          onConfirm={() => deleteMut.mutate(deleting._id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
