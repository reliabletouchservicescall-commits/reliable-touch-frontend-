import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  MapPin, Plus, Search, X, Loader2, CheckCircle2, XCircle, ChevronLeft, ChevronRight,
  AlertTriangle, Globe, Layers,
} from 'lucide-react'
import { areasApi } from '../../services/areasApi'
import { useAuthStore } from '../../store/authStore'
import { getApiErrorMessage } from '../../components/leads/leadShared'

const SA_PROVINCES = [
  'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Limpopo',
  'Mpumalanga', 'North West', 'Free State', 'Northern Cape',
]

const REGION_COLORS = {
  'Gauteng': '#F95C4B', 'Western Cape': '#3B82F6', 'KwaZulu-Natal': '#10B981',
  'Eastern Cape': '#8B5CF6', 'Limpopo': '#F59E0B', 'Mpumalanga': '#EC4899',
  'North West': '#06B6D4', 'Free State': '#84CC16', 'Northern Cape': '#EF4444',
}

function areaColor(area) {
  if (area.region && REGION_COLORS[area.region]) return REGION_COLORS[area.region]
  const sum = [...(area._id ?? '')].reduce((s, c) => s + c.charCodeAt(0), 0)
  const fallbacks = Object.values(REGION_COLORS)
  return fallbacks[sum % fallbacks.length]
}

function inputCls(hasErr) {
  return [
    'w-full px-4 py-2.5 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border transition-all outline-none',
    'text-[#111111] dark:text-white placeholder:text-[#6B7280]/50',
    'ring-2 ring-transparent focus:ring-[#F95C4B]/20 focus:bg-white dark:focus:bg-[#181818]',
    hasErr ? 'border-[#EF4444]' : 'border-transparent focus:border-[#F95C4B]',
  ].join(' ')
}

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

function StatCard({ icon: Icon, label, value, color, loading }) {
  return (
    <div className="bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color + '18' }}>
        <Icon className="w-5 h-5" style={{ color }} strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        {loading ? <div className="h-6 w-12 rounded bg-[#F5F5F4] dark:bg-[#202020] animate-pulse mb-1" /> : <p className="text-xl font-bold text-[#111111] dark:text-white">{value}</p>}
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] font-medium">{label}</p>
      </div>
    </div>
  )
}

/* ─── Area card — read-only (editing/deactivating a shared area stays admin-only) ── */
function AreaCard({ area }) {
  const color = areaColor(area)
  const active = area.isActive
  return (
    <div className={`bg-white dark:bg-[#181818] border rounded-2xl overflow-hidden transition-all hover:shadow-md ${
      active ? 'border-[#E5E7EB] dark:border-[#2A2A2A]' : 'border-[#E5E7EB]/60 dark:border-[#2A2A2A]/60 opacity-70'
    }`}>
      <div className="h-1.5 w-full" style={{ backgroundColor: color }} />
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: color + '20' }}>
            <MapPin className="w-5 h-5" style={{ color }} strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-[#111111] dark:text-white leading-tight">{area.name}</p>
              <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                active ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#6B7280]/10 text-[#6B7280] dark:text-[#A1A1AA]'
              }`}>
                {active ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                {active ? 'Active' : 'Inactive'}
              </span>
            </div>
            {area.region ? (
              <div className="flex items-center gap-1 mt-1">
                <Globe className="w-3 h-3 shrink-0" style={{ color }} />
                <span className="text-xs font-medium px-1.5 py-0.5 rounded-md" style={{ backgroundColor: color + '15', color }}>{area.region}</span>
              </div>
            ) : (
              <p className="text-[10px] text-[#6B7280]/40 dark:text-[#A1A1AA]/40 mt-1 italic">No region set</p>
            )}
          </div>
        </div>
        <p className="text-[10px] text-[#6B7280]/60 dark:text-[#A1A1AA]/50">
          Added {format(new Date(area.createdAt), 'd MMM yyyy')}
        </p>
      </div>
    </div>
  )
}

/* ─── Add Area form ──────────────────────────────────────────────────────── */
const EMPTY_FORM = { name: '', region: '' }

function AreaForm({ id, onSubmit }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [customRegion, setCustomRegion] = useState('')
  const [useCustom, setUseCustom] = useState(false)

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }))
  }

  function handleRegionSelect(val) {
    if (val === '__custom__') { setUseCustom(true); set('region', customRegion) }
    else { setUseCustom(false); set('region', val) }
  }

  function validate() {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Area name is required'
    else if (form.name.trim().length < 2) errs.name = 'Name must be at least 2 characters'
    else if (form.name.trim().length > 100) errs.name = 'Name must be under 100 characters'
    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    const finalRegion = useCustom ? customRegion.trim() : form.region
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSubmit({ name: form.name.trim(), region: finalRegion || null })
  }

  const selectedProvince = useCustom ? '__custom__' : (form.region || '')

  return (
    <form id={id} onSubmit={handleSubmit} className="space-y-5">
      <Field label="Area Name" required error={errors.name} hint="e.g. Sandton, Rosebank, Sea Point">
        <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Sandton" className={inputCls(errors.name)} autoFocus />
      </Field>
      <Field label="Province / Region" hint="Used to group areas by SA province">
        <div className="relative">
          <select value={selectedProvince} onChange={(e) => handleRegionSelect(e.target.value)} className={`${inputCls(false)} appearance-none cursor-pointer`}>
            <option value="">— None —</option>
            {SA_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            <option value="__custom__">Other / Custom…</option>
          </select>
          <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280] pointer-events-none" />
        </div>
        {useCustom && (
          <input value={customRegion} onChange={(e) => { setCustomRegion(e.target.value); set('region', e.target.value) }}
            placeholder="Enter custom region name" className={`mt-2 ${inputCls(false)}`} />
        )}
      </Field>
    </form>
  )
}

function Drawer({ title, subtitle, formId, submitLabel, isPending, onClose, children }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[460px] flex flex-col bg-white dark:bg-[#181818] shadow-2xl border-l border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#111111] dark:text-white">{title}</h2>
              {subtitle && <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{subtitle}</p>}
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

function RegionBar({ areas }) {
  const grouped = {}
  for (const a of areas) { const key = a.region || 'Unassigned'; grouped[key] = (grouped[key] ?? 0) + 1 }
  const entries = Object.entries(grouped).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return null
  return (
    <div className="bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" strokeWidth={1.75} />
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Areas by Province</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {entries.map(([region, count]) => {
          const color = REGION_COLORS[region] ?? '#6B7280'
          return (
            <div key={region} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: color + '15', color }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
              {region}
              <span className="ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold" style={{ backgroundColor: color + '25' }}>{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function AreasPage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)

  const params = { page, limit: 12, sort: 'name', ...(search.trim() ? { search: search.trim() } : {}), ...(filter === 'active' ? { isActive: true } : filter === 'inactive' ? { isActive: false } : {}) }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['agency-areas', params],
    queryFn: () => areasApi.list(params).then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })
  const { data: allAreaData } = useQuery({
    queryKey: ['agency-areas-all'],
    queryFn: () => areasApi.list({ limit: 100, sort: 'name' }).then((r) => r.data.data),
    staleTime: 60_000,
  })

  const areas = data?.areas ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const allAreas = allAreaData?.areas ?? []
  const activeCount = allAreas.filter((a) => a.isActive).length
  const inactiveCount = allAreas.length - activeCount

  const createMut = useMutation({
    mutationFn: (d) => areasApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agency-areas'] })
      qc.invalidateQueries({ queryKey: ['agency-areas-all'] })
      qc.invalidateQueries({ queryKey: ['areas-select'] })
      toast.success('Area added')
      setCreating(false)
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to add area')),
  })

  function handleSearchChange(v) { setSearch(v); setPage(1) }
  function handleFilterChange(v) { setFilter(v); setPage(1) }

  if (!user?.isAgencyManager) {
    return (
      <div className="flex items-center justify-center h-full py-32 px-6 text-center">
        <div>
          <div className="w-14 h-14 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center mb-4 mx-auto">
            <MapPin className="w-7 h-7 text-[#F95C4B]" strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">Manager access only</h3>
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] max-w-xs">
            Only your company's manager can view and manage areas.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-[#FAFAF9] dark:bg-[#0B0B0B] p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#111111] dark:text-white">Areas</h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
              {isLoading ? 'Loading…' : `${total} area${total !== 1 ? 's' : ''} · shared across the whole system`}
            </p>
          </div>
        </div>

        <div className="sm:ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]" strokeWidth={2} />
            <input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search areas…"
              className="w-44 sm:w-56 pl-8 pr-8 py-2 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 outline-none focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/20 transition-all" />
            {search && <button onClick={() => handleSearchChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111]"><X className="w-3.5 h-3.5" /></button>}
          </div>
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] transition-colors shadow-sm shadow-[#F95C4B]/25">
            <Plus className="w-4 h-4" strokeWidth={2.5} /> Add Area
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={MapPin} label="Total Areas" value={allAreas.length || total} color="#F95C4B" loading={isLoading} />
        <StatCard icon={CheckCircle2} label="Active" value={activeCount} color="#10B981" loading={isLoading} />
        <StatCard icon={XCircle} label="Inactive" value={inactiveCount} color="#6B7280" loading={isLoading} />
      </div>

      {allAreas.length > 0 && <RegionBar areas={allAreas} />}

      <div className="flex gap-1">
        {[{ key: 'all', label: 'All' }, { key: 'active', label: 'Active' }, { key: 'inactive', label: 'Inactive' }].map((t) => (
          <button key={t.key} onClick={() => handleFilterChange(t.key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === t.key ? 'bg-[#F95C4B] text-white shadow-sm' : 'bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:border-[#F95C4B]/40 hover:text-[#F95C4B]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] h-32 animate-pulse" />)}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertTriangle className="w-10 h-10 text-[#EF4444]" strokeWidth={1.5} />
          <p className="text-sm font-semibold text-[#111111] dark:text-white">Failed to load areas</p>
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
              {search ? 'Try searching by area name or province' : 'Add the areas your contacts and leads are in'}
            </p>
          </div>
          {!search && filter === 'all' && (
            <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] transition-colors">
              <Plus className="w-4 h-4" strokeWidth={2.5} /> Add First Area
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {areas.map((area) => <AreaCard key={area._id} area={area} />)}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Page {page} of {totalPages} · {total} total</p>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] disabled:opacity-40 hover:border-[#F95C4B]/40 hover:text-[#F95C4B] transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] disabled:opacity-40 hover:border-[#F95C4B]/40 hover:text-[#F95C4B] transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {creating && (
        <Drawer title="New Area" subtitle="Add a geographic area, shared across the whole system" formId="agency-create-area" submitLabel="Add Area" isPending={createMut.isPending} onClose={() => setCreating(false)}>
          <AreaForm id="agency-create-area" onSubmit={(d) => createMut.mutate(d)} />
        </Drawer>
      )}
    </div>
  )
}
