import { Sparkles, ThermometerSnowflake, ThermometerSun, Flame } from 'lucide-react'

export const LEAD_STATUS_META = {
  cold:      { label: 'Cold',      color: '#6B7280', bg: '#6B728018' },
  warm:      { label: 'Warm',      color: '#F59E0B', bg: '#F59E0B18' },
  hot:       { label: 'Hot',       color: '#EF4444', bg: '#EF444418' },
  converted: { label: 'Converted', color: '#10B981', bg: '#10B98118' },
  lost:      { label: 'Lost',      color: '#9CA3AF', bg: '#9CA3AF18' },
}

// Statuses a cold caller may pick when logging a new lead — matches the backend's
// LEAD_STATUS_CALLER_OPTIONS. '' means "let the system decide from the follow-up date".
export const LEAD_TEMPERATURE_OPTIONS = [
  { value: '',     label: 'Auto', hint: 'Based on follow-up date', icon: Sparkles,            color: '#3B82F6' },
  { value: 'cold', label: 'Cold', hint: 'Not urgent',               icon: ThermometerSnowflake, color: '#6B7280' },
  { value: 'warm', label: 'Warm', hint: 'Follow up soon',           icon: ThermometerSun,       color: '#F59E0B' },
  { value: 'hot',  label: 'Hot',  hint: 'Ready to move — urgent',   icon: Flame,                color: '#EF4444' },
]

export function LeadTemperaturePicker({ value, onChange }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-1.5">
        Lead Temperature
      </label>
      <div className="grid grid-cols-4 gap-2">
        {LEAD_TEMPERATURE_OPTIONS.map((o) => {
          const Icon = o.icon
          const active = value === o.value
          return (
            <button
              key={o.value || 'auto'}
              type="button"
              onClick={() => onChange(o.value)}
              className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-center transition-all ${
                active
                  ? 'border-current'
                  : 'border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#D1D5DB] dark:hover:border-[#3A3A3A] bg-white dark:bg-[#202020]'
              }`}
              style={active ? { color: o.color, backgroundColor: `${o.color}12`, borderColor: o.color } : {}}
            >
              <Icon className="w-4 h-4" strokeWidth={1.75} style={{ color: active ? o.color : undefined }} />
              <span className={`text-[11px] font-semibold ${active ? '' : 'text-[#111111] dark:text-white'}`}>{o.label}</span>
            </button>
          )
        })}
      </div>
      <p className="mt-1.5 text-xs text-[#6B7280] dark:text-[#A1A1AA]">
        {LEAD_TEMPERATURE_OPTIONS.find((o) => o.value === value)?.hint}
      </p>
    </div>
  )
}

export function inputCls(hasError) {
  return [
    'w-full px-4 py-2.5 rounded-xl text-sm',
    'bg-[#F5F5F4] dark:bg-[#202020]',
    'border',
    hasError ? 'border-[#EF4444]' : 'border-transparent focus:border-[#F95C4B]',
    'focus:bg-white dark:focus:bg-[#181818]',
    'text-[#111111] dark:text-white',
    'placeholder:text-[#6B7280]/50 dark:placeholder:text-[#A1A1AA]/40',
    'outline-none ring-2 ring-transparent focus:ring-[#F95C4B]/20 transition-all',
  ].join(' ')
}

export function Field({ label, required, error, hint, children }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-1.5">
        {label}{required && <span className="text-[#F95C4B] ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-[#EF4444]">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-[#6B7280] dark:text-[#A1A1AA]">{hint}</p>}
    </div>
  )
}

export function FollowUpChip({ date }) {
  if (!date) return <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA] italic">No follow-up set</span>
  const d = new Date(date)
  const now = new Date()
  const overdue = d < now
  const days = Math.ceil((d - now) / (1000 * 60 * 60 * 24))
  const soon = !overdue && days <= 7

  if (overdue) return <span className="text-xs font-semibold text-[#EF4444]">Overdue</span>
  if (soon) return <span className="text-xs font-semibold text-[#F59E0B]">Due soon</span>
  return <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Upcoming</span>
}

export function LeadStatusBadge({ status, size }) {
  const meta = LEAD_STATUS_META[status] ?? LEAD_STATUS_META.cold
  const pad  = size === 'lg' ? 'px-4 py-1.5 text-xs' : 'px-2.5 py-1 text-[10px]'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold flex-shrink-0 ${pad}`}
      style={{ color: meta.color, backgroundColor: meta.bg }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  )
}
