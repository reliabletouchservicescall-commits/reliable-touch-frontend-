import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { format, formatDistanceToNow } from 'date-fns'
import {
  ShieldCheck, Mail, Phone, Clock, LogIn, LogOut,
  Globe, Search, ChevronDown, ChevronUp,
  Activity, Users, CalendarClock, Wifi, Crown, Loader2,
} from 'lucide-react'
import axiosClient from '../../lib/axios'

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

function CredentialRow({ person, allFeed, onView }) {
  const [expanded, setExpanded] = useState(false)
  const personFeed = allFeed.filter((f) => f.userId?.toString() === person._id?.toString()).slice(0, 10)

  return (
    <div className="border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-2xl overflow-hidden bg-white dark:bg-[#181818]">
      <div className="flex items-center gap-4 px-5 py-4">
        <div
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
          style={{ backgroundColor: '#10B981' }}
        >
          {initials(`${person.firstName} ${person.lastName}`)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-[#111111] dark:text-white">
              {person.firstName} {person.lastName}
            </p>
            {person.isAgencyManager && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F95C4B]/10 text-[#F95C4B]">
                <Crown className="w-2.5 h-2.5" /> Manager
              </span>
            )}
            {!person.isActive && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                Inactive
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="flex items-center gap-1 text-xs font-mono text-[#10B981]">
              <Mail className="w-3 h-3" />
              {person.email}
            </span>
            {person.phone && (
              <span className="flex items-center gap-1 text-xs text-[#6B7280] dark:text-[#A1A1AA]">
                <Phone className="w-3 h-3" />
                {person.phone}
              </span>
            )}
          </div>
        </div>

        <div className="hidden sm:block text-right flex-shrink-0">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-[#6B7280] dark:text-[#A1A1AA]">Last login</p>
          <p className="text-xs font-semibold text-[#111111] dark:text-white mt-0.5">
            {person.lastLoginAt ? formatDistanceToNow(new Date(person.lastLoginAt), { addSuffix: true }) : 'Never'}
          </p>
          <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
            {person.totalSessions} session{person.totalSessions !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onView(person)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#10B981] bg-[#10B981]/10 hover:bg-[#10B981]/20 transition-colors"
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">View Activity</span>
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            title="View login history"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] bg-[#F5F5F4] dark:bg-[#202020] hover:bg-[#E5E7EB] dark:hover:bg-[#2A2A2A] transition-colors"
          >
            <Clock className="w-3.5 h-3.5" />
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#E5E7EB] dark:border-[#2A2A2A] px-5 py-4 bg-[#F5F5F4]/50 dark:bg-[#111111]/50">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-[#6B7280] dark:text-[#A1A1AA] mb-3">
            Recent Sessions
          </p>
          {personFeed.length === 0 ? (
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] italic">No login sessions recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {personFeed.map((s, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A]">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.logoutAt ? 'bg-[#6B7280]' : 'bg-[#10B981] animate-pulse'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold text-[#111111] dark:text-white">
                        {format(new Date(s.loginAt), 'dd MMM yyyy, HH:mm')}
                      </p>
                      {!s.logoutAt && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#10B981]/15 text-[#10B981]">Active</span>
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
                      <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">out {format(new Date(s.logoutAt), 'HH:mm')}</p>
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

function FeedEntry({ entry }) {
  const isActive = !entry.logoutAt
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#F5F5F4] dark:border-[#2A2A2A] last:border-0">
      <div className="flex flex-col items-center mt-1 flex-shrink-0">
        <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-[#10B981] shadow-[0_0_6px_#10B981]' : 'bg-[#D1D5DB] dark:bg-[#374151]'}`} />
        <div className="w-px flex-1 bg-[#E5E7EB] dark:bg-[#2A2A2A] mt-1 min-h-[20px]" />
      </div>
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-[#111111] dark:text-white">{entry.name}</span>
          {entry.isAgencyManager && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#F95C4B]/10 text-[#F95C4B]">Manager</span>
          )}
          {isActive && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#10B981]/15 text-[#10B981]">Active now</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1">
            <LogIn className="w-2.5 h-2.5 text-[#10B981]" /> {format(new Date(entry.loginAt), 'dd MMM, HH:mm')}
          </span>
          {entry.logoutAt && (
            <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1">
              <LogOut className="w-2.5 h-2.5 text-[#EF4444]" /> {format(new Date(entry.logoutAt), 'HH:mm')}
            </span>
          )}
          {entry.ip && (
            <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1">
              <Globe className="w-2.5 h-2.5" /> {entry.ip}
            </span>
          )}
          {entry.durationMin !== null && (
            <span className="text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA]">{fmtDuration(entry.durationMin)}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AgencyLoginActivityPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeTab, setTab] = useState('credentials')

  const { data, isLoading } = useQuery({
    queryKey: ['agency-login-activity'],
    queryFn: () => axiosClient.get('/agents/team/login-activity').then((r) => r.data.data),
    staleTime: 30_000,
  })

  const credentials = data?.credentials ?? []
  const feed = data?.feed ?? []

  const activeNow = feed.filter((f) => !f.logoutAt).length
  const todayLogins = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return feed.filter((f) => new Date(f.loginAt) >= today).length
  }, [feed])
  const neverLoggedIn = credentials.filter((c) => !c.lastLoginAt).length
  const totalTeam = credentials.length

  const filtered = useMemo(() => {
    if (!search) return credentials
    const q = search.toLowerCase()
    return credentials.filter((c) => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
  }, [credentials, search])

  return (
    <div className="p-5 sm:p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#111111] dark:text-white tracking-tight">Login Activity</h1>
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">Your team's sign-in activity &amp; session history</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Users,         label: 'Team Members', value: isLoading ? '…' : totalTeam,     color: '#8B5CF6' },
          { icon: Wifi,          label: 'Active Now',    value: isLoading ? '…' : activeNow,      color: '#10B981' },
          { icon: CalendarClock, label: 'Logins Today',  value: isLoading ? '…' : todayLogins,    color: '#F95C4B' },
          { icon: Clock,         label: 'Never Logged In', value: isLoading ? '…' : neverLoggedIn, color: '#F59E0B' },
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

      <div className="flex items-center gap-1 bg-[#F5F5F4] dark:bg-[#202020] rounded-xl p-1 w-fit">
        {[
          { key: 'credentials', label: 'Team Members', icon: ShieldCheck },
          { key: 'feed', label: 'Login Timeline', icon: Activity },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === key ? 'bg-white dark:bg-[#2A2A2A] text-[#F95C4B] shadow-sm' : 'text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" strokeWidth={1.75} /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'credentials' && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white focus:outline-none focus:border-[#F95C4B]"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-[#F95C4B]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <ShieldCheck className="w-10 h-10 text-[#6B7280]/20" />
              <p className="text-sm font-medium text-[#111111] dark:text-white">No team members found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((person) => (
                <CredentialRow
                  key={person._id}
                  person={person}
                  allFeed={feed}
                  onView={(p) => navigate(`/agency/agents/${p._id}`, { state: { from: 'login-activity' } })}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'feed' && (
        <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
            <Activity className="w-4 h-4 text-[#F95C4B]" strokeWidth={1.75} />
            <span className="text-sm font-bold text-[#111111] dark:text-white">Login Timeline</span>
            <span className="ml-auto text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">{feed.length} sessions (most recent first)</span>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-[#F95C4B]" />
            </div>
          ) : feed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Activity className="w-10 h-10 text-[#6B7280]/20" />
              <p className="text-sm font-medium text-[#111111] dark:text-white">No login activity yet</p>
            </div>
          ) : (
            <div className="px-5 py-4">
              {feed.map((entry, i) => <FeedEntry key={`${entry.userId}-${i}`} entry={entry} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
