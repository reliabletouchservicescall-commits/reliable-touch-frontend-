import { Users, Trophy } from 'lucide-react'
import HubTabs, { useHubTab } from '../../components/agent/HubTabs'
import AgencyTeamPage from './TeamPage'
import LeaderboardPage from './LeaderboardPage'

// Team — a company manager's people in one place: who they are (add, reset, message) and
// who is leading this month. How much each one has to call lives under Calls.
export default function TeamHubPage() {
  const tabs = [
    { key: 'people', label: 'People', icon: Users },
    { key: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  ]
  const [tab, pick] = useHubTab(tabs)
  return (
    <HubTabs tabs={tabs} tab={tab} onPick={pick}>
      {tab === 'people' && <AgencyTeamPage />}
      {tab === 'leaderboard' && <LeaderboardPage />}
    </HubTabs>
  )
}
