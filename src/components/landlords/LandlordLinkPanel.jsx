import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatDistanceToNow, format } from 'date-fns'
import {
  FileSignature, Copy, Check, MessageCircle, Eye, Loader2, Lock, Ban, Users, CircleCheck, CircleX, FileText, Send, Clock, RotateCcw,
} from 'lucide-react'
import { landlordLinksApi } from '../../services/landlordsApi'
import { getApiErrorMessage } from '../leads/leadShared'
import { DateField } from '../common/DateTimeFields'

// The landlord's consent link on a lead — made from the Deal Tracker by Reliable Touch admin and
// follow-up managers, or the company's managers. Step 1: what we ask for (already filled in
// from the lead), then share it on WhatsApp and watch it go Sent → Opened → Signed. Once
// signed: what the landlord gave us (details, ID, proof of ownership, signature), and step 2 —
// share finished tenant applications so the landlord can approve one on the same link.

const key = (leadId) => ['landlord-link', leadId]
const ago = (d) => (d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : null)
const R = (n) => (n ? `R${Math.round(Number(n)).toLocaleString('en-ZA').replace(/,/g, ' ')}` : '—')
const STAGES = [['sent', 'Sent'], ['opened', 'Opened'], ['signed', 'Signed']]
const MANDATES = [['sole', 'Sole', 'Only your company'], ['open', 'Open', 'Other agents allowed'], ['choose', 'Let them choose', 'Both on the link']]
const chip = (on) => `flex-1 min-w-[110px] rounded-xl border px-3 py-2 text-left transition-colors ${on ? 'border-[#F95C4B] bg-[#F95C4B]/[0.07]' : 'border-[#E5E7EB] bg-white hover:border-[#F95C4B]/40 dark:border-[#2A2A2A] dark:bg-[#181818]'}`
const input = 'w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#F95C4B] dark:border-[#2A2A2A] dark:bg-[#141414] dark:text-white'

export default function LandlordLinkPanel({ leadId }) {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: key(leadId),
    queryFn: () => landlordLinksApi.forLead(leadId).then((r) => r.data.data),
    refetchInterval: 30_000,
  })
  const put = (link) => qc.setQueryData(key(leadId), (d) => ({ ...d, link }))
  const refresh = () => { qc.invalidateQueries({ queryKey: ['deal-tracker'] }) }

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#F95C4B]" /></div>
  if (error) return <p className="flex items-center gap-2 rounded-xl bg-[#FAFAF9] p-4 text-sm text-[#6B7280] dark:bg-[#141414] dark:text-[#A1A1AA]"><Lock className="h-4 w-4" /> {getApiErrorMessage(error, 'Only a manager or Reliable Touch can send the landlord’s link.')}</p>
  if (!data.link) return <MakeLink leadId={leadId} data={data} onMade={(l) => { put(l); refresh() }} />
  return <LinkStatus leadId={leadId} data={data} link={data.link} put={put} refresh={refresh} />
}

/* ─── Step 1: what we ask for ───────────────────────────────────────────── */

function Terms({ value, onChange }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-semibold text-[#111111] dark:text-white">The landlord gives you permission to</p>
        <div className="flex flex-wrap gap-2">
          {[['let', 'Rent it out'], ['sell', 'Sell it']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => onChange({ ...value, kind: k })} className={chip(value.kind === k)}>
              <span className="block text-sm font-semibold text-[#111111] dark:text-white">{l}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-[#111111] dark:text-white">Mandate</p>
        <div className="flex flex-wrap gap-2">
          {MANDATES.map(([k, l, s]) => (
            <button key={k} type="button" onClick={() => onChange({ ...value, mandate: k })} className={chip(value.mandate === k)}>
              <span className="block text-sm font-semibold text-[#111111] dark:text-white">{l}</span>
              <span className="block text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">{s}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[#111111] dark:text-white">{value.kind === 'sell' ? 'Asking price' : 'Monthly rent'}</span>
          <span className="relative block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#9CA3AF]">R</span>
            <input value={value.price ?? ''} onChange={(e) => onChange({ ...value, price: e.target.value.replace(/[^\d]/g, '') })} inputMode="numeric" className={`${input} pl-7`} />
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[#111111] dark:text-white">For how long</span>
          <select value={value.periodDays} onChange={(e) => onChange({ ...value, periodDays: Number(e.target.value) })} className={input}>
            {[30, 60, 90, 120, 180].map((n) => <option key={n} value={n}>{n} days</option>)}
          </select>
        </label>
        <div>
          <span className="mb-1 block text-xs font-semibold text-[#111111] dark:text-white">Available from</span>
          <DateField value={value.availableFrom ? String(value.availableFrom).slice(0, 10) : ''} onChange={(v) => onChange({ ...value, availableFrom: v || null })} className={input} />
        </div>
      </div>
    </div>
  )
}

function MakeLink({ leadId, data, onMade }) {
  const [t, setT] = useState(data.defaults)
  const make = useMutation({
    mutationFn: () => landlordLinksApi.upsert(leadId, t),
    onSuccess: (r) => { onMade(r.data.data.link); toast.success('Link ready — send it to the landlord') },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not make the link')),
  })
  if (!data.eligible) {
    return <p className="rounded-xl bg-[#FAFAF9] p-4 text-sm text-[#6B7280] dark:bg-[#141414] dark:text-[#A1A1AA]">The landlord’s consent link opens once the lead is <b>hot</b> or <b>listed</b>. This one is {String(data.leadStatus).replace(/_/g, ' ')}.</p>
  }
  const p = data.prefill
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#3F3F46] dark:text-[#D4D4D8]">The landlord signs their permission on their phone: they upload their ID and proof of ownership, read and agree, and sign. It opens in {data.property.agency ?? 'Reliable Touch'}’s colours{data.contact ? ` with ${data.contact.name} as their contact` : ''}.</p>
      <div className="rounded-xl bg-[#FAFAF9] p-3 text-xs text-[#6B7280] dark:bg-[#141414] dark:text-[#A1A1AA]">
        <p className="mb-1 font-semibold text-[#111111] dark:text-white">Already filled in for them</p>
        <p>{[p.name, p.phone, p.email, p.idNumber && `ID ${p.idNumber}`].filter(Boolean).join(' · ') || 'Their name and number from the lead'}</p>
        <p>{data.property.address}</p>
      </div>
      <Terms value={t} onChange={setT} />
      <button type="button" onClick={() => make.mutate()} disabled={make.isPending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F95C4B] py-3 text-sm font-semibold text-white hover:bg-[#E84B3A] disabled:opacity-60">
        {make.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} Make the landlord’s link
      </button>
    </div>
  )
}

/* ─── The link and where it is ──────────────────────────────────────────── */

function LinkStatus({ leadId, data, link, put, refresh }) {
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [t, setT] = useState(link.terms)
  useEffect(() => setT(link.terms), [link.terms])
  const signed = link.status === 'signed'
  const off = link.status === 'withdrawn'
  const at = STAGES.findIndex(([k]) => k === link.status)
  const first = (link.form?.name || data.prefill.name || '').split(' ')[0] || 'there'
  const verb = link.terms.kind === 'sell' ? 'sell' : 'rent out'
  const who = data.contact?.name ?? 'your agent'
  const message = `Hi ${first}, it's ${who.split(' ')[0]} from ${data.property.agency ?? 'Reliable Touch'}. Here is the link to give us permission to ${verb} ${data.property.address}. It takes about 5 minutes on your phone — please have your ID and your rates bill or title deed ready.\n${link.url}`
  const phone = String(data.prefill.phone ?? '').replace(/\D/g, '').replace(/^0/, '27')

  const log = (via) => landlordLinksApi.shared(link.id, via).then((r) => put(r.data.data.link)).catch(() => {})
  const save = useMutation({
    mutationFn: () => landlordLinksApi.upsert(leadId, t),
    onSuccess: (r) => { put(r.data.data.link); setEditing(false); refresh(); toast.success(off ? 'Link switched back on' : 'Saved — the link shows the new terms') },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not save')),
  })
  const stop = useMutation({
    mutationFn: () => landlordLinksApi.withdraw(link.id),
    onSuccess: (r) => { put(r.data.data.link); refresh(); toast.success('Link switched off') },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not switch it off')),
  })

  return (
    <div className="space-y-4">
      {/* Where it is */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {off ? <span className="rounded-md bg-[#EF4444]/10 px-2 py-1 font-semibold text-[#EF4444]">Switched off</span> : STAGES.map(([k, l], i) => (
          <span key={k} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-[#D4D4D8]">→</span>}
            <span className={`rounded-md px-2 py-1 font-semibold ${i <= at ? 'bg-[#10B981]/12 text-[#059669] dark:text-[#34D399]' : 'bg-[#F5F5F4] text-[#9CA3AF] dark:bg-[#202020]'}`}>{l}</span>
          </span>
        ))}
        <span className="ml-auto text-[#9CA3AF]">{signed ? `Signed ${ago(link.signature?.signedAt)}` : link.lastOpenedAt ? `Opened ${ago(link.lastOpenedAt)} · ${link.openCount}×` : link.sharedAt ? `Sent ${ago(link.sharedAt)}` : 'Not sent yet'}</span>
      </div>

      {/* Send it */}
      {!signed && !off && (
        <div className="space-y-2.5 rounded-xl border border-[#E5E7EB] p-3.5 dark:border-[#2A2A2A]">
          <p className="whitespace-pre-wrap rounded-lg bg-[#FAFAF9] p-3 text-[13px] text-[#3F3F46] dark:bg-[#141414] dark:text-[#D4D4D8]">{message}</p>
          <div className="flex flex-wrap gap-2">
            <a href={`https://wa.me/${phone.length >= 10 ? phone : ''}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" onClick={() => log('whatsapp')}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1EBE5A]">
              <MessageCircle className="h-4 w-4" /> Send on WhatsApp
            </a>
            <button type="button" onClick={() => { navigator.clipboard?.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 1800); log('link') }}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] px-4 py-2.5 text-sm font-semibold text-[#111111] hover:bg-[#F5F5F4] dark:border-[#2A2A2A] dark:text-white dark:hover:bg-[#202020]">
              {copied ? <Check className="h-4 w-4 text-[#10B981]" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}
            </button>
            <a href={`${new URL(link.url).pathname}?preview=1`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] px-4 py-2.5 text-sm font-semibold text-[#111111] hover:bg-[#F5F5F4] dark:border-[#2A2A2A] dark:text-white dark:hover:bg-[#202020]">
              <Eye className="h-4 w-4" /> See what they see
            </a>
          </div>
        </div>
      )}

      {/* Terms */}
      {!signed && (editing || off ? (
        <div className="space-y-3 rounded-xl border border-[#E5E7EB] p-3.5 dark:border-[#2A2A2A]">
          <Terms value={t} onChange={setT} />
          <div className="flex gap-2">
            {!off && <button type="button" onClick={() => { setT(link.terms); setEditing(false) }} className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#6B7280] dark:border-[#2A2A2A]">Cancel</button>}
            <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#F95C4B] py-2 text-sm font-semibold text-white hover:bg-[#E84B3A] disabled:opacity-60">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : off ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />} {off ? 'Switch it back on' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-xs text-[#6B7280] dark:text-[#A1A1AA]">
          <span className="flex-1">{link.terms.kind === 'sell' ? 'Sell' : 'Rent out'} · {link.terms.mandate === 'choose' ? 'they choose sole or open' : `${link.terms.mandate} mandate`} · {link.terms.periodDays} days · {R(link.terms.price)}</span>
          <button type="button" onClick={() => setEditing(true)} className="font-semibold text-[#F95C4B] hover:underline">Change</button>
          <button type="button" onClick={() => { if (window.confirm('Switch the landlord’s link off?')) stop.mutate() }} className="inline-flex items-center gap-1 font-semibold hover:text-[#EF4444]"><Ban className="h-3 w-3" /> Switch off</button>
        </div>
      ))}

      {signed && <Signed link={link} />}
      {signed && <ShareApplicants link={link} put={put} refresh={refresh} />}

      {/* What happened */}
      {link.events?.length > 0 && (
        <details className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A]">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA]"><Clock className="h-3.5 w-3.5" /> Everything that happened</summary>
          <ol className="space-y-1.5 px-3.5 pb-3">
            {link.events.map((e, i) => (
              <li key={i} className="text-xs text-[#3F3F46] dark:text-[#D4D4D8]"><b>{e.text ?? e.type}</b> <span className="text-[#9CA3AF]">· {e.by ?? ''} · {format(new Date(e.at), 'd MMM, HH:mm')}</span></li>
            ))}
          </ol>
        </details>
      )}
    </div>
  )
}

function Signed({ link }) {
  const f = link.form ?? {}
  const rows = [['Name', f.name], ['ID / passport', f.idNumber], ['Mobile', f.phone], ['Email', f.email], ['Owns it', [f.ownership, f.coName].filter(Boolean).join(' — ')], ['Mandate', `${link.mandateType ?? link.terms.mandate} · ${link.terms.periodDays} days`], ['Signed at', link.signature?.place]]
  return (
    <div className="space-y-3 rounded-xl border border-[#10B981]/30 bg-[#10B981]/[0.05] p-3.5">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#059669] dark:text-[#34D399]"><CircleCheck className="h-4 w-4" /> {f.name} signed {link.signature?.signedAt ? format(new Date(link.signature.signedAt), 'd MMM yyyy, HH:mm') : ''} — you can market it</p>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
        {rows.filter(([, v]) => v).map(([k, v]) => <div key={k} className="flex gap-2"><dt className="w-24 flex-none text-[#9CA3AF]">{k}</dt><dd className="min-w-0 font-medium text-[#111111] [overflow-wrap:anywhere] dark:text-white">{v}</dd></div>)}
      </dl>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {(link.docs ?? []).map((d) => (
          <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-xs hover:ring-1 hover:ring-[#F95C4B]/40 dark:bg-[#181818]">
            <FileText className="h-4 w-4 flex-none text-[#F95C4B]" />
            <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-[#111111] dark:text-white">{d.label}</span><span className="block truncate text-[#9CA3AF]">{d.name}</span></span>
          </a>
        ))}
      </div>
      {link.signature?.url && <img src={link.signature.url} alt="Signature" className="h-14 w-40 rounded-lg bg-white object-contain ring-1 ring-[#E5E7EB]" />}
    </div>
  )
}

/* ─── Step 2: tenants for the landlord to choose from ───────────────────── */

function ShareApplicants({ link, put, refresh }) {
  const apps = link.review.applications
  const [picked, setPicked] = useState(() => new Set(link.review.shared))
  useEffect(() => setPicked(new Set(link.review.shared)), [link.review.shared])
  const share = useMutation({
    mutationFn: () => landlordLinksApi.shareApplications(link.id, [...picked]),
    onSuccess: (r) => { put(r.data.data.link); refresh(); toast.success('Shared — the landlord sees them on their link') },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not share them')),
  })
  const changed = [...picked].sort().join() !== [...link.review.shared].sort().join()
  return (
    <div className="space-y-2.5 rounded-xl border border-[#E5E7EB] p-3.5 dark:border-[#2A2A2A]">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#111111] dark:text-white"><Users className="h-4 w-4 text-[#F95C4B]" /> Let the landlord choose a tenant</p>
      <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Tick the finished applications to show on their link. They see the details and look at the documents — they can’t download them — and approve one.</p>
      {!apps.length ? <p className="text-xs text-[#9CA3AF]">No tenant applications on this property yet.</p> : (
        <ul className="space-y-1.5">
          {apps.map((a) => {
            const on = picked.has(a.id)
            const verdict = link.review.approvedId === a.id ? 'approved' : a.landlord?.decision
            return (
              <li key={a.id}>
                <label className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm ${a.shareable ? 'cursor-pointer hover:bg-[#FAFAF9] dark:hover:bg-[#141414]' : 'opacity-50'}`}>
                  <input type="checkbox" disabled={!a.shareable} checked={on} onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(a.id); else n.delete(a.id); return n })} className="h-4 w-4" />
                  <span className="min-w-0 flex-1 truncate font-medium text-[#111111] dark:text-white">{a.name}</span>
                  {verdict === 'approved' ? <span className="inline-flex items-center gap-1 rounded-full bg-[#10B981]/12 px-2 py-0.5 text-[11px] font-bold text-[#059669] dark:text-[#34D399]"><CircleCheck className="h-3 w-3" /> Landlord approved</span>
                    : verdict === 'declined' ? <span className="inline-flex items-center gap-1 rounded-full bg-[#EF4444]/10 px-2 py-0.5 text-[11px] font-bold text-[#EF4444]"><CircleX className="h-3 w-3" /> Landlord declined</span>
                      : !a.shareable ? <span className="text-[11px] text-[#9CA3AF]">Not submitted yet</span>
                        : link.review.shared.includes(a.id) ? <span className="text-[11px] text-[#9CA3AF]">With the landlord</span> : null}
                </label>
                {a.landlord?.note && <p className="ml-9 text-[11px] italic text-[#6B7280] dark:text-[#A1A1AA]">“{a.landlord.note}”</p>}
              </li>
            )
          })}
        </ul>
      )}
      {apps.some((a) => a.shareable) && (
        <button type="button" onClick={() => share.mutate()} disabled={!changed || share.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F95C4B] py-2.5 text-sm font-semibold text-white hover:bg-[#E84B3A] disabled:opacity-40">
          {share.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {changed ? `Show ${picked.size} to the landlord` : 'Shared'}
        </button>
      )}
    </div>
  )
}
