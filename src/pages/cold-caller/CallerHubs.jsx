import { PhoneOutgoing, AlarmClock, Users, PhoneCall, PhoneOff, List, Handshake, KeyRound, CalendarCheck, Award, Trophy } from 'lucide-react'
import HubTabs, { useHubTab } from '../../components/agent/HubTabs'
import { CampaignBanner } from '../agency/CallsHubPage'
import CallModePage from '../shared/CallModePage'
import DealTrackerPage from '../shared/DealTrackerPage'
import TenantApplicationsPage from '../shared/TenantApplicationsPage'
import { useCallMode } from '../../lib/useCallMode'
import MyContactsPage from './MyContactsPage'
import ColdCallerCallLogsPage from './CallLogsPage'
import ColdCallerDncPage from './DncPage'
import ColdCallerLeadsPage from './LeadsPage'
import ColdCallerAppointmentsPage from './AppointmentsPage'
import MyProgressPage from './MyProgressPage'
import LeaderboardPage from './LeaderboardPage'

// A cold caller works from four places (ColdCallerLayout's NAV). Three of them gather the
// old pages into tabs; the tab lives in ?tab= so old links land on the right one.

// Calls — everyone they phone: who's next, the callbacks owners asked for, their whole
// contact list, every call they made and the do-not-call list. Today's campaign sits on top.
export function CallerCallsHub() {
  const { data } = useCallMode({ mode: 'callbacks' })
  const tabs = [
    { key: 'next', label: 'Call next', icon: PhoneOutgoing },
    { key: 'callbacks', label: 'Callbacks', icon: AlarmClock, count: data?.counts?.dueSoon },
    { key: 'contacts', label: 'My contacts', icon: Users },
    { key: 'log', label: 'Calls I made', icon: PhoneCall },
    { key: 'dnc', label: 'Do not call', icon: PhoneOff },
  ]
  const [tab, pick] = useHubTab(tabs)
  return (
    <HubTabs tabs={tabs} tab={tab} onPick={pick}>
      <div className="flex h-full min-h-0 flex-col">
        {(tab === 'next' || tab === 'callbacks') && <CampaignBanner />}
        <div className="min-h-0 flex-1">
          {tab === 'next' && <CallModePage key="all" />}
          {tab === 'callbacks' && <CallModePage key="callbacks" mode="callbacks" />}
          {tab === 'contacts' && <MyContactsPage />}
          {tab === 'log' && <ColdCallerCallLogsPage />}
          {tab === 'dnc' && <ColdCallerDncPage />}
        </div>
      </div>
    </HubTabs>
  )
}

// My leads — the leads they found, how each deal is going, the tenants applying and the
// viewings booked
export function CallerLeadsHub() {
  const tabs = [
    { key: 'list', label: 'My leads', icon: List },
    { key: 'deals', label: 'Deal Tracker', icon: Handshake },
    { key: 'applications', label: 'Applications', icon: KeyRound },
    { key: 'viewings', label: 'Viewings', icon: CalendarCheck },
  ]
  const [tab, pick] = useHubTab(tabs)
  return (
    <HubTabs tabs={tabs} tab={tab} onPick={pick}>
      {tab === 'list' && <ColdCallerLeadsPage />}
      {tab === 'deals' && <DealTrackerPage role="cold_caller" />}
      {tab === 'applications' && <TenantApplicationsPage />}
      {tab === 'viewings' && <ColdCallerAppointmentsPage />}
    </HubTabs>
  )
}

// My progress — their own scorecard, then where they rank
export function CallerProgressHub() {
  const tabs = [
    { key: 'me', label: 'My progress', icon: Award },
    { key: 'board', label: 'Leaderboard', icon: Trophy },
  ]
  const [tab, pick] = useHubTab(tabs)
  return (
    <HubTabs tabs={tabs} tab={tab} onPick={pick}>
      {tab === 'me' && <MyProgressPage />}
      {tab === 'board' && <LeaderboardPage />}
    </HubTabs>
  )
}
