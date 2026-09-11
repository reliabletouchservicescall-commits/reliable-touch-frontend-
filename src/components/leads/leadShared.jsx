import { useState, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Sparkles, ThermometerSnowflake, ThermometerSun, Flame, Home, Key, MapPin, AlertTriangle, Plus, Loader2, X, Search, ChevronDown } from 'lucide-react'
import { areasApi } from '../../services/areasApi'
import { contactsApi } from '../../services/contactsApi'

function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export const LEAD_STATUS_META = {
  cold:       { label: 'Cold',       color: '#6B7280', bg: '#6B728018' },
  warm:       { label: 'Warm',       color: '#F59E0B', bg: '#F59E0B18' },
  hot:        { label: 'Hot',        color: '#EF4444', bg: '#EF444418' },
  listed:     { label: 'Listed',     color: '#8B5CF6', bg: '#8B5CF618' },
  rented_out: { label: 'Rented Out', color: '#10B981', bg: '#10B98118' },
  sold:       { label: 'Sold',       color: '#F95C4B', bg: '#F95C4B18' },
  lost:       { label: 'Lost',       color: '#9CA3AF', bg: '#9CA3AF18' },
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

/**
 * The backend's validate.middleware.js responds to a failed field validation with
 * {message: 'Validation failed', errors: ['specific reason', ...]} — the top-level
 * message alone tells the user nothing actionable, so prefer the specific per-field
 * reasons whenever the backend sent any.
 */
export function getApiErrorMessage(err, fallback = 'Something went wrong') {
  const data = err?.response?.data
  if (Array.isArray(data?.errors) && data.errors.length) {
    return data.errors.join(' · ')
  }
  return data?.message ?? fallback
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

/** Listing Type + Price Range fields — optional on every lead, shared by every create/edit form. */
export function ListingFields({ form, setField, errors }) {
  return (
    <div className="space-y-4">
      <Field label="Listing Type" error={errors.listingType}>
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
        <Field label="Min Price (R)" error={errors.priceMin}>
          <input
            type="number" min="0" placeholder="e.g. 9500"
            value={form.priceMin}
            onChange={(e) => setField('priceMin', e.target.value)}
            className={inputCls(errors.priceMin)}
          />
        </Field>
        <Field label="Max Price (R)" error={errors.priceMax}>
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
 * Searchable area picker — a plain `<select>` gets unwieldy once there are more than a
 * handful of areas, so this opens a small popover with a search box on top and a
 * filtered, scrollable list below. Same value/onChange shape as a native select
 * (area ID in, area ID out) so it drops straight into PropertyFromContact.
 */
function SearchableAreaSelect({ areas, value, onChange, placeholder = 'Select area…' }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const list = areas ?? []
  const selected = list.find((a) => a._id === value)
  const q = search.trim().toLowerCase()
  const filtered = q
    ? list.filter((a) => a.name.toLowerCase().includes(q) || (a.region ?? '').toLowerCase().includes(q))
    : list

  return (
    <div className="relative flex-1" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${inputCls(false)} flex items-center justify-between gap-2 text-left`}
      >
        <span className={`truncate ${selected ? 'text-[#111111] dark:text-white' : 'text-[#6B7280]/50 dark:text-[#A1A1AA]/40'}`}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#6B7280] dark:text-[#A1A1AA] flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-full bg-white dark:bg-[#181818] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-xl overflow-hidden">
          <div className="relative p-2 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280] dark:text-[#A1A1AA] pointer-events-none" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search area…"
              className="w-full pl-8 pr-2 py-2 text-sm bg-[#F5F5F4] dark:bg-[#202020] rounded-lg outline-none ring-2 ring-transparent focus:ring-[#8B5CF6]/20 text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 dark:placeholder:text-[#A1A1AA]/40"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-4 text-xs text-[#6B7280] dark:text-[#A1A1AA] text-center">
                No areas match "{search}"
              </p>
            ) : (
              filtered.map((a) => (
                <button
                  key={a._id}
                  type="button"
                  onClick={() => { onChange(a._id); setOpen(false); setSearch('') }}
                  className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-left transition-colors ${
                    value === a._id
                      ? 'bg-[#8B5CF6]/8 text-[#8B5CF6] font-semibold'
                      : 'text-[#111111] dark:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#202020]'
                  }`}
                >
                  <span className="truncate">{a.name}</span>
                  {a.region && <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] flex-shrink-0">{a.region}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Searchable, server-backed contact picker for the "which contact is this lead for?"
 * field. Unlike SearchableAreaSelect, this never pre-fetches the whole list — a
 * caller/admin's contacts can run into the thousands — it searches the backend as you
 * type (debounced) and resolves the current `value`'s label with its own lookup, so it
 * still displays the right name even when that contact isn't in the latest search
 * results (e.g. right after opening an existing lead to edit it).
 */
export function SearchableContactSelect({ value, onChange, placeholder = 'Select contact…' }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Independent of the search results below — guarantees the trigger button shows the
  // right name even if the selected contact has scrolled out of / never been in view.
  const { data: selectedContact } = useQuery({
    queryKey: ['contact-select-value', value],
    queryFn: () => contactsApi.getById(value).then((r) => r.data.data.contact),
    enabled: Boolean(value),
    staleTime: 60_000,
  })

  // view: 'all' — for a cold caller this bypasses the "already called today" exclusion
  // (a caller must be able to find any of their contacts here); a no-op for admin, who
  // already sees everything.
  const { data: results, isFetching } = useQuery({
    queryKey: ['contacts-search', debounced],
    queryFn: () => contactsApi.list({ search: debounced || undefined, limit: 20, view: 'all' }).then((r) => r.data.data.contacts),
    enabled: open,
    staleTime: 15_000,
  })

  const list = results ?? []

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${inputCls(false)} flex items-center justify-between gap-2 text-left`}
      >
        <span className={`truncate ${selectedContact ? 'text-[#111111] dark:text-white' : 'text-[#6B7280]/50 dark:text-[#A1A1AA]/40'}`}>
          {selectedContact ? `${selectedContact.name} (${selectedContact.phone})` : placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#6B7280] dark:text-[#A1A1AA] flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-full bg-white dark:bg-[#181818] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-xl overflow-hidden">
          <div className="relative p-2 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280] dark:text-[#A1A1AA] pointer-events-none" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone…"
              className="w-full pl-8 pr-2 py-2 text-sm bg-[#F5F5F4] dark:bg-[#202020] rounded-lg outline-none ring-2 ring-transparent focus:ring-[#F95C4B]/20 text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 dark:placeholder:text-[#A1A1AA]/40"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {isFetching ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-[#F95C4B]" />
              </div>
            ) : list.length === 0 ? (
              <p className="px-4 py-4 text-xs text-[#6B7280] dark:text-[#A1A1AA] text-center">
                {search ? `No contacts match "${search}"` : 'No contacts found'}
              </p>
            ) : (
              list.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => { onChange(c._id); setOpen(false); setSearch('') }}
                  className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-left transition-colors ${
                    value === c._id
                      ? 'bg-[#F95C4B]/8 text-[#F95C4B] font-semibold'
                      : 'text-[#111111] dark:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#202020]'
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] font-mono flex-shrink-0">{c.phone}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Compact inline "create a new area" card — shown when the area someone needs isn't in
 * the dropdown yet. Creates it via the API, refreshes the shared `['areas-select']`
 * query (used by every page that lists areas for a picker) so it shows up everywhere
 * immediately, and selects it on the calling form via `onCreated`.
 */
function AddAreaInline({ onCreated, onCancel }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [region, setRegion] = useState('')

  const mut = useMutation({
    mutationFn: () => areasApi.create({ name: name.trim(), region: region.trim() || undefined }),
    onSuccess: (res) => {
      const area = res.data.data.area
      qc.invalidateQueries({ queryKey: ['areas-select'] })
      toast.success(`"${area.name}" added`)
      onCreated(area)
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to add area'),
  })

  function handleSave() {
    if (!name.trim()) { toast.error('Enter an area name'); return }
    mut.mutate()
  }

  return (
    <div className="col-span-2 rounded-xl border border-[#8B5CF6]/30 bg-white dark:bg-[#181818] p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8B5CF6]">New Area</p>
        <button type="button" onClick={onCancel} className="text-[#6B7280] hover:text-[#111111] dark:hover:text-white">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Area name*"
          className={inputCls(false)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave() } }}
        />
        <input
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          placeholder="Region (optional)"
          className={inputCls(false)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave() } }}
        />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2 rounded-lg text-xs font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
          Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={mut.isPending}
          className="flex-1 py-2 rounded-lg text-xs font-semibold text-white bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-60 flex items-center justify-center gap-1.5">
          {mut.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Add Area
        </button>
      </div>
    </div>
  )
}

/**
 * Property summary sourced from the linked contact — address, area, and sectional
 * scheme are never re-entered on a lead, they always mirror the contact. Shown
 * wherever a lead is created or displayed. If the contact is missing an address or
 * area, this lets it be filled in right here (saved onto the CONTACT, not the lead,
 * when the parent form submits) instead of just blocking with a dead-end warning —
 * pass `areas` + `pendingAddress`/`pendingArea` + `onAddressChange`/`onAreaChange`
 * to enable this; omit them to fall back to the old read-only warning. When the area
 * someone needs isn't in `areas` yet, a "+ Add new area" affordance lets them create
 * one on the spot (see AddAreaInline) instead of having to leave the flow.
 */
export function PropertyFromContact({ contact, loading, areas, pendingAddress, pendingArea, onAddressChange, onAreaChange }) {
  const [addingArea, setAddingArea] = useState(false)
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
  const editable = Boolean(onAddressChange || onAreaChange)
  const stillMissingAddress = missingAddress && !pendingAddress
  const stillMissingArea = missingArea && !pendingArea

  return (
    <div className="rounded-xl border border-[#8B5CF6]/20 bg-[#8B5CF6]/5 dark:bg-[#8B5CF6]/8 p-4 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8B5CF6] flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5" /> Property (from Contact)
      </p>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        <div className="col-span-2">
          <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] font-semibold uppercase tracking-widest">Address</p>
          {!missingAddress ? (
            <p className="text-sm font-bold text-[#111111] dark:text-white">{contact.address}</p>
          ) : onAddressChange ? (
            <input
              value={pendingAddress ?? ''}
              onChange={(e) => onAddressChange(e.target.value)}
              placeholder="Enter the property address"
              className={inputCls(false) + ' mt-1'}
            />
          ) : (
            <p className="text-sm font-semibold text-[#EF4444]">Not set on this contact</p>
          )}
        </div>
        <div>
          <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] font-semibold uppercase tracking-widest">Area</p>
          {!missingArea ? (
            <p className="text-sm font-bold text-[#111111] dark:text-white">{area.name}</p>
          ) : onAreaChange ? (
            <div className="flex items-center gap-1.5 mt-1">
              <SearchableAreaSelect areas={areas} value={pendingArea} onChange={onAreaChange} />
              <button
                type="button"
                onClick={() => setAddingArea(true)}
                title="Add a new area"
                className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-[#8B5CF6]/10 text-[#8B5CF6] hover:bg-[#8B5CF6]/20 transition-colors"
              >
                <Plus className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          ) : (
            <p className="text-sm font-semibold text-[#EF4444]">Not set</p>
          )}
        </div>
        {addingArea && onAreaChange && (
          <AddAreaInline
            onCreated={(newArea) => { onAreaChange(newArea._id); setAddingArea(false) }}
            onCancel={() => setAddingArea(false)}
          />
        )}
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

      {(stillMissingAddress || stillMissingArea) && (
        <div className="flex items-start gap-2 pt-2.5 border-t border-[#8B5CF6]/15">
          <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444] flex-shrink-0 mt-0.5" strokeWidth={1.75} />
          <p className="text-xs text-[#EF4444] leading-relaxed">
            This contact is missing {stillMissingAddress && stillMissingArea ? 'an address and area' : stillMissingAddress ? 'an address' : 'an area'}.
            {editable ? ' Fill it in above — it\'ll be saved to the contact when you create the lead.' : ' Update the contact before creating a lead.'}
          </p>
        </div>
      )}
      {editable && (missingAddress || missingArea) && !stillMissingAddress && !stillMissingArea && (
        <div className="flex items-start gap-2 pt-2.5 border-t border-[#8B5CF6]/15">
          <MapPin className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0 mt-0.5" strokeWidth={1.75} />
          <p className="text-xs text-[#10B981] leading-relaxed">
            Ready — this will be saved to the contact when you create the lead.
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
