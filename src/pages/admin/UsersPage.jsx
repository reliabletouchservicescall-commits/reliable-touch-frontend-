import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Plus, Search, X, Pencil, Trash2, Eye, AlertTriangle, Loader2,
  Users, Mail, Phone, UserCheck, UserX, Eye as EyeOn, EyeOff,
  Clock, ToggleLeft, ToggleRight, SlidersHorizontal, KeyRound,
} from 'lucide-react'
import { usersApi } from '../../services/usersApi'

/* ─── Constants ───────────────────────────────────────────────────────────── */

const ROLE_TABS = [
  { key: '',            label: 'All' },
  { key: 'admin',       label: 'Admin' },
  { key: 'cold_caller', label: 'Cold Caller' },
  { key: 'agent',       label: 'Agent' },
]

const ROLE_META = {
  admin:       { label: 'Admin',       color: '#F95C4B', bg: '#F95C4B18' },
  cold_caller: { label: 'Cold Caller', color: '#3B82F6', bg: '#3B82F618' },
  agent:       { label: 'Agent',       color: '#10B981', bg: '#10B98118' },
}

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest' },
  { value: 'createdAt',  label: 'Oldest' },
  { value: 'firstName',  label: 'Name A-Z' },
  { value: '-firstName', label: 'Name Z-A' },
]

const EMPTY_CREATE = {
  firstName: '', lastName: '', email: '', password: '', phone: '', role: 'cold_caller',
}

const ROLES_SELECT = ['admin', 'cold_caller', 'agent']

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function inputCls(hasError) {
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

const AVATAR_COLORS = ['#F95C4B', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4']

function Avatar({ name }) {
  const initials = (name ?? '?').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  const color = AVATAR_COLORS[initials.charCodeAt(0) % AVATAR_COLORS.length]
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  )
}

function RoleBadge({ role }) {
  const meta = ROLE_META[role] ?? ROLE_META.agent
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold"
      style={{ color: meta.color, backgroundColor: meta.bg }}
    >
      {meta.label}
    </span>
  )
}

function StatusChip({ isActive }) {
  return isActive ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold text-[#10B981] bg-[#10B98118]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold text-[#6B7280] bg-[#6B728018]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#6B7280]" />
      Inactive
    </span>
  )
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

function ActionBtn({ icon: Icon, title, onClick, variant }) {
  const colors = {
    blue:   'hover:bg-[#3B82F6]/10 hover:text-[#3B82F6]',
    red:    'hover:bg-[#EF4444]/10 hover:text-[#EF4444]',
    green:  'hover:bg-[#10B981]/10 hover:text-[#10B981]',
    amber:  'hover:bg-[#F59E0B]/10 hover:text-[#F59E0B]',
    def:    'hover:bg-[#F5F5F4] dark:hover:bg-[#202020] hover:text-[#111111] dark:hover:text-white',
  }
  return (
    <button
      title={title}
      onClick={onClick}
      className={`w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] transition-all ${colors[variant] ?? colors.def}`}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
    </button>
  )
}

/* ─── Create Drawer ───────────────────────────────────────────────────────── */

function CreateDrawer({ onClose, onSaved }) {
  const [form, setForm]         = useState(EMPTY_CREATE)
  const [errors, setErrors]     = useState({})
  const [showPass, setShowPass] = useState(false)
  const qc = useQueryClient()

  const mut = useMutation({
    mutationFn: (data) => usersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User created successfully')
      onSaved()
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to create user'),
  })

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }))
  }

  function validate() {
    const errs = {}
    if (!form.firstName.trim()) errs.firstName = 'First name is required'
    if (!form.lastName.trim())  errs.lastName  = 'Last name is required'
    if (!form.email.trim())     errs.email     = 'Email is required'
    if (!form.phone.trim())     errs.phone     = 'Phone is required'

    const pw = form.password
    if (!pw)                       errs.password = 'Password is required'
    else if (pw.length < 8)        errs.password = 'Password must be at least 8 characters'
    else if (!/[A-Z]/.test(pw))    errs.password = 'Password must contain at least one uppercase letter'
    else if (!/[a-z]/.test(pw))    errs.password = 'Password must contain at least one lowercase letter'
    else if (!/\d/.test(pw))       errs.password = 'Password must contain at least one number'

    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    mut.mutate(form)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[480px] flex flex-col bg-white dark:bg-[#181818] shadow-2xl border-l border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
            </div>
            <h2 className="text-sm font-bold text-[#111111] dark:text-white">New User</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <form id="create-user-form" onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name" required error={errors.firstName}>
                <input value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} placeholder="Sipho" className={inputCls(errors.firstName)} />
              </Field>
              <Field label="Last Name" required error={errors.lastName}>
                <input value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} placeholder="Dlamini" className={inputCls(errors.lastName)} />
              </Field>
            </div>

            <Field label="Email" required error={errors.email}>
              <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="user@reliabletouch.com" className={inputCls(errors.email)} />
            </Field>

            <Field label="Password" required error={errors.password}>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                  placeholder="e.g. Secure123"
                  className={`${inputCls(errors.password)} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <EyeOn className="w-4 h-4" />}
                </button>
              </div>
              {!errors.password && (
                <p className="mt-1.5 text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
                  Min 8 chars · one uppercase · one lowercase · one number
                </p>
              )}
            </Field>

            <Field label="Phone" required error={errors.phone}>
              <input value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="+27711234567" className={inputCls(errors.phone)} />
            </Field>

            <Field label="Role">
              <select value={form.role} onChange={(e) => setField('role', e.target.value)} className={inputCls(false)}>
                {ROLES_SELECT.map((r) => (
                  <option key={r} value={r}>{ROLE_META[r]?.label ?? r}</option>
                ))}
              </select>
            </Field>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-[#E5E7EB] dark:border-[#2A2A2A] flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            Cancel
          </button>
          <button type="submit" form="create-user-form" disabled={mut.isPending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Create User
          </button>
        </div>
      </div>
    </>
  )
}

/* ─── Edit Drawer ─────────────────────────────────────────────────────────── */

function EditDrawer({ user, onClose, onSaved }) {
  const [form, setForm]   = useState({
    firstName: user?.firstName ?? '',
    lastName:  user?.lastName  ?? '',
    phone:     user?.phone     ?? '',
    role:      user?.role      ?? 'cold_caller',
    isActive:  user?.isActive  ?? true,
  })
  const [errors, setErrors] = useState({})
  const qc = useQueryClient()

  const mut = useMutation({
    mutationFn: (data) => usersApi.update(user._id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User updated successfully')
      onSaved()
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to update user'),
  })

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }))
  }

  function validate() {
    const errs = {}
    if (!form.firstName.trim()) errs.firstName = 'First name is required'
    if (!form.lastName.trim())  errs.lastName  = 'Last name is required'
    if (!form.phone.trim())     errs.phone     = 'Phone is required'
    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    mut.mutate(form)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[480px] flex flex-col bg-white dark:bg-[#181818] shadow-2xl border-l border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center">
              <Pencil className="w-5 h-5 text-[#3B82F6]" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#111111] dark:text-white">Edit User</h2>
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{user?.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <form id="edit-user-form" onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name" required error={errors.firstName}>
                <input value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} className={inputCls(errors.firstName)} />
              </Field>
              <Field label="Last Name" required error={errors.lastName}>
                <input value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} className={inputCls(errors.lastName)} />
              </Field>
            </div>

            <Field label="Phone" required error={errors.phone}>
              <input value={form.phone} onChange={(e) => setField('phone', e.target.value)} className={inputCls(errors.phone)} />
            </Field>

            <Field label="Role">
              <select value={form.role} onChange={(e) => setField('role', e.target.value)} className={inputCls(false)}>
                {ROLES_SELECT.map((r) => (
                  <option key={r} value={r}>{ROLE_META[r]?.label ?? r}</option>
                ))}
              </select>
            </Field>

            <Field label="Status">
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setField('isActive', !form.isActive)}
                  className="flex items-center gap-2 text-sm"
                >
                  {form.isActive
                    ? <ToggleRight className="w-6 h-6 text-[#10B981]" />
                    : <ToggleLeft className="w-6 h-6 text-[#6B7280]" />
                  }
                  <span className={form.isActive ? 'text-[#10B981]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}>
                    {form.isActive ? 'Active' : 'Inactive'}
                  </span>
                </button>
              </div>
            </Field>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-[#E5E7EB] dark:border-[#2A2A2A] flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            Cancel
          </button>
          <button type="submit" form="edit-user-form" disabled={mut.isPending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </>
  )
}

/* ─── View Drawer ─────────────────────────────────────────────────────────── */

function ViewDrawer({ user, onClose }) {
  const { data: historyData, isLoading } = useQuery({
    queryKey: ['user-login-history', user._id],
    queryFn: () => usersApi.loginHistory(user._id).then((r) => r.data.data),
    staleTime: 30_000,
  })

  const history = historyData?.loginHistory ?? historyData ?? []
  const recent  = Array.isArray(history) ? history.slice(-5).reverse() : []

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[480px] flex flex-col bg-white dark:bg-[#181818] shadow-2xl border-l border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
              <Eye className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
            </div>
            <h2 className="text-sm font-bold text-[#111111] dark:text-white">User Details</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Info card */}
          <div className="flex items-center gap-4">
            <Avatar name={`${user.firstName} ${user.lastName}`} />
            <div>
              <h3 className="text-base font-bold text-[#111111] dark:text-white">{user.firstName} {user.lastName}</h3>
              <div className="flex items-center gap-2 mt-1">
                <RoleBadge role={user.role} />
                <StatusChip isActive={user.isActive} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A] overflow-hidden">
            {[
              { icon: Mail,  label: 'Email', value: user.email },
              { icon: Phone, label: 'Phone', value: user.phone },
              { icon: Clock, label: 'Last Login', value: user.lastLoginAt ? format(new Date(user.lastLoginAt), 'd MMM yyyy, HH:mm') : 'Never' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3 px-4 py-3 bg-white dark:bg-[#181818]">
                <Icon className="w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA] mt-0.5 flex-shrink-0" strokeWidth={1.75} />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">{label}</p>
                  <p className="text-sm text-[#111111] dark:text-white">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Login history */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Recent Login History
            </p>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-[#F95C4B]" />
              </div>
            ) : recent.length === 0 ? (
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] italic">No login history yet</p>
            ) : (
              <div className="space-y-2">
                {recent.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#F5F5F4] dark:bg-[#202020]">
                    <div>
                      <p className="text-xs font-semibold text-[#111111] dark:text-white">
                        {format(new Date(entry.loginAt), 'd MMM yyyy, HH:mm')}
                      </p>
                      {entry.ip && (
                        <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">{entry.ip}</p>
                      )}
                    </div>
                    {entry.logoutAt && (
                      <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
                        out {format(new Date(entry.logoutAt), 'HH:mm')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] space-y-1">
            <p>Created: {format(new Date(user.createdAt), 'd MMM yyyy, HH:mm')}</p>
            <p>Updated: {format(new Date(user.updatedAt), 'd MMM yyyy, HH:mm')}</p>
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── Delete Dialog ───────────────────────────────────────────────────────── */

function DeleteDialog({ user, onClose, onDeleted }) {
  const qc  = useQueryClient()
  const deactivateMut = useMutation({
    mutationFn: () => usersApi.deactivate(user._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User deactivated')
      onDeleted()
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to deactivate'),
  })
  const deleteMut = useMutation({
    mutationFn: () => usersApi.remove(user._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('User deleted')
      onDeleted()
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Delete failed'),
  })

  const busy = deactivateMut.isPending || deleteMut.isPending

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#EF4444]/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
            </div>
            <h3 className="font-bold text-[#111111] dark:text-white">Delete User</h3>
          </div>
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mb-2">
            You are about to delete <span className="font-semibold text-[#111111] dark:text-white">{user.firstName} {user.lastName}</span>.
          </p>
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mb-6">
            Consider <span className="text-[#F59E0B] font-semibold">deactivating</span> instead to preserve their history. Deletion cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} disabled={busy} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] disabled:opacity-40">
              Cancel
            </button>
            <button onClick={() => deactivateMut.mutate()} disabled={busy} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-60 flex items-center justify-center gap-2">
              {deactivateMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Deactivate
            </button>
            <button onClick={() => deleteMut.mutate()} disabled={busy} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-60 flex items-center justify-center gap-2">
              {deleteMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── Reset Password Dialog ───────────────────────────────────────────────── */

function ResetPasswordDialog({ user, onClose, onSaved }) {
  const [password, setPassword]   = useState('')
  const [confirm,  setConfirm]    = useState('')
  const [showPw,   setShowPw]     = useState(false)
  const [error,    setError]      = useState('')
  const qc = useQueryClient()

  const mut = useMutation({
    mutationFn: () => usersApi.resetPassword(user._id, password),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(`Password reset for ${user.firstName} ${user.lastName}`)
      onSaved()
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to reset password'),
  })

  function validate() {
    if (!password)              return 'New password is required'
    if (password.length < 8)   return 'Password must be at least 8 characters'
    if (!/[A-Z]/.test(password)) return 'Must contain at least one uppercase letter'
    if (!/[a-z]/.test(password)) return 'Must contain at least one lowercase letter'
    if (!/\d/.test(password))   return 'Must contain at least one number'
    if (password !== confirm)   return 'Passwords do not match'
    return ''
  }

  function handleSubmit(e) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    mut.mutate()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-[#F59E0B]" strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#111111] dark:text-white">Reset Password</h2>
                <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">
                  {user.firstName} {user.lastName}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div className="p-3 rounded-xl bg-[#F59E0B]/8 border border-[#F59E0B]/20 text-xs text-[#92400E] dark:text-[#FCD34D]">
              This will immediately sign the user out of all active sessions.
            </div>

            <Field label="New Password" required error={null}>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  placeholder="e.g. Secure123"
                  className={`${inputCls(Boolean(error))} pr-10`}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <EyeOn className="w-4 h-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
                Min 8 chars · one uppercase · one lowercase · one number
              </p>
            </Field>

            <Field label="Confirm Password" required error={error}>
              <input
                type={showPw ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError('') }}
                placeholder="Re-enter password"
                className={inputCls(Boolean(error))}
              />
            </Field>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={mut.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mut.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Reset Password
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

/* ─── User Row ────────────────────────────────────────────────────────────── */

function UserRow({ user, onView, onEdit, onDelete, onToggleActive, onResetPassword }) {
  const fullName = `${user.firstName} ${user.lastName}`
  return (
    <tr className="group hover:bg-[#FAFAF9] dark:hover:bg-[#111111] transition-colors">
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <Avatar name={fullName} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#111111] dark:text-white truncate max-w-[160px]">{fullName}</p>
            <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] truncate max-w-[160px]">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <span className="text-sm text-[#111111] dark:text-white font-mono">{user.phone}</span>
      </td>
      <td className="px-4 py-3.5">
        <RoleBadge role={user.role} />
      </td>
      <td className="px-4 py-3.5">
        <StatusChip isActive={user.isActive} />
      </td>
      <td className="px-4 py-3.5">
        <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA] whitespace-nowrap">
          {user.lastLoginAt ? format(new Date(user.lastLoginAt), 'd MMM yyyy') : 'Never'}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <ActionBtn icon={Eye}      title="View details"   onClick={onView} />
          <ActionBtn icon={Pencil}   title="Edit user"      onClick={onEdit}          variant="blue" />
          <ActionBtn icon={KeyRound} title="Reset password" onClick={onResetPassword} variant="amber" />
          <ActionBtn
            icon={user.isActive ? UserX : UserCheck}
            title={user.isActive ? 'Deactivate user' : 'Reactivate user'}
            onClick={onToggleActive}
            variant={user.isActive ? 'amber' : 'green'}
          />
          <ActionBtn icon={Trash2} title="Delete user" onClick={onDelete} variant="red" />
        </div>
      </td>
    </tr>
  )
}

/* ─── Empty state ─────────────────────────────────────────────────────────── */

function EmptyState({ hasFilters, onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center mb-4">
        <Users className="w-7 h-7 text-[#F95C4B]" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">
        {hasFilters ? 'No users found' : 'No users yet'}
      </h3>
      <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mb-6 max-w-xs">
        {hasFilters ? 'Try adjusting your search or filters.' : 'Get started by adding your first team member.'}
      </p>
      {!hasFilters && (
        <button onClick={onAdd} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A]">
          <Plus className="w-4 h-4" />
          Add User
        </button>
      )}
    </div>
  )
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */

export default function UsersPage() {
  const [search,          setSearch]          = useState('')
  const [roleFilter,      setRole]            = useState('')
  const [sort,            setSort]            = useState('-createdAt')
  const [drawer,          setDrawer]          = useState(null)
  const [toDelete,        setToDelete]        = useState(null)
  const [toResetPassword, setToResetPassword] = useState(null)
  const qc = useQueryClient()

  const debouncedSearch = useDebounce(search)

  useEffect(() => { /* reset if needed */ }, [debouncedSearch, roleFilter, sort])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['users', { search: debouncedSearch, role: roleFilter, sort }],
    queryFn: () =>
      usersApi
        .list({ search: debouncedSearch || undefined, role: roleFilter || undefined, sort, limit: 100 })
        .then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })

  const users = data?.users ?? data ?? []

  const toggleActiveMut = useMutation({
    mutationFn: (user) =>
      user.isActive
        ? usersApi.deactivate(user._id)
        : usersApi.update(user._id, { isActive: true }),
    onSuccess: (_, user) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(user.isActive ? 'User deactivated' : 'User reactivated')
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Action failed'),
  })

  const hasFilters = Boolean(search || roleFilter)
  const total = Array.isArray(users) ? users.length : 0

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="px-5 sm:px-8 pt-6 pb-0 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-[#111111] dark:text-white tracking-tight flex items-center gap-2.5">
              <Users className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
              Users
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
              {isLoading ? 'Loading...' : `${total} team member${total !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={() => setDrawer({ mode: 'create' })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>

        {/* Role tabs */}
        <div className="flex gap-0.5 overflow-x-auto">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setRole(tab.key)}
              className={[
                'flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap',
                'border-b-2 transition-all rounded-t-lg',
                roleFilter === tab.key
                  ? 'border-[#F95C4B] text-[#F95C4B] bg-[#F95C4B]/5 dark:bg-[#F95C4B]/8'
                  : 'border-transparent text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#202020]',
              ].join(' ')}
            >
              {tab.key && (
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: ROLE_META[tab.key]?.color }}
                />
              )}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="px-5 sm:px-8 py-3 flex flex-col sm:flex-row gap-3 bg-[#FAFAF9] dark:bg-[#0B0B0B] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email..."
            className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 dark:placeholder:text-[#A1A1AA]/40 focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/20 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111] dark:hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] self-start">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#A1A1AA] flex-shrink-0" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-transparent text-[#111111] dark:text-white text-sm outline-none cursor-pointer"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Table area ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-5 sm:px-8 py-5">
        {isError && (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444] mb-4">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Failed to load users. Please try refreshing the page.
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-28">
            <Loader2 className="w-6 h-6 animate-spin text-[#F95C4B]" />
          </div>
        ) : !Array.isArray(users) || users.length === 0 ? (
          <EmptyState hasFilters={hasFilters} onAdd={() => setDrawer({ mode: 'create' })} />
        ) : (
          <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-[#FAFAF9] dark:bg-[#111111] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
                  <tr>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">User</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Phone</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Role</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Status</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Last Login</th>
                    <th className="px-4 py-3.5 text-right text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F4] dark:divide-[#202020]">
                  {users.map((u) => (
                    <UserRow
                      key={u._id}
                      user={u}
                      onView={() => setDrawer({ mode: 'view', user: u })}
                      onEdit={() => setDrawer({ mode: 'edit', user: u })}
                      onDelete={() => setToDelete(u)}
                      onToggleActive={() => toggleActiveMut.mutate(u)}
                      onResetPassword={() => setToResetPassword(u)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Drawers ──────────────────────────────────────────────────────── */}
      {drawer?.mode === 'create' && (
        <CreateDrawer onClose={() => setDrawer(null)} onSaved={() => setDrawer(null)} />
      )}
      {drawer?.mode === 'edit' && drawer.user && (
        <EditDrawer user={drawer.user} onClose={() => setDrawer(null)} onSaved={() => setDrawer(null)} />
      )}
      {drawer?.mode === 'view' && drawer.user && (
        <ViewDrawer user={drawer.user} onClose={() => setDrawer(null)} />
      )}

      {/* ── Delete dialog ─────────────────────────────────────────────────── */}
      {toDelete && (
        <DeleteDialog user={toDelete} onClose={() => setToDelete(null)} onDeleted={() => setToDelete(null)} />
      )}

      {/* ── Reset password dialog ─────────────────────────────────────────── */}
      {toResetPassword && (
        <ResetPasswordDialog
          user={toResetPassword}
          onClose={() => setToResetPassword(null)}
          onSaved={() => setToResetPassword(null)}
        />
      )}
    </div>
  )
}
