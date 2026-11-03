import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarCheck,
  CalendarDays,
  Home,
  Phone,
  MessageSquare,
  Menu,
  X,
  ChevronRight,
  Trophy,
  Target,
  TrendingUp,
  Handshake,
  Users,
  BookUser,
  FileSpreadsheet,
  MapPin,
  Megaphone,
  Gauge,
  PhoneOff,
  ShieldCheck,
  UserCircle,
  PhoneOutgoing,
  AlarmClock,
  Building2,
  KeyRound,
} from 'lucide-react'
import logo from '../assets/logo-reliable-touch.png'
import { useAuthStore } from '../store/authStore'
import NotificationBell from '../components/notifications/NotificationBell'
import { initFCM, subscribeForegroundMessages } from '../lib/fcm'
import ChatWidget from '../components/chat/ChatWidget'
import { useSocket } from '../context/SocketContext'
import { CallModeBadge } from '../lib/useCallMode'
import { useAgencyBrand } from '../lib/useAgencyBrand'
import OnboardingTour, { TourButton } from '../components/onboarding/OnboardingTour'
import { AgentActionsProvider } from '../components/agent/AgentActions'
import { GlobalSearch, NewMenu, AvatarMenu } from '../components/agent/TopBar'
import { useAgentHome } from '../components/agent/useAgentHome'

const NAV = [
  {
    group: 'Overview',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, to: '/agency', end: true },
      { label: 'My Leads',  icon: TrendingUp,      to: '/agency/leads' },
      { label: 'Deal Tracker', icon: Handshake,    to: '/agency/deal-tracker' },
      { label: 'Tenants', icon: KeyRound, to: '/agency/tenants' },
    ],
  },
  {
    group: 'My Work',
    items: [
      { label: 'Call mode',    icon: PhoneOutgoing, to: '/agency/call-mode', callMode: true },
      { label: 'Callbacks',    icon: AlarmClock,    to: '/agency/callbacks', callMode: 'callbacks' },
      { label: 'Contacts',     icon: BookUser,      to: '/agency/contacts' },
      { label: 'Calling Workload', icon: Gauge,     to: '/agency/caller-workload', managerOnly: true },
      { label: 'Do Not Call',  icon: PhoneOff,      to: '/agency/dnc' },
      { label: 'Excel Files',  icon: FileSpreadsheet, to: '/agency/excel-files', managerOnly: true },
      { label: 'Areas',        icon: MapPin,        to: '/agency/areas', managerOnly: true },
      { label: 'Campaigns',    icon: Megaphone,     to: '/agency/campaigns' },
      { label: 'Appointments', icon: CalendarCheck, to: '/agency/appointments' },
      { label: 'Team',         icon: Users,         to: '/agency/team', managerOnly: true },
    ],
  },
  {
    group: 'Performance',
    items: [
      { label: 'My progress', icon: Target, to: '/agency/progress', agentOnly: true },
      { label: 'Leaderboard', icon: Trophy, to: '/agency/leaderboard', managerOnly: true },
      // Hidden from the sidebar for now — routes still work; drop `hidden` to bring them back.
      { label: 'My Activity', icon: UserCircle, to: '/agency/agents', selfLink: true, hidden: true },
      { label: 'Login Activity', icon: ShieldCheck, to: '/agency/login-activity', managerOnly: true, hidden: true },
    ],
  },
  {
    group: 'Account',
    items: [
      { label: 'Company profile', icon: Building2, to: '/agency/company-profile', adminOnly: true },
      { label: 'Messages', icon: MessageSquare, to: '/agency/chat', hasBadge: true },
    ],
  },
]

// An agent's whole portal: six places. Everything else lives inside them (Calls has Call
// mode, Callbacks, Contacts and Do not call; Leads has the board and tenants; Diary has the
// appointments) or on the top bar (search, + New, the bell, the avatar menu).
const AGENT_NAV = [
  { label: 'Home', icon: Home, to: '/agency', end: true },
  { label: 'Calls', icon: Phone, to: '/agency/calls', badge: 'calls' },
  { label: 'Leads', icon: TrendingUp, to: '/agency/leads' },
  { label: 'Diary', icon: CalendarDays, to: '/agency/diary', badge: 'diary' },
  { label: 'My progress', icon: Target, to: '/agency/progress' },
  { label: 'Messages', icon: MessageSquare, to: '/agency/chat', hasBadge: true },
]

// Counts on the agent's links — shown only when something is waiting on them
function useAgentBadges() {
  const { data } = useAgentHome()
  const overdue = (data?.today ?? []).filter((i) => i.overdue).length
  return { calls: data?.actions?.callbacksDue ?? 0, diary: overdue + (data?.actions?.viewingsToday ?? 0) }
}

function NavItem({ icon: Icon, label, to, end, collapsed, onClick, hasBadge, callMode, selfLink, count = 0 }) {
  const { chatUnread } = useSocket()
  const { user } = useAuthStore()
  const resolvedTo = selfLink ? `${to}/${user?._id}` : to
  return (
    <NavLink
      to={resolvedTo}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
          isActive
            ? 'bg-[#F95C4B]/10 text-[#F95C4B]'
            : 'text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] hover:text-[#111111] dark:hover:text-white'
        }`
      }
    >
      <div className="relative flex-shrink-0">
        <Icon className={`w-[18px] h-[18px] ${collapsed ? 'mx-auto' : ''}`} strokeWidth={1.75} />
        {callMode && collapsed && <CallModeBadge collapsed mode={callMode === 'callbacks' ? 'callbacks' : 'all'} />}
        {count > 0 && collapsed && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-[3px] rounded-full bg-[#F95C4B] text-white text-[8px] font-bold flex items-center justify-center">{count > 9 ? '9+' : count}</span>
        )}
        {hasBadge && chatUnread > 0 && collapsed && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-[3px] rounded-full bg-[#F95C4B] text-white text-[8px] font-bold flex items-center justify-center">
            {chatUnread > 9 ? '9+' : chatUnread}
          </span>
        )}
      </div>
      {!collapsed && (
        <span className="flex-1 truncate flex items-center gap-2">
          {label}
          {callMode && <CallModeBadge mode={callMode === 'callbacks' ? 'callbacks' : 'all'} />}
          {count > 0 && (
            <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-[#F95C4B] text-white text-[9px] font-bold flex items-center justify-center">{count > 99 ? '99+' : count}</span>
          )}
          {hasBadge && chatUnread > 0 && (
            <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-[#F95C4B] text-white text-[9px] font-bold flex items-center justify-center">
              {chatUnread > 99 ? '99+' : chatUnread}
            </span>
          )}
        </span>
      )}
    </NavLink>
  )
}

// The company's own logo, or its initials on its brand colour
function CompanyMark({ agency, size = 'w-8 h-8' }) {
  const name = agency?.name ?? 'Reliable Touch'
  if (agency?.branding?.logoUrl) {
    return <img src={agency.branding.logoUrl} alt={name} className={`flex-shrink-0 ${size} rounded-lg object-contain bg-white`} />
  }
  if (!agency) return <img src={logo} alt="Reliable Touch" className={`flex-shrink-0 ${size} rounded-lg object-contain`} />
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return <span className={`flex-shrink-0 ${size} rounded-lg bg-[#F95C4B] text-white text-[11px] font-bold flex items-center justify-center`}>{initials}</span>
}

function Sidebar({ collapsed, onClose, isMobile, agency }) {
  const { user } = useAuthStore()
  const isAgent = !user?.isAgencyManager
  const badges = useAgentBadges()

  return (
    <aside
      className={`flex flex-col h-full bg-white dark:bg-[#181818] border-r border-[#E5E7EB] dark:border-[#2A2A2A] transition-all duration-300 ${
        collapsed && !isMobile ? 'w-[68px]' : 'w-[240px]'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <CompanyMark agency={agency} />
        {(!collapsed || isMobile) && (
          <div className="min-w-0">
            <p className="font-bold text-[#111111] dark:text-white tracking-tight truncate text-sm" title={agency?.name}>
              {agency?.name ?? 'Reliable Touch'}
            </p>
            <p className="text-[9px] uppercase tracking-widest font-semibold text-[#F95C4B]">
              Agency Portal
            </p>
          </div>
        )}
        {isMobile && (
          <button
            onClick={onClose}
            className="ml-auto text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="thin-scroll flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {isAgent ? (
          <ul className="space-y-1">
            {AGENT_NAV.map((item) => (
              <li key={item.to}>
                <NavItem {...item} count={item.badge ? badges[item.badge] : 0} collapsed={collapsed && !isMobile} onClick={isMobile ? onClose : undefined} />
              </li>
            ))}
          </ul>
        ) : NAV.map(({ group, items }) => (
          <div key={group}>
            {(!collapsed || isMobile) && (
              <p className="text-[9px] font-semibold tracking-widest text-[#6B7280]/60 dark:text-[#A1A1AA]/50 uppercase px-3 mb-1.5">
                {group}
              </p>
            )}
            <ul className="space-y-0.5">
              {items.filter((item) => !item.hidden && (!item.managerOnly || user?.isAgencyManager) && (!item.agentOnly || !user?.isAgencyManager) && (!item.adminOnly || user?.isAgencyAdmin)).map((item) => (
                <li key={item.to}>
                  <NavItem
                    {...item}
                    collapsed={collapsed && !isMobile}
                    onClick={isMobile ? onClose : undefined}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer — the profile, dark mode and sign out live in the avatar menu (top bar) */}
      <div className="px-3 pb-4 pt-3 border-t border-[#E5E7EB] dark:border-[#2A2A2A]">
        {/* The company's brand on top, ours underneath */}
        <a href="https://reliabletouchservices.co.za" target="_blank" rel="noreferrer"
          title="Powered by Reliable Touch Service"
          className={`flex items-center justify-center gap-1.5 text-[10px] text-[#9CA3AF] hover:text-[#6B7280] dark:hover:text-[#A1A1AA] transition-colors ${collapsed && !isMobile ? '' : 'px-3'}`}>
          <img src={logo} alt="" className="w-3.5 h-3.5 object-contain opacity-80" />
          {(!collapsed || isMobile) && <span>Powered by <span className="font-semibold">Reliable Touch Service</span></span>}
        </a>
      </div>
    </aside>
  )
}

// Phones: the agent's six places along the bottom
function AgentTabBar() {
  const badges = useAgentBadges()
  const { chatUnread } = useSocket()
  return (
    <nav data-tabbar className="lg:hidden flex-shrink-0 grid grid-cols-6 border-t border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] pb-[env(safe-area-inset-bottom)]">
      {AGENT_NAV.map((item) => {
        const n = item.hasBadge ? chatUnread : item.badge ? badges[item.badge] : 0
        return (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => `relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${isActive ? 'text-[#F95C4B]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>
            <span className="relative">
              <item.icon className="w-5 h-5" strokeWidth={1.75} />
              {n > 0 && <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-[3px] rounded-full bg-[#F95C4B] text-white text-[8px] font-bold flex items-center justify-center">{n > 9 ? '9+' : n}</span>}
            </span>
            <span className="truncate max-w-full px-0.5">{item.label === 'My progress' ? 'Progress' : item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}

export default function AgencyLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const user = useAuthStore((s) => s.user)
  const isAgent = !user?.isAgencyManager
  const location = useLocation()
  // The full "Messages" inbox page already covers everything this floating quick-chat
  // widget does (and more) — showing both stacks the widget's FAB on top of the inbox's
  // own send button.
  const onMessagesPage = location.pathname.startsWith('/agency/chat')
  // The company's logo, name and colour (set by its Agency Admin) — painted across the app
  const { agency } = useAgencyBrand({ apply: true })

  useEffect(() => {
    let unsub = () => {}
    initFCM()
    subscribeForegroundMessages().then((fn) => { if (typeof fn === 'function') unsub = fn })
    return () => unsub()
  }, [])

  return (
    <AgentActionsProvider>
    {/* --cm: the accent shared screens (Call mode, Deal Tracker, lead chat) use — rose for
        cold callers, the company's own colour here */}
    <div className="flex h-screen bg-[#FAFAF9] dark:bg-[#0B0B0B] overflow-hidden" style={{ '--cm': 'var(--brand-rgb)', '--cm-deep': 'var(--brand-hover-rgb)' }}>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col flex-shrink-0">
        <div className="h-full">
          <Sidebar collapsed={collapsed} isMobile={false} agency={agency} />
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`lg:hidden fixed inset-y-0 left-0 z-50 flex flex-col transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar isMobile onClose={() => setMobileOpen(false)} agency={agency} />
      </div>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 flex items-center gap-3 px-4 sm:px-6 py-4 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          {/* Agents use the bottom bar on phones; managers keep the drawer */}
          <button
            onClick={() => setMobileOpen(true)}
            className={`${isAgent ? 'hidden' : 'lg:hidden flex'} items-center justify-center w-8 h-8 rounded-lg text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]`}
          >
            <Menu className="w-4 h-4" />
          </button>
          {isAgent && <span className="lg:hidden"><CompanyMark agency={agency} /></span>}

          <div className="flex-1 min-w-0 flex justify-end sm:justify-start"><GlobalSearch /></div>

          {isAgent && <NewMenu />}
          <TourButton />
          <NotificationBell seeAllTo="/agency/notifications" />
          <AvatarMenu />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {/* Re-mounted when the company colour changes, so charts and inline colours repaint */}
          <Outlet key={agency?.branding?.primaryColor ?? 'rt'} />
        </main>
        {isAgent && <AgentTabBar />}
      </div>

      {/* Agents reach Messages from the sidebar — no second way in */}
      {!onMessagesPage && !isAgent && <ChatWidget />}
      <OnboardingTour />
    </div>
    </AgentActionsProvider>
  )
}
