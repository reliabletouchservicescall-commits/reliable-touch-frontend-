import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, startOfDay, endOfDay, subDays } from 'date-fns'
import {
  FileSpreadsheet, Search, X, Trash2, Loader2, AlertTriangle, Inbox, CheckCircle2, UserCheck, Layers, Upload,
  ChevronLeft, ChevronRight, ChevronDown, Users, Lock, FolderOpen, GripVertical, MoreHorizontal, MapPin, ArrowRightLeft,
  RotateCcw, History, Move, Plus, Map as MapIcon, PanelLeftClose, PanelLeftOpen, Hand, UserPlus, Filter,
} from 'lucide-react'
import { contactsApi } from '../../services/contactsApi'
import { areasApi } from '../../services/areasApi'
import AnimatedNumber from '../dashboard/AnimatedNumber'
import { SearchableAreaSelect, AddAreaInline, SA_PROVINCES } from '../leads/leadShared'
import SidePanel from '../common/SidePanel'
import AdminImportModal from '../contacts/ImportExcelModal'
import DuplicatesReviewModal from '../contacts/DuplicatesReviewModal'
import { ImportModal as AgencyImportModal } from '../../pages/agency/ContactsPage'

// The Excel Files board, shared by admin and a company manager. Spreadsheets sit in a
// column per area; the left sidebar lists every area grouped by province (filter by
// province or area name, drop a file on an area to move it, drag an area onto a
// province to regroup it); the people dock above the board takes a file dropped on a
// person and assigns all of its contacts to them.

const MODES = {
  admin: {
    filesKey: ['contact-files'],
    subtitle: 'Sort spreadsheets into areas, then drag a file onto a cold caller to hand them its contacts',
    people: 'Cold callers',
    person: 'cold caller',
    aPerson: 'a cold caller',
    canRegroupAreas: true,   // area edits are admin-only on the server
    canReturn: true,         // file locks only exist for cold-caller assignment
    needsAreaToAssign: true,
  },
  agency: {
    filesKey: ['agency-excel-files'],
    subtitle: 'Every spreadsheet uploaded by you or your agents — sort by area, then drag a file onto an agent to assign it',
    people: 'Your agents',
    person: 'agent',
    aPerson: 'an agent',
    canRegroupAreas: false,
    canReturn: false,
    needsAreaToAssign: false,
  },
}

const AREA_PALETTE = ['#F95C4B', '#111111', '#10B981', '#0EA5E9', '#8B5CF6', '#E11D48', '#EA580C']
const UNASSIGNED = '__unassigned__'
const NO_PROVINCE = '__none__'
const UNALLOCATED_COLOR = '#F59E0B'

const DATE_PRESETS = [
  { key: '', label: 'Uploaded any time' },
  { key: 'today', label: 'Uploaded today' },
  { key: '7d', label: 'Uploaded last 7 days' },
  { key: '30d', label: 'Uploaded last 30 days' },
]

function dateWindow(preset) {
  const now = new Date()
  if (preset === 'today') return [startOfDay(now), endOfDay(now)]
  if (preset === '7d') return [startOfDay(subDays(now, 6)), endOfDay(now)]
  if (preset === '30d') return [startOfDay(subDays(now, 29)), endOfDay(now)]
  return null
}

export function areaColor(id) {
  let h = 0
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AREA_PALETTE[h % AREA_PALETTE.length]
}

function fmtBytes(b) {
  if (!b) return '—'
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
}

// An area's province for grouping — one of the nine, its own free text for older areas,
// or NO_PROVINCE.
function provinceOf(area) {
  const r = (area?.region ?? '').trim()
  if (!r) return NO_PROVINCE
  return SA_PROVINCES.find((p) => p.toLowerCase() === r.toLowerCase()) ?? r
}

// Who a file's contacts are with, for the card pill: admin's lock wins, otherwise the
// person holding most of them.
export function holderOf(file) {
  if (file.assignment) return { id: String(file.assignment.assignedToId), name: file.assignment.assignedToName, locked: true }
  const top = file.assignees?.[0]
  if (top) return { id: top.id, name: top.name, partial: file.assignedCount < file.contactCount || (file.assignees?.length ?? 0) > 1 }
  return null
}

/* ─── Small pieces ───────────────────────────────────────────────────────── */

export function DeleteFileDialog({ file, pending, onClose, onConfirm }) {
  return (
    <>
      <div data-lead-dialog className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lead-backdrop-in" onClick={!pending ? onClose : undefined} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="files-sheet-in pointer-events-auto w-full max-w-sm bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#EF4444]/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
            </div>
            <h3 className="font-bold text-[#111111] dark:text-white">Delete spreadsheet</h3>
          </div>
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mb-6">
            Delete <span className="font-semibold text-[#111111] dark:text-white">{file.displayName}</span> and
            all {file.contactCount.toLocaleString()} contacts imported from it? The contacts go to the Bin and can be restored.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} disabled={pending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] disabled:opacity-60">
              Cancel
            </button>
            <button onClick={onConfirm} disabled={pending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-60 flex items-center justify-center gap-2">
              {pending && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

const CONTACT_STATUS_META = {
  unassigned: { label: 'Unassigned', color: '#6B7280' },
  assigned:   { label: 'Assigned',   color: '#3B82F6' },
  contacted:  { label: 'Contacted',  color: '#F59E0B' },
  converted:  { label: 'Converted',  color: '#10B981' },
  dnc:        { label: 'Do not call', color: '#EF4444' },
}

function ContactStatusPill({ status }) {
  const meta = CONTACT_STATUS_META[status] ?? { label: status, color: '#6B7280' }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap" style={{ color: meta.color, backgroundColor: `${meta.color}15` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />{meta.label}
    </span>
  )
}

export function FileContactsPanel({ file, person, onClose }) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')

  useEffect(() => {
    const t = setTimeout(() => { setTerm(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['file-contacts', file.batchId, page, term],
    queryFn: () => contactsApi.list({ uploadBatchId: file.batchId, page, limit: 25, search: term || undefined }).then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })

  const contacts = data?.contacts ?? []
  const totalPages = data?.totalPages ?? 1

  return (
    <SidePanel
      onClose={onClose}
      icon={FileSpreadsheet}
      iconColor="#10B981"
      title={file.displayName}
      subtitle={data ? `${data.total.toLocaleString()} contact${data.total === 1 ? '' : 's'} from this spreadsheet` : 'Loading contacts…'}
      widthClass="sm:max-w-3xl"
      footer={totalPages > 1 ? (
        <div className="flex items-center justify-between w-full">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] disabled:opacity-40">
            <ChevronLeft className="w-3.5 h-3.5" /> Previous
          </button>
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Page {page} of {totalPages}</p>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] disabled:opacity-40">
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : null}
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone or address…"
            className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm bg-[#F5F5F4] dark:bg-[#202020] text-[#111111] dark:text-white outline-none ring-2 ring-transparent focus:ring-[#10B981]/20" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111]"><X className="w-3.5 h-3.5" /></button>}
        </div>

        {isError ? (
          <div className="p-4 rounded-xl bg-[#EF4444]/10 text-sm text-[#EF4444]">Couldn't load this spreadsheet's contacts.</div>
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 rounded-xl shimmer" />)}
          </div>
        ) : contacts.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-[#111111] dark:text-white">{term ? 'No contacts match' : 'No contacts in this spreadsheet'}</p>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-1">{term ? 'Try a different name, phone or address.' : 'Duplicates from this file were sent for review instead of being saved.'}</p>
          </div>
        ) : (
          <div className={`rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
            <table className="w-full text-left">
              <thead className="bg-[#FAFAF9] dark:bg-[#111111] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
                <tr>
                  {['Name', 'Phone', 'Address / Unit', person === 'agent' ? 'Agent' : 'Cold caller', 'Status'].map((h) => (
                    <th key={h} className="px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F5F4] dark:divide-[#202020]">
                {contacts.map((c) => (
                  <tr key={c._id} className="hover:bg-[#FAFAF9] dark:hover:bg-[#111111]">
                    <td className="px-3.5 py-2.5 text-sm font-semibold text-[#111111] dark:text-white truncate max-w-[180px]">{c.name}</td>
                    <td className="px-3.5 py-2.5 text-xs font-mono text-[#111111] dark:text-white whitespace-nowrap">{c.phone ?? '—'}</td>
                    <td className="px-3.5 py-2.5 text-xs text-[#6B7280] dark:text-[#A1A1AA] max-w-[220px]">
                      <p className="truncate">{c.address ?? '—'}</p>
                      {c.unitNumber && <p className="text-[10px]">Unit {c.unitNumber}</p>}
                    </td>
                    <td className="px-3.5 py-2.5 text-xs whitespace-nowrap">
                      {c.assignedTo
                        ? <span className="flex items-center gap-1.5 text-[#111111] dark:text-white"><UserCheck className="w-3.5 h-3.5 text-[#3B82F6]" />{c.assignedTo.firstName} {c.assignedTo.lastName}</span>
                        : <span className="italic text-[#F59E0B]">Unassigned</span>}
                    </td>
                    <td className="px-3.5 py-2.5"><ContactStatusPill status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SidePanel>
  )
}

function StatTile({ icon: Icon, label, value, color, emphasise, delay, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`mac-in mac-lift text-left flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-colors disabled:cursor-default ${
        active ? 'border-[#F95C4B]/60 ring-2 ring-[#F95C4B]/15 bg-[#F95C4B]/[0.05]'
          : emphasise ? 'border-[#F59E0B]/50 bg-[#F59E0B]/[0.06]' : 'border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818]'
      }`}
      style={{ '--d': `${delay}ms` }}
    >
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color === '#111111' ? 'dark:!bg-white/10' : ''}`} style={{ backgroundColor: `${color}16` }}>
        <Icon className={`w-5 h-5 ${color === '#111111' ? 'dark:!text-white' : ''}`} style={{ color }} strokeWidth={1.8} />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-[#6B7280] dark:text-[#A1A1AA]">{label}</span>
        <span className="block text-2xl font-bold text-[#111111] dark:text-white tracking-tight"><AnimatedNumber value={value} /></span>
      </span>
    </button>
  )
}

export function StatusPill({ file }) {
  if (!file.areaId) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F59E0B]/12 text-[#B45309] dark:text-[#F59E0B] border border-[#F59E0B]/30">
        <AlertTriangle className="w-3 h-3" /> Needs an area
      </span>
    )
  }
  const holder = holderOf(file)
  if (holder) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F95C4B]/10 text-[#F95C4B] max-w-full" title={holder.partial ? 'Some contacts are with other people or still unassigned' : undefined}>
        {holder.locked ? <Lock className="w-3 h-3 flex-shrink-0" /> : <UserCheck className="w-3 h-3 flex-shrink-0" />}
        <span className="truncate">{holder.name}</span>{holder.partial && <span className="opacity-70">+</span>}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#10B981]/10 text-[#059669] dark:text-[#34D399]">
      <CheckCircle2 className="w-3 h-3" /> Available
    </span>
  )
}

/* ─── Sidebar: provinces & areas ─────────────────────────────────────────── */

function SidebarRow({ active, onClick, color, label, sub, count, icon: Icon, dropProps, dropOver, draggableProps, dimmed }) {
  return (
    <li
      {...dropProps}
      {...draggableProps}
      onClick={onClick}
      className={`group flex items-center gap-2.5 pl-2.5 pr-2 py-2 rounded-xl cursor-pointer select-none transition-all duration-200 ${
        dropOver ? 'bg-[#F95C4B]/12 ring-2 ring-[#F95C4B] scale-[1.02] files-drop-glow'
          : active ? 'bg-[#F95C4B]/10 text-[#F95C4B]'
            : 'hover:bg-[#F5F5F4] dark:hover:bg-[#202020]'
      } ${dimmed ? 'opacity-40' : ''}`}
    >
      {Icon
        ? <Icon className={`w-4 h-4 flex-shrink-0 ${color === '#111111' ? 'dark:!text-white' : ''}`} style={{ color }} />
        : <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-white dark:ring-[#181818] ${color === '#111111' ? 'dark:!bg-white' : ''}`} style={{ backgroundColor: color }} />}
      <span className="min-w-0 flex-1">
        <span className={`block text-[13px] truncate ${active ? 'font-semibold' : 'font-medium text-[#111111] dark:text-white'}`}>{label}</span>
        {sub && <span className="block text-[10px] text-[#9CA3AF] truncate">{sub}</span>}
      </span>
      {draggableProps?.draggable && <GripVertical className="w-3.5 h-3.5 text-[#D4D4D8] dark:text-[#3F3F46] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />}
      {count != null && (
        <span className={`min-w-[22px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${
          active ? 'bg-[#F95C4B] text-white' : count ? 'bg-[#111111]/[0.06] dark:bg-white/10 text-[#111111] dark:text-white' : 'text-[#9CA3AF]'
        }`}>{count}</span>
      )}
    </li>
  )
}

function AreaSidebar({
  mode, areas, files, province, onProvince, areaQuery, onAreaQuery, selected, onSelect,
  dragging, dragOver, setDragOver, onDropFile, onDropArea, onAreaDragStart, onDragEnd, collapsed, onCollapse,
}) {
  const cfg = MODES[mode]
  const [closedGroups, setClosedGroups] = useState(() => new Set())
  const [addingIn, setAddingIn] = useState(null) // province to create a new area in ('' = pick)

  const stats = useMemo(() => {
    const m = {}
    files.forEach((f) => {
      const k = f.areaId || UNASSIGNED
      const s = (m[k] ??= { files: 0, contacts: 0 })
      s.files += 1
      s.contacts += f.contactCount ?? 0
    })
    return m
  }, [files])

  // Provinces to list: all nine, any older free-text regions, then "No province"
  const extraRegions = [...new Set(areas.map(provinceOf))].filter((p) => p !== NO_PROVINCE && !SA_PROVINCES.includes(p)).sort()
  const allGroups = [...SA_PROVINCES, ...extraRegions, NO_PROVINCE]
  const areasIn = (p) => areas.filter((a) => provinceOf(a) === p)
  const filesIn = (list) => list.reduce((s, a) => s + (stats[a._id]?.files ?? 0), 0)

  const q = areaQuery.trim().toLowerCase()
  const groups = allGroups
    .filter((p) => !province || p === province)
    .map((p) => ({ key: p, label: p === NO_PROVINCE ? 'No province' : p, areas: areasIn(p).filter((a) => !q || a.name.toLowerCase().includes(q)) }))
    // while searching, only show provinces with a match; otherwise show every province so
    // areas can be dropped into an empty one
    .filter((g) => !q || g.areas.length)
    .filter((g) => g.key !== NO_PROVINCE || g.areas.length || dragging?.kind === 'area')

  const totalFiles = files.length
  const draggingFile = dragging?.kind === 'file'
  const draggingArea = dragging?.kind === 'area'

  if (collapsed) {
    return (
      <aside className="mac-in hidden lg:flex flex-col items-center gap-2 w-14 py-3 rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] lg:sticky lg:top-4" style={{ '--d': '60ms' }}>
        <button type="button" onClick={() => onCollapse(false)} title="Show areas"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-[#6B7280] hover:bg-[#F95C4B]/10 hover:text-[#F95C4B] transition-colors">
          <PanelLeftOpen className="w-4.5 h-4.5" />
        </button>
        <span className="w-6 h-px bg-[#E5E7EB] dark:bg-[#2A2A2A]" />
        <MapIcon className="w-4 h-4 text-[#F95C4B]" />
        {(province || selected) && <span className="w-2 h-2 rounded-full bg-[#F95C4B]" title="A filter is on" />}
      </aside>
    )
  }

  return (
    <aside className="mac-in flex flex-col rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] overflow-hidden lg:sticky lg:top-4 lg:max-h-[calc(100vh-120px)]" style={{ '--d': '60ms' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 space-y-3 border-b border-[#F1EFEC] dark:border-[#2A2A2A]">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-[#F95C4B]/10 flex items-center justify-center"><MapIcon className="w-4 h-4 text-[#F95C4B]" /></span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#111111] dark:text-white leading-tight">Areas</p>
            <p className="text-[10px] text-[#9CA3AF]">{areas.length} areas · {SA_PROVINCES.length} provinces</p>
          </div>
          <button type="button" onClick={() => setAddingIn(province && province !== NO_PROVINCE ? province : '')} title="New area"
            className="mac-press w-8 h-8 rounded-lg flex items-center justify-center text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-sm shadow-[#F95C4B]/30">
            <Plus className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => onCollapse(true)} title="Hide areas"
            className="hidden lg:flex w-8 h-8 rounded-lg items-center justify-center text-[#6B7280] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Province dropdown */}
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#F95C4B] pointer-events-none" />
          <select value={province} onChange={(e) => onProvince(e.target.value)}
            className={`w-full appearance-none pl-8 pr-8 py-2 rounded-xl text-xs font-semibold outline-none cursor-pointer border transition-colors ${
              province ? 'bg-[#F95C4B]/8 border-[#F95C4B]/40 text-[#F95C4B]' : 'bg-[#F5F5F4] dark:bg-[#202020] border-transparent text-[#111111] dark:text-white'
            } focus:ring-2 focus:ring-[#F95C4B]/20`}>
            <option value="">All provinces</option>
            {allGroups.map((p) => (
              <option key={p} value={p}>{p === NO_PROVINCE ? 'No province' : p} ({areasIn(p).length})</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF] pointer-events-none" />
        </div>

        {/* Area name filter */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF] pointer-events-none" />
          <input value={areaQuery} onChange={(e) => onAreaQuery(e.target.value)} placeholder="Filter by area name…"
            className="w-full pl-8 pr-8 py-2 rounded-xl text-xs bg-[#F5F5F4] dark:bg-[#202020] text-[#111111] dark:text-white placeholder:text-[#9CA3AF] outline-none border border-transparent focus:border-[#F95C4B]/50 focus:ring-2 focus:ring-[#F95C4B]/15" />
          {areaQuery && (
            <button type="button" onClick={() => onAreaQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#111111] dark:hover:text-white"><X className="w-3.5 h-3.5" /></button>
          )}
        </div>

        {addingIn !== null && (
          <div className="files-collapse">
            <AddAreaInline
              key={addingIn}
              defaultRegion={addingIn}
              onCancel={() => setAddingIn(null)}
              onCreated={(area) => { setAddingIn(null); onSelect(area._id) }}
            />
          </div>
        )}
      </div>

      {/* Drag hint */}
      {(draggingFile || draggingArea) && (
        <div className="files-collapse mx-3 mt-3 px-3 py-2 rounded-xl bg-[#F95C4B]/10 text-[11px] font-semibold text-[#F95C4B] flex items-center gap-2">
          <Hand className="w-3.5 h-3.5" />
          {draggingFile ? 'Drop on an area to move the file' : `Drop on a province to move ${dragging.area.name}`}
        </div>
      )}

      {/* List */}
      <ul className="thin-scroll flex-1 overflow-y-auto p-2 space-y-0.5 min-h-[160px] max-h-[50vh] lg:max-h-none">
        <SidebarRow
          icon={Layers} color="#111111" label="All areas" sub={province ? `in ${province === NO_PROVINCE ? 'no province' : province}` : null}
          count={totalFiles} active={!selected} onClick={() => onSelect(null)}
        />
        <SidebarRow
          icon={AlertTriangle} color={UNALLOCATED_COLOR} label="Unallocated" sub="Files waiting for an area"
          count={stats[UNASSIGNED]?.files ?? 0} active={selected === UNASSIGNED} onClick={() => onSelect(selected === UNASSIGNED ? null : UNASSIGNED)}
        />

        {groups.map((g) => {
          const closed = closedGroups.has(g.key) && !q
          const over = draggingArea && dragOver === `prov:${g.key}`
          const canDropArea = draggingArea && cfg.canRegroupAreas && provinceOf(dragging.area) !== g.key
          return (
            <li key={g.key} className="pt-2">
              <div
                onDragOver={(e) => { if (!canDropArea) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOver !== `prov:${g.key}`) setDragOver(`prov:${g.key}`) }}
                onDragLeave={() => over && setDragOver(null)}
                onDrop={(e) => { e.preventDefault(); if (canDropArea) onDropArea(dragging.area, g.key === NO_PROVINCE ? null : g.key) }}
                className={`group/prov flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all duration-200 ${
                  over ? 'bg-[#F95C4B]/12 ring-2 ring-[#F95C4B] files-drop-glow' : canDropArea ? 'outline-1 outline-dashed outline-[#F95C4B]/50 bg-[#F95C4B]/[0.03]' : ''
                }`}
              >
                <button type="button" onClick={() => setClosedGroups((s) => { const n = new Set(s); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n })}
                  className="flex-1 min-w-0 flex items-center gap-1.5 text-left">
                  <ChevronDown className={`w-3.5 h-3.5 text-[#9CA3AF] transition-transform duration-300 ${closed ? '-rotate-90' : ''}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-widest truncate ${over ? 'text-[#F95C4B]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>{g.label}</span>
                  <span className="text-[10px] text-[#9CA3AF]">· {g.areas.length}{filesIn(g.areas) ? ` · ${filesIn(g.areas)} files` : ''}</span>
                </button>
                {g.key !== NO_PROVINCE && (
                  <button type="button" onClick={() => setAddingIn(g.key)} title={`New area in ${g.label}`}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[#9CA3AF] opacity-0 group-hover/prov:opacity-100 focus:opacity-100 hover:bg-[#F95C4B]/10 hover:text-[#F95C4B] transition-all">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {!closed && (
                <ul className="files-collapse mt-0.5 space-y-0.5">
                  {g.areas.map((a) => {
                    const s = stats[a._id]
                    const fileOver = draggingFile && dragOver === a._id
                    const sameArea = draggingFile && dragging.file.areaId === a._id
                    return (
                      <SidebarRow
                        key={a._id}
                        color={areaColor(a._id)}
                        label={a.name}
                        sub={s ? `${s.contacts.toLocaleString()} contacts` : 'No files yet'}
                        count={s?.files ?? 0}
                        active={selected === a._id}
                        dimmed={sameArea || (draggingArea && dragging.area._id === a._id)}
                        dropOver={fileOver}
                        onClick={() => onSelect(selected === a._id ? null : a._id)}
                        dropProps={{
                          onDragOver: (e) => { if (!draggingFile || sameArea) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOver !== a._id) setDragOver(a._id) },
                          onDragLeave: () => fileOver && setDragOver(null),
                          onDrop: (e) => { e.preventDefault(); if (draggingFile && !sameArea) onDropFile(dragging.file, a._id) },
                        }}
                        draggableProps={cfg.canRegroupAreas ? {
                          draggable: true,
                          onDragStart: (e) => onAreaDragStart(e, a),
                          onDragEnd,
                        } : undefined}
                      />
                    )
                  })}
                  {g.areas.length === 0 && (
                    <li>
                      <button type="button" onClick={() => setAddingIn(g.key === NO_PROVINCE ? '' : g.key)}
                        className="w-full flex items-center gap-2 pl-8 pr-2 py-1.5 rounded-lg text-[11px] text-[#9CA3AF] hover:text-[#F95C4B] hover:bg-[#F95C4B]/5 transition-colors">
                        <Plus className="w-3 h-3" /> {cfg.canRegroupAreas ? 'Add an area — or drag one here' : 'Add an area'}
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </li>
          )
        })}
        {q && groups.length === 0 && (
          <li className="py-6 text-center text-[11px] text-[#9CA3AF]">No area called “{areaQuery}”</li>
        )}
      </ul>

      <p className="px-4 py-3 border-t border-[#F1EFEC] dark:border-[#2A2A2A] text-[10px] text-[#9CA3AF] leading-relaxed">
        Drop a file on an area to move it.{cfg.canRegroupAreas ? ' Drag an area onto a province to regroup it.' : ''}
      </p>
    </aside>
  )
}

/* ─── People dock: drag a file onto a person to assign it ────────────────── */

function PeopleDock({ mode, people, loading, files, dragging, dragOver, setDragOver, onDropFile, holderFilter, onHolderFilter }) {
  const cfg = MODES[mode]
  const [q, setQ] = useState('')
  const draggingFile = dragging?.kind === 'file'
  const filesBy = useMemo(() => {
    const m = {}
    files.forEach((f) => { const h = holderOf(f); if (h) (m[h.id] ??= []).push(f) })
    return m
  }, [files])
  const list = people.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))
  const blocked = draggingFile && cfg.needsAreaToAssign && !dragging.file.areaId

  return (
    <section
      className={`mac-in rounded-2xl border bg-white dark:bg-[#181818] transition-all duration-300 ${
        draggingFile && !blocked ? 'border-[#F95C4B]/60 shadow-[0_18px_40px_-24px_rgba(249,92,75,0.55)]' : 'border-[#E5E7EB] dark:border-[#2A2A2A]'
      }`}
      style={{ '--d': '120ms' }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3.5">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${draggingFile ? 'bg-[#F95C4B] text-white' : 'bg-[#F95C4B]/10 text-[#F95C4B]'}`}>
          <UserPlus className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#111111] dark:text-white leading-tight">{cfg.people}</p>
          <p className={`text-[11px] transition-colors ${blocked ? 'text-[#B45309] dark:text-[#F59E0B] font-semibold' : draggingFile ? 'text-[#F95C4B] font-semibold' : 'text-[#9CA3AF]'}`}>
            {blocked ? 'Give this file an area first — drop it on an area in the sidebar'
              : draggingFile ? `Drop ${dragging.file.displayName} on ${cfg.aPerson} to assign its ${dragging.file.contactCount.toLocaleString()} contacts`
                : `Drag a file onto ${cfg.aPerson} to assign it · click someone to see their files`}
          </p>
        </div>
        {holderFilter && (
          <button type="button" onClick={() => onHolderFilter(null)}
            className="files-collapse inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F95C4B] text-white">
            <Filter className="w-3 h-3" /> {people.find((p) => p.id === holderFilter)?.name ?? 'Person'}'s files <X className="w-3 h-3" />
          </button>
        )}
        {people.length > 6 && (
          <div className="relative w-44">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF] pointer-events-none" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find a ${cfg.person}…`}
              className="w-full pl-8 pr-2 py-1.5 rounded-lg text-xs bg-[#F5F5F4] dark:bg-[#202020] text-[#111111] dark:text-white placeholder:text-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#F95C4B]/20" />
          </div>
        )}
      </div>
      <div className="thin-scroll flex gap-2.5 overflow-x-auto px-4 pt-3 pb-3.5">
        {loading && Array.from({ length: 5 }, (_, i) => <div key={i} className="shimmer w-[190px] h-[58px] rounded-xl flex-shrink-0" />)}
        {!loading && list.length === 0 && (
          <p className="text-xs text-[#9CA3AF] py-3">{people.length ? 'Nobody matches' : `No active ${cfg.person}s yet`}</p>
        )}
        {list.map((p, i) => {
          const over = draggingFile && !blocked && dragOver === `person:${p.id}`
          const theirs = filesBy[p.id]?.length ?? 0
          const isHolder = draggingFile && holderOf(dragging.file)?.id === p.id && !holderOf(dragging.file)?.partial
          const active = holderFilter === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onHolderFilter(active ? null : p.id)}
              onDragOver={(e) => { if (!draggingFile || blocked || isHolder) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (dragOver !== `person:${p.id}`) setDragOver(`person:${p.id}`) }}
              onDragLeave={() => over && setDragOver(null)}
              onDrop={(e) => { e.preventDefault(); if (draggingFile && !blocked && !isHolder) onDropFile(dragging.file, p) }}
              className={`mac-in group flex items-center gap-2.5 w-[200px] flex-shrink-0 text-left rounded-xl border px-2.5 py-2 transition-all duration-200 ${
                over ? 'border-[#F95C4B] bg-[#F95C4B]/10 scale-[1.05] -translate-y-0.5 files-drop-glow'
                  : active ? 'border-[#F95C4B]/60 bg-[#F95C4B]/[0.06] ring-2 ring-[#F95C4B]/15'
                    : draggingFile && !blocked && !isHolder ? 'border-dashed border-[#F95C4B]/50 bg-[#FAFAF9] dark:bg-[#1C1C1C]'
                      : 'border-[#ECEAE7] dark:border-[#2A2A2A] hover:border-[#F95C4B]/40 hover:-translate-y-0.5'
              } ${isHolder || blocked ? 'opacity-40' : ''}`}
              style={{ '--d': `${140 + Math.min(i, 10) * 30}ms` }}
            >
              <span className={`relative w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-colors ${
                over ? 'bg-[#F95C4B] text-white' : 'bg-gradient-to-br from-[#F95C4B] to-[#E11D48] text-white'
              }`}>
                {initials(p.name)}
                {theirs > 0 && (
                  <span className="absolute -bottom-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#111111] dark:bg-white text-white dark:text-[#111111] text-[9px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-[#181818]">{theirs}</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-[#111111] dark:text-white truncate">{p.name}{p.isManager ? ' (you)' : ''}</span>
                <span className="block text-[10px] text-[#9CA3AF] truncate">
                  {over ? 'Release to assign' : `${p.remaining.toLocaleString()} to call · ${theirs} file${theirs === 1 ? '' : 's'}`}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/* ─── Confirm sheet ──────────────────────────────────────────────────────── */

export function AssignSheet({ mode, file, person, pending, onCancel, onConfirm }) {
  const cfg = MODES[mode]
  const { data: preview } = useQuery({
    queryKey: ['assign-preview', file.batchId, person.id],
    queryFn: () => contactsApi.assignPreview({ uploadBatchId: file.batchId, callerId: person.id }).then((r) => r.data.data),
    enabled: mode === 'admin',
    staleTime: 10_000,
  })
  const holder = holderOf(file)
  const others = (file.assignees ?? []).filter((a) => a.id !== person.id)
  const moving = others.reduce((s, a) => s + a.count, 0)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); if (!pending) onCancel() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, onCancel])

  return (
    <>
      <div data-lead-dialog className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px] lead-backdrop-in" onClick={!pending ? onCancel : undefined} />
      <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[12vh] pointer-events-none">
        <div role="dialog" aria-label="Assign file" className="files-sheet-in pointer-events-auto w-full max-w-md bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl overflow-hidden">
          {/* File → person */}
          <div className="px-6 pt-6 pb-5 bg-gradient-to-b from-[#F95C4B]/[0.07] to-transparent">
            <div className="flex items-center justify-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-[#10B981]/12 flex items-center justify-center mac-pop"><FileSpreadsheet className="w-6 h-6 text-[#10B981]" strokeWidth={1.75} /></span>
              <span className="flex items-center gap-1 text-[#F95C4B]">
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-30" /><span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" /><ChevronRight className="w-5 h-5" />
              </span>
              <span className="w-12 h-12 rounded-full bg-gradient-to-br from-[#F95C4B] to-[#E11D48] text-white text-sm font-bold flex items-center justify-center mac-pop" style={{ '--d': '80ms' }}>{initials(person.name)}</span>
            </div>
            <h3 className="mt-4 text-center text-base font-bold text-[#111111] dark:text-white">Assign to {person.name}?</h3>
            <p className="mt-1 text-center text-xs text-[#6B7280] dark:text-[#A1A1AA]">
              Every contact in <b className="text-[#111111] dark:text-white">{file.displayName}</b> goes into their queue.
            </p>
          </div>

          <dl className="mx-6 mb-4 grid grid-cols-3 rounded-xl border border-[#F1EFEC] dark:border-[#2A2A2A] divide-x divide-[#F1EFEC] dark:divide-[#2A2A2A] text-center">
            <div className="py-2.5"><dt className="text-[10px] text-[#9CA3AF]">Contacts</dt><dd className="text-sm font-bold text-[#111111] dark:text-white">{file.contactCount.toLocaleString()}</dd></div>
            <div className="py-2.5 min-w-0 px-1"><dt className="text-[10px] text-[#9CA3AF]">Area</dt><dd className="text-sm font-bold text-[#111111] dark:text-white truncate">{file.areaName ?? '—'}</dd></div>
            <div className="py-2.5"><dt className="text-[10px] text-[#9CA3AF]">Unassigned</dt><dd className="text-sm font-bold text-[#111111] dark:text-white">{(file.contactCount - (file.assignedCount ?? 0)).toLocaleString()}</dd></div>
          </dl>

          <div className="mx-6 mb-5 space-y-2 text-[11px]">
            {holder?.locked && holder.id !== person.id && (
              <p className="flex gap-2 p-2.5 rounded-lg bg-[#F59E0B]/10 text-[#B45309] dark:text-[#F59E0B]"><Lock className="w-3.5 h-3.5 flex-shrink-0 mt-px" /> Currently locked to {holder.name} — this hands the file over to {person.name}.</p>
            )}
            {moving > 0 && (
              <p className="flex gap-2 p-2.5 rounded-lg bg-[#F59E0B]/10 text-[#B45309] dark:text-[#F59E0B]"><ArrowRightLeft className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                {moving.toLocaleString()} contact{moving === 1 ? ' is' : 's are'} with {others.slice(0, 2).map((o) => o.name).join(', ')}{others.length > 2 ? ` +${others.length - 2}` : ''} and will move.</p>
            )}
            {preview?.recentlyCalledCount > 0 && (
              <p className="flex gap-2 p-2.5 rounded-lg bg-[#0EA5E9]/10 text-[#0369A1] dark:text-[#38BDF8]"><History className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                {preview.recentlyCalledCount.toLocaleString()} were called in the last {preview.windowDays} days.</p>
            )}
            {mode === 'admin' && <p className="text-[#9CA3AF]">Contacts on Do Not Call or without a phone are skipped. The file stays locked to {person.name.split(' ')[0]} until it's returned to the pool.</p>}
          </div>

          <div className="flex gap-2.5 px-6 pb-6">
            <button type="button" onClick={onCancel} disabled={pending}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] disabled:opacity-60">
              Cancel
            </button>
            <button type="button" onClick={onConfirm} disabled={pending} autoFocus
              className="mac-press flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-sm shadow-[#F95C4B]/30 disabled:opacity-60 flex items-center justify-center gap-2">
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
              <span className="whitespace-nowrap">Assign {file.contactCount.toLocaleString()} contacts</span>
            </button>
          </div>
          <p className="pb-4 -mt-3 text-center text-[10px] text-[#9CA3AF]">{cfg.person === 'agent' ? 'Your agent is notified straight away' : 'The caller is notified straight away'} · Esc to cancel</p>
        </div>
      </div>
    </>
  )
}

/* ─── Board ──────────────────────────────────────────────────────────────── */

function BoardCard({ file, selected, moving, onSelect, onDragStart, onDragEnd, index }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, file)}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(file)}
      className={`mac-in group relative cursor-grab active:cursor-grabbing rounded-xl border bg-white dark:bg-[#1C1C1C] p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        selected ? 'border-[#F95C4B] ring-2 ring-[#F95C4B]/20' : 'border-[#ECEAE7] dark:border-[#2A2A2A] hover:border-[#F95C4B]/40'
      } ${moving ? 'opacity-50' : ''}`}
      style={{ '--d': `${Math.min(index, 10) * 35}ms` }}
    >
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-lg bg-[#10B981]/10 flex items-center justify-center flex-shrink-0">
          {moving ? <Loader2 className="w-4 h-4 animate-spin text-[#10B981]" /> : <FileSpreadsheet className="w-4.5 h-4.5 text-[#10B981]" strokeWidth={1.75} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-[#111111] dark:text-white truncate uppercase tracking-tight" title={file.displayName}>{file.displayName}</p>
          <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">{file.contactCount.toLocaleString()} contacts</p>
          <p className="text-[11px] text-[#9CA3AF]">{format(new Date(file.createdAt), 'd MMM yyyy')}</p>
        </div>
        <GripVertical className="w-4 h-4 text-[#D4D4D8] dark:text-[#3F3F46] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </div>
      {file.contactCount > 0 && (
        <span className="mt-3 block h-1 rounded-full bg-[#F5F5F4] dark:bg-[#2A2A2A] overflow-hidden" title={`${(file.assignedCount ?? 0).toLocaleString()} of ${file.contactCount.toLocaleString()} assigned`}>
          <span className="block h-full rounded-full bg-[#F95C4B] transition-[width] duration-700" style={{ width: `${Math.round(((file.assignedCount ?? 0) / file.contactCount) * 100)}%` }} />
        </span>
      )}
      <div className="flex items-center justify-between gap-2 mt-2.5">
        <StatusPill file={file} />
        <MoreHorizontal className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
      </div>
    </div>
  )
}

function BoardColumn({ column, files, selectedId, movingId, dragOver, onDragOver, onDragLeave, onDrop, onSelect, onDragStart, onDragEnd, onUpload, index }) {
  const isUnallocated = column.key === UNASSIGNED
  const color = column.color
  const total = files.reduce((s, f) => s + (f.contactCount ?? 0), 0)
  return (
    <section
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`mac-in flex flex-col w-[280px] flex-shrink-0 snap-start rounded-2xl border-2 transition-all duration-200 max-h-[calc(100vh-300px)] min-h-[420px] ${
        dragOver
          ? isUnallocated ? 'border-dashed border-[#DC2626]/50 bg-[#DC2626]/[0.04]' : 'scale-[1.01] shadow-xl'
          : 'border-transparent'
      }`}
      style={{
        '--d': `${80 + index * 50}ms`,
        backgroundColor: dragOver && !isUnallocated ? `${color}14` : `${color}0D`,
        ...(dragOver && !isUnallocated ? { borderColor: color } : {}),
      }}
    >
      <header className="px-4 py-3 rounded-t-2xl flex items-center gap-2.5" style={{ backgroundColor: `${color}1F`, borderTop: `3px solid ${color}` }}>
        {isUnallocated
          ? <AlertTriangle className="w-4.5 h-4.5" style={{ color }} />
          : <FolderOpen className={`w-4.5 h-4.5 ${color === '#111111' ? 'dark:!text-white' : ''}`} style={{ color }} />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#111111] dark:text-white truncate">{column.label}</p>
          <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] truncate">
            {column.region ? `${column.region} · ` : ''}{total.toLocaleString()} contacts
          </p>
        </div>
        <span className={`min-w-[26px] h-6 px-2 rounded-full text-xs font-bold flex items-center justify-center text-white ${color === '#111111' ? 'dark:!bg-white dark:!text-[#111111]' : ''}`} style={{ backgroundColor: color }}>
          {files.length}
        </span>
      </header>

      <div className="thin-scroll flex-1 overflow-y-auto p-3 space-y-2.5">
        {files.map((f, i) => (
          <BoardCard
            key={f.batchId}
            file={f}
            index={i}
            selected={selectedId === f.batchId}
            moving={movingId === f.batchId}
            onSelect={onSelect}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
        {files.length === 0 && !isUnallocated && (
          <p className="text-[11px] text-center text-[#9CA3AF] py-6 border-2 border-dashed border-[#D4D4D8]/70 dark:border-[#3F3F46] rounded-xl">Drop a spreadsheet here</p>
        )}
        {isUnallocated && (
          <button type="button" onClick={onUpload}
            className="w-full flex flex-col items-center gap-1 py-5 rounded-xl border-2 border-dashed border-[#F59E0B]/40 text-[#B45309] dark:text-[#F59E0B] hover:bg-[#F59E0B]/[0.06] transition-colors">
            <Upload className="w-4 h-4" />
            <span className="text-xs font-semibold">Upload a spreadsheet</span>
            <span className="text-[10px] opacity-70">then drag it to its area</span>
          </button>
        )}
      </div>
      {dragOver && isUnallocated && (
        <p className="px-3 pb-3 text-[10px] text-center text-[#DC2626]">A file can't be un-allocated — drop it on an area instead</p>
      )}
    </section>
  )
}

/* ─── Details panel ──────────────────────────────────────────────────────── */

const HISTORY_META = {
  uploaded: { icon: Upload, label: 'Uploaded', color: '#0EA5E9' },
  moved: { icon: ArrowRightLeft, label: 'Moved', color: '#F59E0B' },
  assigned: { icon: UserCheck, label: 'Assigned', color: '#F95C4B' },
  returned: { icon: RotateCcw, label: 'Returned to pool', color: '#10B981' },
}

export function FileDetails({ mode, file, areas, people, onClose, onMove, moving, onAssign, onViewContacts, onDelete, dragHint = true, bare = false }) {
  const cfg = MODES[mode]
  const qc = useQueryClient()
  const [personId, setPersonId] = useState('')

  const { data: stats } = useQuery({
    queryKey: ['file-stats', file.batchId],
    queryFn: () => contactsApi.getBatchStats(file.batchId).then((r) => r.data.data),
    staleTime: 20_000,
  })
  const { data: history = [] } = useQuery({
    queryKey: ['file-history', file.batchId],
    queryFn: () => contactsApi.fileHistory(file.batchId).then((r) => r.data.data.history),
    staleTime: 10_000,
  })

  const returnMut = useMutation({
    mutationFn: () => contactsApi.returnFileToPool(file.batchId),
    onSuccess: () => {
      toast.success('File returned to the pool — it can be assigned again')
      qc.invalidateQueries({ queryKey: cfg.filesKey })
      qc.invalidateQueries({ queryKey: ['file-history', file.batchId] })
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Could not return this file'),
  })

  const area = areas.find((a) => a._id === file.areaId)
  const timeline = history.some((h) => h.type === 'uploaded')
    ? history
    : [{ type: 'uploaded', at: file.createdAt, byName: file.uploadedByName, toArea: null }, ...history]
  const canAssign = !cfg.needsAreaToAssign || file.areaId

  return (
    <div className={bare ? '' : 'mac-in bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden'} style={{ '--d': '0ms' }}>
      {!bare && (
        <div className="flex items-center gap-2 px-5 pt-4">
          <h3 className="text-sm font-bold text-[#111111] dark:text-white flex-1">File details</h3>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="px-5 py-4 flex items-start gap-3 border-b border-[#F1EFEC] dark:border-[#2A2A2A]">
        <span className="w-12 h-12 rounded-xl bg-[#10B981]/10 flex items-center justify-center flex-shrink-0">
          <FileSpreadsheet className="w-6 h-6 text-[#10B981]" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#111111] dark:text-white break-words">{file.displayName}</p>
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">{file.contactCount.toLocaleString()} contacts · {format(new Date(file.createdAt), 'd MMM yyyy')}</p>
          <div className="mt-2"><StatusPill file={file} /></div>
        </div>
      </div>

      <dl className="px-5 py-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs border-b border-[#F1EFEC] dark:border-[#2A2A2A]">
        <dt className="text-[#6B7280] dark:text-[#A1A1AA]">Current area</dt>
        <dd className="text-[#111111] dark:text-white font-medium text-right">{file.areaName ?? <span className="text-[#B45309] dark:text-[#F59E0B]">Unallocated</span>}{area?.region ? <span className="text-[#9CA3AF] font-normal"> · {area.region}</span> : null}</dd>
        {cfg.canReturn && (
          <>
            <dt className="text-[#6B7280] dark:text-[#A1A1AA]">Locked to</dt>
            <dd className="text-[#111111] dark:text-white font-medium text-right">{file.assignment ? `${file.assignment.assignedToName} · until ${format(new Date(file.assignment.expiresAt), 'd MMM')}` : 'Nobody'}</dd>
          </>
        )}
        <dt className="text-[#6B7280] dark:text-[#A1A1AA]">Uploaded by</dt>
        <dd className="text-[#111111] dark:text-white font-medium text-right">{file.uploadedByName ?? '—'}</dd>
        <dt className="text-[#6B7280] dark:text-[#A1A1AA]">File size</dt>
        <dd className="text-[#111111] dark:text-white font-medium text-right">{fmtBytes(file.size)}</dd>
        {stats && (
          <>
            <dt className="text-[#6B7280] dark:text-[#A1A1AA]">Called so far</dt>
            <dd className="text-right">
              {(() => {
                const called = (stats.perCaller ?? []).reduce((s, c) => s + c.called, 0)
                const pct = file.contactCount ? Math.round((called / file.contactCount) * 100) : 0
                return (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-20 h-1.5 rounded-full bg-[#F5F5F4] dark:bg-[#2A2A2A] overflow-hidden"><span className="block h-full bg-[#F95C4B] rounded-full" style={{ width: `${pct}%` }} /></span>
                    <b className="text-[#111111] dark:text-white">{called.toLocaleString()}</b><span className="text-[#9CA3AF]">({pct}%)</span>
                  </span>
                )
              })()}
            </dd>
          </>
        )}
      </dl>

      {(file.assignees?.length ?? 0) > 0 && (
        <div className="px-5 py-4 border-b border-[#F1EFEC] dark:border-[#2A2A2A]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-2.5">Who has its contacts</p>
          <ul className="space-y-2">
            {file.assignees.map((a) => (
              <li key={a.id} className="flex items-center gap-2.5 text-xs">
                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#F95C4B] to-[#E11D48] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">{initials(a.name)}</span>
                <span className="flex-1 min-w-0 truncate text-[#111111] dark:text-white font-medium">{a.name}</span>
                <span className="w-16 h-1.5 rounded-full bg-[#F5F5F4] dark:bg-[#2A2A2A] overflow-hidden"><span className="block h-full bg-[#F95C4B] rounded-full" style={{ width: `${Math.round((a.count / file.contactCount) * 100)}%` }} /></span>
                <b className="w-10 text-right text-[#111111] dark:text-white">{a.count.toLocaleString()}</b>
              </li>
            ))}
            {file.contactCount - file.assignedCount > 0 && (
              <li className="flex items-center gap-2.5 text-xs text-[#B45309] dark:text-[#F59E0B]">
                <span className="w-6 h-6 rounded-full border-2 border-dashed border-current flex-shrink-0" />
                <span className="flex-1">Unassigned</span>
                <b className="w-10 text-right">{(file.contactCount - file.assignedCount).toLocaleString()}</b>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="px-5 py-4 space-y-4 border-b border-[#F1EFEC] dark:border-[#2A2A2A]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Actions</p>
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold text-[#111111] dark:text-white mb-1.5"><ArrowRightLeft className="w-3.5 h-3.5 text-[#F95C4B]" /> Move to another area</p>
          <div className={moving ? 'opacity-60 pointer-events-none' : ''}>
            <SearchableAreaSelect areas={areas} value={file.areaId ?? ''} onChange={(areaId) => areaId && areaId !== file.areaId && onMove(file, areaId)} placeholder="Choose an area…" allowAdd />
          </div>
        </div>
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold text-[#111111] dark:text-white mb-1.5"><UserCheck className="w-3.5 h-3.5 text-[#F95C4B]" /> Assign to {cfg.aPerson}</p>
          {!canAssign ? (
            <p className="text-[11px] text-[#B45309] dark:text-[#F59E0B]">Give this file an area first.</p>
          ) : (
            <div className="flex gap-2">
              <select value={personId} onChange={(e) => setPersonId(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2 rounded-xl text-xs bg-[#F5F5F4] dark:bg-[#202020] text-[#111111] dark:text-white outline-none focus:ring-2 focus:ring-[#F95C4B]/20 cursor-pointer">
                <option value="">Choose {cfg.person === 'agent' ? 'an agent' : 'a caller'}…</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.isManager ? ' (you)' : ''}</option>)}
              </select>
              <button type="button" disabled={!personId} onClick={() => { const p = people.find((x) => x.id === personId); if (p) { onAssign(file, p); setPersonId('') } }}
                className="mac-press px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-40 flex items-center gap-1.5">
                Assign
              </button>
            </div>
          )}
          {dragHint && <p className="mt-1.5 text-[10px] text-[#9CA3AF] flex items-center gap-1"><Hand className="w-3 h-3" /> Or drag the card onto someone above the board</p>}
          {cfg.canReturn && file.assignment && (
            <button type="button" onClick={() => returnMut.mutate()} disabled={returnMut.isPending}
              className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#059669] dark:text-[#34D399] hover:underline disabled:opacity-50">
              <RotateCcw className="w-3.5 h-3.5" /> Return to the pool (unlock from {file.assignment.assignedToName})
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => onViewContacts(file)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            <Users className="w-3.5 h-3.5" /> View contacts
          </button>
          <button type="button" onClick={() => onDelete(file)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/8">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        <p className="flex items-center gap-2 text-xs font-bold text-[#111111] dark:text-white mb-3"><History className="w-3.5 h-3.5 text-[#F95C4B]" /> Allocation history</p>
        <ol className="relative space-y-3.5 before:absolute before:left-[11px] before:top-1 before:bottom-1 before:w-px before:border-l before:border-dashed before:border-[#D4D4D8] dark:before:border-[#3F3F46]">
          {timeline.map((h, i) => {
            const meta = HISTORY_META[h.type] ?? HISTORY_META.uploaded
            const detail = h.type === 'moved' ? `${h.fromArea ?? 'Unallocated'} → ${h.toArea}`
              : h.type === 'assigned' ? `${h.callerName ?? 'someone'}${h.contactsAffected ? ` · ${h.contactsAffected.toLocaleString()} contacts` : ''}`
                : h.type === 'uploaded' ? (h.toArea ? `into ${h.toArea}` : null) : null
            return (
              <li key={`${h.type}-${h.at}-${i}`} className="mac-slide-in relative flex gap-3" style={{ '--d': `${i * 50}ms` }}>
                <span className="relative z-10 w-6 h-6 rounded-full bg-white dark:bg-[#181818] border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: meta.color }}>
                  <meta.icon className="w-3 h-3" style={{ color: meta.color }} />
                </span>
                <div className="min-w-0 text-xs">
                  <p className="font-semibold text-[#111111] dark:text-white">{meta.label} <span className="font-normal text-[#9CA3AF]">· {format(new Date(h.at), 'd MMM yyyy, HH:mm')}</span></p>
                  {detail && <p className="text-[#6B7280] dark:text-[#A1A1AA] truncate">{detail}</p>}
                  {h.byName && <p className="text-[10px] text-[#9CA3AF]">by {h.byName}</p>}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

function howItWorks(mode) {
  const { person: who, aPerson } = MODES[mode]
  return [
    { icon: Upload, title: 'Upload', text: 'Upload an Excel file. Its contacts are imported and the file lands in Unallocated until it has an area.' },
    { icon: MapIcon, title: 'Filter by place', text: 'Use the Areas sidebar to narrow the board to one province or area, or search areas by name.' },
    { icon: Move, title: 'Drag to an area', text: 'Drag a file onto a column or an area in the sidebar. Its contacts move with it.' },
    { icon: UserCheck, title: `Drag to ${aPerson}`, text: `Drop a file on ${aPerson} above the board, confirm, and all its contacts go into their queue.` },
  ]
}

export default function ExcelFilesBoard({ mode = 'admin', embedded = false }) {
  const cfg = MODES[mode]
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const province = params.get('province') ?? ''
  const selectedArea = params.get('area') || null
  const setParam = (key, value) => setParams((prev) => {
    const p = new URLSearchParams(prev)
    if (value) p.set(key, value); else p.delete(key)
    return p
  }, { replace: true })

  const [search, setSearch] = useState('')
  const [areaQuery, setAreaQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('') // '' | 'unallocated' | 'locked' | 'open'
  const [holderFilter, setHolderFilter] = useState(null)
  const [datePreset, setDatePreset] = useState('')
  const [toDelete, setToDelete] = useState(null)
  const [importing, setImporting] = useState(false)
  const [duplicates, setDuplicates] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [dragging, setDragging] = useState(null) // { kind: 'file', file } | { kind: 'area', area }
  const [dragOver, setDragOver] = useState(null)
  const [pendingAssign, setPendingAssign] = useState(null) // { file, person }
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('rt-files-sidebar') === 'closed' } catch { return false }
  })
  const collapseSidebar = (v) => {
    setSidebarCollapsed(v)
    try { localStorage.setItem('rt-files-sidebar', v ? 'closed' : 'open') } catch { /* private mode */ }
  }

  const { data: files = [], isLoading, isError } = useQuery({
    queryKey: cfg.filesKey,
    queryFn: () => contactsApi.listFiles().then((r) => r.data.data.files),
    staleTime: 30_000,
  })
  const { data: areas = [] } = useQuery({
    queryKey: ['areas-select'],
    queryFn: () => areasApi.list({ limit: 100, isActive: true }).then((r) => r.data.data.areas),
    staleTime: 60_000,
  })
  const { data: people = [], isLoading: peopleLoading } = useQuery({
    queryKey: ['files-people', mode],
    queryFn: () => (mode === 'admin'
      ? contactsApi.callerWorkload().then((r) => r.data.data.callers.map((c) => ({ id: String(c.callerId), name: c.callerName, remaining: c.remaining ?? 0 })))
      : contactsApi.agencyWorkload().then((r) => r.data.data.agents.map((a) => ({ id: String(a.agentId), name: a.agentName, remaining: a.remaining ?? 0, isManager: a.isAgencyManager })))),
    staleTime: 30_000,
  })

  const refreshAfterAssign = (batchId) => {
    qc.invalidateQueries({ queryKey: cfg.filesKey })
    qc.invalidateQueries({ queryKey: ['files-people', mode] })
    qc.invalidateQueries({ queryKey: ['file-stats', batchId] })
    qc.invalidateQueries({ queryKey: ['file-history', batchId] })
    qc.invalidateQueries({ queryKey: ['contacts'] })
    qc.invalidateQueries({ queryKey: ['agency-contacts'] })
  }

  // Optimistic: the card jumps to its new column at once (the file listing reads Firebase
  // and is slow to refetch), and snaps back if the server says no.
  const moveMut = useMutation({
    mutationFn: ({ batchId, areaId }) => contactsApi.assignFileArea(batchId, areaId),
    onMutate: async ({ batchId, areaId }) => {
      await qc.cancelQueries({ queryKey: cfg.filesKey })
      const previous = qc.getQueryData(cfg.filesKey)
      const area = areas.find((a) => a._id === areaId)
      qc.setQueryData(cfg.filesKey, (old) => old?.map((f) => (f.batchId === batchId ? { ...f, areaId, areaName: area?.name ?? null } : f)))
      return { previous }
    },
    onSuccess: (res, { batchId }) => {
      const { areaName, contactsUpdated } = res.data.data
      toast.success(`Moved to ${areaName} — ${contactsUpdated.toLocaleString()} contact${contactsUpdated !== 1 ? 's' : ''} updated`)
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['file-history', batchId] })
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(cfg.filesKey, ctx.previous)
      toast.error(e.response?.data?.message ?? 'Could not move the file')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: cfg.filesKey }),
  })

  const assignMut = useMutation({
    mutationFn: ({ file, person }) => (mode === 'admin'
      ? contactsApi.assignByBatch({ uploadBatchId: file.batchId, callerId: person.id })
      : contactsApi.assignToAgent({ uploadBatchId: file.batchId, agentId: person.id })),
    onSuccess: (res, { file, person }) => {
      const d = res.data.data
      toast.success(`${d.assigned.toLocaleString()} contact${d.assigned !== 1 ? 's' : ''} assigned to ${person.name}`
        + (d.skippedDnc ? ` · ${d.skippedDnc} on Do Not Call skipped` : ''))
      setPendingAssign(null)
      refreshAfterAssign(file.batchId)
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Could not assign this file'),
  })

  // Regroup an area under another province (admin) — with an undo on the toast
  const regionMut = useMutation({
    mutationFn: ({ area, region }) => areasApi.update(area._id, { region }),
    onMutate: async ({ area, region }) => {
      await qc.cancelQueries({ queryKey: ['areas-select'] })
      const previous = qc.getQueryData(['areas-select'])
      qc.setQueryData(['areas-select'], (old) => old?.map((a) => (a._id === area._id ? { ...a, region } : a)))
      return { previous }
    },
    onSuccess: (_res, { area, region, undo }) => {
      if (undo) { toast.success(`${area.name} moved back`); return }
      toast.success(`${area.name} is now in ${region ?? 'no province'}`, {
        action: { label: 'Undo', onClick: () => regionMut.mutate({ area, region: area.region ?? null, undo: true }) },
      })
    },
    onError: (e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(['areas-select'], ctx.previous)
      toast.error(e.response?.data?.message ?? 'Could not change the province')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['areas-select'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (batchId) => contactsApi.deleteFile(batchId),
    onSuccess: (res, batchId) => {
      toast.success(`Deleted — ${res.data.data.contactsDeleted} contacts moved to the Bin`)
      qc.invalidateQueries({ queryKey: cfg.filesKey })
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['agency-contacts'] })
      if (selectedId === batchId) setSelectedId(null)
      setToDelete(null)
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Failed to delete file'),
  })

  const move = (file, areaId) => { if (areaId && areaId !== file.areaId) moveMut.mutate({ batchId: file.batchId, areaId }) }
  const askAssign = (file, person) => {
    if (cfg.needsAreaToAssign && !file.areaId) { toast.error('Give this file an area first'); return }
    setPendingAssign({ file, person })
  }

  /* ── Filtering ── */
  const areaById = useMemo(() => Object.fromEntries(areas.map((a) => [a._id, a])), [areas])
  const q = search.trim().toLowerCase()
  const window_ = dateWindow(datePreset)
  const matchingAreaIds = new Set(q ? areas.filter((a) => a.name.toLowerCase().includes(q)).map((a) => a._id) : [])
  const inPlace = (f) => {
    if (selectedArea === UNASSIGNED) return !f.areaId
    if (selectedArea) return f.areaId === selectedArea
    if (province) return Boolean(f.areaId) && areaById[f.areaId] && provinceOf(areaById[f.areaId]) === province
    return true
  }
  const visible = files.filter((f) => {
    if (!inPlace(f)) return false
    if (statusFilter === 'unallocated' && f.areaId) return false
    if (statusFilter === 'locked' && !f.assignment) return false
    if (statusFilter === 'open' && !(f.contactCount > (f.assignedCount ?? 0))) return false
    if (holderFilter && !(f.assignees ?? []).some((a) => a.id === holderFilter) && String(f.assignment?.assignedToId ?? '') !== holderFilter) return false
    if (q && !f.displayName.toLowerCase().includes(q) && !matchingAreaIds.has(f.areaId)
      && !(f.assignees ?? []).some((a) => a.name.toLowerCase().includes(q)) && !(f.assignment?.assignedToName ?? '').toLowerCase().includes(q)) return false
    if (window_) {
      const t = new Date(f.createdAt)
      if (t < window_[0] || t > window_[1]) return false
    }
    return true
  })

  /* ── Columns: Unallocated, then each area holding files (busiest first) ── */
  const byArea = {}
  visible.forEach((f) => { (byArea[f.areaId || UNASSIGNED] ??= []).push(f) })
  const columnFor = (id) => ({
    key: id, label: areaById[id]?.name ?? byArea[id]?.[0]?.areaName ?? 'Unknown area',
    region: areaById[id]?.region ?? null, color: areaColor(id), files: byArea[id] ?? [],
  })
  const showUnallocated = !province && (!selectedArea || selectedArea === UNASSIGNED) && (byArea[UNASSIGNED] || (!statusFilter && !holderFilter && !q))
  const areaColumns = selectedArea && selectedArea !== UNASSIGNED
    ? [columnFor(selectedArea)]
    : Object.keys(byArea).filter((k) => k !== UNASSIGNED).map(columnFor)
      .sort((a, b) => b.files.length - a.files.length || a.label.localeCompare(b.label))
  const columns = [
    ...(showUnallocated ? [{ key: UNASSIGNED, label: 'Unallocated', color: UNALLOCATED_COLOR, files: byArea[UNASSIGNED] ?? [] }] : []),
    ...(selectedArea === UNASSIGNED ? [] : areaColumns),
  ]

  const unallocated = files.filter((f) => !f.areaId).length
  const totalContacts = files.reduce((s, f) => s + (f.contactCount ?? 0), 0)
  const locked = files.filter((f) => f.assignment).length
  const openFiles = files.filter((f) => f.contactCount > (f.assignedCount ?? 0)).length
  const selected = files.find((f) => f.batchId === selectedId) ?? null
  const placeLabel = selectedArea === UNASSIGNED ? 'Unallocated'
    : selectedArea ? (areaById[selectedArea]?.name ?? 'Area')
      : province ? (province === NO_PROVINCE ? 'No province' : province) : null

  /* ── Drag & drop ── */
  function onFileDragStart(e, file) {
    e.dataTransfer.setData('application/x-rt-batch', file.batchId)
    e.dataTransfer.effectAllowed = 'copyMove'
    setDragging({ kind: 'file', file })
  }
  function onAreaDragStart(e, area) {
    e.dataTransfer.setData('application/x-rt-area', area._id)
    e.dataTransfer.effectAllowed = 'move'
    setDragging({ kind: 'area', area })
  }
  function onDragEnd() { setDragging(null); setDragOver(null) }
  function allowColumnDrop(e, key) {
    if (dragging?.kind !== 'file') return
    e.preventDefault()
    e.dataTransfer.dropEffect = key === UNASSIGNED || key === dragging.file.areaId ? 'none' : 'move'
    if (dragOver !== key) setDragOver(key)
  }
  function dropOnArea(file, areaId) {
    setDragging(null); setDragOver(null)
    if (areaId !== UNASSIGNED) move(file, areaId)
  }
  function dropOnPerson(file, person) {
    setDragging(null); setDragOver(null)
    askAssign(file, person)
  }
  function dropArea(area, region) {
    setDragging(null); setDragOver(null)
    if ((area.region ?? null) !== region) regionMut.mutate({ area, region })
  }

  const clearPlace = () => setParams((prev) => { const p = new URLSearchParams(prev); p.delete('area'); p.delete('province'); return p }, { replace: true })

  return (
    <div className={embedded ? '' : 'h-full overflow-y-auto thin-scroll bg-[#FAFAF9] dark:bg-[#0B0B0B]'}>
      <div className={embedded ? 'space-y-5' : 'p-4 sm:p-6 xl:p-8 space-y-5'}>
        {/* Header */}
        {!embedded && (
        <div className="mac-in flex flex-col lg:flex-row lg:items-center gap-4" style={{ '--d': '0ms' }}>
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet className="w-6 h-6 text-[#F95C4B]" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#111111] dark:text-white tracking-tight">Excel Files</h1>
              <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">{cfg.subtitle}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 lg:ml-auto">
            <div className="relative sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search files, areas or ${cfg.person}s…`}
                className="w-full pl-10 pr-9 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#9CA3AF] outline-none focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/15" />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]"><X className="w-3.5 h-3.5" /></button>}
            </div>
            <select value={datePreset} onChange={(e) => setDatePreset(e.target.value)}
              className="px-3 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white outline-none focus:border-[#F95C4B] cursor-pointer">
              {DATE_PRESETS.map((p) => <option key={p.key || 'any'} value={p.key}>{p.label}</option>)}
            </select>
            <button onClick={() => setImporting(true)}
              className="mac-press flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-sm shadow-[#F95C4B]/30 whitespace-nowrap">
              <Upload className="w-4 h-4" /> Upload spreadsheet
            </button>
          </div>
        </div>
        )}

        {/* Stats */}
        {!embedded && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile icon={Layers} label="Total files" value={files.length} color="#111111" delay={40} active={!statusFilter} onClick={() => setStatusFilter('')} />
          <StatTile icon={AlertTriangle} label="Unallocated" value={unallocated} color={UNALLOCATED_COLOR} emphasise={unallocated > 0 && statusFilter !== 'unallocated'} delay={80} active={statusFilter === 'unallocated'} onClick={() => setStatusFilter(statusFilter === 'unallocated' ? '' : 'unallocated')} />
          <StatTile icon={Users} label="Contacts imported" value={totalContacts} color="#10B981" delay={120} />
          {cfg.canReturn
            ? <StatTile icon={Lock} label="Locked to callers" value={locked} color="#F95C4B" delay={160} active={statusFilter === 'locked'} onClick={() => setStatusFilter(statusFilter === 'locked' ? '' : 'locked')} />
            : <StatTile icon={UserPlus} label="Files with unassigned contacts" value={openFiles} color="#F95C4B" delay={160} active={statusFilter === 'open'} onClick={() => setStatusFilter(statusFilter === 'open' ? '' : 'open')} />}
        </div>
        )}

        {isError && (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444]">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Couldn't load spreadsheets. Try refreshing.
          </div>
        )}

        <div className={`grid grid-cols-1 gap-5 items-start ${
          sidebarCollapsed ? 'lg:grid-cols-[56px_minmax(0,1fr)]' : 'lg:grid-cols-[272px_minmax(0,1fr)]'
        } ${selected ? (sidebarCollapsed ? '2xl:grid-cols-[56px_minmax(0,1fr)_350px]' : '2xl:grid-cols-[272px_minmax(0,1fr)_350px]') : ''}`}>
          <AreaSidebar
            mode={mode}
            areas={areas}
            files={files}
            province={province}
            onProvince={(p) => setParams((prev) => { const n = new URLSearchParams(prev); if (p) n.set('province', p); else n.delete('province'); n.delete('area'); return n }, { replace: true })}
            areaQuery={areaQuery}
            onAreaQuery={setAreaQuery}
            selected={selectedArea}
            onSelect={(id) => setParam('area', id)}
            dragging={dragging}
            dragOver={dragOver}
            setDragOver={setDragOver}
            onDropFile={dropOnArea}
            onDropArea={dropArea}
            onAreaDragStart={onAreaDragStart}
            onDragEnd={onDragEnd}
            collapsed={sidebarCollapsed}
            onCollapse={collapseSidebar}
          />

          {/* Board */}
          <div className="min-w-0 space-y-4">
            <PeopleDock
              mode={mode}
              people={people}
              loading={peopleLoading}
              files={files}
              dragging={dragging}
              dragOver={dragOver}
              setDragOver={setDragOver}
              onDropFile={dropOnPerson}
              holderFilter={holderFilter}
              onHolderFilter={setHolderFilter}
            />

            {placeLabel && (
              <div className="files-collapse flex items-center gap-2 text-xs">
                <span className="text-[#9CA3AF]">Showing</span>
                <button type="button" onClick={clearPlace}
                  className="inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1 rounded-full font-semibold bg-[#F95C4B]/10 text-[#F95C4B] hover:bg-[#F95C4B]/15">
                  <MapPin className="w-3 h-3" /> {placeLabel}
                  {selectedArea && province && selectedArea !== UNASSIGNED && <span className="font-normal opacity-70">· {province}</span>}
                  <X className="w-3 h-3" />
                </button>
                <span className="text-[#9CA3AF]">{visible.length} file{visible.length === 1 ? '' : 's'} · {visible.reduce((s, f) => s + (f.contactCount ?? 0), 0).toLocaleString()} contacts</span>
              </div>
            )}

            {isLoading ? (
              <div className="flex gap-4 overflow-hidden">
                {Array.from({ length: 4 }, (_, i) => <div key={i} className="shimmer w-[280px] h-[460px] rounded-2xl flex-shrink-0" />)}
              </div>
            ) : files.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A]">
                <Inbox className="w-10 h-10 text-[#F95C4B] mb-3" strokeWidth={1.5} />
                <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">No spreadsheets yet</h3>
                <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] max-w-xs">Upload an Excel file to get started.</p>
              </div>
            ) : columns.length === 0 ? (
              <div className="mac-in flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-[#181818] rounded-2xl border border-dashed border-[#E5E7EB] dark:border-[#2A2A2A]">
                <MapPin className="w-9 h-9 text-[#F95C4B] mb-3" strokeWidth={1.5} />
                <h3 className="text-sm font-bold text-[#111111] dark:text-white mb-1">No files {placeLabel ? `in ${placeLabel}` : 'match'}</h3>
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] max-w-xs">Drag a file onto one of its areas in the sidebar, or clear the filters.</p>
                <button type="button" onClick={() => { clearPlace(); setStatusFilter(''); setHolderFilter(null); setSearch('') }}
                  className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold text-[#F95C4B] bg-[#F95C4B]/10 hover:bg-[#F95C4B]/15">Show all files</button>
              </div>
            ) : (
              <div className="thin-scroll flex gap-4 overflow-x-auto pb-3 snap-x">
                {columns.map((col, i) => (
                  <BoardColumn
                    key={col.key}
                    column={col}
                    files={col.files}
                    index={i}
                    selectedId={selectedId}
                    movingId={moveMut.isPending ? moveMut.variables?.batchId : null}
                    dragOver={dragOver === col.key}
                    onDragOver={(e) => allowColumnDrop(e, col.key)}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={(e) => { e.preventDefault(); if (dragging?.kind === 'file') dropOnArea(dragging.file, col.key) }}
                    onSelect={(f) => setSelectedId(f.batchId === selectedId ? null : f.batchId)}
                    onDragStart={onFileDragStart}
                    onDragEnd={onDragEnd}
                    onUpload={() => setImporting(true)}
                  />
                ))}
              </div>
            )}
          </div>

          {selected && (
            <aside className="lg:col-start-2 2xl:col-start-auto 2xl:sticky 2xl:top-4">
              <FileDetails
                key={selected.batchId}
                mode={mode}
                file={selected}
                areas={areas}
                people={people}
                moving={moveMut.isPending && moveMut.variables?.batchId === selected.batchId}
                onMove={move}
                onAssign={askAssign}
                onClose={() => setSelectedId(null)}
                onViewContacts={setViewing}
                onDelete={setToDelete}
              />
            </aside>
          )}
        </div>

        {/* How it works */}
        {!embedded && (
        <div className="mac-in grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-[#E5E7EB] dark:border-[#2A2A2A] bg-[#E5E7EB] dark:bg-[#2A2A2A]" style={{ '--d': '300ms' }}>
          {howItWorks(mode).map((s, i) => (
            <div key={s.title} className="bg-white dark:bg-[#181818] p-5 flex gap-3">
              <span className="w-7 h-7 rounded-full bg-[#F95C4B] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
              <div>
                <p className="flex items-center gap-1.5 text-sm font-bold text-[#111111] dark:text-white"><s.icon className="w-4 h-4 text-[#F95C4B]" /> {s.title}</p>
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-1 leading-relaxed">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      {viewing && <FileContactsPanel file={viewing} person={cfg.person} onClose={() => setViewing(null)} />}

      {pendingAssign && (
        <AssignSheet
          mode={mode}
          file={pendingAssign.file}
          person={pendingAssign.person}
          pending={assignMut.isPending}
          onCancel={() => setPendingAssign(null)}
          onConfirm={() => assignMut.mutate(pendingAssign)}
        />
      )}

      {importing && (mode === 'admin' ? (
        <AdminImportModal
          onClose={() => setImporting(false)}
          onDone={() => { setImporting(false); qc.invalidateQueries({ queryKey: cfg.filesKey }) }}
          onReviewDuplicates={(dups) => { setDuplicates(dups); setImporting(false) }}
        />
      ) : (
        <AgencyImportModal isManager onClose={() => setImporting(false)} onDone={() => { setImporting(false); qc.invalidateQueries({ queryKey: cfg.filesKey }) }} />
      ))}

      {duplicates && (
        <DuplicatesReviewModal duplicates={duplicates} onClose={() => setDuplicates(null)} onDone={() => setDuplicates(null)} />
      )}

      {toDelete && (
        <DeleteFileDialog file={toDelete} pending={deleteMut.isPending} onClose={() => setToDelete(null)} onConfirm={() => deleteMut.mutate(toDelete.batchId)} />
      )}
    </div>
  )
}
