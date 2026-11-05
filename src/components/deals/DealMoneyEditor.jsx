import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Check, Loader2, Wallet, PieChart, CalendarDays, CircleDollarSign, RotateCcw, Lock } from 'lucide-react'
import axiosClient from '../../lib/axios'
import { DateField } from '../common/DateTimeFields'
import { getApiErrorMessage } from '../leads/leadShared'

// A deal's money in one place, in plain words: who has paid, the amounts, how the commission
// is shared and the dates. Reliable Touch admin and follow-up managers and the company's
// managers fill it in (PATCH /leads/:id/deal); everyone else sees it read-only. Opened from a
// Deal Tracker cell, the field that was tapped is highlighted.

export const PAY = {
  paid: ['Paid', '#00C875'],
  awaiting_balance: ['Awaiting balance', '#A25DDC'],
  tpn_in_progress: ['TPN in progress', '#FDAB3D'],
  not_yet_paid: ['Not yet paid', '#E2445C'],
  not_started: ['Not started', '#9CA3AF'],
  cancelled: ['Cancelled', '#6B7280'],
}
export const DESK = { not_owing: ['Not owing', '#9CA3AF'], owing: ['Owing', '#FDAB3D'], deducted: ['Deducted', '#00C875'] }
const PAID = { yes: ['Paid', '#00C875'], no: ['Not yet', '#FDAB3D'] }

const MONEY = [
  ['monthlyRental', 'Monthly rental', 'What the tenant pays each month'],
  ['procurementFee', 'Procurement fee', 'The commission the deal earns — shared below'],
  ['adminFee', 'Admin fee', null],
  ['dealFee', 'Deal fee', null],
  ['tpnFee', 'TPN', 'Tenant screening'],
  ['ownerPayout', 'Owner payout', 'Paid over to the landlord'],
]
const SPLIT_PRESETS = [['50/50', 50, 50], ['60/40', 60, 40], ['70/30', 70, 30], ['80/20', 80, 20]]

// Which part of the editor a Deal Tracker column belongs to
export const FIELD_OF = {
  client: 'clientPayment', landlordPay: 'landlordPayment', commission: 'agentCommissionPaid', desk: 'deskFee',
  split: 'split', agentShare: 'split', sharedAgentShare: 'split', agencyShare: 'split', reliableShare: 'split',
  monthlyRental: 'monthlyRental', procurementFee: 'procurementFee', adminFee: 'adminFee', dealFee: 'dealFee', tpnFee: 'tpnFee',
  ownerPayout: 'ownerPayout', agencyRevenue: 'procurementFee', totalRevenue: 'procurementFee', occupation: 'occupationDate', leaseEnd: 'leaseEndDate',
}

const R = (v) => (v == null || v === '' ? '—' : `R${Number(v).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`)
const ymd = (d) => (d ? format(new Date(d), 'yyyy-MM-dd') : '')
const numStr = (v) => (v == null ? '' : String(v))

function initial(row) {
  const d = row.deal, sp = d.split ?? {}
  return {
    clientPayment: d.clientPayment ?? '', landlordPayment: d.landlordPayment ?? '',
    agentCommissionPaid: d.agentCommissionPaid == null ? '' : d.agentCommissionPaid ? 'yes' : 'no',
    deskFee: d.deskFee ?? '',
    ...Object.fromEntries(MONEY.map(([k]) => [k, numStr(row.money[k] ?? null)])),
    // The money line falls back to a visit's figures; only what's on the deal is "set"
    split: { label: sp.label ?? '', agentPct: numStr(sp.agentPct), agencyPct: numStr(sp.agencyPct), reliablePct: numStr(sp.reliablePct), sharedAgentId: sp.sharedAgentId ?? '', sharedAgentPct: numStr(sp.sharedAgentPct) },
    occupationDate: ymd(d.occupationDate), leaseEndDate: ymd(row.lease?.end),
  }
}

function Group({ icon: Icon, title, sub, children }) {
  return (
    <section className="rounded-2xl border border-[#E5E7EB] p-4 dark:border-[#2A2A2A]">
      <p className="flex items-center gap-2 text-sm font-bold text-[#111111] dark:text-white"><Icon className="h-4 w-4 text-[#F95C4B]" /> {title}</p>
      {sub && <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[#A1A1AA]">{sub}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

// One labelled field; the one that was tapped in the table glows
function Field({ id, label, hint, hot, children }) {
  const ref = useRef(null)
  useEffect(() => { if (hot) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, [hot])
  return (
    <div ref={ref} data-field={id} className={`rounded-xl p-2 -m-2 transition-shadow ${hot ? 'ring-2 ring-[#F95C4B] bg-[#F95C4B]/[0.05]' : ''}`}>
      <p className="mb-1.5 text-xs font-semibold text-[#111111] dark:text-white">{label}{hint && <span className="font-normal text-[#9CA3AF]"> · {hint}</span>}</p>
      {children}
    </div>
  )
}

function Choice({ value, onChange, map, disabled }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(map).map(([k, [label, color]]) => {
        const on = value === k
        return (
          <button key={k} type="button" disabled={disabled} onClick={() => onChange(on ? '' : k)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-default ${on ? 'text-white' : 'bg-white text-[#3F3F46] ring-1 ring-[#E5E7EB] hover:ring-[#9CA3AF] dark:bg-[#202020] dark:text-[#D4D4D8] dark:ring-[#2A2A2A]'}`}
            style={on ? { backgroundColor: color } : undefined}>
            {!on && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />} {label}
          </button>
        )
      })}
    </div>
  )
}

const input = 'w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#F95C4B] disabled:bg-[#FAFAF9] dark:border-[#2A2A2A] dark:bg-[#141414] dark:text-white dark:disabled:bg-[#181818]'

function Money({ value, onChange, disabled }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#9CA3AF]">R</span>
      <input value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" disabled={disabled} placeholder="0" className={`${input} pl-7 tabular-nums`} />
    </div>
  )
}

function Pct({ value, onChange, disabled }) {
  return (
    <div className="relative">
      <input value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" disabled={disabled} placeholder="0" className={`${input} pr-7 tabular-nums`} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#9CA3AF]">%</span>
    </div>
  )
}

export default function DealMoneyEditor({ row, canEdit, agents = [], focus, hide = [] }) {
  const qc = useQueryClient()
  const start = useMemo(() => initial(row), [row])
  const [v, setV] = useState(start)
  useEffect(() => setV(start), [start])
  const set = (k) => (x) => setV((s) => ({ ...s, [k]: x }))
  const setSplit = (k) => (x) => setV((s) => ({ ...s, split: { ...s.split, [k]: x } }))
  const hot = FIELD_OF[focus] ?? null
  const ro = !canEdit

  // Live shares from the fee and the percentages
  const fee = Number(v.procurementFee) || 0
  const parts = [
    ['Agent', 'agentPct', '#F95C4B'],
    [agents.find((a) => a.id === v.split.sharedAgentId)?.name ?? 'Shared agent', 'sharedAgentPct', '#A25DDC'],
    ['Company', 'agencyPct', '#579BFC'],
    ['Reliable Touch', 'reliablePct', '#00C875'],
  ].filter(([, k]) => !(hide.includes('agencyShare') && k === 'agencyPct') && !(hide.includes('reliableShare') && k === 'reliablePct'))
  const pctTotal = parts.reduce((s, [, k]) => s + (Number(v.split[k]) || 0), 0)

  const changed = useMemo(() => {
    const out = {}
    for (const k of ['clientPayment', 'landlordPayment', 'deskFee', 'occupationDate', 'leaseEndDate', ...MONEY.map(([m]) => m)]) if (v[k] !== start[k]) out[k] = v[k] || null
    if (v.agentCommissionPaid !== start.agentCommissionPaid) out.agentCommissionPaid = v.agentCommissionPaid === '' ? null : v.agentCommissionPaid === 'yes'
    if (JSON.stringify(v.split) !== JSON.stringify(start.split)) out.split = { ...v.split, sharedAgentId: v.split.sharedAgentId || null }
    return out
  }, [v, start])
  const dirty = Object.keys(changed).length > 0

  const save = useMutation({
    mutationFn: () => axiosClient.patch(`/leads/${row.id}/deal`, changed),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deal-tracker'] }); toast.success('Deal saved') },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not save the deal')),
  })

  return (
    <div className="space-y-4">
      {ro && <p className="flex items-center gap-2 rounded-xl bg-[#FAFAF9] px-3 py-2 text-xs text-[#6B7280] dark:bg-[#141414] dark:text-[#A1A1AA]"><Lock className="h-3.5 w-3.5" /> Your manager or Reliable Touch fills these in.</p>}

      <Group icon={Wallet} title="Who has paid" sub="Tap the one that’s true now">
        <Field id="clientPayment" label="Client (tenant / buyer)" hot={hot === 'clientPayment'}><Choice value={v.clientPayment} onChange={set('clientPayment')} map={PAY} disabled={ro} /></Field>
        <Field id="landlordPayment" label="Landlord" hot={hot === 'landlordPayment'}><Choice value={v.landlordPayment} onChange={set('landlordPayment')} map={PAY} disabled={ro} /></Field>
        {!hide.includes('commission') && <Field id="agentCommissionPaid" label="Agent’s commission" hot={hot === 'agentCommissionPaid'}><Choice value={v.agentCommissionPaid} onChange={set('agentCommissionPaid')} map={PAID} disabled={ro} /></Field>}
        {!hide.includes('desk') && <Field id="deskFee" label="Desk fees" hot={hot === 'deskFee'}><Choice value={v.deskFee} onChange={set('deskFee')} map={DESK} disabled={ro} /></Field>}
      </Group>

      <Group icon={CircleDollarSign} title="The money" sub="In rand">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MONEY.filter(([k]) => !hide.includes(k)).map(([k, label, hint]) => (
            <Field key={k} id={k} label={label} hint={hint} hot={hot === k}><Money value={v[k]} onChange={set(k)} disabled={ro} /></Field>
          ))}
        </div>
      </Group>

      {!hide.includes('split') && (
        <Group icon={PieChart} title="Commission split" sub={fee ? `How the ${R(fee)} procurement fee is shared` : 'Add the procurement fee above to see the rand amounts'}>
          <Field id="split" label="Quick pick" hint="agent / company" hot={hot === 'split'}>
            <div className="flex flex-wrap gap-1.5">
              {SPLIT_PRESETS.map(([l, a, c]) => (
                <button key={l} type="button" disabled={ro} onClick={() => setV((s) => ({ ...s, split: { ...s.split, label: l, agentPct: String(a), agencyPct: String(c), sharedAgentPct: '', sharedAgentId: '', reliablePct: '' } }))}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition-colors ${v.split.label === l ? 'bg-[#F95C4B] text-white ring-[#F95C4B]' : 'bg-white text-[#111111] ring-[#E5E7EB] hover:ring-[#F95C4B]/50 dark:bg-[#202020] dark:text-white dark:ring-[#2A2A2A]'}`}>{l}</button>
              ))}
              <input value={v.split.label} onChange={(e) => setSplit('label')(e.target.value)} disabled={ro} maxLength={60} placeholder="Name it (optional)" className={`${input} !w-40 !py-1.5 text-xs`} />
            </div>
          </Field>
          <div className="space-y-2">
            {parts.map(([label, k, color]) => (
              <div key={k} className="grid grid-cols-[1fr_96px_96px] items-center gap-2">
                {k === 'sharedAgentPct' ? (
                  <select value={v.split.sharedAgentId} onChange={(e) => setSplit('sharedAgentId')(e.target.value)} disabled={ro} className={`${input} !py-2`}>
                    <option value="">Shared agent — nobody</option>
                    {agents.filter((a) => a.id !== row.agent?.id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                ) : (
                  <span className="flex items-center gap-2 text-sm font-semibold text-[#111111] dark:text-white"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />{label}{k === 'agentPct' && row.agent ? <span className="truncate font-normal text-[#9CA3AF]">· {row.agent.name}</span> : null}</span>
                )}
                <Pct value={v.split[k]} onChange={setSplit(k)} disabled={ro || (k === 'sharedAgentPct' && !v.split.sharedAgentId)} />
                <span className="text-right text-sm font-bold tabular-nums text-[#111111] dark:text-white">{fee && v.split[k] ? R((fee * Number(v.split[k])) / 100) : '—'}</span>
              </div>
            ))}
          </div>
          {pctTotal > 0 && (
            <>
              <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-[#F5F5F4] dark:bg-[#202020]">
                {parts.map(([, k, color]) => Number(v.split[k]) > 0 && <span key={k} className="h-full transition-all" style={{ width: `${Math.min(100, Number(v.split[k]))}%`, backgroundColor: color }} />)}
              </div>
              <p className={`text-xs font-semibold ${pctTotal > 100 ? 'text-[#EF4444]' : pctTotal === 100 ? 'text-[#059669] dark:text-[#34D399]' : 'text-[#B45309]'}`}>
                {pctTotal > 100 ? `Adds up to ${pctTotal}% — take ${pctTotal - 100}% off` : pctTotal === 100 ? 'Adds up to 100% ✓' : `Adds up to ${pctTotal}% — ${100 - pctTotal}% not shared yet`}
              </p>
            </>
          )}
        </Group>
      )}

      <Group icon={CalendarDays} title="Dates">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="occupationDate" label="Occupation" hint="moving-in day" hot={hot === 'occupationDate'}>
            {ro ? <p className={input}>{v.occupationDate ? format(new Date(v.occupationDate), 'd MMM yyyy') : '—'}</p> : <DateField value={v.occupationDate} onChange={set('occupationDate')} allowPast className={input} />}
          </Field>
          <Field id="leaseEndDate" label="Lease ends" hot={hot === 'leaseEndDate'}>
            {ro ? <p className={input}>{v.leaseEndDate ? format(new Date(v.leaseEndDate), 'd MMM yyyy') : '—'}</p> : <DateField value={v.leaseEndDate} onChange={set('leaseEndDate')} allowPast className={input} />}
          </Field>
        </div>
      </Group>

      {canEdit && (
        <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-[#E5E7EB] bg-white/95 px-5 py-3 backdrop-blur dark:border-[#2A2A2A] dark:bg-[#181818]/95">
          <button type="button" onClick={() => setV(start)} disabled={!dirty || save.isPending}
            className="flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] px-4 py-2.5 text-sm font-semibold text-[#6B7280] hover:bg-[#F5F5F4] disabled:opacity-40 dark:border-[#2A2A2A] dark:text-[#A1A1AA] dark:hover:bg-[#202020]">
            <RotateCcw className="h-4 w-4" /> Undo
          </button>
          <button type="button" onClick={() => save.mutate()} disabled={!dirty || save.isPending || pctTotal > 100}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#F95C4B] py-2.5 text-sm font-semibold text-white hover:bg-[#E84B3A] disabled:opacity-40">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {dirty ? `Save ${Object.keys(changed).length} change${Object.keys(changed).length === 1 ? '' : 's'}` : 'Saved'}
          </button>
        </div>
      )}
    </div>
  )
}
