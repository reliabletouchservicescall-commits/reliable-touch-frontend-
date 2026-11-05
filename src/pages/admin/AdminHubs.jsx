import {
  List, Handshake, KeyRound, RotateCcw, BookUser, PhoneCall, Gauge, Megaphone, MapPin, PhoneOff, Trophy, Users, ShieldCheck,
  Building2, Briefcase, DollarSign, CalendarDays,
} from 'lucide-react'
import HubTabs, { useHubTab } from '../../components/agent/HubTabs'
import DealTrackerPage from '../shared/DealTrackerPage'
import TenantApplicationsPage from '../shared/TenantApplicationsPage'
import LeadsPage from './LeadsPage'
import LeaseRenewalsPage from './LeaseRenewalsPage'
import ContactsPage from './ContactsPage'
import AdminCallLogsPage from './CallLogsPage'
import CallerWorkloadPage from './CallerWorkloadPage'
import CampaignsPage from './CampaignsPage'
import AreasPage from './AreasPage'
import DncPage from './DncPage'
import PerformancePage from './PerformancePage'
import UsersPage from './UsersPage'
import LoginActivityPage from './LoginActivityPage'
import AgenciesPage from './AgenciesPage'
import AgentsPage from './AgentsPage'
import CommissionsPage from './CommissionsPage'
import AppointmentsPage from './AppointmentsPage'
import DiaryPage from '../agency/DiaryPage'

// Admin works from seven places (AdminLayout's NAV). Four of them gather the old pages into
// tabs; the tab lives in ?tab= so old links land on the right one.

// Leads — every lead, how each deal is going, the tenants applying and the leases to renew
export function AdminLeadsHub() {
  const tabs = [
    { key: 'list', label: 'All leads', icon: List },
    { key: 'deals', label: 'Deal Tracker', icon: Handshake },
    { key: 'applications', label: 'Applications', icon: KeyRound },
    { key: 'renewals', label: 'Lease renewals', icon: RotateCcw },
  ]
  const [tab, pick] = useHubTab(tabs)
  return (
    <HubTabs tabs={tabs} tab={tab} onPick={pick}>
      {tab === 'list' && <LeadsPage />}
      {tab === 'deals' && <DealTrackerPage role="admin" />}
      {tab === 'applications' && <TenantApplicationsPage />}
      {tab === 'renewals' && <LeaseRenewalsPage />}
    </HubTabs>
  )
}

// Contacts — the people to call and everything that feeds the calling: files, who calls how
// much, every call made, campaigns, areas and the do-not-call list
export function AdminContactsHub() {
  const tabs = [
    { key: 'contacts', label: 'Contacts', icon: BookUser },
    { key: 'workload', label: 'Who calls what', icon: Gauge },
    { key: 'log', label: 'Call log', icon: PhoneCall },
    { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
    { key: 'areas', label: 'Areas', icon: MapPin },
    { key: 'dnc', label: 'Do not call', icon: PhoneOff },
  ]
  const [tab, pick] = useHubTab(tabs)
  return (
    <HubTabs tabs={tabs} tab={tab} onPick={pick}>
      {tab === 'contacts' && <ContactsPage />}
      {tab === 'workload' && <CallerWorkloadPage />}
      {tab === 'log' && <AdminCallLogsPage />}
      {tab === 'campaigns' && <CampaignsPage />}
      {tab === 'areas' && <AreasPage />}
      {tab === 'dnc' && <DncPage />}
    </HubTabs>
  )
}

// Team — how everyone is doing, the people themselves and when they signed in
export function AdminTeamHub() {
  const tabs = [
    { key: 'performance', label: 'How everyone is doing', icon: Trophy },
    { key: 'users', label: 'People', icon: Users },
    { key: 'logins', label: 'Sign-ins', icon: ShieldCheck },
  ]
  const [tab, pick] = useHubTab(tabs)
  return (
    <HubTabs tabs={tabs} tab={tab} onPick={pick}>
      {tab === 'performance' && <PerformancePage />}
      {tab === 'users' && <UsersPage />}
      {tab === 'logins' && <LoginActivityPage />}
    </HubTabs>
  )
}

// Agencies — the companies, their agents and the commissions they owe or earned
export function AdminAgenciesHub() {
  const tabs = [
    { key: 'agencies', label: 'Agencies', icon: Building2 },
    { key: 'agents', label: 'Agents', icon: Briefcase },
    { key: 'commissions', label: 'Commissions', icon: DollarSign },
  ]
  const [tab, pick] = useHubTab(tabs)
  return (
    <HubTabs tabs={tabs} tab={tab} onPick={pick}>
      {tab === 'agencies' && <AgenciesPage />}
      {tab === 'agents' && <AgentsPage />}
      {tab === 'commissions' && <CommissionsPage />}
    </HubTabs>
  )
}

// Calendar — the whole business on a calendar (viewings, follow-ups, leads changing status,
// your reminders), then the appointments list to schedule and manage viewings
export function AdminCalendarHub() {
  const tabs = [
    { key: 'calendar', label: 'Calendar', icon: CalendarDays },
    { key: 'appointments', label: 'Appointments', icon: List },
  ]
  const [tab, pick] = useHubTab(tabs)
  return (
    <HubTabs tabs={tabs} tab={tab} onPick={pick}>
      {tab === 'calendar' && <DiaryPage scope="admin" />}
      {tab === 'appointments' && <AppointmentsPage />}
    </HubTabs>
  )
}
