import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Home, Trophy, Star, Check, Phone, Flame, TrendingUp, TrendingDown, Eye } from 'lucide-react'
import axiosClient from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'
import AnimatedNumber from '../../components/dashboard/AnimatedNumber'
import Fireworks from '../../components/common/Fireworks'
import { Skeleton } from '../../components/dashboard/DashboardKit'

// An agent's scorecard — compared with themselves first (the period before), then the team.
// Points and rank, the race against the people around them, calls against their own daily
// goal, milestones, how points are earned and exactly who sees what. Colours follow the
// company's brand; numbers count up, bars grow. Being #1 on today's board earns fireworks
// (once a day here, and live the moment it happens — see SocketContext 'you_are_leader').

const PERIODS = [['week', 'This week'], ['month', 'This month'], ['quarter', 'This quarter']]
const isPeriod = (p) => PERIODS.some(([k]) => k === p)
const PREV = { week: 'last week', month: 'last month', quarter: 'last quarter' }
const MILESTONE_ICON = { home: Home, trophy: Trophy, star: Star, check: Check, phone: Phone, flame: Flame }
const box = 'rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818]'
const initials = (n = '') => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
const AVATAR = ['#FCD34D', 'rgb(var(--brand-light-rgb))', '#E5E7EB', '#C4B5FD', '#93C5FD']

function hm(min) {
  if (min == null) return '—'
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  if (h < 48) return `${h}h ${String(min % 60).padStart(2, '0')}m`
  return `${Math.round(h / 24)}d`
}

function Delta({ diff, prev, label, better = 'up', unit = '' }) {
  if (prev == null && diff == null) return <span className="text-[#9CA3AF]">—</span>
  if (!diff) return <span className="text-[#6B7280] dark:text-[#A1A1AA]">Same as {label}</span>
  const good = better === 'up' ? diff > 0 : diff < 0
  const Icon = diff > 0 ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-1 ${good ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
      <Icon className="h-3.5 w-3.5" /> {Math.abs(diff).toLocaleString()}{unit} {diff > 0 ? 'more' : 'fewer'} than {label}
    </span>
  )
}

function StatCard({ label, children, foot, delay }) {
  return (
    <div className={`${box} mac-in p-4`} style={{ '--d': `${delay}ms` }}>
      <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{label}</p>
      <div className="mt-1 text-[30px] font-bold leading-tight tracking-tight text-[#111111] dark:text-white tabular-nums">{children}</div>
      <p className="mt-1 text-xs font-semibold">{foot}</p>
    </div>
  )
}

// Celebrate being #1 on today's board — once a day on this screen
function useTopOfDay(topToday, userId) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!topToday || !userId) return
    const key = `rt-top-day-${userId}-${new Date().toISOString().slice(0, 10)}`
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1') } catch { /* private mode */ }
    setShow(true)
  }, [topToday, userId])
  return [show, () => setShow(false)]
}

export default function MyProgressPage() {
  const user = useAuthStore((s) => s.user)
  const [period, setPeriod] = useState(() => { try { const p = localStorage.getItem('rt-progress-period'); return isPeriod(p) ? p : 'month' } catch { return 'month' } })
  const pick = (p) => { setPeriod(p); try { localStorage.setItem('rt-progress-period', p) } catch { /* private mode */ } }
  const { data, isLoading } = useQuery({
    queryKey: ['performance', 'agent-progress', period],
    queryFn: () => axiosClient.get('/reports/agent-progress', { params: { period } }).then((r) => r.data.data),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  })
  const { data: team } = useQuery({
    queryKey: ['agency-team', user?.agencyId],
    queryFn: () => axiosClient.get('/agencies/mine/team').then((r) => r.data.data.team),
    staleTime: 5 * 60_000,
  })
  const manager = (team ?? []).find((m) => m.isAgencyManager && m._id !== user?._id)
  const managerName = manager?.firstName ? manager.firstName.charAt(0) + manager.firstName.slice(1).toLowerCase() : 'Your manager'
  const [fireworks, stopFireworks] = useTopOfDay(data?.topToday, user?._id)

  const c = data?.cards
  const prevLabel = PREV[period]
  const maxScore = useMemo(() => Math.max(1, ...(data?.race ?? []).map((r) => r.score)), [data])
  const maxCalls = useMemo(() => Math.max(data?.goal ?? 1, ...(data?.calls?.series ?? []).map((d) => d.calls)), [data])

  return (
    <div className="min-h-full space-y-6 p-4 sm:p-6 xl:p-8">
      {fireworks && <Fireworks onDone={stopFireworks} />}

      {/* Title + period */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111111] dark:text-white">My progress</h1>
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">Your scorecard — compared with you first, then the team.</p>
        </div>
        <div className="flex self-start rounded-xl border border-[#E5E7EB] bg-white p-1 dark:border-[#2A2A2A] dark:bg-[#181818]">
          {PERIODS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => pick(k)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all ${period === k ? 'bg-[#F95C4B] text-white shadow-sm' : 'text-[#6B7280] hover:text-[#111111] dark:text-[#A1A1AA] dark:hover:text-white'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Scorecard */}
      {!c ? <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[112px]" />)}</div> : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
          <StatCard label="Points" delay={0} foot={<span className="text-[#F59E0B]">{c.points.rank ? `#${c.points.rank} of ${c.points.of} agents` : 'Not ranked yet'}</span>}>
            <AnimatedNumber value={c.points.value} />
          </StatCard>
          <StatCard label="Calls" delay={60} foot={<Delta diff={c.calls.diff} prev={c.calls.prev} label={prevLabel} />}><AnimatedNumber value={c.calls.now} /></StatCard>
          <StatCard label="Leads I created" delay={120} foot={<Delta diff={c.created.diff} prev={c.created.prev} label={prevLabel} />}><AnimatedNumber value={c.created.now} /></StatCard>
          <StatCard label="Deals closed" delay={180} foot={<Delta diff={c.closed.diff} prev={c.closed.prev} label={prevLabel} />}>
            <span className={c.closed.now ? 'text-[#10B981]' : ''}><AnimatedNumber value={c.closed.now} /></span>
          </StatCard>
          <StatCard label="Landlord promises kept" delay={240}
            foot={c.promise.total ? <span className={c.promise.pct >= c.promise.aim ? 'text-[#10B981]' : 'text-[#F59E0B]'}>{c.promise.kept} of {c.promise.total} · aim for {c.promise.aim}%</span> : <span className="text-[#9CA3AF]">No Reliable Touch leads open</span>}>
            {c.promise.pct == null ? '—' : <><AnimatedNumber value={c.promise.pct} />%</>}
          </StatCard>
          <StatCard label="First reply to a new lead" delay={300}
            foot={c.reply.minutes != null && c.reply.prevMinutes != null
              ? <Delta diff={c.reply.minutes - c.reply.prevMinutes} prev={c.reply.prevMinutes} label={prevLabel} better="down" unit=" min" />
              : <span className="text-[#9CA3AF]">{c.reply.minutes == null ? 'No new Reliable Touch leads' : 'Average this period'}</span>}>
            {hm(c.reply.minutes)}
          </StatCard>
        </div>
      )}

      {/* Race · calls */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className={`${box} p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[15px] font-bold text-[#111111] dark:text-white">Your race {(PERIODS.find(([k]) => k === period)?.[1] ?? 'This month').toLowerCase()}</p>
            <Link to="/agency/leaderboard" className="rounded-lg border border-[#E5E7EB] px-2.5 py-1 text-xs font-semibold text-[#111111] hover:bg-[#F5F5F4] dark:border-[#2A2A2A] dark:text-white dark:hover:bg-[#232323]">Show full board</Link>
          </div>
          {!data ? <Skeleton className="h-[240px]" /> : (
            <div className="space-y-2.5">
              {data.race.map((r, i) => (
                <div key={r.rank} className={`mac-in flex items-center gap-3 rounded-xl border p-3 ${r.you ? 'border-[#F95C4B]/50 bg-[#F95C4B]/[0.06]' : 'border-[#E5E7EB] dark:border-[#2A2A2A]'}`} style={{ '--d': `${i * 90}ms` }}>
                  <span className="w-5 text-center text-sm font-bold text-[#6B7280] dark:text-[#A1A1AA]">{r.rank}</span>
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-full text-xs font-bold text-[#111111]" style={{ background: r.rank === 1 ? '#FCD34D' : r.you ? 'rgb(var(--brand-light-rgb))' : AVATAR[(i + 2) % AVATAR.length] }}>
                    {r.rank === 1 ? <Trophy className="h-4 w-4" /> : initials(r.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#111111] dark:text-white">{r.you ? 'You' : r.name}</span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[#F1EFEC] dark:bg-[#262626]">
                      <span className="mac-grow-x block h-full rounded-full" style={{ width: `${(r.score / maxScore) * 100}%`, '--d': `${200 + i * 120}ms`, background: r.you ? 'rgb(var(--brand-rgb))' : '#9CA3AF' }} />
                    </span>
                  </span>
                  <span className="text-base font-bold tabular-nums text-[#111111] dark:text-white"><AnimatedNumber value={r.score} /></span>
                </div>
              ))}
              <p className="rounded-xl bg-[#FAFAF9] p-3 text-[13px] leading-relaxed text-[#3F3F46] dark:bg-[#141414] dark:text-[#D4D4D8]">
                {data.nudge.toTop
                  ? <>{data.nudge.toTop} point{data.nudge.toTop === 1 ? '' : 's'} to #1. A closed deal is worth {data.nudge.dealPoints}{data.nudge.ready ? <> — <b>{data.nudge.ready}</b> is listed and ready.</> : '.'}</>
                  : <>You're <b className="text-[#F59E0B]">#1</b> {period === 'week' ? 'this week' : period === 'quarter' ? 'this quarter' : 'this month'}. Keep the lead.</>}
              </p>
            </div>
          )}
        </div>

        <div className={`${box} p-5`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[15px] font-bold text-[#111111] dark:text-white">My calls, last 14 days</p>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Dashed line = your own daily goal ({data?.goal ?? 60})</p>
          </div>
          {!data ? <Skeleton className="h-[240px]" /> : (
            <>
              <div className="relative mt-4 h-[200px]">
                {/* goal line */}
                <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[#9CA3AF]/70" style={{ bottom: `${(data.goal / maxCalls) * 100}%` }} />
                <div className="flex h-full items-end gap-1.5 sm:gap-2.5">
                  {data.calls.series.map((d, i) => {
                    const h = (d.calls / maxCalls) * 100
                    const hit = d.calls >= data.goal
                    return (
                      <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end" title={`${format(new Date(d.date), 'EEE d MMM')}: ${d.calls} calls`}>
                        {d.calls > 0 && <span className="mb-1 text-center text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA]">{d.calls}</span>}
                        <span className={`prog-bar block w-full rounded-t-md ${d.calls ? '' : 'h-[3px] rounded'}`}
                          style={{ height: d.calls ? `${h}%` : undefined, '--d': `${i * 45}ms`, background: d.calls ? (hit ? 'rgb(var(--brand-rgb))' : 'rgb(var(--brand-rgb) / 0.45)') : 'rgb(156 163 175 / 0.3)' }} />
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="mt-2 flex gap-1.5 sm:gap-2.5">
                {data.calls.series.map((d) => <span key={d.date} className={`flex-1 text-center text-[10px] ${d.weekend ? 'text-[#C4C4C4] dark:text-[#52525B]' : 'text-[#9CA3AF]'}`}>{format(new Date(d.date), 'd')}</span>)}
              </div>
              <p className="mt-3 text-[13px] text-[#3F3F46] dark:text-[#D4D4D8]">
                Goal reached on <b>{data.calls.reached} of the last {data.calls.workingDays}</b> working days.
                {data.calls.best && <> Best day: {format(new Date(data.calls.best.date), 'EEE d MMM')}, {data.calls.best.calls} calls.</>}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Milestones */}
      <div className={`${box} p-5`}>
        <p className="mb-4 text-[15px] font-bold text-[#111111] dark:text-white">Milestones</p>
        {!data ? <Skeleton className="h-[200px]" /> : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 min-[1800px]:grid-cols-6">
            {data.milestones.map((m, i) => {
              const Icon = MILESTONE_ICON[m.icon] ?? Star
              const pct = Math.min(100, Math.round((m.current / Math.max(1, m.target)) * 100))
              return (
                <div key={m.key} className={`mac-in rounded-xl border p-4 ${m.done ? 'border-[#10B981]/40 bg-[#10B981]/[0.04]' : 'border-[#E5E7EB] dark:border-[#2A2A2A]'}`} style={{ '--d': `${i * 70}ms` }}>
                  <div className="flex items-center gap-2.5">
                    <span className={`grid h-8 w-8 flex-none place-items-center rounded-lg ${m.done ? 'bg-[#10B981]/15 text-[#10B981]' : 'bg-[#F95C4B]/10 text-[#F95C4B]'}`}><Icon className="h-4 w-4" /></span>
                    <p className="text-sm font-bold leading-tight text-[#111111] dark:text-white">{m.title}</p>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F1EFEC] dark:bg-[#262626]">
                    <div className="mac-grow-x h-full rounded-full" style={{ width: `${pct}%`, '--d': `${300 + i * 80}ms`, background: m.done ? '#10B981' : 'rgb(var(--brand-rgb))' }} />
                  </div>
                  <p className="mt-2 text-xs text-[#6B7280] dark:text-[#A1A1AA]">{m.detail}{m.done && m.at ? `, ${format(new Date(m.at), 'EEE d MMM')}` : ''}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* How points work · who sees what */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className={`${box} p-5`}>
          <p className="text-[15px] font-bold text-[#111111] dark:text-white">How you earn points</p>
          <ul className="mt-3 divide-y divide-[#F1EFEC] dark:divide-[#232323]">
            {(data?.points ?? []).map(([l, n]) => (
              <li key={l} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-[#3F3F46] dark:text-[#D4D4D8]">{l}</span>
                <span className="font-bold text-[#10B981]">+{n}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[#9CA3AF]">Same rules for every agent in your company.</p>
        </div>
        <div className={`${box} overflow-hidden`}>
          <div className="p-5 pb-3">
            <p className="flex items-center gap-2 text-[15px] font-bold text-[#111111] dark:text-white"><Eye className="h-4 w-4 text-[#F95C4B]" /> Who sees what</p>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">No hidden tracking. This is the full list.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-y border-[#F1EFEC] text-left text-xs text-[#6B7280] dark:border-[#232323] dark:text-[#A1A1AA]">
                <th className="px-5 py-2.5 font-semibold">Information</th><th className="px-3 py-2.5 text-center font-semibold">You</th>
                <th className="px-3 py-2.5 text-center font-semibold">{managerName} (manager)</th><th className="px-3 py-2.5 text-center font-semibold">Reliable Touch</th>
              </tr></thead>
              <tbody className="divide-y divide-[#F1EFEC] dark:divide-[#232323]">
                {[
                  ['Calls and call outcomes', 'Yes', 'Yes', 'Only on their leads'],
                  ['Time online and on calls', 'Yes', 'Yes', 'Totals only'],
                  ['Reliable Touch leads and updates', 'Yes', 'Yes', 'Yes'],
                  ['Your own leads', 'Yes', 'Yes', 'Totals only'],
                  ['Your daily goal and streaks', 'Yes', 'Yes', 'No'],
                  ['Points and rank', 'Yes', 'Yes', 'Yes'],
                ].map(([k, ...v]) => (
                  <tr key={k}>
                    <td className="px-5 py-2.5 text-[#111111] dark:text-white">{k}</td>
                    {v.map((x, j) => <td key={j} className={`px-3 py-2.5 text-center font-semibold ${x === 'Yes' ? 'text-[#10B981]' : x === 'No' ? 'text-[#9CA3AF]' : 'text-[#D97706] dark:text-[#FBBF24]'}`}>{x}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {isLoading && <span className="sr-only">Loading</span>}
    </div>
  )
}

