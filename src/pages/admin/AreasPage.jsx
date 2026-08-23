import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  MapPin, Plus, Search, X, Pencil, Trash2, Loader2,
  CheckCircle2, XCircle, ChevronLeft, ChevronRight,
  AlertTriangle, ToggleLeft, ToggleRight, Map,
  TrendingUp, Users, Layers, Building2, Globe,
} from 'lucide-react'
import { areasApi } from '../../services/areasApi'
import { leadsApi } from '../../services/leadsApi'
import { contactsApi } from '../../services/contactsApi'

/* ─── SA Province options ─────────────────────────────────────────────────── */

const SA_PROVINCES = [
  'Gauteng',
  'Western Cape',
  'KwaZulu-Natal',
  'Eastern Cape',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Free State',
  'Northern Cape',
]

/* ─── Colour palette per region ──────────────────────────────────────────── */

const REGION_COLORS = {
  'Gauteng':        '#F95C4B',
  'Western Cape':   '#3B82F6',
  'KwaZulu-Natal':  '#10B981',
  'Eastern Cape':   '#8B5CF6',
  'Limpopo':        '#F59E0B',
  'Mpumalanga':     '#EC4899',
  'North West':     '#06B6D4',
  'Free State':     '#84CC16',
  'Northern Cape':  '#EF4444',
}

function areaColor(area) {
  if (area.region && REGION_COLORS[area.region]) return REGION_COLORS[area.region]
  const sum = [...(area._id ?? '')].reduce((s, c) => s + c.charCodeAt(0), 0)
  const fallbacks = Object.values(REGION_COLORS)
  return fallbacks[sum % fallbacks.length]
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

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

function StatCard({ icon: Icon, label, value, color, loading, sub }) {
  return (
    <div className="bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + '18' }}>
        <Icon className="w-5 h-5" style={{ color }} strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        {loading
          ? <div className="h-6 w-12 rounded bg-[#F5F5F4] dark:bg-[#202020] animate-pulse mb-1" />
          : <p className="text-xl font-bold text-[#111111] dark:text-white">{value}</p>
        }
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] font-medium">{label}</p>
        {sub && <p className="text-[10px] text-[#6B7280]/60 dark:text-[#A1A1AA]/50 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

/* ─── Area Card ───────────────────────────────────────────────────────────── */

function AreaCard({ area, leadCount, contactCount, onEdit, onDelete, onToggle, toggling }) {
  const color  = areaColor(area)
  const active = area.isActive

  return (
    <div className={`bg-white dark:bg-[#181818] border rounded-2xl overflow-hidden transition-all hover:shadow-md ${
      active
        ? 'border-[#E5E7EB] dark:border-[#2A2A2A]'
        : 'border-[#E5E7EB]/60 dark:border-[#2A2A2A]/60 opacity-70'
    }`}>
      {/* Accent bar */}
      <div className="h-1.5 w-full" style={{ backgroundColor: color }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
            style={{ backgroundColor: color + '20' }}
          >
            <MapPin className="w-5 h-5" style={{ color }} strokeWidth={1.75} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-[#111111] dark:text-white leading-tight">
                {area.name}
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

            {area.region ? (
              <div className="flex items-center gap-1 mt-1">
                <Globe className="w-3 h-3 shrink-0" style={{ color }} />
                <span
                  className="text-xs font-medium px-1.5 py-0.5 rounded-md"
                  style={{ backgroundColor: color + '15', color }}
                >
                  {area.region}
                </span>
              </div>
            ) : (
              <p className="text-[10px] text-[#6B7280]/40 dark:text-[#A1A1AA]/40 mt-1 italic">No region set</p>
            )}
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-2 mb-4 py-3 border-t border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="text-center">
            <p className="text-lg font-bold text-[#111111] dark:text-white">{leadCount}</p>
            <p className="text-[9px] uppercase tracking-wide font-semibold text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">Leads</p>
          </div>
          <div className="text-center border-l border-[#E5E7EB] dark:border-[#2A2A2A]">
            <p className="text-lg font-bold text-[#111111] dark:text-white">{contactCount}</p>
            <p className="text-[9px] uppercase tracking-wide font-semibold text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">Contacts</p>
          </div>
        </div>

        {/* Lead activity indicator */}
        {leadCount > 0 && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl" style={{ backgroundColor: color + '10' }}>
            <TrendingUp className="w-3.5 h-3.5 shrink-0" style={{ color }} strokeWidth={1.75} />
            <p className="text-xs font-medium" style={{ color }}>
              {leadCount} active lead{leadCount !== 1 ? 's' : ''} in this area
            </p>
          </div>
        )}

        {/* Created date */}
        <p className="text-[10px] text-[#6B7280]/60 dark:text-[#A1A1AA]/50 mb-4">
          Added {format(new Date(area.createdAt), 'd MMM yyyy')}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
          <button
            onClick={() => onEdit(area)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] bg-[#F5F5F4] dark:bg-[#202020] hover:bg-[#EBEBEB] dark:hover:bg-[#2A2A2A] transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
            Edit
          </button>

          <button
            onClick={() => onToggle(area)}
            disabled={toggling === area._id}
            title={active ? 'Deactivate' : 'Activate'}
            className={`flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${
              active
                ? 'text-[#10B981] bg-[#10B981]/10 hover:bg-[#10B981]/20'
                : 'text-[#6B7280] bg-[#F5F5F4] dark:bg-[#202020] hover:bg-[#EBEBEB] dark:hover:bg-[#2A2A2A]'
            }`}
          >
            {toggling === area._id
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : active
                ? <ToggleRight className="w-4 h-4" strokeWidth={2} />
                : <ToggleLeft className="w-4 h-4" strokeWidth={2} />
            }
          </button>

          <button
            onClick={() => onDelete(area)}
            title="Delete area"
            className="flex items-center justify-center w-9 h-9 rounded-xl text-[#EF4444] bg-[#EF4444]/10 hover:bg-[#EF4444]/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Area Form ───────────────────────────────────────────────────────────── */

const EMPTY_FORM = { name: '', region: '', isActive: true }

function AreaForm({ id, initial, onSubmit, isPending }) {
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState({})
  const [customRegion, setCustomRegion] = useState(
    initial.region && !SA_PROVINCES.includes(initial.region) ? initial.region : ''
  )
  const [useCustom, setUseCustom] = useState(
    !!initial.region && !SA_PROVINCES.includes(initial.region)
  )

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }))
  }

  function handleRegionSelect(val) {
    if (val === '__custom__') {
      setUseCustom(true)
      set('region', customRegion)
    } else {
      setUseCustom(false)
      set('region', val)
    }
  }

  function validate() {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Area name is required'
    else if (form.name.trim().length < 2) errs.name = 'Name must be at least 2 characters'
    if (form.name.trim().length > 100) errs.name = 'Name must be under 100 characters'
    if (form.region && form.region.trim().length > 100)
      errs.region = 'Region must be under 100 characters'
    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    const finalRegion = useCustom ? customRegion.trim() : form.region
    const finalForm = { ...form, region: finalRegion || null }
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSubmit({
      name: finalForm.name.trim(),
      region: finalForm.region || null,
      isActive: finalForm.isActive,
    })
  }

  const selectedProvince = useCustom ? '__custom__' : (form.region || '')

  return (
    <form id={id} onSubmit={handleSubmit} className="space-y-5">
      <Field label="Area Name" required error={errors.name} hint="e.g. Sandton, Rosebank, Sea Point">
        <input
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Sandton"
          className={inputCls(errors.name)}
          autoFocus
        />
      </Field>

      <Field label="Province / Region" error={errors.region} hint="Used to group areas by SA province">
        <div className="relative">
          <select
            value={selectedProvince}
            onChange={(e) => handleRegionSelect(e.target.value)}
            className={[
              inputCls(errors.region),
              'appearance-none cursor-pointer',
            ].join(' ')}
          >
            <option value="">— None —</option>
            {SA_PROVINCES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
            <option value="__custom__">Other / Custom…</option>
          </select>
          <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280] pointer-events-none" />
        </div>

        {useCustom && (
          <input
            value={customRegion}
            onChange={(e) => { setCustomRegion(e.target.value); set('region', e.target.value) }}
            placeholder="Enter custom region name"
            className={`mt-2 ${inputCls(false)}`}
          />
        )}
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
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[460px] flex flex-col bg-white dark:bg-[#181818] shadow-2xl border-l border-[#E5E7EB] dark:border-[#2A2A2A]">
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
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>

        <div className="px-6 py-4 border-t border-[#E5E7EB] dark:border-[#2A2A2A] flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]"
          >
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitLabel}
          </button>
        </div>
      </div>
    </>
  )
}

/* ─── Delete Confirm Modal ────────────────────────────────────────────────── */

function DeleteModal({ area, leadCount, isPending, onConfirm, onClose }) {
  const hasLeads = leadCount > 0

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#EF4444]/10 mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-[#EF4444]" strokeWidth={1.75} />
        </div>

        <h3 className="text-base font-bold text-[#111111] dark:text-white text-center mb-1">
          Delete Area
        </h3>

        <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] text-center mb-4">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-[#111111] dark:text-white">"{area.name}"</span>?
        </p>

        {hasLeads && (
          <div className="flex items-start gap-2.5 p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl mb-4">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" strokeWidth={1.75} />
            <p className="text-xs text-[#92400E] dark:text-[#FCD34D]">
              This area has <strong>{leadCount} lead{leadCount !== 1 ? 's' : ''}</strong> assigned to it.
              Deleting will remove the area reference from those leads.
            </p>
          </div>
        )}

        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] text-center mb-6">
          This action cannot be undone.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {hasLeads ? 'Delete Anyway' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Region breakdown bar ────────────────────────────────────────────────── */

function RegionBar({ areas }) {
  const grouped = useMemo(() => {
    const map = {}
    for (const a of areas) {
      const key = a.region || 'Unassigned'
      map[key] = (map[key] ?? 0) + 1
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [areas])

  if (grouped.length === 0) return null

  return (
    <div className="bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" strokeWidth={1.75} />
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">
          Areas by Province
        </h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {grouped.map(([region, count]) => {
          const color = REGION_COLORS[region] ?? '#6B7280'
          return (
            <div
              key={region}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ backgroundColor: color + '15', color }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
              {region}
              <span
                className="ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                style={{ backgroundColor: color + '25' }}
              >
                {count}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */

export default function AreasPage() {
  const qc = useQueryClient()

  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState('all')
  const [page, setPage]         = useState(1)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing]   = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [toggling, setToggling] = useState(null)

  /* ── Query params ─────────────────────────────────────────────────────── */

  const areaParams = useMemo(() => {
    const p = { page, limit: 12, sort: 'name' }
    if (search.trim()) p.search = search.trim()
    if (filter === 'active')   p.isActive = true
    if (filter === 'inactive') p.isActive = false
    return p
  }, [page, search, filter])

  /* ── Queries ──────────────────────────────────────────────────────────── */

  const { data: areaData, isLoading, isError } = useQuery({
    queryKey: ['areas', areaParams],
    queryFn:  () => areasApi.list(areaParams).then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })

  // Fetch all areas (no filter) for region breakdown and stats
  const { data: allAreaData } = useQuery({
    queryKey: ['areas-all'],
    queryFn:  () => areasApi.list({ limit: 100, sort: 'name' }).then((r) => r.data.data),
    staleTime: 60_000,
  })

  // Fetch leads to compute per-area lead counts
  const { data: leadsData } = useQuery({
    queryKey: ['leads-all-for-areas'],
    queryFn:  () => leadsApi.list({ limit: 200 }).then((r) => r.data.data),
    staleTime: 60_000,
  })

  // Fetch contacts to compute per-area contact counts
  const { data: contactsData } = useQuery({
    queryKey: ['contacts-all-for-areas'],
    queryFn:  () => contactsApi.list({ limit: 200 }).then((r) => r.data.data),
    staleTime: 60_000,
  })

  const areas      = areaData?.areas      ?? []
  const total      = areaData?.total      ?? 0
  const totalPages = areaData?.totalPages ?? 1
  const allAreas   = allAreaData?.areas   ?? []

  /* ── Per-area aggregates ──────────────────────────────────────────────── */

  const leadsByArea = useMemo(() => {
    const map = {}
    for (const lead of leadsData?.leads ?? []) {
      const aid = lead.area?._id ?? lead.area
      if (!aid) continue
      map[aid] = (map[aid] ?? 0) + 1
    }
    return map
  }, [leadsData])

  const contactsByArea = useMemo(() => {
    const map = {}
    for (const contact of contactsData?.contacts ?? []) {
      const aid = contact.area?._id ?? contact.area
      if (!aid) continue
      map[aid] = (map[aid] ?? 0) + 1
    }
    return map
  }, [contactsData])

  /* ── Summary stats ────────────────────────────────────────────────────── */

  const activeCount   = allAreas.filter((a) => a.isActive).length
  const inactiveCount = allAreas.length - activeCount
  const totalLeads    = Object.values(leadsByArea).reduce((s, n) => s + n, 0)
  const coveredAreas  = allAreas.filter((a) => (leadsByArea[a._id] ?? 0) > 0).length

  /* ── Mutations ────────────────────────────────────────────────────────── */

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['areas'] })
    qc.invalidateQueries({ queryKey: ['areas-all'] })
  }

  const createMut = useMutation({
    mutationFn: (d) => areasApi.create(d),
    onSuccess: () => { invalidate(); toast.success('Area created'); setCreating(false) },
    onError:   (e) => toast.error(e.response?.data?.message ?? 'Failed to create area'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => areasApi.update(id, data),
    onSuccess: () => { invalidate(); toast.success('Area updated'); setEditing(null) },
    onError:   (e) => toast.error(e.response?.data?.message ?? 'Failed to update area'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => areasApi.remove(id),
    onSuccess: () => { invalidate(); toast.success('Area deleted'); setDeleting(null) },
    onError:   (e) => toast.error(e.response?.data?.message ?? 'Failed to delete area'),
  })

  async function handleToggle(area) {
    setToggling(area._id)
    try {
      await areasApi.update(area._id, { isActive: !area.isActive })
      invalidate()
      toast.success(`Area ${area.isActive ? 'deactivated' : 'activated'}`)
    } catch (e) {
      toast.error(e.response?.data?.message ?? 'Failed to update area')
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

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
    <div className="min-h-full bg-[#FAFAF9] dark:bg-[#0B0B0B] p-4 sm:p-6 space-y-6">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#111111] dark:text-white">Areas</h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
              {isLoading
                ? 'Loading…'
                : `${total} area${total !== 1 ? 's' : ''} · used to classify leads & contacts`
              }
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
              placeholder="Search areas…"
              className="w-44 sm:w-56 pl-8 pr-8 py-2 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 outline-none focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/20 transition-all"
            />
            {search && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111]"
              >
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
            Add Area
          </button>
        </div>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={Map}
          label="Total Areas"
          value={isLoading ? '—' : allAreas.length || total}
          color="#F95C4B"
          loading={isLoading}
        />
        <StatCard
          icon={CheckCircle2}
          label="Active"
          value={isLoading ? '—' : activeCount}
          color="#10B981"
          loading={isLoading}
        />
        <StatCard
          icon={XCircle}
          label="Inactive"
          value={isLoading ? '—' : inactiveCount}
          color="#6B7280"
          loading={isLoading}
        />
        <StatCard
          icon={TrendingUp}
          label="Active Leads"
          value={isLoading ? '—' : totalLeads}
          color="#8B5CF6"
          sub={`across ${coveredAreas} area${coveredAreas !== 1 ? 's' : ''}`}
          loading={isLoading}
        />
      </div>

      {/* ── Region breakdown ────────────────────────────────────────────── */}
      {allAreas.length > 0 && <RegionBar areas={allAreas} />}

      {/* ── Filter tabs ─────────────────────────────────────────────────── */}
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
            <div
              key={i}
              className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] h-56 animate-pulse"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertTriangle className="w-10 h-10 text-[#EF4444]" strokeWidth={1.5} />
          <p className="text-sm font-semibold text-[#111111] dark:text-white">Failed to load areas</p>
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Check your connection and try again</p>
        </div>
      ) : areas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#F5F5F4] dark:bg-[#202020] flex items-center justify-center">
            <MapPin className="w-8 h-8 text-[#6B7280]/30" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[#111111] dark:text-white mb-1">
              {search ? 'No areas match your search' : filter !== 'all' ? `No ${filter} areas` : 'No areas yet'}
            </p>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
              {search
                ? 'Try searching by area name or province'
                : 'Add geographic areas to classify your leads and contacts'
              }
            </p>
          </div>
          {!search && filter === 'all' && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] transition-colors"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Add First Area
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {areas.map((area) => (
            <AreaCard
              key={area._id}
              area={area}
              leadCount={leadsByArea[area._id] ?? 0}
              contactCount={contactsByArea[area._id] ?? 0}
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
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
            Page {page} of {totalPages} · {total} total
          </p>
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
          title="New Area"
          subtitle="Add a geographic area to the system"
          Icon={MapPin}
          iconBg="#F95C4B18"
          iconColor="#F95C4B"
          formId="create-area"
          submitLabel="Create Area"
          isPending={createMut.isPending}
          onClose={() => setCreating(false)}
        >
          <AreaForm
            id="create-area"
            initial={EMPTY_FORM}
            onSubmit={(d) => createMut.mutate(d)}
            isPending={createMut.isPending}
          />
        </Drawer>
      )}

      {/* ── Edit Drawer ──────────────────────────────────────────────────── */}
      {editing && (
        <Drawer
          title="Edit Area"
          subtitle={editing.name}
          Icon={Pencil}
          iconBg="#3B82F618"
          iconColor="#3B82F6"
          formId="edit-area"
          submitLabel="Save Changes"
          isPending={updateMut.isPending}
          onClose={() => setEditing(null)}
        >
          <AreaForm
            id="edit-area"
            initial={{
              name: editing.name,
              region: editing.region ?? '',
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
          area={deleting}
          leadCount={leadsByArea[deleting._id] ?? 0}
          isPending={deleteMut.isPending}
          onConfirm={() => deleteMut.mutate(deleting._id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
