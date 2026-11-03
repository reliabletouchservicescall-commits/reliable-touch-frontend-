import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PhoneOutgoing, AlarmClock, BookUser, PhoneOff, Megaphone, ChevronDown } from 'lucide-react'
import HubTabs, { useHubTab } from '../../components/agent/HubTabs'
import CallModePage from '../shared/CallModePage'
import ContactsPage from './ContactsPage'
import DncPage from './DncPage'
import { campaignsApi } from '../../services/campaignsApi'
import { useAgentHome } from '../../components/agent/useAgentHome'

// Calls — everyone the agent phones, in one place: who to call next, the callbacks owners
// asked for, all their contacts and the do-not-call list. Today's campaign sits on top,
// the one moment it matters (agents only read campaigns; managers run them).

function CampaignBanner() {
  const [open, setOpen] = useState(false)
  const { data } = useQuery({
    queryKey: ['campaigns', 'running'],
    queryFn: () => campaignsApi.list({ isActive: true, limit: 20 }).then((r) => r.data.data.campaigns ?? []),
    staleTime: 5 * 60_000,
  })
  const now = Date.now()
  const running = (data ?? []).filter((c) => (!c.startDate || new Date(c.startDate) <= now) && (!c.endDate || new Date(c.endDate) >= now))
  if (!running.length) return null
  const [first, ...rest] = running
  return (
    <div className="mx-4 mt-4 rounded-2xl border border-[#F95C4B]/25 bg-[#F95C4B]/[0.06] sm:mx-8">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-[#F95C4B]/15 text-[#F95C4B]"><Megaphone className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1 text-sm text-[#111111] dark:text-white">
          Today’s campaign: <b>{first.name}</b>{rest.length ? <span className="text-[#6B7280] dark:text-[#A1A1AA]"> and {rest.length} more</span> : null}
          <span className="block truncate text-xs text-[#6B7280] dark:text-[#A1A1AA]">{first.description || 'Mention it on your calls today.'}</span>
        </span>
        {(rest.length > 0 || first.description) && <ChevronDown className={`h-4 w-4 flex-none text-[#9CA3AF] transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      {open && (
        <ul className="space-y-2 px-4 pb-4 pl-[60px]">
          {running.map((c) => (
            <li key={c._id} className="text-sm">
              <b className="text-[#111111] dark:text-white">{c.name}</b>
              {c.description && <p className="whitespace-pre-wrap text-xs text-[#6B7280] dark:text-[#A1A1AA]">{c.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function CallsHubPage() {
  const { data: home } = useAgentHome()
  const tabs = [
    { key: 'next', label: 'Call next', icon: PhoneOutgoing },
    { key: 'callbacks', label: 'Callbacks', icon: AlarmClock, count: home?.actions?.callbacksDue },
    { key: 'contacts', label: 'All contacts', icon: BookUser },
    { key: 'dnc', label: 'Do not call', icon: PhoneOff },
  ]
  const [tab, pick] = useHubTab(tabs)
  return (
    <HubTabs tabs={tabs} tab={tab} onPick={pick}>
      {/* Each page scrolls itself; the banner stays above it */}
      <div className="flex h-full min-h-0 flex-col">
        {(tab === 'next' || tab === 'callbacks') && <CampaignBanner />}
        <div className="min-h-0 flex-1">
          {tab === 'next' && <CallModePage key="all" />}
          {tab === 'callbacks' && <CallModePage key="callbacks" mode="callbacks" />}
          {tab === 'contacts' && <ContactsPage />}
          {tab === 'dnc' && <DncPage />}
        </div>
      </div>
    </HubTabs>
  )
}
