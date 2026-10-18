import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, startOfDay, endOfDay, subDays } from 'date-fns'
import {
  FileSpreadsheet, Search, X, Trash2, Loader2, AlertTriangle, Inbox, CheckCircle2, UserCheck, Layers, Upload,
  ChevronLeft, ChevronRight, Users, Lock, FolderOpen, GripVertical, MoreHorizontal, MapPin, ArrowRightLeft,
  RotateCcw, History, Move,
} from 'lucide-react'
import { contactsApi } from '../../services/contactsApi'
import { areasApi } from '../../services/areasApi'
import { usersApi } from '../../services/usersApi'
import AnimatedNumber from '../../components/dashboard/AnimatedNumber'
import { SearchableAreaSelect } from '../../components/leads/leadShared'
import ImportModal from '../../components/contacts/ImportExcelModal'
import SidePanel from '../../components/common/SidePanel'
import DuplicatesReviewModal from '../../components/contacts/DuplicatesReviewModal'

const AREA_PALETTE = ['#F95C4B', '#111111', '#10B981', '#0EA5E9', '#8B5CF6', '#E11D48', '#EA580C']
const UNASSIGNED = '__unassigned__'

const DATE_PRESETS = [
  { key: '', label: 'Any time' },
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'custom', label: 'Custom range' },
]

// Inclusive [from, to] window for the upload-date filter, or null for "no date limit".
function dateWindow(preset, from, to) {
  const now = new Date()
  if (preset === 'today') return [startOfDay(now), endOfDay(now)]
  if (preset === '7d') return [startOfDay(subDays(now, 6)), endOfDay(now)]
  if (preset === '30d') return [startOfDay(subDays(now, 29)), endOfDay(now)]
  if (preset === 'custom' && (from || to)) {
    return [from ? startOfDay(new Date(from)) : new Date(0), to ? endOfDay(new Date(to)) : new Date(8.64e15)]
  }
  return null
}

function areaColor(id) {
  let h = 0
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AREA_PALETTE[h % AREA_PALETTE.length]
}

function fmtBytes(b) {
  if (!b) return '—'
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function DeleteFileDialog({ file, pending, onClose, onConfirm }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={!pending ? onClose : undefined} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl p-6">
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

function FileContactsPanel({ file, onClose }) {
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
                  {['Name', 'Phone', 'Address / Unit', 'Cold caller', 'Status'].map((h) => (
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

/* ─── Board ──────────────────────────────────────────────────────────────── */

const UNALLOCATED_COLOR = '#F59E0B'
const DND_TYPE = 'application/x-rt-batch'

function areaRegionLabel(area) {
  return area?.region ? area.region : null
}

function StatTile({ icon: Icon, label, value, color, emphasise, delay, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mac-in mac-lift text-left flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-colors ${
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

function StatusPill({ file }) {
  if (!file.areaId) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F59E0B]/12 text-[#B45309] dark:text-[#F59E0B] border border-[#F59E0B]/30">
        <AlertTriangle className="w-3 h-3" /> Needs an area
      </span>
    )
  }
  if (file.assignment) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F95C4B]/10 text-[#F95C4B]">
        <Lock className="w-3 h-3" /> {file.assignment.assignedToName}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#10B981]/10 text-[#059669] dark:text-[#34D399]">
      <CheckCircle2 className="w-3 h-3" /> Available
    </span>
  )
}

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
      <div className="flex items-center justify-between gap-2 mt-3">
        <StatusPill file={file} />
        <MoreHorizontal className="w-4 h-4 text-[#9CA3AF]" />
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
      className={`mac-in flex flex-col w-[280px] flex-shrink-0 rounded-2xl border-2 transition-all duration-200 max-h-[calc(100vh-330px)] min-h-[420px] ${
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

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
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
          <p className="text-[11px] text-center text-[#9CA3AF] py-6">Drop a spreadsheet here</p>
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

// Every other active area as a compact drop target — so a file can be dragged to an area
// that has no spreadsheets yet without the board growing a column per area.
function OtherAreasColumn({ areas, dragOverKey, onDragOverArea, onDragLeave, onDropArea, index }) {
  const [q, setQ] = useState('')
  const list = areas.filter((a) => !q || a.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <section className="mac-in flex flex-col w-[240px] flex-shrink-0 rounded-2xl border-2 border-dashed border-[#E5E7EB] dark:border-[#2A2A2A] max-h-[calc(100vh-330px)] min-h-[420px]" style={{ '--d': `${80 + index * 50}ms` }}>
      <header className="px-4 py-3 flex items-center gap-2">
        <MapPin className="w-4 h-4 text-[#F95C4B]" />
        <p className="text-sm font-bold text-[#111111] dark:text-white flex-1">Other areas</p>
        <span className="text-[10px] text-[#9CA3AF]">{areas.length}</span>
      </header>
      <div className="px-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an area…"
          className="w-full px-3 py-2 rounded-lg text-xs bg-[#F5F5F4] dark:bg-[#202020] text-[#111111] dark:text-white placeholder:text-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#F95C4B]/20" />
      </div>
      <ul className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {list.map((a) => {
          const over = dragOverKey === a._id
          return (
            <li key={a._id}
              onDragOver={(e) => onDragOverArea(e, a._id)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDropArea(e, a._id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-all duration-150 ${
                over ? 'border-[#F95C4B] bg-[#F95C4B]/10 text-[#F95C4B] font-semibold scale-[1.02]' : 'border-[#F1EFEC] dark:border-[#2A2A2A] text-[#111111] dark:text-white'
              }`}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: areaColor(a._id) }} />
              <span className="truncate">{a.name}</span>
              {a.region && <span className="ml-auto text-[10px] text-[#9CA3AF] truncate">{a.region}</span>}
            </li>
          )
        })}
        {list.length === 0 && <li className="text-[11px] text-[#9CA3AF] text-center py-4">No areas match</li>}
      </ul>
      <p className="px-3 pb-3 text-[10px] text-[#9CA3AF] text-center">Drag a file onto an area here</p>
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

function FileDetails({ file, areas, onClose, onMove, moving, onViewContacts, onDelete }) {
  const qc = useQueryClient()
  const [callerId, setCallerId] = useState('')

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
  const { data: callersData } = useQuery({
    queryKey: ['cold-callers-select'],
    queryFn: () => usersApi.list({ role: 'cold_caller', limit: 100 }).then((r) => r.data.data),
    staleTime: 60_000,
  })
  const callers = (callersData?.users ?? []).filter((u) => u.isActive !== false)

  const refreshFile = () => {
    qc.invalidateQueries({ queryKey: ['contact-files'] })
    qc.invalidateQueries({ queryKey: ['file-stats', file.batchId] })
    qc.invalidateQueries({ queryKey: ['file-history', file.batchId] })
    qc.invalidateQueries({ queryKey: ['contacts'] })
  }

  const assignMut = useMutation({
    mutationFn: () => contactsApi.assignByBatch({ uploadBatchId: file.batchId, callerId }),
    onSuccess: (res) => {
      const d = res.data.data
      const caller = callers.find((c) => c._id === callerId)
      toast.success(`${d.assigned.toLocaleString()} contact${d.assigned !== 1 ? 's' : ''} assigned to ${caller?.firstName ?? 'the caller'}`
        + (d.skippedDnc ? ` · ${d.skippedDnc} on Do Not Call skipped` : ''))
      setCallerId('')
      refreshFile()
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Could not assign this file'),
  })
  const returnMut = useMutation({
    mutationFn: () => contactsApi.returnFileToPool(file.batchId),
    onSuccess: () => { toast.success('File returned to the pool — it can be assigned again'); refreshFile() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Could not return this file'),
  })

  const area = areas.find((a) => a._id === file.areaId)
  // Files uploaded before history existed get their upload line from the file itself.
  const timeline = history.some((h) => h.type === 'uploaded')
    ? history
    : [{ type: 'uploaded', at: file.createdAt, byName: file.uploadedByName, toArea: null }, ...history]

  return (
    <div className="mac-in bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden" style={{ '--d': '0ms' }}>
      <div className="flex items-center gap-2 px-5 pt-4">
        <h3 className="text-sm font-bold text-[#111111] dark:text-white flex-1">File details</h3>
        <button type="button" onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
          <X className="w-4 h-4" />
        </button>
      </div>

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
        <dt className="text-[#6B7280] dark:text-[#A1A1AA]">Locked to</dt>
        <dd className="text-[#111111] dark:text-white font-medium text-right">{file.assignment ? `${file.assignment.assignedToName} · until ${format(new Date(file.assignment.expiresAt), 'd MMM')}` : 'Nobody'}</dd>
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

      <div className="px-5 py-4 space-y-4 border-b border-[#F1EFEC] dark:border-[#2A2A2A]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Actions</p>
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold text-[#111111] dark:text-white mb-1.5"><ArrowRightLeft className="w-3.5 h-3.5 text-[#F95C4B]" /> Move to another area</p>
          <div className={moving ? 'opacity-60 pointer-events-none' : ''}>
            <SearchableAreaSelect areas={areas} value={file.areaId ?? ''} onChange={(areaId) => areaId && areaId !== file.areaId && onMove(file, areaId)} placeholder="Choose an area…" allowAdd />
          </div>
        </div>
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold text-[#111111] dark:text-white mb-1.5"><UserCheck className="w-3.5 h-3.5 text-[#F95C4B]" /> Assign to a cold caller</p>
          {!file.areaId ? (
            <p className="text-[11px] text-[#B45309] dark:text-[#F59E0B]">Give this file an area first.</p>
          ) : (
            <div className="flex gap-2">
              <select value={callerId} onChange={(e) => setCallerId(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2 rounded-xl text-xs bg-[#F5F5F4] dark:bg-[#202020] text-[#111111] dark:text-white outline-none focus:ring-2 focus:ring-[#F95C4B]/20 cursor-pointer">
                <option value="">Choose a caller…</option>
                {callers.map((c) => <option key={c._id} value={c._id}>{c.firstName} {c.lastName}</option>)}
              </select>
              <button type="button" disabled={!callerId || assignMut.isPending} onClick={() => assignMut.mutate()}
                className="mac-press px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-40 flex items-center gap-1.5">
                {assignMut.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Assign
              </button>
            </div>
          )}
          {file.assignment && (
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
              : h.type === 'assigned' ? `${h.callerName ?? 'a caller'}${h.contactsAffected ? ` · ${h.contactsAffected.toLocaleString()} contacts` : ''}`
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

const HOW_IT_WORKS = [
  { icon: Upload, title: 'Upload', text: 'Upload an Excel file. Contacts are imported and the file lands in Unallocated if it has no area yet.' },
  { icon: MapPin, title: 'See the area', text: 'Files are grouped into a column per area. Totals show how many contacts each area holds.' },
  { icon: Move, title: 'Drag & drop', text: 'Wrong area? Drag the file to the right column (or an area under "Other areas"). Its contacts move with it.' },
  { icon: UserCheck, title: 'Assign a caller', text: 'Open a file and assign it to a cold caller. It stays locked to them until returned to the pool.' },
]

export default function ExcelFilesPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('') // '' | 'unallocated' | 'locked'
  const [datePreset, setDatePreset] = useState('')
  const [toDelete, setToDelete] = useState(null)
  const [importing, setImporting] = useState(false)
  const [duplicates, setDuplicates] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [dragging, setDragging] = useState(null) // file being dragged
  const [dragOver, setDragOver] = useState(null)  // column key / area id under the pointer

  const { data: files = [], isLoading, isError } = useQuery({
    queryKey: ['contact-files'],
    queryFn: () => contactsApi.listFiles().then((r) => r.data.data.files),
    staleTime: 30_000,
  })
  const { data: areas = [] } = useQuery({
    queryKey: ['areas-select'],
    queryFn: () => areasApi.list({ limit: 100, isActive: true }).then((r) => r.data.data.areas),
    staleTime: 60_000,
  })

  // Optimistic: the card jumps to its new column at once (the file listing reads Firebase
  // and is slow to refetch), and snaps back if the server says no.
  const moveMut = useMutation({
    mutationFn: ({ batchId, areaId }) => contactsApi.assignFileArea(batchId, areaId),
    onMutate: async ({ batchId, areaId }) => {
      await qc.cancelQueries({ queryKey: ['contact-files'] })
      const previous = qc.getQueryData(['contact-files'])
      const area = areas.find((a) => a._id === areaId)
      qc.setQueryData(['contact-files'], (old) => old?.map((f) => (f.batchId === batchId ? { ...f, areaId, areaName: area?.name ?? null } : f)))
      return { previous }
    },
    onSuccess: (res, { batchId }) => {
      const { areaName, contactsUpdated } = res.data.data
      toast.success(`Moved to ${areaName} — ${contactsUpdated.toLocaleString()} contact${contactsUpdated !== 1 ? 's' : ''} updated`)
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['file-history', batchId] })
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(['contact-files'], ctx.previous)
      toast.error(e.response?.data?.message ?? 'Could not move the file')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['contact-files'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (batchId) => contactsApi.deleteFile(batchId),
    onSuccess: (res, batchId) => {
      toast.success(`Deleted — ${res.data.data.contactsDeleted} contacts moved to the Bin`)
      qc.invalidateQueries({ queryKey: ['contact-files'] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
      if (selectedId === batchId) setSelectedId(null)
      setToDelete(null)
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Failed to delete file'),
  })

  const move = (file, areaId) => { if (areaId && areaId !== file.areaId) moveMut.mutate({ batchId: file.batchId, areaId }) }

  /* ── Filtering ── */
  const q = search.trim().toLowerCase()
  const window_ = dateWindow(datePreset)
  const matchingAreaIds = new Set(q ? areas.filter((a) => a.name.toLowerCase().includes(q)).map((a) => a._id) : [])
  const visible = files.filter((f) => {
    if (statusFilter === 'unallocated' && f.areaId) return false
    if (statusFilter === 'locked' && !f.assignment) return false
    if (q && !f.displayName.toLowerCase().includes(q) && !matchingAreaIds.has(f.areaId) && !(f.assignment?.assignedToName ?? '').toLowerCase().includes(q)) return false
    if (window_) {
      const t = new Date(f.createdAt)
      if (t < window_[0] || t > window_[1]) return false
    }
    return true
  })

  /* ── Columns: Unallocated, then each area holding files (busiest first) ── */
  const byArea = {}
  visible.forEach((f) => { (byArea[f.areaId || UNASSIGNED] ??= []).push(f) })
  const areaById = Object.fromEntries(areas.map((a) => [a._id, a]))
  const fileAreaIds = Object.keys(byArea).filter((k) => k !== UNASSIGNED)
  const columns = [
    { key: UNASSIGNED, label: 'Unallocated', color: UNALLOCATED_COLOR, files: byArea[UNASSIGNED] ?? [] },
    ...fileAreaIds
      .map((id) => ({ key: id, label: areaById[id]?.name ?? byArea[id][0]?.areaName ?? 'Unknown area', region: areaRegionLabel(areaById[id]), color: areaColor(id), files: byArea[id] }))
      .sort((a, b) => b.files.length - a.files.length || a.label.localeCompare(b.label)),
  ]
  const allFileAreaIds = new Set(files.map((f) => f.areaId).filter(Boolean))
  const otherAreas = areas.filter((a) => !allFileAreaIds.has(a._id))

  const unallocated = files.filter((f) => !f.areaId).length
  const totalContacts = files.reduce((s, f) => s + (f.contactCount ?? 0), 0)
  const locked = files.filter((f) => f.assignment).length
  const selected = files.find((f) => f.batchId === selectedId) ?? null

  /* ── Drag & drop ── */
  function onDragStart(e, file) {
    e.dataTransfer.setData(DND_TYPE, file.batchId)
    e.dataTransfer.effectAllowed = 'move'
    setDragging(file)
  }
  function onDragEnd() { setDragging(null); setDragOver(null) }
  function allowDrop(e, key) {
    if (!dragging) return
    e.preventDefault()
    e.dataTransfer.dropEffect = key === UNASSIGNED || key === dragging.areaId ? 'none' : 'move'
    if (dragOver !== key) setDragOver(key)
  }
  function drop(e, key) {
    e.preventDefault()
    const file = dragging
    setDragging(null); setDragOver(null)
    if (!file || key === UNASSIGNED) return
    move(file, key)
  }

  return (
    <div className="h-full overflow-y-auto bg-[#FAFAF9] dark:bg-[#0B0B0B]">
      <div className="p-4 sm:p-6 xl:p-8 space-y-5">
        {/* Header */}
        <div className="mac-in flex flex-col lg:flex-row lg:items-center gap-4" style={{ '--d': '0ms' }}>
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet className="w-6 h-6 text-[#F95C4B]" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#111111] dark:text-white tracking-tight">Excel Files</h1>
              <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">Organise imported contact spreadsheets by area — drag a file to move it</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 lg:ml-auto">
            <div className="relative sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files, areas or callers…"
                className="w-full pl-10 pr-9 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#9CA3AF] outline-none focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/15" />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280]"><X className="w-3.5 h-3.5" /></button>}
            </div>
            <select value={datePreset} onChange={(e) => setDatePreset(e.target.value)}
              className="px-3 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white outline-none focus:border-[#F95C4B] cursor-pointer">
              {DATE_PRESETS.filter((p) => p.key !== 'custom').map((p) => <option key={p.key || 'any'} value={p.key}>{p.key ? `Uploaded ${p.label.toLowerCase()}` : 'Uploaded any time'}</option>)}
            </select>
            <button onClick={() => setImporting(true)}
              className="mac-press flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-sm shadow-[#F95C4B]/30 whitespace-nowrap">
              <Upload className="w-4 h-4" /> Upload spreadsheet
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile icon={Layers} label="Total files" value={files.length} color="#111111" delay={40} active={!statusFilter} onClick={() => setStatusFilter('')} />
          <StatTile icon={AlertTriangle} label="Unallocated" value={unallocated} color={UNALLOCATED_COLOR} emphasise={unallocated > 0 && statusFilter !== 'unallocated'} delay={80} active={statusFilter === 'unallocated'} onClick={() => setStatusFilter(statusFilter === 'unallocated' ? '' : 'unallocated')} />
          <StatTile icon={Users} label="Contacts imported" value={totalContacts} color="#10B981" delay={120} />
          <StatTile icon={Lock} label="Locked to callers" value={locked} color="#F95C4B" delay={160} active={statusFilter === 'locked'} onClick={() => setStatusFilter(statusFilter === 'locked' ? '' : 'locked')} />
        </div>

        {isError && (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444]">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Couldn't load spreadsheets. Try refreshing.
          </div>
        )}

        <div className={`grid grid-cols-1 gap-5 items-start ${selected ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : ''}`}>
          {/* Board */}
          <div className="min-w-0">
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
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-3 snap-x">
                {columns.map((col, i) => (
                  <BoardColumn
                    key={col.key}
                    column={col}
                    files={col.files}
                    index={i}
                    selectedId={selectedId}
                    movingId={moveMut.isPending ? moveMut.variables?.batchId : null}
                    dragOver={dragOver === col.key}
                    onDragOver={(e) => allowDrop(e, col.key)}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={(e) => drop(e, col.key)}
                    onSelect={(f) => setSelectedId(f.batchId === selectedId ? null : f.batchId)}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onUpload={() => setImporting(true)}
                  />
                ))}
                {otherAreas.length > 0 && (
                  <OtherAreasColumn
                    areas={otherAreas}
                    index={columns.length}
                    dragOverKey={dragOver}
                    onDragOverArea={(e, id) => allowDrop(e, id)}
                    onDragLeave={() => setDragOver(null)}
                    onDropArea={(e, id) => drop(e, id)}
                  />
                )}
              </div>
            )}
          </div>

          {selected && (
            <aside className="xl:sticky xl:top-4">
              <FileDetails
                key={selected.batchId}
                file={selected}
                areas={areas}
                moving={moveMut.isPending && moveMut.variables?.batchId === selected.batchId}
                onMove={move}
                onClose={() => setSelectedId(null)}
                onViewContacts={setViewing}
                onDelete={setToDelete}
              />
            </aside>
          )}
        </div>

        {/* How it works */}
        <div className="mac-in grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-[#E5E7EB] dark:border-[#2A2A2A] bg-[#E5E7EB] dark:bg-[#2A2A2A]" style={{ '--d': '300ms' }}>
          {HOW_IT_WORKS.map((s, i) => (
            <div key={s.title} className="bg-white dark:bg-[#181818] p-5 flex gap-3">
              <span className="w-7 h-7 rounded-full bg-[#F95C4B] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
              <div>
                <p className="flex items-center gap-1.5 text-sm font-bold text-[#111111] dark:text-white"><s.icon className="w-4 h-4 text-[#F95C4B]" /> {s.title}</p>
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-1 leading-relaxed">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {viewing && <FileContactsPanel file={viewing} onClose={() => setViewing(null)} />}

      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onDone={() => setImporting(false)}
          onReviewDuplicates={(dups) => { setDuplicates(dups); setImporting(false) }}
        />
      )}

      {duplicates && (
        <DuplicatesReviewModal duplicates={duplicates} onClose={() => setDuplicates(null)} onDone={() => setDuplicates(null)} />
      )}

      {toDelete && (
        <DeleteFileDialog file={toDelete} pending={deleteMut.isPending} onClose={() => setToDelete(null)} onConfirm={() => deleteMut.mutate(toDelete.batchId)} />
      )}
    </div>
  )
}
