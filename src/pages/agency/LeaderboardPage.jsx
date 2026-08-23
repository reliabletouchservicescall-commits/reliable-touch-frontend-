import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Trophy, Crown, Medal, Home, ClipboardCheck,
  DollarSign, Star, TrendingUp,
} from 'lucide-react'
import axiosClient from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'

const PERIODS = [
  { key: 'day',   label: 'Today' },
  { key: 'week',  label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year',  label: 'This Year' },
]

const RANK_COLORS = {
  1: '#F59E0B',
  2: '#9CA3AF',
  3: '#B45309',
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
      <span className="text-[10px] font-semibold text-[#6B7280] w-7 text-right shrink-0">{pct}%</span>
    </div>
  )
}

function MyStatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white dark:bg-[#181818] rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4 flex flex-col gap-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
        <Icon className="w-4 h-4" style={{ color }} strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-xl font-black text-[#111111] dark:text-white">{value}</p>
        <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">{label}</p>
      </div>
    </div>
  )
}

export default function AgencyLeaderboardPage() {
  const { user } = useAuthStore()
  const [period, setPeriod] = useState('week')

  const { data: boardData, isLoading } = useQuery({
    queryKey: ['agent-leaderboard-me', period],
    queryFn: () =>
      axiosClient.get(`/performance/agents/leaderboard-me?period=${period}`).then((r) => r.data.data.leaderboard),
    staleTime: 60_000,
  })

  const board = boardData ?? []
  const maxScore = board[0]?.score ?? 1
  const me = board.find((r) => r.isSelf)
  const myRank = me?.rank ?? null
  const total = board.length

  const rankColor = myRank
    ? RANK_COLORS[myRank] ?? '#F95C4B'
    : '#6B7280'

  return (
    <div className="p-5 sm:p-8 max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#111111] dark:text-white tracking-tight">Leaderboard</h1>
            <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">See how you rank against other agents</p>
          </div>
        </div>

        {/* Period tabs */}
        <div className="flex items-center bg-[#F5F5F4] dark:bg-[#202020] rounded-xl p-1 gap-1">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === key
                  ? 'bg-white dark:bg-[#2A2A2A] text-[#F95C4B] shadow-sm'
                  : 'text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* My rank banner */}
      {!isLoading && myRank && (
        <div
          className="rounded-2xl p-5 border-2 flex items-center gap-4"
          style={{ borderColor: `${rankColor}40`, backgroundColor: `${rankColor}08` }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white shadow-lg flex-shrink-0"
            style={{ backgroundColor: rankColor }}
          >
            {myRank === 1
              ? <Crown className="w-7 h-7 text-white" strokeWidth={2} />
              : initials(`${user?.firstName} ${user?.lastName}`)}
          </div>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: rankColor }}>
              Your Position
            </p>
            <p className="text-3xl font-black text-[#111111] dark:text-white mt-0.5">
              #{myRank}
              <span className="text-base font-medium text-[#6B7280] dark:text-[#A1A1AA] ml-2">
                of {total} agents
              </span>
            </p>
            {total > 0 && (
              <p className="text-sm font-semibold mt-1" style={{ color: rankColor }}>
                Top {Math.round((myRank / total) * 100)}%
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-3xl font-black" style={{ color: rankColor }}>{fmt(me?.score)}</p>
            <p className="text-[10px] uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">score</p>
          </div>
        </div>
      )}

      {/* My stats */}
      {!isLoading && me && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-3">
            My Stats This Period
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MyStatCard icon={Home}          label="Property Visits"  value={fmt(me.totalVisits)}      color="#3B82F6" />
            <MyStatCard icon={ClipboardCheck} label="Listings Signed" value={fmt(me.listingsSigned)}   color="#10B981" />
            <MyStatCard icon={TrendingUp}    label="Deals Closed"     value={fmt(me.dealsClosed)}       color="#F95C4B" />
            <MyStatCard icon={DollarSign}    label="Commission"       value={fmtCurrency(me.commissionEarned)} color="#F59E0B" />
          </div>
        </div>
      )}

      {/* Leaderboard list */}
      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <Star className="w-4 h-4 text-[#F95C4B]" strokeWidth={1.75} />
          <span className="text-sm font-bold text-[#111111] dark:text-white">All Agents</span>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] animate-pulse" />
            ))}
          </div>
        ) : board.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Trophy className="w-10 h-10 text-[#6B7280]/20" strokeWidth={1.5} />
            <p className="text-sm font-medium text-[#111111] dark:text-white">No activity yet</p>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Log visits to appear on the leaderboard</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
            {board.map((r) => {
              const medalColor = RANK_COLORS[r.rank]
              const isSelf = r.isSelf
              return (
                <li
                  key={r.userId ?? r.rank}
                  className={`px-5 py-3.5 transition-colors ${
                    isSelf
                      ? 'bg-[#F95C4B]/5 border-l-4 border-[#F95C4B]'
                      : 'hover:bg-[#F5F5F4] dark:hover:bg-[#202020]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Rank badge */}
                    <div
                      className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold"
                      style={
                        medalColor
                          ? { backgroundColor: `${medalColor}20`, color: medalColor }
                          : { backgroundColor: '#F5F5F4', color: '#6B7280' }
                      }
                    >
                      {r.rank <= 3 ? <Medal className="w-3.5 h-3.5" /> : r.rank}
                    </div>

                    {/* Avatar */}
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold"
                      style={
                        isSelf
                          ? { backgroundColor: '#F95C4B', color: 'white' }
                          : { backgroundColor: '#F5F5F4', color: '#6B7280' }
                      }
                    >
                      {initials(r.name)}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-semibold truncate ${isSelf ? 'text-[#F95C4B]' : 'text-[#111111] dark:text-white'}`}>
                          {r.name}
                          {isSelf && <span className="ml-1.5 text-[10px] font-bold text-[#F95C4B]">(You)</span>}
                        </p>
                      </div>
                      {r.agency && (
                        <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] truncate">{r.agency}</p>
                      )}
                      {/* Own breakdown pills */}
                      {isSelf && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#3B82F6]/10 text-[#3B82F6]">
                            {fmt(r.totalVisits)} visits
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#10B981]/10 text-[#10B981]">
                            {fmt(r.listingsSigned)} listings
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F95C4B]/10 text-[#F95C4B]">
                            {fmt(r.dealsClosed)} deals
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Score */}
                    <div className="flex-shrink-0 text-right space-y-1 min-w-[60px]">
                      <p
                        className="text-sm font-bold"
                        style={{ color: isSelf ? '#F95C4B' : (medalColor ?? '#6B7280') }}
                      >
                        {fmt(r.score)}
                      </p>
                      <ScoreBar score={r.score} max={maxScore} />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Scoring info */}
      <div className="bg-[#F5F5F4] dark:bg-[#202020] rounded-xl p-4">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-[#6B7280] dark:text-[#A1A1AA] mb-3">
          How scoring works
        </p>
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Property Visit',  pts: 1, color: '#3B82F6' },
            { label: 'Listing Signed',  pts: 3, color: '#10B981' },
            { label: 'Deal Closed',     pts: 5, color: '#F95C4B' },
          ].map(({ label, pts, color }) => (
            <div key={label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-[#181818]">
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
