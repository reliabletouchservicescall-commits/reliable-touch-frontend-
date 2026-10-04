import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatDistanceToNow, startOfDay, endOfDay, subDays } from 'date-fns'
import {
  FileSpreadsheet, Search, X, Trash2, Loader2, AlertTriangle, Inbox, CheckCircle2, UserCheck, Layers, Upload, CalendarDays,
} from 'lucide-react'
import { contactsApi } from '../../services/contactsApi'
import { areasApi } from '../../services/areasApi'
import { SearchableAreaSelect } from '../../components/leads/leadShared'
import ImportModal from '../../components/contacts/ImportExcelModal'
import DuplicatesReviewModal from '../../components/contacts/DuplicatesReviewModal'

const AREA_PALETTE = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#F95C4B', '#06B6D4', '#EC4899']
const UNASSIGNED = '__unassigned__'
const UNASSIGNED_COLOR = '#F59E0B'

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

function StatCard({ icon: Icon, label, value, color, emphasise }) {
  return (
    <div className={`bg-white dark:bg-[#181818] rounded-2xl border p-4 flex items-center gap-3 ${
      emphasise ? 'border-[#F59E0B]/40' : 'border-[#E5E7EB] dark:border-[#2A2A2A]'
    }`}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}18` }}>
        <Icon className="w-4 h-4" style={{ color }} strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">{label}</p>
        <p className="text-lg font-bold text-[#111111] dark:text-white leading-tight">{value}</p>
      </div>
    </div>
  )
}

function FileCard({ file, areas, saving, onAreaChange, onDelete }) {
  const accent = file.areaId ? areaColor(file.areaId) : UNASSIGNED_COLOR
  return (
    <div
      className="relative bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5 flex flex-col gap-4 hover:shadow-md transition-shadow"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 flex items-center justify-center flex-shrink-0">
          <FileSpreadsheet className="w-5 h-5 text-[#10B981]" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#111111] dark:text-white truncate" title={file.displayName}>{file.displayName}</p>
          <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] mt-0.5 truncate">
            {fmtBytes(file.size)} · {formatDistanceToNow(new Date(file.createdAt), { addSuffix: true })}
            {file.uploadedByName && <> · {file.uploadedByName}</>}
          </p>
        </div>
        <button
          onClick={() => onDelete(file)}
          title="Delete this file and its contacts"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#EF4444]/10 hover:text-[#EF4444] transition-colors flex-shrink-0"
        >
          <Trash2 className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#FAFAF9] dark:bg-[#111111] px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Contacts</p>
          <p className="text-lg font-bold text-[#111111] dark:text-white leading-tight mt-0.5">{file.contactCount.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-[#FAFAF9] dark:bg-[#111111] px-3.5 py-3 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Status</p>
          {file.assignment ? (
            <div className="mt-1 min-w-0">
              <p className="text-xs font-semibold text-[#3B82F6] truncate flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 flex-shrink-0" /> {file.assignment.assignedToName}
              </p>
              <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
                locked until {new Date(file.assignment.expiresAt).toLocaleDateString()}
              </p>
            </div>
          ) : (
            <p className="text-xs font-semibold text-[#10B981] mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Available
            </p>
          )}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-1.5">
          Area
        </p>
        <div className={saving ? 'opacity-60 pointer-events-none' : ''}>
          <SearchableAreaSelect
            areas={areas}
            value={file.areaId ?? ''}
            onChange={(areaId) => onAreaChange(file, areaId)}
            placeholder="Assign an area…"
            allowAdd
          />
        </div>
      </div>
    </div>
  )
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

export default function ExcelFilesPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [toDelete, setToDelete] = useState(null)
  const [datePreset, setDatePreset] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [importing, setImporting] = useState(false)
  const [duplicates, setDuplicates] = useState(null)

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

  const assignMut = useMutation({
    mutationFn: ({ batchId, areaId }) => contactsApi.assignFileArea(batchId, areaId),
    onSuccess: (res) => {
      const { areaName, contactsUpdated } = res.data.data
      toast.success(`Assigned to ${areaName} — ${contactsUpdated} contact${contactsUpdated !== 1 ? 's' : ''} updated`)
      qc.invalidateQueries({ queryKey: ['contact-files'] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Failed to assign area'),
  })

  const deleteMut = useMutation({
    mutationFn: (batchId) => contactsApi.deleteFile(batchId),
    onSuccess: (res) => {
      toast.success(`Deleted — ${res.data.data.contactsDeleted} contacts moved to the Bin`)
      qc.invalidateQueries({ queryKey: ['contact-files'] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
      setToDelete(null)
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Failed to delete file'),
  })

  const areaCounts = files.reduce((acc, f) => {
    if (f.areaId) acc[f.areaId] = (acc[f.areaId] ?? 0) + 1
    return acc
  }, {})
  const unassignedCount = files.filter((f) => !f.areaId).length
  const totalContacts = files.reduce((sum, f) => sum + (f.contactCount ?? 0), 0)
  const lockedCount = files.filter((f) => f.assignment).length

  const q = search.trim().toLowerCase()
  const window_ = dateWindow(datePreset, dateFrom, dateTo)
  const visible = files.filter((f) => {
    if (areaFilter === UNASSIGNED && f.areaId) return false
    if (areaFilter && areaFilter !== UNASSIGNED && f.areaId !== areaFilter) return false
    if (q && !f.displayName.toLowerCase().includes(q)) return false
    if (window_) {
      const t = new Date(f.createdAt)
      if (t < window_[0] || t > window_[1]) return false
    }
    return true
  })

  const filterChips = [
    { key: '', label: 'All', count: files.length },
    { key: UNASSIGNED, label: 'Unassigned', count: unassignedCount, color: UNASSIGNED_COLOR },
    ...areas.map((a) => ({ key: a._id, label: a.name, count: areaCounts[a._id] ?? 0, color: areaColor(a._id) })),
  ]

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-5 sm:px-8 pt-6 pb-5 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#111111] dark:text-white tracking-tight flex items-center gap-2.5">
              <FileSpreadsheet className="w-5 h-5 text-[#10B981]" strokeWidth={1.75} />
              Excel Files
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
              Every spreadsheet imported into the system, and the area each one belongs to
            </p>
          </div>
          <button
            onClick={() => setImporting(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#10B981] hover:bg-[#059669] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all self-start sm:self-auto"
          >
            <Upload className="w-4 h-4" /> Import Excel
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-5 sm:px-8 py-4 bg-[#FAFAF9] dark:bg-[#0B0B0B] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Layers} label="Spreadsheets" value={files.length} color="#10B981" />
          <StatCard icon={AlertTriangle} label="No area yet" value={unassignedCount} color="#F59E0B" emphasise={unassignedCount > 0} />
          <StatCard icon={FileSpreadsheet} label="Contacts imported" value={totalContacts.toLocaleString()} color="#3B82F6" />
          <StatCard icon={UserCheck} label="Locked to a caller" value={lockedCount} color="#8B5CF6" />
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-5 sm:px-8 py-3.5 flex flex-col gap-3 bg-[#FAFAF9] dark:bg-[#0B0B0B] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search spreadsheets…"
            className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111] dark:hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] flex-shrink-0">
            <CalendarDays className="w-3.5 h-3.5" /> Uploaded
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {DATE_PRESETS.map((p) => {
              const active = datePreset === p.key
              return (
                <button
                  key={p.key || 'any'}
                  onClick={() => setDatePreset(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-all ${
                    active
                      ? 'bg-[#10B981]/10 border-[#10B981]/40 text-[#059669] dark:text-[#34D399]'
                      : 'bg-white dark:bg-[#181818] border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white outline-none focus:border-[#10B981]" />
              <span className="text-xs text-[#6B7280]">to</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white outline-none focus:border-[#10B981]" />
            </div>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {filterChips.map((chip) => {
            const active = areaFilter === chip.key
            return (
              <button
                key={chip.key || 'all'}
                onClick={() => setAreaFilter(chip.key)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
                  active
                    ? 'bg-[#111111] dark:bg-white text-white dark:text-[#111111] border-transparent'
                    : 'bg-white dark:bg-[#181818] border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'
                }`}
              >
                {chip.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: chip.color }} />}
                {chip.label}
                <span className={`text-[10px] font-bold ${active ? 'opacity-80' : 'opacity-60'}`}>{chip.count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-5">
        {isError && (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444] mb-4">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Couldn't load spreadsheets. Try refreshing.
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 rounded-2xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] animate-pulse" />
            ))}
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#10B981]/10 flex items-center justify-center mb-4">
              <Inbox className="w-7 h-7 text-[#10B981]" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">No spreadsheets yet</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] max-w-xs">
              Import an Excel file from the Contacts page — you'll pick its area as part of the upload.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm font-semibold text-[#111111] dark:text-white mb-1">No spreadsheets match</p>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Try a different area or search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visible.map((file) => (
              <FileCard
                key={file.batchId}
                file={file}
                areas={areas}
                saving={assignMut.isPending && assignMut.variables?.batchId === file.batchId}
                onAreaChange={(f, areaId) => assignMut.mutate({ batchId: f.batchId, areaId })}
                onDelete={setToDelete}
              />
            ))}
          </div>
        )}
      </div>

      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onDone={() => setImporting(false)}
          onReviewDuplicates={(dups) => { setDuplicates(dups); setImporting(false) }}
        />
      )}

      {duplicates && (
        <DuplicatesReviewModal
          duplicates={duplicates}
          onClose={() => setDuplicates(null)}
          onDone={() => setDuplicates(null)}
        />
      )}

      {toDelete && (
        <DeleteFileDialog
          file={toDelete}
          pending={deleteMut.isPending}
          onClose={() => setToDelete(null)}
          onConfirm={() => deleteMut.mutate(toDelete.batchId)}
        />
      )}
    </div>
  )
}
