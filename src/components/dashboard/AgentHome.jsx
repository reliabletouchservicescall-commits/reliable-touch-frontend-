import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatDistanceToNowStrict, format } from 'date-fns'
import {
  ArrowRight, MessageSquare, Check, Plus, Bell, Flame, Home, UserCheck, CalendarCheck, Users, Send, Loader2, Eye,
  Trophy, Sparkles, KeyRound, Clock, Inbox, AlertTriangle, PhoneOutgoing, Megaphone,
} from 'lucide-react'
import axiosClient from '../../lib/axios'
import { CORAL } from '../../lib/brand'
import { tenantsApi } from '../../services/tenantsApi'
import { useAuthStore } from '../../store/authStore'
import { Card, CardTitle, LinkButton, Skeleton, Pipeline, TemperatureDonut, ProvincePanel, UpcomingVisits, TrendChart, ChartLegend } from './DashboardKit'
import { StatusPill, TenantReviewDrawer, linkOf } from '../tenants/TenantApplications'

// An agent's home: where they stand, today's goal, the next three things worth doing, what's
// new, the landlord promise and their tenants' links — then the pipeline, map, temperature and
// visits from the company overview. Colours follow the company's brand (CSS brand variables).

const ago = (d) => (d ? formatDistanceToNowStrict(new Date(d), { addSuffix: false }).replace(/ (\w)\w*$/, '$1').replace(' ', '') : '')
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }
const TONE = {
  danger: { ring: '#EF4444', soft: 'bg-[#EF4444]/[0.06] border-[#EF4444]/30', label: 'text-[#EF4444]', btn: 'bg-[#EF4444] hover:bg-[#DC2626] text-white' },
  violet: { ring: '#8B5CF6', soft: '', label: 'text-[#8B5CF6]', btn: '' },
  amber: { ring: '#F59E0B', soft: '', label: 'text-[#D97706] dark:text-[#FBBF24]', btn: '' },
  blue: { ring: 'rgb(var(--brand-rgb))', soft: '', label: 'text-[#F95C4B]', btn: '' },
}
const NEWS_ICON = {
  agency_lead_comment: [MessageSquare, CORAL], lead_changed: [Sparkles, '#8B5CF6'], lead_status_updated: [Check, '#8B5CF6'],
  lead_assigned_to_agent: [Plus, CORAL], lead_assigned_to_agency: [Plus, CORAL], agency_agent_assigned: [UserCheck, '#3B82F6'],
  appointment_booked: [CalendarCheck, '#0EA5E9'], appointment_reminder: [CalendarCheck, '#0EA5E9'], appointment_confirmed: [CalendarCheck, '#0EA5E9'],
  tenant_application: [Users, '#6366F1'], hot_lead: [Flame, '#EF4444'], lead_status_escalated: [Flame, '#EF4444'],
  new_message: [MessageSquare, '#3B82F6'], daily_winner: [Trophy, '#F59E0B'], personal_record: [Trophy, '#F59E0B'],
  property_rented: [KeyRound, '#10B981'], listing_signed: [Home, '#10B981'],
  lead_negotiation_reminder: [Clock, '#F59E0B'], lead_followup_due: [Clock, '#F59E0B'], lead_followup_nudge: [Clock, '#F59E0B'],
  campaign_daily_reminder: [Megaphone, '#8B5CF6'], leaderboard_leader_changed: [Trophy, '#F59E0B'], contacts_assigned: [Users, '#3B82F6'],
}
// Same reminder several times (e.g. a campaign every day) → one row with a count
const cleanTitle = (t = '') => t.replace(/^[^\p{L}\p{N}]+/u, '').trim()
function groupNews(items) {
  const out = []
  for (const n of items) {
    const key = `${n.event}|${cleanTitle(n.title)}|${n.leadId ?? ''}`
    const prev = out.find((x) => x.key === key)
    if (prev) { prev.count += 1; prev.read = prev.read && n.read } else out.push({ ...n, key, count: 1, title: cleanTitle(n.title) })
  }
  return out.slice(0, 6)
}

const box = 'rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818]'

/* ─── Today's goal ──────────────────────────────────────────────────────── */

function GoalRing({ goal }) {
  const qc = useQueryClient()
  const set = useMutation({
    mutationFn: (g) => axiosClient.patch('/reports/agent-home/goal', { goal: g }),
    onMutate: (g) => qc.setQueryData(['agent-home'], (d) => d && ({ ...d, goal: { ...d.goal, target: g } })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-home'] }),
    onError: () => toast.error('Could not save your goal'),
  })
  const r = 52, c = 2 * Math.PI * r
  const pct = Math.min(1, goal.done / Math.max(1, goal.target))
  const done = goal.done >= goal.target
  return (
    <div className={`${box} flex flex-col items-center p-5`}>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">My goal for today</p>
      <div className="relative my-3 h-[132px] w-[132px]">
        <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90">
          <circle cx="66" cy="66" r={r} fill="none" strokeWidth="11" className="stroke-[#F1EFEC] dark:stroke-[#262626]" />
          <circle cx="66" cy="66" r={r} fill="none" strokeWidth="11" strokeLinecap="round"
            stroke={done ? '#10B981' : 'rgb(var(--brand-rgb))'} strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
            style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1)' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[26px] font-bold leading-none tracking-tight text-[#111111] dark:text-white tabular-nums">{goal.done}<span className="text-sm font-semibold text-[#9CA3AF]">/{goal.target}</span></p>
          <p className="mt-1 text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">{done ? 'Goal reached 🎉' : 'calls today'}</p>
        </div>
      </div>
      <div className="flex gap-1.5">
        {goal.options.map((g) => (
          <button key={g} type="button" onClick={() => g !== goal.target && set.mutate(g)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${g === goal.target ? 'bg-[#111111] text-white dark:bg-white dark:text-[#111111]' : 'border border-[#E5E7EB] text-[#6B7280] hover:text-[#111111] dark:border-[#2A2A2A] dark:text-[#A1A1AA] dark:hover:text-white'}`}>
            {g} calls
          </button>
        ))}
      </div>
      <p className="mt-2.5 text-center text-[11px] text-[#9CA3AF]">You choose the target. Your manager sees it too.</p>
    </div>
  )
}

/* ─── Hero ──────────────────────────────────────────────────────────────── */

function Hero({ data, firstName }) {
  const s = data.standing
  const st = data.stats
  const tiles = [
    [st.closedMonth, 'deals closed this month', 'text-[#10B981]'],
    [st.listedMonth, 'properties listed', 'text-[#8B5CF6]'],
    [st.callsMonth.toLocaleString(), 'calls this month', 'text-[#111111] dark:text-white'],
    st.bestDay ? [`#${st.bestDay.rank}`, `on the daily board on ${format(new Date(st.bestDay.date), 'EEEE')}`, 'text-[#F59E0B]'] : [s ? s.score : '—', 'points this month', 'text-[#F59E0B]'],
  ]
  return (
    <div className={`${box} relative overflow-hidden p-6`}>
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#F95C4B]/10 blur-3xl" />
      <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{format(new Date(), 'EEEE d MMMM')}</p>
      <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-[#111111] dark:text-white">{greeting()}, {firstName}</h1>
      {s && (
        <p className="mt-1 text-[15px] text-[#3F3F46] dark:text-[#D4D4D8]">
          {s.rank === 1
            ? <>You're <b className="text-[#F59E0B]">#1 this month</b> out of {s.of} — keep the lead.</>
            : <>You're <b className="text-[#F59E0B]">#{s.rank} this month</b> — just {s.above.gap} point{s.above.gap === 1 ? '' : 's'} behind {s.above.firstName}. {s.oneDealToTop ? 'One closed deal puts you on top.' : `A closed deal is worth ${s.dealPoints} points.`}</>}
        </p>
      )}
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map(([v, l, tone]) => (
          <div key={l} className="rounded-xl border border-[#E5E7EB] bg-[#FAFAF9] px-4 py-3 dark:border-[#2A2A2A] dark:bg-[#141414]">
            <p className={`text-2xl font-bold tracking-tight tabular-nums ${tone}`}>{v}</p>
            <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[#A1A1AA]">{l}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Next three moves ──────────────────────────────────────────────────── */

function useNudge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (t) => tenantsApi.remind(t.id),
    onSuccess: (_, t) => { toast.success(`Reminder emailed to ${t.firstName}`); qc.invalidateQueries({ queryKey: ['agent-home'] }) },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Could not send the reminder'),
  })
}

// Email when we have one, otherwise a ready WhatsApp message
function nudgeTenant(t, nudge) {
  if (t.email) return nudge.mutate(t)
  const msg = `Hi ${t.firstName}, just a reminder to finish your rental application for ${t.property} — it saves as you go:\n${linkOf(t)}`
  const phone = String(t.phone ?? '').replace(/\D/g, '').replace(/^0/, '27')
  window.open(`https://wa.me/${phone.length >= 10 ? phone : ''}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')
  tenantsApi.shared(t.id, 'whatsapp').catch(() => {})
}

function Moves({ moves, tenants, onReview }) {
  const navigate = useNavigate()
  const nudge = useNudge()
  if (!moves.length) {
    return (
      <div className={`${box} flex items-center gap-4 p-5`}>
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#10B981]/12 text-[#10B981]"><Check className="h-5 w-5" strokeWidth={3} /></span>
        <div><p className="text-sm font-bold text-[#111111] dark:text-white">You're all caught up</p><p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">No landlord is waiting, no follow-up is due. A good time to make calls.</p></div>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {moves.map((m, i) => {
        const tone = TONE[m.tone] ?? TONE.blue
        const lead = i === 0
        const go = () => {
          if (m.nudge) { const t = tenants.find((x) => x.id === m.applicationId); if (t) nudgeTenant(t, nudge); return }
          if (m.applicationId) return onReview(m.applicationId)
          navigate(m.to)
        }
        return (
          <div key={m.key} className={`mac-in flex flex-col rounded-2xl border p-5 ${lead && m.tone === 'danger' ? `${tone.soft}` : 'border-[#E5E7EB] bg-white dark:border-[#2A2A2A] dark:bg-[#181818]'}`} style={{ '--d': `${i * 70}ms` }}>
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: tone.ring }}>{i + 1}</span>
              <span className={`text-[11px] font-bold uppercase tracking-wider ${tone.label}`}>{m.label}</span>
              <span className="ml-auto text-[11px] text-[#9CA3AF]">{m.eta}</span>
            </div>
            <p className="mt-3 text-[15px] font-bold leading-snug text-[#111111] dark:text-white">{m.title}</p>
            <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-[#6B7280] dark:text-[#A1A1AA]">{m.detail}</p>
            <button type="button" onClick={go} disabled={m.nudge && nudge.isPending}
              className={`mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${lead
                ? (m.tone === 'danger' ? tone.btn : 'bg-[#F95C4B] text-white hover:bg-[#E84B3A]')
                : 'bg-[#F5F5F4] text-[#111111] hover:bg-[#EDEDEA] dark:bg-[#232323] dark:text-white dark:hover:bg-[#2A2A2A]'}`}>
              {m.nudge && nudge.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {m.cta} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

/* ─── What's new ────────────────────────────────────────────────────────── */

function WhatsNew({ news }) {
  const navigate = useNavigate()
  return (
    <div className={`${box} overflow-hidden`}>
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <p className="text-[15px] font-bold text-[#111111] dark:text-white">What's new for you</p>
        <span className="flex items-center gap-3">
          {news.unread > 0 && <span className="rounded-full bg-[#F95C4B]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#F95C4B]">{news.unread} new</span>}
          <Link to="/agency/notifications" className="text-xs font-semibold text-[#6B7280] hover:text-[#F95C4B] dark:text-[#A1A1AA]">All</Link>
        </span>
      </div>
      {news.items.length ? (
        <ul className="divide-y divide-[#F1EFEC] dark:divide-[#232323]">
          {groupNews(news.items).map((n) => {
            const [Icon, color] = NEWS_ICON[n.event] ?? [Bell, '#9CA3AF']
            return (
              <li key={n.id}>
                <button type="button" onClick={() => navigate(n.leadId ? `/agency/leads/${n.leadId}` : '/agency/notifications')}
                  className={`flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[#FAFAF9] dark:hover:bg-[#1E1E1E] ${n.read ? '' : 'bg-[#F95C4B]/[0.03]'}`}>
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-xl" style={{ backgroundColor: `${color}1A`, color }}><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-[#111111] dark:text-white">{n.title}</span>
                      {n.count > 1 && <span className="flex-none rounded-full bg-[#F5F5F4] px-1.5 text-[10px] font-bold text-[#6B7280] dark:bg-[#232323] dark:text-[#A1A1AA]">×{n.count}</span>}
                      {!n.read && <span className="h-1.5 w-1.5 flex-none rounded-full bg-[#F95C4B]" />}
                    </span>
                    <span className="mt-0.5 line-clamp-1 block text-xs text-[#6B7280] dark:text-[#A1A1AA]">{n.message}</span>
                  </span>
                  <span className="flex-none text-[11px] text-[#9CA3AF]">{ago(n.at)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : <p className="px-5 pb-6 text-sm text-[#9CA3AF]">Nothing new — you're up to date.</p>}
    </div>
  )
}

/* ─── Landlord promise ──────────────────────────────────────────────────── */

function Countdown({ hoursLeft, total }) {
  const late = hoursLeft <= 0
  const r = 15, c = 2 * Math.PI * r
  const frac = late ? 1 : Math.max(0.04, Math.min(1, hoursLeft / total))
  const color = late ? '#EF4444' : hoursLeft <= 12 ? '#F59E0B' : '#10B981'
  const label = late ? `−${Math.max(1, Math.round(-hoursLeft / 24))}d` : hoursLeft >= 24 ? `${Math.round(hoursLeft / 24)}d` : `${hoursLeft}h`
  return (
    <span className="relative grid h-10 w-10 flex-none place-items-center">
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" strokeWidth="3.5" className="stroke-[#F1EFEC] dark:stroke-[#262626]" />
        <circle cx="20" cy="20" r={r} fill="none" strokeWidth="3.5" strokeLinecap="round" stroke={color} strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
      </svg>
      <span className="text-[10px] font-bold" style={{ color }}>{label}</span>
    </span>
  )
}

function Promise({ promise }) {
  const navigate = useNavigate()
  const all = promise.total > 0 && promise.kept === promise.total
  return (
    <div className={`${box} p-5`}>
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-bold text-[#111111] dark:text-white">Landlord promise</p>
        {promise.total > 0 && <span className={`text-xs font-bold ${all ? 'text-[#10B981]' : promise.kept / promise.total >= 0.7 ? 'text-[#D97706]' : 'text-[#EF4444]'}`}>{promise.kept} of {promise.total} kept</span>}
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[#6B7280] dark:text-[#A1A1AA]">Landlords from Reliable Touch were promised news every {promise.hours} hours. Keep the promise, keep the streak.</p>
      {promise.leads.length ? (
        <ul className="mt-3 space-y-2">
          {promise.leads.map((l) => (
            <li key={l.id}>
              <button type="button" onClick={() => navigate(`/agency/leads/${l.id}`)}
                className="flex w-full items-center gap-3 rounded-xl bg-[#FAFAF9] p-2.5 text-left transition-colors hover:bg-[#F1EFEC] dark:bg-[#141414] dark:hover:bg-[#1E1E1E]">
                <Countdown hoursLeft={l.hoursLeft} total={promise.hours} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-[#111111] dark:text-white">{l.landlordName}</span>
                  <span className={`block text-[11px] ${l.hoursLeft <= 0 ? 'text-[#EF4444]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>
                    {l.hoursLeft <= 0 ? `Window passed ${format(new Date(l.dueAt), 'EEE')} · update to restart` : `Next update due ${format(new Date(l.dueAt), 'EEE HH:mm')}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 rounded-xl bg-[#FAFAF9] p-3 text-xs text-[#9CA3AF] dark:bg-[#141414]">No open Reliable Touch leads right now.</p>}
    </div>
  )
}

/* ─── Tenant links ──────────────────────────────────────────────────────── */

function Tenants({ tenants, onReview }) {
  const nudge = useNudge()
  const c = tenants.counts
  const chips = [['To review', c.review, '#8B5CF6'], ['Filling in', c.filling, '#F59E0B'], ['Not opened', c.notOpened, '#9CA3AF'], ['Approved', c.approved, '#10B981']].filter(([, n]) => n)
  return (
    <div className={`${box} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-2 px-5 pb-3 pt-5">
        <p className="mr-auto flex items-center gap-2 text-[15px] font-bold text-[#111111] dark:text-white"><Users className="h-4 w-4 text-[#F95C4B]" /> Your tenants' applications</p>
        {chips.map(([l, n, col]) => <span key={l} className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: col, backgroundColor: `${col}1F` }}>{n} {l.toLowerCase()}</span>)}
        <Link to="/agency/tenants" className="text-xs font-semibold text-[#6B7280] hover:text-[#F95C4B] dark:text-[#A1A1AA]">All</Link>
      </div>
      {tenants.list.length ? (
        <ul className="divide-y divide-[#F1EFEC] dark:divide-[#232323]">
          {tenants.list.map((t) => {
            const action = t.status === 'submitted' ? ['Review', () => onReview(t.id), Eye, true]
              : t.stalled ? ['Nudge', () => nudgeTenant(t, nudge), Send, false]
                : ['Open', () => onReview(t.id), ArrowRight, false]
            return (
              <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-[#111111] dark:text-white">{t.name}</span>
                    <StatusPill status={t.status} small />
                    {t.stalled && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#D97706]"><AlertTriangle className="h-3 w-3" /> idle {Math.round(t.idleHours / 24) || 1}d</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[#6B7280] dark:text-[#A1A1AA]">
                    {t.property}{t.status !== 'submitted' && t.status !== 'approved' ? ` · step ${Math.max(0, Math.min(t.step, 6))} of 6` : ''}{t.waitingCo.length ? ` · waiting on ${t.waitingCo.join(' & ')}` : ''}
                  </span>
                </span>
                <button type="button" onClick={action[1]}
                  className={`inline-flex flex-none items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${action[3] ? 'bg-[#F95C4B] text-white hover:bg-[#E84B3A]' : 'border border-[#E5E7EB] text-[#111111] hover:bg-[#F5F5F4] dark:border-[#2A2A2A] dark:text-white dark:hover:bg-[#232323]'}`}>
                  {action[0] === 'Nudge' && nudge.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (() => { const I = action[2]; return <I className="h-3.5 w-3.5" /> })()}
                  {action[0]}
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="flex items-center gap-3 px-5 pb-5">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[#F5F5F4] text-[#9CA3AF] dark:bg-[#232323]"><Inbox className="h-5 w-5" /></span>
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">No tenant applications yet. When someone asks about one of your listed rentals, add them on the lead and send their link — you'll see here when they open it, fill it in and submit.</p>
        </div>
      )}
    </div>
  )
}

/* ─── The page ──────────────────────────────────────────────────────────── */

export default function AgentHome({ overview: o, isDark, stageTo, pickTemperature, dailySeries }) {
  const user = useAuthStore((s) => s.user)
  const [review, setReview] = useState(null)
  const { data, isLoading } = useQuery({
    queryKey: ['agent-home'],
    queryFn: () => axiosClient.get('/reports/agent-home').then((r) => r.data.data),
    refetchInterval: 45_000,
    staleTime: 30_000,
  })
  const firstName = user?.firstName ?? ''

  return (
    <div className="relative space-y-6 p-4 sm:p-6 xl:p-8">
      {/* Where you stand + today's goal */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {data ? <Hero data={data} firstName={firstName} /> : <Skeleton className="h-[230px]" />}
        {data ? <GoalRing goal={data.goal} /> : <Skeleton className="h-[230px]" />}
      </div>

      {/* Next three moves */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-bold tracking-tight text-[#111111] dark:text-white">Your next {data?.moves?.length && data.moves.length < 3 ? data.moves.length : 3} moves</h2>
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Do them in any order</p>
        </div>
        {isLoading || !data ? <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[210px]" />)}</div>
          : <Moves moves={data.moves} tenants={data.tenants.list} onReview={setReview} />}
      </section>

      {/* What's new · landlord promise */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {data ? <WhatsNew news={data.news} /> : <Skeleton className="h-[360px]" />}
        {data ? <Promise promise={data.promise} /> : <Skeleton className="h-[360px]" />}
      </div>

      {/* Tenants · upcoming visits */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {data ? <Tenants tenants={data.tenants} onReview={setReview} /> : <Skeleton className="h-[240px]" />}
        <Card className="p-5">
          <CardTitle title="Upcoming visits" subtitle={`${(o?.kpis?.apptsUpcoming ?? 0).toLocaleString()} booked from today`} action={<LinkButton to="/agency/appointments">All</LinkButton>} />
          {!o ? <Skeleton className="h-[200px]" /> : <UpcomingVisits visits={o.upcomingVisits} leadPath={(id) => `/agency/leads/${id}`} allTo="/agency/appointments" />}
        </Card>
      </div>

      {/* Pipeline */}
      <Card className="p-5">
        <CardTitle title="Your pipeline" subtitle="From your contacts to a closed deal — tap a stage to open it" action={<LinkButton to="/agency/leads">View all leads</LinkButton>} />
        {!o ? <Skeleton className="h-20" /> : <Pipeline stages={o.pipeline} isDark={isDark} stageTo={stageTo} />}
      </Card>

      {/* Map · temperature */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="p-5">
          <CardTitle title="Your leads by province" subtitle="Tap a province · darker = more leads" />
          {!o ? <Skeleton className="h-[360px]" /> : <ProvincePanel provinces={o.provinces} isDark={isDark} provinceTo={(name) => `/agency/leads?province=${encodeURIComponent(name)}`} />}
        </Card>
        <Card className="p-5">
          <CardTitle title="Lead temperature" subtitle="Where every lead stands — tap one to see them" />
          {!o ? <Skeleton className="h-[170px]" /> : <TemperatureDonut temperature={o.temperature} total={o.kpis.totalLeads} isDark={isDark} onPick={pickTemperature} />}
        </Card>
      </div>

      {/* Last 30 days */}
      <Card className="p-5">
        <CardTitle title="Your last 30 days" subtitle="Calls (left axis) against leads generated, received and closed (right axis)" action={<Link to="/agency/call-mode" className="inline-flex items-center gap-1 text-xs font-semibold text-[#F95C4B] hover:underline"><PhoneOutgoing className="h-3.5 w-3.5" /> Call mode</Link>} />
        {!o ? <Skeleton className="h-[250px]" /> : (
          <>
            <TrendChart data={o.charts.daily} xKey="date" series={dailySeries} rightAxis isDark={isDark} xFormat={(d) => format(new Date(d), 'd MMM')} labelFormat={(d) => format(new Date(d), 'EEE d MMM')} />
            <ChartLegend series={dailySeries} isDark={isDark} />
          </>
        )}
      </Card>

      <p className="flex items-center justify-center gap-1.5 pt-2 text-[11px] text-[#9CA3AF]"><Clock className="h-3 w-3" /> Updates by itself every minute</p>

      {review && <TenantReviewDrawer id={review} onClose={() => setReview(null)} />}
    </div>
  )
}
