import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, X, Plus, ChevronDown, TrendingUp, CalendarPlus, KeyRound, BookUser, Loader2, Sun, Moon, LogOut, Compass, Building2 } from 'lucide-react'
import { leadsApi } from '../../services/leadsApi'
import { contactsApi } from '../../services/contactsApi'
import { authApi } from '../../services/authApi'
import { useAuthStore } from '../../store/authStore'
import { useTheme } from '../../context/ThemeContext'
import { openTour } from '../onboarding/OnboardingTour'
import { LeadStatusBadge } from '../leads/leadShared'
import { useAgentActions } from './AgentActions'

// The top bar's tools: search anything (Ctrl K), "+ New" and the avatar menu (profile,
// dark mode, the tour, sign out). The bell sits beside them (NotificationBell).

function useOutside(ref, on, close) {
  useEffect(() => {
    if (!on) return undefined
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) close() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [on]) // eslint-disable-line react-hooks/exhaustive-deps
}

function useDebounced(v, ms = 250) {
  const [d, setD] = useState(v)
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t) }, [v, ms])
  return d
}

/* ─── Search ────────────────────────────────────────────────────────────── */

export function GlobalSearch() {
  const navigate = useNavigate()
  const ref = useRef(null)
  const input = useRef(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [mobile, setMobile] = useState(false)
  const term = useDebounced(q.trim())
  useOutside(ref, open, () => { setOpen(false); setMobile(false) })

  // Ctrl/⌘ K from anywhere
  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setMobile(true); setOpen(true); setTimeout(() => input.current?.focus(), 0) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const enabled = term.length >= 2
  const leads = useQuery({ queryKey: ['search', 'leads', term], queryFn: () => leadsApi.list({ search: term, limit: 5 }).then((r) => r.data.data.leads), enabled, staleTime: 20_000 })
  const contacts = useQuery({ queryKey: ['search', 'contacts', term], queryFn: () => contactsApi.list({ search: term, limit: 5 }).then((r) => r.data.data.contacts), enabled, staleTime: 20_000 })
  const go = (to) => { navigate(to); setOpen(false); setMobile(false); setQ('') }
  const busy = leads.isFetching || contacts.isFetching
  const none = enabled && !busy && !leads.data?.length && !contacts.data?.length

  return (
    <div ref={ref} className={`${mobile ? 'fixed inset-x-0 top-0 z-50 bg-white p-3 shadow-lg dark:bg-[#181818] sm:static sm:z-auto sm:bg-transparent sm:p-0 sm:shadow-none' : 'relative'} sm:relative sm:w-full sm:max-w-md`}>
      <button type="button" onClick={() => { setMobile(true); setOpen(true); setTimeout(() => input.current?.focus(), 0) }} aria-label="Search"
        className={`${mobile ? 'hidden' : 'flex'} h-9 w-9 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F5F5F4] dark:text-[#A1A1AA] dark:hover:bg-[#202020] sm:hidden`}>
        <Search className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </button>
      <div className={`${mobile ? 'flex' : 'hidden'} items-center sm:flex`}>
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); setMobile(false); e.currentTarget.blur() } }}
            placeholder="Search a lead, contact, phone or address"
            className="h-9 w-full rounded-xl border border-transparent bg-[#F5F5F4] pl-9 pr-14 text-sm text-[#111111] outline-none transition-colors placeholder:text-[#9CA3AF] focus:border-[#F95C4B]/50 focus:bg-white dark:bg-[#202020] dark:text-white dark:focus:bg-[#181818]" />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-[#E5E7EB] px-1.5 text-[10px] font-semibold text-[#9CA3AF] dark:border-[#2A2A2A] md:block">Ctrl K</kbd>
        </div>
        {mobile && <button type="button" onClick={() => { setMobile(false); setOpen(false) }} className="ml-2 p-2 text-[#6B7280] sm:hidden" aria-label="Close search"><X className="h-4 w-4" /></button>}
      </div>

      {open && enabled && (
        <div className="absolute left-3 right-3 top-full z-50 mt-2 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-xl dark:border-[#2A2A2A] dark:bg-[#181818] sm:left-0 sm:right-0">
          {busy && !leads.data && !contacts.data ? <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-[#F95C4B]" /></div> : none ? (
            <p className="px-4 py-5 text-center text-xs text-[#6B7280] dark:text-[#A1A1AA]">Nothing matches “{term}”.</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto py-1">
              {leads.data?.length > 0 && <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Leads</p>}
              {leads.data?.map((l) => (
                <button key={l._id} type="button" onClick={() => go(`/agency/leads/${l._id}`)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
                  <TrendingUp className="h-4 w-4 flex-none text-[#F95C4B]" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#111111] dark:text-white">{l.landlordName}</span><span className="block truncate text-xs text-[#6B7280] dark:text-[#A1A1AA]">{l.propertyAddress}</span></span>
                  <LeadStatusBadge status={l.status} />
                </button>
              ))}
              {contacts.data?.length > 0 && <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Contacts</p>}
              {contacts.data?.map((c) => (
                <button key={c._id} type="button" onClick={() => go(`/agency/calls?tab=contacts&q=${encodeURIComponent(c.name)}`)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
                  <BookUser className="h-4 w-4 flex-none text-[#6B7280]" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#111111] dark:text-white">{c.name}</span><span className="block truncate text-xs text-[#6B7280] dark:text-[#A1A1AA]">{[c.phone, c.address].filter(Boolean).join(' · ')}</span></span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── + New ─────────────────────────────────────────────────────────────── */

export function NewMenu() {
  const actions = useAgentActions()
  const ref = useRef(null)
  const [open, setOpen] = useState(false)
  useOutside(ref, open, () => setOpen(false))
  if (!actions) return null
  const items = [
    ['lead', 'Lead', 'From a call or a walk-in', TrendingUp],
    ['viewing', 'Viewing', 'Book a time with a landlord', CalendarPlus],
    ['tenant', 'Tenant link', 'For a listed rental', KeyRound],
  ]
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} data-tour="new"
        className="flex h-9 items-center gap-1.5 rounded-xl bg-[#F95C4B] px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#E84B3A]">
        <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New</span> <ChevronDown className="hidden h-3.5 w-3.5 opacity-80 sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-xl dark:border-[#2A2A2A] dark:bg-[#181818]">
          {items.map(([k, l, sub, Icon]) => (
            <button key={k} type="button" onClick={() => { setOpen(false); actions.open(k) }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#F95C4B]/10 text-[#F95C4B]"><Icon className="h-4 w-4" /></span>
              <span><span className="block text-sm font-semibold text-[#111111] dark:text-white">{l}</span><span className="block text-xs text-[#6B7280] dark:text-[#A1A1AA]">{sub}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Avatar menu ───────────────────────────────────────────────────────── */

export function AvatarMenu() {
  const { user, clearAuth } = useAuthStore()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const ref = useRef(null)
  const [open, setOpen] = useState(false)
  useOutside(ref, open, () => setOpen(false))
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'ME'
  const role = user?.isAgencyAdmin ? 'Agency Admin' : user?.isAgencyManager ? 'Company manager' : 'Agent'
  async function signOut() {
    try { await authApi.logout() } catch { /* ignore */ }
    clearAuth()
    navigate('/select-role', { replace: true })
  }
  const row = 'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[#111111] hover:bg-[#F5F5F4] dark:text-white dark:hover:bg-[#202020]'
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Your account" data-tour="account"
        className="grid h-9 w-9 place-items-center rounded-full bg-[#F95C4B]/15 text-xs font-bold text-[#F95C4B] ring-2 ring-transparent transition-all hover:ring-[#F95C4B]/30">
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-60 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-xl dark:border-[#2A2A2A] dark:bg-[#181818]">
          <div className="border-b border-[#E5E7EB] px-4 py-3 dark:border-[#2A2A2A]">
            <p className="truncate text-sm font-semibold text-[#111111] dark:text-white">{user?.firstName} {user?.lastName}</p>
            <p className="truncate text-xs text-[#6B7280] dark:text-[#A1A1AA]">{role}{user?.email ? ` · ${user.email}` : ''}</p>
          </div>
          <div className="py-1">
            {user?.isAgencyAdmin && <button type="button" onClick={() => { setOpen(false); navigate('/agency/company-profile') }} className={row}><Building2 className="h-4 w-4 text-[#6B7280]" /> Company profile</button>}
            <button type="button" onClick={toggle} className={row}>{theme === 'dark' ? <Sun className="h-4 w-4 text-[#6B7280]" /> : <Moon className="h-4 w-4 text-[#6B7280]" />} {theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
            <button type="button" onClick={() => { setOpen(false); openTour() }} className={row}><Compass className="h-4 w-4 text-[#6B7280]" /> Take the tour</button>
            <button type="button" onClick={signOut} className={`${row} text-[#F95C4B] dark:text-[#F95C4B]`}><LogOut className="h-4 w-4" /> Sign out</button>
          </div>
        </div>
      )}
    </div>
  )
}
