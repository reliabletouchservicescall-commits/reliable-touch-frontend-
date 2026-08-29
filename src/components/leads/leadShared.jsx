import { Sparkles, ThermometerSnowflake, ThermometerSun, Flame, Home, Key, MapPin, AlertTriangle } from 'lucide-react'

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

export const LISTING_TYPE_META = {
  sale:   { label: 'For Sale',   icon: Home, color: '#8B5CF6' },
  rental: { label: 'For Rental', icon: Key,  color: '#3B82F6' },
}

export function formatZAR(n) {
  if (n == null || n === '') return null
  return `R ${Number(n).toLocaleString('en-ZA')}`
}

export function ListingBadge({ listingType, priceMin, priceMax, size }) {
  if (!listingType) return null
  const meta = LISTING_TYPE_META[listingType] ?? { label: listingType, icon: Home, color: '#6B7280' }
  const Icon = meta.icon
  const pad = size === 'lg' ? 'px-3 py-1.5 text-xs' : 'px-2.5 py-1 text-[10px]'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold flex-shrink-0 ${pad}`}
      style={{ color: meta.color, backgroundColor: `${meta.color}18` }}
    >
      <Icon className="w-3 h-3 flex-shrink-0" strokeWidth={2} />
      {meta.label}
      {(priceMin != null || priceMax != null) && (
        <span className="opacity-80">· {formatZAR(priceMin)}–{formatZAR(priceMax)?.replace('R ', '')}</span>
      )}
    </span>
  )
}

/** Listing Type + Price Range fields — required on every lead, shared by every create/edit form. */
export function ListingFields({ form, setField, errors }) {
  return (
    <div className="space-y-4">
      <Field label="Listing Type" required error={errors.listingType}>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(LISTING_TYPE_META).map(([value, meta]) => {
            const Icon = meta.icon
            const active = form.listingType === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setField('listingType', value)}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                  active ? 'border-current' : 'border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#D1D5DB] dark:hover:border-[#3A3A3A] bg-white dark:bg-[#202020] text-[#111111] dark:text-white'
                }`}
                style={active ? { color: meta.color, backgroundColor: `${meta.color}12`, borderColor: meta.color } : {}}
              >
                <Icon className="w-4 h-4" strokeWidth={1.75} />
                {meta.label}
              </button>
            )
          })}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Min Price (R)" required error={errors.priceMin}>
          <input
            type="number" min="0" placeholder="e.g. 9500"
            value={form.priceMin}
            onChange={(e) => setField('priceMin', e.target.value)}
            className={inputCls(errors.priceMin)}
          />
        </Field>
        <Field label="Max Price (R)" required error={errors.priceMax}>
          <input
            type="number" min="0" placeholder="e.g. 11000"
            value={form.priceMax}
            onChange={(e) => setField('priceMax', e.target.value)}
            className={inputCls(errors.priceMax)}
          />
        </Field>
      </div>
    </div>
  )
}

/**
 * Read-only property summary sourced from the linked contact — address, area, and
 * sectional scheme are never re-entered on a lead, they always mirror the contact.
 * Shown wherever a lead is created or displayed. If the contact is missing either
 * field, this surfaces a clear warning instead of a blank/silent gap.
 */
export function PropertyFromContact({ contact, loading }) {
  if (loading) {
    return <div className="h-24 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] animate-pulse" />
  }
  if (!contact) {
    return (
      <div className="rounded-xl border border-dashed border-[#E5E7EB] dark:border-[#2A2A2A] p-4 text-center">
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Select a contact to see property details</p>
      </div>
    )
  }

  const area = (contact.area && typeof contact.area === 'object') ? contact.area : null
  const missingAddress = !contact.address
  const missingArea = !area

  return (
    <div className="rounded-xl border border-[#8B5CF6]/20 bg-[#8B5CF6]/5 dark:bg-[#8B5CF6]/8 p-4 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8B5CF6] flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5" /> Property (from Contact)
      </p>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        <div className="col-span-2">
          <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] font-semibold uppercase tracking-widest">Address</p>
          {missingAddress ? (
            <p className="text-sm font-semibold text-[#EF4444]">Not set on this contact</p>
          ) : (
            <p className="text-sm font-bold text-[#111111] dark:text-white">{contact.address}</p>
          )}
        </div>
        <div>
          <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] font-semibold uppercase tracking-widest">Area</p>
          {missingArea ? (
            <p className="text-sm font-semibold text-[#EF4444]">Not set</p>
          ) : (
            <p className="text-sm font-bold text-[#111111] dark:text-white">{area.name}</p>
          )}
        </div>
        {contact.sectionalScheme && (
          <div>
            <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] font-semibold uppercase tracking-widest">Scheme</p>
            <p className="text-sm font-bold text-[#111111] dark:text-white">{contact.sectionalScheme}</p>
          </div>
        )}
        {contact.unitNumber && (
          <div>
            <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] font-semibold uppercase tracking-widest">Unit</p>
            <p className="text-sm font-bold text-[#111111] dark:text-white">#{contact.unitNumber}</p>
          </div>
        )}
        {contact.sizeInSqm != null && (
          <div>
            <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] font-semibold uppercase tracking-widest">Size</p>
            <p className="text-sm font-bold text-[#111111] dark:text-white">{contact.sizeInSqm} m²</p>
          </div>
        )}
      </div>

      {(missingAddress || missingArea) && (
        <div className="flex items-start gap-2 pt-2.5 border-t border-[#8B5CF6]/15">
          <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444] flex-shrink-0 mt-0.5" strokeWidth={1.75} />
          <p className="text-xs text-[#EF4444] leading-relaxed">
            This contact is missing {missingAddress && missingArea ? 'an address and area' : missingAddress ? 'an address' : 'an area'}.
            Update the contact before creating a lead.
          </p>
        </div>
      )}
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
