export const ROLES = ['admin', 'cold_caller', 'agency']

export const CALL_OUTCOMES = ['no_answer', 'wrong_number', 'remove_me', 'interested', 'callback_requested']

export const LEAD_STATUS = ['cold', 'warm', 'hot', 'converted', 'lost']

export const APPOINTMENT_STATUS = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']

export const VISIT_OUTCOMES = [
  'appointment_completed', 'listing_signed', 'still_negotiating',
  'follow_up_required', 'property_still_available', 'rented_out', 'sold',
]

export const DISPOSITION = [
  'rented_by_me', 'rented_by_another_agent', 'rented_by_another_agency',
  'owner_rented_privately', 'listing_cancelled',
]

export const LEASE_PERIOD = ['6_months', '12_months', 'other']

export const COMMISSION_STATUS = ['pending', 'invoiced', 'paid', 'overdue']

export const ROLE_LABELS = {
  admin: 'Administrator',
  cold_caller: 'Cold Caller',
  agency: 'Agency',
}

export const ROLE_HOME = {
  admin: '/admin',
  cold_caller: '/cold-caller',
  agency: '/agency',
}
