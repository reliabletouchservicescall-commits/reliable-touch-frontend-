import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Plus, Search, X, Pencil, Trash2, Eye, ChevronLeft, ChevronRight,
  Phone, Mail, MapPin, User, BookUser, AlertTriangle, Loader2,
  ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal, FileText,
  PhoneCall, CheckCircle2, UserCheck, PhoneOff, UserX, Filter,
  CheckSquare, Square, Users, UserPlus, ChevronDown, LayoutGrid,
  Upload, FileSpreadsheet, Building2, Ruler, CreditCard, Hash,
  FolderOpen, Download, CloudUpload, RefreshCw, PhoneForwarded,
  Layers, Target, Settings2, Bell, Clock, MessageSquare,
} from 'lucide-react'
import { contactsApi }         from '../../services/contactsApi'
import { usersApi }            from '../../services/usersApi'
import { contactRequestsApi }  from '../../services/contactRequestsApi'

/* ─── Constants ──────────────────────────────────────────────────────────── */

const STATUSES = ['unassigned', 'assigned', 'contacted', 'converted', 'dnc']

const STATUS_META = {
  unassigned: { label: 'Unassigned',   color: '#6B7280', bg: '#6B728018', icon: UserX },
  assigned:   { label: 'Assigned',     color: '#3B82F6', bg: '#3B82F618', icon: UserCheck },
  contacted:  { label: 'Contacted',    color: '#F59E0B', bg: '#F59E0B18', icon: PhoneCall },
  converted:  { label: 'Converted',    color: '#10B981', bg: '#10B98118', icon: CheckCircle2 },
  dnc:        { label: 'Do Not Call',  color: '#EF4444', bg: '#EF444418', icon: PhoneOff },
}

const SORT_OPTIONS = [
  { value: '-createdAt',  label: 'Newest first' },
  { value: 'createdAt',  label: 'Oldest first' },
  { value: 'name',       label: 'Name A–Z' },
  { value: '-name',      label: 'Name Z–A' },
  { value: 'importIndex', label: 'Import order' },
]

const EMPTY_FORM = {
  name: '', phone: '', altPhone: '', email: '', address: '',
  unitNumber: '', sizeInSqm: '', sectionalScheme: '', idNumber: '',
  preferredPhone: 'primary', source: 'manual', notes: '', status: 'unassigned',
}

const CALLER_PALETTE = [
  '#F95C4B','#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#84CC16',
]

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function useDebounce(value, delay = 400) {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return d
}

function inputCls(hasError) {
  return [
    'w-full px-4 py-2.5 rounded-xl text-sm',
    'bg-[#F5F5F4] dark:bg-[#202020] border',
    hasError ? 'border-[#EF4444]' : 'border-transparent focus:border-[#F95C4B]',
    'focus:bg-white dark:focus:bg-[#181818]',
    'text-[#111111] dark:text-white',
    'placeholder:text-[#6B7280]/50 dark:placeholder:text-[#A1A1AA]/40',
    'outline-none ring-2 ring-transparent focus:ring-[#F95C4B]/20 transition-all',
  ].join(' ')
}

function callerColor(id) {
  if (!id) return '#6B7280'
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return CALLER_PALETTE[h % CALLER_PALETTE.length]
}

function fmtBytes(bytes) {
  if (!bytes) return '—'
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

/* ─── StatusBadge ────────────────────────────────────────────────────── */

function StatusBadge({ status, size }) {
  const meta = STATUS_META[status] ?? STATUS_META.unassigned
  const Icon = meta.icon
  const pad  = size === 'md' ? 'px-3 py-1.5' : 'px-2.5 py-1'
  const txt  = size === 'md' ? 'text-xs'      : 'text-[10px]'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${pad} ${txt}`}
      style={{ color: meta.color, backgroundColor: meta.bg }}>
      <Icon className="w-3 h-3" strokeWidth={2} />
      {meta.label}
    </span>
  )
}

/* ─── Avatar ─────────────────────────────────────────────────────────── */

function Avatar({ name, color, size = 8 }) {
  const initials = (name ?? '?').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  const bg = color ?? callerColor(name)
  return (
    <div className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}
      style={{ backgroundColor: bg, fontSize: size <= 7 ? '10px' : '11px' }}>
      {initials}
    </div>
  )
}

/* ─── Field wrapper ──────────────────────────────────────────────────── */

function Field({ label, required, error, children }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-1.5">
        {label}{required && <span className="text-[#F95C4B] ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-[#EF4444]">{error}</p>}
    </div>
  )
}

/* ─── Section Scheme Strip ───────────────────────────────────────────── */

function SchemeStrip({ schemes, active, onSelect }) {
  if (!schemes?.length) return null
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <button
        onClick={() => onSelect('')}
        className={[
          'flex-shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all whitespace-nowrap',
          active === '' ? 'border-[#F95C4B] bg-[#F95C4B]/8 text-[#F95C4B] dark:bg-[#F95C4B]/12' : 'border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:border-[#F95C4B]/40',
        ].join(' ')}
      >
        <LayoutGrid className="w-3.5 h-3.5" /> All Schemes
      </button>
      {schemes.map((s) => (
        <button key={s}
          onClick={() => onSelect(s)}
          className={[
            'flex-shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all whitespace-nowrap',
            active === s ? 'border-[#8B5CF6] bg-[#8B5CF6]/8 text-[#8B5CF6] dark:bg-[#8B5CF6]/12' : 'border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:border-[#8B5CF6]/40',
          ].join(' ')}>
          <Building2 className="w-3.5 h-3.5" /> {s}
        </button>
      ))}
    </div>
  )
}

/* ─── Cold Caller Strip ──────────────────────────────────────────────── */

function CallerStrip({ callers, activeCaller, onSelect, totalUnassigned }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <button onClick={() => onSelect('')}
        className={['flex-shrink-0 flex flex-col items-start gap-1 px-4 py-3 rounded-xl border transition-all min-w-[110px]',
          activeCaller === '' ? 'border-[#F95C4B] bg-[#F95C4B]/8 dark:bg-[#F95C4B]/12'
            : 'border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] hover:border-[#F95C4B]/40'].join(' ')}>
        <div className="w-7 h-7 rounded-full bg-[#F95C4B]/15 flex items-center justify-center">
          <LayoutGrid className="w-3.5 h-3.5 text-[#F95C4B]" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">All</p>
          <p className="text-base font-bold text-[#111111] dark:text-white leading-tight">All contacts</p>
        </div>
      </button>

      <button onClick={() => onSelect('unassigned')}
        className={['flex-shrink-0 flex flex-col items-start gap-1 px-4 py-3 rounded-xl border transition-all min-w-[130px]',
          activeCaller === 'unassigned' ? 'border-[#6B7280] bg-[#6B7280]/8 dark:bg-[#6B7280]/12'
            : 'border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] hover:border-[#6B7280]/40'].join(' ')}>
        <div className="w-7 h-7 rounded-full bg-[#6B7280]/15 flex items-center justify-center">
          <UserX className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#A1A1AA]" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Unassigned</p>
          <p className="text-base font-bold text-[#111111] dark:text-white leading-tight">{totalUnassigned ?? '—'}</p>
        </div>
      </button>

      {callers.map((c) => {
        const color    = callerColor(c._id)
        const isActive = activeCaller === c._id
        return (
          <button key={c._id} onClick={() => onSelect(c._id)}
            className={['flex-shrink-0 flex flex-col items-start gap-1.5 px-4 py-3 rounded-xl border transition-all min-w-[140px]',
              isActive ? 'border-current' : 'border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] hover:border-current/40'].join(' ')}
            style={isActive ? { borderColor: color, backgroundColor: `${color}12` } : {}}>
            <div className="flex items-center gap-2">
              <Avatar name={`${c.firstName} ${c.lastName}`} color={color} size={7} />
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ color, backgroundColor: `${color}20` }}>{c.contactCount ?? 0}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Cold Caller</p>
              <p className="text-sm font-bold text-[#111111] dark:text-white truncate">{c.firstName} {c.lastName}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

/* ─── Bulk Assign Bar ────────────────────────────────────────────────── */

function BulkAssignBar({ count, callers, onAssign, onClear, busy }) {
  const [open, setOpen]     = useState(false)
  const [selected, setSelected] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const caller = callers.find((c) => c._id === selected)

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-[#111111] dark:bg-white shadow-2xl border border-white/10 dark:border-[#111111]/10">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-[#F95C4B] flex items-center justify-center">
          <CheckSquare className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-sm font-semibold text-white dark:text-[#111111]">
          {count} contact{count !== 1 ? 's' : ''} selected
        </span>
      </div>

      <div className="w-px h-5 bg-white/20 dark:bg-[#111111]/20" />

      <div className="relative" ref={ref}>
        <button onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 dark:bg-[#111111]/10 hover:bg-white/20 dark:hover:bg-[#111111]/20 text-sm font-semibold text-white dark:text-[#111111] transition-all">
          {caller ? (
            <><Avatar name={`${caller.firstName} ${caller.lastName}`} color={callerColor(caller._id)} size={5} />
              {caller.firstName} {caller.lastName}</>
          ) : <><UserPlus className="w-4 h-4" /> Assign to cold caller</>}
          <ChevronDown className="w-3.5 h-3.5 opacity-60" />
        </button>

        {open && (
          <div className="absolute bottom-full mb-2 left-0 min-w-[220px] bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl overflow-hidden z-50">
            {callers.length === 0
              ? <p className="px-4 py-3 text-xs text-[#6B7280] dark:text-[#A1A1AA]">No cold callers found</p>
              : <ul>{callers.map((c) => {
                  const color = callerColor(c._id)
                  return (
                    <li key={c._id}>
                      <button onClick={() => { setSelected(c._id); setOpen(false) }}
                        className={['w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F5F5F4] dark:hover:bg-[#202020] transition-colors',
                          selected === c._id ? 'bg-[#F5F5F4] dark:bg-[#202020]' : ''].join(' ')}>
                        <Avatar name={`${c.firstName} ${c.lastName}`} color={color} size={7} />
                        <div>
                          <p className="text-sm font-semibold text-[#111111] dark:text-white">{c.firstName} {c.lastName}</p>
                          <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">{c.contactCount ?? 0} contacts</p>
                        </div>
                        {selected === c._id && <CheckCircle2 className="w-4 h-4 text-[#F95C4B] ml-auto" />}
                      </button>
                    </li>
                  )
                })}</ul>}
          </div>
        )}
      </div>

      <button onClick={() => { if (selected) { onAssign(selected); setSelected('') } }}
        disabled={!selected || busy}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F95C4B] hover:bg-[#E84B3A] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
        Assign
      </button>

      <button onClick={onClear}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 dark:text-[#111111]/60 hover:text-white dark:hover:text-[#111111] hover:bg-white/10 dark:hover:bg-[#111111]/10">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

/* ─── Smart Assignment Modal ─────────────────────────────────────────── */

function SmartAssignModal({ callers, schemes, onClose, onDone }) {
  const qc = useQueryClient()
  const [mode, setMode]   = useState('scheme') // 'scheme' | 'range'
  const [callerId, setCaller] = useState('')
  const [scheme, setScheme]   = useState('')
  const [fromIdx, setFrom]    = useState('')
  const [toIdx, setTo]        = useState('')
  const [batchId, setBatchId] = useState('')

  const rangeMut = useMutation({
    mutationFn: () => contactsApi.assignByRange({
      callerId, fromIndex: parseInt(fromIdx), toIndex: parseInt(toIdx),
      uploadBatchId: batchId || undefined,
    }),
    onSuccess: (res) => {
      toast.success(`${res.data.data.assigned} contacts assigned`)
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['caller-counts'] })
      qc.invalidateQueries({ queryKey: ['contacts-unassigned'] })
      onDone()
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Assignment failed'),
  })

  const schemeMut = useMutation({
    mutationFn: () => contactsApi.assignByScheme({ callerId, sectionalScheme: scheme }),
    onSuccess: (res) => {
      toast.success(`${res.data.data.assigned} contacts assigned`)
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['caller-counts'] })
      qc.invalidateQueries({ queryKey: ['contacts-unassigned'] })
      onDone()
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Assignment failed'),
  })

  const busy   = rangeMut.isPending || schemeMut.isPending
  const caller = callers.find((c) => c._id === callerId)

  function submit(e) {
    e.preventDefault()
    if (!callerId) { toast.error('Select a cold caller'); return }
    if (mode === 'scheme') {
      if (!scheme) { toast.error('Select a sectional scheme'); return }
      schemeMut.mutate()
    } else {
      if (!fromIdx || !toIdx) { toast.error('Enter both from and to index'); return }
      if (parseInt(fromIdx) > parseInt(toIdx)) { toast.error('From index must be ≤ To index'); return }
      rangeMut.mutate()
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-[#8B5CF6]" strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#111111] dark:text-white">Smart Assignment</h2>
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Assign by scheme or index range</p>
              </div>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={submit} className="p-6 space-y-5">
            {/* Mode toggle */}
            <div className="flex rounded-xl bg-[#F5F5F4] dark:bg-[#202020] p-1 gap-1">
              {[
                { key: 'scheme', label: 'By Section Scheme', icon: Building2 },
                { key: 'range',  label: 'By Index Range',   icon: Hash },
              ].map(({ key, label, icon: Icon }) => (
                <button key={key} type="button" onClick={() => setMode(key)}
                  className={['flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all',
                    mode === key ? 'bg-white dark:bg-[#111111] text-[#111111] dark:text-white shadow-sm' : 'text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'].join(' ')}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            {/* Cold Caller picker */}
            <Field label="Assign to Cold Caller" required>
              <select value={callerId} onChange={(e) => setCaller(e.target.value)} className={inputCls(!callerId && false)}>
                <option value="">Select cold caller…</option>
                {callers.map((c) => (
                  <option key={c._id} value={c._id}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
            </Field>

            {mode === 'scheme' ? (
              <Field label="Sectional Scheme" required>
                <select value={scheme} onChange={(e) => setScheme(e.target.value)} className={inputCls(false)}>
                  <option value="">Select scheme…</option>
                  {schemes.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="From Index" required>
                    <input type="number" min="1" value={fromIdx} onChange={(e) => setFrom(e.target.value)}
                      placeholder="e.g. 40" className={inputCls(false)} />
                  </Field>
                  <Field label="To Index" required>
                    <input type="number" min="1" value={toIdx} onChange={(e) => setTo(e.target.value)}
                      placeholder="e.g. 120" className={inputCls(false)} />
                  </Field>
                </div>
                <Field label="Upload Batch ID (optional)">
                  <input value={batchId} onChange={(e) => setBatchId(e.target.value)}
                    placeholder="Leave blank to apply across all imports"
                    className={inputCls(false)} />
                </Field>
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#3B82F6]/8 border border-[#3B82F6]/20">
                  <AlertTriangle className="w-4 h-4 text-[#3B82F6] mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-[#3B82F6]">
                    Assigns contacts at import rows {fromIdx || '…'} – {toIdx || '…'}.
                    Only contacts with a phone number will be assigned.
                  </p>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
                Cancel
              </button>
              <button type="submit" disabled={busy}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Assign Contacts
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

/* ─── Import Modal ───────────────────────────────────────────────────── */

function ImportModal({ onClose, onDone }) {
  const qc = useQueryClient()
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile]         = useState(null)
  const [result, setResult]     = useState(null)
  const fileRef = useRef(null)

  const mut = useMutation({
    mutationFn: (f) => {
      const fd = new FormData()
      fd.append('file', f)
      return contactsApi.import(fd)
    },
    onSuccess: (res) => {
      setResult(res.data.data)
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['contacts-unassigned'] })
      qc.invalidateQueries({ queryKey: ['contact-schemes'] })
      qc.invalidateQueries({ queryKey: ['contact-files'] })
      toast.success('Import complete!')
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Import failed'),
  })

  function handleFile(f) {
    if (!f) return
    if (!f.name.match(/\.(xlsx|xls)$/i)) { toast.error('Only Excel files (.xlsx / .xls)'); return }
    setFile(f)
    setResult(null)
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  function handleUpload() { if (file) mut.mutate(file) }

  const busy = mut.isPending

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={!busy ? onClose : undefined} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-[#10B981]" strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#111111] dark:text-white">Import Excel</h2>
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Contacts will be saved & file stored in Firebase</p>
              </div>
            </div>
            {!busy && (
              <button onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="p-6 space-y-5">
            {!result ? (
              <>
                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className={[
                    'border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all',
                    dragOver ? 'border-[#10B981] bg-[#10B981]/5' : file
                      ? 'border-[#10B981]/50 bg-[#10B981]/5'
                      : 'border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#10B981]/50 hover:bg-[#F5F5F4] dark:hover:bg-[#202020]',
                  ].join(' ')}>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls"
                    className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
                  {file ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet className="w-10 h-10 text-[#10B981]" />
                      <p className="text-sm font-semibold text-[#111111] dark:text-white">{file.name}</p>
                      <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{fmtBytes(file.size)}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <CloudUpload className="w-10 h-10 text-[#6B7280] dark:text-[#A1A1AA]" />
                      <p className="text-sm font-semibold text-[#111111] dark:text-white">Drop Excel file here</p>
                      <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">or click to browse</p>
                      <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#F5F5F4] dark:bg-[#202020] text-[#6B7280] dark:text-[#A1A1AA]">.xlsx / .xls — max 20 MB</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="rounded-xl bg-[#F5F5F4] dark:bg-[#202020] p-4 space-y-2">
                  <p className="text-xs font-semibold text-[#111111] dark:text-white">Expected columns:</p>
                  <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] leading-relaxed">
                    <strong>UNIT</strong> · <strong>SIZE</strong> · <strong>SECTIONAL SCHEME</strong> · <strong>NAME</strong> · <strong>IDENTIFIER</strong> (ID number) · <strong>Column1</strong> (phone / DO NOT CONTACT / COMPANY / etc.)
                  </p>
                  <p className="text-[11px] text-[#EF4444]">
                    "DO NOT CONTACT" entries are automatically added to the Do Not Call list.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={onClose} disabled={busy}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] disabled:opacity-50">
                    Cancel
                  </button>
                  <button onClick={handleUpload} disabled={!file || busy}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</> : <><Upload className="w-4 h-4" /> Import</>}
                  </button>
                </div>
              </>
            ) : (
              /* Result summary */
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20">
                  <CheckCircle2 className="w-6 h-6 text-[#10B981] flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-[#10B981]">Import successful</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">File saved to Firebase Storage</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Total rows',    value: result.stats.total,      color: '#111111' },
                    { label: 'Imported',      value: result.stats.created,    color: '#10B981' },
                    { label: 'No phone',      value: result.stats.noPhone,    color: '#F59E0B' },
                    { label: 'DNC',           value: result.stats.dnc,        color: '#EF4444' },
                    { label: 'Duplicates',    value: result.stats.duplicates, color: '#6B7280' },
                    { label: 'Skipped',       value: result.stats.skipped,    color: '#6B7280' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex flex-col gap-0.5 p-3 rounded-xl bg-[#F5F5F4] dark:bg-[#202020]">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">{label}</span>
                      <span className="text-xl font-bold" style={{ color }}>{value}</span>
                    </div>
                  ))}
                </div>

                <button onClick={onDone}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Done
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── Files Vault Modal ──────────────────────────────────────────────── */

function FilesVaultModal({ onClose }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['contact-files'],
    queryFn: () => contactsApi.listFiles().then((r) => r.data.data.files),
    staleTime: 30_000,
  })

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-[#F59E0B]" strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#111111] dark:text-white">Uploaded Files</h2>
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">Firebase Storage — excel-uploads/</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => refetch()}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[420px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-[#F59E0B]" />
              </div>
            ) : !data?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <FolderOpen className="w-10 h-10 text-[#6B7280] dark:text-[#A1A1AA] mb-3" strokeWidth={1.5} />
                <p className="text-sm font-semibold text-[#111111] dark:text-white">No files yet</p>
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-1">Import an Excel file to see it here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#F5F5F4] dark:divide-[#202020]">
                {data.map((f) => (
                  <li key={f.name} className="flex items-center gap-4 px-6 py-4 hover:bg-[#FAFAF9] dark:hover:bg-[#111111]">
                    <div className="w-9 h-9 rounded-xl bg-[#10B981]/10 flex items-center justify-center flex-shrink-0">
                      <FileSpreadsheet className="w-5 h-5 text-[#10B981]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#111111] dark:text-white truncate">{f.displayName}</p>
                      <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">
                        {fmtBytes(f.size)} · {f.createdAt ? format(new Date(f.createdAt), 'd MMM yyyy') : '—'}
                      </p>
                    </div>
                    <a href={f.downloadUrl} target="_blank" rel="noreferrer"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#10B981]/10 hover:text-[#10B981] transition-all flex-shrink-0">
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── Preferred Phone Picker (inline) ────────────────────────────────── */

function PhonePicker({ contact, onUpdate }) {
  const qc  = useQueryClient()
  const mut = useMutation({
    mutationFn: (pref) => contactsApi.update(contact._id, { preferredPhone: pref }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      toast.success('Preferred phone updated')
    },
  })

  if (!contact.altPhone) {
    return (
      <a href={`tel:${contact.phone}`}
        className="inline-flex items-center gap-1.5 text-sm text-[#3B82F6] hover:underline font-mono">
        <Phone className="w-3.5 h-3.5" /> {contact.phone}
      </a>
    )
  }

  const phones = [
    { key: 'primary', num: contact.phone,    label: 'Primary' },
    { key: 'alt',     num: contact.altPhone, label: 'Alt' },
  ]

  return (
    <div className="space-y-1.5">
      {phones.map(({ key, num, label }) => {
        const isPref = contact.preferredPhone === key
        return (
          <div key={key} className="flex items-center gap-2">
            <button onClick={() => mut.mutate(key)} title={`Set as preferred`}
              className={['w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all',
                isPref ? 'border-[#F95C4B] bg-[#F95C4B]' : 'border-[#D1D5DB] dark:border-[#3A3A3A] hover:border-[#F95C4B]'].join(' ')}>
              {isPref && <div className="w-full h-full rounded-full scale-50 bg-white" />}
            </button>
            <a href={`tel:${num}`}
              className={['text-xs font-mono flex items-center gap-1',
                isPref ? 'text-[#F95C4B] font-semibold' : 'text-[#6B7280] dark:text-[#A1A1AA]'].join(' ')}>
              <PhoneForwarded className="w-3 h-3" />
              {num}
            </a>
            <span className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">{label}</span>
            {isPref && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F95C4B]/10 text-[#F95C4B] font-semibold">dial this</span>}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Contact Drawer (Create / Edit / View) ───────────────────────────── */

function ContactDrawer({ mode, contact, callers, onClose, onSaved }) {
  const [form, setForm]     = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const qc = useQueryClient()

  useEffect(() => {
    if (mode === 'edit' || mode === 'view') {
      setForm({
        name:            contact?.name            ?? '',
        phone:           contact?.phone           ?? '',
        altPhone:        contact?.altPhone        ?? '',
        email:           contact?.email           ?? '',
        address:         contact?.address         ?? '',
        unitNumber:      contact?.unitNumber      ?? '',
        sizeInSqm:       contact?.sizeInSqm ?? contact?.sizeInSqm === 0 ? String(contact.sizeInSqm) : '',
        sectionalScheme: contact?.sectionalScheme ?? '',
        idNumber:        contact?.idNumber        ?? '',
        preferredPhone:  contact?.preferredPhone  ?? 'primary',
        source:          contact?.source          ?? 'manual',
        notes:           contact?.notes           ?? '',
        status:          contact?.status          ?? 'unassigned',
        assignedTo:      contact?.assignedTo?._id ?? contact?.assignedTo ?? '',
      })
    } else {
      setForm({ ...EMPTY_FORM, assignedTo: '' })
    }
    setErrors({})
  }, [mode, contact])

  const createMut = useMutation({
    mutationFn: (data) => contactsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); toast.success('Contact created'); onSaved() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Failed to create contact'),
  })

  const updateMut = useMutation({
    mutationFn: (data) => contactsApi.update(contact._id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); toast.success('Contact updated'); onSaved() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Failed to update contact'),
  })

  const busy = createMut.isPending || updateMut.isPending

  function setField(f, v) {
    setForm((p) => ({ ...p, [f]: v }))
    if (errors[f]) setErrors((e) => ({ ...e, [f]: null }))
  }

  function validate() {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    return errs
  }

  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    const payload = {}
    Object.entries(form).forEach(([k, v]) => { payload[k] = v === '' ? null : v })
    if (payload.sizeInSqm) payload.sizeInSqm = parseFloat(payload.sizeInSqm)
    if (payload.assignedTo && payload.status === 'unassigned') payload.status = 'assigned'
    if (!payload.assignedTo) { payload.assignedTo = null; if (payload.status === 'assigned') payload.status = 'unassigned' }
    if (!payload.altPhone) payload.preferredPhone = 'primary'
    if (mode === 'create') createMut.mutate(payload)
    else updateMut.mutate(payload)
  }

  const isView = mode === 'view'
  const title  = mode === 'create' ? 'New Contact' : mode === 'edit' ? 'Edit Contact' : 'Contact Details'
  const assignedCaller = callers.find((c) => c._id === (contact?.assignedTo?._id ?? contact?.assignedTo))

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[520px] flex flex-col bg-white dark:bg-[#181818] shadow-2xl border-l border-[#E5E7EB] dark:border-[#2A2A2A]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F95C4B]/10 flex items-center justify-center">
              <BookUser className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#111111] dark:text-white">{title}</h2>
              {isView && contact && (
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
                  Added {format(new Date(contact.createdAt), 'd MMM yyyy')}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {isView ? (
            <ViewBody contact={contact} assignedCaller={assignedCaller} />
          ) : (
            <form id="contact-form" onSubmit={handleSubmit} className="space-y-5">

              <Field label="Full Name" required error={errors.name}>
                <input value={form.name} onChange={(e) => setField('name', e.target.value)}
                  placeholder="e.g. Thabo Nkosi" className={inputCls(errors.name)} />
              </Field>

              {/* Property details */}
              <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4 space-y-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Property Details
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Unit Number">
                    <input value={form.unitNumber} onChange={(e) => setField('unitNumber', e.target.value)}
                      placeholder="e.g. 14" className={inputCls(false)} />
                  </Field>
                  <Field label="Size (m²)">
                    <input type="number" min="0" step="0.1" value={form.sizeInSqm} onChange={(e) => setField('sizeInSqm', e.target.value)}
                      placeholder="e.g. 93" className={inputCls(false)} />
                  </Field>
                </div>
                <Field label="Sectional Scheme">
                  <input value={form.sectionalScheme} onChange={(e) => setField('sectionalScheme', e.target.value)}
                    placeholder="e.g. SS PHOENIX VIEW ESTATE" className={inputCls(false)} />
                </Field>
                <Field label="ID Number">
                  <input value={form.idNumber} onChange={(e) => setField('idNumber', e.target.value)}
                    placeholder="e.g. 8103300215088" className={inputCls(false)} />
                </Field>
              </div>

              {/* Contact details */}
              <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4 space-y-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Contact Details
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Primary Phone" error={errors.phone}>
                    <input value={form.phone} onChange={(e) => setField('phone', e.target.value)}
                      placeholder="+27831234567" className={inputCls(errors.phone)} />
                  </Field>
                  <Field label="Alt Phone">
                    <input value={form.altPhone} onChange={(e) => setField('altPhone', e.target.value)}
                      placeholder="+27113456789" className={inputCls(false)} />
                  </Field>
                </div>
                {form.altPhone && (
                  <Field label="Preferred Phone to Call">
                    <div className="flex gap-3">
                      {[{ key: 'primary', label: 'Primary' }, { key: 'alt', label: 'Alternate' }].map(({ key, label }) => (
                        <button key={key} type="button" onClick={() => setField('preferredPhone', key)}
                          className={['flex-1 py-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-1.5',
                            form.preferredPhone === key ? 'border-[#F95C4B] bg-[#F95C4B]/8 text-[#F95C4B]' : 'border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:border-[#F95C4B]/40'].join(' ')}>
                          <PhoneForwarded className="w-3.5 h-3.5" /> {label}
                        </button>
                      ))}
                    </div>
                  </Field>
                )}
                <Field label="Email">
                  <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)}
                    placeholder="name@example.com" className={inputCls(false)} />
                </Field>
                <Field label="Address">
                  <input value={form.address} onChange={(e) => setField('address', e.target.value)}
                    placeholder="123 Main St, City, Province" className={inputCls(false)} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Source">
                  <input value={form.source} onChange={(e) => setField('source', e.target.value)}
                    placeholder="manual, import, web" className={inputCls(false)} />
                </Field>
                {mode === 'edit' && (
                  <Field label="Status">
                    <select value={form.status} onChange={(e) => setField('status', e.target.value)} className={inputCls(false)}>
                      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                    </select>
                  </Field>
                )}
              </div>

              <Field label="Assign to Cold Caller">
                <select value={form.assignedTo ?? ''} onChange={(e) => setField('assignedTo', e.target.value)} className={inputCls(false)}>
                  <option value="">Unassigned</option>
                  {callers.map((c) => (
                    <option key={c._id} value={c._id}>{c.firstName} {c.lastName}</option>
                  ))}
                </select>
              </Field>

              <Field label="Notes">
                <textarea value={form.notes} onChange={(e) => setField('notes', e.target.value)}
                  placeholder="Additional notes about this contact" rows={3}
                  className={`${inputCls(false)} resize-none`} />
              </Field>
            </form>
          )}
        </div>

        {/* Footer */}
        {!isView && (
          <div className="px-6 py-4 border-t border-[#E5E7EB] dark:border-[#2A2A2A] flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
              Cancel
            </button>
            <button type="submit" form="contact-form" disabled={busy}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'create' ? 'Create Contact' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

/* ─── View body ──────────────────────────────────────────────────────── */

function ViewBody({ contact, assignedCaller }) {
  if (!contact) return null

  const caller = contact.assignedTo

  return (
    <div className="space-y-5">
      {/* Avatar + status */}
      <div className="flex items-center gap-4">
        <Avatar name={contact.name} size={10} />
        <div>
          <h3 className="text-lg font-bold text-[#111111] dark:text-white">{contact.name}</h3>
          <StatusBadge status={contact.status} size="md" />
        </div>
      </div>

      {/* Property card */}
      {(contact.unitNumber || contact.sizeInSqm || contact.sectionalScheme || contact.idNumber) && (
        <div className="rounded-xl border border-[#8B5CF6]/20 bg-[#8B5CF6]/5 dark:bg-[#8B5CF6]/8 p-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8B5CF6] flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Property Details
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            {contact.unitNumber && (
              <div>
                <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] font-semibold uppercase tracking-widest">Unit</p>
                <p className="text-sm font-bold text-[#111111] dark:text-white">#{contact.unitNumber}</p>
              </div>
            )}
            {contact.sizeInSqm != null && (
              <div>
                <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] font-semibold uppercase tracking-widest">Size</p>
                <p className="text-sm font-bold text-[#111111] dark:text-white">{contact.sizeInSqm} m²</p>
              </div>
            )}
            {contact.sectionalScheme && (
              <div className="col-span-2">
                <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] font-semibold uppercase tracking-widest">Scheme</p>
                <p className="text-sm font-bold text-[#111111] dark:text-white">{contact.sectionalScheme}</p>
              </div>
            )}
            {contact.idNumber && (
              <div className="col-span-2">
                <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] font-semibold uppercase tracking-widest">ID Number</p>
                <p className="text-sm font-mono text-[#111111] dark:text-white">{contact.idNumber}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Phone / preferred */}
      {(contact.phone || contact.altPhone) && (
        <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] p-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" /> Phone Numbers
          </p>
          <PhonePicker contact={contact} />
        </div>
      )}

      {/* Assigned caller */}
      {caller ? (
        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-[#3B82F6]/30 bg-[#3B82F6]/6 dark:bg-[#3B82F6]/10">
          <Avatar name={`${caller.firstName} ${caller.lastName}`} color={callerColor(caller._id)} size={8} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#3B82F6]">Assigned Cold Caller</p>
            <p className="text-sm font-bold text-[#111111] dark:text-white">{caller.firstName} {caller.lastName}</p>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{caller.email}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3.5 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] bg-[#F5F5F4] dark:bg-[#202020]">
          <div className="w-8 h-8 rounded-full bg-[#6B7280]/15 flex items-center justify-center">
            <UserX className="w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Cold Caller</p>
            <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA]">Not assigned yet</p>
          </div>
        </div>
      )}

      {/* Other info */}
      <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A] overflow-hidden">
        {[
          { icon: Mail,   label: 'Email',   value: contact.email },
          { icon: MapPin, label: 'Address', value: contact.address },
          { icon: Filter, label: 'Source',  value: contact.source },
        ].map(({ icon: Icon, label, value }) =>
          value ? (
            <div key={label} className="flex items-start gap-3 px-4 py-3 bg-white dark:bg-[#181818]">
              <Icon className="w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA] mt-0.5 flex-shrink-0" strokeWidth={1.75} />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">{label}</p>
                <p className="text-sm text-[#111111] dark:text-white break-words">{value}</p>
              </div>
            </div>
          ) : null
        )}
      </div>

      {contact.notes && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-2 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Notes
          </p>
          <p className="text-sm text-[#111111] dark:text-white bg-[#F5F5F4] dark:bg-[#202020] rounded-xl p-4 leading-relaxed whitespace-pre-wrap">
            {contact.notes}
          </p>
        </div>
      )}

      <div className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] space-y-1">
        <p>Created: {format(new Date(contact.createdAt), 'd MMM yyyy, HH:mm')}</p>
        <p>Updated: {format(new Date(contact.updatedAt), 'd MMM yyyy, HH:mm')}</p>
        {contact.importIndex && <p>Import row: #{contact.importIndex}</p>}
      </div>
    </div>
  )
}

/* ─── Delete dialog ──────────────────────────────────────────────────── */

function DeleteDialog({ contact, onClose, onDeleted }) {
  const qc  = useQueryClient()
  const mut = useMutation({
    mutationFn: () => contactsApi.remove(contact._id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); toast.success('Contact deleted'); onDeleted() },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Delete failed'),
  })
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#EF4444]/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
            </div>
            <h3 className="font-bold text-[#111111] dark:text-white">Delete Contact</h3>
          </div>
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mb-6">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-[#111111] dark:text-white">{contact?.name}</span>?
            {' '}This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">Cancel</button>
            <button onClick={() => mut.mutate()} disabled={mut.isPending}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-60 flex items-center justify-center gap-2">
              {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Delete
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/* ─── Sort header ────────────────────────────────────────────────────── */

function SortTh({ label, field, sort, onSort }) {
  const isActive = sort === field || sort === `-${field}`
  const isDesc   = sort === `-${field}`
  return (
    <th onClick={() => onSort(isActive && !isDesc ? `-${field}` : field)}
      className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] cursor-pointer select-none whitespace-nowrap hover:text-[#111111] dark:hover:text-white group">
      <span className="flex items-center gap-1.5">
        {label}
        {isActive ? (isDesc ? <ArrowDown className="w-3 h-3 text-[#F95C4B]" /> : <ArrowUp className="w-3 h-3 text-[#F95C4B]" />)
          : <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />}
      </span>
    </th>
  )
}

/* ─── Contact table row ──────────────────────────────────────────────── */

function ContactRow({ contact, selected, onToggle, onView, onEdit, onDelete }) {
  const caller     = contact.assignedTo
  const color      = caller ? callerColor(caller._id) : null
  const hasPhone   = Boolean(contact.phone)
  const dialPhone  = contact.preferredPhone === 'alt' && contact.altPhone ? contact.altPhone : contact.phone

  return (
    <tr className={`group transition-colors ${selected ? 'bg-[#F95C4B]/5 dark:bg-[#F95C4B]/8' : 'hover:bg-[#FAFAF9] dark:hover:bg-[#111111]'}`}>

      {/* Checkbox */}
      <td className="pl-4 pr-2 py-3.5">
        <button onClick={onToggle}
          className="text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#F95C4B] dark:hover:text-[#F95C4B] transition-colors">
          {selected ? <CheckSquare className="w-4 h-4 text-[#F95C4B]" /> : <Square className="w-4 h-4" />}
        </button>
      </td>

      {/* Name */}
      <td className="px-3 py-3.5">
        <div className="flex items-center gap-3">
          <Avatar name={contact.name} size={8} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#111111] dark:text-white truncate max-w-[130px]">{contact.name}</p>
            {contact.unitNumber && (
              <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">Unit #{contact.unitNumber}</p>
            )}
          </div>
        </div>
      </td>

      {/* Phone */}
      <td className="px-3 py-3.5">
        {hasPhone ? (
          <div className="space-y-0.5">
            <a href={`tel:${dialPhone}`}
              className={`text-sm font-mono flex items-center gap-1 ${contact.preferredPhone === 'alt' && contact.altPhone ? 'text-[#F95C4B]' : 'text-[#111111] dark:text-white'}`}>
              <Phone className="w-3 h-3 flex-shrink-0" /> {dialPhone}
            </a>
            {contact.altPhone && contact.phone && (
              <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] font-mono">
                {contact.preferredPhone === 'alt' ? contact.phone : contact.altPhone}
              </p>
            )}
          </div>
        ) : (
          <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA] italic">No phone</span>
        )}
      </td>

      {/* Scheme + Size */}
      <td className="px-3 py-3.5">
        {contact.sectionalScheme ? (
          <div>
            <p className="text-xs font-semibold text-[#8B5CF6] truncate max-w-[150px]">{contact.sectionalScheme}</p>
            {contact.sizeInSqm != null && (
              <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA]">{contact.sizeInSqm} m²</p>
            )}
          </div>
        ) : <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA] italic">—</span>}
      </td>

      {/* Assigned caller */}
      <td className="px-3 py-3.5">
        {caller ? (
          <div className="flex items-center gap-2">
            <Avatar name={`${caller.firstName} ${caller.lastName}`} color={color} size={6} />
            <span className="text-xs font-semibold text-[#111111] dark:text-white truncate max-w-[100px]">
              {caller.firstName} {caller.lastName}
            </span>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold bg-[#6B7280]/10 text-[#6B7280] dark:text-[#A1A1AA]">
            <UserX className="w-2.5 h-2.5" /> Unassigned
          </span>
        )}
      </td>

      {/* Status */}
      <td className="px-3 py-3.5"><StatusBadge status={contact.status} /></td>

      {/* Added */}
      <td className="px-3 py-3.5">
        <span className="text-xs text-[#6B7280] dark:text-[#A1A1AA] whitespace-nowrap">
          {format(new Date(contact.createdAt), 'd MMM yyyy')}
        </span>
      </td>

      {/* Actions */}
      <td className="px-3 py-3.5">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button title="View" onClick={onView}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] hover:text-[#111111] dark:hover:text-white transition-all">
            <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
          <button title="Edit" onClick={onEdit}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#3B82F6]/10 hover:text-[#3B82F6] transition-all">
            <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
          <button title="Delete" onClick={onDelete}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#EF4444]/10 hover:text-[#EF4444] transition-all">
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </td>
    </tr>
  )
}

/* ─── Empty state ────────────────────────────────────────────────────── */

function EmptyState({ hasFilters, onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center mb-4">
        <BookUser className="w-7 h-7 text-[#F95C4B]" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">
        {hasFilters ? 'No contacts found' : 'No contacts yet'}
      </h3>
      <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] mb-6 max-w-xs">
        {hasFilters ? 'Try adjusting your search or filters.' : 'Import an Excel spreadsheet or add contacts manually.'}
      </p>
      {!hasFilters && (
        <button onClick={onAdd}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A]">
          <Plus className="w-4 h-4" /> Add First Contact
        </button>
      )}
    </div>
  )
}

/* ─── Pagination ─────────────────────────────────────────────────────── */

function PageBtn({ onClick, disabled, icon: Icon }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-8 h-8 rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-white dark:hover:bg-[#181818] disabled:opacity-40 disabled:cursor-not-allowed">
      <Icon className="w-4 h-4" />
    </button>
  )
}

function buildPageNums(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = [1]
  if (current > 3) pages.push('...')
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p)
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
}

/* ─── Main Page ──────────────────────────────────────────────────────── */

export default function ContactsPage() {
  const [search,       setSearch]     = useState('')
  const [statusFilter, setStatus]     = useState('')
  const [callerFilter, setCaller]     = useState('')
  const [schemeFilter, setScheme]     = useState('')
  const [sort,         setSort]       = useState('-createdAt')
  const [page,         setPage]       = useState(1)
  const [drawer,       setDrawer]     = useState(null)
  const [toDelete,     setToDelete]   = useState(null)
  const [selected,     setSelected]   = useState(new Set())
  const [assigning,    setAssigning]  = useState(false)
  const [modal,        setModal]      = useState(null) // 'import' | 'files' | 'smart-assign'

  const debouncedSearch = useDebounce(search)
  const qc = useQueryClient()

  useEffect(() => { setPage(1); setSelected(new Set()) }, [debouncedSearch, statusFilter, callerFilter, schemeFilter, sort])

  /* Contacts */
  const { data, isLoading, isError } = useQuery({
    queryKey: ['contacts', { page, search: debouncedSearch, status: statusFilter, assignedTo: callerFilter, sectionalScheme: schemeFilter, sort }],
    queryFn: () =>
      contactsApi.list({
        page, limit: 20,
        search:          debouncedSearch || undefined,
        status:          statusFilter    || undefined,
        assignedTo:      callerFilter    || undefined,
        sectionalScheme: schemeFilter    || undefined,
        sort,
      }).then((r) => r.data.data),
    placeholderData: keepPreviousData,
  })

  const { data: countData } = useQuery({
    queryKey: ['contacts-total'],
    queryFn: () => contactsApi.list({ limit: 1 }).then((r) => r.data.data),
    staleTime: 60_000,
  })

  const { data: unassignedData } = useQuery({
    queryKey: ['contacts-unassigned'],
    queryFn: () => contactsApi.list({ limit: 1, assignedTo: 'unassigned' }).then((r) => r.data.data),
    staleTime: 30_000,
  })

  const { data: schemesData } = useQuery({
    queryKey: ['contact-schemes'],
    queryFn: () => contactsApi.listSchemes().then((r) => r.data.data.schemes),
    staleTime: 120_000,
  })

  const { data: callersData } = useQuery({
    queryKey: ['cold-callers'],
    queryFn: () => usersApi.list({ role: 'cold_caller', limit: 100, isActive: true }).then((r) => r.data.data.users),
    staleTime: 60_000,
  })

  const { data: contactRequestsData, refetch: refetchRequests } = useQuery({
    queryKey: ['contact-requests-pending'],
    queryFn: () => contactRequestsApi.list({ status: 'pending', limit: 20 }),
    staleTime: 30_000,
  })
  const pendingRequests = contactRequestsData?.requests ?? []

  const fulfillRequestMut = useMutation({
    mutationFn: ({ id, adminNote }) => contactRequestsApi.updateStatus(id, { status: 'fulfilled', adminNote }),
    onSuccess: () => {
      refetchRequests()
      toast.success('Request marked as fulfilled — cold caller notified')
    },
    onError: () => toast.error('Failed to update request'),
  })

  const dismissRequestMut = useMutation({
    mutationFn: (id) => contactRequestsApi.updateStatus(id, { status: 'dismissed' }),
    onSuccess: () => {
      refetchRequests()
      toast.success('Request dismissed')
    },
    onError: () => toast.error('Failed to dismiss request'),
  })

  const callerIds = (callersData ?? []).map((c) => c._id)
  const callerCountQueries = useQuery({
    queryKey: ['caller-counts', callerIds],
    queryFn: async () => {
      if (!callerIds.length) return {}
      const results = await Promise.all(
        callerIds.map((id) => contactsApi.list({ limit: 1, assignedTo: id }).then((r) => ({ id, count: r.data.data.total })))
      )
      return Object.fromEntries(results.map(({ id, count }) => [id, count]))
    },
    enabled: callerIds.length > 0,
    staleTime: 30_000,
  })

  const contacts   = data?.contacts   ?? []
  const total      = data?.total      ?? 0
  const totalPages = data?.totalPages ?? 1
  const hasFilters = Boolean(search || statusFilter || callerFilter || schemeFilter)
  const schemes    = schemesData ?? []

  const callers = (callersData ?? []).map((c) => ({
    ...c, contactCount: callerCountQueries.data?.[c._id] ?? 0,
  }))

  /* Selection — only select contacts that have a phone */
  const pageIds   = contacts.filter((c) => c.phone).map((c) => c._id)
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const someOnPage = pageIds.some((id) => selected.has(id))

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allOnPage) pageIds.forEach((id) => next.delete(id))
      else           pageIds.forEach((id) => next.add(id))
      return next
    })
  }

  function toggleOne(id, hasPhone) {
    if (!hasPhone) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  /* Bulk assign */
  async function handleBulkAssign(callerId) {
    setAssigning(true)
    const caller = callers.find((c) => c._id === callerId)
    try {
      await Promise.all([...selected].map((id) => contactsApi.update(id, { assignedTo: callerId, status: 'assigned' })))
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['caller-counts'] })
      qc.invalidateQueries({ queryKey: ['contacts-unassigned'] })
      toast.success(`${selected.size} contact${selected.size !== 1 ? 's' : ''} assigned to ${caller?.firstName} ${caller?.lastName}`)
      setSelected(new Set())
    } catch { toast.error('Some assignments failed.') } finally { setAssigning(false) }
  }

  const statusTabs = [
    { key: '', label: 'All', count: countData?.total },
    ...STATUSES.map((s) => ({ key: s, label: STATUS_META[s].label })),
  ]

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Contact Requests Banner ───────────────────────────────────────── */}
      {pendingRequests.length > 0 && (
        <div className="mx-5 sm:mx-8 mt-5 rounded-2xl border border-[#F95C4B]/25 bg-[#F95C4B]/5 dark:bg-[#F95C4B]/10 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[#F95C4B]/15">
            <div className="w-7 h-7 rounded-lg bg-[#F95C4B]/15 flex items-center justify-center">
              <Bell className="w-3.5 h-3.5 text-[#F95C4B]" strokeWidth={1.75} />
            </div>
            <span className="text-sm font-bold text-[#111111] dark:text-white flex-1">
              Contact Requests
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#F95C4B] text-white">
              {pendingRequests.length}
            </span>
          </div>
          <div className="divide-y divide-[#F95C4B]/10">
            {pendingRequests.map((req) => {
              const caller = req.requestedBy
              const initials = `${caller?.firstName?.[0] ?? ''}${caller?.lastName?.[0] ?? ''}`.toUpperCase()
              return (
                <div key={req._id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#F95C4B]/15 flex items-center justify-center">
                    <span className="text-xs font-bold text-[#F95C4B]">{initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#111111] dark:text-white">
                      {caller?.firstName} {caller?.lastName}
                      <span className="text-xs font-normal text-[#6B7280] dark:text-[#A1A1AA] ml-2">
                        {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                      </span>
                    </p>
                    {req.message && (
                      <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate mt-0.5 italic">
                        "{req.message}"
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setModal('smart-assign')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] transition-colors"
                    >
                      Assign Contacts
                    </button>
                    <button
                      onClick={() => fulfillRequestMut.mutate({ id: req._id })}
                      disabled={fulfillRequestMut.isPending}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#10B981] bg-[#10B981]/10 hover:bg-[#10B981]/20 transition-colors"
                    >
                      Mark Fulfilled
                    </button>
                    <button
                      onClick={() => dismissRequestMut.mutate(req._id)}
                      disabled={dismissRequestMut.isPending}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6B7280] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="px-5 sm:px-8 pt-6 pb-0 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-[#111111] dark:text-white tracking-tight flex items-center gap-2.5">
              <BookUser className="w-5 h-5 text-[#F95C4B]" strokeWidth={1.75} /> Contacts
            </h1>
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
              {isLoading ? 'Loading…' : `${total.toLocaleString()} contact${total !== 1 ? 's' : ''} total`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setModal('smart-assign')}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#8B5CF6] hover:bg-[#7C3AED] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
              <Target className="w-4 h-4" /> Smart Assign
            </button>
            <button onClick={() => setModal('files')}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] transition-all">
              <FolderOpen className="w-4 h-4" /> Files
            </button>
            <button onClick={() => setModal('import')}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold border border-[#10B981]/40 text-[#10B981] bg-[#10B981]/8 hover:bg-[#10B981]/12 transition-all">
              <FileSpreadsheet className="w-4 h-4" /> Import Excel
            </button>
            <button onClick={() => setDrawer({ mode: 'create' })}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
              <Plus className="w-4 h-4" /> Add Contact
            </button>
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex gap-0.5 overflow-x-auto">
          {statusTabs.map((tab) => (
            <button key={tab.key} onClick={() => setStatus(tab.key)}
              className={['flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all rounded-t-lg',
                statusFilter === tab.key
                  ? 'border-[#F95C4B] text-[#F95C4B] bg-[#F95C4B]/5 dark:bg-[#F95C4B]/8'
                  : 'border-transparent text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#202020]'].join(' ')}>
              {tab.key && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_META[tab.key].color }} />}
              {tab.label}
              {tab.count != null && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-[#F5F5F4] dark:bg-[#202020] text-[#6B7280] dark:text-[#A1A1AA]">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Sectional Scheme strip ─────────────────────────────────────── */}
      {schemes.length > 0 && (
        <div className="px-5 sm:px-8 py-3 bg-[#FAFAF9] dark:bg-[#0B0B0B] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <div className="flex items-center gap-2 mb-2.5">
            <Layers className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#A1A1AA]" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">
              Filter by Sectional Scheme
            </p>
            {schemeFilter && (
              <button onClick={() => setScheme('')} className="ml-auto flex items-center gap-1 text-[10px] text-[#8B5CF6] font-semibold hover:underline">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          <SchemeStrip schemes={schemes} active={schemeFilter} onSelect={(s) => setScheme((prev) => prev === s ? '' : s)} />
        </div>
      )}

      {/* ── Cold Caller strip ──────────────────────────────────────────── */}
      <div className="px-5 sm:px-8 py-3 bg-[#FAFAF9] dark:bg-[#0B0B0B] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex items-center gap-2 mb-2.5">
          <Users className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#A1A1AA]" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">
            Filter by Cold Caller
          </p>
          {callerFilter && (
            <button onClick={() => setCaller('')} className="ml-auto flex items-center gap-1 text-[10px] text-[#F95C4B] font-semibold hover:underline">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
        <CallerStrip callers={callers} activeCaller={callerFilter}
          onSelect={(id) => setCaller((prev) => prev === id ? '' : id)}
          totalUnassigned={unassignedData?.total} />
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div className="px-5 sm:px-8 py-3 flex flex-col sm:flex-row gap-3 bg-[#FAFAF9] dark:bg-[#0B0B0B] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#A1A1AA]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, unit, scheme, ID…"
            className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white placeholder:text-[#6B7280]/50 dark:placeholder:text-[#A1A1AA]/40 focus:border-[#F95C4B] focus:ring-2 focus:ring-[#F95C4B]/20 outline-none" />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111111] dark:hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white dark:bg-[#181818] border border-[#E5E7EB] dark:border-[#2A2A2A] self-start">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#A1A1AA] flex-shrink-0" />
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-transparent text-[#111111] dark:text-white text-sm outline-none cursor-pointer">
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {selected.size > 0 && (
          <button onClick={() => setSelected(new Set())}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#F95C4B]/10 text-[#F95C4B] border border-[#F95C4B]/20 hover:bg-[#F95C4B]/15">
            <CheckSquare className="w-3.5 h-3.5" />
            {selected.size} selected <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto px-5 sm:px-8 py-5">
        {isError && (
          <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-sm text-[#EF4444] mb-4">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Failed to load contacts. Please try refreshing.
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-28">
            <Loader2 className="w-6 h-6 animate-spin text-[#F95C4B]" />
          </div>
        ) : contacts.length === 0 ? (
          <EmptyState hasFilters={hasFilters} onAdd={() => setDrawer({ mode: 'create' })} />
        ) : (
          <div className="bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px]">
                <thead className="bg-[#FAFAF9] dark:bg-[#111111] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
                  <tr>
                    <th className="pl-4 pr-2 py-3.5">
                      <button onClick={toggleAll}
                        className="text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#F95C4B] dark:hover:text-[#F95C4B] transition-colors">
                        {allOnPage ? <CheckSquare className="w-4 h-4 text-[#F95C4B]" />
                          : someOnPage ? <CheckSquare className="w-4 h-4 opacity-50" />
                          : <Square className="w-4 h-4" />}
                      </button>
                    </th>
                    <SortTh label="Name"       field="name"        sort={sort} onSort={setSort} />
                    <th className="px-3 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Phone</th>
                    <th className="px-3 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Scheme / Size</th>
                    <th className="px-3 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Cold Caller</th>
                    <th className="px-3 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Status</th>
                    <SortTh label="Added"      field="createdAt"   sort={sort} onSort={setSort} />
                    <th className="px-3 py-3.5 text-right text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F4] dark:divide-[#202020]">
                  {contacts.map((c) => (
                    <ContactRow
                      key={c._id}
                      contact={c}
                      selected={selected.has(c._id)}
                      onToggle={() => toggleOne(c._id, Boolean(c.phone))}
                      onView={()   => setDrawer({ mode: 'view', contact: c })}
                      onEdit={()   => setDrawer({ mode: 'edit', contact: c })}
                      onDelete={() => setToDelete(c)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between mt-5">
            <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
              Page {page} of {totalPages} &mdash; {total.toLocaleString()} results
            </p>
            <div className="flex items-center gap-1.5">
              <PageBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} icon={ChevronLeft} />
              {buildPageNums(page, totalPages).map((p, i) =>
                p === '...' ? (
                  <span key={`e${i}`} className="w-8 text-center text-xs text-[#6B7280]">…</span>
                ) : (
                  <button key={p} onClick={() => setPage(p)}
                    className={['w-8 h-8 rounded-lg text-xs font-semibold transition-all',
                      p === page ? 'bg-[#F95C4B] text-white shadow-sm' : 'border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-white dark:hover:bg-[#181818]'].join(' ')}>
                    {p}
                  </button>
                )
              )}
              <PageBtn onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} icon={ChevronRight} />
            </div>
          </div>
        )}
      </div>

      {/* ── Drawers & dialogs ─────────────────────────────────────────── */}
      {drawer && (
        <ContactDrawer mode={drawer.mode} contact={drawer.contact} callers={callers}
          onClose={() => setDrawer(null)} onSaved={() => setDrawer(null)} />
      )}

      {toDelete && (
        <DeleteDialog contact={toDelete} onClose={() => setToDelete(null)} onDeleted={() => setToDelete(null)} />
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      {modal === 'import' && (
        <ImportModal onClose={() => setModal(null)} onDone={() => setModal(null)} />
      )}

      {modal === 'files' && (
        <FilesVaultModal onClose={() => setModal(null)} />
      )}

      {modal === 'smart-assign' && (
        <SmartAssignModal
          callers={callers}
          schemes={schemes}
          onClose={() => setModal(null)}
          onDone={() => setModal(null)}
        />
      )}

      {/* ── Floating bulk-assign bar ───────────────────────────────────── */}
      {selected.size > 0 && (
        <BulkAssignBar count={selected.size} callers={callers}
          onAssign={handleBulkAssign} onClear={() => setSelected(new Set())} busy={assigning} />
      )}
    </div>
  )
}
