import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, Layers, Loader2, X } from 'lucide-react'
import { contactsApi } from '../../services/contactsApi'

/* ─── Duplicates Review Modal ─────────────────────────────────────────── */

// A duplicate row is one whose phone number already matched an existing contact during
// import, so it was never created — this is a one-shot, in-memory review of that list
// (it's only ever returned once, by the import call itself), letting admin decide per
// row (or in bulk) whether to skip it, merge it into the existing contact, or force-create
// it as a genuinely separate contact anyway (e.g. two co-owners sharing one phone).
export default function DuplicatesReviewModal({ duplicates, onClose, onDone }) {
  const qc = useQueryClient()
  const [resolutions, setResolutions] = useState(() =>
    Object.fromEntries(duplicates.map((_, i) => [i, 'skip']))
  )
  const [touched, setTouched] = useState(() => new Set())
  const [confirmingClose, setConfirmingClose] = useState(false)

  const untouchedCount = duplicates.length - touched.size

  function setRowAction(i, action) {
    setResolutions((prev) => ({ ...prev, [i]: action }))
    setTouched((prev) => new Set(prev).add(i))
  }

  function bulkSetAll(action) {
    setResolutions(Object.fromEntries(duplicates.map((_, i) => [i, action])))
    setTouched(new Set(duplicates.map((_, i) => i)))
  }

  const mut = useMutation({
    mutationFn: () => contactsApi.resolveDuplicates({
      resolutions: duplicates.map((d, i) => ({
        existingId: d.existingContact._id,
        action: resolutions[i],
        data: resolutions[i] !== 'skip'
          ? { ...d.newData, source: d.source, uploadBatchId: d.uploadBatchId, importIndex: d.importIndex, area: d.area }
          : undefined,
      })),
    }),
    onSuccess: (res) => {
      const { resolved, created, skipped, errors } = res.data.data
      toast.success(`${resolved} updated, ${created} created, ${skipped} skipped${errors ? `, ${errors} failed` : ''}`)
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['contacts-unassigned'] })
      onDone()
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Failed to resolve duplicates'),
  })

  function requestClose() {
    if (untouchedCount > 0) setConfirmingClose(true)
    else onClose()
  }

  const ACTION_META = {
    skip:   { label: 'Skip',            color: '#6B7280' },
    update: { label: 'Update Existing', color: '#3B82F6' },
    create: { label: 'Create Separate', color: '#8B5CF6' },
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" onClick={requestClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="w-full max-w-2xl max-h-[85vh] bg-white dark:bg-[#181818] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-2xl overflow-hidden flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center">
                <Layers className="w-5 h-5 text-[#8B5CF6]" strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#111111] dark:text-white">Review Duplicates</h2>
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">{duplicates.length} row{duplicates.length !== 1 ? 's' : ''} matched an existing contact's phone number</p>
              </div>
            </div>
            <button onClick={requestClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
              <X className="w-4 h-4" />
            </button>
          </div>

          {confirmingClose ? (
            <div className="p-6">
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30">
                <AlertTriangle className="w-4 h-4 text-[#F59E0B] mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-[#F59E0B] font-semibold">
                    {untouchedCount} of {duplicates.length} duplicates weren't reviewed — they'll be skipped and won't be created or updated.
                  </p>
                  <p className="text-xs text-[#F59E0B]/80 mt-1">Close anyway?</p>
                  <div className="flex gap-2 mt-2.5">
                    <button type="button" onClick={() => setConfirmingClose(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#F59E0B]/30 text-[#F59E0B] hover:bg-[#F59E0B]/10">
                      Go Back
                    </button>
                    <button type="button" onClick={onClose}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#F59E0B] hover:bg-[#D97706]">
                      Close Anyway
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Bulk actions */}
              <div className="flex items-center gap-2 px-6 py-3 border-b border-[#E5E7EB] dark:border-[#2A2A2A] flex-shrink-0">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mr-1">Bulk:</span>
                <button onClick={() => bulkSetAll('skip')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
                  Skip All
                </button>
                <button onClick={() => bulkSetAll('update')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#3B82F6]/30 text-[#3B82F6] hover:bg-[#3B82F6]/10">
                  Update All with New Data
                </button>
              </div>

              {/* Row list */}
              <div className="flex-1 overflow-y-auto divide-y divide-[#E5E7EB] dark:divide-[#2A2A2A]">
                {duplicates.map((d, i) => (
                  <div key={i} className="px-6 py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280] dark:text-[#A1A1AA] mb-1">Existing Contact</p>
                        <p className="font-semibold text-[#111111] dark:text-white truncate">{d.existingContact.name}</p>
                        <p className="text-[#6B7280] dark:text-[#A1A1AA] font-mono">{d.existingContact.phone}</p>
                        {d.existingContact.sectionalScheme && (
                          <p className="text-[#6B7280] dark:text-[#A1A1AA] truncate">{d.existingContact.sectionalScheme}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8B5CF6] mb-1">New Row (Excel)</p>
                        <p className="font-semibold text-[#111111] dark:text-white truncate">{d.newData.name}</p>
                        <p className="text-[#6B7280] dark:text-[#A1A1AA] font-mono">{d.newData.phone}</p>
                        {d.newData.sectionalScheme && (
                          <p className="text-[#6B7280] dark:text-[#A1A1AA] truncate">{d.newData.sectionalScheme}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      {(['skip', 'update', 'create']).map((action) => (
                        <button key={action} onClick={() => setRowAction(i, action)}
                          className={[
                            'px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all whitespace-nowrap',
                            resolutions[i] === action
                              ? 'text-white border-transparent'
                              : 'border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]',
                          ].join(' ')}
                          style={resolutions[i] === action ? { backgroundColor: ACTION_META[action].color } : {}}
                        >
                          {ACTION_META[action].label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[#E5E7EB] dark:border-[#2A2A2A] flex-shrink-0">
                <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA]">
                  {untouchedCount > 0 ? `${untouchedCount} not yet reviewed (default: skip)` : 'All rows reviewed'}
                </p>
                <div className="flex gap-3">
                  <button type="button" onClick={requestClose}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E7EB] dark:border-[#2A2A2A] text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
                    Cancel
                  </button>
                  <button onClick={() => mut.mutate()} disabled={mut.isPending}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-60 flex items-center justify-center gap-2">
                    {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Apply
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
