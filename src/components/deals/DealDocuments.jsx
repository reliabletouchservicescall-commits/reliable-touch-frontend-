import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  FileText, Image as ImageIcon, UploadCloud, Check, Star, Circle, Trash2, ExternalLink, Loader2, Paperclip, Camera,
} from 'lucide-react'
import { leadsApi } from '../../services/leadsApi'
import { getApiErrorMessage } from '../leads/leadShared'
import { DEAL_DOC_STAGES, DOC_LABEL, docsFor, docProgress } from '../../lib/dealDocs'

// A deal's documents, stage by stage: pick the stage, see what's in and what's still needed
// (★ key documents), and drop or pick files to upload them to that document — straight to
// Firebase via POST /leads/:id/deal/documents. Used on the lead's Deal section and in the
// Deal Tracker. `documents` come from the lead (raw, `_id`) or the board (shaped, `id`).

const sizeText = (n) => (!n ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const idOf = (d) => d.id ?? d._id

function Ring({ done, total, color, size = 34 }) {
  const r = (size - 5) / 2, c = 2 * Math.PI * r
  const pct = total ? done / total : 0
  return (
    <svg width={size} height={size} className="-rotate-90 flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="3.5" className="text-[#E5E7EB] dark:text-[#2A2A2A]" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={pct === 1 ? '#10B981' : color} strokeWidth="3.5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset 700ms var(--ease-mac)' }} />
    </svg>
  )
}

export default function DealDocuments({ leadId, listingType, documents = [], canUpload, currentUserId, isAdmin, onChange, initialStage, compact = false }) {
  const qc = useQueryClient()
  const progress = docProgress(documents, listingType)
  const firstOpen = initialStage ?? DEAL_DOC_STAGES.find((s) => progress.byStage[s.key].keyDone < progress.byStage[s.key].key)?.key ?? 'tenant'
  const [stageKey, setStageKey] = useState(firstOpen)
  const stage = DEAL_DOC_STAGES.find((s) => s.key === stageKey)
  const types = docsFor(stage, listingType)
  const [pick, setPick] = useState(null) // the document type the next files belong to
  const type = pick && types.some((t) => t.type === pick) ? pick : (types.find((t) => t.key && !documents.some((d) => d.type === t.type)) ?? types[0]).type
  const [busy, setBusy] = useState(null) // { type, pct }
  const [drag, setDrag] = useState(false)
  const [removing, setRemoving] = useState(null)
  const fileRef = useRef(null)
  const camRef = useRef(null)

  const refresh = (docs) => {
    onChange?.(docs)
    qc.invalidateQueries({ queryKey: ['deal-tracker'] })
    qc.invalidateQueries({ queryKey: ['lead', leadId] })
    qc.invalidateQueries({ queryKey: ['lead-activity', leadId] })
  }

  async function send(files, forType = type) {
    const list = [...(files ?? [])]
    if (!list.length) return
    const big = list.find((f) => f.size > 20 * 1024 * 1024)
    if (big) { toast.error(`${big.name} is over 20 MB`); return }
    const fd = new FormData()
    fd.append('type', forType)
    list.slice(0, 10).forEach((f) => fd.append('files', f))
    setBusy({ type: forType, pct: 0 })
    try {
      const r = await leadsApi.uploadDealDocuments(leadId, fd, (pct) => setBusy({ type: forType, pct }))
      toast.success(`${DOC_LABEL[forType]} uploaded`, { description: `${list.length} file${list.length === 1 ? '' : 's'} saved to the deal` })
      refresh(r.data.data.documents)
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Upload failed — check your connection and try again'))
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
      if (camRef.current) camRef.current.value = ''
    }
  }

  async function remove(d) {
    if (!window.confirm(`Remove ${d.name}?`)) return
    setRemoving(idOf(d))
    try {
      const r = await leadsApi.removeDealDocument(leadId, idOf(d))
      toast.success('Document removed')
      refresh(r.data.data.documents)
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Couldn’t remove it'))
    } finally {
      setRemoving(null)
    }
  }

  const uploadFor = (t) => { setPick(t); setTimeout(() => fileRef.current?.click(), 0) }

  return (
    <div className="space-y-4">
      {/* Overall */}
      <div className="flex items-center gap-3">
        <Ring done={progress.keyDone} total={progress.key} color="#F95C4B" size={42} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#111111] dark:text-white">{progress.keyDone} of {progress.key} key documents in</p>
          <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{progress.files} file{progress.files === 1 ? '' : 's'} uploaded · ★ = needed to close the deal</p>
        </div>
      </div>

      {/* Stages */}
      <div className={`grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-3 lg:grid-cols-6'}`}>
        {DEAL_DOC_STAGES.map((s) => {
          const p = progress.byStage[s.key]
          const on = s.key === stageKey
          const full = p.key > 0 && p.keyDone === p.key
          return (
            <button key={s.key} type="button" onClick={() => { setStageKey(s.key); setPick(null) }}
              className={`mac-press relative flex items-center gap-2 rounded-2xl px-3 py-2.5 text-left border transition-all ${on ? 'border-transparent shadow-[0_8px_20px_-12px_rgba(0,0,0,0.5)]' : 'border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#9CA3AF]'}`}
              style={on ? { backgroundColor: `${s.color}18`, boxShadow: `inset 0 0 0 1.5px ${s.color}` } : undefined}>
              {p.key ? <Ring done={p.keyDone} total={p.key} color={s.color} size={26} /> : <Paperclip className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />}
              <span className="min-w-0">
                <span className="block text-xs font-bold text-[#111111] dark:text-white truncate">{s.short}</span>
                <span className={`block text-[10px] ${full ? 'text-[#059669] dark:text-[#34D399] font-semibold' : 'text-[#9CA3AF]'}`}>{full ? 'All in' : p.key ? `${p.keyDone}/${p.key} key` : `${p.files} file${p.files === 1 ? '' : 's'}`}</span>
              </span>
              {p.files > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: s.color }}>{p.files}</span>}
            </button>
          )
        })}
      </div>

      {/* Drop zone for the chosen stage */}
      {canUpload && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); send(e.dataTransfer.files) }}
          className={`rounded-2xl border-2 border-dashed p-4 transition-all ${drag ? 'scale-[1.01]' : ''}`}
          style={{ borderColor: drag ? stage.color : 'rgb(156 163 175 / 0.4)', backgroundColor: drag ? `${stage.color}10` : undefined }}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA]">Uploading to:</span>
            <select value={type} onChange={(e) => setPick(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-[#111111] border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white outline-none">
              {types.map((t) => <option key={t.type} value={t.type}>{t.key ? '★ ' : ''}{t.label}</option>)}
            </select>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${stage.color}18`, color: stage.color }}>
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
            </span>
            <div className="flex-1 min-w-[180px]">
              {busy ? (
                <>
                  <p className="text-sm font-semibold text-[#111111] dark:text-white">Uploading {DOC_LABEL[busy.type]}… {busy.pct}%</p>
                  <div className="mt-1.5 h-1.5 rounded-full bg-[#E5E7EB] dark:bg-[#2A2A2A] overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${busy.pct}%`, backgroundColor: stage.color }} /></div>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-[#111111] dark:text-white">Drop files here, or choose them</p>
                  <p className="text-xs text-[#9CA3AF]">Photos, PDF, Word or Excel · up to 10 files, 20 MB each</p>
                </>
              )}
            </div>
            <button type="button" disabled={Boolean(busy)} onClick={() => fileRef.current?.click()}
              className="mac-press flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ backgroundColor: stage.color }}>
              <UploadCloud className="w-4 h-4" /> Choose files
            </button>
            <button type="button" disabled={Boolean(busy)} onClick={() => camRef.current?.click()} title="Take a photo"
              className="mac-press w-10 h-10 rounded-xl flex items-center justify-center border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white disabled:opacity-50">
              <Camera className="w-4 h-4" />
            </button>
            <input ref={fileRef} type="file" multiple hidden accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => send(e.target.files)} />
            <input ref={camRef} type="file" hidden accept="image/*" capture="environment" onChange={(e) => send(e.target.files)} />
          </div>
        </div>
      )}

      {/* Checklist for the stage */}
      <ul key={stageKey} className="space-y-2">
        {types.map((t, i) => {
          const files = documents.filter((d) => d.type === t.type)
          const has = files.length > 0
          return (
            <li key={t.type} className="mac-in rounded-2xl border px-4 py-3 transition-colors" style={{ '--d': `${i * 35}ms`, borderColor: has ? 'rgb(16 185 129 / 0.35)' : 'rgb(156 163 175 / 0.25)', backgroundColor: has ? 'rgb(16 185 129 / 0.05)' : undefined }}>
              <div className="flex items-center gap-3">
                {has ? <span className="w-6 h-6 rounded-full bg-[#10B981] text-white flex items-center justify-center flex-shrink-0"><Check className="w-3.5 h-3.5" /></span>
                  : t.key ? <Star className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mx-0.5" /> : <Circle className="w-5 h-5 text-[#D4D4D8] dark:text-[#3F3F46] flex-shrink-0 mx-0.5" />}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-[#111111] dark:text-white">{t.label}</span>
                  <span className={`block text-[11px] ${has ? 'text-[#059669] dark:text-[#34D399]' : t.key ? 'text-[#D97706]' : 'text-[#9CA3AF]'}`}>
                    {has ? `${files.length} file${files.length === 1 ? '' : 's'} uploaded` : t.key ? 'Needed to close the deal' : 'Optional'}
                  </span>
                </span>
                {canUpload && (
                  <button type="button" disabled={Boolean(busy)} onClick={() => uploadFor(t.type)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#111111] dark:text-white hover:border-[#F95C4B] hover:text-[#F95C4B] disabled:opacity-50">
                    {busy?.type === t.type ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />} {has ? 'Add' : 'Upload'}
                  </button>
                )}
              </div>
              {has && (
                <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 pl-9">
                  {files.map((d) => {
                    const img = d.mimeType?.startsWith('image/')
                    return (
                      <div key={idOf(d)} className="mac-pop group flex items-center gap-2.5 rounded-xl bg-white dark:bg-[#111111] border border-[#E5E7EB] dark:border-[#2A2A2A] p-2">
                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-[#F5F5F4] dark:bg-[#202020] flex items-center justify-center">
                          {img ? <img src={d.url} alt="" className="w-full h-full object-cover" loading="lazy" /> : <FileText className="w-5 h-5 text-[#F95C4B]" />}
                        </a>
                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-[#111111] dark:text-white truncate group-hover:text-[#F95C4B]">{d.name}</span>
                          <span className="block text-[10px] text-[#9CA3AF] truncate">{[sizeText(d.size), d.uploadedByName ?? d.uploadedBy, d.uploadedAt ? format(new Date(d.uploadedAt), 'd MMM') : null].filter(Boolean).join(' · ')}</span>
                        </a>
                        <a href={d.url} target="_blank" rel="noopener noreferrer" title="Open" className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#111111] dark:hover:text-white">
                          {img ? <ImageIcon className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                        </a>
                        {canUpload && (isAdmin || String(d.uploadedById ?? d.uploadedBy) === String(currentUserId)) && (
                          <button type="button" onClick={() => remove(d)} disabled={removing === idOf(d)} title="Remove"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#EF4444]/10">
                            {removing === idOf(d) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
