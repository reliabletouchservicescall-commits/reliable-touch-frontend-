import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Users, ShieldCheck, Loader2 } from 'lucide-react'
import { agenciesApi } from '../../services/agenciesApi'
import { useAuthStore } from '../../store/authStore'
import { TeamPanel } from '../../components/agencies/AgencyPeople'

export default function AgencyTeamPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const isManager = Boolean(user?.isAgencyManager)

  const { data: agency, isLoading } = useQuery({
    queryKey: ['agency', user?.agencyId],
    queryFn: () => agenciesApi.getById(user.agencyId).then((r) => r.data.data.agency),
    enabled: Boolean(user?.agencyId),
  })

  if (isLoading) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-[#F95C4B]" /></div>
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-5 sm:px-8 pt-6 pb-5 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[#111111] dark:text-white tracking-tight flex items-center gap-2.5">
              <Users className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
              {agency?.name ? `${agency.name} — Team` : 'Team'}
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
              {isManager
                ? 'The agents who work your leads and visits. Each one signs in with their own login.'
                : 'The people you work with at your company.'}
            </p>
          </div>
          {isManager && (
            <span className="inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F95C4B]/10 text-[#F95C4B]">
              <ShieldCheck className="w-3.5 h-3.5" /> Company manager
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6">
        <TeamPanel
          agencyId={user?.agencyId}
          agencyName={agency?.name}
          currentUserId={user?._id}
          canManage={isManager}
          canMakeManager={false}
          canReset={false}
          canMessage
          onMessage={(m) => navigate('/agency/chat', { state: { openUserId: m._id } })}
        />
      </div>
    </div>
  )
}
