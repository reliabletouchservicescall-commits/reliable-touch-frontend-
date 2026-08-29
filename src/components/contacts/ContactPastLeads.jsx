import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { FileText, MapPin, User, Loader2 } from 'lucide-react'
import { leadsApi } from '../../services/leadsApi'
import { LeadStatusBadge, ListingBadge } from '../leads/leadShared'

/**
 * Every lead ever created from this contact, newest first. Reused by admin's
 * contact view and the cold caller's contact detail panel.
 */
export default function ContactPastLeads({ contactId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['contact-leads', contactId],
    queryFn: () => leadsApi.list({ contactId, limit: 50 }).then((r) => r.data.data?.leads ?? []),
    staleTime: 15_000,
  })

  const leads = data ?? []

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-2 flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5" /> Past Leads
        {!isLoading && leads.length > 0 && (
          <span className="text-[#F95C4B]">· {leads.length} lead{leads.length !== 1 ? 's' : ''}</span>
        )}
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-[#F95C4B]" />
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E5E7EB] dark:border-[#2A2A2A] py-6 text-center">
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">No leads created from this contact yet</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {leads.map((lead) => {
            const creator = (lead.createdBy && typeof lead.createdBy === 'object') ? lead.createdBy : null
            const agent = (lead.assignedAgent && typeof lead.assignedAgent === 'object') ? lead.assignedAgent : null
            return (
              <li key={lead._id} className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] p-3.5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-bold text-[#111111] dark:text-white truncate">{lead.landlordName}</p>
                  <LeadStatusBadge status={lead.status} />
                </div>
                <p className="flex items-center gap-1.5 text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  {lead.propertyAddress}
                </p>
                <div className="flex items-center flex-wrap gap-2 mt-2">
                  <ListingBadge listingType={lead.listingType} priceMin={lead.priceMin} priceMax={lead.priceMax} />
                </div>
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2.5 pt-2.5 border-t border-[#F5F5F4] dark:border-[#202020] text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
                  {creator && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 flex-shrink-0" />
                      {creator.firstName} {creator.lastName}
                    </span>
                  )}
                  {agent && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 flex-shrink-0 text-[#3B82F6]" />
                      {agent.firstName} {agent.lastName}
                    </span>
                  )}
                  <span>{format(new Date(lead.createdAt), 'd MMM yyyy')}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
