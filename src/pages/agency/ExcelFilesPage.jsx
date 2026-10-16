import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import {
  FileSpreadsheet, Search, X, Trash2, Loader2, AlertTriangle, Inbox, Upload, Users,
  UserCheck, Layers, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { contactsApi } from '../../services/contactsApi'
import { agenciesApi } from '../../services/agenciesApi'
import { areasApi } from '../../services/areasApi'
import { useAuthStore } from '../../store/authStore'
import { inputCls, getApiErrorMessage, SearchableAreaSelect } from '../../components/leads/leadShared'
import SidePanel from '../../components/common/SidePanel'
import { ImportModal } from './ContactsPage'

function fmtBytes(b) {
  if (!b) return '—'
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

const CONTACT_STATUS_META = {
  unassigned: { label: 'Unassigned', color: '#6B7280' },
  assigned:   { label: 'Assigned',   color: '#3B82F6' },
  contacted:  { label: 'Contacted',  color: '#F59E0B' },
  converted:  { label: 'Converted',  color: '#10B981' },
  dnc:        { label: 'Do not call', color: '#EF4444' },
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4 flex items-center gap-3">
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

function ContactStatusPill({ status }) {
  const meta = CONTACT_STATUS_META[status] ?? { label: status, color: '#6B7280' }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap" style={{ color: meta.color, backgroundColor: `${meta.color}15` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />{meta.label}
    </span>
  )
}

/* ─── View a file's contacts ───────────────────────────────────────────── */
function FileContactsPanel({ file, onClose }) {
  const [page, setPage] = useState(1)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['agency-file-contacts', file.batchId, page],
    queryFn: () => contactsApi.list({ uploadBatchId: file.batchId, page, limit: 25 }).then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })
  const contacts = data?.contacts ?? []
  const totalPages = data?.totalPages ?? 1

  return (
    <SidePanel
      onClose={onClose} icon={FileSpreadsheet} iconColor="#F95C4B" title={file.displayName}
      subtitle={data ? `${data.total.toLocaleString()} contact${data.total === 1 ? '' : 's'} from this spreadsheet` : 'Loading…'}
      widthClass="sm:max-w-2xl"
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
      <div className="p-5">
        {isError ? (
          <div className="p-4 rounded-xl bg-[#EF4444]/10 text-sm text-[#EF4444]">Couldn't load this spreadsheet's contacts.</div>
        ) : isLoading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] animate-pulse" />)}</div>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] text-center py-10">No contacts in this spreadsheet.</p>
        ) : (
          <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-[#FAFAF9] dark:bg-[#111111] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
                <tr>
                  {['Name', 'Phone', 'Assigned to', 'Status'].map((h) => (
                    <th key={h} className="px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F5F4] dark:divide-[#202020]">
                {contacts.map((c) => (
                  <tr key={c._id} className="hover:bg-[#FAFAF9] dark:hover:bg-[#111111]">
                    <td className="px-3.5 py-2.5 text-sm font-semibold text-[#111111] dark:text-white truncate max-w-[160px]">{c.name}</td>
                    <td className="px-3.5 py-2.5 text-xs font-mono text-[#111111] dark:text-white whitespace-nowrap">{c.phone ?? '—'}</td>
                    <td className="px-3.5 py-2.5 text-xs whitespace-nowrap">
                      {c.assignedTo
                        ? <span className="flex items-center gap-1.5 text-[#111111] dark:text-white"><UserCheck className="w-3.5 h-3.5 text-[#F95C4B]" />{c.assignedTo.firstName} {c.assignedTo.lastName}</span>
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

/* ─── File card ──────────────────────────────────────────────────────────── */
function FileCard({ file, team, areas, onDelete, onViewContacts, onAssign, assigning, onAreaChange, savingArea }) {
  const [agentId, setAgentId] = useState('')
  const unassignedInFile = file.contactCount - file.assignedCount

  return (
    <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center flex-shrink-0">
          <FileSpreadsheet className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
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
          <button
            onClick={() => onViewContacts(file)}
            title="View the contacts in this spreadsheet"
            className="group flex items-center gap-1.5 mt-0.5 text-lg font-bold text-[#111111] dark:text-white leading-tight hover:text-[#F95C4B] transition-colors"
          >
            {file.contactCount.toLocaleString()}
            <Users className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
          </button>
        </div>
        <div className="rounded-xl bg-[#FAFAF9] dark:bg-[#111111] px-3.5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Unassigned</p>
          <p className={`mt-0.5 text-lg font-bold leading-tight ${unassignedInFile > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
            {unassignedInFile.toLocaleString()}
          </p>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-1.5">
          Area
        </p>
        <div className={savingArea ? 'opacity-60 pointer-events-none' : ''}>
          <SearchableAreaSelect
            areas={areas}
            value={file.areaId ?? ''}
            onChange={(areaId) => onAreaChange(file, areaId)}
            placeholder="Assign an area…"
            allowAdd
          />
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-1.5">
          Assign whole file to…
        </p>
        <div className="flex items-center gap-2">
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className={`${inputCls(false)} flex-1`}>
            <option value="">Pick an agent…</option>
            {team.map((m) => <option key={m._id} value={m._id}>{m.firstName} {m.lastName}{m.isAgencyManager ? ' (you)' : ''}</option>)}
          </select>
          <button
            onClick={() => agentId && onAssign(file, agentId)}
            disabled={!agentId || assigning}
            title="Assign every contact in this file to the chosen agent"
            className="flex-shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-40 flex items-center gap-1.5"
          >
            {assigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
            Assign
          </button>
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
            all {file.contactCount.toLocaleString()} contacts imported from it? The contacts go to the Bin and can be restored by admin.
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

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function ExcelFilesPage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')
  const [toDelete, setToDelete] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [importing, setImporting] = useState(false)
  const [assigningBatch, setAssigningBatch] = useState(null)

  const { data: files = [], isLoading, isError } = useQuery({
    queryKey: ['agency-excel-files'],
    queryFn: () => contactsApi.listFiles().then((r) => r.data.data.files),
    staleTime: 30_000,
    enabled: Boolean(user?.isAgencyManager),
  })

  const { data: teamData } = useQuery({
    queryKey: ['agency-team-mine'],
    queryFn: () => agenciesApi.myTeam().then((r) => r.data.data.team),
    enabled: Boolean(user?.isAgencyManager),
    staleTime: 60_000,
  })
  const team = (teamData ?? []).filter((m) => m.isActive)

  const { data: areas = [] } = useQuery({
    queryKey: ['areas-select'],
    queryFn: () => areasApi.list({ limit: 100, isActive: true }).then((r) => r.data.data.areas),
    staleTime: 60_000,
  })

  // Optimistic update — the file listing reads straight from Firebase Storage (slow, and
  // has its own brief eventual-consistency lag after a write), so waiting on a full
  // refetch made the area look unchanged for a moment after picking it.
  const areaMut = useMutation({
    mutationFn: ({ batchId, areaId }) => contactsApi.assignFileArea(batchId, areaId),
    onMutate: async ({ batchId, areaId }) => {
      await qc.cancelQueries({ queryKey: ['agency-excel-files'] })
      const previous = qc.getQueryData(['agency-excel-files'])
      const area = areas.find((a) => a._id === areaId)
      qc.setQueryData(['agency-excel-files'], (old) => old?.map((f) =>
        f.batchId === batchId ? { ...f, areaId, areaName: area?.name ?? null } : f
      ))
      return { previous }
    },
    onSuccess: (res) => {
      const { areaName, contactsUpdated } = res.data.data
      toast.success(`Assigned to ${areaName} — ${contactsUpdated} contact${contactsUpdated !== 1 ? 's' : ''} updated`)
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(['agency-excel-files'], ctx.previous)
      toast.error(getApiErrorMessage(e, 'Failed to assign area'))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['agency-excel-files'] }),
  })

  const assignMut = useMutation({
    mutationFn: ({ batchId, agentId }) => contactsApi.assignToAgent({ uploadBatchId: batchId, agentId }),
    onSuccess: (res, { agentId }) => {
      const agent = team.find((m) => m._id === agentId)
      toast.success(`${res.data.data.assigned} contact${res.data.data.assigned !== 1 ? 's' : ''} assigned${agent ? ` to ${agent.firstName} ${agent.lastName}` : ''}`)
      qc.invalidateQueries({ queryKey: ['agency-excel-files'] })
      qc.invalidateQueries({ queryKey: ['agency-contacts'] })
      setAssigningBatch(null)
    },
    onError: (e) => { toast.error(getApiErrorMessage(e, 'Failed to assign')); setAssigningBatch(null) },
  })

  const deleteMut = useMutation({
    mutationFn: (batchId) => contactsApi.deleteFile(batchId),
    onSuccess: (res) => {
      toast.success(`Deleted — ${res.data.data.contactsDeleted} contacts moved to the Bin`)
      qc.invalidateQueries({ queryKey: ['agency-excel-files'] })
      qc.invalidateQueries({ queryKey: ['agency-contacts'] })
      setToDelete(null)
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to delete file')),
  })

  const q = search.trim().toLowerCase()
  const visible = files.filter((f) => !q || f.displayName.toLowerCase().includes(q))
  const totalContacts = files.reduce((sum, f) => sum + (f.contactCount ?? 0), 0)
  const totalUnassigned = files.reduce((sum, f) => sum + (f.contactCount - f.assignedCount), 0)

  if (!user?.isAgencyManager) {
    return (
      <div className="flex items-center justify-center h-full py-32 px-6 text-center">
        <div>
          <div className="w-14 h-14 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center mb-4 mx-auto">
            <FileSpreadsheet className="w-7 h-7 text-[#F95C4B]" strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">Manager access only</h3>
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] max-w-xs">
            Only your company's manager can view and manage uploaded spreadsheets.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-5 sm:px-8 pt-6 pb-5 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#111111] dark:text-white tracking-tight flex items-center gap-2.5">
              <FileSpreadsheet className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
              Excel Files
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
              Every spreadsheet uploaded by you or your agents
            </p>
          </div>
          <button
            onClick={() => setImporting(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all self-start sm:self-auto"
          >
            <Upload className="w-4 h-4" /> Import Excel
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-5 sm:px-8 py-4 bg-[#FAFAF9] dark:bg-[#0B0B0B] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Layers} label="Spreadsheets" value={files.length} color="#F95C4B" />
          <StatCard icon={Users} label="Contacts" value={totalContacts.toLocaleString()} color="#F95C4B" />
          <StatCard icon={UserCheck} label="Unassigned" value={totalUnassigned.toLocaleString()} color={totalUnassigned > 0 ? '#F59E0B' : '#10B981'} />
        </div>
      </div>

      {/* Search */}
      <div className="px-5 sm:px-8 py-3.5 bg-[#FAFAF9] dark:bg-[#0B0B0B] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search spreadsheets…"
            className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/20 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111] dark:hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
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
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-56 rounded-2xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] animate-pulse" />)}
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center mb-4">
              <Inbox className="w-7 h-7 text-[#F95C4B]" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">No spreadsheets yet</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] max-w-xs">
              Import an Excel file to add contacts to your company's pool.
            </p>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm font-semibold text-[#111111] dark:text-white mb-1">No spreadsheets match</p>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Try a different search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visible.map((file) => (
              <FileCard
                key={file.batchId}
                file={file}
                team={team}
                areas={areas}
                assigning={assigningBatch === file.batchId}
                savingArea={areaMut.isPending && areaMut.variables?.batchId === file.batchId}
                onDelete={setToDelete}
                onViewContacts={setViewing}
                onAssign={(f, agentId) => { setAssigningBatch(f.batchId); assignMut.mutate({ batchId: f.batchId, agentId }) }}
                onAreaChange={(f, areaId) => areaMut.mutate({ batchId: f.batchId, areaId })}
              />
            ))}
          </div>
        )}
      </div>

      {viewing && <FileContactsPanel file={viewing} onClose={() => setViewing(null)} />}

      {importing && (
        <ImportModal isManager onClose={() => setImporting(false)} onDone={() => { setImporting(false); qc.invalidateQueries({ queryKey: ['agency-excel-files'] }) }} />
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
