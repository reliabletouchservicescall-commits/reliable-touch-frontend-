import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  Trophy, Crown, Medal, TrendingUp, Home,
  ClipboardCheck, DollarSign, Star, Users, LineChart,
} from 'lucide-react'
import axiosClient from '../../lib/axios'
import PeriodPicker from '../../components/performance/PeriodPicker'
import LeaderboardChart from '../../components/performance/LeaderboardChart'

const MEDAL = {
  1: { color: '#F59E0B', bg: '#FEF3C7', label: '1st' },
  2: { color: '#9CA3AF', bg: '#F3F4F6', label: '2nd' },
  3: { color: '#B45309', bg: '#FDE68A', label: '3rd' },
}

function initials(name = '') {
  return name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2)
}

function fmt(n) {
  return typeof n === 'number' ? n.toLocaleString() : '—'
}

function fmtCurrency(n) {
  if (typeof n !== 'number') return '—'
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function ScoreBar({ score, max }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-[#F5F5F4] dark:bg-[#2A2A2A] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: '#F95C4B' }}
        />
      </div>
      <span className="text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA] w-7 text-right">{pct}%</span>
    </div>
  )
}

function PodiumCard({ entry, position }) {
  const m = MEDAL[position]
  if (!entry) return <div className="flex-1" />
  return (
    <div
      className={`flex-1 flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${
        position === 1
          ? 'border-[#F59E0B] bg-gradient-to-b from-[#FEF3C7] to-white dark:from-[#3D2E00] dark:to-[#181818] shadow-lg shadow-[#F59E0B]/20'
          : 'border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818]'
      }`}
    >
      {position === 1 && (
        <Crown className="w-6 h-6" style={{ color: m.color }} strokeWidth={2} />
      )}
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white shadow-md"
        style={{ backgroundColor: m.color }}
      >
        {initials(entry.name)}
      </div>
      <div className="text-center">
        <p className="text-sm font-bold text-[#111111] dark:text-white leading-tight">{entry.name}</p>
        {entry.agency && (
          <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">{entry.agency}</p>
        )}
        <span
          className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold"
          style={{ backgroundColor: m.bg, color: m.color }}
        >
          {m.label}
        </span>
      </div>
      <div className="w-full space-y-1 text-center">
        <p className="text-2xl font-black tracking-tight" style={{ color: m.color }}>{fmt(entry.score)}</p>
        <p className="text-[9px] uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">score</p>
      </div>
      <div className="w-full grid grid-cols-3 gap-1 text-center mt-1">
        <div className="rounded-lg bg-[#F5F5F4] dark:bg-[#202020] px-1 py-1.5">
          <p className="text-xs font-bold text-[#111111] dark:text-white">{fmt(entry.totalVisits)}</p>
          <p className="text-[8px] text-[#6B7280] dark:text-[#A1A1AA] leading-tight">Visits</p>
        </div>
        <div className="rounded-lg bg-[#F5F5F4] dark:bg-[#202020] px-1 py-1.5">
          <p className="text-xs font-bold text-[#10B981]">{fmt(entry.listingsSigned)}</p>
          <p className="text-[8px] text-[#6B7280] dark:text-[#A1A1AA] leading-tight">Listings</p>
        </div>
        <div className="rounded-lg bg-[#F5F5F4] dark:bg-[#202020] px-1 py-1.5">
          <p className="text-xs font-bold text-[#F95C4B]">{fmt(entry.dealsClosed)}</p>
          <p className="text-[8px] text-[#6B7280] dark:text-[#A1A1AA] leading-tight">Deals</p>
        </div>
      </div>
    </div>
  )
}

function StatSummaryCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white dark:bg-[#181818] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4 flex items-center gap-3">
      <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
        <Icon className="w-[18px] h-[18px]" style={{ color }} strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-lg font-bold text-[#111111] dark:text-white leading-none">{value}</p>
        <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">{label}</p>
      </div>
    </div>
  )
}

export default function AgentsPerformancePage() {
  const [period, setPeriod] = useState('week')
  const [month, setMonth]   = useState('') // "YYYY-MM" — overrides period when set
  const [year, monthNum] = month ? month.split('-').map(Number) : [undefined, undefined]

  const { data, isLoading } = useQuery({
    queryKey: ['agent-performance', 'leaderboard', period, month],
    queryFn: () => {
      const params = monthNum && year ? { month: monthNum, year } : { period }
      return axiosClient.get('/performance/agents/leaderboard', { params }).then((r) => r.data.data)
    },
    staleTime: 60_000,
  })

  const board = data?.leaderboard ?? []
  const maxScore = board[0]?.score ?? 1

  const totalVisits      = board.reduce((s, r) => s + (r.totalVisits ?? 0), 0)
  const totalListings    = board.reduce((s, r) => s + (r.listingsSigned ?? 0), 0)
  const totalDeals       = board.reduce((s, r) => s + (r.dealsClosed ?? 0), 0)
  const totalCommission  = board.reduce((s, r) => s + (r.commissionEarned ?? 0), 0)

  const top3  = [board[1], board[0], board[2]]  // podium order: 2nd left, 1st center, 3rd right
  const rest  = board.slice(3)

  return (
    <div className="p-5 sm:p-8 max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#111111] dark:text-white tracking-tight">Agent Performance</h1>
            <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">
              Rankings by visits, listings and deals closed
              {data?.from && data?.to && (
                <span className="text-[#9CA3AF]"> · {format(new Date(data.from), 'd MMM')} – {format(new Date(data.to), 'd MMM yyyy')}</span>
              )}
            </p>
          </div>
        </div>

        <PeriodPicker period={period} onPeriod={setPeriod} month={month} onMonth={setMonth} />
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatSummaryCard icon={Users}         label="Active Agents"   value={isLoading ? '…' : fmt(board.length)}        color="#8B5CF6" />
        <StatSummaryCard icon={Home}          label="Total Visits"    value={isLoading ? '…' : fmt(totalVisits)}          color="#3B82F6" />
        <StatSummaryCard icon={ClipboardCheck} label="Listings Signed" value={isLoading ? '…' : fmt(totalListings)}      color="#10B981" />
        <StatSummaryCard icon={DollarSign}    label="Deals Closed"    value={isLoading ? '…' : fmt(totalDeals)}           color="#F95C4B" />
      </div>

      {/* Podium */}
      {isLoading ? (
        <div className="h-64 rounded-2xl bg-[#F5F5F4] dark:bg-[#202020] animate-pulse" />
      ) : board.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A]">
          <Trophy className="w-10 h-10 text-[#6B7280]/20" strokeWidth={1.5} />
          <p className="text-sm font-medium text-[#111111] dark:text-white">No activity yet</p>
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Agent visits will appear here once logged</p>
        </div>
      ) : (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-4">
            Top Performers
          </h2>
          <div className="flex items-end gap-4">
            {top3.map((entry, i) => {
              const pos = i === 0 ? 2 : i === 1 ? 1 : 3
              return <PodiumCard key={pos} entry={entry} position={pos} />
            })}
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

      {/* Full leaderboard table */}
      {!isLoading && board.length > 0 && (
        <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
            <Star className="w-4 h-4 text-[#F95C4B]" strokeWidth={1.75} />
            <span className="text-sm font-bold text-[#111111] dark:text-white">Full Rankings</span>
            <span className="ml-auto text-xs text-[#6B7280] dark:text-[#A1A1AA]">{board.length} agents</span>
          </div>

          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[48px_1fr_120px_100px_100px_110px_90px] gap-4 px-5 py-2.5 bg-[#F5F5F4] dark:bg-[#202020] text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">
            <span>#</span>
            <span>Agent</span>
            <span className="text-center">Visits</span>
            <span className="text-center">Listings</span>
            <span className="text-center">Deals</span>
            <span className="text-right">Commission</span>
            <span className="text-right">Score</span>
          </div>

          <ul className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
            {board.map((r) => {
              const m = MEDAL[r.rank]
              return (
                <li
                  key={r.userId}
                  className="px-5 py-3.5 hover:bg-[#F5F5F4] dark:hover:bg-[#202020] transition-colors"
                >
                  {/* Mobile */}
                  <div className="sm:hidden flex items-center gap-3">
                    <div
                      className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={
                        m
                          ? { backgroundColor: m.bg, color: m.color }
                          : { backgroundColor: '#F5F5F4', color: '#6B7280' }
                      }
                    >
                      {r.rank <= 3 ? <Medal className="w-3.5 h-3.5" /> : r.rank}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#F95C4B]/10 flex items-center justify-center text-[11px] font-bold text-[#F95C4B]">
                      {initials(r.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">{r.name}</p>
                      {r.agency && <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">{r.agency}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: m?.color ?? '#6B7280' }}>{fmt(r.score)}</p>
                      <p className="text-[9px] text-[#6B7280] dark:text-[#A1A1AA]">score</p>
                    </div>
                  </div>

                  {/* Desktop */}
                  <div className="hidden sm:grid grid-cols-[48px_1fr_120px_100px_100px_110px_90px] gap-4 items-center">
                    {/* Rank */}
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={
                        m
                          ? { backgroundColor: m.bg, color: m.color }
                          : { backgroundColor: '#F5F5F4', color: '#6B7280' }
                      }
                    >
                      {r.rank <= 3 ? <Medal className="w-3.5 h-3.5" /> : r.rank}
                    </div>

                    {/* Name */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#F95C4B]/10 flex items-center justify-center text-[11px] font-bold text-[#F95C4B]">
                        {initials(r.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">{r.name}</p>
                        {r.agency && (
                          <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] truncate">{r.agency}</p>
                        )}
                      </div>
                    </div>

                    {/* Visits */}
                    <div className="text-center space-y-1">
                      <span className="text-sm font-bold text-[#3B82F6]">{fmt(r.totalVisits)}</span>
                    </div>

                    {/* Listings */}
                    <div className="text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#10B981]/10 text-[#10B981]">
                        {fmt(r.listingsSigned)}
                      </span>
                    </div>

                    {/* Deals */}
                    <div className="text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#F95C4B]/10 text-[#F95C4B]">
                        {fmt(r.dealsClosed)}
                      </span>
                    </div>

                    {/* Commission */}
                    <div className="text-right">
                      <span className="text-xs font-semibold text-[#111111] dark:text-white">
                        {fmtCurrency(r.commissionEarned)}
                      </span>
                    </div>

                    {/* Score + bar */}
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-right" style={{ color: m?.color ?? '#6B7280' }}>{fmt(r.score)}</p>
                      <ScoreBar score={r.score} max={maxScore} />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Commission total */}
      {!isLoading && board.length > 0 && (
        <div className="bg-gradient-to-r from-[#F95C4B]/5 to-[#F59E0B]/5 rounded-2xl border border-[#F95C4B]/20 p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] uppercase tracking-widest font-semibold">
              Total Commission This Period
            </p>
            <p className="text-2xl font-black text-[#111111] dark:text-white mt-0.5">
              {fmtCurrency(totalCommission)}
            </p>
          </div>
        </div>
      )}

      {/* Scoring legend */}
      <div className="bg-white dark:bg-[#181818] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-[#6B7280] dark:text-[#A1A1AA] mb-3">
          Scoring Formula
        </p>
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Property Visit',   pts: 1,  color: '#3B82F6' },
            { label: 'Listing Signed',   pts: 3,  color: '#10B981' },
            { label: 'Deal Closed',      pts: 5,  color: '#F95C4B' },
          ].map(({ label, pts, color }) => (
            <div key={label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F5F5F4] dark:bg-[#202020]">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{label}</span>
              <span className="text-xs font-bold" style={{ color }}>+{pts} pt{pts > 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
