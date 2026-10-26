import { useEffect, useMemo, useRef, useState } from 'react'
import { format, isToday } from 'date-fns'
import {
  PhoneCall, Sparkles, MessagesSquare, Flame, UserCheck, CalendarCheck, Home, KeyRound, Wallet, BadgePercent,
  Bell, MessageSquare, GitBranch, Trophy, XCircle, Minus, Plus, Maximize2, Check, Clock, Ban, X, TrendingUp, TrendingDown,
} from 'lucide-react'

// One deal as a node workflow (n8n / Wati style): every step is a card on a dotted canvas,
// joined by arrows — solid and flowing where it really happened, dashed where it was
// skipped. Notifications and messages hang under the step they happened in. For a deal
// that's still open the flow ends in a decision node — "Will it close?" — that branches
// into how it closes (the remaining steps with their expected dates and value) and how it
// falls through, each with its chance. Click any node to inspect it. Read-only.

const STEP_ICON = {
  call: PhoneCall, lead: Sparkles, follow: MessagesSquare, hot: Flame, agent: UserCheck, appt: CalendarCheck,
  listed: Home, closed: KeyRound, lease: CalendarCheck, paid: Wallet, commission: BadgePercent,
}
const STEP_COLOR = {
  call: '#3B82F6', lead: '#F59E0B', follow: '#8B5CF6', hot: '#EF4444', agent: '#10B981', appt: '#0EA5E9',
  listed: '#8B5CF6', closed: '#F95C4B', lease: '#14B8A6', paid: '#22C55E', commission: '#F95C4B',
}
const R = (v) => (v == null ? null : `R${Number(v).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`)
const when = (d) => (d ? (isToday(new Date(d)) ? format(new Date(d), 'HH:mm') : format(new Date(d), 'd MMM yyyy')) : null)

const W = 216, H = 84, GX = 76, TOP = 230, BRANCH = 150, PAD = 48

/* ─── Layout ────────────────────────────────────────────────────────────── */

function layout(row) {
  const steps = row.journey
  let last = -1
  steps.forEach((s, i) => { if (s.state === 'done' || s.state === 'current') last = i })
  const won = ['rented_out', 'sold'].includes(row.status)
  const open = !won && row.prediction
  const nodes = []
  const edges = []
  const x = (i) => PAD + i * (W + GX)

  // What happened (and was skipped) up to the furthest step reached
  const reached = steps.slice(0, last + 1)
  reached.forEach((s, i) => nodes.push({ id: s.key, kind: s.state === 'skipped' ? 'skipped' : s.state === 'current' ? 'current' : 'done', step: s, x: x(i), y: TOP }))
  for (let i = 1; i < reached.length; i++) {
    const a = reached[i - 1], b = reached[i]
    edges.push({ from: a.key, to: b.key, kind: b.state === 'skipped' || a.state === 'skipped' ? 'skipped' : 'done' })
  }
  const rest = steps.slice(last + 1)
  const lastId = reached[reached.length - 1]?.key

  if (open) {
    // Decision, then two branches
    const dx = x(reached.length)
    nodes.push({ id: 'decide', kind: 'decision', x: dx, y: TOP })
    if (lastId) edges.push({ from: lastId, to: 'decide', kind: 'done' })
    const p = row.prediction.probability
    rest.forEach((s, i) => nodes.push({ id: s.key, kind: 'predicted', step: s, x: x(reached.length + 1 + i), y: TOP - BRANCH }))
    nodes.push({ id: 'win', kind: 'win', x: x(reached.length + 1 + rest.length), y: TOP - BRANCH })
    if (rest[0]) edges.push({ from: 'decide', to: rest[0].key, kind: 'yes', label: `${p}% closes` })
    for (let i = 1; i < rest.length; i++) edges.push({ from: rest[i - 1].key, to: rest[i].key, kind: 'yes' })
    edges.push({ from: rest[rest.length - 1]?.key ?? 'decide', to: 'win', kind: 'yes', label: rest.length ? null : `${p}% closes` })
    nodes.push({ id: 'stall', kind: 'stall', x: x(reached.length + 1), y: TOP + BRANCH })
    nodes.push({ id: 'lost', kind: 'lost', x: x(reached.length + 2), y: TOP + BRANCH })
    edges.push({ from: 'decide', to: 'stall', kind: 'no', label: `${100 - p}% doesn’t` })
    edges.push({ from: 'stall', to: 'lost', kind: 'no' })
  } else {
    // Closed — what's left (lease, payments, commission) still to come
    rest.forEach((s, i) => nodes.push({ id: s.key, kind: 'pending', step: s, x: x(reached.length + i), y: TOP }))
    if (lastId && rest[0]) edges.push({ from: lastId, to: rest[0].key, kind: 'pending' })
    for (let i = 1; i < rest.length; i++) edges.push({ from: rest[i - 1].key, to: rest[i].key, kind: 'pending' })
  }

  const width = Math.max(...nodes.map((n) => n.x)) + W + PAD
  const height = TOP + BRANCH + H + 150
  return { nodes, edges, width, height, open }
}

/* ─── Pieces ────────────────────────────────────────────────────────────── */

function edgePath(a, b) {
  const sx = a.x + (a.kind === 'decision' ? 112 : W), sy = a.y + H / 2
  const tx = b.x, ty = b.y + H / 2
  const dx = Math.max(40, (tx - sx) / 2)
  return { d: `M${sx},${sy} C${sx + dx},${sy} ${tx - dx},${ty} ${tx},${ty}`, mx: (sx + tx) / 2, my: (sy + ty) / 2 }
}

const EDGE = {
  done: { stroke: '#F95C4B', dash: null, marker: 'dt-arrow-coral', flow: true },
  skipped: { stroke: '#D4D4D8', dash: '6 6', marker: 'dt-arrow-grey' },
  yes: { stroke: '#10B981', dash: '8 6', marker: 'dt-arrow-green', flow: true },
  no: { stroke: '#EF4444', dash: '8 6', marker: 'dt-arrow-red' },
  pending: { stroke: '#F59E0B', dash: '8 6', marker: 'dt-arrow-amber' },
}

function Edges({ nodes, edges }) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
  return (
    <>
      {edges.map((e, i) => {
        const a = byId[e.from], b = byId[e.to]
        if (!a || !b) return null
        const st = EDGE[e.kind]
        const { d } = edgePath(a, b)
        return (
          <g key={`${e.from}-${e.to}`} className="mac-in" style={{ '--d': `${i * 70}ms` }}>
            <path d={d} fill="none" stroke={st.stroke} strokeOpacity={e.kind === 'skipped' ? 1 : 0.9} strokeWidth="2.5" strokeDasharray={st.dash ?? undefined} markerEnd={`url(#${st.marker})`} />
            {st.flow && <path d={d} fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="2.5" strokeLinecap="round" className="flow-dots" />}
          </g>
        )
      })}
    </>
  )
}

function EdgeLabels({ nodes, edges }) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))
  return edges.filter((e) => e.label).map((e) => {
    const a = byId[e.from], b = byId[e.to]
    if (!a || !b) return null
    const { mx, my } = edgePath(a, b)
    const yes = e.kind === 'yes'
    return (
      <span key={`l-${e.from}-${e.to}`} className="mac-pop absolute -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 rounded-full text-[11px] font-bold shadow-sm border whitespace-nowrap"
        style={{ left: mx, top: my, color: yes ? '#059669' : '#DC2626', backgroundColor: yes ? '#ECFDF5' : '#FEF2F2', borderColor: yes ? '#A7F3D0' : '#FECACA', '--d': '500ms' }}>
        {e.label}
      </span>
    )
  })
}

function StepCard({ n, touches, selected, onSelect }) {
  const s = n.step
  const Icon = STEP_ICON[s.key] ?? Sparkles
  const color = STEP_COLOR[s.key] ?? '#F95C4B'
  const faded = n.kind === 'skipped'
  const future = n.kind === 'predicted' || n.kind === 'pending'
  const status = n.kind === 'done' ? ['Done', '#10B981', Check] : n.kind === 'current' ? ['In progress', '#F59E0B', Clock]
    : faded ? ['Skipped', '#9CA3AF', Ban] : ['Expected', '#F59E0B', Clock]
  const StatusIcon = status[2]
  return (
    <button type="button" onClick={() => onSelect(n.id)}
      className={`absolute text-left rounded-2xl border bg-white dark:bg-[#1A1A1A] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl focus:outline-none ${
        selected ? 'ring-4 ring-[#F95C4B]/25 border-[#F95C4B]' : future ? 'border-dashed border-[#F59E0B]/70' : faded ? 'border-dashed border-[#E5E7EB] dark:border-[#2A2A2A]' : 'border-[#E5E7EB] dark:border-[#2A2A2A] shadow-[0_10px_30px_-18px_rgba(17,17,17,0.35)]'
      } ${n.kind === 'current' ? 'node-glow' : ''} ${faded ? 'opacity-60' : ''}`}
      style={{ left: n.x, top: n.y, width: W, height: H }}>
      <span className="flex h-full">
        <span className="w-12 flex-shrink-0 rounded-l-2xl flex items-center justify-center" style={{ backgroundColor: future || faded ? 'transparent' : color, borderRight: future || faded ? `1px dashed ${faded ? '#D4D4D8' : '#F59E0B'}` : 'none' }}>
          <Icon className="w-5 h-5" style={{ color: future ? '#F59E0B' : faded ? '#9CA3AF' : '#fff' }} />
        </span>
        <span className="min-w-0 flex-1 px-3 py-2 flex flex-col justify-center">
          <span className="flex items-center gap-1.5">
            <span className="text-[13px] font-bold text-[#111111] dark:text-white truncate">{s.label}</span>
          </span>
          <span className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] truncate">
            {s.at ? when(s.at) : s.predictedAt ? `~ ${format(new Date(s.predictedAt), 'd MMM yyyy')}` : faded ? 'No record' : s.state === 'done' ? 'Date not recorded' : 'Not yet'}
            {s.by ? ` · ${s.by}` : ''}
          </span>
          <span className="mt-1 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-md text-[9px] font-bold uppercase tracking-wide" style={{ color: status[1], backgroundColor: `${status[1]}18` }}>
              <StatusIcon className="w-2.5 h-2.5" />{status[0]}
            </span>
            {touches.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold">
                {touches.some((t) => t.kind === 'notification') && <span className="flex items-center gap-0.5 text-[#F95C4B]"><Bell className="w-3 h-3" />{touches.filter((t) => t.kind === 'notification').length}</span>}
                {touches.some((t) => t.kind !== 'notification') && <span className="flex items-center gap-0.5 text-[#8B5CF6]"><MessageSquare className="w-3 h-3" />{touches.filter((t) => t.kind !== 'notification').length}</span>}
              </span>
            )}
          </span>
        </span>
      </span>
      {/* connection handles */}
      <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white dark:border-[#1A1A1A]" style={{ backgroundColor: future ? '#F59E0B' : faded ? '#D4D4D8' : color }} />
      <span className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white dark:border-[#1A1A1A]" style={{ backgroundColor: future ? '#F59E0B' : faded ? '#D4D4D8' : color }} />
    </button>
  )
}

// Notifications / messages hanging under a step, joined to it by a thin line
function TouchStack({ n, touches, onSelect }) {
  if (!touches.length) return null
  const shown = touches.slice(-2)
  return (
    <div className="absolute" style={{ left: n.x + 14, top: n.y + H, width: W - 28 }}>
      <span className="block mx-auto w-px h-5 bg-[repeating-linear-gradient(180deg,#D4D4D8_0_3px,transparent_3px_6px)]" />
      <div className="space-y-1.5">
        {shown.map((t) => (
          <button key={t.id} type="button" onClick={() => onSelect(n.id)}
            className="mac-in w-full flex items-start gap-2 px-2.5 py-1.5 rounded-xl text-left bg-white/90 dark:bg-[#1A1A1A]/90 border border-[#F1EFEC] dark:border-[#2A2A2A] shadow-sm hover:border-[#F95C4B]/40">
            {t.kind === 'notification' ? <Bell className="w-3 h-3 text-[#F95C4B] mt-0.5 flex-shrink-0" /> : <MessageSquare className="w-3 h-3 text-[#8B5CF6] mt-0.5 flex-shrink-0" />}
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold text-[#111111] dark:text-white truncate">{t.kind === 'notification' ? `→ ${t.to}` : t.from}</span>
              <span className="block text-[10px] text-[#9CA3AF] truncate">{t.title ?? t.text}</span>
            </span>
          </button>
        ))}
        {touches.length > 2 && (
          <button type="button" onClick={() => onSelect(n.id)} className="w-full text-center text-[10px] font-semibold text-[#F95C4B] hover:underline">+{touches.length - 2} more</button>
        )}
      </div>
    </div>
  )
}

function DecisionNode({ n, row, selected, onSelect }) {
  const p = row.prediction.probability
  const color = p >= 60 ? '#10B981' : p >= 30 ? '#F59E0B' : '#EF4444'
  return (
    <button type="button" onClick={() => onSelect('decide')} className="absolute group focus:outline-none" style={{ left: n.x, top: n.y - 14, width: 112, height: H + 28 }}>
      <span className={`absolute inset-3 rotate-45 rounded-2xl border-2 bg-white dark:bg-[#1A1A1A] shadow-[0_12px_30px_-14px_rgba(17,17,17,0.45)] transition-transform duration-300 group-hover:scale-105 ${selected ? 'ring-4 ring-[#F95C4B]/25' : ''}`} style={{ borderColor: color }} />
      <span className="relative h-full flex flex-col items-center justify-center text-center">
        <GitBranch className="w-4 h-4" style={{ color }} />
        <span className="text-[10px] font-bold uppercase tracking-wide text-[#6B7280] dark:text-[#A1A1AA] leading-tight mt-0.5">Will it<br />close?</span>
        <span className="text-lg font-bold tabular-nums leading-tight" style={{ color }}>{p}%</span>
      </span>
    </button>
  )
}

function EndNode({ n, kind, row, selected, onSelect }) {
  const p = row.prediction?.probability ?? 0
  const cfg = {
    win: { icon: Trophy, color: '#10B981', title: 'Deal closes', sub: [row.prediction?.expectedValue != null ? `${row.prediction.estimatedValue ? '~' : ''}${R(row.prediction.expectedValue)}` : null, row.prediction?.expectedCloseDate ? `by ${format(new Date(row.prediction.expectedCloseDate), 'd MMM')}` : null].filter(Boolean).join(' · ') || 'Value not known yet', chip: `${p}% likely` },
    stall: { icon: TrendingDown, color: '#F59E0B', title: 'Goes quiet', sub: 'No callback, no agent update', chip: 'Risk' },
    lost: { icon: XCircle, color: '#EF4444', title: 'Deal falls through', sub: 'Lead marked Lost', chip: `${100 - p}% chance` },
  }[kind]
  return (
    <button type="button" onClick={() => onSelect(n.id)}
      className={`absolute text-left rounded-2xl border-2 border-dashed bg-white dark:bg-[#1A1A1A] px-3 py-2.5 transition-all hover:-translate-y-0.5 hover:shadow-xl ${selected ? 'ring-4 ring-[#F95C4B]/25' : ''}`}
      style={{ left: n.x, top: n.y, width: W, height: H, borderColor: `${cfg.color}AA` }}>
      <span className="flex items-center gap-2.5 h-full">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${cfg.color}18` }}><cfg.icon className="w-5 h-5" style={{ color: cfg.color }} /></span>
        <span className="min-w-0">
          <span className="block text-[13px] font-bold text-[#111111] dark:text-white">{cfg.title}</span>
          <span className="block text-[11px] text-[#6B7280] dark:text-[#A1A1AA] truncate">{cfg.sub}</span>
          <span className="inline-block mt-1 px-1.5 py-px rounded-md text-[9px] font-bold uppercase tracking-wide" style={{ color: cfg.color, backgroundColor: `${cfg.color}18` }}>{cfg.chip}</span>
        </span>
      </span>
      <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white dark:border-[#1A1A1A]" style={{ backgroundColor: cfg.color }} />
    </button>
  )
}

/* ─── Inspector ─────────────────────────────────────────────────────────── */

function Inspector({ row, id, onClose }) {
  const step = row.journey.find((s) => s.key === id)
  const touches = step ? row.touches.filter((t) => t.step === id) : []
  const p = row.prediction
  let body
  if (id === 'decide' || id === 'win' || id === 'stall' || id === 'lost') {
    const good = (p?.reasons ?? []).filter((r) => !/passed|Nothing has happened|cancelled/i.test(r))
    const bad = (p?.reasons ?? []).filter((r) => /passed|Nothing has happened|cancelled/i.test(r))
    body = (
      <>
        <p className="text-sm font-bold text-[#111111] dark:text-white">{id === 'lost' || id === 'stall' ? 'How it could fall through' : 'Will it close?'}</p>
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">{p ? `${p.probability}% — ${p.label.toLowerCase()} to close${p.expectedCloseDate ? `, around ${format(new Date(p.expectedCloseDate), 'd MMM yyyy')}` : ''}` : 'Closed'}</p>
        {p?.expectedValue != null && <p className="mt-2 text-xs"><span className="text-[#9CA3AF]">Worth</span> <b className="text-[#111111] dark:text-white">{p.estimatedValue ? '~' : ''}{R(p.expectedValue)}</b> <span className="text-[#9CA3AF]">· expected {R(p.weightedValue)}</span></p>}
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-[#10B981] flex items-center gap-1"><TrendingUp className="w-3 h-3" /> In its favour</p>
        <ul className="mt-1 space-y-1">{good.length ? good.map((r) => <li key={r} className="text-xs text-[#111111] dark:text-white">· {r}</li>) : <li className="text-xs text-[#9CA3AF]">Nothing stands out</li>}</ul>
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-[#EF4444] flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Against it</p>
        <ul className="mt-1 space-y-1">{bad.length ? bad.map((r) => <li key={r} className="text-xs text-[#111111] dark:text-white">· {r}</li>) : <li className="text-xs text-[#9CA3AF]">Nothing worrying right now</li>}</ul>
        <p className="mt-3 text-[10px] text-[#9CA3AF]">Learnt from how past leads at the same stage actually went.</p>
      </>
    )
  } else if (step) {
    body = (
      <>
        <p className="text-sm font-bold text-[#111111] dark:text-white">{step.label}</p>
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
          {step.at ? format(new Date(step.at), 'd MMM yyyy, HH:mm') : step.predictedAt ? `Expected ~${format(new Date(step.predictedAt), 'd MMM yyyy')}` : step.state === 'skipped' ? 'Skipped — no record of this step' : 'Not reached yet'}
          {step.by ? ` · ${step.by}` : ''}
        </p>
        {step.detail && <p className="mt-2 text-xs text-[#111111] dark:text-white">{step.detail}</p>}
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Sent during this step · {touches.length}</p>
        <ul className="mt-2 space-y-2">
          {touches.length === 0 && <li className="text-xs text-[#9CA3AF]">No notifications or messages.</li>}
          {touches.map((t) => (
            <li key={t.id} className="p-2.5 rounded-xl bg-[#FAFAF9] dark:bg-[#141414] border border-[#F1EFEC] dark:border-[#232323] text-xs">
              <p className="flex items-center gap-1.5 text-[#6B7280] dark:text-[#A1A1AA]">
                {t.kind === 'notification' ? <Bell className="w-3 h-3 text-[#F95C4B]" /> : <MessageSquare className="w-3 h-3 text-[#8B5CF6]" />}
                {t.from ? <b className="text-[#111111] dark:text-white">{t.from}</b> : null}{t.from ? ' → ' : 'To '}<b className="text-[#111111] dark:text-white">{t.to}</b>
                <span className="ml-auto text-[10px] text-[#9CA3AF]">{when(t.at)}</span>
              </p>
              {t.title && <p className="font-semibold text-[#111111] dark:text-white mt-1">{t.title}</p>}
              <p className="text-[#6B7280] dark:text-[#A1A1AA] break-words">{t.text}</p>
              {t.kind === 'notification' && <p className="mt-1 text-[10px] text-[#9CA3AF]">{(t.channels ?? []).join(', ')}{t.read ? ' · read' : ' · not read yet'}</p>}
            </li>
          ))}
        </ul>
      </>
    )
  }
  return (
    <aside className="picker-in absolute top-3 right-3 bottom-3 w-[320px] z-20 rounded-2xl liquid-glass-solid shadow-2xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">Inspect</span>
        <button type="button" onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
      </div>
      <div className="thin-scroll flex-1 overflow-y-auto px-4 pb-4 pt-1">{body}</div>
    </aside>
  )
}

/* ─── Canvas ────────────────────────────────────────────────────────────── */

export default function DealFlowCanvas({ row }) {
  const { nodes, edges, width, height } = useMemo(() => layout(row), [row])
  const [zoom, setZoom] = useState(0.8)
  const [selected, setSelected] = useState(null)
  const scroller = useRef(null)
  const drag = useRef(null)
  const touchesBy = useMemo(() => {
    const m = {}
    row.touches.forEach((t) => { (m[t.step] ??= []).push(t) })
    return m
  }, [row])
  // Open on where the deal is now — the decision and its two branches, or the last step
  const nowX = (nodes.find((n) => n.kind === 'decision') ?? [...nodes].reverse().find((n) => n.kind === 'done' || n.kind === 'current'))?.x ?? 0
  const jump = (x, smooth = true) => {
    const el = scroller.current
    if (!el) return
    el.scrollTo({ left: Math.max(0, x * zoom - el.clientWidth * 0.3), top: 0, behavior: smooth ? 'smooth' : 'auto' })
  }
  useEffect(() => {
    setSelected(null)
    const t = setTimeout(() => jump(nowX, false), 30)
    return () => clearTimeout(t)
  }, [row.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const fit = () => {
    const el = scroller.current
    if (!el) return
    setZoom(Math.max(0.4, Math.min(1.1, (el.clientWidth - 24) / width)))
  }

  // Drag the canvas to pan, like a flow editor
  const onDown = (e) => {
    if (e.target.closest('button')) return
    drag.current = { x: e.clientX, y: e.clientY, l: scroller.current.scrollLeft, t: scroller.current.scrollTop }
  }
  const onMove = (e) => {
    if (!drag.current) return
    scroller.current.scrollLeft = drag.current.l - (e.clientX - drag.current.x)
    scroller.current.scrollTop = drag.current.t - (e.clientY - drag.current.y)
  }
  const onUp = () => { drag.current = null }

  return (
    <div className="relative rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden bg-[#FBFBFA] dark:bg-[#101010]">
      <div ref={scroller} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
        className="flow-grid thin-scroll overflow-auto cursor-grab active:cursor-grabbing" style={{ height: Math.min(620, height * zoom + 40) }}>
        <div style={{ width: width * zoom, height: height * zoom }}>
          <div className="relative origin-top-left" style={{ width, height, transform: `scale(${zoom})` }}>
            <svg width={width} height={height} className="absolute inset-0 pointer-events-none">
              <defs>
                {[['coral', '#F95C4B'], ['grey', '#D4D4D8'], ['green', '#10B981'], ['red', '#EF4444'], ['amber', '#F59E0B']].map(([k, c]) => (
                  <marker key={k} id={`dt-arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" fill={c} />
                  </marker>
                ))}
              </defs>
              <Edges nodes={nodes} edges={edges} />
            </svg>
            <EdgeLabels nodes={nodes} edges={edges} />
            {nodes.map((n, i) => (
              <div key={n.id} className="mac-pop" style={{ '--d': `${i * 55}ms` }}>
                {n.kind === 'decision' ? <DecisionNode n={n} row={row} selected={selected === n.id} onSelect={setSelected} />
                  : ['win', 'stall', 'lost'].includes(n.kind) ? <EndNode n={n} kind={n.kind} row={row} selected={selected === n.id} onSelect={setSelected} />
                    : (
                      <>
                        <StepCard n={n} touches={touchesBy[n.id] ?? []} selected={selected === n.id} onSelect={setSelected} />
                        {n.y === TOP && <TouchStack n={n} touches={touchesBy[n.id] ?? []} onSelect={setSelected} />}
                      </>
                    )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="absolute left-3 bottom-3 z-10 flex items-center gap-1 p-1 rounded-xl liquid-glass-solid shadow-lg">
        <button type="button" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))} title="Zoom out" className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-black/5 dark:hover:bg-white/10"><Minus className="w-4 h-4" /></button>
        <span className="w-11 text-center text-[11px] font-semibold text-[#111111] dark:text-white tabular-nums">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(2)))} title="Zoom in" className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-black/5 dark:hover:bg-white/10"><Plus className="w-4 h-4" /></button>
        <button type="button" onClick={fit} title="Fit to screen" className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-black/5 dark:hover:bg-white/10"><Maximize2 className="w-4 h-4" /></button>
        <span className="w-px h-5 bg-[#E5E7EB] dark:bg-[#2A2A2A] mx-1" />
        <button type="button" onClick={() => jump(0)} className="px-2.5 h-8 rounded-lg text-[11px] font-semibold text-[#6B7280] hover:bg-black/5 dark:hover:bg-white/10">Start</button>
        <button type="button" onClick={() => jump(nowX)} className="px-2.5 h-8 rounded-lg text-[11px] font-semibold text-[#F95C4B] hover:bg-[#F95C4B]/10">Now &amp; prediction</button>
      </div>
      <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-3 px-3 py-1.5 rounded-xl liquid-glass-solid text-[10px] font-semibold text-[#6B7280] dark:text-[#A1A1AA]">
        <span className="flex items-center gap-1.5"><span className="w-5 h-0.5 bg-[#F95C4B] rounded" />Happened</span>
        <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-[#D4D4D8]" />Skipped</span>
        <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-[#10B981]" />How it closes</span>
        <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-[#EF4444]" />How it falls through</span>
        <span className="flex items-center gap-1.5"><Bell className="w-3 h-3 text-[#F95C4B]" />Notification</span>
        <span className="flex items-center gap-1.5"><MessageSquare className="w-3 h-3 text-[#8B5CF6]" />Message</span>
      </div>

      {selected && <Inspector row={row} id={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
