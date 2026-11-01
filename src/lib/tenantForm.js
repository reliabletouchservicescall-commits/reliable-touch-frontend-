// What a tenant application asks for — same keys as the backend's
// modules/tenants/tenantForm.js (keep the two in step). Drives the tenant's page and the
// team's review screen.

export const STEPS = {
  individual: ['Welcome', 'Applying as', 'About you', 'Where you live now', 'Work & income', 'Documents', 'Review & sign', 'Submitted'],
  company: ['Welcome', 'Applying as', 'Company details', 'Director & occupant', 'Current premises', 'Documents', 'Review & sign', 'Submitted'],
}

const LEASE = ['12 months', '24 months', '6 months']
const currentPlace = (company) => [
  { key: 'cunit', label: 'Unit or flat number', hint: 'Leave blank for a free-standing house.' },
  { key: 'caddr', label: 'Full street address', required: true, area: true, ph: 'Complex name, street number and name, suburb, city, postal code' },
  { key: 'cstatus', label: company ? 'Premises are' : 'You are', required: true, opts: company ? ['Renting', 'Owned', 'Shared office'] : ['Renting', 'Living with family', 'Own home'], half: true },
  { key: 'csince', label: 'There since', required: true, ph: 'e.g. March 2023', half: true },
  { key: 'crent', label: 'Current monthly rent (R)', required: true, num: true, when: (f) => f.cstatus === 'Renting' },
  { key: 'clname', label: 'Landlord or agency name', required: true, when: (f) => f.cstatus === 'Renting', group: 'Your current landlord or agent' },
  { key: 'clphone', label: 'Their phone', required: true, type: 'tel', half: true, when: (f) => f.cstatus === 'Renting' },
  { key: 'clemail', label: 'Their email', type: 'email', half: true, when: (f) => f.cstatus === 'Renting' },
  { key: 'why', label: company ? 'Why do you need this unit?' : 'Why are you moving?', required: true },
]

// Fields per step, per applicant type
export const FIELDS = {
  individual: {
    2: [
      { key: 'name', label: 'Full name as on your ID', required: true, ac: 'name' },
      { key: 'idno', label: 'ID or passport number', required: true },
      { key: 'phone', label: 'Mobile', required: true, type: 'tel', ac: 'tel', half: true },
      { key: 'email', label: 'Email', required: true, type: 'email', ac: 'email', half: true, hint: 'We send your updates here.' },
      { key: 'occ', label: 'Who will live there?', required: true, opts: ['1 adult', '2 adults', '2 adults, 1 child', '2 adults, 2+ children', 'Other'], half: true },
      { key: 'pets', label: 'Pets', required: true, opts: ['No pets', '1 cat', '1 small dog', 'Other'], half: true },
      { key: 'move', label: 'Move-in date', required: true, type: 'date', half: true },
      { key: 'term', label: 'Lease length', required: true, opts: LEASE, half: true },
      { key: 'kin', label: 'Emergency contact', required: true, half: true },
      { key: 'kinphone', label: 'Their number', required: true, type: 'tel', half: true },
    ],
    3: currentPlace(false),
    4: [
      { key: 'emp', label: 'Employer', required: true, hint: 'Self-employed? Write your business name.' },
      { key: 'role', label: 'Job title', required: true, half: true },
      { key: 'esince', label: 'Working there since', required: true, ph: 'e.g. 2021', half: true },
      { key: 'gross', label: 'Gross monthly income (R)', required: true, num: true, hint: 'Before deductions', half: true },
      { key: 'net', label: 'Net monthly income (R)', required: true, num: true, hint: 'What you take home', half: true },
      { key: 'hr', label: 'HR or manager contact number', type: 'tel', hint: 'Only used to confirm you work there.' },
    ],
  },
  company: {
    2: [
      { key: 'coname', label: 'Registered company name', required: true },
      { key: 'coreg', label: 'CIPC registration number', required: true, ph: 'e.g. 2018/123456/07' },
      { key: 'covat', label: 'VAT number' },
      { key: 'coind', label: 'What does the company do?', required: true },
      { key: 'coyears', label: 'Years trading', required: true, num: true, half: true },
      { key: 'turnover', label: 'Average monthly turnover (R)', num: true, half: true, hint: 'A rough figure helps.' },
    ],
    3: [
      { key: 'dname', label: 'Director or signatory full name', required: true },
      { key: 'did', label: 'Their ID number', required: true },
      { key: 'dphone', label: 'Mobile', required: true, type: 'tel', half: true },
      { key: 'demail', label: 'Email', required: true, type: 'email', half: true },
      { key: 'occupant', label: 'Who will live in the unit?', required: true, hint: 'Name of the employee or person who will stay there.' },
      { key: 'move', label: 'Move-in date', required: true, type: 'date', half: true },
      { key: 'term', label: 'Lease length', required: true, opts: LEASE, half: true },
    ],
    4: currentPlace(true),
  },
}

export const typeOf = (t) => (t === 'company' ? 'company' : 'individual')

export function fieldsOn(type, step, form = {}) {
  return (FIELDS[typeOf(type)][step] ?? []).filter((f) => !f.when || f.when(form))
}

export function allFields(type, form = {}) {
  return [2, 3, 4].flatMap((s) => fieldsOn(type, s, form).map((f) => ({ ...f, step: s })))
}

export const fieldLabel = (type, key) => [2, 3, 4].flatMap((s) => FIELDS[typeOf(type)][s]).find((f) => f.key === key)?.label ?? key

// Statuses as the team sees them
export const APP_STATUS = {
  invited: { label: 'Link not opened', tone: '#9CA3AF' },
  opened: { label: 'Opened', tone: '#3B82F6' },
  in_progress: { label: 'Filling in', tone: '#F59E0B' },
  submitted: { label: 'Submitted', tone: '#8B5CF6' },
  changes_requested: { label: 'Fixes asked', tone: '#EF4444' },
  approved: { label: 'Approved', tone: '#10B981' },
  declined: { label: 'Declined', tone: '#6B7280' },
  withdrawn: { label: 'Withdrawn', tone: '#6B7280' },
}

export const R = (n) => {
  const v = Number(String(n ?? '').replace(/[^\d.]/g, ''))
  return v ? `R${Math.round(v).toLocaleString('en-ZA').replace(/,/g, ' ')}` : '—'
}
