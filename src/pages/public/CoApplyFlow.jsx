import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Users, FileText, Clock, Check, Lock, PenLine, ShieldCheck, Info } from 'lucide-react'
import { applyApi } from '../../services/tenantsApi'
import { R } from '../../lib/tenantForm'
import SignaturePad from '../../components/tenants/SignaturePad'
import { Field, Callout, DocSlot, PropertyCard, SumCard, ApplyLayout, TeamBanner, IssuesBox, Toast, AboutSheet, primaryBtn, backBtn, errText } from '../../components/tenants/applyUi'

// A co-applicant's own link — someone renting together with the main applicant and paying a
// share of the rent. They add their details, income, three documents and their signature.

const LABELS = ['About you', 'Work & income', 'Documents', 'Sign']
const STEP_FIELDS = {
  1: [['name', { ac: 'name' }], ['idno', { half: true }], ['phone', { type: 'tel', half: true }], ['email', { type: 'email', hint: 'We send your updates here.' }]],
  2: [['emp', { hint: 'Self-employed? Write your business name.' }], ['role', { half: true }], ['esince', { half: true, ph: 'e.g. 2021' }], ['gross', { num: true, half: true, hint: 'Before deductions' }], ['net', { num: true, half: true, hint: 'What you take home' }]],
}

export default function CoApplyFlow({ token, initial, mode }) {
  const [app, setApp] = useState(initial)
  const [formState, setFormState] = useState(initial.form ?? {})
  const [docs, setDocs] = useState(initial.docs ?? [])
  const [step, setStep] = useState(initial.status === 'done' && !initial.editable ? 5 : initial.issues?.length ? 1 : 0)
  const [errors, setErrors] = useState({})
  const [save, setSave] = useState({ state: 'idle' })
  const [busyKey, setBusyKey] = useState(null)
  const [toast, setToast] = useState(null)
  const [about, setAbout] = useState(false)
  const [consents, setConsents] = useState(initial.consents ?? { credit: false, truthful: false })
  const [submitting, setSubmitting] = useState(false)
  const [showMissing, setShowMissing] = useState(false)
  const sig = useRef(null)
  const timer = useRef(null)
  const pending = useRef({})
  const preview = mode === 'preview'
  const editable = app.editable && !preview

  const flash = useCallback((msg, tone = 'ok') => { setToast({ msg, tone }); setTimeout(() => setToast(null), 2800) }, [])
  const fieldDef = useMemo(() => Object.fromEntries((app.fields ?? []).map((f) => [f.key, f])), [app.fields])
  const issueFor = (target) => (app.issues ?? []).find((i) => i.target === target && !i.fixedAt)
  const docsBy = useMemo(() => docs.reduce((m, d) => ((m[d.key] = [...(m[d.key] ?? []), d]), m), {}), [docs])

  function queueSave(patch) {
    if (preview) return
    pending.current = { ...pending.current, ...patch, form: { ...(pending.current.form ?? {}), ...(patch.form ?? {}) } }
    setSave({ state: 'saving' })
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const body = pending.current
      pending.current = {}
      try {
        const { data } = await applyApi.save(token, body)
        setSave({ state: 'saved' })
        if (data.data.issues) setApp((a) => ({ ...a, issues: data.data.issues }))
      } catch {
        pending.current = { ...body, ...pending.current }
        setSave({ state: navigator.onLine ? 'error' : 'offline' })
      }
    }, 700)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  const setField = (k, v) => { setFormState((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: null })); queueSave({ form: { [k]: v } }) }
  const goTo = (n) => { setStep(n); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  function next() {
    if (!preview && STEP_FIELDS[step]) {
      const errs = {}
      STEP_FIELDS[step].forEach(([k, x]) => {
        const v = String(formState[k] ?? '').trim()
        if (fieldDef[k]?.required && !v) errs[k] = 'Required'
        else if (v && x.type === 'email' && !/^\S+@\S+\.\S+$/.test(v)) errs[k] = 'Enter a valid email'
      })
      setErrors(errs)
      if (Object.keys(errs).length) { document.getElementById(`c-${Object.keys(errs)[0]}`)?.focus(); return }
    }
    if (!preview && step === 3) {
      const gap = (app.docSlots ?? []).find((s) => !docsBy[s.key]?.length)
      if (gap) { setShowMissing(true); flash(`Add your ${gap.label.toLowerCase()} to continue`, 'bad'); return }
    }
    goTo(Math.min(step + 1, 4))
  }

  async function upload(key, files) {
    if (preview) return
    setBusyKey(key)
    try {
      const { data } = await applyApi.upload(token, key, files)
      setDocs(data.data.docs)
      if (data.data.issues) setApp((a) => ({ ...a, issues: data.data.issues }))
      flash('Document added')
    } catch (e) { flash(errText(e, 'Upload failed — try again'), 'bad') } finally { setBusyKey(null) }
  }
  async function removeDoc(d) {
    try { const { data } = await applyApi.remove(token, d.id); setDocs(data.data.docs) } catch (e) { flash(errText(e, 'Could not remove that file'), 'bad') }
  }

  async function finish() {
    const errs = {}
    if (!consents.credit || !consents.truthful) errs.consents = 'Tick both boxes to finish'
    if (mode !== 'assist' && !sig.current?.toDataURL()) errs.signature = 'Sign in the box to finish'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSubmitting(true)
    try {
      const { data } = await applyApi.submitCo(token, { signature: sig.current?.toDataURL(), consents })
      setApp(data.data.application)
      goTo(5)
    } catch (e) { flash(errText(e, 'Could not finish — try again'), 'bad') } finally { setSubmitting(false) }
  }

  const brand = app.brand
  const first = app.invitedName.split(' ')[0]
  const mainFirst = app.mainName.split(' ')[0]
  const share = app.rentShare ? { amount: app.rentShare, pct: app.share } : null
  const finished = step === 5
  const issues = (app.issues ?? []).filter((i) => !i.fixedAt).map((i) => ({ ...i, label: i.label.replace(/^[^:]+:\s*/, ''), to: i.target.startsWith('doc:') ? 3 : ['emp', 'role', 'esince', 'gross', 'net'].includes(i.target.split(':')[1]) ? 2 : 1 }))

  let title, sub, body, actions = null
  if (app.closed) {
    title = 'This application is closed'
    sub = `${brand.name} switched this link off.`
    body = null
  } else if (step === 0) {
    title = `Hi ${first}, ${mainFirst} added you to a rental application`
    sub = `You're applying together for ${app.property.address} and you'll pay ${app.share}% of the rent${app.rentShare ? ` — ${R(app.rentShare)} a month` : ''}. Add your details, documents and signature; it takes about 5 minutes.`
    body = (
      <div className="space-y-5">
        <div className="lg:hidden"><PropertyCard prop={app.property} share={share} /></div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[[Users, 'Applying together', `With ${app.mainName} (${app.relation.toLowerCase()})`], [FileText, 'Your documents', "ID, last 3 payslips and 3 months' bank statements"], [Clock, 'About 5 minutes', 'Everything saves as you type']].map(([Icon, h, p]) => (
            <div key={h} className="rounded-xl border border-[#E8E8E3] bg-[#FBFBF9] p-4">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#F95C4B]/10 text-[#F95C4B]"><Icon className="h-4 w-4" /></span>
              <p className="mt-3 text-sm font-semibold text-[#17171A]">{h}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-[#6B6B74]">{p}</p>
            </div>
          ))}
        </div>
        <p className="flex items-center gap-2 text-xs text-[#8A8A93]"><Lock className="h-3.5 w-3.5" /> Your information is private and only shared with {brand.name}, under POPIA.</p>
      </div>
    )
    actions = primaryBtn(app.status === 'invited' || app.status === 'opened' ? 'Start' : 'Continue', next)
  } else if (step === 1 || step === 2) {
    title = LABELS[step - 1]
    sub = step === 1 ? 'Your personal details, as on your ID.' : 'Used, with the others’ income, to check the rent is affordable.'
    body = (
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        {STEP_FIELDS[step].map(([k, x]) => (
          <Field key={k} idPrefix="c" f={{ key: k, label: fieldDef[k]?.label ?? k, required: fieldDef[k]?.required, ...x }}
            value={formState[k]} onChange={(v) => !preview && setField(k, v)} error={errors[k]} issue={issueFor(`field:${k}`)} />
        ))}
      </div>
    )
    actions = <>{backBtn(() => goTo(step - 1))}{primaryBtn('Continue', next)}</>
  } else if (step === 3) {
    title = 'Your documents'
    sub = 'Take a photo with your phone or choose a file. Photos are fine, as long as every word can be read.'
    body = (
      <div className="space-y-3">
        {(app.docSlots ?? []).map((s) => (
          <DocSlot key={s.key} slot={s} files={docsBy[s.key] ?? []} issue={issueFor(`doc:${s.key}`)} busy={busyKey === s.key} readOnly={!editable}
            missing={showMissing && !docsBy[s.key]?.length} onUpload={(f) => upload(s.key, f)} onRemove={removeDoc} />
        ))}
        <Callout icon={Lock}>Only {brand.name} sees these documents. They're stored securely under POPIA.</Callout>
      </div>
    )
    actions = <>{backBtn(() => goTo(2))}{primaryBtn('Continue', next)}</>
  } else if (step === 4) {
    title = 'Check and sign'
    sub = `Sign to add your part to ${mainFirst}'s application.`
    body = (
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          <SumCard title="Your details" onEdit={() => goTo(1)} rows={[['Name', formState.name], ['ID number', formState.idno], ['Mobile', formState.phone], ['Employer', formState.emp], ['Gross income', formState.gross ? R(formState.gross) : '—']]} />
          <SumCard title="Your part" rows={[['Applying with', app.mainName], ['Your share', `${app.share}%${app.rentShare ? ` · ${R(app.rentShare)} / month` : ''}`], ['Documents', `${Object.keys(docsBy).length} of ${(app.docSlots ?? []).length} added`]]} />
        </div>
        <div className="space-y-2.5 rounded-xl border border-[#E8E8E3] bg-[#FBFBF9] p-4">
          {[['credit', `I agree to a credit check and to ${brand.name} contacting my employer to verify this application (POPIA consent).`], ['truthful', "The information and documents I've given are true and complete."]].map(([k, label]) => (
            <label key={k} className="flex cursor-pointer gap-2.5 text-sm leading-relaxed text-[#3F3F46]">
              <input type="checkbox" checked={consents[k]} disabled={preview} onChange={(e) => { const c = { ...consents, [k]: e.target.checked }; setConsents(c); queueSave({ consents: c }) }} className="mt-1 h-4 w-4 flex-none accent-[#F95C4B]" />
              {label}
            </label>
          ))}
          {errors.consents && <p className="text-xs font-medium text-[#DC2626]">{errors.consents}</p>}
        </div>
        {mode !== 'assist' && (
          <div className="md:max-w-xl">
            <p className="mb-1 text-[13px] font-medium text-[#17171A]">Your signature</p>
            <SignaturePad ref={sig} invalid={Boolean(errors.signature)} onChange={(v) => v && setErrors((x) => ({ ...x, signature: null }))} />
            {errors.signature ? <p className="mt-1 text-xs font-medium text-[#DC2626]">{errors.signature}</p> : <p className="mt-1 text-xs text-[#8A8A93]">Sign with your finger or mouse. It's legally binding, the same as signing on paper.</p>}
          </div>
        )}
      </div>
    )
    actions = preview ? backBtn(() => goTo(3)) : <>{backBtn(() => goTo(3))}{primaryBtn(mode === 'assist' ? `Finish for ${first}` : 'Sign my part', finish, { icon: PenLine, busy: submitting, iconFirst: true })}</>
  } else {
    title = `Thanks ${first}, your part is done`
    sub = `${mainFirst} and ${brand.name} can see you've added everything. ${app.appStatus === 'submitted' ? 'The application is with the team now.' : `${mainFirst} sends the application once everyone has signed.`}`
    body = (
      <div className="space-y-5">
        <div className="apply-pop grid h-14 w-14 place-items-center rounded-full bg-[#15803D] text-white"><Check className="h-7 w-7" strokeWidth={3} /></div>
        <Callout icon={ShieldCheck}>Keep this link — if {brand.name} needs anything else from you, it shows here and we'll email you.</Callout>
        {app.appStatus === 'approved' && <Callout icon={Info}>Good news — the application was approved. {app.contact?.name ?? 'Your agent'} will be in touch about the lease.</Callout>}
      </div>
    )
  }

  return (
    <>
      <ApplyLayout
        brand={brand} prop={app.property} contact={app.contact} share={share} labels={LABELS} step={step} furthest={step}
        onGo={goTo} finished={finished} closed={app.closed} saveState={save.state} showSave={editable && step > 0 && !finished}
        onAbout={() => setAbout(true)} banner={<TeamBanner mode={mode} staffName={app.staffName} tenantName={app.invitedName} />}
        notice={editable && issues.length && !finished ? <IssuesBox brand={brand} issues={issues} onFix={goTo} /> : null}
        title={title} sub={sub} body={body} actions={actions} footNote={step > 0 ? 'Your answers save as you go.' : ''}
      />
      {about && <AboutSheet brand={brand} contact={app.contact} onClose={() => setAbout(false)} />}
      <Toast toast={toast} />
    </>
  )
}
