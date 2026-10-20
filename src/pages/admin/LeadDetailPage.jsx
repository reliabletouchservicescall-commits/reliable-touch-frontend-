import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, AlertTriangle } from 'lucide-react'
import { leadsApi } from '../../services/leadsApi'
import { useAuthStore } from '../../store/authStore'
import LeadDetailScreen from '../../components/leads/LeadDetailScreen'
import { LeadPanelSkeleton } from '../../components/leads/LeadSidePanel'

// Mirrors leads.service.js's admin branch — everything except status/propertyAddress/area,
// which always go through their own dedicated flows.
const EDITABLE_FIELDS = new Set([
  'landlordName', 'listingType', 'priceMin', 'priceMax', 'phone', 'email', 'comments',
  'availability', 'bestCallTime', 'followUpDate', 'appointmentDate', 'appointmentTime',
  'listingUrl', 'disposition', 'leaseStartDate', 'leaseDurationMonths',
])

// Used both as the full page (below) and inside the Leads list's side panel, where
// `panel` carries the panel's controls (close, expand, prev/next).
export function AdminLeadDetail({ id, panel = null }) {
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
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Could not load this lead.
        </div>
      </div>
    )
  }

  return (
    <LeadDetailScreen
      key={lead._id}
      lead={lead}
      onBack={panel?.onClose ?? (() => navigate('/admin/leads'))}
      onDeleted={panel?.onClose ?? (() => navigate('/admin/leads'))}
      variant={panel ? 'panel' : 'page'}
      panel={panel}
      invalidateQueryKey={['leads']}
      editableFields={EDITABLE_FIELDS}
      showAdminFields
      canAssignAgency
      canChangeStatus
      canDelete
      canComment
      currentUserId={user?._id}
      currentUserRole={user?.role}
    />
  )
}

export default function AdminLeadDetailPage() {
  const { id } = useParams()
  return <AdminLeadDetail id={id} />
}
