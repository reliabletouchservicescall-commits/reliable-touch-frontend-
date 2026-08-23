import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CalendarClock, CalendarCheck, CheckCircle2, Ban, UserX, Plus, Calendar, User } from 'lucide-react'
import { appointmentsApi } from '../../services/appointmentsApi'
import BookAppointmentDrawer from './BookAppointmentDrawer'

const STATUS_META = {
  scheduled: { label: 'Scheduled', color: '#3B82F6', Icon: CalendarClock },
  confirmed: { label: 'Confirmed', color: '#10B981', Icon: CalendarCheck },
  completed: { label: 'Completed', color: '#6B7280', Icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: '#EF4444', Icon: Ban },
  no_show:   { label: 'No Show',   color: '#F59E0B', Icon: UserX },
}

function resolveUser(obj) {
  return obj && typeof obj === 'object' && obj.firstName ? obj : null
}

/**
 * Compact "Appointments" section for a lead's detail view — shows any Appointment
 * records linked to this lead and lets the viewer book a new one against it.
 */
export default function LeadAppointments({ lead, canBook = true }) {
  const [booking, setBooking] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['lead-appointments', lead._id],
    queryFn: () => appointmentsApi.list({ leadId: lead._id, limit: 20 }).then((r) => r.data.data?.appointments ?? []),
    staleTime: 15_000,
  })
  const appointments = data ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" /> Appointments
        </p>
        {canBook && (
          <button
            onClick={() => setBooking(true)}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#3B82F6] hover:underline"
          >
            <Plus className="w-3 h-3" /> Schedule
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="h-14 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] animate-pulse" />
      ) : appointments.length === 0 ? (
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] italic px-1">No appointments scheduled yet.</p>
      ) : (
        <ul className="space-y-2">
          {appointments.map((a) => {
            const meta = STATUS_META[a.status] ?? STATUS_META.scheduled
            const Icon = meta.Icon
            const assignee = resolveUser(a.agentId)
            return (
              <li key={a._id} className="flex items-center gap-3 p-3 rounded-xl bg-[#F5F5F4] dark:bg-[#202020]">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${meta.color}18` }}>
                  <Icon className="w-4 h-4" style={{ color: meta.color }} strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-[#111111] dark:text-white">
                      {format(new Date(a.scheduledDate), 'd MMM yyyy')} · {a.scheduledTime}
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: meta.color, backgroundColor: `${meta.color}15` }}>
                      {meta.label}
                    </span>
                  </div>
                  {assignee && (
                    <p className="flex items-center gap-1 text-[11px] text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
                      <User className="w-3 h-3" /> {assignee.firstName} {assignee.lastName}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {booking && (
        <BookAppointmentDrawer
          lead={lead}
          onClose={() => setBooking(false)}
          onBooked={() => setBooking(false)}
        />
      )}
    </div>
  )
}
