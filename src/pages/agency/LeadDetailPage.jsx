import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { agenciesApi } from '../../services/agenciesApi'
import { Loader2, AlertTriangle } from 'lucide-react'
import { leadsApi } from '../../services/leadsApi'
import { useAuthStore } from '../../store/authStore'
import LeadDetailScreen from '../../components/leads/LeadDetailScreen'
import { LeadPanelSkeleton } from '../../components/leads/LeadSidePanel'
import { AGENCY_STATUS_OPTIONS } from '../../components/leads/leadShared'

// Mirrors AGENT_EDITABLE in leads.service.js (attachments excluded — no upload UI exists
// anywhere in this app yet).
const EDITABLE_FIELDS = new Set([
  'comments', 'availability', 'followUpDate',
  'listingUrl', 'disposition', 'leaseStartDate', 'leaseDurationMonths',
])

// Used both as the full page (below) and inside the Leads list's side panel, where
// `panel` carries the panel's controls (close, expand, prev/next).
export function AgencyLeadDetail({ id, panel = null }) {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const { data: lead, isLoading, isError } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadsApi.getById(id).then((r) => r.data.data.lead),
  })

  // A company manager hands a lead to one of their own team — the picker only ever offers
  // active people from their company.
  const isManager = Boolean(user?.isAgencyManager)
  const { data: team } = useQuery({
    queryKey: ['agency-team', user?.agencyId],
    queryFn: () => agenciesApi.listTeam(user.agencyId).then((r) => r.data.data.team),
    enabled: isManager && Boolean(user?.agencyId),
    staleTime: 60_000,
  })

  if (isLoading) {
    if (panel) return <LeadPanelSkeleton onClose={panel.onClose} />
    return (
      <div className="flex items-center justify-center h-full py-32">
        <Loader2 className="w-6 h-6 animate-spin text-[#F95C4B]" />
      </div>
    )
  }

  if (isError || !lead) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444]">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Could not load this lead.
        </div>
      </div>
    )
  }

  return (
    <LeadDetailScreen
      key={lead._id}
      lead={lead}
      onBack={panel?.onClose ?? (() => navigate('/agency/leads'))}
      onDeleted={panel?.onClose ?? (() => navigate('/agency/leads'))}
      variant={panel ? 'panel' : 'page'}
      panel={panel}
      invalidateQueryKey={['agent-leads']}
      editableFields={EDITABLE_FIELDS}
      canAssignAgency={isManager}
      assignableTeam={isManager ? (team ?? []).filter((m) => m.isActive) : null}
      canChangeStatus
      statusOptions={AGENCY_STATUS_OPTIONS}
      canDelete={false}
      canComment
      canCall
      callNotifiesManager={!isManager}
      currentUserId={user?._id}
      currentUserRole={user?.role}
      showSourceBadge
    />
  )
}

export default function AgencyLeadDetailPage() {
  const { id } = useParams()
  return <AgencyLeadDetail id={id} />
}
