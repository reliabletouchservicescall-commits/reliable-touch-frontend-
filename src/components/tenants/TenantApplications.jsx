import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatDistanceToNow, format } from 'date-fns'
import {
  UserPlus, Link2, Copy, Check, MessageCircle, Mail, Loader2, Eye, FileText, Clock, Users, ChevronRight,
  X, Lock, Send, AlertTriangle, ShieldCheck, CircleCheck, CircleX, RotateCcw, Ban, PenLine, Flag,
  Building2, User, Activity, Inbox, UserCog, Plus, Trash2, UsersRound as UsersPair,
} from 'lucide-react'
import { tenantsApi } from '../../services/tenantsApi'
import { APP_STATUS, STEPS, allFields, typeOf, R } from '../../lib/tenantForm'
import { getApiErrorMessage, inputCls } from '../leads/leadShared'
import SidePanel from '../common/SidePanel'

// Tenant applications on a listed rental: add a tenant by name → share their private link →
// watch them open it, fill it in and upload → review, ask for fixes, approve or decline.
// Used on the lead screen, in the Deal Tracker drawer and on the Tenant applications page.

export const appsKey = (leadId) => ['tenant-apps', 'lead', leadId]
const ago = (d) => (d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : null)
const whenFull = (d) => (d ? format(new Date(d), 'd MMM yyyy, HH:mm') : '—')
// The tenant's link on the site the team is using (live site in production, localhost when testing)
export const linkOf = (app) => (app.token ? `${window.location.origin}/apply/${app.token}` : app.link)

export function StatusPill({ status, small }) {
  const m = APP_STATUS[status] ?? APP_STATUS.invited
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${small ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'}`}
      style={{ backgroundColor: `${m.tone}1F`, color: m.tone }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: m.tone }} />
      {m.label}
    </span>
  )
}

// Where they are: a 6-step bar + "docs 2/4"
export function ProgressBar({ p, status }) {
  const done = ['submitted', 'approved', 'declined'].includes(status)
  const pct = done ? 100 : Math.round(((p?.furthestStep ?? 0) / 6) * 100)
  return (
    <div className="min-w-[120px]">
      <div className="h-1.5 overflow-hidden rounded-full bg-[#F5F5F4] dark:bg-[#202020]">
        <div className="h-full rounded-full bg-[#F95C4B] transition-[width] duration-700" style={{ width: `${pct}%`, backgroundColor: done ? '#10B981' : undefined }} />
      </div>
      <p className="mt-1 text-[10.5px] text-[#6B7280] dark:text-[#A1A1AA]">
        {done ? 'Signed & submitted' : p?.furthestStep ? `Step ${Math.min(p.furthestStep, 6)} of 6` : 'Not started'} · docs {p?.docs?.done ?? 0}/{p?.docs?.total ?? 0}
      </p>
    </div>
  )
}

function shareMessage(app, lead) {
  const first = (app.invitedName ?? app.name ?? '').split(' ')[0] || 'there'
  const rent = lead?.rent ? ` (${R(lead.rent)} per month)` : ''
  return `Hi ${first}, thanks for your interest in ${lead?.propertyAddress ?? 'the property'}${rent}. Apply here in about 10 minutes — it saves as you go. Have your ID, last 3 payslips and 3 months' bank statements ready.\n${linkOf(app)}`
}

// The link, a ready message, and one-tap WhatsApp / copy / email
export function ShareCard({ app, lead, compact }) {
  const qc = useQueryClient()
  const [copied, setCopied] = useState(null)
  const msg = shareMessage(app, lead)
  const phone = String(app.phone ?? '').replace(/[^\d]/g, '').replace(/^0/, '27')
  const log = (via) => tenantsApi.shared(app.id, via).then(() => qc.invalidateQueries({ queryKey: ['tenant-apps'] })).catch(() => {})
  async function copy(text, what) {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(null), 1600); log('link') } catch { toast.error('Could not copy — select it and copy by hand') }
  }
  const remind = useMutation({
    mutationFn: () => tenantsApi.remind(app.id),
    onSuccess: () => { toast.success('Emailed the link'); qc.invalidateQueries({ queryKey: ['tenant-apps'] }) },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not email the tenant')),
  })
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 dark:border-[#2A2A2A] dark:bg-[#121212]">
        <Link2 className="h-4 w-4 flex-none text-[#9CA3AF]" />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-[#111111] dark:text-white">{linkOf(app)}</span>
        <button type="button" onClick={() => copy(linkOf(app), 'link')} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]" aria-label="Copy link">
          {copied === 'link' ? <Check className="h-3.5 w-3.5 text-[#10B981]" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      {!compact && <p className="whitespace-pre-wrap rounded-xl border border-dashed border-[#E5E7EB] bg-[#FAFAF9] px-3 py-2.5 text-[12.5px] leading-relaxed text-[#111111] dark:border-[#2A2A2A] dark:bg-[#121212] dark:text-white">{msg}</p>}
      <div className="flex flex-wrap gap-2">
        <a href={`https://wa.me/${phone.length >= 10 ? phone : ''}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" onClick={() => log('whatsapp')}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3.5 py-2 text-xs font-bold text-white hover:brightness-95 active:scale-[0.98]">
          <MessageCircle className="h-4 w-4" /> Send on WhatsApp
        </a>
        <button type="button" onClick={() => copy(msg, 'msg')} className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] px-3.5 py-2 text-xs font-bold text-[#111111] hover:bg-[#F5F5F4] dark:border-[#2A2A2A] dark:text-white dark:hover:bg-[#202020]">
          {copied === 'msg' ? <Check className="h-4 w-4 text-[#10B981]" /> : <Copy className="h-4 w-4" />} Copy message
        </button>
        {(app.email) && (
          <button type="button" onClick={() => remind.mutate()} disabled={remind.isPending} className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] px-3.5 py-2 text-xs font-bold text-[#111111] hover:bg-[#F5F5F4] disabled:opacity-60 dark:border-[#2A2A2A] dark:text-white dark:hover:bg-[#202020]">
            {remind.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Email it
          </button>
        )}
        <a href={`${linkOf(app)}?preview=1`} target="_blank" rel="noreferrer" title="See it as the tenant does — not counted as a visit" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-[#6B7280] hover:text-[#111111] dark:text-[#A1A1AA] dark:hover:text-white">
          <Eye className="h-4 w-4" /> Preview
        </a>
      </div>
    </div>
  )
}

/* ─── Add a tenant ──────────────────────────────────────────────────────── */

export function AddTenantForm({ leadId, onCreated, onCancel }) {
  const qc = useQueryClient()
  const [f, setF] = useState({ name: '', phone: '', email: '', ref: true, addr: false, afs: false, sendEmail: true })
  const [cos, setCos] = useState([]) // people renting together and sharing the rent
  const [err, setErr] = useState(null)
  const mut = useMutation({
    mutationFn: () => tenantsApi.create(leadId, {
      name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim(),
      requires: { ref: f.ref, addr: f.addr, afs: f.afs }, sendEmail: f.sendEmail,
      coApplicants: cos.filter((c) => c.name.trim().length >= 2).map((c) => ({ name: c.name.trim(), phone: c.phone.trim(), share: Number(c.share) || undefined })),
    }).then((r) => r.data.data.application),
    onSuccess: (app) => {
      qc.invalidateQueries({ queryKey: ['tenant-apps'] })
      toast.success(app.email && f.sendEmail ? `Added ${app.invitedName} — link emailed` : `Added ${app.invitedName} — now send the link`)
      onCreated?.(app)
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not add the tenant')),
  })
  function submit(e) {
    e.preventDefault()
    if (f.name.trim().length < 2) return setErr("Enter the tenant's name")
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email.trim())) return setErr('That email looks wrong')
    setErr(null)
    mut.mutate()
  }
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-[#F95C4B]/25 bg-[#F95C4B]/[0.04] p-4">
      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Tenant's name <span className="text-[#F95C4B]">*</span></label>
        <input autoFocus value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Sipho Ndlovu" className={inputCls(Boolean(err && f.name.trim().length < 2))} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Mobile (for WhatsApp)</label>
          <input value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="082 123 4567" className={inputCls(false)} />
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Email</label>
          <input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="name@email.com" className={inputCls(false)} />
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Documents asked for</p>
        <p className="mb-2 text-xs text-[#6B7280] dark:text-[#A1A1AA]">Always: ID, 3 payslips and 3 months' bank statements (companies: CIPC, director IDs, 6 months' statements). Also require:</p>
        <div className="flex flex-wrap gap-2">
          {[['ref', 'Landlord reference letter'], ['addr', 'Proof of address'], ['afs', 'Company financial statements']].map(([k, l]) => (
            <button type="button" key={k} onClick={() => set(k, !f[k])}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${f[k] ? 'border-[#F95C4B] bg-[#F95C4B]/10 text-[#F95C4B]' : 'border-[#E5E7EB] text-[#6B7280] dark:border-[#2A2A2A] dark:text-[#A1A1AA]'}`}>
              {f[k] ? <Check className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5" />} {l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Renting together?</p>
        {cos.map((c, i) => (
          <div key={i} className="mb-2 grid grid-cols-[1fr_120px_76px_32px] items-center gap-2">
            <input value={c.name} onChange={(e) => setCos((l) => l.map((x, n) => (n === i ? { ...x, name: e.target.value } : x)))} placeholder="Partner / friend's name" className={inputCls(false)} />
            <input value={c.phone} onChange={(e) => setCos((l) => l.map((x, n) => (n === i ? { ...x, phone: e.target.value } : x)))} placeholder="Mobile" className={inputCls(false)} />
            <span className="relative">
              <input type="number" min={1} max={95} value={c.share} onChange={(e) => setCos((l) => l.map((x, n) => (n === i ? { ...x, share: e.target.value } : x)))} className={`${inputCls(false)} pr-6`} aria-label="Share of the rent" />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#9CA3AF]">%</span>
            </span>
            <button type="button" onClick={() => setCos((l) => l.filter((_, n) => n !== i))} aria-label="Remove" className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#EF4444]/10 hover:text-[#EF4444]"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {cos.length < 4 && (
          <button type="button" onClick={() => setCos((l) => [...l, { name: '', phone: '', share: l.length ? 20 : 50 }])}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#D4D4D8] px-3 py-1.5 text-xs font-semibold text-[#6B7280] hover:border-[#F95C4B]/50 hover:text-[#F95C4B] dark:border-[#3F3F46] dark:text-[#A1A1AA]">
            <Plus className="h-3.5 w-3.5" /> {cos.length ? 'Add another person' : 'Someone is sharing the rent with them'}
          </button>
        )}
        {cos.length > 0 && <p className="mt-1.5 text-[11px] text-[#9CA3AF]">{f.name.split(' ')[0] || 'The tenant'} pays {Math.max(0, 100 - cos.reduce((t, c) => t + (Number(c.share) || 0), 0))}%. They can fill in each person's part, or send them their own link.</p>}
      </div>
      {f.email.trim() && (
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[#111111] dark:text-white">
          <input type="checkbox" checked={f.sendEmail} onChange={(e) => set('sendEmail', e.target.checked)} className="accent-[#F95C4B]" />
          Email them the link now (in your company's look)
        </label>
      )}
      {err && <p className="text-xs font-semibold text-[#EF4444]">{err}</p>}
      <div className="flex gap-2">
        {onCancel && <button type="button" onClick={onCancel} className="rounded-xl border border-[#E5E7EB] px-4 py-2.5 text-sm font-semibold text-[#6B7280] hover:bg-[#F5F5F4] dark:border-[#2A2A2A] dark:text-[#A1A1AA] dark:hover:bg-[#202020]">Cancel</button>}
        <button type="submit" disabled={mut.isPending} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#F95C4B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#E84B3A] disabled:opacity-60">
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Add tenant & get link
        </button>
      </div>
    </form>
  )
}

/* ─── One row ───────────────────────────────────────────────────────────── */

export function ApplicationRow({ app, onOpen, showProperty }) {
  const p = app.progress
  const seen = app.lastOpenedAt ? `Opened ${ago(app.lastOpenedAt)}${app.openCount > 1 ? ` · ${app.openCount} visits` : ''}` : app.sharedAt ? `Sent ${ago(app.sharedAt)} · not opened yet` : 'Link not sent yet'
  return (
    <button type="button" onClick={() => onOpen(app)}
      className="group flex w-full items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-3.5 text-left transition-all hover:border-[#F95C4B]/40 hover:shadow-md dark:border-[#2A2A2A] dark:bg-[#181818]">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#F95C4B]/10 text-sm font-bold text-[#F95C4B]">
        {app.applicantType === 'company' ? <Building2 className="h-5 w-5" /> : (app.name ?? '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-bold text-[#111111] dark:text-white">{app.name}</span>
          <StatusPill status={app.status} small />
          {app.joint && <span className="inline-flex items-center gap-1 rounded-full bg-[#6366F1]/10 px-2 py-0.5 text-[10px] font-bold text-[#6366F1]"><UsersPair className="h-3 w-3" /> Joint · {app.coApplicants.length + 1}</span>}
          {app.openIssues > 0 && <span className="rounded-full bg-[#EF4444]/10 px-2 py-0.5 text-[10px] font-bold text-[#EF4444]">{app.openIssues} to fix</span>}
        </span>
        {showProperty && app.lead && <span className="block truncate text-xs text-[#6B7280] dark:text-[#A1A1AA]">{app.lead.propertyAddress}{app.lead.agencyName ? ` · ${app.lead.agencyName}` : ''}</span>}
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">
          <Eye className="h-3 w-3" /> {seen}
          {app.lastActivityAt && <><span className="text-[#D4D4D8]">·</span><PenLine className="h-3 w-3" /> filled in {ago(app.lastActivityAt)}</>}
        </span>
      </span>
      <span className="hidden sm:block"><ProgressBar p={p} status={app.status} /></span>
      <ChevronRight className="h-4 w-4 flex-none text-[#9CA3AF] transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}

/* ─── The lead's panel ──────────────────────────────────────────────────── */

export function TenantApplicationsPanel({ leadId, embedded = false }) {
  const [adding, setAdding] = useState(false)
  const [justAdded, setJustAdded] = useState(null)
  const [open, setOpen] = useState(null)
  const { data, isLoading, isError } = useQuery({
    queryKey: appsKey(leadId),
    queryFn: () => tenantsApi.forLead(leadId).then((r) => r.data.data),
    enabled: Boolean(leadId),
    refetchInterval: 60_000,
  })
  const apps = useMemo(() => data?.applications ?? [], [data])
  const lead = data?.lead
  const counts = useMemo(() => ({
    total: apps.length,
    submitted: apps.filter((a) => ['submitted', 'changes_requested'].includes(a.status)).length,
    working: apps.filter((a) => ['opened', 'in_progress'].includes(a.status)).length,
  }), [apps])

  if (isLoading) return <div className="h-24 animate-pulse rounded-2xl bg-[#F5F5F4] dark:bg-[#202020]" />
  if (isError) return null

  return (
    <div className={embedded ? 'space-y-3' : 'space-y-3 rounded-2xl border border-[#E5E7EB] bg-white p-4 dark:border-[#2A2A2A] dark:bg-[#181818]'}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-2 text-sm font-bold text-[#111111] dark:text-white">
          <Users className="h-4 w-4 text-[#F95C4B]" /> Tenant applications
          {counts.total > 0 && <span className="rounded-full bg-[#F5F5F4] px-2 py-0.5 text-[10px] font-bold text-[#6B7280] dark:bg-[#202020] dark:text-[#A1A1AA]">{counts.total}</span>}
        </p>
        {counts.submitted > 0 && <span className="rounded-full bg-[#8B5CF6]/10 px-2 py-0.5 text-[10px] font-bold text-[#8B5CF6]">{counts.submitted} to review</span>}
        {counts.working > 0 && <span className="rounded-full bg-[#F59E0B]/10 px-2 py-0.5 text-[10px] font-bold text-[#D97706]">{counts.working} filling in</span>}
        <span className="flex-1" />
        {data?.canAdd && !adding && (
          <button type="button" onClick={() => { setAdding(true); setJustAdded(null) }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#F95C4B] px-3 py-2 text-xs font-bold text-white hover:bg-[#E84B3A] active:scale-[0.98]">
            <UserPlus className="h-4 w-4" /> Add tenant
          </button>
        )}
      </div>

      {!data?.canAdd && apps.length === 0 && (
        <p className="flex items-start gap-2 rounded-xl bg-[#F5F5F4] p-3 text-xs text-[#6B7280] dark:bg-[#202020] dark:text-[#A1A1AA]">
          <Lock className="mt-0.5 h-3.5 w-3.5 flex-none" /> Tenants can apply once this lead is <b className="mx-1">listed for rent</b>. Change its status to Listed (and listing type to rental) to start.
        </p>
      )}

      {adding && <AddTenantForm leadId={leadId} onCancel={() => setAdding(false)} onCreated={(app) => { setAdding(false); setJustAdded(app) }} />}

      {justAdded && (
        <div className="space-y-2.5 rounded-2xl border border-[#10B981]/30 bg-[#10B981]/[0.05] p-4 animate-fade-in">
          <div className="flex items-start gap-2">
            <CircleCheck className="h-5 w-5 flex-none text-[#10B981]" />
            <p className="flex-1 text-sm text-[#111111] dark:text-white"><b>{justAdded.invitedName}</b> is ready to apply. Send them their private link:</p>
            <button type="button" onClick={() => setJustAdded(null)} aria-label="Close" className="text-[#9CA3AF] hover:text-[#111111] dark:hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <ShareCard app={justAdded} lead={lead} />
        </div>
      )}

      {apps.length > 0 ? (
        <div className="space-y-2">{apps.map((a) => <ApplicationRow key={a.id} app={a} onOpen={(x) => setOpen(x.id)} />)}</div>
      ) : data?.canAdd && !adding && !justAdded && (
        <button type="button" onClick={() => setAdding(true)} className="flex w-full flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-[#E5E7EB] p-5 text-center hover:border-[#F95C4B]/40 dark:border-[#2A2A2A]">
          <Inbox className="h-6 w-6 text-[#9CA3AF]" />
          <span className="text-sm font-semibold text-[#111111] dark:text-white">No tenants yet</span>
          <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">When someone asks about this rental, add them here and send their application link.</span>
        </button>
      )}

      {open && <TenantReviewDrawer id={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

/* ─── Review ────────────────────────────────────────────────────────────── */

const EVENT_LABEL = {
  created: 'Added', shared: 'Link sent', reminded: 'Reminder sent', opened: 'Opened the link', started: 'Started filling in',
  uploaded: 'Uploaded', removed: 'Removed a file', submitted: 'Submitted', resubmitted: 'Sent the update',
  changes_requested: 'Fixes asked', issue_cleared: 'Fix cleared', approved: 'Approved', declined: 'Declined', reopened: 'Reopened', withdrawn: 'Link switched off',
  co_added: 'Co-applicant added', co_removed: 'Co-applicant removed', co_opened: 'Co-applicant opened their link', co_signed: 'Co-applicant signed',
  assisted: 'Team filling in', to_deal: 'Documents added to the deal',
}

const CO_STATUS = { invited: ['Not opened', '#9CA3AF'], opened: ['Opened', '#3B82F6'], in_progress: ['Filling in', '#F59E0B'], done: ['Done & signed', '#10B981'] }

function Section({ title, icon: Icon, children, right }) {
  return (
    <section className="space-y-2.5 px-5 py-4">
      <div className="flex items-center gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">{Icon && <Icon className="h-3.5 w-3.5" />} {title}</p>
        <span className="flex-1" />{right}
      </div>
      {children}
    </section>
  )
}

function FlagButton({ on, onClick, disabled }) {
  if (disabled) return null
  return (
    <button type="button" onClick={onClick} title={on ? 'Remove from the fix list' : 'Ask the tenant to fix this'}
      className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg transition-colors ${on ? 'bg-[#EF4444] text-white' : 'text-[#9CA3AF] hover:bg-[#EF4444]/10 hover:text-[#EF4444]'}`}>
      <Flag className="h-3.5 w-3.5" />
    </button>
  )
}

export function TenantReviewDrawer({ id, onClose }) {
  const qc = useQueryClient()
  const [flags, setFlags] = useState({}) // target → message
  const [note, setNote] = useState('')
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')
  const { data: app, isLoading } = useQuery({
    queryKey: ['tenant-apps', 'one', id],
    queryFn: () => tenantsApi.get(id).then((r) => r.data.data.application),
    refetchInterval: 30_000,
  })
  useEffect(() => { setFlags({}); setNote(''); setDeclining(false) }, [id])

  const done = (msg) => (res) => {
    qc.setQueryData(['tenant-apps', 'one', id], res.data.data.application)
    qc.invalidateQueries({ queryKey: ['tenant-apps'] })
    toast.success(msg ?? res.data.message)
  }
  const fail = (fallback) => (e) => toast.error(getApiErrorMessage(e, fallback))
  const fixMut = useMutation({
    mutationFn: () => tenantsApi.requestChanges(id, { items: Object.entries(flags).map(([target, message]) => ({ target, message })), note }),
    onSuccess: (res) => { done('Sent — the tenant was emailed what to fix')(res); setFlags({}); setNote('') },
    onError: fail('Could not send the fix request'),
  })
  const decideMut = useMutation({
    mutationFn: (d) => tenantsApi.decide(id, d, d === 'declined' ? reason : ''),
    onSuccess: (res) => { done()(res); setDeclining(false) },
    onError: fail('Could not save the decision'),
  })
  const reopenMut = useMutation({ mutationFn: () => tenantsApi.reopen(id), onSuccess: done(), onError: fail('Could not reopen') })
  const withdrawMut = useMutation({ mutationFn: () => tenantsApi.withdraw(id), onSuccess: done(), onError: fail('Could not switch the link off') })
  const clearMut = useMutation({ mutationFn: (issueId) => tenantsApi.resolveIssue(id, issueId), onSuccess: done('Cleared'), onError: fail('Could not clear it') })

  const type = typeOf(app?.applicantType)
  const closed = ['approved', 'declined', 'withdrawn'].includes(app?.status)
  const canFlag = app && !closed
  const toggle = (target) => setFlags((f) => {
    const n = { ...f }
    if (target in n) delete n[target]; else n[target] = ''
    return n
  })
  const flagged = Object.keys(flags)
  const openIssues = (app?.issues ?? []).filter((i) => !i.resolvedAt)
  const issueOn = (target) => openIssues.find((i) => i.target === target)

  const fieldsByStep = useMemo(() => {
    if (!app) return []
    const all = allFields(type, app.form)
    return [2, 3, 4].map((s) => ({ step: s, title: STEPS[type][s], fields: all.filter((f) => f.step === s) }))
  }, [app, type])

  const docsBy = useMemo(() => (app?.docs ?? []).filter((d) => (d.who ?? 'main') === 'main').reduce((m, d) => ((m[d.key] = [...(m[d.key] ?? []), d]), m), {}), [app])
  // Joint applications: the rent against everyone's income together
  const rentRatio = app?.lead?.rent && Number(app.gross) ? Math.round((app.lead.rent / Number(app.gross)) * 100) : null

  const footer = !app ? null : closed ? (
    <div className="flex w-full gap-2">
      <button type="button" onClick={() => reopenMut.mutate()} disabled={reopenMut.isPending} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] py-2.5 text-sm font-semibold text-[#111111] hover:bg-[#F5F5F4] dark:border-[#2A2A2A] dark:text-white dark:hover:bg-[#202020]">
        <RotateCcw className="h-4 w-4" /> Reopen
      </button>
    </div>
  ) : flagged.length || note.trim() ? (
    <button type="button" onClick={() => fixMut.mutate()} disabled={fixMut.isPending}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#EF4444] py-2.5 text-sm font-semibold text-white hover:bg-[#DC2626] disabled:opacity-60">
      {fixMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      Ask the tenant to fix {flagged.length || ''} {flagged.length === 1 ? 'thing' : flagged.length ? 'things' : 'this'}
    </button>
  ) : declining ? (
    <div className="flex w-full flex-col gap-2">
      <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional, the tenant sees it) — e.g. the landlord chose another applicant" className={inputCls(false)} />
      <div className="flex gap-2">
        <button type="button" onClick={() => setDeclining(false)} className="flex-1 rounded-xl border border-[#E5E7EB] py-2.5 text-sm font-semibold text-[#6B7280] dark:border-[#2A2A2A]">Cancel</button>
        <button type="button" onClick={() => decideMut.mutate('declined')} disabled={decideMut.isPending} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#111111] py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-[#111111]">
          {decideMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleX className="h-4 w-4" />} Decline
        </button>
      </div>
    </div>
  ) : (
    <div className="flex w-full gap-2">
      <button type="button" onClick={() => setDeclining(true)} className="flex items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] px-4 py-2.5 text-sm font-semibold text-[#6B7280] hover:bg-[#F5F5F4] dark:border-[#2A2A2A] dark:text-[#A1A1AA] dark:hover:bg-[#202020]">
        <CircleX className="h-4 w-4" /> Decline
      </button>
      <button type="button" onClick={() => decideMut.mutate('approved')} disabled={decideMut.isPending || !['submitted', 'changes_requested'].includes(app.status)}
        title={['submitted', 'changes_requested'].includes(app.status) ? '' : 'They need to submit first'}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#10B981] py-2.5 text-sm font-semibold text-white hover:bg-[#059669] disabled:opacity-50">
        {decideMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleCheck className="h-4 w-4" />} Approve tenant
      </button>
    </div>
  )

  return (
    <SidePanel onClose={onClose} icon={type === 'company' ? Building2 : User} title={app ? app.name : 'Application'}
      subtitle={app ? `${app.ref}${app.lead ? ` · ${app.lead.propertyAddress}` : ''}` : ''} widthClass="sm:max-w-xl" footer={footer}>
      {isLoading || !app ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-[#F95C4B]" /></div>
      ) : (
        <div className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
          {/* Status + tracking */}
          <Section title="Where it is" icon={Activity} right={<StatusPill status={app.status} />}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Link sent', app.sharedAt],
                ['First opened', app.firstOpenedAt],
                ['Last filled in', app.lastActivityAt],
                ['Submitted', app.submittedAt],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-[#FAFAF9] p-2.5 dark:bg-[#121212]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">{k}</p>
                  <p className={`mt-0.5 text-xs font-semibold ${v ? 'text-[#111111] dark:text-white' : 'text-[#9CA3AF]'}`}>{v ? ago(v) : 'Not yet'}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1"><ProgressBar p={app.progress} status={app.status} /></div>
              <span className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">{app.openCount} visit{app.openCount === 1 ? '' : 's'}</span>
            </div>
            {app.decision && <p className="rounded-xl bg-[#F5F5F4] p-2.5 text-xs text-[#111111] dark:bg-[#202020] dark:text-white">{app.status === 'approved' ? 'Approved' : 'Declined'} by {app.decision.byName} {ago(app.decision.at)}{app.decision.reason ? ` — ${app.decision.reason}` : ''}</p>}
            {!closed && !app.submittedAt && <ShareCard app={app} lead={app.lead} compact />}
            {!closed && (
              <a href={`${linkOf(app)}?assist=1`} target="_blank" rel="noreferrer"
                className="flex items-center gap-3 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/[0.06] p-3 transition-colors hover:border-[#F59E0B]/60">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#F59E0B]/15 text-[#B45309]"><UserCog className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[#111111] dark:text-white">Fill in for the tenant</span>
                  <span className="block text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">Got their details on the phone or in person? Enter them and upload their documents yourself — recorded in your name.</span>
                </span>
                <ChevronRight className="h-4 w-4 text-[#9CA3AF]" />
              </a>
            )}
          </Section>

          {openIssues.length > 0 && (
            <Section title={`Waiting on the tenant (${openIssues.length})`} icon={AlertTriangle}>
              {openIssues.map((i) => (
                <div key={i.id} className="flex items-start gap-2.5 rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/[0.04] p-2.5">
                  <span className={`mt-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${i.fixedAt ? 'bg-[#10B981]/15 text-[#059669]' : 'bg-[#EF4444]/15 text-[#EF4444]'}`}>{i.fixedAt ? 'Updated' : 'Open'}</span>
                  <p className="min-w-0 flex-1 text-xs text-[#111111] dark:text-white"><b>{i.label}</b> — {i.message}<span className="block text-[10.5px] text-[#9CA3AF]">{i.createdByName} · {ago(i.createdAt)}{i.fixedAt ? ` · tenant changed it ${ago(i.fixedAt)}` : ''}</span></p>
                  <button type="button" onClick={() => clearMut.mutate(i.id)} className="flex-none text-[11px] font-semibold text-[#6B7280] underline hover:text-[#111111] dark:hover:text-white">Clear</button>
                </div>
              ))}
            </Section>
          )}

          {/* Answers */}
          {app.applicantType ? fieldsByStep.map(({ step, title, fields }) => (
            <Section key={step} title={title} icon={step === 2 ? (type === 'company' ? Building2 : User) : FileText}>
              <div className="overflow-hidden rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A]">
                {fields.map((f) => {
                  const target = `field:${f.key}`
                  const v = app.form?.[f.key]
                  const iss = issueOn(target)
                  return (
                    <div key={f.key} className={`border-b border-[#E5E7EB] last:border-b-0 dark:border-[#2A2A2A] ${target in flags ? 'bg-[#EF4444]/[0.05]' : ''}`}>
                      <div className="flex items-center gap-3 px-3 py-2">
                        <span className="w-[42%] flex-none text-xs text-[#6B7280] dark:text-[#A1A1AA]">{f.label.replace(/\?$/, '')}</span>
                        <span className={`min-w-0 flex-1 text-[13px] font-semibold [overflow-wrap:anywhere] ${v ? 'text-[#111111] dark:text-white' : 'text-[#D4D4D8]'}`}>
                          {v ? (f.num ? R(v) : f.type === 'date' ? format(new Date(v), 'd MMM yyyy') : v) : '—'}
                          {iss && <span className="ml-1.5 text-[10px] font-bold text-[#EF4444]">fix asked</span>}
                        </span>
                        <FlagButton on={target in flags} disabled={!canFlag} onClick={() => toggle(target)} />
                      </div>
                      {target in flags && (
                        <input autoFocus value={flags[target]} onChange={(e) => setFlags((x) => ({ ...x, [target]: e.target.value }))}
                          placeholder={`What's wrong with "${f.label.replace(/\?$/, '').toLowerCase()}"?`}
                          className="mx-3 mb-2 w-[calc(100%-24px)] rounded-lg border border-[#EF4444]/30 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#EF4444] dark:bg-[#121212] dark:text-white" />
                      )}
                    </div>
                  )
                })}
              </div>
              {step === 4 && rentRatio != null && type === 'individual' && (
                <p className={`text-xs font-semibold ${rentRatio <= 30 ? 'text-[#10B981]' : rentRatio <= 35 ? 'text-[#D97706]' : 'text-[#EF4444]'}`}>
                  Rent is {rentRatio}% of {app.joint ? 'their combined' : ''} gross income {rentRatio <= 30 ? '— comfortable' : rentRatio <= 35 ? '— a little high' : '— above what most landlords accept'}
                </p>
              )}
            </Section>
          )) : (
            <Section title="Answers"><p className="text-xs text-[#9CA3AF]">They haven't chosen whether they're applying personally or as a company yet.</p></Section>
          )}

          {/* People renting together */}
          {app.joint && app.coApplicants.map((c) => {
            const [label, color] = CO_STATUS[c.status] ?? CO_STATUS.invited
            const theirDocs = (app.docs ?? []).filter((d) => d.who === c.id)
            return (
              <Section key={c.id} title={`Renting with · ${c.relation}`} icon={UsersPair}
                right={<span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color, backgroundColor: `${color}1F` }}>{label}</span>}>
                <div className="flex items-center gap-3 rounded-xl bg-[#FAFAF9] p-3 dark:bg-[#121212]">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#6366F1] text-xs font-bold text-white">{c.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[#111111] dark:text-white">{c.name}</span>
                    <span className="block text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">
                      Pays {c.share}%{app.lead?.rent ? ` · ${R((app.lead.rent * c.share) / 100)} / month` : ''} · {c.filledBy === 'self' ? 'fills in their own part' : `filled in by ${app.mainName.split(' ')[0]}`}
                      {c.lastOpenedAt ? ` · opened ${ago(c.lastOpenedAt)}` : ''}
                    </span>
                  </span>
                  {c.filledBy === 'self' && c.status !== 'done' && (
                    <button type="button" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/apply/${c.token}`).then(() => toast.success(`${c.name.split(' ')[0]}'s link copied`))}
                      className="inline-flex flex-none items-center gap-1 rounded-lg border border-[#E5E7EB] px-2.5 py-1.5 text-[11px] font-semibold text-[#111111] hover:bg-white dark:border-[#2A2A2A] dark:text-white"><Copy className="h-3.5 w-3.5" /> Their link</button>
                  )}
                </div>
                <div className="overflow-hidden rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A]">
                  {(app.coFields ?? []).map((f) => {
                    const target = `co:${c.id}:field:${f.key}`
                    const v = c.form?.[f.key]
                    return (
                      <div key={f.key} className={`border-b border-[#E5E7EB] last:border-b-0 dark:border-[#2A2A2A] ${target in flags ? 'bg-[#EF4444]/[0.05]' : ''}`}>
                        <div className="flex items-center gap-3 px-3 py-2">
                          <span className="w-[42%] flex-none text-xs text-[#6B7280] dark:text-[#A1A1AA]">{f.label}</span>
                          <span className={`min-w-0 flex-1 text-[13px] font-semibold [overflow-wrap:anywhere] ${v ? 'text-[#111111] dark:text-white' : 'text-[#D4D4D8]'}`}>
                            {v ? (['gross', 'net'].includes(f.key) ? R(v) : v) : '—'}
                            {issueOn(target) && <span className="ml-1.5 text-[10px] font-bold text-[#EF4444]">fix asked</span>}
                          </span>
                          <FlagButton on={target in flags} disabled={!canFlag} onClick={() => toggle(target)} />
                        </div>
                        {target in flags && (
                          <input autoFocus value={flags[target]} onChange={(e) => setFlags((x) => ({ ...x, [target]: e.target.value }))} placeholder={`What's wrong with ${c.name.split(' ')[0]}'s ${f.label.toLowerCase()}?`}
                            className="mx-3 mb-2 w-[calc(100%-24px)] rounded-lg border border-[#EF4444]/30 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#EF4444] dark:bg-[#121212] dark:text-white" />
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="space-y-1.5">
                  {(app.coDocSlots ?? []).map((s) => {
                    const files = theirDocs.filter((d) => d.key === s.key)
                    const target = `co:${c.id}:doc:${s.key}`
                    return (
                      <div key={s.key} className={`rounded-xl border p-2.5 ${target in flags ? 'border-[#EF4444]/40 bg-[#EF4444]/[0.04]' : 'border-[#E5E7EB] dark:border-[#2A2A2A]'}`}>
                        <div className="flex items-center gap-2.5">
                          <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full ${files.length ? 'bg-[#10B981]/15 text-[#10B981]' : 'bg-[#F59E0B]/15 text-[#D97706]'}`}>{files.length ? <Check className="h-3.5 w-3.5" /> : '!'}</span>
                          <span className="min-w-0 flex-1 text-[13px] font-semibold text-[#111111] dark:text-white">{s.label}{issueOn(target) && <span className="ml-1.5 text-[10px] font-bold text-[#EF4444]">fix asked</span>}</span>
                          {files.map((d) => (
                            <a key={d.id} href={d.url} target="_blank" rel="noreferrer" title={d.name} className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-md border border-[#E5E7EB] hover:border-[#F95C4B]/60 dark:border-[#2A2A2A]">
                              {d.mimeType?.startsWith('image/') ? <img src={d.url} alt="" className="h-full w-full object-cover" /> : <FileText className="h-3.5 w-3.5 text-[#F95C4B]" />}
                            </a>
                          ))}
                          <FlagButton on={target in flags} disabled={!canFlag} onClick={() => toggle(target)} />
                        </div>
                        {target in flags && (
                          <input autoFocus value={flags[target]} onChange={(e) => setFlags((x) => ({ ...x, [target]: e.target.value }))} placeholder="e.g. The bank statement is missing a month"
                            className="mt-2 w-full rounded-lg border border-[#EF4444]/30 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#EF4444] dark:bg-[#121212] dark:text-white" />
                        )}
                      </div>
                    )
                  })}
                </div>
                {c.signature ? (
                  <div className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] p-2.5 dark:border-[#2A2A2A]">
                    {c.signature.url && <img src={c.signature.url} alt={`${c.name}'s signature`} className="h-10 w-28 rounded bg-white object-contain ring-1 ring-[#E5E7EB]" />}
                    <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">Signed {whenFull(c.signature.signedAt)}</p>
                  </div>
                ) : <p className="text-[11px] text-[#9CA3AF]">Not signed yet.</p>}
              </Section>
            )
          })}

          {/* Documents */}
          <Section title={`${app.joint ? `${app.mainName.split(' ')[0]}'s documents` : 'Documents'} · ${app.progress.docs.done}/${app.progress.docs.total} required`} icon={FileText}>
            <div className="space-y-2">
              {[...app.docSlots, { key: 'other', label: 'Other supporting documents', required: false }].map((s) => {
                const files = docsBy[s.key] ?? []
                const target = `doc:${s.key}`
                if (s.key === 'other' && !files.length) return null
                return (
                  <div key={s.key} className={`rounded-xl border p-2.5 ${target in flags ? 'border-[#EF4444]/40 bg-[#EF4444]/[0.04]' : 'border-[#E5E7EB] dark:border-[#2A2A2A]'}`}>
                    <div className="flex items-center gap-2.5">
                      <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full ${files.length ? 'bg-[#10B981]/15 text-[#10B981]' : s.required ? 'bg-[#F59E0B]/15 text-[#D97706]' : 'bg-[#F5F5F4] text-[#9CA3AF] dark:bg-[#202020]'}`}>
                        {files.length ? <Check className="h-3.5 w-3.5" /> : '!'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-[#111111] dark:text-white">{s.label}{!s.required && <span className="ml-1 font-normal text-[#9CA3AF]">(optional)</span>}{issueOn(target) && <span className="ml-1.5 text-[10px] font-bold text-[#EF4444]">fix asked</span>}</span>
                        <span className="block text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">{files.length ? `${files.length} file${files.length === 1 ? '' : 's'} · last ${ago(files[files.length - 1].uploadedAt)}` : 'Not uploaded yet'}</span>
                      </span>
                      <FlagButton on={target in flags} disabled={!canFlag} onClick={() => toggle(target)} />
                    </div>
                    {files.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {files.map((d) => (
                          <a key={d.id} href={d.url} target="_blank" rel="noreferrer" title={`${d.name} · ${whenFull(d.uploadedAt)}`}
                            className="group flex max-w-full items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2 py-1 text-[11px] font-semibold text-[#111111] hover:border-[#F95C4B]/50 dark:border-[#2A2A2A] dark:bg-[#121212] dark:text-white">
                            {d.mimeType?.startsWith('image/') ? <img src={d.url} alt="" className="h-6 w-6 rounded object-cover" /> : <FileText className="h-3.5 w-3.5 text-[#F95C4B]" />}
                            <span className="max-w-[160px] truncate">{d.name}</span>
                            <Eye className="h-3 w-3 text-[#9CA3AF] group-hover:text-[#F95C4B]" />
                          </a>
                        ))}
                      </div>
                    )}
                    {target in flags && (
                      <input autoFocus value={flags[target]} onChange={(e) => setFlags((x) => ({ ...x, [target]: e.target.value }))}
                        placeholder="e.g. The payslip is cut off — please upload the full page"
                        className="mt-2 w-full rounded-lg border border-[#EF4444]/30 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#EF4444] dark:bg-[#121212] dark:text-white" />
                    )}
                  </div>
                )
              })}
            </div>
          </Section>

          {/* Signature */}
          <Section title="Signature & consent" icon={ShieldCheck}>
            {app.signature ? (
              <div className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] p-3 dark:border-[#2A2A2A]">
                {app.signature.url && <img src={app.signature.url} alt="Signature" className="h-14 w-36 rounded-lg bg-white object-contain ring-1 ring-[#E5E7EB]" />}
                <div className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
                  <p className="font-semibold text-[#111111] dark:text-white">{app.signature.signedName}</p>
                  <p>Signed {whenFull(app.signature.signedAt)}{app.signature.place ? ` at ${app.signature.place}` : ''}</p>
                  <p className="mt-0.5">{app.consents?.credit ? '✓ Credit & reference check consent' : '✗ No credit check consent'} · {app.consents?.truthful ? '✓ Declared true' : '✗ Not declared'}</p>
                </div>
              </div>
            ) : app.submittedByTeam ? null : <p className="text-xs text-[#9CA3AF]">Not signed yet — they sign on the last step.</p>}
            {app.submittedByTeam && (
              <p className="flex items-start gap-2 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/[0.06] p-2.5 text-xs text-[#111111] dark:text-white">
                <UserCog className="mt-0.5 h-3.5 w-3.5 flex-none text-[#B45309]" /> Submitted by <b className="mx-1">{app.submittedByTeam}</b> on the tenant's behalf — the tenant agreed to the checks but didn't sign themselves.
              </p>
            )}
          </Section>

          {canFlag && (
            <Section title="Message to the tenant" icon={Flag}>
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Flag answers or documents above with <Flag className="inline h-3 w-3" />, or write a note. They get an email and see each item highlighted on their link.</p>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything else they should know or fix (optional)" className={inputCls(false)} />
            </Section>
          )}

          {/* Timeline */}
          <Section title="Everything that happened" icon={Clock}
            right={!closed && <button type="button" onClick={() => { if (window.confirm('Switch this link off? The tenant will no longer be able to open it.')) withdrawMut.mutate() }} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B7280] hover:text-[#EF4444]"><Ban className="h-3 w-3" /> Switch link off</button>}>
            <ol className="relative space-y-2.5 border-l border-[#E5E7EB] pl-4 dark:border-[#2A2A2A]">
              {(app.events ?? []).slice(0, 40).map((e, i) => (
                <li key={i} className="relative">
                  <span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-[#181818] ${['submitted', 'resubmitted', 'approved'].includes(e.type) ? 'bg-[#10B981]' : ['changes_requested', 'declined', 'withdrawn'].includes(e.type) ? 'bg-[#EF4444]' : e.by === 'Tenant' ? 'bg-[#F95C4B]' : 'bg-[#D4D4D8]'}`} />
                  <p className="text-xs text-[#111111] dark:text-white"><b>{EVENT_LABEL[e.type] ?? e.type}</b>{e.text ? ` — ${e.text}` : ''}</p>
                  <p className="text-[10.5px] text-[#9CA3AF]">{e.by ?? ''} · {whenFull(e.at)}</p>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      )}
    </SidePanel>
  )
}

/* ─── Add a tenant from anywhere: pick a listed rental first ───────────── */

export function NewApplicationModal({ onClose, onCreated }) {
  const [search, setSearch] = useState('')
  const [lead, setLead] = useState(null)
  const [created, setCreated] = useState(null)
  const { data: leads, isLoading } = useQuery({
    queryKey: ['tenant-apps', 'listed-rentals', search],
    queryFn: () => tenantsApi.listedRentals(search).then((r) => r.data.data.leads),
  })
  return (
    <SidePanel onClose={onClose} icon={UserPlus} title={created ? `${created.invitedName} is ready` : 'New tenant application'}
      subtitle={lead ? lead.propertyAddress : 'Pick the listed rental they asked about'} widthClass="sm:max-w-lg">
      <div className="space-y-4 p-5">
        {created ? (
          <>
            <p className="text-sm text-[#111111] dark:text-white">Send <b>{created.invitedName}</b> their private application link:</p>
            <ShareCard app={created} lead={lead} />
            <button type="button" onClick={() => { onCreated?.(created); onClose() }} className="w-full rounded-xl border border-[#E5E7EB] py-2.5 text-sm font-semibold text-[#111111] hover:bg-[#F5F5F4] dark:border-[#2A2A2A] dark:text-white dark:hover:bg-[#202020]">Done</button>
          </>
        ) : lead ? (
          <>
            <button type="button" onClick={() => setLead(null)} className="text-xs font-semibold text-[#6B7280] hover:text-[#F95C4B]">← Choose another property</button>
            <AddTenantForm leadId={lead.id} onCreated={setCreated} />
          </>
        ) : (
          <>
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search address or landlord…" className={inputCls(false)} />
            {isLoading ? <div className="h-24 animate-pulse rounded-xl bg-[#F5F5F4] dark:bg-[#202020]" /> : !leads?.length ? (
              <p className="rounded-xl bg-[#F5F5F4] p-4 text-center text-xs text-[#6B7280] dark:bg-[#202020] dark:text-[#A1A1AA]">No listed rentals you can work on{search ? ' match that' : ' yet'}. A lead needs status <b>Listed</b> and listing type <b>rental</b>.</p>
            ) : (
              <div className="space-y-2">
                {leads.map((l) => (
                  <button key={l.id} type="button" onClick={() => setLead(l)}
                    className="flex w-full items-center gap-3 rounded-xl border border-[#E5E7EB] p-3 text-left hover:border-[#F95C4B]/40 dark:border-[#2A2A2A]">
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#F95C4B]/10"><Building2 className="h-4 w-4 text-[#F95C4B]" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[#111111] dark:text-white">{l.propertyAddress}</span>
                      <span className="block truncate text-xs text-[#6B7280] dark:text-[#A1A1AA]">{l.landlordName}{l.rent ? ` · ${R(l.rent)}/m` : ''}{l.agencyName ? ` · ${l.agencyName}` : ''}</span>
                    </span>
                    {l.applications > 0 && <span className="rounded-full bg-[#F5F5F4] px-2 py-0.5 text-[10px] font-bold text-[#6B7280] dark:bg-[#202020]">{l.applications} applied</span>}
                    <ChevronRight className="h-4 w-4 text-[#9CA3AF]" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </SidePanel>
  )
}



/* ─── Tenant progress on a deal (Deal Tracker table, workflow, inspector) ── */

// Link sent → opened → filling in → to review → approved
export const TENANT_STAGES = [
  { key: 'shared', label: 'Link sent', color: '#9CA3AF' },
  { key: 'opened', label: 'Opened', color: '#3B82F6' },
  { key: 'filling', label: 'Filling in', color: '#F59E0B' },
  { key: 'review', label: 'To review', color: '#8B5CF6' },
  { key: 'approved', label: 'Approved', color: '#10B981' },
]

export function TenantTrack({ stage, size = 'md' }) {
  const i = TENANT_STAGES.findIndex((s) => s.key === stage)
  const cur = TENANT_STAGES[i] ?? TENANT_STAGES[0]
  return (
    <span className={`flex items-center ${size === 'sm' ? 'gap-0.5' : 'gap-1'}`} title={TENANT_STAGES.map((s) => s.label).join(' → ')}>
      {TENANT_STAGES.map((s, n) => (
        <span key={s.key} className={`rounded-full transition-all duration-500 ${size === 'sm' ? 'h-1 w-3' : 'h-1.5 w-4'} ${n === i && stage === 'review' ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: n <= i ? cur.color : 'rgb(156 163 175 / 0.25)' }} />
      ))}
    </span>
  )
}

export function TenantProgressChip({ t }) {
  if (!t) return <span className="text-[11px] text-[#9CA3AF]">No tenants yet</span>
  const st = TENANT_STAGES.find((s) => s.key === t.stage) ?? TENANT_STAGES[0]
  const review = t.counts.submitted + t.counts.fixes
  return (
    <span className="flex flex-col gap-1">
      <span className="inline-flex items-center gap-1.5 self-start rounded-md px-2 py-0.5 text-[11px] font-bold"
        style={{ color: st.color, backgroundColor: `${st.color}1F` }}>
        <span className={`h-1.5 w-1.5 rounded-full ${t.stage === 'review' || t.stage === 'filling' ? 'animate-pulse' : ''}`} style={{ backgroundColor: st.color }} />
        {t.stage === 'approved' ? `${t.approvedName} approved` : t.stage === 'review' ? `${review} to review` : st.label}
      </span>
      <span className="flex items-center gap-2">
        <TenantTrack stage={t.stage} size="sm" />
        <span className="text-[10px] text-[#9CA3AF]">{t.total} tenant{t.total === 1 ? '' : 's'}</span>
      </span>
    </span>
  )
}

// Everyone who applied, for the workflow inspector
export function TenantPeopleList({ t }) {
  if (!t) return null
  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {[['sent', 'Not opened', '#9CA3AF'], ['opened', 'Opened', '#3B82F6'], ['filling', 'Filling in', '#F59E0B'], ['submitted', 'Submitted', '#8B5CF6'], ['fixes', 'Fixes asked', '#EF4444'], ['approved', 'Approved', '#10B981'], ['declined', 'Declined', '#6B7280']]
          .filter(([k]) => t.counts[k]).map(([k, l, c]) => (
            <span key={k} className="rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ color: c, backgroundColor: `${c}1F` }}>{t.counts[k]} {l.toLowerCase()}</span>
          ))}
      </div>
      {t.people.map((p, i) => (
        <div key={i} className="flex items-center gap-2 rounded-xl border border-[#F1EFEC] bg-[#FAFAF9] px-2.5 py-1.5 text-xs dark:border-[#232323] dark:bg-[#141414]">
          <span className="min-w-0 flex-1 truncate font-semibold text-[#111111] dark:text-white">{p.name}</span>
          <StatusPill status={p.status} small />
          <span className="text-[10px] text-[#9CA3AF]">{ago(p.at)}</span>
        </div>
      ))}
    </div>
  )
}
