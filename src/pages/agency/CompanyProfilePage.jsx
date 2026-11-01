import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Building2, Upload, Trash2, Loader2, Check, Palette, Wand2, ShieldCheck, LayoutDashboard,
  TrendingUp, Handshake, Users, Lock, ImagePlus, Pipette,
} from 'lucide-react'
import rtLogo from '../../assets/logo-reliable-touch.png'
import { agenciesApi } from '../../services/agenciesApi'
import { useAgencyBrand, AGENCY_PROFILE_KEY } from '../../lib/useAgencyBrand'
import { BRAND_PRESETS, RT_BRAND, applyBrand, paletteFromImage, readableBrand } from '../../lib/brand'
import { getApiErrorMessage } from '../../components/leads/leadShared'

const FIELDS = [
  { key: 'registeredName', label: 'Registered company name', placeholder: 'Libertalia Group (Pty) Ltd' },
  { key: 'cipcNumber', label: 'CIPC registration number', placeholder: '2019/123456/07' },
  { key: 'ffcNumber', label: 'PPRA Fidelity Fund Certificate (FFC) no.', placeholder: '202612345678' },
  { key: 'ffcValidUntil', label: 'FFC valid until', type: 'date' },
  { key: 'vatNumber', label: 'VAT number', placeholder: '4123456789' },
  { key: 'principal', label: 'Principal property practitioner', placeholder: 'N. Mahlangu' },
  { key: 'officePhone', label: 'Office phone', placeholder: '011 000 0000' },
  { key: 'documentsEmail', label: 'Email for documents', placeholder: 'rentals@yourcompany.co.za', type: 'email' },
  { key: 'address', label: 'Physical address', placeholder: '2nd Floor, 140 West Street, Sandton, 2196', wide: true },
  { key: 'description', label: 'About your company', placeholder: 'A few lines landlords and tenants see on your links — what you do, where you work, why people choose you.', wide: true, area: true },
]

const MAX_LOGO = 2 * 1024 * 1024
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

const initialsOf = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'CO'

const inputCls = 'w-full px-3.5 py-2.5 rounded-xl text-sm bg-white dark:bg-[#121212] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#9CA3AF] outline-none focus:border-[#F95C4B] focus:ring-4 focus:ring-[#F95C4B]/10 transition-all disabled:opacity-60'

function formOf(agency) {
  const p = agency?.profile ?? {}
  return Object.fromEntries(FIELDS.map(({ key }) => [key, key === 'ffcValidUntil' ? (p[key] ? String(p[key]).slice(0, 10) : '') : (p[key] ?? '')]))
}

function Section({ icon: Icon, title, sub, children, right }) {
  return (
    <section className="rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">
            <Icon className="w-4 h-4 text-[#F95C4B]" /> {title}
          </h2>
          {sub && <p className="mt-1.5 text-sm text-[#6B7280] dark:text-[#A1A1AA] leading-relaxed">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}

function Swatch({ color, active, onClick, title }) {
  return (
    <button type="button" onClick={onClick} title={title ?? color} aria-label={`Use ${color}`}
      className={`relative w-9 h-9 rounded-full transition-transform hover:scale-110 active:scale-95 ${active ? 'ring-2 ring-offset-2 ring-[#111111] dark:ring-white ring-offset-white dark:ring-offset-[#181818]' : ''}`}
      style={{ backgroundColor: color }}>
      {active && <Check className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow" strokeWidth={3} />}
    </button>
  )
}

// What the company's people will see — the sidebar, in this logo and colour
function LivePreview({ name, logoUrl, color }) {
  const brand = readableBrand(color ?? RT_BRAND)
  const items = [[LayoutDashboard, 'Dashboard'], [TrendingUp, 'Leads'], [Handshake, 'Deal Tracker'], [Users, 'Team']]
  return (
    <div className="rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-[#FAFAF9] dark:bg-[#0F0F0F] overflow-hidden">
      <div className="flex">
        <div className="w-[190px] bg-white dark:bg-[#181818] border-r border-[#E5E7EB] dark:border-[#2A2A2A] flex flex-col">
          <div className="flex items-center gap-2 px-3 py-3.5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
            {logoUrl
              ? <img src={logoUrl} alt="" className="w-7 h-7 rounded-lg object-contain bg-white" />
              : <span className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: brand }}>{initialsOf(name)}</span>}
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-[#111111] dark:text-white truncate">{name}</p>
              <p className="text-[7px] uppercase tracking-widest font-semibold" style={{ color: brand }}>Agency Portal</p>
            </div>
          </div>
          <div className="p-2 space-y-0.5 flex-1">
            {items.map(([I, l], n) => (
              <div key={l} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-medium"
                style={n === 1 ? { backgroundColor: `${brand}1A`, color: brand } : { color: '#6B7280' }}>
                <I className="w-3 h-3" /> {l}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-1 px-2 py-2 border-t border-[#E5E7EB] dark:border-[#2A2A2A] text-[7px] text-[#9CA3AF]">
            <img src={rtLogo} alt="" className="w-2.5 h-2.5 object-contain" /> Powered by Reliable Touch Service
          </div>
        </div>
        <div className="flex-1 p-3 space-y-2 min-w-0">
          <div className="h-2.5 w-20 rounded bg-[#E5E7EB] dark:bg-[#2A2A2A]" />
          <div className="grid grid-cols-2 gap-2">
            {[0, 1].map((n) => <div key={n} className="h-10 rounded-lg bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A]" />)}
          </div>
          <div className="inline-flex px-2.5 py-1 rounded-md text-[9px] font-semibold text-white" style={{ backgroundColor: brand }}>New Lead</div>
          <div className="h-1.5 rounded-full bg-[#E5E7EB] dark:bg-[#2A2A2A] overflow-hidden"><div className="h-full w-2/3 rounded-full" style={{ backgroundColor: brand }} /></div>
        </div>
      </div>
    </div>
  )
}

export default function CompanyProfilePage() {
  const qc = useQueryClient()
  const { agency, isLoading } = useAgencyBrand()
  const fileRef = useRef(null)
  const [form, setForm] = useState(null)
  const [color, setColor] = useState(null)
  const [logoColors, setLogoColors] = useState([])
  const [preview, setPreview] = useState(null) // local logo before the upload finishes
  const [dragging, setDragging] = useState(false)
  const canEdit = Boolean(agency?.canEdit)
  const savedColor = agency?.branding?.primaryColor ?? null

  useEffect(() => {
    if (!agency || form) return
    setForm(formOf(agency))
    setColor(savedColor)
  }, [agency, form, savedColor])

  // Picking a colour previews it across the whole app at once; leaving without saving puts
  // the saved one back
  useEffect(() => { if (color !== null || savedColor !== null) applyBrand(color) }, [color, savedColor])
  useEffect(() => () => applyBrand(qc.getQueryData(AGENCY_PROFILE_KEY)?.branding?.primaryColor), [qc])

  const setAgency = (a) => qc.setQueryData(AGENCY_PROFILE_KEY, a)

  const logoMut = useMutation({
    mutationFn: ({ file, primaryColor }) => agenciesApi.uploadLogo(agency._id, file, primaryColor).then((r) => r.data.data.agency),
    onSuccess: (a) => { setAgency(a); setColor(a.branding.primaryColor); setPreview(null); toast.success('Logo uploaded — your team sees it now') },
    onError: (err) => { setPreview(null); toast.error(getApiErrorMessage(err, 'Could not upload the logo')) },
  })
  const removeLogoMut = useMutation({
    mutationFn: () => agenciesApi.removeLogo(agency._id).then((r) => r.data.data.agency),
    onSuccess: (a) => { setAgency(a); setLogoColors([]); toast.success('Logo removed') },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Could not remove the logo')),
  })
  const saveMut = useMutation({
    mutationFn: () => agenciesApi.updateProfile(agency._id, {
      primaryColor: color,
      profile: Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : v])),
    }).then((r) => r.data.data.agency),
    onSuccess: (a) => { setAgency(a); setForm(formOf(a)); qc.invalidateQueries({ queryKey: ['tour-setup'] }); toast.success('Company profile saved') },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Could not save the profile')),
  })

  async function pickLogo(file) {
    if (!file) return
    if (!LOGO_TYPES.includes(file.type)) return toast.error('Use a PNG, JPG, WebP or SVG image')
    if (file.size > MAX_LOGO) return toast.error('The logo must be 2 MB or smaller')
    const url = URL.createObjectURL(file)
    setPreview(url)
    // Read the company's colours straight out of the logo and suggest the strongest one
    let colors = []
    try { colors = await paletteFromImage(url) } catch { /* an SVG without size can't be read — fine */ }
    setLogoColors(colors)
    const suggested = colors[0] ?? null
    if (suggested && !savedColor) setColor(suggested)
    logoMut.mutate({ file, primaryColor: savedColor ? null : suggested })
  }

  const filled = form ? FIELDS.filter(({ key }) => String(form[key] ?? '').trim()).length : 0
  const dirty = useMemo(() => {
    if (!agency || !form) return false
    const base = formOf(agency)
    return color !== savedColor || FIELDS.some(({ key }) => (form[key] ?? '') !== (base[key] ?? ''))
  }, [agency, form, color, savedColor])

  if (isLoading || !agency || !form) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-[#F95C4B]" /></div>
  }

  const logoUrl = preview ?? agency.branding.logoUrl
  const shown = readableBrand(color ?? RT_BRAND)
  const adjusted = color && shown !== color.toUpperCase()

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-5 sm:px-8 pt-6 pb-5 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#111111] dark:text-white tracking-tight flex items-center gap-2.5">
              <Building2 className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} /> Company profile
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
              Your logo and colour are what everyone at {agency.name} sees in the CRM — instead of Reliable Touch.
            </p>
          </div>
          {canEdit ? (
            <button onClick={() => saveMut.mutate()} disabled={!dirty || saveMut.isPending}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-btn disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98]">
              {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {dirty ? 'Save changes' : 'Saved'}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F5F5F4] dark:bg-[#202020] text-[#6B7280]">
              <Lock className="w-3.5 h-3.5" /> Only your Agency Admin can change this
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-6 max-w-6xl">
          <div className="space-y-6 min-w-0">
            <Section icon={Palette} title="Your brand" sub="Upload your logo and we pick your colours from it. Your team sees the change straight away.">
              {/* Logo */}
              <div
                onDragOver={(e) => { if (!canEdit) return; e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); if (canEdit) pickLogo(e.dataTransfer.files?.[0]) }}
                className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl border-2 border-dashed transition-colors ${dragging ? 'border-[#F95C4B] bg-[#F95C4B]/5' : 'border-[#E5E7EB] dark:border-[#2A2A2A]'}`}
              >
                <div className="relative w-24 h-24 rounded-2xl bg-[#F5F5F4] dark:bg-[#202020] flex items-center justify-center overflow-hidden flex-shrink-0">
                  {logoUrl
                    ? <img src={logoUrl} alt={`${agency.name} logo`} className="w-full h-full object-contain p-2 bg-white" />
                    : <span className="text-xl font-bold text-[#9CA3AF]">{initialsOf(agency.name)}</span>}
                  {logoMut.isPending && <span className="absolute inset-0 bg-white/70 dark:bg-black/60 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#F95C4B]" /></span>}
                </div>
                <div className="flex-1 min-w-0">
                  {canEdit ? (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => fileRef.current?.click()} disabled={logoMut.isPending}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-60 transition-all active:scale-[0.98]">
                        {agency.branding.logoUrl ? <Upload className="w-4 h-4" /> : <ImagePlus className="w-4 h-4" />}
                        {agency.branding.logoUrl ? 'Replace logo' : 'Upload logo'}
                      </button>
                      {agency.branding.logoUrl && (
                        <button type="button" onClick={() => removeLogoMut.mutate()} disabled={removeLogoMut.isPending}
                          className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] hover:text-[#EF4444] hover:border-[#EF4444]/40">
                          {removeLogoMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Remove
                        </button>
                      )}
                    </div>
                  ) : <p className="text-sm font-semibold text-[#111111] dark:text-white">{agency.name}</p>}
                  <p className="mt-2 text-xs text-[#9CA3AF]">PNG, SVG, JPG or WebP · up to 2 MB · square works best{canEdit ? ' · or drop it here' : ''}</p>
                  <input ref={fileRef} type="file" accept={LOGO_TYPES.join(',')} hidden onChange={(e) => { pickLogo(e.target.files?.[0]); e.target.value = '' }} />
                </div>
              </div>

              {/* Colour */}
              <div className="mt-5">
                <p className="text-xs font-semibold text-[#111111] dark:text-white mb-2.5">Brand colour</p>
                {logoColors.length > 0 && (
                  <div className="mb-3">
                    <p className="flex items-center gap-1.5 text-[11px] text-[#6B7280] dark:text-[#A1A1AA] mb-2"><Wand2 className="w-3.5 h-3.5 text-[#F95C4B]" /> From your logo</p>
                    <div className="flex flex-wrap gap-2.5">
                      {logoColors.map((c) => <Swatch key={c} color={c} active={color === c} onClick={() => canEdit && setColor(c)} />)}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2.5">
                  {BRAND_PRESETS.map((c) => (
                    <Swatch key={c} color={c} active={(color ?? RT_BRAND).toUpperCase() === c} title={c === RT_BRAND ? 'Reliable Touch coral' : c} onClick={() => canEdit && setColor(c === RT_BRAND ? null : c)} />
                  ))}
                  {canEdit && (
                    <label title="Any colour" className="relative w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border-2 border-dashed border-[#D4D4D8] dark:border-[#3F3F46] text-[#6B7280] hover:border-[#F95C4B] hover:text-[#F95C4B]">
                      <Pipette className="w-4 h-4" />
                      <input type="color" value={color ?? RT_BRAND} onChange={(e) => setColor(e.target.value.toUpperCase())} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </label>
                  )}
                  <span className="ml-1 font-mono text-xs text-[#6B7280] dark:text-[#A1A1AA]">{(color ?? RT_BRAND).toUpperCase()}</span>
                </div>
                {adjusted && <p className="mt-2 text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">Shown a little darker ({shown}) so white text on buttons stays easy to read.</p>}
                {canEdit && dirty && color !== savedColor && <p className="mt-2 text-[11px] font-semibold text-[#F95C4B]">You are previewing this colour — press Save changes to keep it.</p>}
              </div>
            </Section>

            <Section icon={ShieldCheck} title="Registered details"
              sub="Your company's official details — kept on your profile for the paperwork."
              right={<span className="text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] whitespace-nowrap">{filled} of {FIELDS.length}</span>}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {FIELDS.map((f) => (
                  <label key={f.key} className={f.wide ? 'sm:col-span-2' : ''}>
                    <span className="block text-xs font-medium text-[#6B7280] dark:text-[#A1A1AA] mb-1.5">{f.label}</span>
                    {f.area ? (
                      <textarea rows={4} maxLength={1200} value={form[f.key]} placeholder={f.placeholder} disabled={!canEdit}
                        onChange={(e) => setForm((v) => ({ ...v, [f.key]: e.target.value }))} className={`${inputCls} resize-y`} />
                    ) : (
                      <input type={f.type ?? 'text'} value={form[f.key]} placeholder={f.placeholder} disabled={!canEdit}
                        onChange={(e) => setForm((v) => ({ ...v, [f.key]: e.target.value }))} className={inputCls} />
                    )}
                  </label>
                ))}
              </div>
              <div className="mt-5 h-2 rounded-full bg-[#F5F5F4] dark:bg-[#202020] overflow-hidden">
                <div className="h-full rounded-full bg-[#10B981] transition-all duration-500" style={{ width: `${(filled / FIELDS.length) * 100}%` }} />
              </div>
              <p className="mt-2 text-xs text-[#6B7280] dark:text-[#A1A1AA]">
                {filled === FIELDS.length ? 'All details are in — nice.' : `${FIELDS.length - filled} detail${FIELDS.length - filled === 1 ? '' : 's'} still to fill in.`}
              </p>
            </Section>
          </div>

          <div className="xl:sticky xl:top-0 self-start space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">What your team sees</p>
            <LivePreview name={agency.name} logoUrl={logoUrl} color={color} />
            <p className="text-xs text-[#9CA3AF] leading-relaxed">Your managers and agents see your logo and colour in their sidebar, buttons and highlights, with "Powered by Reliable Touch Service" at the bottom.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
