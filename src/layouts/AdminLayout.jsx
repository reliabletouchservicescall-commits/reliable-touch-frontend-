import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import logo from '../assets/logo-reliable-touch.png'
import { Home, TrendingUp, CalendarCheck, BookUser, Users, Building2, BarChart2, Menu, X, ChevronRight } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import NotificationBell from '../components/notifications/NotificationBell'
import OnboardingTour, { TourButton } from '../components/onboarding/OnboardingTour'
import PageErrorBoundary from '../components/common/PageErrorBoundary'
import { GlobalSearch, AvatarMenu, MessagesButton } from '../components/agent/TopBar'
import { initFCM, subscribeForegroundMessages } from '../lib/fcm'
import { AgentActionsProvider } from '../components/agent/AgentActions'
import { useSocket } from '../context/SocketContext'

// Admin's whole portal: seven places. Everything else lives inside them as tabs — Leads has the
// Deal Tracker, applications and lease renewals; Contacts has who calls what, the call log,
// campaigns, areas and do-not-call; Team has performance, people and sign-ins; Agencies has the
// agents and commissions — or on the top bar (search, messages, the bell, the avatar menu with
// the Bin).
const NAV = [
  { label: 'Home', icon: Home, to: '/admin', end: true },
  { label: 'Leads', icon: TrendingUp, to: '/admin/leads' },
  { label: 'Calendar', icon: CalendarCheck, to: '/admin/appointments' },
  { label: 'Contacts', icon: BookUser, to: '/admin/contacts' },
  { label: 'Team', icon: Users, to: '/admin/team' },
  { label: 'Agencies', icon: Building2, to: '/admin/agencies' },
  { label: 'Reports', icon: BarChart2, to: '/admin/reports' },
]

function NavItem({ icon: Icon, label, to, end, collapsed, onClick }) {
  return (
    <NavLink
      to={to}
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
      <Icon className={`flex-shrink-0 w-[18px] h-[18px] ${collapsed ? 'mx-auto' : ''}`} strokeWidth={1.75} />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )
}

function Sidebar({ collapsed, onClose, isMobile }) {
  return (
    <aside
      className={`flex flex-col h-full bg-white dark:bg-[#181818] border-r border-[#E5E7EB] dark:border-[#2A2A2A] transition-all duration-300 ${
        collapsed && !isMobile ? 'w-[68px]' : 'w-[240px]'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <img src={logo} alt="Reliable Touch" className="flex-shrink-0 w-8 h-8 rounded-lg object-contain" />
        {(!collapsed || isMobile) && (
          <div className="min-w-0">
            <p className="font-bold text-[#111111] dark:text-white tracking-tight truncate text-sm">Reliable Touch</p>
            <p className="text-[9px] uppercase tracking-widest font-semibold text-[#F95C4B]">Admin</p>
          </div>
        )}
        {isMobile && (
          <button onClick={onClose} aria-label="Close menu" className="ml-auto text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="thin-scroll flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavItem {...item} collapsed={collapsed && !isMobile} onClick={isMobile ? onClose : undefined} />
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}

export default function AdminLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { onlineUsers } = useSocket()
  const me = useAuthStore((st) => st.user?._id)
  const othersOnline = [...(onlineUsers ?? [])].filter((id) => id !== me).length
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Initialise FCM push + subscribe to foreground messages on mount
  useEffect(() => {
    let unsubscribe = () => {}
    initFCM()
    subscribeForegroundMessages().then((unsub) => {
      if (typeof unsub === 'function') unsubscribe = unsub
    })
    return () => unsubscribe()
  }, [])

  return (
    // The reminder form (Calendar › Add a reminder) opens through the same provider as agents'
    <AgentActionsProvider>
    <div className="flex h-screen bg-[#FAFAF9] dark:bg-[#0B0B0B] overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col flex-shrink-0">
        <div className="h-full">
          <Sidebar collapsed={collapsed} isMobile={false} />
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && <div className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />}
      <div className={`lg:hidden fixed inset-y-0 left-0 z-50 flex flex-col transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar isMobile onClose={() => setMobileOpen(false)} />
      </div>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 flex items-center gap-3 px-4 sm:px-6 py-4 bg-white dark:bg-[#181818] border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] hover:text-[#111111] dark:hover:text-white"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <button onClick={() => setMobileOpen(true)} aria-label="Menu"
            className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0 flex justify-end sm:justify-start"><GlobalSearch /></div>

          {/* Who else is in the system right now — the Home floor has the detail */}
          <button type="button" onClick={() => navigate('/admin')} title="People online now"
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#10B981]/10 text-[#059669] dark:text-[#34D399] border border-[#10B981]/20 hover:bg-[#10B981]/15 transition-colors">
            <span className="relative flex w-2 h-2"><span className="absolute inset-0 rounded-full bg-current animate-ping opacity-50" /><span className="relative w-2 h-2 rounded-full bg-current" /></span>
            {othersOnline} online
          </button>

          <TourButton />
          <MessagesButton to="/admin/chat" />
          <NotificationBell seeAllTo="/admin/notifications" />
          <AvatarMenu />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <PageErrorBoundary key={pathname}>
            <Outlet />
          </PageErrorBoundary>
        </main>
      </div>
      <OnboardingTour />
    </div>
    </AgentActionsProvider>
  )
}
