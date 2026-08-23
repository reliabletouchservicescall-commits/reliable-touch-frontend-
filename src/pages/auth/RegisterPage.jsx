import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Check, X } from 'lucide-react'
import { authApi } from '../../services/authApi'
import AppHeader from '../../components/layout/AppHeader'

function PasswordRule({ met, label }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] ${met ? 'text-[#16A34A] dark:text-[#22C55E]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>
      {met ? <Check className="w-3 h-3" strokeWidth={2.5} /> : <X className="w-3 h-3" strokeWidth={2.5} />}
      {label}
    </span>
  )
}

function extractErrors(err) {
  const fields = {}
  const list = err.response?.data?.errors
  if (Array.isArray(list)) {
    list.forEach(({ field, message }) => { fields[field] = message })
  }
  return fields
}

export default function RegisterPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [globalError, setGlobalError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const pw = form.password
  const passwordRules = {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    digit: /\d/.test(pw),
  }
  const passwordStrong = Object.values(passwordRules).every(Boolean)

  async function handleSubmit(e) {
    e.preventDefault()
    setGlobalError('')
    setFieldErrors({})

    if (!passwordStrong) {
      setFieldErrors({ password: 'Password does not meet all requirements' })
      return
    }
    if (form.password !== form.confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match' })
      return
    }

    setLoading(true)
    try {
      await authApi.register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      })
      navigate('/login', { state: { registered: true } })
    } catch (err) {
      const extracted = extractErrors(err)
      if (Object.keys(extracted).length > 0) {
        setFieldErrors(extracted)
      } else {
        setGlobalError(err.response?.data?.message || 'Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAF9] dark:bg-[#0B0B0B] flex flex-col">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-gradient-to-b from-[#F95C4B]/[0.045] dark:from-[#F95C4B]/[0.07] to-transparent" />

      <AppHeader />

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md animate-slide-up">
          <Link
            to="/select-role"
            className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#F95C4B] dark:hover:text-[#F95C4B] mb-8"
          >
            ← Back to role selection
          </Link>

          <div className="rounded-2xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-card dark:shadow-none p-8">
            <h1 className="text-2xl font-bold text-[#111111] dark:text-white mb-1.5 tracking-tight">
              Create an account
            </h1>
            <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mb-8">
              Fill in your details to register. Contact your admin if you need a specific role assigned.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* First + Last name row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-widest mb-2">
                    First name
                  </label>
                  <input
                    type="text"
                    autoComplete="given-name"
                    required
                    value={form.firstName}
                    onChange={(e) => set('firstName', e.target.value)}
                    placeholder="Jane"
                    className={`w-full px-3.5 py-3 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border ${fieldErrors.firstName ? 'border-[#DC2626] dark:border-[#F87171]' : 'border-transparent focus:border-[#F95C4B]'} focus:bg-white dark:focus:bg-[#181818] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 dark:placeholder:text-[#A1A1AA]/40 outline-none ring-2 ring-transparent focus:ring-[#F95C4B]/20`}
                  />
                  {fieldErrors.firstName && (
                    <p className="text-[11px] text-[#DC2626] dark:text-[#F87171] mt-1">{fieldErrors.firstName}</p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-widest mb-2">
                    Last name
                  </label>
                  <input
                    type="text"
                    autoComplete="family-name"
                    required
                    value={form.lastName}
                    onChange={(e) => set('lastName', e.target.value)}
                    placeholder="Doe"
                    className={`w-full px-3.5 py-3 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border ${fieldErrors.lastName ? 'border-[#DC2626] dark:border-[#F87171]' : 'border-transparent focus:border-[#F95C4B]'} focus:bg-white dark:focus:bg-[#181818] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 dark:placeholder:text-[#A1A1AA]/40 outline-none ring-2 ring-transparent focus:ring-[#F95C4B]/20`}
                  />
                  {fieldErrors.lastName && (
                    <p className="text-[11px] text-[#DC2626] dark:text-[#F87171] mt-1">{fieldErrors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-widest mb-2">
                  Email address
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="you@reliabletouch.co.za"
                  className={`w-full px-4 py-3 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border ${fieldErrors.email ? 'border-[#DC2626] dark:border-[#F87171]' : 'border-transparent focus:border-[#F95C4B]'} focus:bg-white dark:focus:bg-[#181818] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 dark:placeholder:text-[#A1A1AA]/40 outline-none ring-2 ring-transparent focus:ring-[#F95C4B]/20`}
                />
                {fieldErrors.email && (
                  <p className="text-[11px] text-[#DC2626] dark:text-[#F87171] mt-1">{fieldErrors.email}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-widest mb-2">
                  Phone number
                </label>
                <input
                  type="tel"
                  autoComplete="tel"
                  required
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="+27 71 000 0000"
                  className={`w-full px-4 py-3 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border ${fieldErrors.phone ? 'border-[#DC2626] dark:border-[#F87171]' : 'border-transparent focus:border-[#F95C4B]'} focus:bg-white dark:focus:bg-[#181818] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 dark:placeholder:text-[#A1A1AA]/40 outline-none ring-2 ring-transparent focus:ring-[#F95C4B]/20`}
                />
                {fieldErrors.phone && (
                  <p className="text-[11px] text-[#DC2626] dark:text-[#F87171] mt-1">{fieldErrors.phone}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-widest mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    placeholder="Min 8 chars, upper, lower, number"
                    className={`w-full px-4 py-3 pr-12 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border ${fieldErrors.password ? 'border-[#DC2626] dark:border-[#F87171]' : 'border-transparent focus:border-[#F95C4B]'} focus:bg-white dark:focus:bg-[#181818] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 dark:placeholder:text-[#A1A1AA]/40 outline-none ring-2 ring-transparent focus:ring-[#F95C4B]/20`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#F95C4B]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Password rules */}
                {form.password.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
                    <PasswordRule met={passwordRules.length} label="8+ characters" />
                    <PasswordRule met={passwordRules.upper} label="Uppercase" />
                    <PasswordRule met={passwordRules.lower} label="Lowercase" />
                    <PasswordRule met={passwordRules.digit} label="Number" />
                  </div>
                )}
                {fieldErrors.password && (
                  <p className="text-[11px] text-[#DC2626] dark:text-[#F87171] mt-1">{fieldErrors.password}</p>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-widest mb-2">
                  Confirm password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={form.confirmPassword}
                  onChange={(e) => set('confirmPassword', e.target.value)}
                  placeholder="••••••••"
                  className={`w-full px-4 py-3 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border ${fieldErrors.confirmPassword ? 'border-[#DC2626] dark:border-[#F87171]' : 'border-transparent focus:border-[#F95C4B]'} focus:bg-white dark:focus:bg-[#181818] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 dark:placeholder:text-[#A1A1AA]/40 outline-none ring-2 ring-transparent focus:ring-[#F95C4B]/20`}
                />
                {fieldErrors.confirmPassword && (
                  <p className="text-[11px] text-[#DC2626] dark:text-[#F87171] mt-1">{fieldErrors.confirmPassword}</p>
                )}
              </div>

              {/* Global error */}
              {globalError && (
                <div className="text-xs text-[#DC2626] dark:text-[#F87171] bg-[#DC2626]/8 dark:bg-[#F87171]/10 border border-[#DC2626]/20 dark:border-[#F87171]/20 rounded-xl px-4 py-3">
                  {globalError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  'Create account'
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-xs text-[#6B7280]/60 dark:text-[#A1A1AA]/50 text-center">
            Already have an account?{' '}
            <Link
              to="/select-role"
              className="text-[#F95C4B] hover:underline font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
