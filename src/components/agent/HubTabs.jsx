import { useSearchParams } from 'react-router-dom'

// The tab strip on top of a combined screen (Calls, Leads). The tab lives in ?tab= so
// links, the back button and refreshes land on the same one. Each tab renders an existing
// page underneath — with its own title — so the strip carries no heading of its own.
export function useHubTab(tabs) {
  const [params, setParams] = useSearchParams()
  const tab = tabs.some((t) => t.key === params.get('tab')) ? params.get('tab') : tabs[0].key
  const pick = (key) => setParams(key === tabs[0].key ? {} : { tab: key }, { replace: true })
  return [tab, pick]
}

export default function HubTabs({ tabs, tab, onPick, children }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-none border-b border-[#E5E7EB] bg-white px-4 dark:border-[#2A2A2A] dark:bg-[#181818] sm:px-8">
        <div role="tablist" className="thin-scroll -mb-px flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const on = t.key === tab
            return (
              <button key={t.key} role="tab" aria-selected={on} type="button" onClick={() => onPick(t.key)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-3.5 text-sm font-semibold transition-colors ${on ? 'border-[#F95C4B] text-[#111111] dark:text-white' : 'border-transparent text-[#6B7280] hover:text-[#111111] dark:text-[#A1A1AA] dark:hover:text-white'}`}>
                {t.icon && <t.icon className={`h-4 w-4 ${on ? 'text-[#F95C4B]' : ''}`} strokeWidth={1.9} />}
                {t.label}
                {t.count > 0 && <span className={`min-w-[20px] rounded-full px-1.5 text-center text-[11px] font-bold leading-5 ${on ? 'bg-[#F95C4B] text-white' : 'bg-[#F95C4B]/10 text-[#F95C4B]'}`}>{t.count}</span>}
              </button>
            )
          })}
        </div>
      </div>
      <div key={tab} className="apply-step min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
