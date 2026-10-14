import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart2, Trophy, Phone, Layers, ThermometerSnowflake, ThermometerSun, Flame,
  Handshake, Building2, Key, Banknote, Ban, CalendarCheck, CalendarClock, CalendarX, CalendarDays,
} from 'lucide-react'
import axiosClient from '../../lib/axios'

const MEDAL = {
  1: { color: '#F59E0B', bg: '#F59E0B18' },
  2: { color: '#9CA3AF', bg: '#9CA3AF18' },
  3: { color: '#B45309', bg: '#B4530918' },
}

const LEAD_VIEWS = [
  { key: 'all',      label: 'All leads',   hint: 'Assigned to the agent or created by them' },
  { key: 'assigned', label: 'Assigned',    hint: 'Leads assigned to the agent in this period' },
  { key: 'own',      label: 'Own leads',   hint: 'Leads the agent created themselves in this period' },
]

const STATUS_COLS = [
  { key: 'cold',              label: 'Cold',   icon: ThermometerSnowflake, color: '#6B7280' },
  { key: 'warm',              label: 'Warm',   icon: ThermometerSun,       color: '#F59E0B' },
  { key: 'hot',               label: 'Hot',    icon: Flame,                color: '#EF4444' },
  { key: 'still_negotiating', label: 'Negot.', icon: Handshake,            color: '#3B82F6' },
  { key: 'listed',            label: 'Listed', icon: Building2,            color: '#8B5CF6' },
  { key: 'rented_out',        label: 'Rented', icon: Key,                  color: '#16A34A' },
  { key: 'sold',              label: 'Sold',   icon: Banknote,             color: '#F95C4B' },
  { key: 'lost',              label: 'Lost',   icon: Ban,                  color: '#9CA3AF' },
]

const APPT_COLS = [
  { key: 'total',     label: 'Appts',    icon: CalendarDays,  color: '#111111', darkColor: '#FFFFFF' },
  { key: 'completed', label: 'Attended', icon: CalendarCheck, color: '#16A34A' },
  { key: 'upcoming',  label: 'Upcoming', icon: CalendarClock, color: '#F59E0B' },
  { key: 'missed',    label: 'Missed',   icon: CalendarX,     color: '#DC2626' },
]

// Shared by the group header, column header, rows and totals so they can never drift:
// # | agent | calls | leads | 8 statuses | 4 appointment cols | score | progress
const GRID = [
  '2.5rem', 'minmax(11rem,1.4fr)', '4.5rem', '6.5rem',
  ...STATUS_COLS.map(() => '4.25rem'),
  ...APPT_COLS.map(() => '4.75rem'),
  '5rem', 'minmax(7rem,1fr)',
].join(' ')
const MIN_WIDTH = 1640
const LEADS_COL = 4                                   // 1-based grid column of "Leads"
const STATUS_START = LEADS_COL + 1
const APPT_START = STATUS_START + STATUS_COLS.length

function initials(name = '') {
  return name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2)
}

function Pill({ icon: Icon, value, color }) {
  if (!value) return <span className="text-xs text-[#D4D4D8] dark:text-[#3F3F46]">0</span>
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold"
      style={{ color, backgroundColor: `${color}15` }}
    >
      <Icon className="w-3 h-3" />
      {value.toLocaleString()}
    </span>
  )
}

// Thin stacked bar showing the status mix of a lead bucket at a glance.
function StatusMix({ bucket }) {
  if (!bucket.total) return <div className="h-1.5 rounded-full bg-[#F5F5F4] dark:bg-[#2A2A2A]" />
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden bg-[#F5F5F4] dark:bg-[#2A2A2A]">
      {STATUS_COLS.map((s) => bucket[s.key] > 0 && (
        <div key={s.key} style={{ width: `${(bucket[s.key] / bucket.total) * 100}%`, backgroundColor: s.color }} />
      ))}
    </div>
  )
}

function HeaderCell({ children, align = 'center' }) {
  const a = align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center'
  return <span className={`text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] ${a}`}>{children}</span>
}

function sumRows(rows, view) {
  const leads = { total: 0, ...Object.fromEntries(STATUS_COLS.map((s) => [s.key, 0])) }
  const appts = { total: 0, completed: 0, upcoming: 0, missed: 0 }
  let calls = 0
  let assigned = 0
  let own = 0
  rows.forEach((r) => {
    calls += r.totalCalls ?? 0
    assigned += r.assigned.total
    own += r.own.total
    Object.keys(leads).forEach((k) => { leads[k] += r[view][k] ?? 0 })
    Object.keys(appts).forEach((k) => { appts[k] += r.appointments[k] ?? 0 })
  })
  return { calls, leads, appts, assigned, own }
}

/**
 * Company leaderboard table for the agency Leaderboard screen — the agency counterpart
 * of the admin Performance table. One row per agent: calls, leads by current status
 * (switchable between assigned / own / all), appointments, and score.
 */
export default function AgencyLeadsTable({ period, canOpenRow }) {
  const navigate = useNavigate()
  const [view, setView] = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['agency-leaderboard-table', period],
    queryFn: () => axiosClient.get('/performance/agency/table', { params: { period } }).then((r) => r.data.data.rows),
    staleTime: 60_000,
  })

  const rows = data ?? []
  const maxScore = rows[0]?.score || 1
  const totals = sumRows(rows, view)
  const viewMeta = LEAD_VIEWS.find((v) => v.key === view)
  const gridStyle = { gridTemplateColumns: GRID, minWidth: MIN_WIDTH }

  return (
    <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
      {/* Title bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#F95C4B]/10 flex items-center justify-center">
            <BarChart2 className="w-4 h-4 text-[#F95C4B]" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-bold text-[#111111] dark:text-white">Company Leaderboard</p>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{viewMeta.hint} · current status of each lead</p>
          </div>
        </div>
        <div className="flex items-center bg-[#F5F5F4] dark:bg-[#202020] rounded-lg p-1 gap-1">
          {LEAD_VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                view === v.key
                  ? 'bg-white dark:bg-[#111111] text-[#F95C4B] shadow-sm'
                  : 'text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="p-5 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-12 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Trophy className="w-10 h-10 text-[#6B7280]/20" strokeWidth={1.5} />
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">No agents in your company yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
            {/* Group header */}
            <div className="grid items-end gap-3 px-5 pt-3 pb-1 bg-[#FAFAF9] dark:bg-[#0F0F0F]" style={gridStyle}>
              <span
                className="text-[10px] font-bold uppercase tracking-widest text-[#F95C4B] border-b-2 border-[#F95C4B]/30 pb-1 text-center"
                style={{ gridColumn: `${LEADS_COL} / ${APPT_START}` }}
              >
                Leads by status — {viewMeta.label.toLowerCase()}
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-widest text-[#F59E0B] border-b-2 border-[#F59E0B]/30 pb-1 text-center"
                style={{ gridColumn: `${APPT_START} / ${APPT_START + APPT_COLS.length}` }}
              >
                Appointments
              </span>
            </div>

            {/* Column header */}
            <div className="grid items-center gap-3 px-5 py-2.5 bg-[#FAFAF9] dark:bg-[#0F0F0F]" style={gridStyle}>
              <HeaderCell align="left">#</HeaderCell>
              <HeaderCell align="left">Agent</HeaderCell>
              <HeaderCell>Calls</HeaderCell>
              <HeaderCell>Leads</HeaderCell>
              {STATUS_COLS.map((s) => <HeaderCell key={s.key}>{s.label}</HeaderCell>)}
              {APPT_COLS.map((a) => <HeaderCell key={a.key}>{a.label}</HeaderCell>)}
              <HeaderCell align="right">Score</HeaderCell>
              <HeaderCell align="left">Progress</HeaderCell>
            </div>

            {rows.map((r) => {
              const medal = MEDAL[r.rank]
              const bucket = r[view]
              const clickable = canOpenRow(r)
              const pct = Math.round((r.score / maxScore) * 100)
              return (
                <div
                  key={r.userId}
                  onClick={clickable ? () => navigate(`/agency/agents/${r.userId}`) : undefined}
                  className={`grid items-center gap-3 px-5 py-3 transition-colors ${clickable ? 'cursor-pointer' : ''} ${
                    r.isSelf
                      ? 'bg-[#F95C4B]/5 shadow-[inset_3px_0_0_#F95C4B]'
                      : 'hover:bg-[#FAFAF9] dark:hover:bg-[#111111]'
                  }`}
                  style={{
                    ...gridStyle,
                    ...(!r.isSelf && medal ? { backgroundImage: `linear-gradient(90deg, ${medal.bg} 0%, transparent 18%)` } : {}),
                  }}
                >
                  {/* Rank */}
                  <div className="w-7 h-7 rounded-full flex items-center justify-center" style={medal ? { backgroundColor: medal.bg } : undefined}>
                    <span className="text-[11px] font-black" style={{ color: medal?.color ?? '#9CA3AF' }}>{r.rank}</span>
                  </div>

                  {/* Agent */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold"
                      style={r.isSelf ? { backgroundColor: '#F95C4B', color: 'white' } : { backgroundColor: medal?.bg ?? '#F5F5F4', color: medal?.color ?? '#6B7280' }}
                    >
                      {initials(r.name)}
                    </div>
                    <span className={`text-sm font-semibold truncate ${r.isSelf ? 'text-[#F95C4B]' : 'text-[#111111] dark:text-white'}`}>
                      {r.name}
                      {r.isSelf && <span className="ml-1.5 text-[10px] font-bold">(You)</span>}
                    </span>
                  </div>

                  {/* Calls */}
                  <div className="flex justify-center"><Pill icon={Phone} value={r.totalCalls} color="#6B7280" /></div>

                  {/* Leads total + status mix */}
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-center gap-1">
                      <Layers className="w-3 h-3 text-[#9CA3AF] self-center" />
                      <span className="text-sm font-black text-[#111111] dark:text-white">{bucket.total}</span>
                    </div>
                    <StatusMix bucket={bucket} />
                    {view === 'all' && (
                      <p className="text-[9px] text-center text-[#9CA3AF] whitespace-nowrap">{r.assigned.total} asg · {r.own.total} own</p>
                    )}
                  </div>

                  {STATUS_COLS.map((s) => (
                    <div key={s.key} className="flex justify-center"><Pill icon={s.icon} value={bucket[s.key]} color={s.color} /></div>
                  ))}

                  {APPT_COLS.map((a) => (
                    <div key={a.key} className="flex justify-center">
                      {a.key === 'total'
                        ? <span className={`text-sm font-bold ${r.appointments.total ? 'text-[#111111] dark:text-white' : 'text-[#D4D4D8] dark:text-[#3F3F46]'}`}>{r.appointments.total}</span>
                        : <Pill icon={a.icon} value={r.appointments[a.key]} color={a.color} />}
                    </div>
                  ))}

                  {/* Score */}
                  <div className="text-right">
                    <span className={`text-base font-black ${r.isSelf ? 'text-[#F95C4B]' : 'text-[#111111] dark:text-white'}`}>
                      {r.score.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-[#9CA3AF] ml-0.5">pts</span>
                  </div>

                  {/* Progress */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-[#F3F4F6] dark:bg-[#2A2A2A] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #F95C4B, #FF8C7A)' }} />
                    </div>
                    <span className="text-[10px] font-semibold text-[#9CA3AF] w-8 text-right">{pct}%</span>
                  </div>
                </div>
              )
            })}

            {/* Company totals */}
            <div className="grid items-center gap-3 px-5 py-3 bg-[#111111] text-white" style={gridStyle}>
              <span />
              <span className="text-xs font-bold uppercase tracking-widest text-[#F95C4B]">Company total</span>
              <span className="text-center text-sm font-bold">{totals.calls.toLocaleString()}</span>
              <div className="text-center">
                <span className="text-sm font-black">{totals.leads.total}</span>
                {view === 'all' && <p className="text-[9px] text-white/50 whitespace-nowrap">{totals.assigned} asg · {totals.own} own</p>}
              </div>
              {STATUS_COLS.map((s) => (
                <span key={s.key} className="text-center text-sm font-bold" style={{ color: totals.leads[s.key] ? s.color : 'rgba(255,255,255,0.25)' }}>
                  {totals.leads[s.key]}
                </span>
              ))}
              {APPT_COLS.map((a) => (
                <span key={a.key} className="text-center text-sm font-bold" style={{ color: totals.appts[a.key] ? (a.darkColor ?? a.color) : 'rgba(255,255,255,0.25)' }}>
                  {totals.appts[a.key]}
                </span>
              ))}
              <span />
              <span />
            </div>
          </div>
        </div>
      )}

      {/* Status legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
        {STATUS_COLS.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.key === 'still_negotiating' ? 'Still negotiating' : s.label}
          </span>
        ))}
        <span className="text-[10px] text-[#9CA3AF] sm:ml-auto">
          Appointments counted by scheduled date · Missed = cancelled or no-show
        </span>
      </div>
    </div>
  )
}
