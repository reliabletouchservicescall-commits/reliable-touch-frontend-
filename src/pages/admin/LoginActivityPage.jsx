import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import {
  ShieldCheck, Mail, Phone, Clock, LogIn, LogOut,
  Globe, Search, Eye, EyeOff, KeyRound, X, Loader2,
  CheckCircle2, XCircle, UserCheck, UserX, ChevronDown, ChevronUp,
  Activity, Users, CalendarClock, Wifi,
} from 'lucide-react'
import { usersApi } from '../../services/usersApi'
import axiosClient from '../../lib/axios'

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_META = {
  admin:       { label: 'Admin',       color: '#F95C4B', bg: '#F95C4B18' },
  cold_caller: { label: 'Cold Caller', color: '#3B82F6', bg: '#3B82F618' },
  agency:      { label: 'Agency',      color: '#10B981', bg: '#10B98118' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name = '') {
  return name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2)
}

function fmtDuration(mins) {
  if (mins === null || mins === undefined) return 'Active'
  if (mins < 1)  return '< 1 min'
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// ── Reset Password Modal ──────────────────────────────────────────────────────

function ResetModal({ user, onClose }) {
  const qc = useQueryClient()
  const [pw, setPw]         = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow]     = useState(false)
  const [err, setErr]       = useState('')

  const mut = useMutation({
    mutationFn: () => usersApi.resetPassword(user._id, pw),
    onSuccess: () => {
      toast.success(`Password reset for ${user.firstName}`)
      qc.invalidateQueries({ queryKey: ['login-activity'] })
      onClose()
    },
    onError: (e) => setErr(e.response?.data?.message ?? 'Reset failed'),
  })

  function submit(e) {
    e.preventDefault()
    if (pw.length < 8) return setErr('Password must be at least 8 characters')
    if (!/[A-Z]/.test(pw)) return setErr('Must contain an uppercase letter')
    if (!/[a-z]/.test(pw)) return setErr('Must contain a lowercase letter')
    if (!/\d/.test(pw))    return setErr('Must contain a number')
    if (pw !== confirm)    return setErr('Passwords do not match')
    setErr('')
    mut.mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="w-8 h-8 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center">
            <KeyRound className="w-4 h-4 text-[#F59E0B]" strokeWidth={1.75} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-[#111111] dark:text-white">Reset Password</p>
            <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">{user.firstName} {user.lastName}</p>
          </div>
          <button onClick={onClose} className="text-[#6B7280] hover:text-[#111111] dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="px-5 py-4 space-y-4">
          <div className="p-3 rounded-xl bg-[#F59E0B]/08 border border-[#F59E0B]/20 text-xs text-[#92400E] dark:text-[#FCD34D]">
            This will immediately sign {user.firstName} out of all active sessions.
          </div>

          {[
            { id: 'pw',  label: 'New Password',     val: pw,      set: setPw },
            { id: 'cf',  label: 'Confirm Password',  val: confirm, set: setConfirm },
          ].map(({ id, label, val, set }) => (
            <div key={id}>
              <label className="text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] mb-1 block">{label}</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={val}
                  onChange={(e) => { set(e.target.value); setErr('') }}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-10 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] border border-transparent focus:border-[#F95C4B] text-[#111111] dark:text-white outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]"
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}

          {err && <p className="text-xs text-red-500 font-medium">{err}</p>}

          <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
            Min 8 chars · uppercase · lowercase · number
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mut.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F59E0B] hover:bg-[#D97706] disabled:opacity-60"
            >
              {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Reset Password
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Credential Row (expandable) ───────────────────────────────────────────────

function CredentialRow({ user, onReset, allFeed }) {
  const [expanded, setExpanded] = useState(false)
  const meta = ROLE_META[user.role] ?? ROLE_META.admin
  const userFeed = allFeed.filter((f) => f.userId?.toString() === user._id?.toString()).slice(0, 10)

  return (
    <div className="border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl overflow-hidden bg-white dark:bg-[#181818]">
      {/* Main row */}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Avatar */}
        <div
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
          style={{ backgroundColor: meta.color }}
        >
          {initials(`${user.firstName} ${user.lastName}`)}
        </div>

        {/* Name + email */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-[#111111] dark:text-white">
              {user.firstName} {user.lastName}
            </p>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ backgroundColor: meta.bg, color: meta.color }}
            >
              {meta.label}
            </span>
            {!user.isActive && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                Inactive
              </span>
            )}
            {user.agency && (
              <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">· {user.agency}</span>
            )}
          </div>
          {/* Login identifier */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="flex items-center gap-1 text-xs font-mono text-[#F95C4B]">
              <Mail className="w-3 h-3" />
              {user.email}
            </span>
            {user.phone && (
              <span className="flex items-center gap-1 text-xs text-[#6B7280] dark:text-[#A1A1AA]">
                <Phone className="w-3 h-3" />
                {user.phone}
              </span>
            )}
          </div>
        </div>

        {/* Last login */}
        <div className="hidden sm:block text-right flex-shrink-0">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-[#6B7280] dark:text-[#A1A1AA]">Last login</p>
          <p className="text-xs font-semibold text-[#111111] dark:text-white mt-0.5">
            {user.lastLoginAt
              ? formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })
              : 'Never'}
          </p>
          <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
            {user.totalSessions} session{user.totalSessions !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onReset(user)}
            title="Reset password"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#F59E0B] bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset PW</span>
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            title="View login history"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] bg-[#F5F5F4] dark:bg-[#202020] hover:bg-[#E5E7EB] dark:hover:bg-[#2A2A2A] transition-colors"
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">History</span>
            {expanded ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
          </button>
        </div>
      </div>

      {/* Expanded login history */}
      {expanded && (
        <div className="border-t border-[#E5E7EB] dark:border-[#2A2A2A] px-5 py-4 bg-[#F5F5F4]/50 dark:bg-[#111111]/50">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-[#6B7280] dark:text-[#A1A1AA] mb-3">
            Recent Sessions
          </p>
          {userFeed.length === 0 ? (
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] italic">No login sessions recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {userFeed.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A]"
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.logoutAt ? 'bg-[#6B7280]' : 'bg-[#10B981] animate-pulse'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold text-[#111111] dark:text-white">
                        {format(new Date(s.loginAt), 'dd MMM yyyy, HH:mm')}
                      </p>
                      {!s.logoutAt && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#10B981]/15 text-[#10B981]">
                          Active
                        </span>
                      )}
                    </div>
                    {s.ip && (
                      <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1 mt-0.5">
                        <Globe className="w-2.5 h-2.5" /> {s.ip}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {s.logoutAt && (
                      <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
                        out {format(new Date(s.logoutAt), 'HH:mm')}
                      </p>
                    )}
                    <p className="text-[10px] font-semibold" style={{ color: s.durationMin === null ? '#10B981' : '#6B7280' }}>
                      {fmtDuration(s.durationMin)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Activity Feed Entry ───────────────────────────────────────────────────────

function FeedEntry({ entry }) {
  const meta = ROLE_META[entry.role] ?? ROLE_META.admin
  const isActive = !entry.logoutAt
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#F5F5F4] dark:border-[#2A2A2A] last:border-0">
      {/* Timeline dot */}
      <div className="flex flex-col items-center mt-1 flex-shrink-0">
        <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-[#10B981] shadow-[0_0_6px_#10B981]' : 'bg-[#D1D5DB] dark:bg-[#374151]'}`} />
        <div className="w-px flex-1 bg-[#E5E7EB] dark:bg-[#2A2A2A] mt-1 min-h-[20px]" />
      </div>

      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-[#111111] dark:text-white">{entry.name}</span>
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ backgroundColor: meta.bg, color: meta.color }}>
            {meta.label}
          </span>
          {isActive && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#10B981]/15 text-[#10B981]">
              Active now
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1">
            <LogIn className="w-2.5 h-2.5 text-[#10B981]" />
            {format(new Date(entry.loginAt), 'dd MMM, HH:mm')}
          </span>
          {entry.logoutAt && (
            <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1">
              <LogOut className="w-2.5 h-2.5 text-[#EF4444]" />
              {format(new Date(entry.logoutAt), 'HH:mm')}
            </span>
          )}
          {entry.ip && (
            <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1">
              <Globe className="w-2.5 h-2.5" />
              {entry.ip}
            </span>
          )}
          {entry.durationMin !== null && (
            <span className="text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA]">
              {fmtDuration(entry.durationMin)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LoginActivityPage() {
  const [search,  setSearch]  = useState('')
  const [roleFilter, setRole] = useState('')
  const [resetUser, setReset] = useState(null)
  const [activeTab, setTab]   = useState('credentials') // 'credentials' | 'feed'

  const { data, isLoading } = useQuery({
    queryKey: ['login-activity'],
    queryFn:  () => axiosClient.get('/admin/users/login-activity').then((r) => r.data.data),
    staleTime: 30_000,
  })

  const credentials = data?.credentials ?? []
  const feed        = data?.feed ?? []

  // KPIs
  const activeNow    = feed.filter((f) => !f.logoutAt).length
  const todayLogins  = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0)
    return feed.filter((f) => new Date(f.loginAt) >= today).length
  }, [feed])
  const neverLoggedIn = credentials.filter((c) => !c.lastLoginAt).length
  const totalUsers    = credentials.length

  // Filtered credentials
  const filtered = useMemo(() => {
    let list = credentials
    if (roleFilter) list = list.filter((c) => c.role === roleFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      )
    }
    return list
  }, [credentials, roleFilter, search])

  return (
    <div className="p-5 sm:p-8 max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#111111] dark:text-white tracking-tight">Login Credentials</h1>
            <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">All user accounts, login activity & session history</p>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Users,       label: 'Total Accounts',   value: isLoading ? '…' : totalUsers,    color: '#8B5CF6' },
          { icon: Wifi,        label: 'Active Sessions',   value: isLoading ? '…' : activeNow,     color: '#10B981' },
          { icon: CalendarClock, label: 'Logins Today',   value: isLoading ? '…' : todayLogins,   color: '#F95C4B' },
          { icon: XCircle,     label: 'Never Logged In',  value: isLoading ? '…' : neverLoggedIn, color: '#F59E0B' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}18` }}>
              <Icon className="w-[18px] h-[18px]" style={{ color }} strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-2xl font-black text-[#111111] dark:text-white">{value}</p>
              <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[#F5F5F4] dark:bg-[#202020] rounded-xl p-1 w-fit">
        {[
          { key: 'credentials', label: 'User Credentials', icon: ShieldCheck },
          { key: 'feed',        label: 'Login Timeline',   icon: Activity },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === key
                ? 'bg-white dark:bg-[#2A2A2A] text-[#F95C4B] shadow-sm'
                : 'text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>

      {/* ── CREDENTIALS TAB ── */}
      {activeTab === 'credentials' && (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email…"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white focus:outline-none focus:border-[#F95C4B]"
              />
            </div>
            <div className="flex items-center gap-2">
              {[
                { key: '', label: 'All Roles' },
                { key: 'admin',       label: 'Admin' },
                { key: 'cold_caller', label: 'Cold Caller' },
                { key: 'agency',      label: 'Agency' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setRole(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    roleFilter === key
                      ? 'bg-[#F95C4B] text-white'
                      : 'bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:border-[#F95C4B]/40'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Credentials list */}
          {isLoading ? (
            <div className="space-y-3">
              {[0,1,2,3].map((i) => (
                <div key={i} className="h-20 rounded-2xl bg-[#F5F5F4] dark:bg-[#202020] animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <ShieldCheck className="w-10 h-10 text-[#6B7280]/20" />
              <p className="text-sm font-medium text-[#111111] dark:text-white">No users found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((user) => (
                <CredentialRow
                  key={user._id}
                  user={user}
                  onReset={setReset}
                  allFeed={feed}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── FEED TAB ── */}
      {activeTab === 'feed' && (
        <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
            <Activity className="w-4 h-4 text-[#F95C4B]" strokeWidth={1.75} />
            <span className="text-sm font-bold text-[#111111] dark:text-white">Login Timeline</span>
            <span className="ml-auto text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
              {feed.length} sessions (most recent first)
            </span>
          </div>

          {isLoading ? (
            <div className="p-5 space-y-4">
              {[0,1,2,3,4,5].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] animate-pulse" />
              ))}
            </div>
          ) : feed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Activity className="w-10 h-10 text-[#6B7280]/20" />
              <p className="text-sm font-medium text-[#111111] dark:text-white">No login activity yet</p>
              <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Sessions will appear here once users log in</p>
            </div>
          ) : (
            <div className="px-5 py-4">
              {feed.map((entry, i) => (
                <FeedEntry key={`${entry.userId}-${i}`} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reset password modal */}
      {resetUser && (
        <ResetModal user={resetUser} onClose={() => setReset(null)} />
      )}
    </div>
  )
}
