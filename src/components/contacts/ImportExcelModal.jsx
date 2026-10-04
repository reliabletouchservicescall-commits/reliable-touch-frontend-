import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  X, Loader2, CloudUpload, FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, Layers, PhoneOff, ChevronRight,
} from 'lucide-react'
import { contactsApi } from '../../services/contactsApi'
import { areasApi } from '../../services/areasApi'
import { SearchableAreaSelect } from '../leads/leadShared'

export function fmtBytes(bytes) {
  if (!bytes) return '—'
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

export default function ImportModal({ onClose, onDone, onReviewDuplicates }) {
  const qc = useQueryClient()
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile]         = useState(null)
  const [areaId, setAreaId]     = useState('')
  const [result, setResult]     = useState(null)
  const fileRef = useRef(null)

  const { data: areasData } = useQuery({
    queryKey: ['areas-select'],
    queryFn: () => areasApi.list({ limit: 100, isActive: true }).then((r) => r.data.data.areas),
    staleTime: 60_000,
  })
  const areas = areasData ?? []

  const mut = useMutation({
    mutationFn: (f) => {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('areaId', areaId)
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

  function handleUpload() { if (file && areaId) mut.mutate(file) }

  const busy = mut.isPending

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={!busy ? onClose : undefined} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl">

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

                {/* Area — required: every contact in this spreadsheet is tagged with it */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-1.5">
                    Area<span className="text-[#F95C4B] ml-0.5">*</span>
                  </label>
                  <SearchableAreaSelect
                    areas={areas}
                    value={areaId}
                    onChange={setAreaId}
                    placeholder="Select the area this spreadsheet belongs to…"
                    allowAdd
                  />
                  <p className="mt-1.5 text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">
                    {areaId ? 'Every contact in this spreadsheet will be tagged with this area.' : "Pick the area first — can't import without one. Can't find it? Add it right here."}
                  </p>
                </div>

                {/* Info */}
                <div className="rounded-xl bg-[#F5F5F4] dark:bg-[#202020] p-4 space-y-2.5">
                  <p className="text-xs font-semibold text-[#111111] dark:text-white">Two formats are auto-detected:</p>
                  <div>
                    <p className="text-[11px] font-semibold text-[#111111] dark:text-white">Deeds office owner report</p>
                    <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] leading-relaxed">
                      <strong>UNIT</strong> · <strong>SIZE</strong> · <strong>SECTIONAL SCHEME</strong> · <strong>NAME</strong> · <strong>IDENTIFIER</strong> (ID number) · last column (phone / DO NOT CONTACT / COMPANY / etc.) — the last column may be named <strong>Column1</strong> or <strong>CONTACTS</strong>, and numbers may be separated with "/" or "\".
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[#111111] dark:text-white">Scheme / Units workbook</p>
                    <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] leading-relaxed">
                      A workbook with a <strong>Units</strong> sheet — <strong>Unit Number</strong> · <strong>Current Owners Names</strong> · <strong>Current Owners IDs</strong> · <strong>Size (m²)</strong> · a phone column, labeled <strong>Phone Numbers</strong> or left unlabeled as the sheet's last column. Extra columns (e.g. Transfer/Sale Date) are ignored. Co-owned units (multiple names) are split into one contact per owner, matched to their own number where labeled.
                    </p>
                  </div>
                  <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">
                    Only rows with a phone number are saved. Rows marked "COMPANY", "NO RESULTS", "INCOMPLETE ID", "DO NOT CONTACT" or with no phone are counted in the summary but not imported.</p>
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={onClose} disabled={busy}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] disabled:opacity-50">
                    Cancel
                  </button>
                  <button onClick={handleUpload} disabled={!file || !areaId || busy}
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
                    { label: 'Contacts detected',     value: result.stats.total,        color: '#111111' },
                    { label: 'With phone number',     value: result.stats.withPhone,    color: '#3B82F6' },
                    { label: 'Without phone number',  value: result.stats.withoutPhone, color: '#F59E0B' },
                    { label: 'Uploaded & saved',      value: result.stats.created,      color: '#10B981' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex flex-col gap-0.5 p-3 rounded-xl bg-[#F5F5F4] dark:bg-[#202020]">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA]">{label}</span>
                      <span className="text-xl font-bold" style={{ color }}>{value}</span>
                    </div>
                  ))}
                </div>

                {result.stats.withoutPhone > 0 && (
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#F59E0B]/8 border border-[#F59E0B]/25">
                    <PhoneOff className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#F59E0B]">{result.stats.withoutPhone} row{result.stats.withoutPhone !== 1 ? 's' : ''} had no phone number and were not saved</p>
                      <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
                        {Object.entries(result.stats.withoutPhoneReasons ?? {})
                          .map(([reason, n]) => `${n} ${reason === 'NO_PHONE' ? 'blank' : reason.replace(/_/g, ' ').toLowerCase()}`)
                          .join(' · ')}
                      </p>
                    </div>
                  </div>
                )}

                {(result.stats.dnc > 0 || result.stats.sharedPhone > 0) && (
                  <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">
                    {result.stats.dnc > 0 && <>{result.stats.dnc} saved as Do Not Call. </>}
                    {result.stats.sharedPhone > 0 && <>{result.stats.sharedPhone} co-owner{result.stats.sharedPhone !== 1 ? 's' : ''} shared a number already claimed in this file (not saved twice).</>}
                  </p>
                )}

                {/* Duplicates — a phone number that already exists on another contact was
                    dropped from creation entirely unless reviewed here, so this needs a
                    dedicated CTA rather than a bare number admin can't act on. */}
                {result.stats.duplicates > 0 && (
                  <button
                    onClick={() => onReviewDuplicates(result.duplicates)}
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-[#8B5CF6]/8 border border-[#8B5CF6]/25 hover:bg-[#8B5CF6]/12 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#8B5CF6]/15 flex items-center justify-center flex-shrink-0">
                      <Layers className="w-4 h-4 text-[#8B5CF6]" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#8B5CF6]">{result.stats.duplicates} duplicate{result.stats.duplicates !== 1 ? 's' : ''} matched an existing contact</p>
                      <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">Not created — click to review and decide what to do with them</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#8B5CF6] flex-shrink-0" />
                  </button>
                )}

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
