import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  ShieldCheck, Clock, FileText, Check, Loader2, AlertTriangle, PenLine, Home, Users, Eye, X, ChevronRight, ArrowLeft,
  CircleCheck, CircleX, Briefcase, Wallet, CalendarDays, PawPrint, BadgeCheck, Lock, IdCard,
} from 'lucide-react'
import { landlordApi } from '../../services/landlordsApi'
import { applyBrand, clearBrand } from '../../lib/brand'
import SignaturePad from '../../components/tenants/SignaturePad'
import {
  Field, Callout, Choice, DocSlot, ContactCard, PropertyCard, SumCard, ApplyLayout, Toast, AboutSheet, Panel,
  primaryBtn, backBtn, fmtDate, errText,
} from '../../components/tenants/applyUi'

// The landlord's private link — sent from the Deal Tracker on WhatsApp. It opens in the
// company's own colour and logo with their agent's details. Five short steps: confirm the
// property, read the agreement in plain words and tick what they allow, check their details
// (already filled in from what we know), add their ID and proof of ownership, and sign with a
// finger. Later the same link shows the tenants the team shares: view only — the documents open
// on screen and are never handed out as files — and the landlord approves one.

const LABELS = ['Your property', 'The agreement', 'Your details', 'Documents', 'Sign']
const OWNERSHIP = ['In my own name', 'Together with someone else', 'A company or trust']
const R = (n) => (n ? `R${Math.round(Number(n)).toLocaleString('en-ZA').replace(/,/g, ' ')}` : null)

const MANDATE = {
  sole: {
    title: 'Sole mandate', sub: (a, days) => `Only ${a} markets your property for ${days} days.`,
    rules: (a, days, k) => [
      `Only ${a} advertises and shows your property for ${days} days.`,
      `If someone contacts you about it directly, you send them to your agent.`,
      `If it is ${k.done} in those ${days} days, ${a} earns its commission as agreed with your agent.`,
      `In return you get full marketing and every ${k.client} is checked first.`,
    ],
  },
  open: {
    title: 'Open mandate', sub: (a) => `${a} markets your property — and you may use other agents too.`,
    rules: (a, days, k) => [
      `You can also list with other agents, or find someone yourself.`,
      `${a} only earns commission if they bring the ${k.client} who signs.`,
      `There is no exclusivity, so marketing is lighter.`,
      `You can end it by telling your agent in writing.`,
    ],
  },
}
const KIND = {
  let: { verb: 'rent out', done: 'rented out', client: 'tenant', clients: 'tenants', label: 'To rent', title: 'Authority to rent out' },
  sell: { verb: 'sell', done: 'sold', client: 'buyer', clients: 'buyers', label: 'To sell', title: 'Authority to sell' },
}

export default function LandlordPage() {
  const { token } = useParams()
  const [params] = useSearchParams()
  const preview = params.has('preview')
  const [d, setD] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [form, setForm] = useState({})
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(null)
  const [saveState, setSaveState] = useState('saved')
  const [toast, setToast] = useState(null)
  const [about, setAbout] = useState(false)
  const [place, setPlace] = useState('')
  const [hasSig, setHasSig] = useState(false)
  const sig = useRef(null)
  const saveTimer = useRef(null)

  const say = useCallback((msg, tone) => { setToast({ msg, tone }); setTimeout(() => setToast(null), 2800) }, [])

  useEffect(() => {
    let alive = true
    landlordApi.open(token, preview).then((r) => {
      if (!alive) return
      const l = r.data.data.link
      setD(l); setForm(l.form ?? {}); setStep(l.status === 'signed' ? 6 : l.step ?? 0)
      applyBrand(l.brand?.color)
    }).catch((e) => setLoadError(errText(e, 'This link is not valid')))
    return () => { alive = false; clearBrand() }
  }, [token, preview])

  // Save answers as they're typed (not in preview)
  const persist = useCallback((patch) => {
    if (preview) return
    setSaveState('saving')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      landlordApi.save(token, patch).then((r) => { setD(r.data.data.link); setSaveState('saved') }).catch(() => setSaveState('error'))
    }, 500)
  }, [token, preview])
  const setField = (k, v) => { const f = { ...form, [k]: v }; setForm(f); setErrors((e) => ({ ...e, [k]: null })); persist({ form: f }) }
  const setConsent = (k, v) => {
    const c = { ...d.consents, [k]: v }
    setD((x) => ({ ...x, consents: c }))
    if (!preview) landlordApi.save(token, { consents: { [k]: v } }).then((r) => setD(r.data.data.link)).catch(() => say('Could not save — check your signal', 'bad'))
  }
  const go = (n) => {
    setStep(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (!preview && n >= 1 && n <= 5) landlordApi.save(token, { step: n }).catch(() => {})
  }

  if (loadError) return <Dead title="This link doesn’t work" text={loadError} />
  if (!d) return <div className="grid min-h-[100svh] place-items-center bg-[#F7F7F5]"><Loader2 className="h-6 w-6 animate-spin text-[#F95C4B]" /></div>
  if (d.closed) return <Dead title="This link was switched off" text="Ask your agent to send you a new one." brand={d.brand} />

  const brand = d.brand
  const a = brand.name
  const k = KIND[d.terms.kind] ?? KIND.let
  const days = d.terms.periodDays
  const mandate = d.terms.mandate === 'choose' ? d.mandateType : d.terms.mandate
  const prop = { address: d.property.address, rent: d.property.kind === 'let' ? d.property.price : null, availability: d.property.availableFrom ? fmtDate(d.property.availableFrom) : d.property.availability, kindLabel: k.label }
  const first = (form.name || 'there').split(' ')[0]
  const signed = d.status === 'signed'

  const docsBy = (key) => (d.docs ?? []).filter((x) => x.key === key)
  async function upload(key, files) {
    if (preview) return say('Preview — nothing is saved', 'bad')
    setBusy(key)
    try { const r = await landlordApi.upload(token, key, files); setD(r.data.data.link); say('Added') } catch (e) { say(errText(e, 'Could not upload that file'), 'bad') } finally { setBusy(null) }
  }
  async function remove(doc) {
    if (preview) return
    try { const r = await landlordApi.remove(token, doc.id); setD(r.data.data.link) } catch (e) { say(errText(e, 'Could not remove it'), 'bad') }
  }

  // ── Checks before moving on ───────────────────────────────────────────
  function check(n) {
    if (n === 2) {
      if (d.terms.mandate === 'choose' && !d.mandateType) { say('Choose a sole or an open mandate', 'bad'); return false }
      const c = d.consents
      if (!(c.market && c.advertise && c.share && c.popia)) { say('Tick each box to agree', 'bad'); return false }
    }
    if (n === 3) {
      const e = {}
      if (!String(form.name ?? '').trim()) e.name = 'Type your full name'
      if (!String(form.idNumber ?? '').trim()) e.idNumber = 'Type your ID or passport number'
      if (!String(form.phone ?? '').trim()) e.phone = 'Type your mobile number'
      if (!/^\S+@\S+\.\S+$/.test(String(form.email ?? ''))) e.email = 'Type an email we can send your copy to'
      if (!form.ownership) e.ownership = 'Choose one'
      if (form.ownership && form.ownership !== OWNERSHIP[0] && !String(form.coName ?? '').trim()) e.coName = 'Type their name'
      setErrors(e)
      if (Object.keys(e).length) { say('A few details are missing', 'bad'); return false }
    }
    if (n === 4) {
      const miss = (d.docSlots ?? []).filter((s) => s.required && !docsBy(s.key).length)
      if (miss.length) { say(`Add: ${miss.map((s) => s.label.toLowerCase()).join(' and ')}`, 'bad'); return false }
    }
    return true
  }
  const next = () => { if (check(step)) go(step + 1) }

  async function doSign() {
    if (preview) return say('Preview — the landlord signs here', 'bad')
    if (!d.consents.owner) return say('Tick the box to confirm you may sign', 'bad')
    if (!place.trim()) return say('Type the town you are in', 'bad')
    const png = sig.current?.toDataURL()
    if (!png) return say('Sign in the box with your finger', 'bad')
    setBusy('sign')
    try { const r = await landlordApi.sign(token, { signature: png, place }); setD(r.data.data.link); go(6) } catch (e) { say(errText(e, 'Could not sign — try again'), 'bad') } finally { setBusy(null) }
  }

  // ── The step on screen ────────────────────────────────────────────────
  let title = '', sub = null, body = null, actions = null, footNote = null
  if (signed) {
    const review = d.review
    title = review?.applications?.length ? `Choose your ${k.client}` : `Done, ${first}. Thank you.`
    sub = review?.applications?.length ? `${a} checked these ${k.clients} for ${d.property.address}. Look at each one, then approve the one you want.` : `You signed on ${fmtDate(d.signature?.signedAt)}. ${a} can now ${k.verb} your property.`
    body = review?.applications?.length ? <Applicants token={token} d={d} k={k} say={say} preview={preview} onChange={(link) => setD((x) => ({ ...x, review: link }))} /> : <WhatNext d={d} k={k} a={a} />
  } else if (step === 0) {
    title = `Hi ${first}, ${a} is asking for your permission to ${k.verb} your property.`
    sub = 'It takes about 5 minutes on your phone.'
    body = (
      <div className="space-y-4">
        {d.contact && <ContactCard contact={d.contact} brand={brand} />}
        <Panel className="space-y-2.5 p-4">
          <p className="text-sm font-semibold text-[#17171A]">What you need</p>
          <p className="flex items-center gap-2 text-sm text-[#3F3F46]"><Clock className="h-4 w-4 text-[#F95C4B]" /> About 5 minutes</p>
          <p className="flex items-center gap-2 text-sm text-[#3F3F46]"><IdCard className="h-4 w-4 text-[#F95C4B]" /> A photo of your ID</p>
          <p className="flex items-center gap-2 text-sm text-[#3F3F46]"><FileText className="h-4 w-4 text-[#F95C4B]" /> Your rates bill or title deed</p>
          <p className="flex items-center gap-2 text-sm text-[#3F3F46]"><PenLine className="h-4 w-4 text-[#F95C4B]" /> Your finger to sign</p>
        </Panel>
        {brand.verified && <Callout icon={ShieldCheck}>{a} is registered with the Property Practitioners Regulatory Authority (PPRA). <button type="button" onClick={() => setAbout(true)} className="font-semibold underline underline-offset-2">See their details</button></Callout>}
      </div>
    )
    actions = primaryBtn('Start', () => go(1))
  } else if (step === 1) {
    title = 'Is this the right property?'
    sub = 'Your agent filled this in. If something is wrong, call them before you go on.'
    body = (
      <div className="space-y-4">
        <PropertyCard prop={prop} />
        <SumCard title="What your agent wrote" rows={[
          ['Address', d.property.address], ['Area', d.property.area],
          [k.verb === 'sell' ? 'Asking price' : 'Rent', d.terms.price ? `${R(d.terms.price)}${d.terms.kind === 'let' ? ' a month' : ''}` : 'To agree with your agent'],
          ['Available from', d.terms.availableFrom ? fmtDate(d.terms.availableFrom) : d.property.availability || 'To agree'],
        ]} />
        {d.contact?.phone && <p className="text-[13px] text-[#6B6B74]">Something wrong? <a href={`tel:${d.contact.phone}`} className="font-semibold text-[#F95C4B] underline underline-offset-2">Call {d.contact.name.split(' ')[0]}</a></p>}
      </div>
    )
    actions = <>{backBtn(() => go(0))}{primaryBtn('Yes, that’s right', next)}</>
  } else if (step === 2) {
    const m = MANDATE[mandate]
    title = 'The agreement, in plain words'
    sub = `You are giving ${a} permission to ${k.verb} your property. Read it, then tick each box.`
    body = (
      <div className="space-y-5">
        {d.terms.mandate === 'choose' && (
          <div className="space-y-2.5">
            <p className="text-sm font-semibold text-[#17171A]">Choose one</p>
            {['sole', 'open'].map((t) => (
              <Choice key={t} active={d.mandateType === t} icon={t === 'sole' ? BadgeCheck : Users} title={MANDATE[t].title} sub={MANDATE[t].sub(a, days)}
                onClick={() => { setD((x) => ({ ...x, mandateType: t })); if (!preview) landlordApi.save(token, { mandateType: t }).then((r) => setD(r.data.data.link)).catch(() => {}) }} />
            ))}
          </div>
        )}
        {m && (
          <Panel className="p-4">
            <p className="mb-2 text-sm font-semibold text-[#17171A]">{k.title} · {m.title} · {days} days</p>
            <ul className="space-y-2 pl-4 text-sm leading-relaxed text-[#3F3F46] [list-style:disc]">{m.rules(a, days, k).map((x) => <li key={x}>{x}</li>)}</ul>
          </Panel>
        )}
        <details className="rounded-xl border border-[#E8E8E3] bg-white">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[#17171A]">Read the full agreement</summary>
          <ol className="space-y-2 px-4 pb-4 pl-8 text-[13px] leading-relaxed text-[#6B6B74] [list-style:decimal]">
            <li>The owner appoints {a}{brand.profile?.ffcNumber ? ` (PPRA FFC ${brand.profile.ffcNumber})` : ''} as {mandate === 'open' ? 'a non-exclusive' : 'the sole'} agent to {k.verb} the property at {d.property.address}.</li>
            <li>This permission lasts {days} days from the day it is signed{mandate === 'open' ? ', and either side may end it in writing' : ''}.</li>
            <li>The agent may advertise the property, with photos, on property websites, social media and in its office, and show it to people who are interested.</li>
            <li>The agent checks every {k.client} first — with their permission — and shares their application with the owner to approve.</li>
            <li>Commission is as agreed between the owner and the agent, and is earned when a {k.client} {mandate === 'open' ? 'introduced by the agent ' : ''}signs during this time.</li>
            <li>The owner confirms they own the property, or may sign for the owner, and that what they gave is true.</li>
            <li>Personal information is kept safely and used only for this, as the Protection of Personal Information Act (POPIA) requires.</li>
          </ol>
        </details>
        <div className="space-y-2.5">
          <Agree on={d.consents.market} set={(v) => setConsent('market', v)}>I give {a} permission to {k.verb} my property for {days} days.</Agree>
          <Agree on={d.consents.advertise} set={(v) => setConsent('advertise', v)}>They may advertise it — with photos — on property websites, social media and in their office.</Agree>
          <Agree on={d.consents.share} set={(v) => setConsent('share', v)}>They may show my property to people who want to {d.terms.kind === 'sell' ? 'buy' : 'rent'} it, after checking them.</Agree>
          <Agree on={d.consents.popia} set={(v) => setConsent('popia', v)}>They may keep my details and documents safely, only for this (POPIA).</Agree>
        </div>
      </div>
    )
    actions = <>{backBtn(() => go(1))}{primaryBtn('I agree', next)}</>
  } else if (step === 3) {
    title = 'Your details'
    sub = 'We filled in what we already know. Check it and fill in the rest.'
    const fields = [
      { key: 'name', label: 'Full name as on your ID', required: true, ac: 'name' },
      { key: 'idNumber', label: 'ID or passport number', required: true, half: true, num: true },
      { key: 'phone', label: 'Mobile number', required: true, half: true, type: 'tel', ac: 'tel' },
      { key: 'email', label: 'Email', required: true, type: 'email', ac: 'email', hint: 'We send your signed copy here.' },
      { key: 'ownership', label: 'Who owns the property?', required: true, opts: OWNERSHIP },
      ...(form.ownership && form.ownership !== OWNERSHIP[0] ? [{ key: 'coName', label: form.ownership === OWNERSHIP[2] ? 'Company or trust name' : 'The other owner’s full name', required: true }] : []),
    ]
    body = <div className="grid grid-cols-2 gap-4">{fields.map((f) => <Field key={f.key} f={f} value={form[f.key]} onChange={(v) => setField(f.key, v)} error={errors[f.key]} idPrefix="ll" />)}</div>
    actions = <>{backBtn(() => go(2))}{primaryBtn('Continue', next)}</>
  } else if (step === 4) {
    title = 'Add your documents'
    sub = 'Take a photo with your phone or choose a file. Every word must be readable.'
    body = (
      <div className="space-y-3">
        {(d.docSlots ?? []).map((s) => (
          <DocSlot key={s.key} slot={s} files={docsBy(s.key)} busy={busy === s.key} onUpload={(f) => upload(s.key, f)} onRemove={remove} readOnly={preview} />
        ))}
        <Callout icon={Lock}>Only {a} sees these. They are stored safely under POPIA.</Callout>
      </div>
    )
    actions = <>{backBtn(() => go(3))}{primaryBtn('Continue', next)}</>
  } else if (step === 5) {
    title = 'Sign'
    sub = 'Check it, then sign with your finger. It counts the same as signing on paper.'
    body = (
      <div className="space-y-4">
        <SumCard title="You are signing" rows={[
          ['Permission', `${k.title} · ${MANDATE[mandate]?.title ?? '—'}`], ['For', `${days} days`], ['Property', d.property.address],
          ['Signed by', form.name], ['ID number', form.idNumber],
        ]} />
        <Agree on={d.consents.owner} set={(v) => setConsent('owner', v)}>I own this property, or I am allowed to sign for the owner, and everything I gave is true.</Agree>
        <Field f={{ key: 'place', label: 'Where are you signing? (town)', required: true, ph: 'e.g. Sandton' }} value={place} onChange={setPlace} idPrefix="ll" />
        <div>
          <p className="mb-1 text-[13px] font-medium text-[#17171A]">Your signature</p>
          <SignaturePad ref={sig} onChange={setHasSig} />
          {!hasSig && <p className="mt-1 text-xs text-[#8A8A93]">Sign inside the box.</p>}
        </div>
      </div>
    )
    actions = <>{backBtn(() => go(4))}{primaryBtn('Sign', doSign, { icon: PenLine, busy: busy === 'sign' })}</>
    footNote = 'Your copy is emailed to you'
  }

  return (
    <>
      <ApplyLayout
        brand={brand} prop={prop} contact={d.contact} labels={LABELS} step={signed ? 6 : step} furthest={Math.max(d.furthestStep ?? 0, step)}
        onGo={(n) => go(n)} finished={signed} closed={false} saveState={saveState} showSave={!signed && step > 0 && !preview} onAbout={() => setAbout(true)}
        stepsTitle="Your consent" subtitle="Landlord consent"
        banner={preview ? <div className="border-b border-[#3B82F6]/25 bg-[#EFF6FF] px-4 py-2.5 text-center text-[13px] text-[#1D4ED8]">Preview — this is what the landlord sees. Nothing you do here is saved.</div> : null}
        title={title} sub={sub} body={body} actions={actions} footNote={footNote}
      />
      {about && <AboutSheet brand={brand} contact={d.contact} onClose={() => setAbout(false)} />}
      <Toast toast={toast} />
    </>
  )
}

function Agree({ on, set, children }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-3.5 text-sm leading-relaxed transition-colors ${on ? 'border-[#F95C4B]/50 bg-[#F95C4B]/[0.04]' : 'border-[#E4E4DF] hover:border-[#F95C4B]/40'}`}>
      <input type="checkbox" checked={Boolean(on)} onChange={(e) => set(e.target.checked)} className="mt-0.5 h-5 w-5 flex-none" />
      <span className="text-[#17171A]">{children}</span>
    </label>
  )
}

function WhatNext({ d, k, a }) {
  const steps = [
    ['Permission signed', 'Done', true],
    [`${a} advertises your property`, 'Starting now', false],
    [`${k.clients[0].toUpperCase()}${k.clients.slice(1)} apply`, `${a} checks each one`, false],
    [`You choose your ${k.client}`, 'Right here, on this same link', false],
  ]
  return (
    <div className="space-y-4">
      <Callout icon={CircleCheck}>A copy of what you signed goes to {d.form?.email || 'your email'}.</Callout>
      <Panel className="p-4">
        <p className="mb-3 text-sm font-semibold text-[#17171A]">What happens next</p>
        <ol className="space-y-3">
          {steps.map(([t, s, done], i) => (
            <li key={t} className="flex items-start gap-3">
              <span className={`grid h-6 w-6 flex-none place-items-center rounded-full text-[11px] font-bold ${done ? 'bg-[#15803D] text-white' : i === 1 ? 'border-2 border-[#F95C4B] text-[#F95C4B]' : 'border border-[#D9D9D4] text-[#A1A1AA]'}`}>{done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}</span>
              <span><span className="block text-sm font-medium text-[#17171A]">{t}</span><span className="block text-xs text-[#8A8A93]">{s}</span></span>
            </li>
          ))}
        </ol>
      </Panel>
      {d.contact && <ContactCard contact={d.contact} brand={d.brand} />}
    </div>
  )
}

/* ─── Choosing a tenant ─────────────────────────────────────────────────── */

function Applicants({ token, d, k, say, preview, onChange }) {
  const [openId, setOpenId] = useState(null)
  const apps = d.review.applications
  if (openId) return <Applicant token={token} id={openId} k={k} say={say} preview={preview} back={() => setOpenId(null)} onDecided={(app) => {
    onChange({ ...d.review, approvedId: app.approvedId, applications: apps.map((x) => (x.id === app.id ? { ...x, decision: app.decision?.decision ?? null } : x)) })
  }} />
  return (
    <div className="space-y-3">
      {d.review.approvedId && <Callout icon={CircleCheck}>You approved a {k.client}. Your agent will be in touch about the next steps.</Callout>}
      {apps.map((x) => (
        <button key={x.id} type="button" onClick={() => setOpenId(x.id)} className="w-full rounded-2xl border border-[#E4E4DF] bg-white p-4 text-left transition-all hover:border-[#F95C4B]/50 hover:shadow-sm">
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold text-[#17171A]">{x.name}</span>
              <span className="block truncate text-[13px] text-[#6B6B74]">{x.work || (x.type === 'company' ? 'Company' : 'Individual')}</span>
            </span>
            <Verdict decision={x.decision} approved={d.review.approvedId === x.id} />
          </span>
          <span className="mt-3 grid grid-cols-3 gap-2">
            <Mini label={x.rentShare != null ? 'Rent of income' : 'Income'} value={x.rentShare != null ? `${x.rentShare}%` : R(x.income) ?? '—'} good={x.rentShare != null && x.rentShare <= 33} />
            <Mini label="Documents" value={String(x.docs)} />
            <Mini label="Moves in" value={x.moveIn ? new Date(x.moveIn).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) : '—'} />
          </span>
          <span className="mt-3 flex items-center justify-end gap-1 text-[13px] font-semibold text-[#F95C4B]">Look at {x.name.split(' ')[0]} <ChevronRight className="h-4 w-4" /></span>
        </button>
      ))}
    </div>
  )
}

function Verdict({ decision, approved }) {
  if (approved) return <span className="inline-flex flex-none items-center gap-1 rounded-full bg-[#15803D]/10 px-2.5 py-1 text-xs font-semibold text-[#15803D]"><Check className="h-3.5 w-3.5" /> Approved</span>
  if (decision === 'declined') return <span className="flex-none rounded-full bg-[#DC2626]/10 px-2.5 py-1 text-xs font-semibold text-[#DC2626]">Declined</span>
  return <span className="flex-none rounded-full bg-[#F95C4B]/10 px-2.5 py-1 text-xs font-semibold text-[#F95C4B]">Waiting for you</span>
}

function Mini({ label, value, good }) {
  return (
    <span className="rounded-lg bg-[#F7F7F5] px-2.5 py-2">
      <span className="block text-[11px] text-[#8A8A93]">{label}</span>
      <span className={`block text-sm font-semibold ${good ? 'text-[#15803D]' : 'text-[#17171A]'}`}>{value}</span>
    </span>
  )
}

function Applicant({ token, id, k, say, preview, back, onDecided }) {
  const [app, setApp] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(null)
  const [viewing, setViewing] = useState(null)
  useEffect(() => { landlordApi.application(token, id).then((r) => setApp(r.data.data.application)).catch((e) => say(errText(e, 'Could not open this applicant'), 'bad')) }, [token, id, say])
  if (!app) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#F95C4B]" /></div>

  const mine = app.decision?.decision
  const otherApproved = app.approvedId && app.approvedId !== app.id
  async function decide(decision) {
    if (preview) return say('Preview — the landlord decides here', 'bad')
    setBusy(decision)
    try {
      const r = await landlordApi.decide(token, app.id, decision, note)
      const a = r.data.data.application
      setApp(a); onDecided(a)
      say(decision === 'approved' ? `${app.name.split(' ')[0]} approved — your agent will call you` : 'Declined')
    } catch (e) { say(errText(e, 'Could not save that'), 'bad') } finally { setBusy(null) }
  }
  const rows = [
    [Users, app.type === 'company' ? 'Who will live there' : 'Who will live there', app.who],
    [Briefcase, app.type === 'company' ? 'The company' : 'Work', app.work],
    [Wallet, app.type === 'company' ? 'Monthly turnover' : 'Monthly income (before tax)', R(app.income)],
    [Home, 'Lives now', app.livesNow],
    [CalendarDays, 'Wants to move in', app.moveIn ? fmtDate(app.moveIn) : null],
    [PawPrint, 'Pets', app.pets],
  ].filter(([, , v]) => v)

  return (
    <div className="space-y-4">
      <button type="button" onClick={back} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#F95C4B]"><ArrowLeft className="h-4 w-4" /> All {k.clients}</button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-[#17171A]">{app.name}</p>
          <p className="text-[13px] text-[#6B6B74]">{app.ref}</p>
        </div>
        <Verdict decision={mine} approved={app.approvedId === app.id} />
      </div>
      {app.rentShare != null && (
        <Callout icon={app.rentShare <= 33 ? CircleCheck : AlertTriangle} tone={app.rentShare <= 33 ? 'brand' : 'warn'}>
          The rent is <b>{app.rentShare}%</b> of their income. {app.rentShare <= 33 ? 'That is affordable — most landlords look for a third or less.' : 'Most landlords look for a third (33%) or less.'}
        </Callout>
      )}
      <Panel className="divide-y divide-[#F2F2EE]">
        {rows.map(([Icon, label, value]) => (
          <div key={label} className="flex items-start gap-3 px-4 py-3">
            <Icon className="mt-0.5 h-4 w-4 flex-none text-[#F95C4B]" />
            <div className="min-w-0"><p className="text-xs text-[#8A8A93]">{label}</p><p className="text-sm font-medium text-[#17171A] [overflow-wrap:anywhere]">{value}</p></div>
          </div>
        ))}
        {app.why && <div className="px-4 py-3"><p className="text-xs text-[#8A8A93]">Why they are moving</p><p className="text-sm text-[#17171A]">{app.why}</p></div>}
      </Panel>

      <div>
        <p className="mb-2 text-sm font-semibold text-[#17171A]">Their documents</p>
        <p className="mb-2 text-xs text-[#8A8A93]">You can look at them here. To keep their information safe they can’t be downloaded.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {app.documents.map((doc) => (
            <button key={doc.id} type="button" onClick={() => setViewing(doc)} className="flex items-center gap-3 rounded-xl border border-[#E4E4DF] bg-white p-3 text-left hover:border-[#F95C4B]/50">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-[#F4F4F1] text-[#8A8A93]"><FileText className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-[#17171A]">{doc.label}</span><span className="block truncate text-xs text-[#8A8A93]">{doc.mimeType === 'application/pdf' ? 'PDF' : 'Photo'}</span></span>
              <Eye className="h-4 w-4 flex-none text-[#F95C4B]" />
            </button>
          ))}
          {!app.documents.length && <p className="text-sm text-[#8A8A93]">No documents yet.</p>}
        </div>
      </div>

      {otherApproved && mine !== 'declined' ? (
        <Callout icon={AlertTriangle} tone="warn">You already approved another {k.client}. To choose {app.name.split(' ')[0]} instead, open them and decline them first.</Callout>
      ) : (
        <div className="space-y-3">
          <Field f={{ key: 'note', label: `A note for your agent`, area: true, ph: 'e.g. Happy with them, prefer a 1 December start' }} value={note} onChange={setNote} idPrefix="ll" />
          <div className="flex flex-wrap gap-2">
            {mine !== 'declined' && (
              <button type="button" onClick={() => decide('declined')} disabled={Boolean(busy)}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#DC2626]/40 bg-white px-5 text-sm font-semibold text-[#DC2626] hover:bg-[#FEF2F2] disabled:opacity-60">
                {busy === 'declined' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleX className="h-4 w-4" />} {app.approvedId === app.id ? 'Undo — decline' : 'Decline'}
              </button>
            )}
            {app.approvedId !== app.id && (
              <button type="button" onClick={() => decide('approved')} disabled={Boolean(busy)}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#15803D] px-5 text-sm font-semibold text-white hover:bg-[#166534] disabled:opacity-60 sm:flex-none">
                {busy === 'approved' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleCheck className="h-4 w-4" />} Approve {app.name.split(' ')[0]}
              </button>
            )}
          </div>
          <p className="text-xs text-[#8A8A93]">You can approve one {k.client}. Your agent is told straight away.</p>
        </div>
      )}

      {viewing && <Viewer token={token} appId={app.id} doc={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

// Shows a document on screen only: streamed inline, no download button, no right-click, and a
// light watermark across it. Rendered on <body> — the step card's slide-in would trap it.
function Viewer({ token, appId, doc, onClose }) {
  const url = useMemo(() => landlordApi.documentUrl(token, appId, doc.id), [token, appId, doc.id])
  const pdf = doc.mimeType === 'application/pdf'
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black/85" role="dialog" aria-modal="true" aria-label={doc.label} onContextMenu={(e) => e.preventDefault()}>
      <div className="flex items-center gap-3 px-4 py-3 text-white">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{doc.label}</p>
        <span className="hidden text-xs text-white/70 sm:block">View only</span>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20"><X className="h-5 w-5" /></button>
      </div>
      <div className="relative min-h-0 flex-1 select-none overflow-auto px-2 pb-4 sm:px-6">
        {pdf
          ? <iframe title={doc.label} src={`${url}#toolbar=0&navpanes=0&scrollbar=1`} className="h-full min-h-[70vh] w-full rounded-lg bg-white" />
          : <img src={url} alt={doc.label} draggable={false} className="mx-auto max-h-full rounded-lg object-contain" />}
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden">
          <p className="-rotate-[25deg] select-none whitespace-nowrap text-4xl font-bold uppercase tracking-widest text-[#808080]/35 sm:text-6xl">View only · Do not copy</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Dead({ title, text, brand }) {
  return (
    <div className="grid min-h-[100svh] place-items-center bg-[#F7F7F5] p-6 text-center">
      <div className="max-w-sm">
        <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#F95C4B]/10 text-[#F95C4B]"><AlertTriangle className="h-7 w-7" /></span>
        <h1 className="text-lg font-semibold text-[#17171A]">{title}</h1>
        <p className="mt-1 text-sm text-[#6B6B74]">{text}</p>
        {brand?.name && <p className="mt-4 text-xs text-[#A1A1AA]">{brand.name}</p>}
      </div>
    </div>
  )
}
