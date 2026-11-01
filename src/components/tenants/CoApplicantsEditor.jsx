import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Link2, Copy, Check, MessageCircle, Mail, Loader2, PencilLine, Send, Users, CircleCheck, Clock, Eye } from 'lucide-react'
import { applyApi } from '../../services/tenantsApi'
import { R } from '../../lib/tenantForm'
import { Field, inputBase, initials, errText } from './applyUi'

// "Sharing the rent" — the people applying together with the main applicant, each with their
// share of the rent. For each one the main applicant either fills in their details here, or
// sends them their own link to add their part (and sign) themselves.

const SPLIT = ['rgb(var(--brand-rgb))', '#8B5CF6', '#0EA5E9', '#F59E0B', '#10B981']
const HALF = new Set(['idno', 'phone', 'email', 'emp', 'role', 'esince', 'gross', 'net'])
const FIELD_EXTRA = { phone: { type: 'tel' }, email: { type: 'email' }, gross: { num: true, hint: 'Before deductions' }, net: { num: true, hint: 'What they take home' }, esince: { ph: 'e.g. 2021' } }
const STATUS = {
  invited: ['Not opened yet', '#9CA3AF', Clock],
  opened: ['Opened their link', '#3B82F6', Eye],
  in_progress: ['Filling in their part', '#F59E0B', PencilLine],
  done: ['Done & signed', '#15803D', CircleCheck],
}

export function SplitBar({ mainName, mainShare, cos, rent }) {
  const people = [{ name: mainName || 'You', share: mainShare }, ...cos.map((c) => ({ name: c.name, share: Number(c.share) || 0 }))]
  return (
    <div className="space-y-2.5">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-[#EFEFEA]">
        {people.map((p, i) => <span key={i} className="h-full transition-[width] duration-500" style={{ width: `${Math.max(0, p.share)}%`, backgroundColor: SPLIT[i % SPLIT.length] }} />)}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {people.map((p, i) => (
          <span key={i} className="flex items-center gap-1.5 text-[13px] text-[#3F3F46]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SPLIT[i % SPLIT.length] }} />
            <b className="font-semibold text-[#17171A]">{p.name}</b> {p.share}%{rent ? <span className="text-[#8A8A93]"> · {R((rent * p.share) / 100)}</span> : null}
          </span>
        ))}
      </div>
    </div>
  )
}

function OwnLink({ token, co, onShared, flash, readOnly }) {
  const [email, setEmail] = useState(co.form?.email ?? '')
  const [busy, setBusy] = useState(null)
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}/apply/${co.token}`
  const msg = `Hi ${co.name.split(' ')[0]}, I've added you to our rental application. Please add your details, documents and signature here — it takes about 5 minutes:\n${link}`
  async function share(via) {
    if (readOnly) return
    setBusy(via)
    try {
      const { data } = await applyApi.shareCo(token, co.id, { via, email: via === 'email' ? email.trim() : undefined })
      onShared(data.data.coApplicants)
      if (via === 'email') flash(`Emailed to ${email.trim()}`)
      if (via === 'link') { await navigator.clipboard.writeText(msg).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1600) }
    } catch (e) { flash(errText(e, 'Could not share the link'), 'bad') } finally { setBusy(null) }
  }
  const [label, color, Icon] = STATUS[co.status] ?? STATUS.invited
  return (
    <div className="space-y-3 rounded-xl bg-[#F7F7F5] p-3.5">
      <p className="flex items-center gap-2 text-[13px]">
        <Icon className="h-4 w-4" style={{ color }} />
        <b className="font-semibold" style={{ color }}>{label}</b>
        <span className="text-[#8A8A93]">— {co.name.split(' ')[0]} adds their own details, documents and signature.</span>
      </p>
      {co.status !== 'done' && (
        <>
          <div className="flex items-center gap-2 rounded-lg border border-[#E4E4DF] bg-white px-3 py-2">
            <Link2 className="h-4 w-4 flex-none text-[#A1A1AA]" />
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-[#3F3F46]">{link}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={`https://wa.me/${String(co.form?.phone ?? '').replace(/\D/g, '').replace(/^0/, '27')}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"
              onClick={() => share('whatsapp')} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#25D366] px-3 text-[13px] font-medium text-white hover:brightness-95">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            <button type="button" onClick={() => share('link')} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E4E4DF] bg-white px-3 text-[13px] font-medium text-[#3F3F46] hover:bg-[#FBFBF9]">
              {copied ? <Check className="h-4 w-4 text-[#15803D]" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy message'}
            </button>
            <span className="flex min-w-[220px] flex-1 items-center gap-1.5">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Their email" className={`${inputBase} h-9 border-[#D9D9D4] py-1.5`} />
              <button type="button" disabled={!/^\S+@\S+\.\S+$/.test(email.trim()) || busy === 'email'} onClick={() => share('email')}
                className="inline-flex h-9 flex-none items-center gap-1.5 rounded-lg bg-[#F95C4B] px-3 text-[13px] font-medium text-white hover:bg-[#E84B3A] disabled:opacity-50">
                {busy === 'email' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Email
              </button>
            </span>
          </div>
        </>
      )}
    </div>
  )
}

export default function CoApplicantsEditor({ token, mainName, rent, cos, setCos, fields, relations, issueFor, errors = {}, flash, readOnly, onDocs }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const timers = useRef({})
  const pending = useRef({})
  const total = cos.reduce((s, c) => s + (Number(c.share) || 0), 0)
  const mainShare = Math.max(0, 100 - total)

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), [])

  // Instant on screen, saved after a short pause
  function patch(co, change) {
    setCos((list) => list.map((c) => (c.id === co.id ? { ...c, ...change, form: { ...c.form, ...(change.form ?? {}) }, name: change.form?.name ?? change.name ?? c.name } : c)))
    if (readOnly) return
    const p = pending.current[co.id] ?? {}
    pending.current[co.id] = { ...p, ...change, form: { ...(p.form ?? {}), ...(change.form ?? {}) } }
    clearTimeout(timers.current[co.id])
    timers.current[co.id] = setTimeout(async () => {
      const body = pending.current[co.id]
      delete pending.current[co.id]
      try { await applyApi.updateCo(token, co.id, body) } catch (e) { flash(errText(e, 'Could not save — check your signal'), 'bad') }
    }, 600)
  }

  async function add() {
    if (name.trim().length < 2 || readOnly) return
    setBusy(true)
    try {
      const { data } = await applyApi.addCo(token, { name: name.trim(), share: Math.max(1, Math.floor(mainShare / 2)) })
      setCos(data.data.coApplicants)
      setName('')
      setAdding(false)
    } catch (e) { flash(errText(e, 'Could not add them'), 'bad') } finally { setBusy(false) }
  }

  async function remove(co) {
    if (readOnly || !window.confirm(`Remove ${co.name} from the application? Their details and documents will be deleted.`)) return
    try {
      const { data } = await applyApi.removeCo(token, co.id)
      setCos(data.data.coApplicants)
      onDocs?.(data.data.docs)
    } catch (e) { flash(errText(e, 'Could not remove them'), 'bad') }
  }

  return (
    <div className="space-y-4 border-t border-[#EFEFEA] pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-base font-semibold text-[#17171A]"><Users className="h-[18px] w-[18px] text-[#F95C4B]" /> Sharing the rent</p>
          <p className="mt-0.5 text-[13px] text-[#6B6B74]">Everyone who'll live there and pay part of the rent. Fill in their details here, or send them their own link.</p>
        </div>
      </div>

      {cos.length > 0 && (
        <div className="rounded-xl border border-[#E8E8E3] bg-[#FBFBF9] p-4">
          <SplitBar mainName={mainName} mainShare={mainShare} cos={cos} rent={rent} />
          {total >= 100 && <p className="mt-2 text-xs font-medium text-[#DC2626]">The shares add up to 100% or more — leave a share for yourself.</p>}
          {errors.joint && <p className="mt-2 text-xs font-medium text-[#DC2626]">{errors.joint}</p>}
        </div>
      )}

      {cos.map((co, i) => (
        <div key={co.id} className="overflow-hidden rounded-xl border border-[#E4E4DF] bg-white">
          {/* Who, relation, share */}
          <div className="flex flex-wrap items-center gap-3 border-b border-[#EFEFEA] px-4 py-3">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: SPLIT[(i + 1) % SPLIT.length] }}>{initials(co.name)}</span>
            <input value={co.form?.name ?? co.name} onChange={(e) => patch(co, { form: { name: e.target.value } })} disabled={readOnly || co.filledBy === 'self'}
              aria-label="Their full name" className="min-w-[140px] flex-1 border-0 bg-transparent p-0 text-sm font-semibold text-[#17171A] outline-none focus:ring-0 disabled:text-[#17171A]" />
            <select value={co.relation} onChange={(e) => patch(co, { relation: e.target.value })} disabled={readOnly} aria-label="Relationship" className={`${inputBase} h-9 w-auto border-[#D9D9D4] py-1`}>
              {(relations ?? []).map((r) => <option key={r}>{r}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-[13px] text-[#6B6B74]">
              Pays
              <input type="number" min={1} max={95} value={co.share} disabled={readOnly}
                onChange={(e) => patch(co, { share: Math.min(95, Math.max(1, Number(e.target.value) || 1)) })}
                className={`${inputBase} h-9 w-[70px] border-[#D9D9D4] py-1 text-center`} aria-label="Share of the rent in percent" />%
              {rent ? <span className="text-[#8A8A93]">= {R((rent * co.share) / 100)}</span> : null}
            </label>
            {!readOnly && <button type="button" onClick={() => remove(co)} aria-label={`Remove ${co.name}`} className="grid h-8 w-8 place-items-center rounded-lg text-[#A1A1AA] hover:bg-[#FEF2F2] hover:text-[#DC2626]"><Trash2 className="h-4 w-4" /></button>}
          </div>

          <div className="space-y-4 p-4">
            {/* Who fills it in */}
            <div className="inline-flex rounded-lg bg-[#F4F4F1] p-1 text-[13px]">
              {[['main', 'I’ll fill in their details', PencilLine], ['self', 'Send them their own link', Send]].map(([k, l, Icon]) => (
                <button key={k} type="button" disabled={readOnly || (co.status === 'done' && co.filledBy === 'self')} onClick={() => patch(co, { filledBy: k })}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${co.filledBy === k ? 'bg-white text-[#17171A] shadow-sm' : 'text-[#6B6B74] hover:text-[#17171A]'}`}>
                  <Icon className="h-3.5 w-3.5" /> {l}
                </button>
              ))}
            </div>

            {co.filledBy === 'self' ? (
              <OwnLink token={token} co={co} onShared={setCos} flash={flash} readOnly={readOnly} />
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                {fields.filter((f) => f.key !== 'name').map((f) => (
                  <Field key={f.key} idPrefix={`co-${co.id}`} f={{ ...f, ...(FIELD_EXTRA[f.key] ?? {}), half: HALF.has(f.key) }}
                    value={co.form?.[f.key]} onChange={(v) => patch(co, { form: { [f.key]: v } })}
                    error={errors[`co:${co.id}:${f.key}`]} issue={issueFor(`co:${co.id}:field:${f.key}`)} />
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {!readOnly && cos.length < 4 && (adding ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-[#D9D9D4] p-3">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Their full name, e.g. Thandi Ndlovu"
            className={`${inputBase} h-10 min-w-[200px] flex-1 border-[#D9D9D4]`} />
          <button type="button" onClick={add} disabled={busy || name.trim().length < 2} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#F95C4B] px-4 text-sm font-medium text-white hover:bg-[#E84B3A] disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
          </button>
          <button type="button" onClick={() => setAdding(false)} className="h-10 rounded-lg px-3 text-sm text-[#6B6B74] hover:text-[#17171A]">Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#D9D9D4] py-3 text-sm font-medium text-[#3F3F46] transition-colors hover:border-[#F95C4B]/50 hover:text-[#F95C4B]">
          <Plus className="h-4 w-4" /> {cos.length ? 'Add another person' : 'Add the person sharing the rent'}
        </button>
      ))}
    </div>
  )
}
