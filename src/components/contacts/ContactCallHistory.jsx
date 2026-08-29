import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  PhoneCall, PhoneMissed, PhoneOff, Voicemail, Clock, CheckCircle2, ThumbsDown, AlertCircle, Loader2,
} from 'lucide-react'
import { callLogsApi } from '../../services/callLogsApi'

// Matches the outcome palette used everywhere else calls are logged/shown
// (cold-caller's MyContactsPage / CallLogsPage, admin's CallLogsPage).
const CALL_OUTCOME_META = {
  no_answer:          { label: 'No Answer',          icon: PhoneMissed,  color: '#6B7280' },
  voicemail:          { label: 'Voicemail',          icon: Voicemail,    color: '#6B7280' },
  callback_requested: { label: 'Callback Requested', icon: Clock,        color: '#F59E0B' },
  interested:         { label: 'Interested',         icon: CheckCircle2, color: '#10B981' },
  not_interested:     { label: 'Not Interested',     icon: ThumbsDown,   color: '#F97316' },
  wrong_number:       { label: 'Wrong Number',       icon: AlertCircle,  color: '#8B5CF6' },
  remove_me:          { label: 'Remove Me (DNC)',    icon: PhoneOff,     color: '#EF4444' },
}

/**
 * Full call-log history for one contact — every call ever logged against them,
 * newest first, including who made the call. Reused by admin's contact view and
 * the cold caller's contact detail panel.
 */
export default function ContactCallHistory({ contactId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['call-history', contactId],
    queryFn: () => callLogsApi.listByContact(contactId).then((r) => r.data.data.callLogs ?? []),
    staleTime: 15_000,
  })

  const logs = data ?? []

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-2 flex items-center gap-1.5">
        <PhoneCall className="w-3.5 h-3.5" /> Call History
        {!isLoading && logs.length > 0 && (
          <span className="text-[#F95C4B]">· {logs.length} call{logs.length !== 1 ? 's' : ''}</span>
        )}
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-[#F95C4B]" />
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E5E7EB] dark:border-[#2A2A2A] py-6 text-center">
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">No calls logged yet</p>
        </div>
      ) : (
        <ul className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A] overflow-hidden">
          {logs.map((log) => {
            const meta = CALL_OUTCOME_META[log.outcome] ?? { label: log.outcome, icon: PhoneCall, color: '#6B7280' }
            const Icon = meta.icon
            const caller = (log.calledBy && typeof log.calledBy === 'object') ? log.calledBy : null
            return (
              <li key={log._id} className="flex items-start gap-3 px-4 py-3 bg-white dark:bg-[#181818]">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5" style={{ backgroundColor: `${meta.color}15` }}>
                  <Icon className="w-4 h-4" style={{ color: meta.color }} strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                    {log.durationSeconds > 0 && (
                      <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
                        {Math.floor(log.durationSeconds / 60)}m {log.durationSeconds % 60}s
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
                    {format(new Date(log.calledAt), 'd MMM yyyy · HH:mm')}
                    {caller && ` · ${caller.firstName} ${caller.lastName}`}
                  </p>
                  {log.notes && (
                    <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-1 italic">"{log.notes}"</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
