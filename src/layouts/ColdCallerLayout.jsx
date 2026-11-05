import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Home, Phone, TrendingUp, Award, CalendarDays, Menu, ChevronRight } from 'lucide-react'
import logo from '../assets/logo-reliable-touch.png'
import NotificationBell from '../components/notifications/NotificationBell'
import OnboardingTour, { TourButton } from '../components/onboarding/OnboardingTour'
import PageErrorBoundary from '../components/common/PageErrorBoundary'
import { GlobalSearch, AvatarMenu, MessagesButton } from '../components/agent/TopBar'
import { initFCM, subscribeForegroundMessages } from '../lib/fcm'
import { useCallMode } from '../lib/useCallMode'
import { AgentActionsProvider } from '../components/agent/AgentActions'

// A cold caller's whole portal: five places. Everything else lives inside them — Calls has
// Call next, Callbacks, My contacts, Calls I made and Do not call (today's campaign on top);
// My leads has the list, the Deal Tracker, tenant applications and viewings; Diary has their
// days (callbacks, follow-ups, viewings, leads moving, reminders); My progress has the
// leaderboard — or on the top bar (search, messages, the bell, the avatar menu).
const NAV = [
  { label: 'Home', icon: Home, to: '/cold-caller', end: true },
  { label: 'Calls', icon: Phone, to: '/cold-caller/calls', badge: true },
  { label: 'My leads', icon: TrendingUp, to: '/cold-caller/leads' },
  { label: 'Diary', icon: CalendarDays, to: '/cold-caller/diary' },
  { label: 'My progress', icon: Award, to: '/cold-caller/progress' },
]

// Callbacks due now or late — the one number worth a badge
function useDue() {
  const { data } = useCallMode({ mode: 'callbacks' })
  return data?.counts?.dueSoon ?? 0
}

function NavItem({ icon: Icon, label, to, end, collapsed, count = 0 }) {
  return (
    <NavLink
      to={to}
      end={end}
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
        {count > 0 && collapsed && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-[3px] rounded-full bg-[#F59E0B] text-white text-[8px] font-bold flex items-center justify-center">{count > 9 ? '9+' : count}</span>
        )}
      </div>
      {!collapsed && (
        <span className="flex-1 truncate flex items-center gap-2">
          {label}
          {count > 0 && (
            <span className="ml-auto min-w-[18px] h-[18px] px-1.5 rounded-full bg-[#F59E0B]/15 text-[#D97706] text-[10px] font-bold flex items-center justify-center" title="Callbacks due">{count > 99 ? '99+' : count}</span>
          )}
        </span>
      )}
    </NavLink>
  )
}

function Sidebar({ collapsed }) {
  const due = useDue()
  return (
    <aside
      className={`flex flex-col h-full bg-white dark:bg-[#181818] border-r border-[#E5E7EB] dark:border-[#2A2A2A] transition-all duration-300 ${
        collapsed ? 'w-[68px]' : 'w-[240px]'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <img src={logo} alt="Reliable Touch" className="flex-shrink-0 w-8 h-8 rounded-lg object-contain" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-bold text-[#111111] dark:text-white tracking-tight truncate text-sm">Reliable Touch</p>
            <p className="text-[9px] uppercase tracking-widest font-semibold text-[#F95C4B]">Cold Caller</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="thin-scroll flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavItem {...item} count={item.badge ? due : 0} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}

// Phones: the five places along the bottom
function TabBar() {
  const due = useDue()
  return (
    <nav data-tabbar className="lg:hidden flex-shrink-0 grid grid-cols-5 border-t border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] pb-[env(safe-area-inset-bottom)]">
      {NAV.map((item) => {
        const n = item.badge ? due : 0
        return (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => `relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${isActive ? 'text-[#F95C4B]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}>
            <span className="relative">
              <item.icon className="w-5 h-5" strokeWidth={1.75} />
              {n > 0 && <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-[3px] rounded-full bg-[#F59E0B] text-white text-[8px] font-bold flex items-center justify-center">{n > 9 ? '9+' : n}</span>}
            </span>
            <span className="truncate max-w-full px-0.5">{item.label === 'My progress' ? 'Progress' : item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}

export default function ColdCallerLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    let unsub = () => {}
    initFCM()
    subscribeForegroundMessages().then((fn) => { if (typeof fn === 'function') unsub = fn })
    return () => unsub()
  }, [])

  return (
    // The reminder form (Diary › Add a reminder) opens through the same provider as agents'
    <AgentActionsProvider>
    <div className="flex h-screen bg-[#FAFAF9] dark:bg-[#0B0B0B] overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col flex-shrink-0">
        <div className="h-full">
          <Sidebar collapsed={collapsed} />
        </div>
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
          {/* Phones: the bottom bar is the menu */}
          <img src={logo} alt="Reliable Touch" className="lg:hidden w-8 h-8 rounded-lg object-contain" />

          <div className="flex-1 min-w-0 flex justify-end sm:justify-start"><GlobalSearch /></div>

          <TourButton />
          <MessagesButton to="/cold-caller/chat" />
          <NotificationBell seeAllTo="/cold-caller/notifications" />
          <AvatarMenu />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <PageErrorBoundary key={pathname}>
            <Outlet />
          </PageErrorBoundary>
        </main>
        <TabBar />
      </div>

      <OnboardingTour />
    </div>
    </AgentActionsProvider>
  )
}
