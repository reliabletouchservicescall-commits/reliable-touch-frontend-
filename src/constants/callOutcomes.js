import { PhoneMissed, PhoneOff, Voicemail, Clock, CheckCircle2, ThumbsDown, AlertCircle, PhoneCall } from 'lucide-react'

// Matches the outcome palette used everywhere a call outcome is logged/shown
// (cold-caller's MyContactsPage / CallLogsPage, admin's CallLogsPage, ContactCallHistory).
export const CALL_OUTCOME_META = {
  no_answer:          { label: 'No Answer',          icon: PhoneMissed,  color: '#6B7280' },
  voicemail:          { label: 'Voicemail',          icon: Voicemail,    color: '#6B7280' },
  callback_requested: { label: 'Callback Requested', icon: Clock,        color: '#F59E0B' },
  interested:         { label: 'Interested',         icon: CheckCircle2, color: '#10B981' },
  not_interested:     { label: 'Not Interested',     icon: ThumbsDown,   color: '#F97316' },
  wrong_number:       { label: 'Wrong Number',       icon: AlertCircle,  color: '#8B5CF6' },
  remove_me:          { label: 'Remove Me (DNC)',    icon: PhoneOff,     color: '#EF4444' },
}

export const DEFAULT_OUTCOME_META = { label: 'Unknown', icon: PhoneCall, color: '#6B7280' }

// Outcomes that mean a contact was attempted but never reached — matches the backend's
// UNREACHABLE_OUTCOMES constant, used to power the "Unreachable" filter pill so nothing
// tried-but-not-reached silently falls through the cracks.
export const UNREACHABLE_OUTCOMES = ['no_answer', 'wrong_number', 'voicemail']
