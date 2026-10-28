// The paperwork a deal needs, stage by stage — same list as the backend's
// modules/deals/dealDocs.js (keep the two in step). `key: true` = can't close without it;
// `only` = rentals or sales only.
export const DEAL_DOC_STAGES = [
  {
    key: 'tenant', label: 'Tenant vetting', short: 'Tenant', color: '#3B82F6',
    docs: [
      { type: 'tenant_id', label: 'Tenant ID / passport', key: true },
      { type: 'payslips', label: 'Payslips (last 3 months)', key: true },
      { type: 'bank_statements', label: 'Bank statements (3 months)', key: true },
      { type: 'credit_check', label: 'TPN / credit check report', key: true },
      { type: 'employment_letter', label: 'Employment letter' },
      { type: 'proof_of_address', label: 'Proof of address' },
      { type: 'application_form', label: 'Rental application form', only: 'rental' },
    ],
  },
  {
    key: 'landlord', label: 'Landlord & mandate', short: 'Landlord', color: '#8B5CF6',
    docs: [
      { type: 'owner_id', label: "Owner's ID", key: true },
      { type: 'mandate', label: 'Signed mandate', key: true },
      { type: 'title_deed', label: 'Title deed / proof of ownership' },
      { type: 'rates_bill', label: 'Municipal rates bill' },
      { type: 'owner_bank', label: "Owner's bank confirmation" },
    ],
  },
  {
    key: 'lease', label: 'Lease / sale agreement', short: 'Lease', color: '#10B981',
    docs: [
      { type: 'lease_agreement', label: 'Signed lease agreement', key: true, only: 'rental' },
      { type: 'offer_to_purchase', label: 'Signed offer to purchase', key: true, only: 'sale' },
      { type: 'deposit_pop', label: 'Deposit proof of payment', key: true },
      { type: 'inspection', label: 'Ingoing inspection report' },
      { type: 'keys_handover', label: 'Keys handover form' },
    ],
  },
  {
    key: 'payments', label: 'Payments', short: 'Payments', color: '#F59E0B',
    docs: [
      { type: 'client_pop', label: 'Client proof of payment', key: true },
      { type: 'invoice', label: 'Invoice to client' },
      { type: 'landlord_pop', label: 'Landlord payout proof' },
    ],
  },
  {
    key: 'commission', label: 'Commission', short: 'Commission', color: '#F95C4B',
    docs: [
      { type: 'commission_invoice', label: 'Commission invoice', key: true },
      { type: 'commission_pop', label: 'Commission proof of payment', key: true },
      { type: 'split_statement', label: 'Commission split statement' },
    ],
  },
  { key: 'other', label: 'Other', short: 'Other', color: '#9CA3AF', docs: [{ type: 'other', label: 'Other document' }] },
]

export const DOC_LABEL = Object.fromEntries(DEAL_DOC_STAGES.flatMap((s) => s.docs.map((d) => [d.type, d.label])))
export const docsFor = (stage, listingType) => stage.docs.filter((d) => !d.only || !listingType || d.only === listingType)

// Same numbers as the backend's docSummary(): key documents in, per stage and in all
export function docProgress(documents = [], listingType = null) {
  const have = new Set(documents.map((d) => d.type))
  const byStage = Object.fromEntries(DEAL_DOC_STAGES.map((s) => {
    const need = docsFor(s, listingType).filter((d) => d.key)
    return [s.key, { files: documents.filter((d) => d.stage === s.key).length, key: need.length, keyDone: need.filter((d) => have.has(d.type)).length }]
  }))
  const key = Object.values(byStage).reduce((n, s) => n + s.key, 0)
  const keyDone = Object.values(byStage).reduce((n, s) => n + s.keyDone, 0)
  return { files: documents.length, key, keyDone, byStage }
}
