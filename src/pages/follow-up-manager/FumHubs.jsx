import { Flame, Handshake, KeyRound, Megaphone, CalendarDays, List } from 'lucide-react'
import HubTabs, { useHubTab } from '../../components/agent/HubTabs'
import DealTrackerPage from '../shared/DealTrackerPage'
import TenantApplicationsPage from '../shared/TenantApplicationsPage'
import DiaryPage from '../agency/DiaryPage'
import ColdCallerCampaignsPage from '../cold-caller/CampaignsPage'
import FollowUpManagerLeadsPage from './LeadsPage'
import FollowUpManagerAppointmentsPage from './AppointmentsPage'

// A follow-up manager works from three places (FollowUpManagerLayout's NAV). Two of them
// gather the old pages into tabs; the tab lives in ?tab= so old links land on the right one.

// Hot leads — the queue they work, how each deal is going, the tenants applying and the
// campaigns the leads came from
export function FumLeadsHub() {
  const tabs = [
    { key: 'list', label: 'Hot leads', icon: Flame },
    { key: 'deals', label: 'Deal Tracker', icon: Handshake },
    { key: 'applications', label: 'Applications', icon: KeyRound },
    { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
  ]
  const [tab, pick] = useHubTab(tabs)
  return (
    <HubTabs tabs={tabs} tab={tab} onPick={pick}>
      {tab === 'list' && <FollowUpManagerLeadsPage />}
      {tab === 'deals' && <DealTrackerPage role="follow_up_manager" />}
      {tab === 'applications' && <TenantApplicationsPage />}
      {tab === 'campaigns' && <ColdCallerCampaignsPage />}
    </HubTabs>
  )
}

// Diary — their days on a calendar (follow-ups, viewings, hot leads moving, reminders), then
// the appointments list
export function FumDiaryHub() {
  const tabs = [
    { key: 'calendar', label: 'Calendar', icon: CalendarDays },
    { key: 'appointments', label: 'Appointments', icon: List },
  ]
  const [tab, pick] = useHubTab(tabs)
  return (
    <HubTabs tabs={tabs} tab={tab} onPick={pick}>
      {tab === 'calendar' && <DiaryPage scope="fum" />}
      {tab === 'appointments' && <FollowUpManagerAppointmentsPage />}
    </HubTabs>
  )
}
