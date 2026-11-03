import { useQuery } from '@tanstack/react-query'
import axiosClient from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'

// The agent's home data (GET /reports/agent-home) — one cached query shared by Home, the
// sidebar badges and the combined screens' tab counts. Agents only.
export function useAgentHome() {
  const user = useAuthStore((s) => s.user)
  const isAgent = user?.role === 'agency' && !user?.isAgencyManager
  return useQuery({
    queryKey: ['agent-home'],
    queryFn: () => axiosClient.get('/reports/agent-home').then((r) => r.data.data),
    refetchInterval: 45_000,
    staleTime: 30_000,
    enabled: isAgent,
  })
}
