import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  Trophy, Phone, TrendingUp, CheckCircle2,
  Star, BarChart2, Users, LineChart,
  ThermometerSnowflake, ThermometerSun, Flame,
} from 'lucide-react'
import axiosClient from '../../lib/axios'
import PeriodPicker from '../../components/performance/PeriodPicker'
import LeaderboardChart from '../../components/performance/LeaderboardChart'

/* ─── API ─────────────────────────────────────────────────────────── */

async function fetchLeaderboard({ period, month, year }) {
  const params = month && year ? { month, year } : { period }
  const { data } = await axiosClient.get('/performance/leaderboard', { params })
  return { leaderboard: data.data.leaderboard ?? [], from: data.data.from, to: data.data.to }
}

/* ─── Medal colors ────────────────────────────────────────────────── */

const MEDAL = {
  1: { color: '#F59E0B', bg: '#F59E0B18', label: '1st', ring: 'ring-[#F59E0B]' },
  2: { color: '#9CA3AF', bg: '#9CA3AF18', label: '2nd', ring: 'ring-[#9CA3AF]' },
  3: { color: '#B45309', bg: '#B4530918', label: '3rd', ring: 'ring-[#B45309]' },
}

/* ─── Score bar ───────────────────────────────────────────────────── */

function ScoreBar({ score, maxScore }) {
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#F3F4F6] dark:bg-[#2A2A2A] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #F95C4B, #FF8C7A)',
          }}
        />
      </div>
      <span className="text-[10px] font-semibold text-[#9CA3AF] w-7 text-right">{pct}%</span>
    </div>
  )
}

/* ─── Initials avatar ─────────────────────────────────────────────── */

function Avatar({ name, rank, size = 'md' }) {
  const parts  = name.split(' ')
  const ini    = `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
  const medal  = MEDAL[rank]
  const sz     = size === 'lg' ? 'w-14 h-14 text-base' : 'w-9 h-9 text-xs'
  return (
    <div
      className={`flex-shrink-0 ${sz} rounded-full flex items-center justify-center font-bold ring-2 ${medal?.ring ?? 'ring-transparent'}`}
      style={{ backgroundColor: medal?.bg ?? '#F95C4B18', color: medal?.color ?? '#F95C4B' }}
    >
      {ini || '?'}
    </div>
  )
}

/* ─── Podium card (top 3) ─────────────────────────────────────────── */

function PodiumCard({ entry, maxScore }) {
  if (!entry) return <div className="flex-1" />
  const medal = MEDAL[entry.rank]
  const heights = { 1: 'pt-0', 2: 'pt-6', 3: 'pt-10' }

  return (
    <div className={`flex-1 flex flex-col items-center gap-3 ${heights[entry.rank] ?? 'pt-10'}`}>
      {/* Crown for #1 */}
      {entry.rank === 1 && (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#F59E0B]/15 mb-0">
          <Trophy className="w-4 h-4 text-[#F59E0B]" />
        </div>
      )}

      {/* Avatar */}
      <Avatar name={entry.name} rank={entry.rank} size={entry.rank === 1 ? 'lg' : 'md'} />

      {/* Name */}
      <div className="text-center">
        <p className="text-sm font-bold text-[#111111] dark:text-white leading-tight">
          {entry.name}
        </p>
        <p className="text-xs font-semibold mt-0.5" style={{ color: medal.color }}>
          {medal.label}
        </p>
      </div>

      {/* Podium block */}
      <div
        className="w-full rounded-t-xl flex flex-col items-center justify-start pt-3 gap-1"
        style={{
          minHeight: entry.rank === 1 ? 100 : entry.rank === 2 ? 76 : 56,
          backgroundColor: medal.bg,
          borderTop: `2px solid ${medal.color}`,
        }}
      >
        <span className="text-lg font-black" style={{ color: medal.color }}>
          {entry.score}
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: medal.color }}>
          pts
        </span>

        <div className="flex flex-col items-center gap-0.5 mt-1">
          <span className="text-[9px] text-[#6B7280] dark:text-[#A1A1AA]">
            {entry.totalCalls} calls
          </span>
          <span className="text-[9px] text-[#6B7280] dark:text-[#A1A1AA]">
            {entry.leadsCreated} leads
          </span>
          <span className="text-[9px] text-[#6B7280] dark:text-[#A1A1AA]">
            {entry.leadsClosed} closed
          </span>
          <span className="text-[9px] font-semibold flex items-center gap-1" style={{ color: '#EF4444' }}>
            <Flame className="w-2.5 h-2.5" /> {entry.hotCount} hot
          </span>
        </div>
      </div>
    </div>
  )
}

/* ─── Stat pill ───────────────────────────────────────────────────── */

function StatPill({ icon: Icon, value, color }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold"
      style={{ color, backgroundColor: `${color}15` }}
    >
      <Icon className="w-3 h-3" />
      {value}
    </span>
  )
}

/* ─── Main ────────────────────────────────────────────────────────── */

export default function PerformancePage() {
  const [period, setPeriod] = useState('week')
  const [month, setMonth]   = useState('') // "YYYY-MM" — overrides period when set

  const [year, monthNum] = month ? month.split('-').map(Number) : [undefined, undefined]

  const { data, isLoading } = useQuery({
    queryKey: ['performance', 'leaderboard', period, month],
    queryFn: () => fetchLeaderboard({ period, month: monthNum, year }),
    staleTime: 30_000,
  })

  const board = data?.leaderboard ?? []
  const maxScore = board[0]?.score ?? 0

  // Totals for the period
  const totalCalls   = board.reduce((s, r) => s + r.totalCalls,   0)
  const totalLeads   = board.reduce((s, r) => s + r.leadsCreated, 0)
  const totalClosed  = board.reduce((s, r) => s + r.leadsClosed,  0)

  // Podium order: 2nd left, 1st centre, 3rd right
  const [first, second, third] = [board[0], board[1], board[2]]

  return (
    <div className="p-5 sm:p-8 max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
            </div>
            <h1 className="text-2xl font-bold text-[#111111] dark:text-white tracking-tight">
              Performance
            </h1>
          </div>
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">
            Cold caller rankings by calls, leads closed, and lead temperature
            {data?.from && data?.to && (
              <span className="text-[#9CA3AF]"> · {format(new Date(data.from), 'd MMM')} – {format(new Date(data.to), 'd MMM yyyy')}</span>
            )}
          </p>
        </div>

        <PeriodPicker period={period} onPeriod={setPeriod} month={month} onMonth={setMonth} />
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Users,        label: 'Active Callers',  value: board.length,  color: '#F95C4B' },
          { icon: Phone,        label: 'Total Calls',     value: totalCalls,    color: '#3B82F6' },
          { icon: TrendingUp,   label: 'Leads Created',   value: totalLeads,    color: '#10B981' },
          { icon: CheckCircle2, label: 'Leads Closed',    value: totalClosed,   color: '#8B5CF6' },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4 flex flex-col gap-2"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${s.color}15` }}>
              <s.icon className="w-4 h-4" style={{ color: s.color }} strokeWidth={1.75} />
            </div>
            {isLoading
              ? <div className="h-6 w-12 rounded-lg bg-[#F5F5F4] dark:bg-[#202020] animate-pulse" />
              : <p className="text-xl font-black text-[#111111] dark:text-white">{s.value}</p>
            }
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Podium */}
      {!isLoading && board.length >= 1 && (
        <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-6">
          <div className="flex items-center gap-2 mb-6">
            <Star className="w-4 h-4 text-[#F59E0B]" />
            <span className="text-sm font-bold text-[#111111] dark:text-white">Top Performers</span>
          </div>
          <div className="flex items-end gap-3 justify-center">
            <PodiumCard entry={second} maxScore={maxScore} />
            <PodiumCard entry={first}  maxScore={maxScore} />
            <PodiumCard entry={third}  maxScore={maxScore} />
          </div>
        </div>
      )}

      {/* Score chart */}
      {!isLoading && board.length > 0 && (
        <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-6">
          <div className="flex items-center gap-2 mb-4">
            <LineChart className="w-4 h-4 text-[#F95C4B]" />
            <span className="text-sm font-bold text-[#111111] dark:text-white">Top Performers by Score</span>
          </div>
          <LeaderboardChart board={board} dataKey="score" name="Score" color="#F95C4B" />
        </div>
      )}

      {/* Full table */}
      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[#F95C4B]" strokeWidth={1.75} />
            <span className="text-sm font-bold text-[#111111] dark:text-white">Full Leaderboard</span>
          </div>
          <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
            Score = calls×1 + closed×5 + (cold×1 + warm×2 + hot×10 + converted×10)
          </span>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] animate-pulse" />
            ))}
          </div>
        ) : board.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Trophy className="w-10 h-10 text-[#6B7280]/20" strokeWidth={1.5} />
            <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">
              No activity recorded for this period
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[2.5rem_1fr_5rem_5rem_5rem_5rem_6rem_8rem] items-center gap-3 px-5 py-2.5 bg-[#FAFAF9] dark:bg-[#0F0F0F]">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280]">#</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280]">Name</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] text-center">Calls</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] text-center">Leads</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] text-center">Closed</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] text-center">Hot</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] text-right">Score</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280]">Progress</span>
            </div>

            {board.map((entry) => {
              const medal = MEDAL[entry.rank]
              return (
                <div
                  key={entry.userId}
                  className={`flex sm:grid sm:grid-cols-[2.5rem_1fr_5rem_5rem_5rem_5rem_6rem_8rem] items-center gap-3 px-5 py-3.5 hover:bg-[#FAFAF9] dark:hover:bg-[#111111] transition-colors ${
                    entry.rank <= 3 ? 'bg-gradient-to-r from-white dark:from-[#181818]' : ''
                  }`}
                  style={entry.rank <= 3 ? { backgroundImage: `linear-gradient(90deg, ${medal.bg} 0%, transparent 20%)` } : {}}
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                    {entry.rank <= 3 ? (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: medal.bg }}>
                        <span className="text-[10px] font-black" style={{ color: medal.color }}>
                          {entry.rank}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm font-bold text-[#9CA3AF]">{entry.rank}</span>
                    )}
                  </div>

                  {/* Name + avatar */}
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <Avatar name={entry.name} rank={entry.rank} />
                    <span className="text-sm font-semibold text-[#111111] dark:text-white truncate">
                      {entry.name}
                    </span>
                  </div>

                  {/* Calls */}
                  <div className="hidden sm:flex justify-center">
                    <StatPill icon={Phone} value={entry.totalCalls} color="#3B82F6" />
                  </div>

                  {/* Leads */}
                  <div className="hidden sm:flex justify-center">
                    <StatPill icon={TrendingUp} value={entry.leadsCreated} color="#10B981" />
                  </div>

                  {/* Closed */}
                  <div className="hidden sm:flex justify-center">
                    <StatPill icon={CheckCircle2} value={entry.leadsClosed} color="#8B5CF6" />
                  </div>

                  {/* Hot */}
                  <div className="hidden sm:flex justify-center">
                    <StatPill icon={Flame} value={entry.hotCount} color="#EF4444" />
                  </div>

                  {/* Score */}
                  <div className="sm:text-right ml-auto sm:ml-0">
                    <span className="text-base font-black text-[#111111] dark:text-white">
                      {entry.score}
                    </span>
                    <span className="text-xs text-[#9CA3AF] ml-0.5">pts</span>
                  </div>

                  {/* Progress bar */}
                  <div className="hidden sm:block">
                    <ScoreBar score={entry.score} maxScore={maxScore} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Scoring legend */}
      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5">
        <p className="text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-widest mb-3">
          Scoring Formula
        </p>
        <div className="flex flex-wrap gap-3">
          {[
            { icon: Phone,                label: 'Call logged',        pts: '+1 pt',  color: '#3B82F6' },
            { icon: CheckCircle2,         label: 'Lead closed',        pts: '+5 pts', color: '#8B5CF6' },
            { icon: ThermometerSnowflake, label: 'Cold lead',          pts: '+1 pt',  color: '#6B7280' },
            { icon: ThermometerSun,       label: 'Warm lead',          pts: '+2 pts', color: '#F59E0B' },
            { icon: Flame,                label: 'Hot lead',           pts: '+10 pts', color: '#EF4444' },
            { icon: TrendingUp,           label: 'Converted lead',     pts: '+10 pts', color: '#10B981' },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A]"
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${s.color}15` }}>
                <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} strokeWidth={1.75} />
              </div>
              <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{s.label}</span>
              <span className="text-xs font-bold" style={{ color: s.color }}>{s.pts}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-[#9CA3AF] mt-3">
          5 warm leads or 10 cold leads are worth the same as 1 hot lead.
        </p>
      </div>
    </div>
  )
}
