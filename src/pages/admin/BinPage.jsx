import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Trash2, Lock, Eye, EyeOff, RotateCcw, Search, X, AlertTriangle, Loader2,
  KeyRound, ArrowLeft, Clock, ChevronLeft, ChevronRight,
  TrendingUp, BookUser, PhoneCall, Users, CalendarCheck,
} from 'lucide-react'
import { binApi } from '../../services/binApi'

const TOKEN_KEY = 'bin_access_token'
const EXP_KEY = 'bin_access_expires'
const BIN_OTP_RECIPIENT_DISPLAY = 'reliabletouchservicescall@gmail.com'

const TYPE_META = {
  Lead:        { label: 'Leads',        icon: TrendingUp,    color: '#F59E0B' },
  Contact:     { label: 'Contacts',     icon: BookUser,      color: '#3B82F6' },
  CallLog:     { label: 'Call Logs',    icon: PhoneCall,     color: '#8B5CF6' },
  User:        { label: 'Users',        icon: Users,         color: '#10B981' },
  Appointment: { label: 'Appointments', icon: CalendarCheck, color: '#F95C4B' },
}
const TYPES = Object.keys(TYPE_META)

function decodeJwtExp(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(base64))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

function formatCountdown(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// A bin snapshot has no consistent shape across types, so the display line is
// extracted per modelName from the raw pre-deletion data.
function primaryLabel(item) {
  const d = item.data || {}
  switch (item.modelName) {
    case 'Lead':
      return { title: d.landlordName || 'Unnamed lead', subtitle: [d.propertyAddress, d.phone].filter(Boolean).join(' · ') }
    case 'Contact':
      return { title: d.name || 'Unnamed contact', subtitle: [d.phone, d.email].filter(Boolean).join(' · ') }
    case 'CallLog':
      return { title: d.outcome ? d.outcome.replace(/_/g, ' ') : 'Call log', subtitle: d.calledAt ? format(new Date(d.calledAt), 'PPp') : '' }
    case 'User':
      return { title: `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim() || 'Unnamed user', subtitle: d.email || '' }
    case 'Appointment':
      return {
        title: d.status ? d.status.replace(/_/g, ' ') : 'Appointment',
        subtitle: [d.scheduledDate ? format(new Date(d.scheduledDate), 'PP') : null, d.scheduledTime].filter(Boolean).join(' · '),
      }
    default:
      return { title: item.modelName, subtitle: '' }
  }
}

/* ─── OTP input ────────────────────────────────────────────────────────────── */

function OtpInput({ value, onChange, disabled }) {
  const refs = useRef([])

  function handleChange(i, e) {
    const v = e.target.value.replace(/\D/g, '').slice(-1)
    const chars = value.split('')
    chars[i] = v
    onChange(chars.join('').slice(0, 6))
    if (v && refs.current[i + 1]) refs.current[i + 1].focus()
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !value[i] && refs.current[i - 1]) {
      refs.current[i - 1].focus()
    }
  }

  function handlePaste(e) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted)
    refs.current[Math.min(pasted.length, 5)]?.focus()
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={value[i] ?? ''}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="w-11 h-12 sm:w-12 sm:h-14 text-center text-lg font-bold rounded-xl bg-[#F5F5F4] dark:bg-[#202020] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/20 outline-none"
        />
      ))}
    </div>
  )
}

/* ─── Confirm dialog ───────────────────────────────────────────────────────── */

function ConfirmDialog({ title, message, confirmLabel, onConfirm, onClose }) {
  const [isPending, setIsPending] = useState(false)

  async function handleConfirm() {
    setIsPending(true)
    try {
      await onConfirm()
      onClose()
    } catch {
      // error already toasted inside onConfirm
    } finally {
      setIsPending(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#EF4444]/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
            </div>
            <h3 className="font-bold text-[#111111] dark:text-white">{title}</h3>
          </div>
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mb-6">{message}</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isPending}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── Locked gate ──────────────────────────────────────────────────────────── */

function LockedGate({ onUnlock }) {
  const [step, setStep] = useState('password') // password | otp | forgot-otp
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  async function submitPassword(e) {
    e.preventDefault()
    if (!password) return
    setLoading(true)
    try {
      await binApi.requestAccessOtp(password)
      setOtp('')
      setStep('otp')
      setCooldown(30)
      toast.success('Code sent to the Bin recovery email')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Incorrect password')
    } finally {
      setLoading(false)
    }
  }

  async function submitOtp(e) {
    e.preventDefault()
    if (otp.length !== 6) return
    setLoading(true)
    try {
      const res = await binApi.verifyAccessOtp(otp)
      toast.success('Bin unlocked')
      onUnlock(res.data.data.token)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Incorrect or expired code')
    } finally {
      setLoading(false)
    }
  }

  async function startForgot() {
    setLoading(true)
    try {
      await binApi.requestForgotPasswordOtp()
      setOtp('')
      setNewPassword('')
      setConfirmPassword('')
      setStep('forgot-otp')
      setCooldown(30)
      toast.success('Recovery code sent to the Bin recovery email')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to send recovery code')
    } finally {
      setLoading(false)
    }
  }

  async function resend() {
    if (cooldown > 0) return
    setLoading(true)
    try {
      if (step === 'forgot-otp') await binApi.requestForgotPasswordOtp()
      else await binApi.requestAccessOtp(password)
      setCooldown(30)
      toast.success('Code resent')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to resend code')
    } finally {
      setLoading(false)
    }
  }

  async function submitForgotReset(e) {
    e.preventDefault()
    if (otp.length !== 6 || !newPassword) return
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await binApi.resetPassword(otp, newPassword)
      toast.success('Bin password reset — sign in with your new password')
      setStep('password')
      setPassword('')
      setOtp('')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-card p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-[#F95C4B]" strokeWidth={1.75} />
          </div>
          <h1 className="text-lg font-bold text-[#111111] dark:text-white">Bin is Locked</h1>
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mt-1">
            {step === 'password' && 'Deleted leads, contacts, call logs, users, and appointments live here. Enter the Bin password to continue.'}
            {step === 'otp' && `Enter the 6-digit code sent to ${BIN_OTP_RECIPIENT_DISPLAY}.`}
            {step === 'forgot-otp' && 'Enter the recovery code and choose a new Bin password.'}
          </p>
        </div>

        {step === 'password' && (
          <form onSubmit={submitPassword} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Bin password"
                autoFocus
                className="w-full px-4 py-3 pr-11 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/20 outline-none text-[#111111] dark:text-white"
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button type="submit" disabled={loading || !password} className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Continue
            </button>
            <button type="button" onClick={startForgot} disabled={loading} className="w-full text-center text-xs font-medium text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#F95C4B]">
              Forgot password?
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={submitOtp} className="space-y-5">
            <OtpInput value={otp} onChange={setOtp} disabled={loading} />
            <button type="submit" disabled={loading || otp.length !== 6} className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Unlock Bin
            </button>
            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => { setStep('password'); setOtp('') }} className="flex items-center gap-1 text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button type="button" onClick={resend} disabled={cooldown > 0 || loading} className="font-semibold text-[#F95C4B] disabled:opacity-50 disabled:cursor-not-allowed">
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}

        {step === 'forgot-otp' && (
          <form onSubmit={submitForgotReset} className="space-y-4">
            <OtpInput value={otp} onChange={setOtp} disabled={loading} />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New Bin password"
              className="w-full px-4 py-3 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/20 outline-none text-[#111111] dark:text-white"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full px-4 py-3 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/20 outline-none text-[#111111] dark:text-white"
            />
            <button type="submit" disabled={loading || otp.length !== 6 || !newPassword} className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Reset Password
            </button>
            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => { setStep('password'); setOtp('') }} className="flex items-center gap-1 text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button type="button" onClick={resend} disabled={cooldown > 0 || loading} className="font-semibold text-[#F95C4B] disabled:opacity-50 disabled:cursor-not-allowed">
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

/* ─── Change password modal ────────────────────────────────────────────────── */

function ChangePasswordModal({ onClose }) {
  const [step, setStep] = useState('current') // current | otp
  const [currentPassword, setCurrentPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  async function submitCurrent(e) {
    e.preventDefault()
    if (!currentPassword) return
    setLoading(true)
    try {
      await binApi.requestChangePasswordOtp(currentPassword)
      setStep('otp')
      setCooldown(30)
      toast.success('Code sent to the Bin recovery email')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Incorrect current password')
    } finally {
      setLoading(false)
    }
  }

  async function resend() {
    if (cooldown > 0) return
    setLoading(true)
    try {
      await binApi.requestChangePasswordOtp(currentPassword)
      setCooldown(30)
      toast.success('Code resent')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to resend code')
    } finally {
      setLoading(false)
    }
  }

  async function submitNew(e) {
    e.preventDefault()
    if (otp.length !== 6 || !newPassword) return
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await binApi.changePassword(otp, newPassword)
      toast.success('Bin password changed')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-[#F95C4B]" />
              </div>
              <h3 className="font-bold text-[#111111] dark:text-white">Change Bin Password</h3>
            </div>
            <button onClick={onClose} aria-label="Close" className="text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {step === 'current' && (
            <form onSubmit={submitCurrent} className="space-y-4">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current Bin password"
                autoFocus
                className="w-full px-4 py-3 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/20 outline-none text-[#111111] dark:text-white"
              />
              <button type="submit" disabled={loading || !currentPassword} className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-60 flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />} Send Code
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={submitNew} className="space-y-4">
              <p className="text-center text-xs text-[#6B7280] dark:text-[#A1A1AA]">
                Code sent to <span className="font-semibold text-[#111111] dark:text-white">{BIN_OTP_RECIPIENT_DISPLAY}</span>
              </p>
              <OtpInput value={otp} onChange={setOtp} disabled={loading} />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New Bin password"
                className="w-full px-4 py-3 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/20 outline-none text-[#111111] dark:text-white"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full px-4 py-3 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/20 outline-none text-[#111111] dark:text-white"
              />
              <button type="submit" disabled={loading || otp.length !== 6 || !newPassword} className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-60 flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />} Update Password
              </button>
              <button type="button" onClick={resend} disabled={cooldown > 0 || loading} className="w-full text-center text-xs font-semibold text-[#F95C4B] disabled:opacity-50 disabled:cursor-not-allowed">
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  )
}

/* ─── Item card ────────────────────────────────────────────────────────────── */

function ItemCard({ item, onRestore, onDelete, isRestoring }) {
  const meta = TYPE_META[item.modelName]
  const { title, subtitle } = primaryLabel(item)
  const deletedByName = item.deletedBy
    ? `${item.deletedBy.firstName ?? ''} ${item.deletedBy.lastName ?? ''}`.trim() || 'Unknown'
    : 'Unknown'

  return (
    <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#D1D5DB] dark:hover:border-[#3A3A3A] transition-colors">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${meta.color}18` }}>
        <meta.icon className="w-5 h-5" style={{ color: meta.color }} strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-[#111111] dark:text-white truncate capitalize">{title}</p>
          <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md" style={{ color: meta.color, backgroundColor: `${meta.color}18` }}>
            {meta.label.replace(/s$/, '')}
          </span>
        </div>
        {subtitle && <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate mt-0.5">{subtitle}</p>}
        <p className="text-[10px] text-[#6B7280]/70 dark:text-[#A1A1AA]/60 mt-1">
          Deleted by {deletedByName} · {formatDistanceToNow(new Date(item.deletedAt), { addSuffix: true })}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button title="Restore" onClick={onRestore} disabled={isRestoring} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#10B981]/10 hover:text-[#10B981] disabled:opacity-50 transition-all">
          {isRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" strokeWidth={1.75} />}
        </button>
        <button title="Permanently Delete" onClick={onDelete} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#EF4444]/10 hover:text-[#EF4444] transition-all">
          <Trash2 className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}

function BinEmptyState({ hasFilters }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#10B981]/10 flex items-center justify-center mb-4">
        <Trash2 className="w-7 h-7 text-[#10B981]" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">
        {hasFilters ? 'No matching items in the Bin' : 'The Bin is empty'}
      </h3>
      <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] max-w-xs">
        {hasFilters ? 'Try a different filter or search.' : 'Deleted leads, contacts, call logs, users, and appointments show up here.'}
      </p>
    </div>
  )
}

/* ─── Unlocked bin ─────────────────────────────────────────────────────────── */

function UnlockedBin({ token, expiresAt, now, onLock }) {
  const [modelName, setModelName] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [toPermanentlyDelete, setToPermanentlyDelete] = useState(null)
  const [emptyBinConfirm, setEmptyBinConfirm] = useState(false)
  const [restoringId, setRestoringId] = useState(null)

  const debouncedSearch = useDebounce(search)
  const qc = useQueryClient()

  useEffect(() => { setPage(1) }, [modelName, debouncedSearch])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['bin-items', { modelName, search: debouncedSearch, page }],
    queryFn: () =>
      binApi
        .listItems(token, { modelName: modelName || undefined, search: debouncedSearch || undefined, page, limit: 20 })
        .then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })

  const items      = data?.items ?? []
  const total      = data?.total ?? 0
  const totalPages = data?.totalPages ?? 1
  const hasFilters = Boolean(modelName || debouncedSearch)

  async function handleRestore(item) {
    setRestoringId(item._id)
    try {
      await binApi.restoreItem(token, item._id)
      qc.invalidateQueries({ queryKey: ['bin-items'] })
      toast.success(`${TYPE_META[item.modelName].label.replace(/s$/, '')} restored`)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to restore item')
    } finally {
      setRestoringId(null)
    }
  }

  async function confirmPermanentDelete() {
    try {
      await binApi.permanentlyDelete(token, toPermanentlyDelete._id)
      qc.invalidateQueries({ queryKey: ['bin-items'] })
      toast.success('Permanently deleted')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete')
      throw err
    }
  }

  async function confirmEmptyBin() {
    try {
      const res = await binApi.emptyBin(token, modelName || undefined)
      qc.invalidateQueries({ queryKey: ['bin-items'] })
      toast.success(`Emptied ${res.data.data.deletedCount} item(s)`)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to empty bin')
      throw err
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-5 sm:px-8 pt-6 pb-4 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-[#111111] dark:text-white flex items-center gap-2.5">
              <Trash2 className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
              Bin
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
              {isLoading ? 'Loading...' : `${total} item${total === 1 ? '' : 's'}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#10B981]/10 text-[#10B981] text-xs font-semibold">
              <Clock className="w-3.5 h-3.5" /> {formatCountdown(expiresAt - now)}
            </div>
            <button onClick={() => setShowChangePassword(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
              <KeyRound className="w-3.5 h-3.5" /> Change Password
            </button>
            <button onClick={onLock} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
              <Lock className="w-3.5 h-3.5" /> Lock Bin
            </button>
            <button
              onClick={() => setEmptyBinConfirm(true)}
              disabled={items.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" /> Empty {modelName ? TYPE_META[modelName].label : 'Bin'}
            </button>
          </div>
        </div>

        {/* Type filter pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setModelName('')}
            className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              !modelName ? 'bg-[#111111] dark:bg-white text-white dark:text-[#111111]' : 'border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]'
            }`}
          >
            All
          </button>
          {TYPES.map((t) => {
            const meta = TYPE_META[t]
            const active = modelName === t
            return (
              <button
                key={t}
                onClick={() => setModelName(t)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  active ? 'text-white' : 'border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]'
                }`}
                style={active ? { backgroundColor: meta.color } : undefined}
              >
                <meta.icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                {meta.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Search */}
      <div className="px-5 sm:px-8 py-3 bg-[#FAFAF9] dark:bg-[#0B0B0B] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deleted items..."
            className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/20 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111] dark:hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto px-5 sm:px-8 py-5">
        {isError && (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444] mb-4">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Failed to load bin items.
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-28"><Loader2 className="w-6 h-6 animate-spin text-[#F95C4B]" /></div>
        ) : items.length === 0 ? (
          <BinEmptyState hasFilters={hasFilters} />
        ) : (
          <>
            <div className="space-y-2.5">
              {items.map((item) => (
                <ItemCard
                  key={item._id}
                  item={item}
                  onRestore={() => handleRestore(item)}
                  onDelete={() => setToPermanentlyDelete(item)}
                  isRestoring={restoringId === item._id}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-5">
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Page {page} of {totalPages} — {total} results</p>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="w-8 h-8 rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-white dark:hover:bg-[#181818] disabled:opacity-40">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-8 h-8 rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-white dark:hover:bg-[#181818] disabled:opacity-40">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}

      {toPermanentlyDelete && (
        <ConfirmDialog
          title="Permanently Delete"
          message={`This will permanently delete this ${TYPE_META[toPermanentlyDelete.modelName].label.replace(/s$/, '').toLowerCase()}. This cannot be undone.`}
          confirmLabel="Delete Forever"
          onConfirm={confirmPermanentDelete}
          onClose={() => setToPermanentlyDelete(null)}
        />
      )}

      {emptyBinConfirm && (
        <ConfirmDialog
          title={`Empty ${modelName ? TYPE_META[modelName].label : 'Bin'}`}
          message={`This will permanently delete all ${modelName ? TYPE_META[modelName].label.toLowerCase() : 'items'} currently in the Bin. This cannot be undone.`}
          confirmLabel="Empty Forever"
          onConfirm={confirmEmptyBin}
          onClose={() => setEmptyBinConfirm(false)}
        />
      )}
    </div>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default function BinPage() {
  const [token, setToken] = useState(null)
  const [expiresAt, setExpiresAt] = useState(null)
  const [now, setNow] = useState(Date.now())

  // Load any still-valid session left over from a previous visit; silently discard a stale one.
  useEffect(() => {
    try {
      const storedToken = sessionStorage.getItem(TOKEN_KEY)
      const storedExp = Number(sessionStorage.getItem(EXP_KEY))
      if (storedToken && storedExp && storedExp > Date.now()) {
        setToken(storedToken)
        setExpiresAt(storedExp)
      } else if (storedToken) {
        sessionStorage.removeItem(TOKEN_KEY)
        sessionStorage.removeItem(EXP_KEY)
      }
    } catch {
      // sessionStorage unavailable — fall back to locked, page-scoped-only state
    }
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  function lock() {
    setToken(null)
    setExpiresAt(null)
    try {
      sessionStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(EXP_KEY)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (token && expiresAt && expiresAt <= now) {
      lock()
      toast.info('Bin session expired — please unlock again')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now])

  function unlock(newToken) {
    const exp = decodeJwtExp(newToken) ?? Date.now() + 30 * 60 * 1000
    setToken(newToken)
    setExpiresAt(exp)
    try {
      sessionStorage.setItem(TOKEN_KEY, newToken)
      sessionStorage.setItem(EXP_KEY, String(exp))
    } catch {
      // ignore
    }
  }

  const unlocked = Boolean(token && expiresAt && expiresAt > now)

  return (
    <div className="flex flex-col h-full min-h-0">
      {unlocked
        ? <UnlockedBin token={token} expiresAt={expiresAt} now={now} onLock={lock} />
        : <LockedGate onUnlock={unlock} />}
    </div>
  )
}
