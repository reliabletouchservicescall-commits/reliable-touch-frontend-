import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  PhoneCall,
  PhoneOff,
  CalendarCheck,
  Megaphone,
  Bell,
  MessageSquare,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  ChevronRight,
  Clock,
  FileText,
  Trophy,
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../services/authApi'
import NotificationBell from '../components/notifications/NotificationBell'
import { initFCM, subscribeForegroundMessages } from '../lib/fcm'
import ChatWidget from '../components/chat/ChatWidget'
import { useSocket } from '../context/SocketContext'

const NAV = [
  {
    group: 'Overview',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, to: '/cold-caller', end: true },
    ],
  },
  {
    group: 'My Work',
    items: [
      { label: 'My Contacts', icon: Users, to: '/cold-caller/contacts' },
      { label: 'My Leads', icon: FileText, to: '/cold-caller/leads' },
      { label: 'Call Logs', icon: PhoneCall, to: '/cold-caller/call-logs' },
      { label: 'Appointments', icon: CalendarCheck, to: '/cold-caller/appointments' },
    ],
  },
  {
    group: 'Performance',
    items: [
      { label: 'Leaderboard', icon: Trophy, to: '/cold-caller/leaderboard' },
    ],
  },
  {
    group: 'Tools',
    items: [
      { label: 'Do Not Call', icon: PhoneOff, to: '/cold-caller/dnc' },
      { label: 'Campaigns', icon: Megaphone, to: '/cold-caller/campaigns' },
      { label: 'Messages', icon: MessageSquare, to: '/cold-caller/chat', hasBadge: true },
      { label: 'Notifications', icon: Bell, to: '/cold-caller/notifications' },
    ],
  },
]

function PendingBadge() {
  return (
    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#F59E0B]/15 text-[#F59E0B] text-[9px] font-bold uppercase tracking-wide leading-none">
      <Clock className="w-2.5 h-2.5" />
      Soon
    </span>
  )
}

function NavItem({ icon: Icon, label, to, end, pending, collapsed, onClick, hasBadge }) {
  const { chatUnread } = useSocket()
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
      <div className="relative flex-shrink-0">
        <Icon className={`w-[18px] h-[18px] ${collapsed ? 'mx-auto' : ''}`} strokeWidth={1.75} />
        {hasBadge && chatUnread > 0 && collapsed && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-[3px] rounded-full bg-[#F95C4B] text-white text-[8px] font-bold flex items-center justify-center">
            {chatUnread > 9 ? '9+' : chatUnread}
          </span>
        )}
      </div>
      {!collapsed && (
        <span className="flex-1 truncate flex items-center gap-2">
          {label}
          {hasBadge && chatUnread > 0 ? (
            <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-[#F95C4B] text-white text-[9px] font-bold flex items-center justify-center">
              {chatUnread > 99 ? '99+' : chatUnread}
            </span>
          ) : pending ? (
            <PendingBadge />
          ) : null}
        </span>
      )}
    </NavLink>
  )
}

function Sidebar({ collapsed, onClose, isMobile }) {
  const { user, clearAuth } = useAuthStore()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()

  async function handleLogout() {
    try { await authApi.logout() } catch { /* ignore */ }
    clearAuth()
    navigate('/select-role', { replace: true })
  }

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : 'C'

  return (
    <aside
      className={`flex flex-col h-full bg-white dark:bg-[#181818] border-r border-[#E5E7EB] dark:border-[#2A2A2A] transition-all duration-300 ${
        collapsed && !isMobile ? 'w-[68px]' : 'w-[240px]'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-[#3B82F6]">
          <PhoneCall className="w-4 h-4 text-white" strokeWidth={2} />
        </div>
        {(!collapsed || isMobile) && (
          <div className="min-w-0">
            <p className="font-bold text-[#111111] dark:text-white tracking-tight truncate text-sm">
              Reliable Touch
            </p>
            <p className="text-[9px] uppercase tracking-widest font-semibold text-[#3B82F6]">
              Cold Caller
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
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV.map(({ group, items }) => (
          <div key={group}>
            {(!collapsed || isMobile) && (
              <p className="text-[9px] font-semibold tracking-widest text-[#6B7280]/60 dark:text-[#A1A1AA]/50 uppercase px-3 mb-1.5">
                {group}
              </p>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => (
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

      {/* Footer */}
      <div className="px-3 pb-4 pt-3 border-t border-[#E5E7EB] dark:border-[#2A2A2A] space-y-1">
        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] hover:text-[#111111] dark:hover:text-white"
        >
          {theme === 'dark'
            ? <Sun className="flex-shrink-0 w-[18px] h-[18px]" strokeWidth={1.75} />
            : <Moon className="flex-shrink-0 w-[18px] h-[18px]" strokeWidth={1.75} />}
          {(!collapsed || isMobile) && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
        </button>

        {(!collapsed || isMobile) && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#F5F5F4] dark:bg-[#202020]">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#3B82F6]/15 flex items-center justify-center">
              <span className="text-[10px] font-bold text-[#3B82F6]">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#111111] dark:text-white truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[10px] text-[#6B7280] dark:text-[#A1A1AA] truncate">Cold Caller</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="flex-shrink-0 text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#F95C4B] dark:hover:text-[#F95C4B]"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

        {collapsed && !isMobile && (
          <button
            onClick={handleLogout}
            title="Sign out"
            className="w-full flex items-center justify-center py-2.5 rounded-xl text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] hover:text-[#F95C4B]"
          >
            <LogOut className="w-[18px] h-[18px]" strokeWidth={1.75} />
          </button>
        )}
      </div>
    </aside>
  )
}

export default function ColdCallerLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    let unsub = () => {}
    initFCM()
    subscribeForegroundMessages().then((fn) => { if (typeof fn === 'function') unsub = fn })
    return () => unsub()
  }, [])

  async function handleLogout() {
    try { await authApi.logout() } catch { /* ignore */ }
    clearAuth()
    navigate('/select-role', { replace: true })
  }

  return (
    <div className="flex h-screen bg-[#FAFAF9] dark:bg-[#0B0B0B] overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col flex-shrink-0">
        <div className="h-full">
          <Sidebar collapsed={collapsed} isMobile={false} />
        </div>
      </div>

      {/* Mobile drawer overlay */}
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
        <Sidebar isMobile onClose={() => setMobileOpen(false)} />
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

          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex-1" />

          <span className="hidden sm:block text-[10px] uppercase tracking-widest font-medium text-[#6B7280] dark:text-[#A1A1AA]">
            Cold Caller Portal
          </span>

          <NotificationBell />

          <button
            onClick={handleLogout}
            title="Sign out"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] hover:text-[#F95C4B] dark:hover:text-[#F95C4B] border border-[#E5E7EB] dark:border-[#2A2A2A] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <ChatWidget />
    </div>
  )
}
