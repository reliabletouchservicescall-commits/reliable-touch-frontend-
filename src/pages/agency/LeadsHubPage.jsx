import { List, Columns3, KeyRound } from 'lucide-react'
import HubTabs, { useHubTab } from '../../components/agent/HubTabs'
import AgencyLeadsPage from './LeadsPage'
import DealTrackerPage from '../shared/DealTrackerPage'
import TenantApplicationsPage from '../shared/TenantApplicationsPage'
import { useAgentHome } from '../../components/agent/useAgentHome'

// Leads — one lead's whole journey in one place: the list, the board (the Deal Tracker,
// stage by stage) and the tenants applying for listed rentals.
export default function LeadsHubPage() {
  const { data: home } = useAgentHome()
  const review = home?.tenants?.counts?.review ?? 0
  const tabs = [
    { key: 'list', label: 'List', icon: List },
    { key: 'board', label: 'Board', icon: Columns3 },
    { key: 'tenants', label: 'Tenants', icon: KeyRound, count: review },
  ]
  const [tab, pick] = useHubTab(tabs)
  return (
    <HubTabs tabs={tabs} tab={tab} onPick={pick}>
      {tab === 'list' && <AgencyLeadsPage />}
      {tab === 'board' && <DealTrackerPage role="agency" />}
      {tab === 'tenants' && <TenantApplicationsPage />}
    </HubTabs>
  )
}
