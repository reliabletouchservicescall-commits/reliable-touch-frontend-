import { useEffect, useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  ArrowLeft,
  ShieldCheck,
  PhoneCall,
  Briefcase,
  Loader2,
  CheckCircle,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../services/authApi'
import { ROLE_HOME } from '../../utils/constants'
import AppHeader from '../../components/layout/AppHeader'

const ROLE_META = {
  admin: { label: 'Administrator', Icon: ShieldCheck },
  cold_caller: { label: 'Cold Caller', Icon: PhoneCall },
  agency: { label: 'Agency', Icon: Briefcase },
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { selectedRole, setSelectedRole, setAuth } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const justRegistered = location.state?.registered === true

  useEffect(() => {
    if (!selectedRole) navigate('/select-role', { replace: true })
  }, [selectedRole, navigate])

  const meta = ROLE_META[selectedRole] ?? ROLE_META.admin
  const { Icon, label } = meta

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await authApi.login(email, password)
      const { user, accessToken, refreshToken } = data.data
      setAuth(user, accessToken, refreshToken)
      setSelectedRole(user.role)
      navigate(ROLE_HOME[user.role] ?? '/select-role', { replace: true })
    } catch (err) {
      const msg =
        err.response?.data?.message || 'Something went wrong. Please try again.'
      setError(msg)
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
          <button
            onClick={() => {
              setSelectedRole(null)
              navigate('/select-role')
            }}
            className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#F95C4B] dark:hover:text-[#F95C4B] mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Change role
          </button>

          {/* Registered success banner */}
          {justRegistered && (
            <div className="flex items-center gap-2.5 text-sm text-[#16A34A] dark:text-[#22C55E] bg-[#16A34A]/8 dark:bg-[#22C55E]/10 border border-[#16A34A]/20 dark:border-[#22C55E]/20 rounded-xl px-4 py-3 mb-5">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Account created successfully. Sign in below.
            </div>
          )}

          {/* Card */}
          <div className="rounded-2xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-card dark:shadow-none p-8">
            <div className="flex items-center gap-3 pb-6 mb-6 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#F95C4B]/10">
                <Icon className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-widest mb-0.5 font-medium">
                  Signing in as
                </p>
                <p className="text-sm font-semibold text-[#111111] dark:text-white">{label}</p>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-[#111111] dark:text-white mb-1.5 tracking-tight">
              Welcome back
            </h1>
            <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mb-8">
              Enter your credentials to access your workspace
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="block text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-widest mb-2"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@reliabletouch.co.za"
                  className="w-full px-4 py-3 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#F95C4B] focus:bg-white dark:focus:bg-[#181818] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 dark:placeholder:text-[#A1A1AA]/40 outline-none ring-2 ring-transparent focus:ring-[#F95C4B]/20"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-widest mb-2"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-12 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#F95C4B] focus:bg-white dark:focus:bg-[#181818] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 dark:placeholder:text-[#A1A1AA]/40 outline-none ring-2 ring-transparent focus:ring-[#F95C4B]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#F95C4B] dark:hover:text-[#F95C4B]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-xs text-[#DC2626] dark:text-[#F87171] bg-[#DC2626]/8 dark:bg-[#F87171]/10 border border-[#DC2626]/20 dark:border-[#F87171]/20 rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between">
                <Link
                  to="/register"
                  className="text-xs text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#F95C4B] dark:hover:text-[#F95C4B]"
                >
                  Create an account
                </Link>
                <Link
                  to="/forgot-password"
                  className="text-xs text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#F95C4B] dark:hover:text-[#F95C4B]"
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  `Sign in as ${label}`
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-xs text-[#6B7280]/60 dark:text-[#A1A1AA]/50 text-center">
            Don't have an account? Contact your administrator.
          </p>
        </div>
      </main>
    </div>
  )
}
