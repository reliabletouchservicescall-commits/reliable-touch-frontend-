import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  ArrowRight, Check, Plus, Loader2, KeyRound, Clock, PhoneOutgoing, PencilLine, AlarmClock, CalendarPlus, CalendarDays,
} from 'lucide-react'
import axiosClient from '../../lib/axios'
import { tenantsApi } from '../../services/tenantsApi'
import { useAuthStore } from '../../store/authStore'
import { Card, CardTitle, LinkButton, Skeleton, Pipeline, TemperatureDonut, ProvincePanel, TrendChart, ChartLegend } from './DashboardKit'
import { TenantReviewDrawer, linkOf } from '../tenants/TenantApplications'
import { useAgentActions } from '../agent/AgentActions'
import { useAgentHome } from '../agent/useAgentHome'
import { DiaryRow } from '../../pages/agency/DiaryPage'

// An agent's home: where they stand, today's goal, a button for each everyday job (each opens
// right here), the next three things worth doing, today's diary and the landlord promise —
// then the pipeline, map, temperature and last 30 days from the company overview. What's new
// lives on the bell; tenants on Leads › Tenants; visits in the Diary. Colours follow the
// company's brand (CSS brand variables).

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }
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
    [st.listedMonth, 'properties listed', 'text-[#F95C4B]'],
    [st.callsMonth.toLocaleString(), 'calls this month', 'text-[#111111] dark:text-white'],
    st.bestDay ? [`#${st.bestDay.rank}`, `on the daily board on ${format(new Date(st.bestDay.date), 'EEEE')}`, 'text-[#F95C4B]'] : [s ? s.score : '—', 'points this month', 'text-[#F95C4B]'],
  ]
  return (
    <div className={`${box} relative overflow-hidden p-6`}>
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#F95C4B]/10 blur-3xl" />
      <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{format(new Date(), 'EEEE d MMMM')}</p>
      <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-[#111111] dark:text-white">{greeting()}, {firstName}</h1>
      {s && (
        <p className="mt-1 text-[15px] text-[#3F3F46] dark:text-[#D4D4D8]">
          {s.rank === 1
            ? <>You're <b className="text-[#F95C4B]">#1 this month</b> out of {s.of} — keep the lead.</>
            : <>You're <b className="text-[#F95C4B]">#{s.rank} this month</b> — just {s.above.gap} point{s.above.gap === 1 ? '' : 's'} behind {s.above.firstName}. {s.oneDealToTop ? 'One closed deal puts you on top.' : `A closed deal is worth ${s.dealPoints} points.`}</>}
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

/* ─── Everyday jobs ─────────────────────────────────────────────────────── */

function ActionButtons({ data }) {
  const navigate = useNavigate()
  const actions = useAgentActions()
  const a = data.actions ?? {}
  const left = Math.max(0, data.goal.target - data.goal.done)
  const items = [
    { key: 'promise', label: 'Update landlords', icon: PencilLine, hot: a.promise > 0, sub: a.promise ? `${a.promise} waiting over 48 h` : 'Every promise kept', go: () => actions?.open('update') },
    { key: 'call', label: 'Start calling', icon: PhoneOutgoing, sub: left ? `${left} to reach today's goal` : `${(a.toCall ?? 0).toLocaleString()} still to call`, go: () => navigate('/agency/calls') },
    { key: 'callbacks', label: 'Callbacks', icon: AlarmClock, hot: a.callbacksDue > 0 && !(a.promise > 0), sub: a.callbacksDue ? `${a.callbacksDue} due today` : 'None due', go: () => navigate('/agency/calls?tab=callbacks') },
    { key: 'lead', label: 'Add a lead', icon: Plus, sub: 'From a call or a walk-in', go: () => actions?.open('lead') },
    { key: 'viewing', label: 'Book a viewing', icon: CalendarPlus, sub: a.viewingsToday ? `${a.viewingsToday} today` : 'Pick a lead and a time', go: () => actions?.open('viewing') },
    { key: 'tenant', label: 'Send tenant link', icon: KeyRound, sub: a.listedNoTenant ? `${a.listedNoTenant} listed, no tenant yet` : 'For a listed rental', go: () => actions?.open('tenant') },
  ]
  return <ActionTiles items={items} />
}

// A row of big buttons, one per everyday job: an icon, a plain name and one line saying why
// now. `hot` ones are filled in the brand colour. Shared with the company manager's home.
export function ActionTiles({ items }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
      {items.map((it, i) => (
        <button key={it.key} type="button" onClick={it.go} data-tour={`home-${it.key}`}
          className={`mac-in group flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${it.hot ? 'border-[#F95C4B]/40 bg-[#F95C4B]/[0.07]' : 'border-[#E5E7EB] bg-white hover:border-[#F95C4B]/40 dark:border-[#2A2A2A] dark:bg-[#181818]'}`}
          style={{ '--d': `${i * 50}ms` }}>
          <span className={`grid h-9 w-9 place-items-center rounded-xl transition-colors ${it.hot ? 'bg-[#F95C4B] text-white' : 'bg-[#F95C4B]/10 text-[#F95C4B] group-hover:bg-[#F95C4B] group-hover:text-white'}`}><it.icon className="h-[18px] w-[18px]" /></span>
          <span className="text-sm font-bold text-[#111111] dark:text-white">{it.label}</span>
          <span className={`text-xs ${it.hot ? 'font-semibold text-[#F95C4B]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>{it.sub}</span>
        </button>
      ))}
    </div>
  )
}

/* ─── Today ─────────────────────────────────────────────────────────────── */

// Viewings, callbacks, follow-ups and landlord updates due today (overdue pulled in) — the
// landlord promise lives here too, so each landlord shows once
function Today({ items, promise }) {
  const navigate = useNavigate()
  const overdue = items.filter((i) => i.overdue).length
  const allKept = promise.total > 0 && promise.kept === promise.total
  return (
    <div className={`${box} p-5`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-[15px] font-bold text-[#111111] dark:text-white"><CalendarDays className="h-4 w-4 text-[#F95C4B]" /> Today</p>
        <span className="flex items-center gap-3">
          {promise.total > 0 && <span title={`Landlords from Reliable Touch are promised news every ${promise.hours} hours`} className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${allKept ? 'bg-[#10B981]/10 text-[#10B981]' : 'bg-[#F95C4B]/10 text-[#F95C4B]'}`}>Landlord promise {promise.kept} of {promise.total} kept</span>}
          {overdue > 0 && <span className="rounded-full bg-[#F95C4B]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#F95C4B]">{overdue} overdue</span>}
          <Link to="/agency/diary" className="text-xs font-semibold text-[#6B7280] hover:text-[#F95C4B] dark:text-[#A1A1AA]">Diary</Link>
        </span>
      </div>
      {items.length ? (
        <ul className="grid grid-cols-1 gap-2 xl:grid-cols-2">{items.slice(0, 8).map((i) => <DiaryRow key={i.id} item={i} compact />)}</ul>
      ) : (
        <div className="flex items-center gap-3 rounded-xl bg-[#FAFAF9] p-4 dark:bg-[#141414]">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[#10B981]/12 text-[#10B981]"><Check className="h-5 w-5" strokeWidth={3} /></span>
          <p className="flex-1 text-sm text-[#3F3F46] dark:text-[#D4D4D8]">Nothing due today. A good time to make calls.</p>
          <button type="button" onClick={() => navigate('/agency/calls')} className="rounded-lg bg-[#F95C4B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#E84B3A]">Start calling</button>
        </div>
      )}
      {items.length > 8 && <Link to="/agency/diary" className="mt-3 block text-center text-xs font-semibold text-[#F95C4B] hover:underline">{items.length - 8} more in your diary</Link>}
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
  const actions = useAgentActions()
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
        const lead = i === 0
        const go = () => {
          if (m.nudge) { const t = tenants.find((x) => x.id === m.applicationId); if (t) nudgeTenant(t, nudge); return }
          if (m.applicationId) return onReview(m.applicationId)
          if (m.key === 'promise' && actions) return actions.open('update', { leadId: m.to.split('/').pop() })
          navigate(m.to.replace('/agency/call-mode', '/agency/calls'))
        }
        return (
          <div key={m.key} className={`mac-in flex flex-col rounded-2xl border p-5 ${lead ? 'border-[#F95C4B]/30 bg-[#F95C4B]/[0.06]' : 'border-[#E5E7EB] bg-white dark:border-[#2A2A2A] dark:bg-[#181818]'}`} style={{ '--d': `${i * 70}ms` }}>
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: 'rgb(var(--brand-rgb))' }}>{i + 1}</span>
              <span className={`text-[11px] font-bold uppercase tracking-wider text-[#F95C4B]`}>{m.label}</span>
              <span className="ml-auto text-[11px] text-[#9CA3AF]">{m.eta}</span>
            </div>
            <p className="mt-3 text-[15px] font-bold leading-snug text-[#111111] dark:text-white">{m.title}</p>
            <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-[#6B7280] dark:text-[#A1A1AA]">{m.detail}</p>
            <button type="button" onClick={go} disabled={m.nudge && nudge.isPending}
              className={`mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${lead
                ? 'bg-[#F95C4B] text-white shadow-btn hover:bg-[#E84B3A]'
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

/* ─── The page ──────────────────────────────────────────────────────────── */

export default function AgentHome({ overview: o, isDark, stageTo, pickTemperature, dailySeries }) {
  const user = useAuthStore((s) => s.user)
  const [review, setReview] = useState(null)
  const { data, isLoading } = useAgentHome()
  const firstName = user?.firstName ?? ''

  return (
    <div className="relative space-y-6 p-4 sm:p-6 xl:p-8">
      {/* Where you stand + today's goal */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {data ? <Hero data={data} firstName={firstName} /> : <Skeleton className="h-[230px]" />}
        {data ? <GoalRing goal={data.goal} /> : <Skeleton className="h-[230px]" />}
      </div>

      {/* Everyday jobs — each opens right here */}
      {data ? <ActionButtons data={data} /> : <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[118px]" />)}</div>}

      {/* Next three moves */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-bold tracking-tight text-[#111111] dark:text-white">Your next {data?.moves?.length && data.moves.length < 3 ? data.moves.length : 3} moves</h2>
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Do them in any order</p>
        </div>
        {isLoading || !data ? <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[210px]" />)}</div>
          : <Moves moves={data.moves} tenants={data.tenants.list} onReview={setReview} />}
      </section>

      {/* Today, with the landlord promise */}
      {data ? <Today items={data.today ?? []} promise={data.promise} /> : <Skeleton className="h-[300px]" />}

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
        <CardTitle title="Your last 30 days" subtitle="Calls (left axis) against leads generated, received and closed (right axis)" action={<Link to="/agency/calls" className="inline-flex items-center gap-1 text-xs font-semibold text-[#F95C4B] hover:underline"><PhoneOutgoing className="h-3.5 w-3.5" /> Call mode</Link>} />
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
