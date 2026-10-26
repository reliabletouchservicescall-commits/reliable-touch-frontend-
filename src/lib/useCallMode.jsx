import { useQuery } from '@tanstack/react-query'
import axiosClient from './axios'
import { useAuthStore } from '../store/authStore'

// GET /reports/call-mode — shared by the Call mode / Callbacks pages and their sidebar badges
// (the badge's fetch also means the page opens instantly). mode: 'all' | 'callbacks'
export function useCallMode({ mode = 'all', enabled = true } = {}) {
  const userId = useAuthStore((s) => s.user?._id)
  return useQuery({
    queryKey: ['call-mode', userId, mode],
    queryFn: () => axiosClient.get('/reports/call-mode', { params: mode === 'callbacks' ? { mode } : {} }).then((r) => r.data.data),
    staleTime: 15_000,
    refetchInterval: 120_000,
    enabled: enabled && Boolean(userId),
  })
}

// Sidebar badge — Call mode: how many are waiting for a first call (same as "to call" on the
// page); Callbacks: how many are due now or overdue (amber)
export function CallModeBadge({ collapsed, mode = 'all' }) {
  const { data } = useCallMode({ mode })
  const n = (mode === 'callbacks' ? data?.counts.dueSoon : data?.counts.toCall) ?? 0
  const amber = mode === 'callbacks'
  if (!n) return null
  const text = collapsed ? (n > 9 ? '9+' : n) : n > 999 ? '999+' : n
  return collapsed
    ? <span className={`absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-[3px] rounded-full ${amber ? 'bg-[#F59E0B]' : 'bg-[#F95C4B]'} text-white text-[8px] font-bold flex items-center justify-center`}>{text}</span>
    : <span className={`ml-auto min-w-[18px] h-[18px] px-1.5 rounded-full ${amber ? 'bg-[#F59E0B]/15 text-[#D97706]' : 'bg-[#F95C4B]/12 text-[#F95C4B]'} text-[10px] font-bold flex items-center justify-center tabular-nums`}>{text}</span>
}
