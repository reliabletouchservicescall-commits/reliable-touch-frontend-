import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  Building2, User, Users, ShieldCheck, Clock, FileText, Check, Loader2, AlertTriangle, Info, Lock, PenLine, MapPin,
  ChevronRight, CircleCheck, UserCheck,
} from 'lucide-react'
import { applyApi, setApplyMode } from '../../services/tenantsApi'
import { STEPS, fieldsOn, typeOf, R } from '../../lib/tenantForm'
import { applyBrand, clearBrand } from '../../lib/brand'
import SignaturePad from '../../components/tenants/SignaturePad'
import CoApplicantsEditor, { SplitBar } from '../../components/tenants/CoApplicantsEditor'
import {
  Field, Callout, Choice, Logo, DocSlot, PropertyCard, SumCard, ApplyLayout, TeamBanner, IssuesBox, Toast, AboutSheet,
  primaryBtn, backBtn, fmtDate, errText, inputBase,
} from '../../components/tenants/applyUi'
import CoApplyFlow from './CoApplyFlow'

// The tenant's application — a private link the team shares on WhatsApp or by email. It opens
// in the company's own colour and logo, saves every answer as it's typed (to the server, and to
// this device in case the signal drops), and shows the tenant exactly what to fix. People
// renting together share the rent: the main applicant fills in their part or sends them their
// own link (that link opens CoApplyFlow). A signed-in team member can open it with ?assist to
// fill it in for the tenant, or ?preview to look without being counted.

const cacheKey = (t) => `rt-apply-${t}`
function readCache(token) { try { return JSON.parse(localStorage.getItem(cacheKey(token)) ?? 'null') } catch { return null } }
function writeCache(token, v) { try { localStorage.setItem(cacheKey(token), JSON.stringify(v)) } catch { /* private mode */ } }

const STEP_SUB = {
  individual: {
    2: 'Your personal details and who will live there.',
    3: 'We confirm your rental history with your current landlord.',
    4: 'Used to check the rent is affordable.',
    5: 'Take a photo with your phone or choose a file. Photos are fine, as long as every word can be read.',
    6: 'Check everything, then sign to send it.',
  },
  company: {
    2: 'The company that will sign and pay.',
    3: 'Who signs for the company, and who will stay in the unit.',
    4: 'Where the company operates today.',
    5: 'Upload the company documents. PDFs or clear photos.',
    6: 'Check everything, then sign to send it.',
  },
}
const CO_DOC_SLOTS = [
  { key: 'id', label: 'ID or passport copy', required: true, hint: 'Smart ID: both sides. Passport: photo page.' },
  { key: 'pay', label: 'Latest 3 payslips', required: true, hint: 'Or 3 recent invoices if self-employed.' },
  { key: 'bank', label: '3 months bank statements', required: true, hint: 'The account their salary is paid into.' },
]

export default function ApplyPage() {
  const { token } = useParams()
  const [params] = useSearchParams()
  const mode = params.has('assist') ? 'assist' : params.has('preview') ? 'preview' : null
  const [app, setApp] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [formState, setFormState] = useState({})
  const [type, setType] = useState(null)
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState({})
  const [save, setSave] = useState({ state: 'idle', at: null })
  const [docs, setDocs] = useState([])
  const [cos, setCos] = useState([])
  const [busyKey, setBusyKey] = useState(null)
  const [toast, setToast] = useState(null)
  const [about, setAbout] = useState(false)
  const [consents, setConsents] = useState({ credit: false, truthful: false })
  const [place, setPlace] = useState('')
  const [signed, setSigned] = useState(false)
  const [onBehalf, setOnBehalf] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showMissingDocs, setShowMissingDocs] = useState(false)
  const sig = useRef(null)
  const coSigs = useRef({})
  const timer = useRef(null)
  const pending = useRef({})

  const flash = useCallback((msg, tone = 'ok') => {
    setToast({ msg, tone })
    setTimeout(() => setToast(null), 2800)
  }, [])

  useEffect(() => {
    let alive = true
    setApplyMode(mode)
    applyApi.open(token).then(({ data }) => {
      if (!alive) return
      const a = data.data.application
      applyBrand(a.brand?.color)
      document.title = `Apply · ${a.property?.address ?? ''} · ${a.brand?.name ?? ''}`
      if (a.coMode) { setApp(a); return }
      const cache = mode ? null : readCache(token)
      const form = { ...(a.form ?? {}) }
      if (cache?.form && a.editable) Object.assign(form, cache.form)
      setApp(a)
      setFormState(form)
      setType(a.applicantType ?? cache?.type ?? null)
      setDocs(a.docs ?? [])
      setCos(a.coApplicants ?? [])
      setConsents(a.consents ?? { credit: false, truthful: false })
      const start = a.submittedAt && !a.editable ? 7 : a.status === 'changes_requested' ? Math.min(a.furthestStep || 6, 6) : (cache?.step ?? a.step ?? 0)
      setStep(Math.min(start, a.editable ? 6 : 7))
      if (cache?.form && a.editable) queueSave({ form: cache.form }) // push offline answers up
    }).catch((e) => alive && setLoadError(errText(e, 'This link is not working. Ask your agent for a new one.')))
    return () => { alive = false; clearBrand() }
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  // Always the light look — this is the company's page, not the CRM
  useEffect(() => {
    const root = document.documentElement
    const wasDark = root.classList.contains('dark')
    root.classList.remove('dark')
    return () => { if (wasDark) root.classList.add('dark') }
  }, [])

  const preview = mode === 'preview'
  const editable = Boolean(app?.editable) && !preview
  const t = typeOf(type)
  const steps = STEPS[t]
  const joint = t === 'individual' && formState.joint === 'yes'
  const issues = app?.issues ?? []
  const issueFor = (target) => issues.find((i) => i.target === target && !i.resolvedAt && !i.fixedAt)
  const docsOf = useCallback((who = 'main') => docs.filter((d) => (d.who ?? 'main') === who), [docs])
  const docsBy = useMemo(() => docsOf('main').reduce((m, d) => ((m[d.key] = [...(m[d.key] ?? []), d]), m), {}), [docsOf])
  const rent = app?.property?.rent ?? null
  const mainShare = Math.max(0, 100 - cos.reduce((s, c) => s + (Number(c.share) || 0), 0))
  const docSlots = useMemo(() => {
    const req = app?.requires ?? {}
    return t === 'company'
      ? [
        { key: 'cipc', label: 'CIPC registration documents', required: true, hint: 'CoR 14.3 or equivalent registration certificate.' },
        { key: 'dirid', label: 'ID copies of all directors', required: true, hint: 'One file or several. Both sides of smart IDs.' },
        { key: 'bank6', label: '6 months company bank statements', required: true, hint: "Shows the company's financial standing." },
        { key: 'afs', label: 'Latest financial statements', required: Boolean(req.afs), hint: 'Helpful, not always required.' },
        { key: 'res', label: 'Resolution naming who signs', required: false, hint: 'Saves time at lease signing.' },
        { key: 'ref', label: 'Reference letter from your current landlord', required: Boolean(req.ref), hint: 'A short letter or email from them is enough.' },
      ]
      : [
        { key: 'id', label: 'ID or passport copy', required: true, hint: 'Smart ID: both sides. Passport: photo page.' },
        { key: 'pay', label: 'Latest 3 payslips', required: true, hint: 'Self-employed? Upload 3 recent invoices or a letter from your accountant.' },
        { key: 'bank', label: '3 months bank statements', required: true, hint: '6 months is better where possible. It helps the landlord say yes faster.' },
        { key: 'ref', label: 'Reference letter from your current landlord', required: Boolean(req.ref), hint: 'A short letter or email from them is enough.' },
        { key: 'addr', label: 'Proof of current address', required: Boolean(req.addr), hint: 'Utility bill or lease, not older than 3 months.' },
      ]
  }, [t, app?.requires])

  // ── Autosave: debounced to the server, instantly to this device ──
  function queueSave(patch) {
    if (preview) return
    pending.current = { ...pending.current, ...patch, form: { ...(pending.current.form ?? {}), ...(patch.form ?? {}) } }
    setSave((s) => ({ ...s, state: 'saving' }))
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, 700)
  }
  async function flush() {
    const body = pending.current
    pending.current = {}
    if (!Object.keys(body).length) return
    try {
      const { data } = await applyApi.save(token, body)
      setSave({ state: 'saved', at: data.data.savedAt })
      if (data.data.issues) setApp((a) => ({ ...a, issues: data.data.issues }))
    } catch {
      pending.current = { ...body, ...pending.current, form: { ...(body.form ?? {}), ...(pending.current.form ?? {}) } }
      setSave((s) => ({ ...s, state: navigator.onLine ? 'error' : 'offline' }))
    }
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    const retry = () => { if (Object.keys(pending.current).length) flush() }
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function setField(key, value) {
    setFormState((f) => {
      const next = { ...f, [key]: value }
      if (!mode) writeCache(token, { form: next, type, step })
      return next
    })
    if (errors[key]) setErrors((e) => ({ ...e, [key]: null }))
    queueSave({ form: { [key]: value } })
  }

  function goTo(n) {
    setStep(n)
    if (!mode) writeCache(token, { form: formState, type, step: n })
    if (editable) queueSave({ step: n })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function validateStep(n) {
    if (preview) return true
    if (n === 1 && !type) { setErrors({ type: 'Choose one to continue' }); return false }
    if (n >= 2 && n <= 4) {
      const errs = {}
      fieldsOn(t, n, formState).forEach((f) => {
        const v = String(formState[f.key] ?? '').trim()
        if (f.required && !v) errs[f.key] = 'Required'
        else if (v && f.type === 'email' && !/^\S+@\S+\.\S+$/.test(v)) errs[f.key] = 'Enter a valid email'
      })
      if (n === 4 && joint) {
        if (!cos.length) errs.joint = 'Add the person you are sharing the rent with — or go back and choose "Just me"'
        else if (mainShare <= 0) errs.joint = 'Leave a share of the rent for yourself'
        cos.filter((c) => c.filledBy === 'main').forEach((c) => (app.coFields ?? []).filter((f) => f.required && f.key !== 'name').forEach((f) => {
          if (!String(c.form?.[f.key] ?? '').trim()) errs[`co:${c.id}:${f.key}`] = 'Required'
        }))
      }
      setErrors(errs)
      if (Object.keys(errs).length) {
        const first = Object.keys(errs)[0]
        const el = document.getElementById(first.startsWith('co:') ? `co-${first.split(':')[1]}-${first.split(':')[2]}` : `f-${first}`)
        el?.focus()
        if (!el && errs.joint) flash(errs.joint, 'bad')
        return false
      }
    }
    if (n === 5) {
      const gap = docSlots.find((s) => s.required && !docsBy[s.key]?.length)
      const coGap = joint && cos.filter((c) => c.filledBy === 'main').map((c) => [c, CO_DOC_SLOTS.find((s) => !docsOf(c.id).some((d) => d.key === s.key))]).find(([, s]) => s)
      if (gap || coGap) {
        setShowMissingDocs(true)
        flash(gap ? `Add your ${gap.label.toLowerCase()} to continue` : `Add ${coGap[0].name.split(' ')[0]}'s ${coGap[1].label.toLowerCase()} to continue`, 'bad')
        return false
      }
    }
    return true
  }

  function next() {
    if (!validateStep(step)) return
    goTo(Math.min(step + 1, 6))
  }

  function chooseType(v) {
    setType(v)
    setErrors({})
    if (!mode) writeCache(token, { form: formState, type: v, step })
    queueSave({ applicantType: v })
  }

  async function upload(key, files, who = 'main') {
    if (preview) return
    setBusyKey(`${who}:${key}`)
    try {
      const { data } = await applyApi.upload(token, key, files, who)
      setDocs(data.data.docs)
      if (data.data.issues) setApp((a) => ({ ...a, issues: data.data.issues }))
      flash(files.length > 1 ? `${files.length} files added` : 'Document added')
    } catch (e) {
      flash(errText(e, 'Upload failed — check your signal and try again'), 'bad')
    } finally { setBusyKey(null) }
  }

  async function removeDoc(d) {
    if (preview) return
    try {
      const { data } = await applyApi.remove(token, d.id)
      setDocs(data.data.docs)
    } catch (e) { flash(errText(e, 'Could not remove that file'), 'bad') }
  }

  const coToSign = joint ? cos.filter((c) => c.filledBy === 'main' && !c.signed) : []
  const coWaiting = joint ? cos.filter((c) => c.filledBy === 'self' && !c.signed) : []

  async function submit() {
    const errs = {}
    if (!consents.credit || !consents.truthful) errs.consents = 'Tick both boxes to submit'
    if (mode === 'assist') {
      if (!onBehalf) errs.onBehalf = 'Confirm this to submit for them'
    } else {
      if (!sig.current?.toDataURL()) errs.signature = 'Sign in the box to submit'
      coToSign.forEach((c) => { if (!coSigs.current[c.id]?.toDataURL()) errs[`sig:${c.id}`] = `${c.name.split(' ')[0]} has to sign here` })
    }
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSubmitting(true)
    try {
      await flush()
      const coSignatures = Object.fromEntries(coToSign.map((c) => [c.id, coSigs.current[c.id]?.toDataURL()]))
      const { data } = await applyApi.submit(token, mode === 'assist'
        ? { consents, onBehalf: true, place }
        : { signature: sig.current.toDataURL(), place, consents, coSignatures })
      setApp(data.data.application)
      setCos(data.data.application.coApplicants ?? [])
      try { localStorage.removeItem(cacheKey(token)) } catch { /* ignore */ }
      setStep(7)
      window.scrollTo({ top: 0 })
    } catch (e) {
      flash(errText(e, 'Could not submit — try again'), 'bad')
    } finally { setSubmitting(false) }
  }

  /* ── States without a form ── */
  if (loadError) {
    return (
      <div className="grid min-h-[100svh] place-items-center bg-[#F7F7F5] p-6 text-center" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div className="max-w-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#FEF2F2] text-[#DC2626]"><AlertTriangle className="h-5 w-5" /></div>
          <h1 className="mt-4 text-lg font-semibold text-[#17171A]">This link isn't working</h1>
          <p className="mt-1 text-sm text-[#6B6B74]">{loadError}</p>
        </div>
      </div>
    )
  }
  if (!app) return <div className="grid min-h-[100svh] place-items-center bg-[#F7F7F5]"><Loader2 className="h-6 w-6 animate-spin text-[#A1A1AA]" /></div>
  if (app.coMode) return <CoApplyFlow token={token} initial={app} mode={mode} />

  const brand = app.brand
  const prop = app.property
  const closed = app.closed
  const shownStep = closed ? 7 : step
  const finished = shownStep === 7
  const tenantName = formState.name || app.invitedName

  const openIssues = issues.filter((i) => !i.resolvedAt && !i.fixedAt).map((i) => {
    const m = /^(?:co:([a-f0-9]{24}):)?(doc|field|general):?(\w*)$/.exec(i.target) ?? []
    const to = m[2] === 'doc' ? 5 : m[2] === 'field' ? (m[1] ? 4 : [2, 3, 4].find((s) => fieldsOn(t, s, formState).some((f) => f.key === m[3])) ?? 2) : null
    return { ...i, to: to != null && to !== shownStep ? to : null }
  })

  /* ── Step content ── */
  let title = null
  let sub = null
  let body = null
  let actions = null

  if (closed) {
    title = 'This application is closed'
    sub = `${brand.name} switched this link off. If you think that's a mistake, contact ${app.contact?.name ?? 'your agent'}.`
    body = <div className="grid h-12 w-12 place-items-center rounded-full bg-[#F4F4F1] text-[#8A8A93]"><Lock className="h-5 w-5" /></div>
  } else if (shownStep === 0) {
    const resume = app.furthestStep > 0 || app.status === 'changes_requested'
    title = `Hi ${app.invitedName.split(' ')[0]}, apply for this home`
    sub = `${brand.name} invited you to apply for ${prop.address}. It takes about 10 minutes and your answers save as you go — you can stop and come back on this link any time.`
    body = (
      <div className="space-y-5">
        <div className="lg:hidden"><PropertyCard prop={prop} /></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [FileText, 'Your documents', "ID, last 3 payslips and 3 months' bank statements"],
            [Users, 'Renting together?', 'Add your partner or friends and split the rent — they can fill in their own part'],
            [Building2, 'Applying as a company?', "CIPC documents, director IDs and 6 months' statements"],
            [Clock, 'About 10 minutes', 'Everything saves as you type — even offline'],
          ].map(([Icon, h, p]) => (
            <div key={h} className="rounded-xl border border-[#E8E8E3] bg-[#FBFBF9] p-4">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#F95C4B]/10 text-[#F95C4B]"><Icon className="h-4 w-4" /></span>
              <p className="mt-3 text-sm font-semibold text-[#17171A]">{h}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-[#6B6B74]">{p}</p>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setAbout(true)} className="flex w-full items-center gap-3 rounded-xl border border-[#E8E8E3] bg-white p-3.5 text-left transition-colors hover:border-[#F95C4B]/40 lg:hidden">
          <Logo brand={brand} size="h-10 w-10" />
          <span className="min-w-0 flex-1"><span className="block text-xs text-[#8A8A93]">Listed by</span><span className="block truncate text-sm font-semibold text-[#17171A]">{brand.name}</span></span>
          <ChevronRight className="h-4 w-4 text-[#A1A1AA]" />
        </button>
        <p className="flex items-center gap-2 text-xs text-[#8A8A93]"><Lock className="h-3.5 w-3.5" /> Your information is private and only shared with {brand.name}, under POPIA.</p>
      </div>
    )
    actions = primaryBtn(resume ? 'Continue my application' : 'Start application', next)
  } else if (shownStep === 1) {
    title = 'Are you applying personally or as a company?'
    sub = 'This decides which details and documents we ask for.'
    body = (
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Choice active={type === 'individual'} onClick={() => !preview && chooseType('individual')} icon={User} title="Personally" sub="You'll sign the lease in your own name." />
          <Choice active={type === 'company'} onClick={() => !preview && chooseType('company')} icon={Building2} title="As a company" sub="A company will sign and pay, for example housing for staff." />
        </div>
        {errors.type && <p className="text-xs font-medium text-[#DC2626]">{errors.type}</p>}
        {type === 'individual' && (
          <div className="apply-step space-y-3 border-t border-[#EFEFEA] pt-5">
            <p className="text-sm font-semibold text-[#17171A]">Who will pay the rent?</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Choice active={formState.joint !== 'yes'} onClick={() => !preview && setField('joint', 'no')} icon={User} title="Just me" sub="You pay the full rent yourself." />
              <Choice active={formState.joint === 'yes'} onClick={() => !preview && setField('joint', 'yes')} icon={Users} title="Me and someone else" sub="A partner, spouse, family member or friend shares the rent with you." />
            </div>
          </div>
        )}
      </div>
    )
    actions = <>{backBtn(() => goTo(0))}{primaryBtn('Continue', next)}</>
  } else if (shownStep >= 2 && shownStep <= 4) {
    title = steps[shownStep]
    sub = STEP_SUB[t][shownStep]
    const fields = fieldsOn(t, shownStep, formState)
    const gross = Number(String(formState.gross ?? '').replace(/[^\d.]/g, ''))
    const together = gross + (joint ? cos.reduce((s, c) => s + (Number(String(c.form?.gross ?? '').replace(/[^\d.]/g, '')) || 0), 0) : 0)
    body = (
      <div className="space-y-5">
        {((t === 'individual' && shownStep === 3) || (t === 'company' && shownStep === 4)) && (
          <Callout icon={MapPin} tone="warn">We verify this address, so make it exact: unit number, complex name, street number, suburb and postal code — as on your lease or a utility bill.</Callout>
        )}
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          {fields.map((f) => (
            <FieldWrap key={f.key} f={f}>
              <Field f={f} value={formState[f.key]} onChange={(v) => !preview && setField(f.key, v)} error={errors[f.key]} issue={issueFor(`field:${f.key}`)} />
            </FieldWrap>
          ))}
        </div>
        {t === 'individual' && shownStep === 4 && joint && (
          <CoApplicantsEditor token={token} mainName={formState.name?.split(' ')[0] || 'You'} rent={rent} cos={cos} setCos={setCos}
            fields={app.coFields ?? []} relations={app.relations ?? []} issueFor={issueFor} errors={errors} flash={flash} readOnly={!editable}
            onDocs={setDocs} />
        )}
        {t === 'individual' && shownStep === 4 && together > 0 && rent && (
          <Callout>Rent of {R(rent)} is <b>{Math.round((rent / together) * 100)}%</b> of {joint && cos.length ? 'your combined' : 'your'} gross income. Most landlords look for 30% or less.</Callout>
        )}
        {t === 'company' && shownStep === 3 && <Callout>Some landlords ask a director to stand surety for a company lease. Your agent will tell you if this one does.</Callout>}
      </div>
    )
    actions = <>{backBtn(() => goTo(step - 1))}{primaryBtn('Continue', next)}</>
  } else if (shownStep === 5) {
    title = 'Upload your documents'
    sub = STEP_SUB[t][5]
    body = (
      <div className="space-y-6">
        <div className="space-y-3">
          {joint && <p className="text-sm font-semibold text-[#17171A]">Your documents</p>}
          {docSlots.map((s) => (
            <DocSlot key={s.key} slot={s} files={docsBy[s.key] ?? []} issue={issueFor(`doc:${s.key}`)} busy={busyKey === `main:${s.key}`} readOnly={!editable}
              missing={showMissingDocs && s.required && !docsBy[s.key]?.length} onUpload={(files) => upload(s.key, files)} onRemove={removeDoc} />
          ))}
          <DocSlot slot={{ key: 'other', label: 'Anything else that helps?', hint: "A bonus letter, a guarantor's documents, or a reference from a previous landlord.", required: false }}
            files={docsBy.other ?? []} busy={busyKey === 'main:other'} readOnly={!editable} onUpload={(files) => upload('other', files)} onRemove={removeDoc} />
        </div>
        {joint && cos.map((c) => {
          const theirs = docsOf(c.id)
          return (
            <div key={c.id} className="space-y-3 border-t border-[#EFEFEA] pt-5">
              <p className="text-sm font-semibold text-[#17171A]">{c.name}'s documents</p>
              {c.filledBy === 'self' ? (
                <div className="flex items-center gap-3 rounded-xl bg-[#F7F7F5] p-3.5 text-[13px] text-[#3F3F46]">
                  {c.status === 'done' ? <CircleCheck className="h-5 w-5 flex-none text-[#15803D]" /> : <Clock className="h-5 w-5 flex-none text-[#F59E0B]" />}
                  <span>{c.status === 'done' ? `${c.name.split(' ')[0]} added their documents and signed on their own link.` : `${c.name.split(' ')[0]} is adding their own documents on their link${theirs.length ? ` — ${theirs.length} file${theirs.length === 1 ? '' : 's'} so far` : ''}.`}</span>
                </div>
              ) : CO_DOC_SLOTS.map((s) => {
                const files = theirs.filter((d) => d.key === s.key)
                return (
                  <DocSlot key={s.key} slot={s} files={files} issue={issueFor(`co:${c.id}:doc:${s.key}`)} busy={busyKey === `${c.id}:${s.key}`} readOnly={!editable}
                    missing={showMissingDocs && !files.length} onUpload={(fl) => upload(s.key, fl, c.id)} onRemove={removeDoc} />
                )
              })}
            </div>
          )
        })}
        <Callout icon={Lock}>Only {brand.name} sees these documents. They're stored securely under POPIA.</Callout>
      </div>
    )
    actions = <>{backBtn(() => goTo(4))}{primaryBtn('Continue', next)}</>
  } else if (shownStep === 6) {
    const f = formState
    const rows = t === 'company'
      ? [['Company', f.coname], ['Reg. no.', f.coreg], ['Director', f.dname], ['Occupant', f.occupant], ['Move in', fmtDate(f.move)]]
      : [['Name', f.name], ['Phone', f.phone], ['Living there', f.occ], ['Move in', fmtDate(f.move)], ['Gross income', f.gross ? R(f.gross) : '—']]
    const needDocs = docSlots.filter((s) => s.required)
    const haveDocs = needDocs.filter((s) => docsBy[s.key]?.length).length
    title = 'Check and sign'
    sub = mode === 'assist' ? `Check everything, then submit it for ${tenantName}.` : STEP_SUB[t][6]
    body = (
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <SumCard title="Your details" onEdit={() => goTo(2)} rows={rows} />
          <SumCard title={t === 'company' ? 'Where you operate' : 'Where you live now'} onEdit={() => goTo(t === 'company' ? 4 : 3)}
            rows={[['Address', [f.cunit, f.caddr].filter(Boolean).join(', ')], ['Landlord', f.clname], ['There since', f.csince]]} />
          <SumCard title="Documents" onEdit={() => goTo(5)}
            rows={[['Required', `${haveDocs} of ${needDocs.length} added`], ['Extra', `${(docsBy.other ?? []).length} added`], ...(joint ? cos.map((c) => [c.name.split(' ')[0], `${docsOf(c.id).length} file${docsOf(c.id).length === 1 ? '' : 's'}`]) : [])]} />
        </div>
        {joint && cos.length > 0 && (
          <div className="rounded-xl border border-[#E8E8E3] p-4">
            <div className="mb-3 flex items-center justify-between"><p className="text-[13px] font-semibold text-[#17171A]">How the rent is split</p><button type="button" onClick={() => goTo(4)} className="text-xs font-medium text-[#F95C4B] hover:underline">Edit</button></div>
            <SplitBar mainName={f.name?.split(' ')[0] || 'You'} mainShare={mainShare} cos={cos} rent={rent} />
          </div>
        )}
        <div className="space-y-2.5 rounded-xl border border-[#E8E8E3] bg-[#FBFBF9] p-4">
          {[
            ['credit', `${joint ? 'We agree' : 'I agree'} to a credit check and to ${brand.name} contacting ${joint ? 'our' : 'my'} current landlord and employer${joint ? 's' : ''} to verify this application (POPIA consent).`],
            ['truthful', `The information and documents ${joint ? 'we' : 'I'}'ve given are true and complete.`],
          ].map(([k, label]) => (
            <label key={k} className="flex cursor-pointer gap-2.5 text-sm leading-relaxed text-[#3F3F46]">
              <input type="checkbox" checked={consents[k]} disabled={preview} onChange={(e) => { const c = { ...consents, [k]: e.target.checked }; setConsents(c); queueSave({ consents: c }); setErrors((x) => ({ ...x, consents: null })) }}
                className="mt-1 h-4 w-4 flex-none accent-[#F95C4B]" />
              {label}
            </label>
          ))}
          {errors.consents && <p className="text-xs font-medium text-[#DC2626]">{errors.consents}</p>}
        </div>

        {coWaiting.length > 0 && (
          <Callout tone="warn" icon={Clock}>Waiting for {coWaiting.map((c) => c.name.split(' ')[0]).join(' and ')} to finish and sign on {coWaiting.length === 1 ? 'their' : 'their own'} link. You can submit as soon as they're done — we'll email you.</Callout>
        )}

        {mode === 'assist' ? (
          <div className="rounded-xl border border-[#F59E0B]/30 bg-[#FFFBEB] p-4">
            <label className="flex cursor-pointer gap-2.5 text-sm leading-relaxed text-[#3F3F46]">
              <input type="checkbox" checked={onBehalf} onChange={(e) => { setOnBehalf(e.target.checked); setErrors((x) => ({ ...x, onBehalf: null })) }} className="mt-1 h-4 w-4 flex-none accent-[#F95C4B]" />
              <span><b className="font-semibold text-[#17171A]">{tenantName}{joint && cos.length ? ` and ${cos.map((c) => c.name.split(' ')[0]).join(' & ')}` : ''}</b> gave me these details and documents and agreed to the checks above. I'm submitting on their behalf as <b>{app.staffName}</b>.</span>
            </label>
            {errors.onBehalf && <p className="mt-1 text-xs font-medium text-[#DC2626]">{errors.onBehalf}</p>}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1 text-[13px] font-medium text-[#17171A]">{t === 'company' ? 'Signature of director or signatory' : joint ? `${f.name?.split(' ')[0] || 'Your'} — your signature` : 'Your signature'}</p>
              <SignaturePad ref={sig} invalid={Boolean(errors.signature)} onChange={(v) => { setSigned(v); if (v) setErrors((x) => ({ ...x, signature: null })) }} />
              {errors.signature ? <p className="mt-1 text-xs font-medium text-[#DC2626]">{errors.signature}</p> : <p className="mt-1 text-xs text-[#8A8A93]">Sign with your finger or mouse. It's legally binding, the same as signing on paper.</p>}
            </div>
            {coToSign.map((c) => (
              <div key={c.id}>
                <p className="mb-1 text-[13px] font-medium text-[#17171A]">{c.name} — signs here</p>
                <SignaturePad ref={(r) => { coSigs.current[c.id] = r }} invalid={Boolean(errors[`sig:${c.id}`])} onChange={(v) => v && setErrors((x) => ({ ...x, [`sig:${c.id}`]: null }))} />
                {errors[`sig:${c.id}`] ? <p className="mt-1 text-xs font-medium text-[#DC2626]">{errors[`sig:${c.id}`]}</p> : <p className="mt-1 text-xs text-[#8A8A93]">Pass the phone to {c.name.split(' ')[0]} to sign.</p>}
              </div>
            ))}
            {joint && cos.filter((c) => c.signed).map((c) => (
              <div key={c.id} className="flex items-center gap-2.5 self-start rounded-xl border border-[#15803D]/25 bg-[#F3FBF5] p-3.5 text-[13px] text-[#3F3F46]">
                <UserCheck className="h-5 w-5 text-[#15803D]" /> <b className="font-semibold text-[#17171A]">{c.name}</b> already signed
              </div>
            ))}
            <div className="md:col-span-2 md:max-w-xs">
              <label htmlFor="f-place" className="mb-1 block text-[13px] font-medium text-[#17171A]">Signed at (town) <span className="font-normal text-[#8A8A93]">(optional)</span></label>
              <input id="f-place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="e.g. Sandton" className={`${inputBase} border-[#D9D9D4]`} />
            </div>
          </div>
        )}
      </div>
    )
    actions = preview ? backBtn(() => goTo(5)) : <>{backBtn(() => goTo(5))}{primaryBtn(
      mode === 'assist' ? `Submit for ${tenantName.split(' ')[0]}` : app.submittedAt ? 'Send updated application' : signed ? 'Sign & submit' : 'Submit application',
      submit, { icon: PenLine, busy: submitting, iconFirst: true, disabled: coWaiting.length > 0 && mode !== 'assist' },
    )}</>
  } else {
    const s = app.status
    const level = { submitted: 2, changes_requested: 1, approved: 4, declined: 4 }[s] ?? 2
    title = s === 'approved' ? "You're approved!" : s === 'declined' ? 'Not successful this time' : 'Application received'
    sub = <>Reference <b className="font-mono text-[#17171A]">{app.ref}</b>{app.submittedAt && <> · sent {new Date(app.submittedAt).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</>}. We'll email you when anything changes — and this link always shows where it is.</>
    const track = [
      [true, false, 'Received', `${brand.name} has your details and documents`],
      [level > 2, level === 2, 'Being checked', 'Credit, employer and landlord checks · usually within 48 hours'],
      [level > 3, level === 3, 'With the landlord', 'The landlord reviews shortlisted applications'],
      [s === 'approved', false, s === 'approved' ? 'Approved — your lease is next' : s === 'declined' ? 'Decision made' : 'Decision', s === 'approved' ? `${app.contact?.name ?? 'Your agent'} will contact you about the lease` : "We'll email you either way"],
    ]
    body = (
      <div className="space-y-5">
        <div className={`apply-pop grid h-14 w-14 place-items-center rounded-full text-white ${s === 'declined' ? 'bg-[#6B7280]' : 'bg-[#15803D]'}`}>
          {s === 'declined' ? <Info className="h-7 w-7" /> : <Check className="h-7 w-7" strokeWidth={3} />}
        </div>
        {s === 'declined' && app.decision?.reason && <Callout tone="warn">{app.decision.reason}</Callout>}
        <ol className="grid gap-3 md:grid-cols-4">
          {track.map(([done, cur, h, p], i) => (
            <li key={h} className={`rounded-xl border p-4 ${cur ? 'border-[#F95C4B]/40 bg-[#F95C4B]/[0.04]' : done ? 'border-[#15803D]/25 bg-[#F3FBF5]' : 'border-[#E8E8E3] bg-white'}`}>
              <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold ${done ? 'bg-[#15803D] text-white' : cur ? 'bg-[#F95C4B] text-white' : 'border border-[#D9D9D4] text-[#A1A1AA]'}`}>{done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}</span>
              <p className="mt-2.5 text-sm font-semibold text-[#17171A]">{h}</p>
              <p className="mt-0.5 text-xs leading-snug text-[#6B6B74]">{p}</p>
            </li>
          ))}
        </ol>
        {joint && cos.length > 0 && <SplitBar mainName={formState.name?.split(' ')[0] || 'You'} mainShare={mainShare} cos={cos} rent={rent} />}
        <Callout icon={ShieldCheck}>Your details and documents are saved. Keep this link to follow your application.</Callout>
      </div>
    )
  }

  return (
    <>
      <ApplyLayout
        brand={brand} prop={prop} contact={app.contact} labels={steps.slice(1, 7)} step={shownStep}
        furthest={app.furthestStep ?? 0} onGo={(n) => goTo(n)} finished={finished} closed={closed}
        saveState={save.state} showSave={editable && shownStep > 0 && !finished} onAbout={() => setAbout(true)}
        banner={<TeamBanner mode={mode} staffName={app.staffName} tenantName={tenantName} />}
        notice={editable && app.status === 'changes_requested' && !finished ? <IssuesBox brand={brand} issues={openIssues} onFix={goTo} /> : null}
        title={title} sub={sub} body={body} actions={actions}
        footNote={shownStep > 0 ? (preview ? 'Preview — nothing is saved.' : 'You can leave and come back — your answers are saved.') : ''}
      />
      {about && <AboutSheet brand={brand} contact={app.contact} onClose={() => setAbout(false)} />}
      <Toast toast={toast} />
    </>
  )
}

function FieldWrap({ f, children }) {
  return (
    <>
      {f.group && (
        <div className="col-span-2 mt-2 border-t border-[#EFEFEA] pt-4">
          <p className="text-sm font-semibold text-[#17171A]">{f.group}</p>
          <p className="text-xs text-[#8A8A93]">We'll only contact them to confirm your rental history.</p>
        </div>
      )}
      {children}
    </>
  )
}
