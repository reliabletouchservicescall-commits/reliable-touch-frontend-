import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Trophy, Phone, TrendingUp, CheckCircle2,
  Medal, Star, Crown, BarChart2,
} from 'lucide-react'
import axiosClient from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'

/* ─── API ─────────────────────────────────────────────────────────── */

async function fetchLeaderboard(period) {
  const { data } = await axiosClient.get(`/performance/leaderboard-caller?period=${period}`)
  return data.data.leaderboard ?? []
}

async function fetchMyStats(period) {
  const { data } = await axiosClient.get(`/performance/me?period=${period}`)
  return data.data.stats
}

/* ─── Constants ───────────────────────────────────────────────────── */

const PERIODS = [
  { key: 'day',   label: 'Today' },
  { key: 'week',  label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year',  label: 'This Year' },
]

const MEDAL = {
  1: { color: '#F59E0B', bg: '#F59E0B18', label: '1st', borderColor: '#F59E0B' },
  2: { color: '#9CA3AF', bg: '#9CA3AF18', label: '2nd', borderColor: '#9CA3AF' },
  3: { color: '#B45309', bg: '#B4530918', label: '3rd', borderColor: '#B45309' },
}

/* ─── Initials avatar ─────────────────────────────────────────────── */

function Avatar({ name, rank, isSelf, size = 'md' }) {
  const parts = name.split(' ')
  const ini   = `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
  const medal = MEDAL[rank]
  const sz    = size === 'lg' ? 'w-16 h-16 text-lg' : 'w-9 h-9 text-xs'
  const bg    = isSelf ? '#F95C4B' : (medal?.color ?? '#6B7280')
  const textC = isSelf ? 'text-white' : 'text-white'
  return (
    <div
      className={`flex-shrink-0 ${sz} rounded-full flex items-center justify-center font-bold ring-2 ring-offset-1 ring-offset-white dark:ring-offset-[#181818]`}
      style={{
        backgroundColor: bg,
        ringColor: bg,
        boxShadow: isSelf ? `0 0 0 2px #F95C4B` : medal ? `0 0 0 2px ${medal.color}` : undefined,
      }}
    >
      <span className={textC}>{ini || '?'}</span>
    </div>
  )
}

/* ─── My stat card ────────────────────────────────────────────────── */

function MyStatCard({ icon: Icon, label, value, color, loading }) {
  return (
    <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4 flex flex-col gap-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
        <Icon className="w-4 h-4" style={{ color }} strokeWidth={1.75} />
      </div>
      {loading
        ? <div className="h-7 w-10 rounded-lg bg-[#F5F5F4] dark:bg-[#202020] animate-pulse" />
        : <p className="text-2xl font-black text-[#111111] dark:text-white">{value ?? 0}</p>
      }
      <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] font-medium">{label}</p>
    </div>
  )
}

/* ─── Rank badge ──────────────────────────────────────────────────── */

function RankBadge({ rank, total }) {
  const pct = total > 0 ? Math.round((rank / total) * 100) : 0
  const isTop = rank <= 3
  const color = isTop ? (MEDAL[rank]?.color ?? '#F95C4B') : '#F95C4B'
  return (
    <div
      className="flex items-center gap-2.5 px-4 py-3 rounded-xl border"
      style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}
    >
      {rank === 1 ? (
        <Crown className="w-5 h-5" style={{ color }} />
      ) : (
        <Medal className="w-5 h-5" style={{ color }} />
      )}
      <div>
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Your Rank</p>
        <p className="text-lg font-black" style={{ color }}>
          #{rank ?? '—'}
          <span className="text-xs font-medium text-[#9CA3AF] ml-1">of {total}</span>
        </p>
      </div>
      {rank && (
        <div className="ml-auto text-right">
          <p className="text-[10px] text-[#9CA3AF]">Top</p>
          <p className="text-sm font-bold" style={{ color }}>{pct}%</p>
        </div>
      )}
    </div>
  )
}

/* ─── Main ────────────────────────────────────────────────────────── */

export default function LeaderboardPage() {
  const { user } = useAuthStore()
  const [period, setPeriod] = useState('week')

  const { data: board = [], isLoading: boardLoading } = useQuery({
    queryKey: ['performance', 'caller-board', period],
    queryFn: () => fetchLeaderboard(period),
    staleTime: 30_000,
  })

  const { data: myStats, isLoading: statsLoading } = useQuery({
    queryKey: ['performance', 'my-stats', period],
    queryFn: () => fetchMyStats(period),
    staleTime: 30_000,
  })

  const loading = boardLoading || statsLoading

  return (
    <div className="p-5 sm:p-8 max-w-4xl mx-auto space-y-7">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
            </div>
            <h1 className="text-2xl font-bold text-[#111111] dark:text-white tracking-tight">
              Leaderboard
            </h1>
          </div>
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">
            See how you stack up against the team
          </p>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] dark:bg-[#202020] rounded-xl">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                period === p.key
                  ? 'bg-white dark:bg-[#2A2A2A] text-[#F95C4B] shadow-sm'
                  : 'text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* My position banner */}
      {myStats && (
        <RankBadge rank={myStats.rank} total={myStats.total} />
      )}

      {/* My stats */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-3">
          My Performance
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MyStatCard
            icon={Phone}
            label="Calls Made"
            value={myStats?.totalCalls}
            color="#3B82F6"
            loading={loading}
          />
          <MyStatCard
            icon={TrendingUp}
            label="Leads Created"
            value={myStats?.leadsCreated}
            color="#10B981"
            loading={loading}
          />
          <MyStatCard
            icon={CheckCircle2}
            label="Leads Closed"
            value={myStats?.leadsClosed}
            color="#8B5CF6"
            loading={loading}
          />
          <MyStatCard
            icon={Star}
            label="My Score"
            value={myStats?.score}
            color="#F95C4B"
            loading={loading}
          />
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <BarChart2 className="w-4 h-4 text-[#F95C4B]" strokeWidth={1.75} />
          <span className="text-sm font-bold text-[#111111] dark:text-white">Rankings</span>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] animate-pulse" />
            ))}
          </div>
        ) : board.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Trophy className="w-10 h-10 text-[#6B7280]/20" strokeWidth={1.5} />
            <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">
              No activity yet for this period — make some calls!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
            {board.map((entry) => {
              const medal   = MEDAL[entry.rank]
              const isSelf  = entry.isSelf
              const maxScore = board[0]?.score ?? 1
              const pct      = maxScore > 0 ? Math.round((entry.score / maxScore) * 100) : 0

              return (
                <div
                  key={`${entry.rank}-${entry.name}`}
                  className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${
                    isSelf
                      ? 'bg-[#F95C4B]/5 dark:bg-[#F95C4B]/10'
                      : 'hover:bg-[#FAFAF9] dark:hover:bg-[#111111]'
                  }`}
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-8 flex items-center justify-center">
                    {entry.rank <= 3 ? (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: medal?.bg }}
                      >
                        <span className="text-[10px] font-black" style={{ color: medal?.color }}>
                          {entry.rank}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm font-bold text-[#9CA3AF]">{entry.rank}</span>
                    )}
                  </div>

                  {/* Avatar + name */}
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <Avatar name={entry.name} rank={entry.rank} isSelf={isSelf} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold truncate ${isSelf ? 'text-[#F95C4B]' : 'text-[#111111] dark:text-white'}`}>
                          {isSelf ? `${entry.name} (You)` : entry.name}
                        </span>
                      </div>
                      {/* Score bar — visible on mobile */}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="flex-1 h-1 bg-[#F3F4F6] dark:bg-[#2A2A2A] rounded-full overflow-hidden max-w-[80px]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: isSelf
                                ? 'linear-gradient(90deg, #F95C4B, #FF8C7A)'
                                : medal
                                ? `linear-gradient(90deg, ${medal.color}, ${medal.color}99)`
                                : '#9CA3AF',
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-[#9CA3AF]">{pct}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Own detail breakdown (only shown for self) */}
                  {isSelf && (
                    <div className="hidden sm:flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold text-[#3B82F6] bg-[#3B82F6]/10">
                        <Phone className="w-3 h-3" /> {entry.totalCalls}
                      </span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold text-[#10B981] bg-[#10B981]/10">
                        <TrendingUp className="w-3 h-3" /> {entry.leadsCreated}
                      </span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold text-[#8B5CF6] bg-[#8B5CF6]/10">
                        <CheckCircle2 className="w-3 h-3" /> {entry.leadsClosed}
                      </span>
                    </div>
                  )}

                  {/* Score */}
                  <div className="flex-shrink-0 text-right">
                    <span className={`text-base font-black ${isSelf ? 'text-[#F95C4B]' : 'text-[#111111] dark:text-white'}`}>
                      {entry.score}
                    </span>
                    <span className="text-[10px] text-[#9CA3AF] ml-0.5">pts</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Scoring info */}
      <div className="bg-[#F95C4B]/5 dark:bg-[#F95C4B]/10 border border-[#F95C4B]/20 rounded-2xl p-4">
        <p className="text-xs font-semibold text-[#F95C4B] mb-2">How scores are calculated</p>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
            <span className="font-bold text-[#3B82F6]">+1 pt</span> per call logged
          </span>
          <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
            <span className="font-bold text-[#10B981]">+3 pts</span> per lead created
          </span>
          <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
            <span className="font-bold text-[#8B5CF6]">+5 pts</span> per lead closed
          </span>
        </div>
      </div>
    </div>
  )
}
