import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import {
  Plus, Loader2, X, Eye, EyeOff, Copy, Check, KeyRound, Power, PowerOff, ShieldCheck,
  UserCircle2, MessageSquare, Mail, Phone, Users, AlertTriangle,
} from 'lucide-react'
import { agenciesApi } from '../../services/agenciesApi'
import { usersApi } from '../../services/usersApi'
import { getApiErrorMessage } from '../leads/leadShared'


// Generated passwords always satisfy the server's rules (length, upper, lower, digit) and
// avoid look-alike characters so they can be read out over the phone without confusion.
export function generatePassword(length = 12) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  const all = upper + lower + digits
  const pick = (set) => set[Math.floor(Math.random() * set.length)]
  const chars = [pick(upper), pick(lower), pick(digits)]
  while (chars.length < length) chars.push(pick(all))
  return chars.sort(() => Math.random() - 0.5).join('')
}

export function inputCls(hasError) {
  return [
    'w-full px-4 py-2.5 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border',
    hasError ? 'border-[#EF4444]' : 'border-transparent focus:border-[#F95C4B]',
    'focus:bg-white dark:focus:bg-[#181818] text-[#111111] dark:text-white',
    'placeholder:text-[#6B7280]/50 outline-none ring-2 ring-transparent focus:ring-[#F95C4B]/20 transition-all',
  ].join(' ')
}

function Field({ label, required, error, children }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-1.5">
        {label}{required && <span className="text-[#F95C4B] ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-[#EF4444]">{error}</p>}
    </div>
  )
}

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Could not copy — select the text and copy it manually')
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#202020] transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  )
}

// Shown once after a password is set — the only time the plain password exists on screen.
function CredentialsPanel({ email, password }) {
  return (
    <div className="rounded-2xl border border-[#10B981]/25 bg-[#10B981]/5 p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[#111111] dark:text-white leading-relaxed">
          Login details are ready. Share them now — the password is only shown this once.
        </p>
      </div>
      <div className="rounded-xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280]">Email</p>
            <p className="text-sm font-mono text-[#111111] dark:text-white truncate">{email}</p>
          </div>
          <CopyButton text={email} />
        </div>
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280]">Password</p>
            <p className="text-sm font-mono font-bold text-[#111111] dark:text-white select-all">{password}</p>
          </div>
          <CopyButton text={password} />
        </div>
      </div>
      <CopyButton text={`Email: ${email}\nPassword: ${password}`} label="Copy both" />
    </div>
  )
}

function ModalShell({ title, subtitle, icon: Icon, onClose, busy, children, footer }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={!busy ? onClose : undefined} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md max-h-[90vh] flex flex-col bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl">
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
                <Icon className="w-4.5 h-4.5 text-[#F95C4B]" strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#111111] dark:text-white">{title}</h2>
                {subtitle && <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{subtitle}</p>}
              </div>
            </div>
            {!busy && (
              <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">{children}</div>
          {footer && <div className="px-6 py-4 border-t border-[#E5E7EB] dark:border-[#2A2A2A] flex gap-3">{footer}</div>}
        </div>
      </div>
    </>
  )
}

/* ─── Add a person to a company's team ─────────────────────────────────────── */

export function AddPersonModal({ agencyId, agencyName, canMakeManager, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: generatePassword(), isManager: false })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [created, setCreated] = useState(null)

  const mut = useMutation({
    mutationFn: () => agenciesApi.addTeamMember(agencyId, {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      password: form.password,
      ...(canMakeManager && form.isManager ? { isManager: true } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agency-team', agencyId] })
      qc.invalidateQueries({ queryKey: ['agency-manager-dashboard'] })
      qc.invalidateQueries({ queryKey: ['agencies'] })
      setCreated({ email: form.email.trim(), password: form.password, name: `${form.firstName} ${form.lastName}` })
      toast.success('Login created')
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Could not add this person')),
  })

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }))
  }

  function submit(e) {
    e.preventDefault()
    const errs = {}
    if (!form.firstName.trim()) errs.firstName = 'Required'
    if (!form.lastName.trim()) errs.lastName = 'Required'
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errs.email = 'Enter a valid email'
    if (!form.phone.trim()) errs.phone = 'Required'
    if (form.password.length < 8 || !/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/\d/.test(form.password)) {
      errs.password = 'At least 8 characters with an uppercase letter, a lowercase letter and a number'
    }
    if (Object.keys(errs).length) { setErrors(errs); return }
    mut.mutate()
  }

  if (created) {
    return (
      <ModalShell title="Login created" subtitle={created.name} icon={UserCircle2} onClose={onClose}
        footer={<button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A]">Done</button>}>
        <CredentialsPanel email={created.email} password={created.password} />
      </ModalShell>
    )
  }

  return (
    <ModalShell
      title={canMakeManager ? 'Add a person to this company' : 'Add an agent'}
      subtitle={agencyName}
      icon={UserCircle2}
      onClose={onClose}
      busy={mut.isPending}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={mut.isPending}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] disabled:opacity-60">
            Cancel
          </button>
          <button form="add-person" type="submit" disabled={mut.isPending}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-60 flex items-center justify-center gap-2">
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Create login
          </button>
        </>
      }
    >
      <form id="add-person" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required error={errors.firstName}>
            <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} className={inputCls(errors.firstName)} />
          </Field>
          <Field label="Last name" required error={errors.lastName}>
            <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} className={inputCls(errors.lastName)} />
          </Field>
        </div>
        <Field label="Email (their login)" required error={errors.email}>
          <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls(errors.email)} placeholder="name@company.co.za" />
        </Field>
        <Field label="Phone" required error={errors.phone}>
          <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls(errors.phone)} placeholder="082 123 4567" />
        </Field>
        <Field label="Password" required error={errors.password}>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                className={`${inputCls(errors.password)} font-mono pr-10`}
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111] dark:hover:text-white">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button type="button" onClick={() => set('password', generatePassword())}
              className="px-3 rounded-xl text-xs font-semibold text-[#F95C4B] bg-[#F95C4B]/10 hover:bg-[#F95C4B]/15 flex items-center gap-1.5 whitespace-nowrap">
              <KeyRound className="w-3.5 h-3.5" /> Generate
            </button>
          </div>
        </Field>
        {canMakeManager && (
          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] cursor-pointer hover:border-[#F95C4B]/40 transition-colors">
            <input type="checkbox" checked={form.isManager} onChange={(e) => set('isManager', e.target.checked)} className="mt-0.5 accent-[#F95C4B]" />
            <div>
              <p className="text-sm font-semibold text-[#111111] dark:text-white">Company manager login</p>
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
                Sees every lead and appointment of the company, and can add and manage its agents.
              </p>
            </div>
          </label>
        )}
      </form>
    </ModalShell>
  )
}

/* ─── Reset a person's password ────────────────────────────────────────────── */

export function ResetPasswordModal({ person, onClose }) {
  const [password, setPassword] = useState(generatePassword())
  const [done, setDone] = useState(false)
  const mut = useMutation({
    mutationFn: () => usersApi.resetPassword(person._id, password),
    onSuccess: () => { setDone(true); toast.success('Password reset') },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Could not reset the password')),
  })

  return (
    <ModalShell
      title="Reset password"
      subtitle={`${person.firstName} ${person.lastName} · ${person.email}`}
      icon={KeyRound}
      onClose={onClose}
      busy={mut.isPending}
      footer={done ? (
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A]">Done</button>
      ) : (
        <>
          <button onClick={onClose} disabled={mut.isPending}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] disabled:opacity-60">
            Cancel
          </button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending || password.length < 8}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-60 flex items-center justify-center gap-2">
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Set new password
          </button>
        </>
      )}
    >
      {done ? (
        <>
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Their existing sessions were signed out. Send them the new password:</p>
          <CredentialsPanel email={person.email} password={password} />
        </>
      ) : (
        <>
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] leading-relaxed">
            A new password is generated for you to hand over. Any device they're signed in on will be signed out.
          </p>
          <div className="flex gap-2">
            <input value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputCls(false)} font-mono`} />
            <button type="button" onClick={() => setPassword(generatePassword())}
              className="px-3 rounded-xl text-xs font-semibold text-[#F95C4B] bg-[#F95C4B]/10 hover:bg-[#F95C4B]/15 whitespace-nowrap">
              Regenerate
            </button>
          </div>
          {password.length < 8 && <p className="text-xs text-[#EF4444]">At least 8 characters.</p>}
        </>
      )}
    </ModalShell>
  )
}

/* ─── Team roster ──────────────────────────────────────────────────────────── */

function initialsOf(m) {
  return `${m.firstName?.[0] ?? ''}${m.lastName?.[0] ?? ''}`.toUpperCase()
}

function MemberCard({ member, canManage, canReset, canMessage, onReset, onToggle, onMessage, toggling }) {
  const active = member.isActive
  return (
    <div className={`bg-white dark:bg-[#181818] rounded-2xl border p-5 flex flex-col gap-4 transition-shadow hover:shadow-md ${
      active ? 'border-[#E5E7EB] dark:border-[#2A2A2A]' : 'border-[#E5E7EB]/70 dark:border-[#2A2A2A]/70 opacity-70'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${member.isAgencyManager ? 'bg-[#F95C4B]' : 'bg-[#6B7280]'}`}>
          {initialsOf(member)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#111111] dark:text-white truncate">{member.firstName} {member.lastName}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              member.isAgencyManager ? 'bg-[#F95C4B]/10 text-[#F95C4B]' : 'bg-[#6B7280]/10 text-[#6B7280] dark:text-[#A1A1AA]'
            }`}>
              {member.isAgencyManager ? <ShieldCheck className="w-3 h-3" /> : <UserCircle2 className="w-3 h-3" />}
              {member.isAgencyManager ? 'Company manager' : 'Agent'}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              active ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#6B7280]/10 text-[#6B7280]'
            }`}>
              {active ? 'Active' : 'Deactivated'}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5 text-xs text-[#6B7280] dark:text-[#A1A1AA]">
        <p className="flex items-center gap-2 truncate"><Mail className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">{member.email}</span></p>
        {member.phone && <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 flex-shrink-0" /> {member.phone}</p>}
        <p className="text-[11px]">
          {member.lastLoginAt ? `Last signed in ${formatDistanceToNow(new Date(member.lastLoginAt), { addSuffix: true })}` : 'Has not signed in yet'}
        </p>
      </div>

      {(canManage || canReset || canMessage) && (
        <div className="flex items-center gap-2 pt-3 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
          {canMessage && (
            <button onClick={onMessage} disabled={!active}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-[#3B82F6] bg-[#3B82F6]/8 hover:bg-[#3B82F6]/15 disabled:opacity-40 transition-colors">
              <MessageSquare className="w-3.5 h-3.5" /> Message
            </button>
          )}
          {canReset && (
            <button onClick={onReset}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-[#111111] dark:text-white bg-[#F5F5F4] dark:bg-[#202020] hover:bg-[#E5E7EB] dark:hover:bg-[#2A2A2A] transition-colors">
              <KeyRound className="w-3.5 h-3.5" /> Reset password
            </button>
          )}
          {canManage && (
            <button onClick={onToggle} disabled={toggling}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60 ${
                active ? 'text-[#EF4444] bg-[#EF4444]/8 hover:bg-[#EF4444]/15' : 'text-[#10B981] bg-[#10B981]/8 hover:bg-[#10B981]/15'
              }`}>
              {toggling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
              {active ? 'Deactivate' : 'Activate'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The company's roster — used both by an admin (on an agency's detail page) and by a
 * company's own manager (on their Team page). What each viewer may do is passed in as flags
 * rather than inferred here, so the two screens can't drift apart.
 */
export function TeamPanel({ agencyId, agencyName, currentUserId, canManage, canMakeManager, canReset, canMessage, onMessage, showAdd = true, embedded = false }) {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [resetting, setResetting] = useState(null)
  const [togglingId, setTogglingId] = useState(null)
  const [filter, setFilter] = useState('all')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['agency-team', agencyId],
    queryFn: () => agenciesApi.listTeam(agencyId).then((r) => r.data.data.team),
    placeholderData: keepPreviousData,
    enabled: Boolean(agencyId),
  })

  const toggleMut = useMutation({
    mutationFn: ({ member, isActive }) => agenciesApi.setTeamMemberActive(agencyId, member._id, isActive),
    onSuccess: (_, { isActive }) => {
      toast.success(isActive ? 'Access restored' : 'Access switched off')
      qc.invalidateQueries({ queryKey: ['agency-team', agencyId] })
      qc.invalidateQueries({ queryKey: ['agencies'] })
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Could not change access')),
    onSettled: () => setTogglingId(null),
  })

  const team = data ?? []
  const visible = team.filter((m) => filter === 'all' || (filter === 'active' ? m.isActive : !m.isActive))
  const activeCount = team.filter((m) => m.isActive).length

  return (
    <div className={embedded ? '' : 'space-y-5'}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          {['all', 'active', 'inactive'].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                filter === f ? 'bg-[#111111] dark:bg-white text-white dark:text-[#111111]' : 'bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'
              }`}>
              {f === 'all' ? `All ${team.length}` : f === 'active' ? `Active ${activeCount}` : `Deactivated ${team.length - activeCount}`}
            </button>
          ))}
        </div>
        {showAdd && canManage && (
          <button onClick={() => setAdding(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-sm hover:shadow-md transition-all">
            <Plus className="w-4 h-4" /> {canMakeManager ? 'Add person' : 'Add agent'}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <div key={i} className="h-48 rounded-2xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] animate-pulse" />)}
        </div>
      ) : isError ? (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444]">
          <AlertTriangle className="w-4 h-4" /> Could not load the team.
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center mb-4">
            <Users className="w-7 h-7 text-[#F95C4B]" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-bold text-[#111111] dark:text-white mb-1">
            {team.length === 0 ? 'No one on this team yet' : 'Nobody matches this filter'}
          </p>
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] max-w-xs">
            {team.length === 0 && canManage ? 'Add the first person so they can sign in and work their leads.' : ''}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((m) => (
            <MemberCard
              key={m._id}
              member={m}
              canManage={canManage && m._id !== currentUserId}
              canReset={canReset && m._id !== currentUserId}
              canMessage={canMessage}
              onMessage={() => onMessage?.(m)}
              onReset={() => setResetting(m)}
              toggling={togglingId === m._id}
              onToggle={() => { setTogglingId(m._id); toggleMut.mutate({ member: m, isActive: !m.isActive }) }}
            />
          ))}
        </div>
      )}

      {adding && (
        <AddPersonModal
          agencyId={agencyId}
          agencyName={agencyName}
          canMakeManager={canMakeManager}
          onClose={() => setAdding(false)}
        />
      )}
      {resetting && <ResetPasswordModal person={resetting} onClose={() => setResetting(null)} />}
    </div>
  )
}
