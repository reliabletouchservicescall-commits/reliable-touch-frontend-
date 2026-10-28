import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Handshake, Loader2, Lock, Percent } from 'lucide-react'
import { leadsApi } from '../../services/leadsApi'
import { getApiErrorMessage } from './leadShared'
import { DateField } from '../common/DateTimeFields'
import DealDocuments from '../deals/DealDocuments'
import { useAuthStore } from '../../store/authStore'

// The lead's deal, as the Deal Tracker shows it: tenant, rent and fees, payments, occupation,
// desk fees. The company's manager / the agent fill it in; how the commission is split
// varies per deal and only Reliable Touch admin records it (read-only for everyone else).

const PAYMENTS = [
  ['', '—'], ['not_started', 'Not started'], ['awaiting_balance', 'Awaiting balance'], ['tpn_in_progress', 'TPN in progress'],
  ['not_yet_paid', 'Not yet paid'], ['paid', 'Paid'], ['cancelled', 'Cancelled'],
]
const MONEY = [
  ['monthlyRental', 'Monthly rental'], ['procurementFee', 'Procurement fee'], ['adminFee', 'Admin fee'],
  ['dealFee', 'Deal fee'], ['tpnFee', 'TPN fee'], ['ownerPayout', 'Owner payout'],
]
const input = 'w-full px-3 py-2 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] text-[#111111] dark:text-white outline-none focus:ring-2 focus:ring-[#F95C4B]/25 disabled:opacity-60'
const label = 'block text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-1'

function formOf(d = {}) {
  const sp = d.split ?? {}
  return {
    tenantName: d.tenantName ?? '', tenantPhone: d.tenantPhone ?? '',
    ...Object.fromEntries(MONEY.map(([k]) => [k, d[k] ?? ''])),
    clientPayment: d.clientPayment ?? '', landlordPayment: d.landlordPayment ?? '',
    occupationDate: d.occupationDate ? String(d.occupationDate).slice(0, 10) : '',
    managed: d.managed == null ? '' : d.managed ? 'yes' : 'no',
    deskFee: d.deskFee ?? '',
    agentCommissionPaid: d.agentCommissionPaid == null ? '' : d.agentCommissionPaid ? 'yes' : 'no',
    notes: d.notes ?? '',
    split: {
      label: sp.label ?? '', agentPct: sp.agentPct ?? '', agencyPct: sp.agencyPct ?? '', reliablePct: sp.reliablePct ?? '',
      sharedAgentId: sp.sharedAgentId?._id ?? sp.sharedAgentId ?? '', sharedAgentPct: sp.sharedAgentPct ?? '',
    },
  }
}

export default function LeadDealCard({ lead, isAdmin, onSaved }) {
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user?._id)
  const [f, setF] = useState(() => formOf(lead.deal))
  const [dirty, setDirty] = useState(false)
  useEffect(() => { if (!dirty) setF(formOf(lead.deal)) }, [lead.deal]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => { setDirty(true); setF((x) => ({ ...x, [k]: v })) }
  const setSplit = (k, v) => { setDirty(true); setF((x) => ({ ...x, split: { ...x.split, [k]: v } })) }

  const { data: assignees } = useQuery({
    queryKey: ['lead-assignees'],
    queryFn: () => leadsApi.assignees().then((r) => r.data.data),
    staleTime: 60_000,
    enabled: isAdmin,
  })

  const splitTotal = ['agentPct', 'agencyPct', 'reliablePct', 'sharedAgentPct'].reduce((s, k) => s + (Number(f.split[k]) || 0), 0)
  const yn = (v) => (v === '' ? null : v === 'yes')
  const mut = useMutation({
    mutationFn: () => leadsApi.updateDeal(lead._id, {
      tenantName: f.tenantName, tenantPhone: f.tenantPhone,
      ...Object.fromEntries(MONEY.map(([k]) => [k, f[k] === '' ? null : f[k]])),
      clientPayment: f.clientPayment || null, landlordPayment: f.landlordPayment || null,
      occupationDate: f.occupationDate || null, managed: yn(f.managed), deskFee: f.deskFee || null,
      agentCommissionPaid: yn(f.agentCommissionPaid), notes: f.notes,
      ...(isAdmin ? { split: { ...f.split, sharedAgentId: f.split.sharedAgentId || null } } : {}),
    }),
    onSuccess: (res) => {
      toast.success('Deal saved')
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['deal-tracker'] })
      qc.invalidateQueries({ queryKey: ['lead-history', lead._id] })
      onSaved?.(res.data.data.lead)
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not save the deal')),
  })

  const fee = Number(f.procurementFee) || 0
  const share = (pct) => (fee && pct !== '' ? `R${Math.round((fee * Number(pct)) / 100).toLocaleString('en-ZA')}` : null)
  const sp = lead.deal?.split ?? {}

  return (
    <div className="rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#E5E7EB] dark:border-[#2A2A2A] bg-[#FAFAF9] dark:bg-[#111111]">
        <span className="w-7 h-7 rounded-lg bg-[#F95C4B]/10 flex items-center justify-center"><Handshake className="w-4 h-4 text-[#F95C4B]" /></span>
        <div className="flex-1">
          <p className="text-sm font-bold text-[#111111] dark:text-white">Deal</p>
          <p className="text-[10px] text-[#9CA3AF]">Shows on the Deal Tracker{lead.deal?.updatedAt ? ` · last saved ${new Date(lead.deal.updatedAt).toLocaleDateString('en-ZA')}` : ''}</p>
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate() }} className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>Tenant / buyer</label><input value={f.tenantName} onChange={(e) => set('tenantName', e.target.value)} className={input} /></div>
          <div><label className={label}>Tenant phone</label><input value={f.tenantPhone} onChange={(e) => set('tenantPhone', e.target.value)} className={input} /></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {MONEY.map(([k, l]) => (
            <div key={k}><label className={label}>{l} (R)</label><input type="number" min="0" step="0.01" value={f[k]} onChange={(e) => set(k, e.target.value)} className={input} /></div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[['clientPayment', 'Client payment'], ['landlordPayment', 'Landlord payment']].map(([k, l]) => (
            <div key={k}><label className={label}>{l}</label>
              <select value={f[k]} onChange={(e) => set(k, e.target.value)} className={input}>{PAYMENTS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><label className={label}>Occupation</label><DateField value={f.occupationDate} onChange={(v) => set('occupationDate', v)} allowPast className={input} /></div>
          <div><label className={label}>Managed by company</label>
            <select value={f.managed} onChange={(e) => set('managed', e.target.value)} className={input}><option value="">—</option><option value="yes">Yes</option><option value="no">No</option></select></div>
          <div><label className={label}>Desk fees</label>
            <select value={f.deskFee} onChange={(e) => set('deskFee', e.target.value)} className={input}><option value="">—</option><option value="not_owing">Not owing</option><option value="owing">Owing</option><option value="deducted">Deducted</option></select></div>
          <div><label className={label}>Agent commission paid</label>
            <select value={f.agentCommissionPaid} onChange={(e) => set('agentCommissionPaid', e.target.value)} className={input}><option value="">—</option><option value="yes">Paid</option><option value="no">Pending</option></select></div>
        </div>
        <div><label className={label}>Deal notes</label><textarea rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} className={`${input} resize-none`} /></div>

        {/* Split — admin only */}
        <div className="rounded-xl border border-dashed border-[#E5E7EB] dark:border-[#2A2A2A] p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[#111111] dark:text-white mb-2">
            <Percent className="w-3.5 h-3.5 text-[#F95C4B]" /> Commission split
            {!isAdmin && <span className="ml-auto flex items-center gap-1 text-[10px] font-normal text-[#9CA3AF]"><Lock className="w-3 h-3" /> Set by Reliable Touch admin</span>}
          </p>
          {isAdmin ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="col-span-2 sm:col-span-4"><label className={label}>Name (optional)</label><input value={f.split.label} onChange={(e) => setSplit('label', e.target.value)} placeholder="e.g. Standard 80/20, Shared 50/50" className={input} /></div>
                {[['agentPct', 'Agent %'], ['agencyPct', 'Company %'], ['reliablePct', 'Reliable Touch %'], ['sharedAgentPct', 'Shared agent %']].map(([k, l]) => (
                  <div key={k}><label className={label}>{l}</label><input type="number" min="0" max="100" step="0.5" value={f.split[k]} onChange={(e) => setSplit(k, e.target.value)} className={input} />
                    {share(f.split[k]) && <p className="mt-0.5 text-[10px] text-[#9CA3AF]">{share(f.split[k])}</p>}</div>
                ))}
                <div className="col-span-2 sm:col-span-4"><label className={label}>Shared with agent</label>
                  <select value={f.split.sharedAgentId} onChange={(e) => setSplit('sharedAgentId', e.target.value)} className={input}>
                    <option value="">Nobody</option>
                    {(assignees?.agents ?? []).map((a) => <option key={a._id} value={a._id}>{a.firstName} {a.lastName}</option>)}
                  </select>
                </div>
              </div>
              <p className={`mt-2 text-[11px] ${splitTotal > 100 ? 'text-[#EF4444] font-semibold' : 'text-[#9CA3AF]'}`}>Adds up to {splitTotal}%{splitTotal > 100 ? ' — it can’t be more than 100%' : ''}</p>
            </>
          ) : (
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
              {[sp.label, sp.agentPct != null && `Agent ${sp.agentPct}%`, sp.sharedAgentPct != null && `Shared ${sp.sharedAgentPct}%`, sp.agencyPct != null && `Company ${sp.agencyPct}%`, sp.reliablePct != null && `Reliable Touch ${sp.reliablePct}%`].filter(Boolean).join(' · ') || 'Not recorded yet'}
            </p>
          )}
        </div>

        <button type="submit" disabled={!dirty || mut.isPending || splitTotal > 100}
          className="mac-press w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-50 flex items-center justify-center gap-2">
          {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Save deal
        </button>
      </form>

      {/* Paperwork — tenant ID, payslips, lease, commission… (Firebase) */}
      <div className="border-t border-[#E5E7EB] dark:border-[#2A2A2A] p-4">
        <p className="text-sm font-bold text-[#111111] dark:text-white mb-3">Documents</p>
        <DealDocuments
          leadId={lead._id}
          listingType={lead.listingType}
          documents={lead.deal?.documents ?? []}
          canUpload
          isAdmin={isAdmin}
          currentUserId={me}
          onChange={(documents) => onSaved?.({ ...lead, deal: { ...(lead.deal ?? {}), documents } })}
        />
      </div>
    </div>
  )
}
