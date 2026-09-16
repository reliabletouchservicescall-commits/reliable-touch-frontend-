import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, AlertTriangle } from 'lucide-react'
import { leadsApi } from '../../services/leadsApi'
import { useAuthStore } from '../../store/authStore'
import LeadDetailScreen from '../../components/leads/LeadDetailScreen'

// Mirrors AGENT_EDITABLE in leads.service.js (attachments excluded — no upload UI exists
// anywhere in this app yet).
const EDITABLE_FIELDS = new Set(['comments', 'availability', 'followUpDate'])

export default function AgencyLeadDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const { data: lead, isLoading, isError } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadsApi.getById(id).then((r) => r.data.data.lead),
  })

  if (isLoading) {
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
      lead={lead}
      onBack={() => navigate('/agency/leads')}
      onDeleted={() => navigate('/agency/leads')}
      invalidateQueryKey={['agent-leads']}
      editableFields={EDITABLE_FIELDS}
      canAssignAgency={false}
      canChangeStatus={false}
      canDelete={false}
      canComment={false}
      currentUserId={user?._id}
    />
  )
}
