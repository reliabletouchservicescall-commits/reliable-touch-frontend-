import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'

// The lead detail side panel used by every role's Leads list. The open lead lives in
// the URL (?lead=<id>) so refresh, back/forward and shared links all keep it open.
// On wide screens the panel docks to the right and the list makes room for it; on
// smaller screens it slides over the list with a dimmed backdrop.

/**
 * `ids` — the leads currently loaded in the list, in display order (drives prev/next).
 * Returns what the page needs to open the panel and what the panel needs to move around.
 */
export function useLeadPanel(ids = []) {
  const [searchParams, setSearchParams] = useSearchParams()
  const openId = searchParams.get('lead')
  const index = openId ? ids.indexOf(openId) : -1

  const setLead = useCallback((id, { replace } = {}) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      if (id) p.set('lead', id); else p.delete('lead')
      return p
    }, { replace })
  }, [setSearchParams])

  // Opening from a closed panel adds a history entry (so Back closes it); moving between
  // leads while it's open replaces it, so Back doesn't step through every lead viewed.
  const open = useCallback((id) => setLead(id, { replace: Boolean(openId) }), [setLead, openId])
  const close = useCallback(() => setLead(null, { replace: true }), [setLead])
  const go = useCallback((delta) => {
    const next = ids[index + delta]
    if (!next) return
    setLead(next, { replace: true })
    // keep the highlighted row in view as you step through with the keyboard
    requestAnimationFrame(() => document.querySelector(`[data-lead-id="${next}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  }, [ids, index, setLead])

  return useMemo(() => ({
    openId,
    open,
    close,
    prev: () => go(-1),
    next: () => go(1),
    hasPrev: index > 0,
    hasNext: index >= 0 && index < ids.length - 1,
    position: index >= 0 ? { index: index + 1, total: ids.length } : null,
  }), [openId, open, close, go, index, ids.length])
}

// Props a lead row/card spreads to show it's the open one and to be found for scrolling
export function leadRowProps(panel, id) {
  return { 'data-lead-id': id, 'data-lead-selected': panel.openId === id ? '' : undefined }
}

function isTyping(el) {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/**
 * `panel` — from useLeadPanel. `children(id)` renders the role's lead detail for that id.
 */
export default function LeadSidePanel({ panel, children }) {
  const { openId, close, prev, next } = panel
  const [shownId, setShownId] = useState(openId)
  const [leaving, setLeaving] = useState(false)
  const [top, setTop] = useState(64)
  const anchorRef = useRef(null)

  // Keep the last lead on screen while the panel animates out
  useEffect(() => {
    if (openId) { setShownId(openId); setLeaving(false); return undefined }
    if (!shownId) return undefined
    setLeaving(true)
    const t = setTimeout(() => { setShownId(null); setLeaving(false) }, 230)
    return () => clearTimeout(t)
  }, [openId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sit just under the layout's top bar, and make the list (the layout's <main>) leave
  // room for the docked panel on wide screens.
  useLayoutEffect(() => {
    const main = anchorRef.current?.closest('main')
    if (!main) return undefined
    // Re-measure whenever the top bar changes size (it settles after first paint)
    const measure = () => setTop(Math.round(main.getBoundingClientRect().top))
    measure()
    const ro = new ResizeObserver(measure)
    if (main.previousElementSibling) ro.observe(main.previousElementSibling)
    ro.observe(main)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [])
  useEffect(() => {
    const main = anchorRef.current?.closest('main')
    if (!main) return undefined
    main.classList.toggle('lead-panel-open', Boolean(shownId) && !leaving)
    return () => main.classList.remove('lead-panel-open')
  }, [shownId, leaving])

  // Esc closes; ↑/↓ (or K/J) step through the list — never while typing in a field or
  // while one of the panel's own dialogs is open.
  useEffect(() => {
    if (!openId) return undefined
    const onKey = (e) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (document.querySelector('[data-lead-dialog]')) return
      if (e.key === 'Escape') { e.preventDefault(); close() }
      else if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); next() }
      else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); prev() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openId, close, next, prev])

  return (
    <>
      <span ref={anchorRef} className="hidden" aria-hidden />
      {/* Portalled to <body>: page sections animate in with transforms, and a transformed
          ancestor would otherwise become the containing block for this fixed panel. */}
      {shownId && createPortal(
        <>
          <div
            onClick={close}
            style={{ top }}
            className={`fixed inset-x-0 bottom-0 z-40 bg-[#111111]/30 backdrop-blur-[2px] lg:hidden ${leaving ? 'lead-backdrop-out' : 'lead-backdrop-in'}`}
          />
          <aside
            role="dialog"
            aria-label="Lead details"
            style={{ top }}
            className={`fixed right-0 bottom-0 z-40 w-full md:w-[var(--lp-w)] flex flex-col bg-white dark:bg-[#181818] border-l border-[#E5E7EB] dark:border-[#2A2A2A] shadow-[-24px_0_60px_-30px_rgba(17,17,17,0.35)] overflow-hidden ${leaving ? 'lead-panel-out' : 'lead-panel-in'}`}
          >
            <div key={shownId} className="lead-panel-swap flex-1 min-h-0 flex flex-col">
              {children(shownId)}
            </div>
          </aside>
        </>,
        document.body,
      )}
    </>
  )
}

// Shimmer stand-in while a lead loads — same header/tab shape as the real panel, and
// closable straight away.
export function LeadPanelSkeleton({ onClose }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-5 pb-0 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex items-start gap-3">
          <div className="shimmer w-12 h-12 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <div className="shimmer h-5 w-48 rounded-lg" />
            <div className="shimmer h-3.5 w-64 rounded-lg" />
          </div>
          {onClose && (
            <button type="button" onClick={onClose} title="Close (Esc)"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex gap-4 mt-5 pb-3">
          {[64, 120, 90, 60, 70].map((w, i) => <div key={i} className="shimmer h-3.5 rounded" style={{ width: w }} />)}
        </div>
      </div>
      <div className="flex-1 p-5 space-y-4 bg-[#FAFAF9] dark:bg-[#0B0B0B]">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="shimmer h-16 rounded-xl" />)}
        </div>
        <div className="shimmer h-44 rounded-2xl" />
        <div className="shimmer h-64 rounded-2xl" />
      </div>
    </div>
  )
}
