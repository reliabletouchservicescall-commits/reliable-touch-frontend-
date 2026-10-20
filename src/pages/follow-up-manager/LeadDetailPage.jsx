import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, AlertTriangle } from 'lucide-react'
import { leadsApi } from '../../services/leadsApi'
import { useAuthStore } from '../../store/authStore'
import LeadDetailScreen from '../../components/leads/LeadDetailScreen'
import { LeadPanelSkeleton } from '../../components/leads/LeadSidePanel'

// Mirrors FOLLOW_UP_EDITABLE in leads.service.js (assignedAgent is handled separately
// via the canAssignAgency flag, not a plain form field).
const EDITABLE_FIELDS = new Set([
  'landlordName', 'listingType', 'priceMin', 'priceMax', 'phone', 'email', 'comments',
  'availability', 'bestCallTime', 'followUpDate', 'appointmentDate', 'appointmentTime',
  'listingUrl', 'disposition', 'leaseStartDate', 'leaseDurationMonths',
])

// Used both as the full page (below) and inside the Leads list's side panel, where
// `panel` carries the panel's controls (close, expand, prev/next).
export function FollowUpManagerLeadDetail({ id, panel = null }) {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const { data: lead, isLoading, isError } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadsApi.getById(id).then((r) => r.data.data.lead),
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
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Could not load this lead — it may no longer be in your hot leads queue.
        </div>
      </div>
    )
  }

  return (
    <LeadDetailScreen
      key={lead._id}
      lead={lead}
      onBack={panel?.onClose ?? (() => navigate('/follow-up-manager/leads'))}
      onDeleted={panel?.onClose ?? (() => navigate('/follow-up-manager/leads'))}
      variant={panel ? 'panel' : 'page'}
      panel={panel}
      invalidateQueryKey={['fum-leads']}
      editableFields={EDITABLE_FIELDS}
      canAssignAgency
      canChangeStatus
      canDelete={false}
      canComment
      currentUserId={user?._id}
      currentUserRole={user?.role}
    />
  )
}

export default function FollowUpManagerLeadDetailPage() {
  const { id } = useParams()
  return <FollowUpManagerLeadDetail id={id} />
}
