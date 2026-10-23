import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, formatDistanceToNowStrict } from 'date-fns'
import {
  FileSpreadsheet, Search, X, Loader2, AlertTriangle, CheckCircle2, UserCheck, Upload, ChevronDown, Lock,
  MapPin, Sparkles, Hand, Inbox, LayoutList, Columns3, Check, Minus, Users, ArrowRight,
} from 'lucide-react'
import { contactsApi } from '../../services/contactsApi'
import { areasApi } from '../../services/areasApi'
import { SearchableAreaSelect } from '../leads/leadShared'
import SidePanel from '../common/SidePanel'
import LiquidTabs from '../common/LiquidTabs'
import ExcelFilesBoard, {
  AssignSheet, FileDetails, FileContactsPanel, DeleteFileDialog, holderOf, initials, areaColor,
} from './ExcelFilesBoard'

// Admin's quickest way to hand out contacts: pick a spreadsheet, pick a cold caller,
// confirm. Callers are ranked for each file (who asked for contacts, who already works
// that area, who has the lightest queue) so the right person is usually the first one.
// The drag-and-drop board is still one click away for sorting files into areas.

const FILES_KEY = ['contact-files']
const PAGE = 40

// 'open' = still has contacts nobody holds and isn't locked to a caller (same rule as the
// count on the page's "Assign by file" tab); a missing area is shown on the row, not here
const stateOf = (f) => (f.assignment || f.contactCount <= (f.assignedCount ?? 0) ? 'done' : 'open')

/* ─── Caller picker (anchored popover) ───────────────────────────────────── */

function usePopoverPosition(anchorEl, open, width = 340) {
  const [pos, setPos] = useState(null)
  useLayoutEffect(() => {
    if (!open || !anchorEl) return
    const place = () => {
      const r = anchorEl.getBoundingClientRect()
      const below = window.innerHeight - r.bottom
      const up = below < 440 && r.top > below
      const left = Math.min(Math.max(12, r.right - width), window.innerWidth - width - 12)
      setPos(up ? { left, bottom: window.innerHeight - r.top + 8, origin: 'bottom right' } : { left, top: r.bottom + 8, origin: 'top right' })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [anchorEl, open, width])
  return pos
}

function CallerPicker({ anchorEl, title, subtitle, files, callers, loading, areas, onSetArea, settingArea, onPick, onClose }) {
  const ref = useRef(null)
  const [q, setQ] = useState('')
  const pos = usePopoverPosition(anchorEl, true)
  const missingArea = files.length === 1 && !files[0].areaId ? files[0] : null

  useEffect(() => {
    const onDown = (e) => { if (!ref.current?.contains(e.target) && !anchorEl?.contains(e.target)) onClose() }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [anchorEl, onClose])

  // Rank: asked for contacts → already works these areas → lightest queue
  const ranked = useMemo(() => {
    const areaIds = new Set(files.map((f) => f.areaId).filter(Boolean))
    const maxLeft = Math.max(1, ...callers.map((c) => c.remaining))
    return callers
      .map((c) => {
        const inArea = c.areas.filter((a) => areaIds.has(String(a.areaId))).reduce((s, a) => s + a.count, 0)
        const holdsAll = files.length === 1 && (() => { const h = holderOf(files[0]); return h && h.id === c.id && !h.partial })()
        const score = (c.hasPendingRequest ? 1000 : 0) + (inArea ? 400 + Math.min(inArea, 200) : 0) - (c.remaining / maxLeft) * 300
        return { ...c, inArea, holdsAll, score, load: c.remaining / maxLeft }
      })
      .sort((a, b) => Number(a.holdsAll) - Number(b.holdsAll) || b.score - a.score)
  }, [callers, files])
  const shown = ranked.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()))
  const areaName = files.length === 1 ? files[0].areaName : null

  if (!pos) return null
  return createPortal(
    <div ref={ref} role="dialog" aria-label="Choose a cold caller"
      className="picker-in fixed z-[60] w-[340px] max-w-[calc(100vw-24px)] rounded-2xl liquid-glass-solid shadow-[0_24px_60px_-20px_rgba(17,17,17,0.45)]"
      style={{ left: pos.left, top: pos.top, bottom: pos.bottom, transformOrigin: pos.origin }}>
      <div className="px-4 pt-3.5 pb-2.5">
        <p className="text-sm font-bold text-[#111111] dark:text-white truncate">{title}</p>
        <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] truncate">{subtitle}</p>
      </div>

      {missingArea ? (
        <div className="px-4 pb-4">
          <div className="flex gap-2 p-2.5 mb-2.5 rounded-xl bg-[#F59E0B]/10 text-[11px] text-[#B45309] dark:text-[#F59E0B]">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
            <span>First, which area is this file from? Callers are matched to it.</span>
          </div>
          <div className={settingArea ? 'opacity-60 pointer-events-none' : ''}>
            <SearchableAreaSelect areas={areas} value="" onChange={(id) => id && onSetArea(missingArea, id)} placeholder="Choose an area…" allowAdd />
          </div>
          {settingArea && <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#6B7280]"><Loader2 className="w-3 h-3 animate-spin" /> Saving the area…</p>}
        </div>
      ) : (
        <>
          <div className="px-3 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF] pointer-events-none" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a cold caller…"
                onKeyDown={(e) => { if (e.key === 'Enter' && shown[0] && !shown[0].holdsAll) onPick(shown[0]) }}
                className="w-full pl-8 pr-3 py-2 rounded-xl text-xs bg-[#111111]/[0.05] dark:bg-white/[0.07] text-[#111111] dark:text-white placeholder:text-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#F95C4B]/25" />
            </div>
          </div>
          <ul className="thin-scroll max-h-[320px] overflow-y-auto px-1.5 pb-1.5">
            {loading && Array.from({ length: 4 }, (_, i) => <li key={i} className="shimmer h-12 rounded-xl m-1" />)}
            {!loading && shown.length === 0 && <li className="py-6 text-center text-xs text-[#9CA3AF]">No cold callers match</li>}
            {shown.map((c, i) => {
              const suggested = i === 0 && !q && !c.holdsAll
              return (
                <li key={c.id} className="picker-row" style={{ '--d': `${Math.min(i, 8) * 25}ms` }}>
                  <button type="button" disabled={c.holdsAll} onClick={() => onPick(c)}
                    className={`group w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
                      suggested ? 'bg-[#F95C4B]/[0.08] hover:bg-[#F95C4B]/[0.13]' : 'hover:bg-[#111111]/[0.05] dark:hover:bg-white/[0.06]'
                    }`}>
                    <span className="relative w-9 h-9 rounded-full bg-gradient-to-br from-[#F95C4B] to-[#E11D48] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                      {initials(c.name)}
                      {c.hasPendingRequest && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#F59E0B] ring-2 ring-white dark:ring-[#1C1C1C] animate-pulse" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-[#111111] dark:text-white truncate">{c.name}</span>
                        {suggested && <span className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-full text-[9px] font-bold uppercase tracking-wide bg-[#F95C4B] text-white flex-shrink-0"><Sparkles className="w-2.5 h-2.5" />Best fit</span>}
                      </span>
                      <span className="flex items-center gap-1.5 mt-0.5 text-[10px] text-[#6B7280] dark:text-[#A1A1AA] truncate">
                        {c.holdsAll ? 'Already has this file'
                          : c.hasPendingRequest ? <span className="font-semibold text-[#B45309] dark:text-[#F59E0B]">Asked for contacts</span>
                            : c.inArea ? <span className="font-semibold text-[#059669] dark:text-[#34D399]">Works {areaName ?? 'these areas'}</span>
                              : null}
                        {!c.holdsAll && (c.hasPendingRequest || c.inArea) && <span className="text-[#D4D4D8]">·</span>}
                        {!c.holdsAll && <span>{c.remaining.toLocaleString()} left to call</span>}
                      </span>
                    </span>
                    {/* queue load */}
                    <span className="w-12 h-1.5 rounded-full bg-[#111111]/[0.07] dark:bg-white/10 overflow-hidden flex-shrink-0" title={`${c.remaining.toLocaleString()} contacts still to call`}>
                      <span className="block h-full rounded-full" style={{ width: `${Math.max(6, c.load * 100)}%`, backgroundColor: c.load > 0.66 ? '#EF4444' : c.load > 0.33 ? '#F59E0B' : '#10B981' }} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="px-4 py-2 border-t border-[#111111]/[0.06] dark:border-white/[0.06] text-[10px] text-[#9CA3AF] flex items-center justify-between">
            <span>Bar = queue still to call</span><span>↵ picks the top match</span>
          </p>
        </>
      )}
    </div>,
    document.body,
  )
}

/* ─── Bulk confirm ───────────────────────────────────────────────────────── */

function BulkAssignSheet({ files, person, pending, progress, onCancel, onConfirm }) {
  const total = files.reduce((s, f) => s + f.contactCount, 0)
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !pending) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, onCancel])
  return (
    <>
      <div data-lead-dialog className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px] lead-backdrop-in" onClick={!pending ? onCancel : undefined} />
      <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[12vh] pointer-events-none">
        <div role="dialog" aria-label="Assign files" className="files-sheet-in pointer-events-auto w-full max-w-md bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl overflow-hidden">
          <div className="px-6 pt-6 pb-4 bg-gradient-to-b from-[#F95C4B]/[0.07] to-transparent text-center">
            <div className="flex items-center justify-center gap-3">
              <span className="relative w-12 h-12 mac-pop">
                {files.slice(0, 3).map((f, i) => (
                  <span key={f.batchId} className="absolute inset-0 rounded-2xl bg-white dark:bg-[#202020] border border-[#10B981]/30 flex items-center justify-center shadow-sm"
                    style={{ transform: `translate(${i * 5}px, ${-i * 5}px) rotate(${i * 5}deg)`, zIndex: 3 - i }}>
                    {i === 0 && <FileSpreadsheet className="w-6 h-6 text-[#10B981]" strokeWidth={1.75} />}
                  </span>
                ))}
              </span>
              <ArrowRight className="w-5 h-5 text-[#F95C4B] ml-2" />
              <span className="w-12 h-12 rounded-full bg-gradient-to-br from-[#F95C4B] to-[#E11D48] text-white text-sm font-bold flex items-center justify-center mac-pop" style={{ '--d': '80ms' }}>{initials(person.name)}</span>
            </div>
            <h3 className="mt-4 text-base font-bold text-[#111111] dark:text-white">Give {files.length} files to {person.name}?</h3>
            <p className="mt-1 text-xs text-[#6B7280] dark:text-[#A1A1AA]">{total.toLocaleString()} contacts go into their queue. Do Not Call and contacts without a phone are skipped.</p>
          </div>
          <ul className="thin-scroll mx-6 mb-4 max-h-44 overflow-y-auto rounded-xl border border-[#F1EFEC] dark:border-[#2A2A2A] divide-y divide-[#F1EFEC] dark:divide-[#2A2A2A]">
            {files.map((f) => {
              const st = progress[f.batchId]
              return (
                <li key={f.batchId} className="flex items-center gap-2.5 px-3 py-2 text-xs">
                  <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                    {st === 'done' ? <CheckCircle2 className="w-4 h-4 text-[#10B981] mac-pop" /> : st === 'busy' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#F95C4B]" />
                      : st === 'error' ? <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444]" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-[#10B981]" />}
                  </span>
                  <span className="flex-1 min-w-0 truncate font-medium text-[#111111] dark:text-white">{f.displayName}</span>
                  <span className="text-[#9CA3AF]">{f.contactCount.toLocaleString()}</span>
                </li>
              )
            })}
          </ul>
          <div className="flex gap-2.5 px-6 pb-6">
            <button type="button" onClick={onCancel} disabled={pending}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] disabled:opacity-60">Cancel</button>
            <button type="button" onClick={onConfirm} disabled={pending} autoFocus
              className="mac-press flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-sm shadow-[#F95C4B]/30 disabled:opacity-60 flex items-center justify-center gap-2">
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />} Assign {files.length} files
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── One file row ───────────────────────────────────────────────────────── */

function HolderStack({ file }) {
  const people = file.assignment
    ? [{ id: String(file.assignment.assignedToId), name: file.assignment.assignedToName }]
    : (file.assignees ?? [])
  if (!people.length) return <span className="text-[11px] text-[#9CA3AF] italic">Nobody yet</span>
  return (
    <span className="flex items-center gap-2 min-w-0">
      <span className="flex -space-x-2 flex-shrink-0">
        {people.slice(0, 3).map((p) => (
          <span key={p.id} title={p.name} className="w-6 h-6 rounded-full bg-gradient-to-br from-[#F95C4B] to-[#E11D48] text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-[#181818]">{initials(p.name)}</span>
        ))}
      </span>
      <span className="text-xs font-medium text-[#111111] dark:text-white truncate">
        {people[0].name.split(' ')[0]}{people.length > 1 ? ` +${people.length - 1}` : ''}
      </span>
      {file.assignment && <Lock className="w-3 h-3 text-[#9CA3AF] flex-shrink-0" title="Locked to this caller" />}
    </span>
  )
}

function FileRow({ file, index, checked, onCheck, onOpen, onAssign, assignLabel, flash, busy }) {
  const st = stateOf(file)
  const pct = file.contactCount ? Math.round(((file.assignedCount ?? 0) / file.contactCount) * 100) : 0
  const btnRef = useRef(null)
  const color = file.areaId ? areaColor(file.areaId) : '#F59E0B'
  return (
    <li
      onClick={() => onOpen(file)}
      className={`file-row group relative grid grid-cols-[auto_minmax(0,1fr)_auto] md:grid-cols-[auto_minmax(0,2.4fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 cursor-pointer transition-colors duration-200 ${
        checked ? 'bg-[#F95C4B]/[0.05]' : 'hover:bg-[#FAFAF9] dark:hover:bg-[#1E1E1E]'
      } ${flash ? 'row-flash' : ''}`}
      style={{ '--d': `${Math.min(index, 14) * 28}ms` }}
    >
      {/* select */}
      <button type="button" onClick={(e) => { e.stopPropagation(); onCheck(file) }} aria-label={checked ? 'Unselect file' : 'Select file'}
        className={`w-[18px] h-[18px] rounded-md border-[1.5px] flex items-center justify-center transition-all duration-200 ${
          checked ? 'bg-[#F95C4B] border-[#F95C4B] scale-105' : 'border-[#D4D4D8] dark:border-[#3F3F46] group-hover:border-[#F95C4B]/60'
        }`}>
        {checked && <Check className="w-3 h-3 text-white mac-pop" strokeWidth={3} />}
      </button>

      {/* name */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="relative w-10 h-10 rounded-xl bg-[#10B981]/10 flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105">
          {busy ? <Loader2 className="w-4 h-4 animate-spin text-[#10B981]" /> : <FileSpreadsheet className="w-5 h-5 text-[#10B981]" strokeWidth={1.75} />}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[#111111] dark:text-white truncate" title={file.displayName}>{file.displayName}</p>
          <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] truncate">
            <b className="font-semibold text-[#111111] dark:text-white">{file.contactCount.toLocaleString()}</b> contacts · {formatDistanceToNowStrict(new Date(file.createdAt), { addSuffix: true })}
          </p>
        </div>
      </div>

      {/* area */}
      <div className="hidden md:block min-w-0">
        {file.areaId ? (
          <span className="inline-flex items-center gap-1.5 max-w-full px-2 py-1 rounded-lg text-[11px] font-semibold" style={{ backgroundColor: `${color}14`, color: color === '#111111' ? undefined : color }}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color === '#111111' ? 'dark:!bg-white' : ''}`} style={{ backgroundColor: color }} />
            <span className={`truncate ${color === '#111111' ? 'text-[#111111] dark:text-white' : ''}`}>{file.areaName}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-[#F59E0B]/12 text-[#B45309] dark:text-[#F59E0B]">
            <AlertTriangle className="w-3 h-3" /> No area yet
          </span>
        )}
      </div>

      {/* progress */}
      <div className="hidden md:block min-w-0">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-[#6B7280] dark:text-[#A1A1AA]">{st === 'done' ? 'Assigned' : `${(file.contactCount - (file.assignedCount ?? 0)).toLocaleString()} unassigned`}</span>
          <span className="font-bold text-[#111111] dark:text-white">{pct}%</span>
        </div>
        <span className="block h-1.5 rounded-full bg-[#F5F5F4] dark:bg-[#2A2A2A] overflow-hidden">
          <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? '#10B981' : '#F95C4B', transitionTimingFunction: 'var(--ease-mac)' }} />
        </span>
      </div>

      {/* who */}
      <div className="hidden md:block min-w-0"><HolderStack file={file} /></div>

      {/* action */}
      <div className="flex items-center gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
        <button ref={btnRef} type="button" onClick={() => onAssign(file, btnRef.current)}
          className={`mac-press inline-flex items-center gap-1.5 pl-3.5 pr-2.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
            st === 'done'
              ? 'border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:border-[#F95C4B]/50 hover:text-[#F95C4B]'
              : 'text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-sm shadow-[#F95C4B]/30'
          }`}>
          {assignLabel ?? (st === 'done' ? 'Reassign' : 'Assign')} <ChevronDown className="w-3.5 h-3.5 opacity-80" />
        </button>
      </div>

      {/* compact meta on phones */}
      <div className="md:hidden col-span-3 flex items-center gap-3 pl-[34px] text-[11px]">
        <span className={file.areaId ? 'text-[#6B7280] dark:text-[#A1A1AA]' : 'text-[#B45309] dark:text-[#F59E0B] font-semibold'}>{file.areaName ?? 'No area yet'}</span>
        <span className="text-[#D4D4D8]">·</span><span className="text-[#6B7280] dark:text-[#A1A1AA]">{pct}% assigned</span>
        <span className="ml-auto"><HolderStack file={file} /></span>
      </div>
    </li>
  )
}

/* ─── View ───────────────────────────────────────────────────────────────── */

export default function FileAssignView({ targetCaller, onClearTarget, onTargetAssigned, onUpload }) {
  const qc = useQueryClient()
  const [layout, setLayout] = useState(() => { try { return localStorage.getItem('rt-files-layout') || 'list' } catch { return 'list' } })
  const [filter, setFilter] = useState('open')
  const [search, setSearch] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [checked, setChecked] = useState(() => new Set())
  const [picker, setPicker] = useState(null)        // { files, anchorEl }
  const [confirm, setConfirm] = useState(null)      // { file, person } | { files, person, bulk: true }
  const [bulkProgress, setBulkProgress] = useState({})
  const [bulkBusy, setBulkBusy] = useState(false)
  const [details, setDetails] = useState(null)      // batchId
  const [viewing, setViewing] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [flash, setFlash] = useState(() => new Set())
  const setLayoutSaved = (v) => { setLayout(v); try { localStorage.setItem('rt-files-layout', v) } catch { /* private mode */ } }

  const { data: files = [], isLoading, isError, refetch } = useQuery({
    queryKey: FILES_KEY,
    queryFn: () => contactsApi.listFiles().then((r) => r.data.data.files),
    staleTime: 30_000,
  })
  const { data: areas = [] } = useQuery({
    queryKey: ['areas-select'],
    queryFn: () => areasApi.list({ limit: 100, isActive: true }).then((r) => r.data.data.areas),
    staleTime: 60_000,
  })
  const { data: callers = [], isLoading: callersLoading } = useQuery({
    queryKey: ['files-people', 'admin', 'full'],
    queryFn: () => contactsApi.callerWorkload().then((r) => r.data.data.callers.map((c) => ({
      id: String(c.callerId), name: c.callerName, remaining: c.remaining ?? 0, hasPendingRequest: c.hasPendingRequest, areas: c.areas ?? [],
    }))),
    staleTime: 30_000,
  })

  const refreshAfterAssign = (batchIds) => {
    qc.invalidateQueries({ queryKey: FILES_KEY })
    qc.invalidateQueries({ queryKey: ['files-people'] })
    qc.invalidateQueries({ queryKey: ['contacts'] })
    qc.invalidateQueries({ queryKey: ['contacts-unassigned'] })
    qc.invalidateQueries({ queryKey: ['caller-counts'] })
    batchIds.forEach((id) => {
      qc.invalidateQueries({ queryKey: ['file-stats', id] })
      qc.invalidateQueries({ queryKey: ['file-history', id] })
    })
    setFlash(new Set(batchIds))
    setTimeout(() => setFlash(new Set()), 2200)
  }

  const moveMut = useMutation({
    mutationFn: ({ batchId, areaId }) => contactsApi.assignFileArea(batchId, areaId),
    onMutate: async ({ batchId, areaId }) => {
      await qc.cancelQueries({ queryKey: FILES_KEY })
      const previous = qc.getQueryData(FILES_KEY)
      const area = areas.find((a) => a._id === areaId)
      qc.setQueryData(FILES_KEY, (old) => old?.map((f) => (f.batchId === batchId ? { ...f, areaId, areaName: area?.name ?? null } : f)))
      return { previous }
    },
    onSuccess: (res, { batchId }) => {
      toast.success(`Moved to ${res.data.data.areaName}`)
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['file-history', batchId] })
    },
    onError: (e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(FILES_KEY, ctx.previous)
      toast.error(e.response?.data?.message ?? 'Could not set the area')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: FILES_KEY }),
  })

  const assignMut = useMutation({
    mutationFn: ({ file, person }) => contactsApi.assignByBatch({ uploadBatchId: file.batchId, callerId: person.id }),
    onSuccess: (res, { file, person }) => {
      const d = res.data.data
      toast.success(`${d.assigned.toLocaleString()} contact${d.assigned !== 1 ? 's' : ''} from ${file.displayName} given to ${person.name}`
        + (d.skippedDnc ? ` · ${d.skippedDnc} on Do Not Call skipped` : ''))
      setConfirm(null)
      refreshAfterAssign([file.batchId])
      if (targetCaller?.id === person.id) onTargetAssigned?.(person)
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Could not assign this file'),
  })

  const deleteMut = useMutation({
    mutationFn: (batchId) => contactsApi.deleteFile(batchId),
    onSuccess: (res, batchId) => {
      toast.success(`Deleted — ${res.data.data.contactsDeleted} contacts moved to the Bin`)
      qc.invalidateQueries({ queryKey: FILES_KEY })
      qc.invalidateQueries({ queryKey: ['contacts'] })
      if (details === batchId) setDetails(null)
      setChecked((s) => { const n = new Set(s); n.delete(batchId); return n })
      setToDelete(null)
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Failed to delete file'),
  })

  async function runBulk({ files: list, person }) {
    setBulkBusy(true)
    const done = []
    let assigned = 0
    for (const f of list) {
      setBulkProgress((p) => ({ ...p, [f.batchId]: 'busy' }))
      try {
        const res = await contactsApi.assignByBatch({ uploadBatchId: f.batchId, callerId: person.id })
        assigned += res.data.data.assigned ?? 0
        done.push(f.batchId)
        setBulkProgress((p) => ({ ...p, [f.batchId]: 'done' }))
      } catch {
        setBulkProgress((p) => ({ ...p, [f.batchId]: 'error' }))
      }
    }
    setBulkBusy(false)
    const failed = list.length - done.length
    if (done.length) toast.success(`${assigned.toLocaleString()} contacts from ${done.length} file${done.length === 1 ? '' : 's'} given to ${person.name}`)
    if (failed) toast.error(`${failed} file${failed === 1 ? '' : 's'} couldn't be assigned`)
    refreshAfterAssign(done)
    if (done.length && targetCaller?.id === person.id) onTargetAssigned?.(person)
    setTimeout(() => { setConfirm(null); setBulkProgress({}) }, failed ? 1600 : 700)
    setChecked(new Set())
  }

  /* ── Filtering ── */
  const counts = useMemo(() => {
    const c = { open: 0, done: 0, area: 0 }
    files.forEach((f) => { c[stateOf(f)] += 1; if (!f.areaId) c.area += 1 })
    return c
  }, [files])
  const q = search.trim().toLowerCase()
  const visible = useMemo(() => files
    .filter((f) => {
      const st = stateOf(f)
      if (filter === 'open' && st === 'done') return false
      if (filter === 'done' && st !== 'done') return false
      if (areaFilter === '__none__' ? f.areaId : areaFilter && f.areaId !== areaFilter) return false
      if (q && !f.displayName.toLowerCase().includes(q) && !(f.areaName ?? '').toLowerCase().includes(q)
        && !(f.assignees ?? []).some((a) => a.name.toLowerCase().includes(q)) && !(f.assignment?.assignedToName ?? '').toLowerCase().includes(q)) return false
      return true
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [files, filter, areaFilter, q])
  useEffect(() => { setLimit(PAGE) }, [filter, areaFilter, q])

  const areaOptions = useMemo(() => {
    const m = new Map()
    files.forEach((f) => { if (f.areaId) m.set(f.areaId, { id: f.areaId, name: f.areaName ?? 'Area', n: (m.get(f.areaId)?.n ?? 0) + 1 }) })
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [files])

  const unassignedContacts = files.reduce((s, f) => s + Math.max(0, f.contactCount - (f.assignedCount ?? 0)), 0)
  const selectedFiles = files.filter((f) => checked.has(f.batchId))
  const selectedContacts = selectedFiles.reduce((s, f) => s + f.contactCount, 0)
  const selectedNoArea = selectedFiles.filter((f) => !f.areaId).length
  const detailFile = files.find((f) => f.batchId === details) ?? null

  const toggle = (f) => setChecked((s) => { const n = new Set(s); if (n.has(f.batchId)) n.delete(f.batchId); else n.add(f.batchId); return n })
  const shownIds = visible.slice(0, limit).map((f) => f.batchId)
  const allShown = shownIds.length > 0 && shownIds.every((id) => checked.has(id))
  const someShown = shownIds.some((id) => checked.has(id))
  const toggleAll = () => setChecked((s) => { const n = new Set(s); shownIds.forEach((id) => (allShown ? n.delete(id) : n.add(id))); return n })

  const startAssign = (file, anchorEl) => {
    if (targetCaller && file.areaId) { setConfirm({ file, person: targetCaller }); return }
    setPicker({ files: [file], anchorEl, batchId: file.batchId })
  }
  const pickerFiles = picker ? (picker.batchId ? files.filter((f) => f.batchId === picker.batchId) : picker.files) : []
  const onPick = (person) => {
    const list = pickerFiles
    setPicker(null)
    if (list.length === 1) setConfirm({ file: list[0], person })
    else setConfirm({ files: list, person, bulk: true })
  }

  if (layout === 'board') {
    return (
      <div className="space-y-4">
        <Toolbar layout={layout} onLayout={setLayoutSaved} boardMode />
        <ExcelFilesBoard mode="admin" embedded />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Assigning for someone who asked */}
      {targetCaller && (
        <div className="glass-in flex items-center gap-3 px-4 py-3 rounded-2xl border border-[#F59E0B]/40 bg-[#F59E0B]/[0.08]">
          <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#F95C4B] to-[#E11D48] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">{initials(targetCaller.name)}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#111111] dark:text-white">Pick a file for {targetCaller.name}</p>
            <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">They asked for contacts. Press <b>Give</b> on any file — their request is marked fulfilled once it's done.</p>
          </div>
          <button type="button" onClick={onClearTarget} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#6B7280] hover:bg-black/5 dark:hover:bg-white/5"><X className="w-3.5 h-3.5" /> Cancel</button>
        </div>
      )}

      <Toolbar
        layout={layout} onLayout={setLayoutSaved}
        filter={filter} onFilter={setFilter} counts={isLoading ? {} : counts} total={isLoading ? undefined : files.length}
        search={search} onSearch={setSearch}
        areaFilter={areaFilter} onAreaFilter={setAreaFilter} areaOptions={areaOptions} noAreaCount={counts.area}
        unassignedContacts={unassignedContacts}
      />

      {isError ? (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444]">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Couldn't load spreadsheets.
          <button type="button" onClick={() => refetch()} className="ml-auto font-semibold underline">Try again</button>
        </div>
      ) : (
        <section className="glass-in rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] overflow-hidden" style={{ '--d': '160ms' }}>
          {/* column heads */}
          <div className="hidden md:grid grid-cols-[auto_minmax(0,2.4fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto] items-center gap-x-4 px-4 py-2.5 border-b border-[#F1EFEC] dark:border-[#2A2A2A] bg-[#FAFAF9]/80 dark:bg-[#111111]/60 text-[10px] font-semibold uppercase tracking-widest text-[#9CA3AF]">
            <button type="button" onClick={toggleAll} aria-label="Select all"
              className={`w-[18px] h-[18px] rounded-md border-[1.5px] flex items-center justify-center transition-colors ${allShown || someShown ? 'bg-[#F95C4B] border-[#F95C4B]' : 'border-[#D4D4D8] dark:border-[#3F3F46] hover:border-[#F95C4B]/60'}`}>
              {allShown ? <Check className="w-3 h-3 text-white" strokeWidth={3} /> : someShown ? <Minus className="w-3 h-3 text-white" strokeWidth={3} /> : null}
            </button>
            <span>Spreadsheet</span><span>Area</span><span>Assigned</span><span>With</span><span className="w-[92px]" />
          </div>

          {isLoading ? (
            <div className="divide-y divide-[#F5F5F4] dark:divide-[#202020]">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                  <span className="shimmer w-[18px] h-[18px] rounded-md" /><span className="shimmer w-10 h-10 rounded-xl" />
                  <span className="flex-1 space-y-1.5"><span className="block shimmer h-3 w-1/2 rounded" /><span className="block shimmer h-2.5 w-1/4 rounded" /></span>
                  <span className="shimmer w-24 h-8 rounded-xl" />
                </div>
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <span className="w-14 h-14 rounded-2xl bg-[#10B981]/10 flex items-center justify-center mb-3 mac-pop"><FileSpreadsheet className="w-7 h-7 text-[#10B981]" strokeWidth={1.5} /></span>
              <h3 className="text-base font-bold text-[#111111] dark:text-white">No spreadsheets yet</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mt-1 max-w-xs">Upload an Excel file — then hand it to a cold caller in two clicks.</p>
              <button type="button" onClick={onUpload} className="mac-press mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A]"><Upload className="w-4 h-4" /> Upload spreadsheet</button>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              {filter === 'open' && !q && !areaFilter ? (
                <>
                  <span className="w-14 h-14 rounded-full bg-[#10B981]/10 flex items-center justify-center mb-3 mac-pop"><CheckCircle2 className="w-7 h-7 text-[#10B981]" strokeWidth={1.6} /></span>
                  <h3 className="text-sm font-bold text-[#111111] dark:text-white">Every file has a caller</h3>
                  <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-1">Nothing waiting. Upload a new spreadsheet when you have one.</p>
                </>
              ) : (
                <>
                  <Inbox className="w-9 h-9 text-[#9CA3AF] mb-2" strokeWidth={1.5} />
                  <h3 className="text-sm font-bold text-[#111111] dark:text-white">No files match</h3>
                  <button type="button" onClick={() => { setSearch(''); setAreaFilter(''); setFilter('all') }} className="mt-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#F95C4B] bg-[#F95C4B]/10 hover:bg-[#F95C4B]/15">Show all files</button>
                </>
              )}
            </div>
          ) : (
            <ul key={`${filter}|${areaFilter}`} className="divide-y divide-[#F5F5F4] dark:divide-[#202020]">
              {visible.slice(0, limit).map((f, i) => (
                <FileRow
                  key={f.batchId}
                  file={f}
                  index={i}
                  checked={checked.has(f.batchId)}
                  onCheck={toggle}
                  onOpen={(file) => setDetails(file.batchId)}
                  onAssign={startAssign}
                  assignLabel={targetCaller && f.areaId ? `Give to ${targetCaller.name.split(' ')[0]}` : undefined}
                  flash={flash.has(f.batchId)}
                  busy={moveMut.isPending && moveMut.variables?.batchId === f.batchId}
                />
              ))}
            </ul>
          )}
          {visible.length > limit && (
            <button type="button" onClick={() => setLimit((l) => l + PAGE)}
              className="w-full py-3 text-xs font-semibold text-[#F95C4B] border-t border-[#F1EFEC] dark:border-[#2A2A2A] hover:bg-[#F95C4B]/[0.04]">
              Show {Math.min(PAGE, visible.length - limit)} more of {(visible.length - limit).toLocaleString()}
            </button>
          )}
        </section>
      )}

      <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#9CA3AF]">
        <Hand className="w-3 h-3" /> Tick several files to give them to one caller at once · click a file for its contacts and history
      </p>

      {/* Floating selection bar */}
      {selectedFiles.length > 0 && (
        <SelectionBar
          files={selectedFiles} contacts={selectedContacts} noArea={selectedNoArea}
          onClear={() => setChecked(new Set())}
          onAssign={(anchorEl) => {
            if (selectedNoArea) { toast.error(`${selectedNoArea} selected file${selectedNoArea === 1 ? ' has' : 's have'} no area yet — set it first`); return }
            if (targetCaller) { setConfirm({ files: selectedFiles, person: targetCaller, bulk: true }); return }
            setPicker({ files: selectedFiles, anchorEl })
          }}
          targetName={targetCaller?.name}
        />
      )}

      {picker && (
        <CallerPicker
          anchorEl={picker.anchorEl}
          files={pickerFiles}
          title={pickerFiles.length === 1 ? `Assign ${pickerFiles[0]?.displayName ?? ''}` : `Assign ${pickerFiles.length} files`}
          subtitle={pickerFiles.length === 1
            ? `${(pickerFiles[0]?.contactCount ?? 0).toLocaleString()} contacts${pickerFiles[0]?.areaName ? ` · ${pickerFiles[0].areaName}` : ''}`
            : `${pickerFiles.reduce((s, f) => s + f.contactCount, 0).toLocaleString()} contacts to one cold caller`}
          callers={callers}
          loading={callersLoading}
          areas={areas}
          settingArea={moveMut.isPending}
          onSetArea={(file, areaId) => moveMut.mutate({ batchId: file.batchId, areaId })}
          onPick={onPick}
          onClose={() => setPicker(null)}
        />
      )}

      {confirm && !confirm.bulk && (
        <AssignSheet mode="admin" file={confirm.file} person={confirm.person} pending={assignMut.isPending}
          onCancel={() => setConfirm(null)} onConfirm={() => assignMut.mutate(confirm)} />
      )}
      {confirm?.bulk && (
        <BulkAssignSheet files={confirm.files} person={confirm.person} pending={bulkBusy} progress={bulkProgress}
          onCancel={() => setConfirm(null)} onConfirm={() => runBulk(confirm)} />
      )}

      {detailFile && (
        <SidePanel onClose={() => setDetails(null)} icon={FileSpreadsheet} iconColor="#10B981" title={detailFile.displayName}
          subtitle={`${detailFile.contactCount.toLocaleString()} contacts · uploaded ${format(new Date(detailFile.createdAt), 'd MMM yyyy')}`}>
          <FileDetails
            key={detailFile.batchId}
            mode="admin"
            bare
            dragHint={false}
            file={detailFile}
            areas={areas}
            people={callers}
            moving={moveMut.isPending && moveMut.variables?.batchId === detailFile.batchId}
            onMove={(file, areaId) => areaId !== file.areaId && moveMut.mutate({ batchId: file.batchId, areaId })}
            onAssign={(file, person) => { setDetails(null); setConfirm({ file, person }) }}
            onClose={() => setDetails(null)}
            onViewContacts={(f) => { setDetails(null); setViewing(f) }}
            onDelete={(f) => setToDelete(f)}
          />
        </SidePanel>
      )}
      {viewing && <FileContactsPanel file={viewing} person="cold caller" onClose={() => setViewing(null)} />}
      {toDelete && (
        <DeleteFileDialog file={toDelete} pending={deleteMut.isPending} onClose={() => setToDelete(null)} onConfirm={() => deleteMut.mutate(toDelete.batchId)} />
      )}
    </div>
  )
}

/* ─── Toolbar ────────────────────────────────────────────────────────────── */

function LayoutToggle({ layout, onLayout }) {
  return (
    <div className="liquid-glass inline-flex items-center p-1 rounded-xl" role="group" aria-label="Layout">
      {[['list', LayoutList, 'List'], ['board', Columns3, 'Board by area']].map(([k, Icon, label]) => (
        <button key={k} type="button" onClick={() => onLayout(k)} title={label} aria-pressed={layout === k}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${
            layout === k ? 'bg-white dark:bg-white/15 text-[#111111] dark:text-white shadow-sm' : 'text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'
          }`}>
          <Icon className="w-3.5 h-3.5" /><span className="hidden sm:inline">{k === 'list' ? 'List' : 'Board'}</span>
        </button>
      ))}
    </div>
  )
}

function Toolbar({ layout, onLayout, boardMode, filter, onFilter, counts, total, search, onSearch, areaFilter, onAreaFilter, areaOptions, noAreaCount, unassignedContacts }) {
  if (boardMode) {
    return (
      <div className="glass-in flex items-center gap-3" style={{ '--d': '100ms' }}>
        <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Drag files between areas, or onto a cold caller to assign them.</p>
        <div className="ml-auto"><LayoutToggle layout={layout} onLayout={onLayout} /></div>
      </div>
    )
  }
  const tabs = [
    { key: 'open', label: 'To assign', icon: Users, count: counts.open },
    { key: 'done', label: 'Assigned', icon: UserCheck, count: counts.done },
    { key: 'all', label: 'All files', icon: FileSpreadsheet, count: total },
  ]
  return (
    <div className="glass-in flex flex-col xl:flex-row xl:items-center gap-3" style={{ '--d': '100ms' }}>
      <div className="flex items-center gap-3 min-w-0">
        <LiquidTabs tabs={tabs} value={filter} onChange={onFilter} />
        {filter === 'open' && unassignedContacts > 0 && (
          <span className="hidden lg:inline text-xs text-[#6B7280] dark:text-[#A1A1AA] whitespace-nowrap"><b className="text-[#111111] dark:text-white">{unassignedContacts.toLocaleString()}</b> contacts waiting</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
        <div className="relative flex-1 min-w-[200px] sm:w-64 sm:flex-none">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
          <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search files, areas, callers…"
            className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm bg-white/80 dark:bg-[#181818]/80 backdrop-blur border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#9CA3AF] outline-none focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/15" />
          {search && <button type="button" onClick={() => onSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF] pointer-events-none" />
          <select value={areaFilter} onChange={(e) => onAreaFilter(e.target.value)}
            className={`appearance-none pl-8 pr-8 py-2.5 rounded-xl text-sm border outline-none cursor-pointer max-w-[200px] ${
              areaFilter ? 'border-[#F95C4B]/50 bg-[#F95C4B]/[0.06] text-[#F95C4B] font-semibold' : 'bg-white/80 dark:bg-[#181818]/80 border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white'
            }`}>
            <option value="">All areas</option>
            {noAreaCount > 0 && <option value="__none__">No area yet ({noAreaCount})</option>}
            {areaOptions.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.n})</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF] pointer-events-none" />
        </div>
        <LayoutToggle layout={layout} onLayout={onLayout} />
      </div>
    </div>
  )
}

function SelectionBar({ files, contacts, noArea, onClear, onAssign, targetName }) {
  const ref = useRef(null)
  return createPortal(
    <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 pointer-events-none">
      <div className="selection-bar-in pointer-events-auto liquid-glass-solid flex items-center gap-3 pl-4 pr-2 py-2 rounded-2xl shadow-[0_24px_60px_-18px_rgba(17,17,17,0.5)]">
        <span className="w-8 h-8 rounded-lg bg-[#F95C4B] text-white text-xs font-bold flex items-center justify-center mac-pop" key={files.length}>{files.length}</span>
        <div className="text-xs leading-tight">
          <p className="font-bold text-[#111111] dark:text-white">{files.length} file{files.length === 1 ? '' : 's'} selected</p>
          <p className="text-[#6B7280] dark:text-[#A1A1AA]">{contacts.toLocaleString()} contacts{noArea ? ` · ${noArea} without an area` : ''}</p>
        </div>
        <button ref={ref} type="button" onClick={() => onAssign(ref.current)}
          className="mac-press ml-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-sm shadow-[#F95C4B]/30">
          <UserCheck className="w-3.5 h-3.5" /> {targetName ? `Give to ${targetName.split(' ')[0]}` : 'Assign to…'}
        </button>
        <button type="button" onClick={onClear} aria-label="Clear selection" className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
      </div>
    </div>,
    document.body,
  )
}
