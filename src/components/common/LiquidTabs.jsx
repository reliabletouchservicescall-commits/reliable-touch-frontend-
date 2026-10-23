import { useLayoutEffect, useRef, useState } from 'react'

// Segmented control in frosted "Liquid Glass" — the coral pill slides to the chosen tab
// and stretches like liquid on the way (macOS Tahoe-style). Each tab: { key, label, icon?, count? }
export default function LiquidTabs({ tabs, value, onChange, size = 'sm' }) {
  const refs = useRef({})
  const barRef = useRef(null)
  const [pill, setPill] = useState(null)
  const [moves, setMoves] = useState(0)
  useLayoutEffect(() => {
    const measure = () => {
      const el = refs.current[value]
      if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth })
    }
    measure()
    // fonts, counts and the entrance animation can change widths after first paint
    const ro = new ResizeObserver(measure)
    if (barRef.current) ro.observe(barRef.current)
    document.fonts?.ready?.then(measure)
    return () => ro.disconnect()
  }, [value, tabs])
  const pad = size === 'md' ? 'px-4 py-2.5 text-[13px]' : 'px-3.5 py-2 text-xs'
  return (
    <div className="thin-scroll overflow-x-auto -mx-1 px-1 py-1">
      <div ref={barRef} role="tablist" className="liquid-glass relative inline-flex items-center gap-1 p-1.5 rounded-[18px]">
        {pill && (
          <span key={moves} className="liquid-pill liquid-stretch absolute top-1.5 bottom-1.5 rounded-[13px] transition-[left,width] duration-500"
            style={{ left: pill.left, width: pill.width, transitionTimingFunction: 'var(--ease-mac)' }} />
        )}
        {tabs.map((t) => {
          const active = value === t.key
          return (
            <button key={t.key} ref={(el) => { refs.current[t.key] = el }} type="button" role="tab" aria-selected={active}
              onClick={() => { if (!active) { setMoves((m) => m + 1); onChange(t.key) } }}
              className={`relative z-10 flex items-center gap-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors duration-300 active:scale-[0.96] ${pad} ${
                active ? 'text-white' : 'text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'
              }`}>
              {t.icon && <t.icon className="w-3.5 h-3.5" />} {t.label}
              {t.count != null && (
                <span className={`min-w-[20px] h-[18px] px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors duration-300 ${
                  active ? 'bg-white/25 text-white' : 'bg-[#111111]/[0.06] dark:bg-white/10 text-[#111111] dark:text-white'
                }`}>{Number(t.count).toLocaleString()}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
