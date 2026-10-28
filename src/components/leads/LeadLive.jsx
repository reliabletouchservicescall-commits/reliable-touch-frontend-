import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { addDays, format, formatDistanceToNowStrict, isToday, isYesterday } from 'date-fns'
import {
  Check, Eye, Star, Sparkles, Repeat, CalendarClock, CalendarPlus, UserPlus, Loader2, X, PencilLine, Trash2, Phone,
} from 'lucide-react'
import axiosClient from '../../lib/axios'
import { leadsApi } from '../../services/leadsApi'
import { onLeadEvent } from '../../lib/livePresence'
import LeadCallButton from './LeadCallButton'
import BookAppointmentDrawer from '../appointments/BookAppointmentDrawer'
import { LeadStatusBadge, LeadSourceBadge, ListingBadge, AgentOrAgencyPicker, inputCls, getApiErrorMessage } from './leadShared'
import { DateField } from '../common/DateTimeFields'

// The live parts of the lead screen, shared by every role (LeadDetailScreen puts them
// together): the journey hero with whoever has the lead open right now, a one-tap action
// bar, the activity column (every open and change, live) and the call that found the lead.
// Data: GET /leads/:id/activity, refreshed on any change to the lead (socket) and every 20s.

const AVATAR = ['#C4B5FD', '#FCD34D', '#FDA4AF', '#93C5FD', '#6EE7B7', '#F9A8D4']
export const tone = (s = '') => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AVATAR[h % AVATAR.length] }
export const initialsOf = (n = '') => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
const when = (d) => (!d ? '' : isToday(new Date(d)) ? `Today ${format(new Date(d), 'HH:mm')}` : isYesterday(new Date(d)) ? `Yesterday ${format(new Date(d), 'HH:mm')}` : format(new Date(d), 'd MMM HH:mm'))
const dayText = (d) => (!d ? '' : isToday(new Date(d)) ? 'Today' : format(new Date(d), 'd MMM'))
const firstName = (n = '') => n.split(' ')[0]
const card = 'rounded-3xl border border-[#E5E7EB] dark:border-[#262626] bg-white dark:bg-[#151515]'

export function useLeadActivity(leadId) {
  const qc = useQueryClient()
  useEffect(() => onLeadEvent((event, p) => {
    if (p?.leadId === leadId && ['lead:changed', 'lead_activity'].includes(event)) qc.invalidateQueries({ queryKey: ['lead-activity', leadId] })
  }), [leadId, qc])
  return useQuery({
    queryKey: ['lead-activity', leadId],
    queryFn: () => axiosClient.get(`/leads/${leadId}/activity`).then((r) => r.data.data),
    refetchInterval: 20_000, // "looking at it now" stays fresh
    staleTime: 5_000,
    enabled: Boolean(leadId),
  })
}

// One-tap messages for the chat, by role
export const QUICK_REPLIES = {
  cold_caller: ['Any news on this one?', 'Thank you for working it!', 'He prefers WhatsApp', 'Best time to call: after 17:00'],
  follow_up_manager: ['Landlord confirmed — handing to an agent', 'No answer, trying again later', 'Callback booked', 'Any update from the agent?'],
  agency: ['Viewing booked', 'Photos taken', 'Listed today', 'Landlord not ready yet'],
  admin: ['Any update on this one?', 'Please follow up today', 'Great work, team!'],
}

/* ─── Hero ──────────────────────────────────────────────────────────────── */

function nextHint(lead, data) {
  const s = lead.status
  if (['rented_out', 'sold'].includes(s)) return `Closed — ${s === 'sold' ? 'sold' : 'rented out'}.`
  if (s === 'lost') return 'This lead was lost.'
  if (s === 'listed' || s === 'still_negotiating') return 'Next: close the deal — rented out or sold.'
  if (lead.assignedAgent || lead.agencyId) return 'Next: book a viewing with the landlord and get it listed.'
  if (s === 'hot') return 'Next: hand it to an agent.'
  return lead.followUpDate ? `Next: follow up on ${format(new Date(lead.followUpDate), 'EEE d MMM')}.` : 'Next: call the landlord and set a follow-up date.'
}

export function LeadHero({ lead, data, showSourceBadge }) {
  const area = lead.area && typeof lead.area === 'object' ? lead.area : null
  const finder = data?.finder
  const won = ['rented_out', 'sold'].includes(lead.status)
  const p = data?.points
  const closeWord = lead.listingType === 'sale' ? 'sells' : 'rents out'
  return (
    <section className={`glass-in ${card} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#059669] dark:text-[#34D399]">
            {finder?.me ? 'You found this lead' : finder ? `Found by ${firstName(finder.name)}` : 'Lead'} · {format(new Date(lead.createdAt), 'd MMM, HH:mm')}
          </p>
          <div className="mt-1 flex items-center gap-2.5 flex-wrap">
            <h2 className="text-2xl sm:text-[28px] font-bold uppercase tracking-tight text-[#111111] dark:text-white leading-tight">{lead.landlordName}</h2>
            <LeadStatusBadge status={lead.status} size="lg" />
            {showSourceBadge && <LeadSourceBadge source={lead.source} size="lg" />}
          </div>
          <p className="mt-1 text-[15px] text-[#6B7280] dark:text-[#A1A1AA]">
            {[lead.propertyAddress, area ? `${area.name}${area.region ? `, ${area.region}` : ''}` : null, lead.listingType === 'sale' ? 'For sale' : lead.listingType ? 'For rental' : null].filter(Boolean).join(' · ')}
          </p>
          {lead.listingType && (lead.priceMin || lead.priceMax) ? <div className="mt-2"><ListingBadge listingType={lead.listingType} priceMin={lead.priceMin} priceMax={lead.priceMax} /></div> : null}
        </div>
        <div className="flex flex-col gap-2">
          {(data?.watching ?? []).slice(0, 2).map((w) => (
            <div key={w.id} className="mac-pop flex items-center gap-3 rounded-2xl px-4 py-3 border border-[#10B981]/40 bg-[#ECFDF5] dark:bg-[#0F2219]">
              <span className="relative flex w-2.5 h-2.5"><span className="absolute inset-0 rounded-full bg-[#10B981] animate-ping opacity-60" /><span className="relative w-2.5 h-2.5 rounded-full bg-[#10B981]" /></span>
              <span>
                <span className="block text-sm font-bold text-[#111111] dark:text-white">{firstName(w.name)} is {w.editing ? 'editing' : 'looking at'} it now</span>
                <span className="block text-xs text-[#6B7280] dark:text-[#A1A1AA]">{[w.role, w.company, w.since ? `opened ${formatDistanceToNowStrict(new Date(w.since))} ago` : null].filter(Boolean).join(' · ')}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {data ? (
        <>
          <ol className="mt-6 grid gap-y-4" style={{ gridTemplateColumns: `repeat(${data.journey.length}, minmax(0,1fr))` }}>
            {data.journey.map((s, i) => {
              const next = data.journey[i + 1]
              return (
                <li key={s.key} className="mac-slide-in relative pr-2 min-w-0" style={{ '--d': `${i * 70}ms` }}>
                  <div className="flex items-center">
                    <span className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${s.state === 'done' ? (s.key === 'lost' ? 'bg-[#9CA3AF] border-[#9CA3AF] text-white' : 'bg-[#10B981] border-[#10B981] text-white') : s.state === 'current' ? 'border-[#60A5FA] text-[#60A5FA] bg-[#EFF6FF] dark:bg-[#121C2B]' : 'border-[#D4D4D8] dark:border-[#3F3F46]'}`}>
                      {s.state === 'done' ? <Check className="w-4 h-4" /> : s.state === 'current' ? <Eye className="w-4 h-4" /> : null}
                    </span>
                    {next && <span className="flex-1 h-0.5 mx-2 rounded-full" style={{ backgroundColor: next.state === 'done' || (s.state === 'done' && next.state === 'current') ? '#10B981' : 'rgb(156 163 175 / 0.3)' }} />}
                  </div>
                  <p className={`mt-2.5 text-sm font-bold truncate ${s.state === 'done' ? 'text-[#111111] dark:text-white' : s.state === 'current' ? 'text-[#3B82F6] dark:text-[#60A5FA]' : 'text-[#9CA3AF]'}`}>{s.key === 'found' && finder && !finder.me ? `${firstName(finder.name)} found it` : s.label}</p>
                  <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[#A1A1AA] line-clamp-2">
                    {s.state === 'done'
                      ? [s.at ? dayText(s.at) : null, s.detail].filter(Boolean).join(' · ') || 'Done'
                      : finder?.me && s.points != null ? <>{s.state === 'current' ? 'Next step' : s.key === 'closed' ? 'Your deal' : 'Then'} · <b className="text-[#059669] dark:text-[#34D399]">+{s.points} points for you</b></>
                        : s.state === 'current' ? 'Next step' : s.detail ?? ''}
                  </p>
                </li>
              )
            })}
          </ol>
          <div className="mt-5 flex items-start gap-3 rounded-2xl px-4 py-3 border border-[#10B981]/40 bg-[#ECFDF5] dark:bg-[#0F2219] text-sm text-[#111111] dark:text-white">
            <Star className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />
            <p>
              {finder?.me && p && !won && lead.status !== 'lost'
                ? <>If this {closeWord}, it counts as <b>a deal you started</b> and earns you <b className="text-[#059669] dark:text-[#34D399]">+{p.ifClosed - p.now} points</b>.</>
                : finder?.me && won ? <>This became <b>a deal you started</b> — {p?.now} points for you.</> : nextHint(lead, data)}
              {data.workers > 0 ? ` ${data.workers} ${data.workers === 1 ? 'person has' : 'people have'} worked on it${finder?.me ? ' since your call' : ''}.` : ''}
            </p>
          </div>
        </>
      ) : <div className="shimmer mt-6 h-[90px] rounded-2xl" />}
    </section>
  )
}

/* ─── One-tap actions ───────────────────────────────────────────────────── */

const FOLLOW_CHOICES = [['Tomorrow', 1], ['In 3 days', 3], ['Next week', 7], ['In 2 weeks', 14], ['Next month', 30]]

function ActionButton({ icon: Icon, label, onClick, active, tone: c = '#111111', primary }) {
  return (
    <button type="button" onClick={onClick}
      className={`mac-press flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold border transition-all ${
        primary ? 'text-white border-transparent bg-[#F95C4B] hover:bg-[#E84B3A] shadow-[0_10px_24px_-14px_rgba(249,92,75,0.9)]'
          : active ? 'border-[#F95C4B] text-[#F95C4B] bg-[#F95C4B]/8'
            : 'border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] text-[#111111] dark:text-white hover:border-[#9CA3AF]'
      }`}>
      <Icon className="w-4 h-4" style={primary || active ? undefined : { color: c }} /> {label}
    </button>
  )
}

export function QuickActions({
  lead, onLead, invalidateQueryKey, currentUserRole, currentUserId,
  canCall, callNotifiesManager, canChangeStatus, onStatus, canSetFollowUp, canBook, canAssign, assignableTeam,
  canEdit, onEdit, canDelete, onDelete,
}) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(null) // 'follow' | 'assign'
  const [booking, setBooking] = useState(false)
  const [pick, setPick] = useState({ assignedAgent: lead.assignedAgent?._id ?? lead.assignedAgent ?? '', agencyId: lead.agencyId?._id ?? lead.agencyId ?? '' })
  const [date, setDate] = useState('')
  const done = (res, msg) => {
    toast.success(msg)
    onLead(res.data.data.lead)
    setOpen(null)
    qc.invalidateQueries({ queryKey: invalidateQueryKey })
    qc.invalidateQueries({ queryKey: ['lead-activity', lead._id] })
  }
  const followMut = useMutation({
    mutationFn: (d) => leadsApi.update(lead._id, { followUpDate: d }),
    onSuccess: (res, d) => done(res, `Follow-up set for ${format(new Date(d), 'EEE d MMM')}`),
    onError: (e) => toast.error(getApiErrorMessage(e, 'Couldn’t set the follow-up date')),
  })
  const assignMut = useMutation({
    mutationFn: () => leadsApi.update(lead._id, { assignedAgent: pick.assignedAgent || null, agencyId: pick.agencyId || null }),
    onSuccess: (res) => done(res, 'Lead assigned'),
    onError: (e) => toast.error(getApiErrorMessage(e, 'Couldn’t assign the lead')),
  })
  const toggle = (k) => setOpen((o) => (o === k ? null : k))
  const assigned = lead.assignedAgent || lead.agencyId
  const phone = lead.contactId?.phone ?? lead.phone
  const callable = canCall && phone && (lead.contactId?._id ?? lead.contactId) // LeadCallButton needs both
  return (
    <section className="glass-in space-y-3" style={{ '--d': '60ms' }}>
      <div className="flex flex-wrap items-center gap-2">
        {callable && <LeadCallButton lead={lead} notifyManager={callNotifiesManager} />}
        {!callable && phone && (
          <a href={`tel:${String(phone).replace(/[^\d+]/g, '')}`} className="mac-press flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] text-[#111111] dark:text-white hover:border-[#10B981]">
            <Phone className="w-4 h-4 text-[#10B981]" /> {phone}
          </a>
        )}
        {canChangeStatus && <ActionButton primary icon={Repeat} label="Update status" onClick={onStatus} />}
        {canSetFollowUp && <ActionButton icon={CalendarClock} label={lead.followUpDate ? `Follow-up ${format(new Date(lead.followUpDate), 'd MMM')}` : 'Set follow-up'} tone="#F59E0B" active={open === 'follow'} onClick={() => toggle('follow')} />}
        {canBook && <ActionButton icon={CalendarPlus} label="Book appointment" tone="#3B82F6" onClick={() => setBooking(true)} />}
        {canAssign && <ActionButton icon={UserPlus} label={assigned ? 'Reassign' : 'Assign'} tone="#8B5CF6" active={open === 'assign'} onClick={() => toggle('assign')} />}
        {canEdit && <ActionButton icon={PencilLine} label="Edit details" tone="#6B7280" onClick={onEdit} />}
        {canDelete && (
          <button type="button" onClick={onDelete} title="Delete lead" className="ml-auto w-10 h-10 rounded-2xl flex items-center justify-center text-[#9CA3AF] hover:bg-[#EF4444]/10 hover:text-[#EF4444] transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {open === 'follow' && (
        <div className="files-collapse flex flex-wrap items-center gap-2 rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] p-3">
          <span className="text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] mr-1">Next follow-up:</span>
          {FOLLOW_CHOICES.map(([l, d]) => (
            <button key={l} type="button" disabled={followMut.isPending} onClick={() => followMut.mutate(format(addDays(new Date(), d), 'yyyy-MM-dd'))}
              className="px-3.5 py-2 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white hover:border-[#F59E0B] hover:text-[#D97706] disabled:opacity-50">
              {l}
            </button>
          ))}
          <div className="flex items-center gap-1.5">
            <DateField value={date} onChange={setDate} className={`${inputCls(false)} !py-2 w-40`} />
            <button type="button" disabled={!date || followMut.isPending} onClick={() => followMut.mutate(date)} className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#F59E0B] text-white disabled:opacity-40">
              {followMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
          </div>
          <button type="button" onClick={() => setOpen(null)} className="ml-auto text-[#9CA3AF]"><X className="w-4 h-4" /></button>
        </div>
      )}

      {open === 'assign' && (
        <div className="files-collapse flex flex-wrap items-center gap-2 rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] p-3">
          <span className="text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA]">{assignableTeam ? 'Give it to' : 'Hand it to'}</span>
          <div className="flex-1 min-w-[240px]">
            <AgentOrAgencyPicker teamMembers={assignableTeam} assignedAgent={pick.assignedAgent} agencyId={pick.agencyId} onChange={setPick} className={inputCls(false)} />
          </div>
          <button type="button" disabled={assignMut.isPending || (!pick.assignedAgent && !pick.agencyId)} onClick={() => assignMut.mutate()}
            className="mac-press flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-[#8B5CF6] disabled:opacity-40">
            {assignMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Assign
          </button>
          <button type="button" onClick={() => setOpen(null)} className="text-[#9CA3AF]"><X className="w-4 h-4" /></button>
        </div>
      )}

      {booking && (
        <BookAppointmentDrawer
          lead={lead}
          agencyMode={currentUserRole === 'agency' ? { isManager: Boolean(assignableTeam), teamMembers: assignableTeam, currentUserId } : undefined}
          onClose={() => setBooking(false)}
          onBooked={() => { setBooking(false); qc.invalidateQueries({ queryKey: ['lead-appointments', lead._id] }); qc.invalidateQueries({ queryKey: ['lead-activity', lead._id] }) }}
        />
      )}
    </section>
  )
}

/* ─── Activity column ───────────────────────────────────────────────────── */

export function ActivityFeed({ data, isLoading }) {
  const mine = data?.finder?.me
  const opens = data?.opens ?? 0
  return (
    <section className={`glass-in ${card} p-5`} style={{ '--d': '100ms' }}>
      <div className="flex items-center justify-between">
        <p className="text-lg font-bold text-[#111111] dark:text-white">{mine ? 'Who opened your lead' : 'Activity on this lead'}</p>
        <span className="text-sm font-semibold text-[#3B82F6]">{opens} open{opens === 1 ? '' : 's'}</span>
      </div>
      <ul className="mt-2 thin-scroll max-h-[520px] overflow-y-auto divide-y divide-[#F1EFEC] dark:divide-[#232323]">
        {isLoading && Array.from({ length: 4 }, (_, i) => <li key={i} className="py-3"><div className="shimmer h-10 rounded-xl" /></li>)}
        {(data?.watching ?? []).map((w) => (
          <li key={`live-${w.id}`} className="mac-in flex gap-3 py-3">
            <span className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-[#111111] flex-shrink-0" style={{ backgroundColor: tone(w.id) }}>{initialsOf(w.name)}</span>
            <span className="min-w-0">
              <span className="block text-sm text-[#111111] dark:text-white"><b>{w.name}</b> <span className="text-[#10B981]">is {w.editing ? 'editing' : 'viewing'} it now</span></span>
              <span className="block text-xs text-[#9CA3AF]">{[w.role, w.company].filter(Boolean).join(' · ')}</span>
            </span>
          </li>
        ))}
        {data && data.timeline.length === 0 && data.watching.length === 0 && <li className="py-8 text-center text-sm text-[#9CA3AF]">Nothing has happened on this lead yet.</li>}
        {(data?.timeline ?? []).map((t, i) => (
          <li key={t.id} className="mac-slide-in flex gap-3 py-3" style={{ '--d': `${Math.min(i, 10) * 30}ms` }}>
            <span className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-[#111111] flex-shrink-0" style={{ backgroundColor: t.who.name === 'System' ? '#E5E7EB' : tone(t.who.id ?? t.who.name) }}>
              {t.who.name === 'System' ? <Sparkles className="w-4 h-4" /> : initialsOf(t.who.name)}
            </span>
            <span className="min-w-0">
              <span className="block text-sm text-[#111111] dark:text-white"><b>{t.who.me ? 'You' : t.who.name}</b> <span className="text-[#6B7280] dark:text-[#A1A1AA]">{t.text}</span></span>
              {t.note && <span className="block mt-0.5 text-xs text-[#6B7280] dark:text-[#A1A1AA] italic line-clamp-2">“{t.note}”</span>}
              <span className="block text-xs text-[#9CA3AF]">{[when(t.at), t.who.me ? null : t.who.role, t.who.company].filter(Boolean).join(' · ')}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function FirstCallCard({ data }) {
  const c = data?.firstCall
  if (!c) return null
  const mine = data.finder?.me
  const dur = c.duration ? `${Math.floor(c.duration / 60)}m ${String(c.duration % 60).padStart(2, '0')}s` : null
  return (
    <section className={`glass-in ${card} p-5`} style={{ '--d': '140ms' }}>
      <p className="text-lg font-bold text-[#111111] dark:text-white">{mine ? 'Your call' : 'The call that found it'}</p>
      <p className="mt-1 text-sm font-semibold text-[#111111] dark:text-white">{[c.outcomeText, format(new Date(c.at), 'd MMM, HH:mm'), dur, mine ? null : c.by].filter(Boolean).join(' · ')}</p>
      {c.notes && <p className="mt-2 text-sm text-[#4B5563] dark:text-[#D4D4D8]">“{c.notes}”</p>}
      {c.readBy.length > 0 && <p className="mt-2 text-xs text-[#9CA3AF]">{mine ? 'Your note was read by' : 'Read by'} {c.readBy.map(firstName).join(', ')}.</p>}
    </section>
  )
}
