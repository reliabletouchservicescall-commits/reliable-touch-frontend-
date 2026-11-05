import { useRef } from 'react'
import {
  ArrowLeft, ArrowRight, ShieldCheck, FileText, Upload, Check, X, Loader2, AlertTriangle, Info,
  Pencil, Phone, Mail, MapPin, Plus, Eye, CircleCheck, ChevronRight, CloudCheck, CloudOff, Home, CalendarDays, UserCog,
} from 'lucide-react'
import { R } from '../../lib/tenantForm'

// Building blocks of the tenant's application page (main applicant and co-applicant), in the
// company's brand colour (the CSS brand variables — see lib/brand.js).

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : '—')
export const initials = (s = '') => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'RT'
export const kb = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
export const errText = (e, fallback) => e?.response?.data?.message ?? fallback

export const inputBase = 'w-full rounded-lg border bg-white px-3 py-2 text-sm text-[#17171A] outline-none transition-[border-color,box-shadow] placeholder:text-[#A1A1AA] focus:border-[#F95C4B] focus:ring-[3px] focus:ring-[#F95C4B]/15'

export function Field({ f, value, onChange, error, issue, idPrefix = 'f' }) {
  const id = `${idPrefix}-${f.key}`
  const bad = Boolean(error || issue)
  const cls = `${inputBase} ${bad ? 'border-[#DC2626]' : 'border-[#D9D9D4] hover:border-[#BDBDB6]'}`
  return (
    <div className={f.half ? 'col-span-2 sm:col-span-1' : 'col-span-2'}>
      <label htmlFor={id} className="mb-1 block text-[13px] font-medium text-[#17171A]">
        {f.label}{!f.required && <span className="ml-1 font-normal text-[#8A8A93]">(optional)</span>}
      </label>
      {f.opts ? (
        <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={cls}>
          <option value="" disabled>Choose…</option>
          {f.opts.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : f.area ? (
        <textarea id={id} rows={2} value={value ?? ''} placeholder={f.ph} onChange={(e) => onChange(e.target.value)} className={`${cls} resize-y`} />
      ) : (
        <input id={id} type={f.type ?? 'text'} value={value ?? ''} placeholder={f.ph} autoComplete={f.ac ?? 'off'}
          inputMode={f.num ? 'numeric' : undefined} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
      {issue ? <p className="mt-1 text-xs font-medium text-[#DC2626]">To fix: {issue.message}</p>
        : error ? <p className="mt-1 text-xs font-medium text-[#DC2626]">{error}</p>
          : f.hint ? <p className="mt-1 text-xs text-[#8A8A93]">{f.hint}</p> : null}
    </div>
  )
}

export function Callout({ icon: Icon = Info, tone = 'brand', children }) {
  const t = tone === 'warn'
    ? 'bg-[#FFF8EB] border-[#F3DDAE] [&>svg]:text-[#B45309]'
    : tone === 'bad' ? 'bg-[#FEF2F2] border-[#FECACA] [&>svg]:text-[#DC2626]'
      : 'bg-[#F95C4B]/[0.06] border-[#F95C4B]/20 [&>svg]:text-[#F95C4B]'
  return (
    <div className={`flex gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] leading-relaxed text-[#3F3F46] ${t}`}>
      <Icon className="mt-0.5 h-4 w-4 flex-none" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function Choice({ active, onClick, icon: Icon, title, sub }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl border bg-white p-4 text-left transition-all ${active ? 'border-[#F95C4B] ring-[3px] ring-[#F95C4B]/15' : 'border-[#E4E4DF] hover:border-[#F95C4B]/50'}`}>
      <span className={`mt-0.5 grid h-[18px] w-[18px] flex-none place-items-center rounded-full border-2 ${active ? 'border-[#F95C4B]' : 'border-[#CFCFC8]'}`}>
        {active && <span className="h-2 w-2 rounded-full bg-[#F95C4B]" />}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold text-[#17171A]"><Icon className="h-4 w-4 text-[#F95C4B]" /> {title}</span>
        <span className="mt-0.5 block text-[13px] text-[#6B6B74]">{sub}</span>
      </span>
    </button>
  )
}

export function Logo({ brand, size = 'h-9 w-9', text = 'text-xs' }) {
  return brand.logoUrl
    ? <img src={brand.logoUrl} alt="" className={`${size} flex-none rounded-lg bg-white object-contain p-0.5 ring-1 ring-black/5`} />
    : <span className={`${size} ${text} grid flex-none place-items-center rounded-lg bg-[#F95C4B] font-bold text-white`}>{initials(brand.name)}</span>
}

export const Panel = ({ className = '', children }) => <div className={`rounded-2xl border border-[#E8E8E3] bg-white ${className}`}>{children}</div>

export function ContactCard({ contact, brand, className = '' }) {
  return (
    <Panel className={`flex items-center gap-3 p-3.5 ${className}`}>
      <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-[#F95C4B]/10 text-xs font-bold text-[#F95C4B]">{initials(contact.name)}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#17171A]">{contact.name}</p>
        <p className="truncate text-xs text-[#8A8A93]">Your contact at {brand.name}</p>
      </div>
      {contact.phone && <a href={`tel:${contact.phone}`} className="grid h-9 w-9 place-items-center rounded-full bg-[#F95C4B] text-white hover:bg-[#E84B3A]" aria-label={`Call ${contact.name}`}><Phone className="h-4 w-4" /></a>}
      {contact.email && <a href={`mailto:${contact.email}`} className="grid h-9 w-9 place-items-center rounded-full bg-[#F4F4F1] text-[#3F3F46] hover:bg-[#EAEAE5]" aria-label={`Email ${contact.name}`}><Mail className="h-4 w-4" /></a>}
    </Panel>
  )
}

export function AboutSheet({ brand, contact, onClose }) {
  const p = brand.profile ?? {}
  const rows = [
    ['Registered name', p.registeredName], ['Company reg.', p.cipcNumber], ['PPRA FFC', p.ffcNumber],
    ['FFC valid until', p.ffcValidUntil ? fmtDate(p.ffcValidUntil) : null], ['VAT', p.vatNumber], ['Principal', p.principal],
  ].filter(([, v]) => v)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={`About ${brand.name}`}>
      <div className="apply-fade absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="apply-sheet relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-[#F7F7F5] p-5 pb-8 sm:max-w-lg sm:rounded-3xl sm:p-6">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D4D4D8] sm:hidden" />
        <div className="flex items-center gap-3">
          <Logo brand={brand} size="h-12 w-12" text="text-sm" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold leading-tight text-[#17171A]">{brand.name}</p>
            {brand.verified && <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-[#15803D]"><ShieldCheck className="h-3.5 w-3.5" /> Registered with the PPRA</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-white text-[#6B6B74] ring-1 ring-black/5 hover:text-[#17171A]"><X className="h-4 w-4" /></button>
        </div>
        {p.description && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[#3F3F46]">{p.description}</p>}
        {rows.length > 0 && (
          <Panel className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 p-4">
            {rows.map(([k, v]) => <div key={k} className="min-w-0"><p className="text-xs text-[#8A8A93]">{k}</p><p className="truncate text-[13px] font-medium text-[#17171A]">{v}</p></div>)}
          </Panel>
        )}
        <Panel className="mt-3 space-y-2 p-4 text-sm text-[#3F3F46]">
          {p.address && <p className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 flex-none text-[#F95C4B]" /> {p.address}</p>}
          {p.officePhone && <a href={`tel:${p.officePhone}`} className="flex gap-2 hover:text-[#17171A]"><Phone className="mt-0.5 h-4 w-4 flex-none text-[#F95C4B]" /> {p.officePhone}</a>}
          {p.email && <a href={`mailto:${p.email}`} className="flex gap-2 break-all hover:text-[#17171A]"><Mail className="mt-0.5 h-4 w-4 flex-none text-[#F95C4B]" /> {p.email}</a>}
          {!p.address && !p.officePhone && !p.email && <p className="text-[#8A8A93]">Your contact person can answer any questions.</p>}
        </Panel>
        {contact && <ContactCard contact={contact} brand={brand} className="mt-3" />}
      </div>
    </div>
  )
}

export function DocSlot({ slot, files, issue, busy, onUpload, onRemove, missing, readOnly }) {
  const input = useRef(null)
  const has = files.length > 0
  return (
    <div className={`rounded-xl border bg-white p-3.5 transition-colors ${issue ? 'border-[#DC2626]' : missing ? 'border-[#DC2626]/60' : has ? 'border-[#15803D]/35' : 'border-[#E4E4DF]'}`}>
      <div className="flex items-start gap-3">
        <div className={`grid h-9 w-9 flex-none place-items-center rounded-lg ${has ? 'bg-[#15803D] text-white' : 'bg-[#F4F4F1] text-[#8A8A93]'}`}>
          {has ? <Check className="h-4 w-4" strokeWidth={3} /> : <FileText className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#17171A]">{slot.label}{!slot.required && <span className="ml-1 font-normal text-[#8A8A93]">(optional)</span>}</p>
          <p className="text-xs leading-snug text-[#8A8A93]">{has ? `${files.length} file${files.length === 1 ? '' : 's'} added` : slot.hint}</p>
        </div>
        {!readOnly && (
          <button type="button" onClick={() => input.current?.click()} disabled={busy}
            className={`inline-flex flex-none items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-60 ${has ? 'border border-[#E4E4DF] bg-white text-[#17171A] hover:bg-[#F7F7F5]' : 'bg-[#F95C4B] text-white hover:bg-[#E84B3A]'}`}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : has ? <Plus className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
            {busy ? 'Uploading…' : has ? 'Add more' : 'Upload'}
          </button>
        )}
        <input ref={input} type="file" multiple accept="image/*,application/pdf" hidden
          onChange={(e) => { if (e.target.files?.length) onUpload(e.target.files); e.target.value = '' }} />
      </div>
      {issue && <p className="mt-2.5 rounded-lg bg-[#FEF2F2] px-2.5 py-1.5 text-xs font-medium text-[#DC2626]">To fix: {issue.message}</p>}
      {missing && !issue && <p className="mt-2 text-xs font-medium text-[#DC2626]">This document is required</p>}
      {has && (
        <ul className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
          {files.map((d) => (
            <li key={d.id} className="flex items-center gap-2.5 rounded-lg bg-[#F7F7F5] px-2.5 py-1.5">
              {d.mimeType?.startsWith('image/') && d.url
                ? <img src={d.url} alt="" className="h-7 w-7 flex-none rounded object-cover" />
                : <span className="grid h-7 w-7 flex-none place-items-center rounded bg-white text-[9px] font-bold text-[#8A8A93]">PDF</span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-[#17171A]">{d.name}</span>
                <span className="block text-[11px] text-[#8A8A93]">{kb(d.size)}</span>
              </span>
              {d.url && <a href={d.url} target="_blank" rel="noreferrer" aria-label={`View ${d.name}`} className="grid h-7 w-7 place-items-center rounded-md text-[#8A8A93] hover:bg-white hover:text-[#17171A]"><Eye className="h-3.5 w-3.5" /></a>}
              {!readOnly && <button type="button" onClick={() => onRemove(d)} aria-label={`Remove ${d.name}`} className="grid h-7 w-7 place-items-center rounded-md text-[#8A8A93] hover:bg-white hover:text-[#DC2626]"><X className="h-3.5 w-3.5" /></button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function PropertyCard({ prop, compact, share }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E8E8E3] bg-white">
      <div className={`relative flex flex-col justify-end overflow-hidden text-white ${compact ? 'h-24 p-3.5' : 'h-36 p-5'}`}
        style={{ background: 'linear-gradient(135deg, rgb(var(--brand-hover-rgb)), rgb(var(--brand-light-rgb)))' }}>
        <div className="absolute -right-6 top-3 h-24 w-40 -skew-y-6 rounded-md opacity-50" style={{ background: 'repeating-linear-gradient(90deg, rgba(255,255,255,.28) 0 16px, transparent 16px 24px)' }} />
        <p className="relative text-[11px] font-medium uppercase tracking-wider opacity-90">{prop.kindLabel ?? 'To rent'}</p>
        <p className={`relative font-semibold leading-snug ${compact ? 'text-sm' : 'text-lg'}`}>{prop.address}</p>
      </div>
      <div className="grid grid-cols-2 divide-x divide-[#EFEFEA]">
        <div className="px-4 py-3">
          <p className="flex items-center gap-1 text-xs text-[#8A8A93]"><Home className="h-3 w-3" /> {share ? 'Your share' : 'Rent'}</p>
          <p className="text-sm font-semibold text-[#17171A]">{share ? `${R(share.amount)} / month` : prop.rent ? `${R(prop.rent)} / month` : 'Ask your agent'}</p>
          {share && <p className="text-[11px] text-[#8A8A93]">{share.pct}% of {R(prop.rent)}</p>}
        </div>
        <div className="px-4 py-3"><p className="flex items-center gap-1 text-xs text-[#8A8A93]"><CalendarDays className="h-3 w-3" /> Available</p><p className="truncate text-sm font-semibold text-[#17171A]">{prop.availability || 'Now'}</p></div>
      </div>
    </div>
  )
}

export function Stepper({ labels, current, furthest, onGo, done }) {
  return (
    <ol className="space-y-0.5">
      {labels.map((label, i) => {
        const n = i + 1
        const isDone = done || n < current || (n <= furthest && n !== current)
        const isCur = !done && n === current
        const can = !done && n <= Math.max(furthest, current)
        return (
          <li key={label}>
            <button type="button" disabled={!can} onClick={() => onGo(n)}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${isCur ? 'bg-[#F95C4B]/[0.08] font-semibold text-[#17171A]' : can ? 'text-[#3F3F46] hover:bg-[#F4F4F1]' : 'text-[#A1A1AA]'}`}>
              <span className={`grid h-6 w-6 flex-none place-items-center rounded-full text-[11px] font-semibold ${isCur ? 'bg-[#F95C4B] text-white' : isDone ? 'bg-[#15803D] text-white' : 'border border-[#D9D9D4] text-[#A1A1AA]'}`}>
                {isDone && !isCur ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
              </span>
              {label}
            </button>
          </li>
        )
      })}
    </ol>
  )
}

export function SumCard({ title, onEdit, rows }) {
  return (
    <div className="rounded-xl border border-[#E8E8E3]">
      <div className="flex items-center justify-between border-b border-[#EFEFEA] px-4 py-2.5">
        <p className="text-[13px] font-semibold text-[#17171A]">{title}</p>
        {onEdit && <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 text-xs font-medium text-[#F95C4B] hover:underline"><Pencil className="h-3 w-3" /> Edit</button>}
      </div>
      <dl className="divide-y divide-[#F2F2EE]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 px-4 py-2 text-[13px]">
            <dt className="text-[#8A8A93]">{k}</dt>
            <dd className="min-w-0 text-right font-medium text-[#17171A] [overflow-wrap:anywhere]">{v || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function primaryBtn(label, onClick, { icon: Icon = ArrowRight, busy = false, iconFirst = false, disabled = false } = {}) {
  return (
    <button type="button" onClick={onClick} disabled={busy || disabled}
      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#F95C4B] px-5 text-sm font-semibold text-white shadow-[0_6px_16px_-8px_rgb(var(--brand-rgb)/0.8)] transition-[background-color,transform] hover:bg-[#E84B3A] active:scale-[0.98] disabled:opacity-60 sm:flex-none">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : iconFirst && <Icon className="h-4 w-4" />}
      {label}
      {!busy && !iconFirst && <Icon className="h-4 w-4" />}
    </button>
  )
}

export function backBtn(onClick) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#E4E4DF] bg-white px-4 text-sm font-medium text-[#3F3F46] hover:bg-[#F7F7F5]">
      <ArrowLeft className="h-4 w-4" /> Back
    </button>
  )
}

function SaveState({ state, small }) {
  const c = small ? 'h-3 w-3' : 'h-3.5 w-3.5'
  return state === 'saving' ? <><Loader2 className={`${c} animate-spin`} /> Saving…</>
    : state === 'offline' || state === 'error' ? <><CloudOff className={c} /> Saved on this device — sends when you're back online</>
      : <><CloudCheck className={`${c} text-[#15803D]`} /> All changes saved</>
}

// The whole page: brand bar, a side column on laptops (property, steps, company, contact) and
// the step card; on a phone one column with the actions pinned to the bottom.
export function ApplyLayout({
  brand, prop, contact, share, labels, step, furthest, onGo, finished, closed, saveState, showSave, onAbout,
  banner, notice, title, sub, body, actions, footNote, stepsTitle = 'Your application', subtitle = 'Tenant application',
}) {
  const total = labels.length
  const pct = finished ? 100 : Math.round((Math.min(step, total) / (total + 1)) * 100)
  return (
    <div className="min-h-[100svh] bg-[#F7F7F5] text-[#17171A]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <header className="sticky top-0 z-30 border-b border-[#E8E8E3] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={onAbout} className="flex min-w-0 items-center gap-2.5 text-left">
            <Logo brand={brand} />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-[#17171A]">
                {brand.name}
                {brand.verified && <span className="inline-flex flex-none items-center gap-0.5 rounded-full bg-[#15803D]/10 px-1.5 py-px text-[10px] font-semibold text-[#15803D]"><ShieldCheck className="h-3 w-3" /> Verified</span>}
              </span>
              <span className="block truncate text-xs text-[#8A8A93]">{brand.profile?.ffcNumber ? `PPRA FFC ${brand.profile.ffcNumber}` : subtitle}</span>
            </span>
          </button>
          <span className="flex-1" />
          {showSave && <span className="hidden items-center gap-1.5 text-xs text-[#8A8A93] sm:flex"><SaveState state={saveState} /></span>}
          <button type="button" onClick={onAbout} className="hidden h-9 items-center gap-1.5 rounded-lg border border-[#E4E4DF] px-3 text-[13px] font-medium text-[#3F3F46] hover:bg-[#F7F7F5] md:inline-flex">
            <Info className="h-4 w-4" /> About us
          </button>
          {contact?.phone && (
            <a href={`tel:${contact.phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#F95C4B]/10 px-3 text-[13px] font-medium text-[#F95C4B] hover:bg-[#F95C4B]/15">
              <Phone className="h-4 w-4" /><span className="hidden sm:inline">Call {contact.name.split(' ')[0]}</span>
            </a>
          )}
        </div>
        {!closed && <div className="h-[3px] bg-[#EFEFEA]"><div className="h-full bg-[#F95C4B] transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} /></div>}
      </header>

      {banner}

      <div className="mx-auto max-w-[1600px] px-4 pb-28 pt-5 sm:px-6 sm:pb-12 lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-8 lg:px-8 lg:pt-8 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <PropertyCard prop={prop} share={share} />
            {!closed && (
              <Panel className="p-3">
                <p className="px-2.5 pb-2 pt-1 text-xs font-medium uppercase tracking-wider text-[#8A8A93]">{stepsTitle}</p>
                <Stepper labels={labels} current={step} furthest={furthest} onGo={onGo} done={finished} />
              </Panel>
            )}
            <Panel className="p-4">
              <div className="flex items-center gap-3">
                <Logo brand={brand} size="h-10 w-10" />
                <div className="min-w-0"><p className="text-xs text-[#8A8A93]">Listed by</p><p className="truncate text-sm font-semibold text-[#17171A]">{brand.name}</p></div>
              </div>
              {brand.profile?.description && <p className="mt-3 line-clamp-4 text-[13px] leading-relaxed text-[#6B6B74]">{brand.profile.description}</p>}
              <button type="button" onClick={onAbout} className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-[#F95C4B] hover:underline">About {brand.name} <ChevronRight className="h-3.5 w-3.5" /></button>
            </Panel>
            {contact && <ContactCard contact={contact} brand={brand} />}
          </div>
        </aside>

        <main className="min-w-0">
          {!closed && step > 0 && !finished && (
            <div className="mb-4 flex items-center justify-between text-xs text-[#8A8A93] lg:hidden">
              <span className="font-medium text-[#3F3F46]">{labels[step - 1]}</span>
              <span>Step {step} of {total}</span>
            </div>
          )}
          {notice}
          <Panel className="overflow-hidden">
            <div key={step} className="apply-step p-5 sm:p-8">
              {!closed && step > 0 && !finished && <p className="mb-1 hidden text-xs font-medium uppercase tracking-wider text-[#F95C4B] lg:block">Step {step} of {total}</p>}
              <h1 className="text-xl font-semibold tracking-tight text-[#17171A] sm:text-2xl">{title}</h1>
              {sub && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#6B6B74]">{sub}</p>}
              <div className="mt-6">{body}</div>
            </div>
            {actions && (
              <div className="hidden items-center justify-between gap-3 border-t border-[#EFEFEA] bg-[#FBFBF9] px-8 py-4 sm:flex">
                <span className="text-xs text-[#8A8A93]">{footNote}</span>
                <div className="flex gap-2">{actions}</div>
              </div>
            )}
          </Panel>
          {finished && contact && <ContactCard contact={contact} brand={brand} className="mt-4 lg:hidden" />}
          <p className="mt-6 text-center text-xs text-[#A1A1AA]">Powered by Reliable Touch Service</p>
        </main>
      </div>

      {actions && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E8E8E3] bg-white/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:hidden">
          <div className="flex gap-2">{actions}</div>
          {showSave && <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] text-[#8A8A93]"><SaveState state={saveState} small /></p>}
        </div>
      )}
    </div>
  )
}

// "You're filling this in for X" / "Preview" — for a team member on the tenant's link
export function TeamBanner({ mode, staffName, tenantName }) {
  if (!mode) return null
  return (
    <div className={`border-b ${mode === 'assist' ? 'border-[#F59E0B]/30 bg-[#FFFBEB]' : 'border-[#3B82F6]/25 bg-[#EFF6FF]'}`}>
      <div className="mx-auto flex max-w-[1600px] items-center gap-2.5 px-4 py-2.5 text-[13px] sm:px-6 lg:px-8">
        <UserCog className={`h-4 w-4 flex-none ${mode === 'assist' ? 'text-[#B45309]' : 'text-[#1D4ED8]'}`} />
        <span className="text-[#3F3F46]">
          {mode === 'assist'
            ? <>You're filling this in <b>for {tenantName}</b> as <b>{staffName}</b>. Everything you change is recorded in your name.</>
            : <>Preview — this is exactly what {tenantName} sees. Nothing you do here is saved or counted.</>}
        </span>
      </div>
    </div>
  )
}

export function IssuesBox({ brand, issues, onFix }) {
  if (!issues.length) return null
  return (
    <div className="mb-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#B91C1C]"><AlertTriangle className="h-4 w-4" /> {brand.name} asked you to fix {issues.length} thing{issues.length === 1 ? '' : 's'}</p>
      <ul className="mt-2 space-y-1.5">
        {issues.map((i) => (
          <li key={i.id} className="flex items-start gap-2 text-[13px] text-[#3F3F46]">
            <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-[#DC2626]" />
            <span className="min-w-0 flex-1"><b className="font-semibold text-[#17171A]">{i.label}</b> — {i.message}</span>
            {i.to != null && <button type="button" onClick={() => onFix(i.to)} className="flex-none text-[13px] font-medium text-[#DC2626] underline underline-offset-2">Fix this</button>}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className={`apply-pop fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-[13px] font-medium text-white shadow-xl sm:bottom-8 ${toast.tone === 'bad' ? 'bg-[#DC2626]' : 'bg-[#17171A]'}`}>
      <span className="inline-flex items-center gap-1.5">{toast.tone === 'bad' ? <AlertTriangle className="h-4 w-4" /> : <CircleCheck className="h-4 w-4" />}{toast.msg}</span>
    </div>
  )
}


