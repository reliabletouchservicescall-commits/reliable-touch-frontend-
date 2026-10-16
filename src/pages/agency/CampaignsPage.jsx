import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, isPast, isFuture, differenceInDays } from 'date-fns'
import {
  Megaphone, Plus, Search, X, Pencil, Trash2, Eye, AlertTriangle, Loader2,
  Calendar, Clock, ToggleLeft, ToggleRight, CheckCircle2, XCircle, Activity,
  Building2, Globe2,
} from 'lucide-react'
import { campaignsApi } from '../../services/campaignsApi'
import { useAuthStore } from '../../store/authStore'
import { getApiErrorMessage } from '../../components/leads/leadShared'

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
    'w-full px-4 py-2.5 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border',
    hasError ? 'border-[#EF4444]' : 'border-transparent focus:border-[#F95C4B]',
    'focus:bg-white dark:focus:bg-[#181818] text-[#111111] dark:text-white',
    'placeholder:text-[#6B7280]/50 dark:placeholder:text-[#A1A1AA]/40',
    'outline-none ring-2 ring-transparent focus:ring-[#F95C4B]/20 transition-all',
  ].join(' ')
}

function isOwnCampaign(campaign, user) {
  return Boolean(campaign.agencyId) && String(campaign.agencyId) === String(user?.agencyId)
}

function canManage(campaign, user) {
  return Boolean(user?.isAgencyManager) && isOwnCampaign(campaign, user)
}

function getTimeline(campaign) {
  const { startDate, endDate, isActive } = campaign
  if (!isActive) return { label: 'Inactive', color: '#6B7280', bg: '#6B728018', Icon: XCircle, progress: null }

  const now = new Date()
  const start = startDate ? new Date(startDate) : null
  const end = endDate ? new Date(endDate) : null

  if (start && isFuture(start)) {
    return { label: `Starts in ${differenceInDays(start, now)}d`, color: '#F95C4B', bg: '#F95C4B18', Icon: Clock, progress: null }
  }
  if (start && end) {
    if (isPast(end)) return { label: 'Ended', color: '#9CA3AF', bg: '#9CA3AF18', Icon: CheckCircle2, progress: 100 }
    const total = differenceInDays(end, start) || 1
    const elapsed = differenceInDays(now, start)
    const pct = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))
    return { label: `${differenceInDays(end, now)}d left`, color: '#10B981', bg: '#10B98118', Icon: Activity, progress: pct }
  }
  return { label: 'Active', color: '#10B981', bg: '#10B98118', Icon: CheckCircle2, progress: null }
}

function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) return null
  const fmt = (d) => format(new Date(d), 'd MMM yyyy')
  if (startDate && endDate) return `${fmt(startDate)} — ${fmt(endDate)}`
  if (startDate) return `From ${fmt(startDate)}`
  return `Until ${fmt(endDate)}`
}

/* ─── Scope badge — distinguishes a company's own campaign from a system-wide one ── */
function ScopeBadge({ campaign, user }) {
  const own = isOwnCampaign(campaign, user)
  return own ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F95C4B]/10 text-[#F95C4B]">
      <Building2 className="w-2.5 h-2.5" strokeWidth={2.5} /> Your Company
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#6B7280]/10 text-[#6B7280] dark:text-[#A1A1AA]">
      <Globe2 className="w-2.5 h-2.5" strokeWidth={2.5} /> System-wide
    </span>
  )
}

/* ─── Field wrapper ───────────────────────────────────────────────────────── */

function Field({ label, required, error, hint, children }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-1.5">
        {label}{required && <span className="text-[#F95C4B] ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">{hint}</p>}
      {error && <p className="mt-1 text-xs text-[#EF4444]">{error}</p>}
    </div>
  )
}

/* ─── Stat card ───────────────────────────────────────────────────────────── */

function StatCard({ label, value, icon: Icon, color, isLoading }) {
  return (
    <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}18` }}>
        <Icon className="w-5 h-5" style={{ color }} strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">{label}</p>
        {isLoading ? (
          <div className="h-6 w-10 rounded bg-[#F5F5F4] dark:bg-[#202020] animate-pulse mt-0.5" />
        ) : (
          <p className="text-xl font-bold text-[#111111] dark:text-white leading-tight">{value}</p>
        )}
      </div>
    </div>
  )
}

/* ─── Campaign form ───────────────────────────────────────────────────────── */

const EMPTY_FORM = { name: '', description: '', startDate: '', endDate: '', isActive: true }

function CampaignForm({ id, initial, onSubmit }) {
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState({})

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }))
  }

  function validate() {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Campaign name is required'
    if (form.name.trim().length > 150) errs.name = 'Name must be under 150 characters'
    if (form.description && form.description.length > 500) errs.description = 'Description must be under 500 characters'
    if (form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate)) {
      errs.endDate = 'End date must be after start date'
    }
    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSubmit({
      name: form.name.trim(),
      description: form.description.trim() || null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      isActive: form.isActive,
    })
  }

  return (
    <form id={id} onSubmit={handleSubmit} className="space-y-5">
      <Field label="Campaign Name" required error={errors.name}>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Sandton Rentals Drive" className={inputCls(errors.name)} autoFocus />
      </Field>
      <Field label="Description" error={errors.description} hint="Max 500 characters. Describe the goal or target audience.">
        <textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Describe the campaign objective or target area..." rows={4} className={`${inputCls(errors.description)} resize-none`} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Start Date" hint="Optional">
          <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} className={inputCls(false)} />
        </Field>
        <Field label="End Date" error={errors.endDate} hint="Optional">
          <input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} className={inputCls(errors.endDate)} />
        </Field>
      </div>
      <Field label="Status">
        <button
          type="button"
          onClick={() => set('isActive', !form.isActive)}
          className={[
            'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all',
            form.isActive ? 'border-[#10B981]/40 bg-[#10B981]/8 dark:bg-[#10B981]/10' : 'border-[#E5E7EB] dark:border-[#2A2A2A] bg-[#F5F5F4] dark:bg-[#202020]',
          ].join(' ')}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: form.isActive ? '#10B98120' : '#6B728020' }}>
              {form.isActive ? <ToggleRight className="w-4 h-4 text-[#10B981]" strokeWidth={1.75} /> : <ToggleLeft className="w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" strokeWidth={1.75} />}
            </div>
            <div className="text-left">
              <p className={`text-sm font-semibold ${form.isActive ? 'text-[#10B981]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>{form.isActive ? 'Active' : 'Inactive'}</p>
              <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">{form.isActive ? 'Visible and live for your team' : 'Paused and hidden from your team'}</p>
            </div>
          </div>
          <div className="w-10 h-5 rounded-full transition-all flex-shrink-0" style={{ backgroundColor: form.isActive ? '#10B981' : '#D1D5DB' }}>
            <div className="w-4 h-4 bg-white rounded-full shadow-sm mt-0.5 transition-all" style={{ marginLeft: form.isActive ? '21px' : '2px' }} />
          </div>
        </button>
      </Field>
    </form>
  )
}

/* ─── Drawer shell ────────────────────────────────────────────────────────── */

function DrawerShell({ title, subtitle, icon, iconBg, formId, submitLabel, isPending, onClose, children }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[500px] flex flex-col bg-white dark:bg-[#181818] shadow-2xl border-l border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center`}>{icon}</div>
            <div>
              <h2 className="text-sm font-bold text-[#111111] dark:text-white">{title}</h2>
              {subtitle && <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate max-w-[260px]">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
        <div className="px-6 py-4 border-t border-[#E5E7EB] dark:border-[#2A2A2A] flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            Cancel
          </button>
          <button type="submit" form={formId} disabled={isPending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitLabel}
          </button>
        </div>
      </div>
    </>
  )
}

function CreateDrawer({ onClose, onSaved }) {
  const qc = useQueryClient()
  const mut = useMutation({
    mutationFn: (data) => campaignsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agency-campaigns'] })
      toast.success('Campaign created')
      onSaved()
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to create campaign')),
  })

  return (
    <DrawerShell title="New Campaign" subtitle="Visible to your whole team" icon={<Megaphone className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />} iconBg="bg-[#F95C4B]/10" formId="create-campaign" submitLabel="Create Campaign" isPending={mut.isPending} onClose={onClose}>
      <CampaignForm id="create-campaign" initial={EMPTY_FORM} onSubmit={(p) => mut.mutate(p)} />
    </DrawerShell>
  )
}

function EditDrawer({ campaign, onClose, onSaved }) {
  const qc = useQueryClient()
  const mut = useMutation({
    mutationFn: (data) => campaignsApi.update(campaign._id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agency-campaigns'] })
      toast.success('Campaign updated')
      onSaved()
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to update campaign')),
  })

  const initial = {
    name: campaign.name ?? '',
    description: campaign.description ?? '',
    startDate: campaign.startDate ? campaign.startDate.slice(0, 10) : '',
    endDate: campaign.endDate ? campaign.endDate.slice(0, 10) : '',
    isActive: campaign.isActive ?? true,
  }

  return (
    <DrawerShell title="Edit Campaign" subtitle={campaign.name} icon={<Pencil className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />} iconBg="bg-[#F95C4B]/10" formId="edit-campaign" submitLabel="Save Changes" isPending={mut.isPending} onClose={onClose}>
      <CampaignForm id="edit-campaign" initial={initial} onSubmit={(p) => mut.mutate(p)} />
    </DrawerShell>
  )
}

/* ─── View panel ──────────────────────────────────────────────────────────── */

function ViewPanel({ campaign, user, onClose, onEdit }) {
  const timeline = getTimeline(campaign)
  const dateRange = formatDateRange(campaign.startDate, campaign.endDate)
  const TimelineIcon = timeline.Icon
  const manageable = canManage(campaign, user)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[520px] flex flex-col bg-white dark:bg-[#181818] shadow-2xl border-l border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
              <Eye className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
            </div>
            <h2 className="text-sm font-bold text-[#111111] dark:text-white">Campaign Details</h2>
          </div>
          <div className="flex items-center gap-2">
            {manageable && (
              <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#F95C4B] bg-[#F95C4B]/10 hover:bg-[#F95C4B]/20 transition-all">
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div className="p-5 rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-[#FAFAF9] dark:bg-[#111111]">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="w-11 h-11 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center flex-shrink-0">
                <Megaphone className="w-6 h-6 text-[#F95C4B]" strokeWidth={1.5} />
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <ScopeBadge campaign={campaign} user={user} />
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ color: timeline.color, backgroundColor: timeline.bg }}>
                  <TimelineIcon className="w-3 h-3" strokeWidth={2} /> {timeline.label}
                </span>
              </div>
            </div>
            <h3 className="text-lg font-bold text-[#111111] dark:text-white mb-1 mt-3">{campaign.name}</h3>
            {campaign.description && <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] leading-relaxed">{campaign.description}</p>}
          </div>

          {(campaign.startDate || campaign.endDate) && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-3">Timeline</p>
              <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-[#181818]">
                  <Calendar className="w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" strokeWidth={1.75} />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Date Range</p>
                    <p className="text-sm font-semibold text-[#111111] dark:text-white">{dateRange}</p>
                  </div>
                </div>
                {timeline.progress !== null && (
                  <div className="px-4 py-3 border-t border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818]">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Progress</p>
                      <p className="text-xs font-bold" style={{ color: timeline.color }}>{timeline.progress}%</p>
                    </div>
                    <div className="h-2 bg-[#F5F5F4] dark:bg-[#202020] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${timeline.progress}%`, backgroundColor: timeline.color }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] space-y-1 pt-2 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
            <p>Created: {format(new Date(campaign.createdAt), 'd MMM yyyy, HH:mm')}</p>
            <p>Updated: {format(new Date(campaign.updatedAt), 'd MMM yyyy, HH:mm')}</p>
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── Delete dialog ───────────────────────────────────────────────────────── */

function DeleteDialog({ campaign, onClose, onDeleted }) {
  const qc = useQueryClient()
  const mut = useMutation({
    mutationFn: () => campaignsApi.remove(campaign._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agency-campaigns'] })
      toast.success('Campaign deleted')
      onDeleted()
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Delete failed')),
  })

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#EF4444]/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
            </div>
            <h3 className="font-bold text-[#111111] dark:text-white">Delete Campaign</h3>
          </div>
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mb-6">
            Are you sure you want to delete <span className="font-semibold text-[#111111] dark:text-white">{campaign?.name}</span>? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
              Cancel
            </button>
            <button onClick={() => mut.mutate()} disabled={mut.isPending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-60 flex items-center justify-center gap-2">
              {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── Campaign card ───────────────────────────────────────────────────────── */

function CampaignCard({ campaign, user, onView, onEdit, onDelete, onToggle, isToggling }) {
  const timeline = getTimeline(campaign)
  const dateRange = formatDateRange(campaign.startDate, campaign.endDate)
  const TimelineIcon = timeline.Icon
  const manageable = canManage(campaign, user)

  return (
    <div className="group bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden hover:shadow-md hover:border-[#D1D5DB] dark:hover:border-[#3A3A3A] transition-all flex flex-col">
      <div className="h-1 w-full" style={{ backgroundColor: timeline.color }} />
      <div className="p-5 flex flex-col flex-1 gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${timeline.color}18` }}>
              <Megaphone className="w-5 h-5" style={{ color: timeline.color }} strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#111111] dark:text-white leading-snug line-clamp-2">{campaign.name}</h3>
              {campaign.description && <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5 line-clamp-2 leading-relaxed">{campaign.description}</p>}
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button title="View details" onClick={onView} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] hover:text-[#111111] dark:hover:text-white transition-all">
              <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
            {manageable && (
              <>
                <button title="Edit" onClick={onEdit} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F95C4B]/10 hover:text-[#F95C4B] transition-all">
                  <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
                <button title="Delete" onClick={onDelete} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#EF4444]/10 hover:text-[#EF4444] transition-all">
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              </>
            )}
          </div>
        </div>

        {timeline.progress !== null && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] font-semibold uppercase tracking-widest">Progress</span>
              <span className="text-[10px] font-bold" style={{ color: timeline.color }}>{timeline.progress}%</span>
            </div>
            <div className="h-1.5 bg-[#F5F5F4] dark:bg-[#202020] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${timeline.progress}%`, backgroundColor: timeline.color }} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-auto pt-3 border-t border-[#F5F5F4] dark:border-[#202020]">
          <div className="flex items-center gap-2">
            <ScopeBadge campaign={campaign} user={user} />
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ color: timeline.color, backgroundColor: timeline.bg }}>
              <TimelineIcon className="w-2.5 h-2.5" strokeWidth={2.5} /> {timeline.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {dateRange && (
              <div className="hidden sm:flex items-center gap-1 text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
                <Calendar className="w-3 h-3" strokeWidth={1.75} /> <span>{dateRange}</span>
              </div>
            )}
            {manageable ? (
              <button
                title={campaign.isActive ? 'Deactivate campaign' : 'Activate campaign'}
                onClick={onToggle}
                disabled={isToggling}
                className={[
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50',
                  campaign.isActive ? 'bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20' : 'bg-[#6B7280]/10 text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#6B7280]/20',
                ].join(' ')}
              >
                {isToggling ? <Loader2 className="w-3 h-3 animate-spin" /> : campaign.isActive ? <ToggleRight className="w-3 h-3" strokeWidth={2} /> : <ToggleLeft className="w-3 h-3" strokeWidth={2} />}
                {campaign.isActive ? 'Active' : 'Inactive'}
              </button>
            ) : (
              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold ${campaign.isActive ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#6B7280]/10 text-[#6B7280] dark:text-[#A1A1AA]'}`}>
                {campaign.isActive ? <ToggleRight className="w-3 h-3" strokeWidth={2} /> : <ToggleLeft className="w-3 h-3" strokeWidth={2} />}
                {campaign.isActive ? 'Active' : 'Inactive'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Empty state ─────────────────────────────────────────────────────────── */

function EmptyState({ hasFilters, isManager, onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center col-span-full">
      <div className="w-16 h-16 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center mb-4">
        <Megaphone className="w-8 h-8 text-[#F95C4B]" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">{hasFilters ? 'No campaigns found' : 'No campaigns yet'}</h3>
      <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mb-6 max-w-xs">
        {hasFilters ? 'Try adjusting your search or filters.' : isManager ? 'Create your first campaign to organise your team\'s outreach effort.' : 'Your manager hasn\'t created any campaigns yet.'}
      </p>
      {!hasFilters && isManager && (
        <button onClick={onAdd} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A]">
          <Plus className="w-4 h-4" /> Create Campaign
        </button>
      )}
    </div>
  )
}

/* ─── Main page ───────────────────────────────────────────────────────────── */

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'true', label: 'Active' },
  { key: 'false', label: 'Inactive' },
]

export default function CampaignsPage() {
  const { user } = useAuthStore()
  const isManager = Boolean(user?.isAgencyManager)

  const [search, setSearch] = useState('')
  const [activeFilter, setActive] = useState('')
  const [panel, setPanel] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [toggling, setToggling] = useState(null)

  const debouncedSearch = useDebounce(search)
  const qc = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['agency-campaigns', { search: debouncedSearch, isActive: activeFilter }],
    queryFn: () =>
      campaignsApi.list({
        limit: 100,
        search: debouncedSearch || undefined,
        isActive: activeFilter || undefined,
      }).then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })

  const campaigns = data?.campaigns ?? []
  const total = data?.total ?? 0
  const hasFilters = Boolean(search || activeFilter)

  const ownCount = campaigns.filter((c) => isOwnCampaign(c, user)).length
  const activeCount = campaigns.filter((c) => c.isActive).length
  const inactiveCount = campaigns.length - activeCount

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }) => campaignsApi.update(id, { isActive }),
    onSuccess: (_, { isActive }) => {
      qc.invalidateQueries({ queryKey: ['agency-campaigns'] })
      toast.success(isActive ? 'Campaign activated' : 'Campaign deactivated')
      setToggling(null)
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to update campaign'))
      setToggling(null)
    },
  })

  function handleToggle(campaign) {
    setToggling(campaign._id)
    toggleMut.mutate({ id: campaign._id, isActive: !campaign.isActive })
  }

  return (
    <div className="min-h-full bg-[#FAFAF9] dark:bg-[#0B0B0B] p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#111111] dark:text-white">Campaigns</h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
              {isLoading ? 'Loading…' : `${total} campaign${total !== 1 ? 's' : ''} · ${isManager ? 'manage your team\'s own, plus system-wide' : 'your company\'s and system-wide'}`}
            </p>
          </div>
        </div>

        <div className="sm:ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]" strokeWidth={2} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaigns…"
              className="w-44 sm:w-56 pl-8 pr-8 py-2 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 outline-none focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/20 transition-all"
            />
            {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111] dark:hover:text-white"><X className="w-3.5 h-3.5" /></button>}
          </div>
          {isManager && (
            <button onClick={() => setPanel({ mode: 'create' })} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] transition-colors shadow-sm shadow-[#F95C4B]/25">
              <Plus className="w-4 h-4" strokeWidth={2.5} /> New Campaign
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total" value={total} icon={Megaphone} color="#F95C4B" isLoading={isLoading} />
        <StatCard label="Active" value={activeCount} icon={CheckCircle2} color="#10B981" isLoading={isLoading} />
        <StatCard label="Inactive" value={inactiveCount} icon={XCircle} color="#6B7280" isLoading={isLoading} />
        <StatCard label="Your Company's" value={ownCount} icon={Building2} color="#FF8C7A" isLoading={isLoading} />
      </div>

      <div className="flex gap-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={[
              'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
              activeFilter === tab.key
                ? 'bg-[#F95C4B] text-white shadow-sm'
                : 'bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:border-[#F95C4B]/40 hover:text-[#F95C4B]',
            ].join(' ')}
          >
            {tab.key === 'true' && <span className="w-2 h-2 rounded-full bg-[#10B981]" />}
            {tab.key === 'false' && <span className="w-2 h-2 rounded-full bg-[#6B7280]" />}
            {tab.label}
          </button>
        ))}
      </div>

      {isError && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444]">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Failed to load campaigns. Please try refreshing the page.
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] h-40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.length === 0 ? (
            <EmptyState hasFilters={hasFilters} isManager={isManager} onAdd={() => setPanel({ mode: 'create' })} />
          ) : (
            campaigns.map((c) => (
              <CampaignCard
                key={c._id}
                campaign={c}
                user={user}
                onView={() => setPanel({ mode: 'view', campaign: c })}
                onEdit={() => setPanel({ mode: 'edit', campaign: c })}
                onDelete={() => setToDelete(c)}
                onToggle={() => handleToggle(c)}
                isToggling={toggling === c._id}
              />
            ))
          )}
        </div>
      )}

      {panel?.mode === 'create' && <CreateDrawer onClose={() => setPanel(null)} onSaved={() => setPanel(null)} />}
      {panel?.mode === 'edit' && panel.campaign && <EditDrawer campaign={panel.campaign} onClose={() => setPanel(null)} onSaved={() => setPanel(null)} />}
      {panel?.mode === 'view' && panel.campaign && (
        <ViewPanel campaign={panel.campaign} user={user} onClose={() => setPanel(null)} onEdit={() => setPanel({ mode: 'edit', campaign: panel.campaign })} />
      )}
      {toDelete && <DeleteDialog campaign={toDelete} onClose={() => setToDelete(null)} onDeleted={() => setToDelete(null)} />}
    </div>
  )
}
