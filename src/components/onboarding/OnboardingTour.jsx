import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Sparkles, PhoneOutgoing, AlarmClock, FileText, Handshake, Award, Trophy, MessageSquare, TrendingUp,
  CalendarCheck, LayoutDashboard, Users, Gauge, Building2, Rocket, Flame, Megaphone, HelpCircle, KeyRound,
  Home, Phone, CalendarDays, Target, Search, Plus, Bell,
  ArrowLeft, ArrowRight, X, Check, ChevronRight,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../services/authApi'
import { agenciesApi } from '../../services/agenciesApi'
import { tourFor, TOUR_VERSION } from '../../lib/tourSteps'
import { useAgencyBrand } from '../../lib/useAgencyBrand'

const ICONS = {
  Sparkles, PhoneOutgoing, AlarmClock, FileText, Handshake, Award, Trophy, MessageSquare, TrendingUp,
  CalendarCheck, LayoutDashboard, Users, Gauge, Building2, Rocket, Flame, Megaphone, KeyRound,
  Home, Phone, CalendarDays, Target, Search, Plus, Bell,
}

const OPEN_EVENT = 'rt:open-tour'
export const openTour = () => window.dispatchEvent(new Event(OPEN_EVENT))

// The ? button in each layout's top bar — reopens the tour any time
export function TourButton() {
  return (
    <button
      type="button"
      onClick={openTour}
      title="Take the tour"
      aria-label="Take the tour"
      className="flex items-center justify-center w-8 h-8 rounded-lg text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] hover:text-[#F95C4B] transition-colors"
    >
      <HelpCircle className="w-[18px] h-[18px]" strokeWidth={1.75} />
    </button>
  )
}

// The sidebar link (or top-bar control) a step points at — the one actually on screen (the mobile drawer keeps a
// second copy off-screen, and the desktop sidebar is hidden on phones)
function findTarget(href) {
  if (!href) return null
  // A route ('/agency/leads') is a sidebar or bottom-bar link; anything else is a CSS selector
  const els = [...document.querySelectorAll(href.startsWith('/') ? `aside a[href="${href}"], nav[data-tabbar] a[href="${href}"]` : href)]
  for (const el of els) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= window.innerWidth) return el
  }
  return null
}

const CARD_W = 380
const PAD = 6

// The closing checklist for an Agency Admin ticks itself off from the company's real state
function useSetupProgress(enabled) {
  const user = useAuthStore((s) => s.user)
  const { data } = useQuery({
    queryKey: ['tour-setup', user?.agencyId],
    queryFn: () => Promise.all([
      agenciesApi.myProfile().then((r) => r.data.data.agency),
      agenciesApi.getById(user.agencyId).then((r) => r.data.data.agency),
    ]),
    enabled: enabled && Boolean(user?.agencyId),
    staleTime: 0,
  })
  if (!data) return {}
  const [profile, agency] = data
  return {
    profile: Boolean(profile?.branding?.logoUrl || profile?.branding?.primaryColor),
    team: (agency?.stats?.agents ?? 0) > 1,
    lead: (agency?.stats?.leads ?? 0) > 0,
  }
}

export default function OnboardingTour() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const { agency } = useAgencyBrand()
  const steps = useMemo(() => tourFor(user, { company: agency?.name }), [user, agency?.name])
  const seen = Boolean(user?.onboarding?.completedAt || user?.onboarding?.skippedAt)
  const [open, setOpen] = useState(false)
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  const step = steps[i]
  const last = i === steps.length - 1
  const progress = useSetupProgress(open && Boolean(step?.checklist))

  // First login: open once the layout has painted
  useEffect(() => {
    if (seen || !steps.length) return
    const t = setTimeout(() => { setI(0); setOpen(true) }, 700)
    return () => clearTimeout(t)
  }, [seen, steps.length])

  useEffect(() => {
    const onOpen = () => { setI(0); setOpen(true) }
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])

  const measure = useCallback(() => {
    const el = findTarget(step?.target)
    if (!el) return setRect(null)
    el.scrollIntoView({ block: 'nearest' })
    const r = el.getBoundingClientRect()
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 })
  }, [step?.target])

  useLayoutEffect(() => {
    if (!open) return
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open, measure])

  const finish = useCallback((status) => {
    setOpen(false)
    authApi.setOnboarding(status, TOUR_VERSION)
      .then(({ data }) => useAuthStore.setState({ user: { ...useAuthStore.getState().user, ...data.data.user } }))
      .catch(() => {})
  }, [])

  const go = useCallback((to) => { finish('completed'); navigate(to) }, [finish, navigate])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') finish('skipped')
      else if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, steps.length - 1))
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, finish, steps.length])

  if (!open || !step) return null

  const Icon = ICONS[step.icon] ?? Sparkles
  // Beside the highlighted link when there's room, otherwise centred
  const beside = rect && window.innerWidth - (rect.left + rect.width) > CARD_W + 40
  const cardStyle = beside
    ? { left: rect.left + rect.width + 18, top: Math.max(16, Math.min(rect.top - 24, window.innerHeight - 440)), width: CARD_W }
    : { left: '50%', top: '50%', '--tour-t': 'translate(-50%, -50%)', transform: 'translate(-50%, -50%)', width:`min(${CARD_W + 40}px, calc(100vw - 32px))` }

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Guided tour">
      {/* Dim everything except the highlighted link */}
      {rect ? (
        <>
          {/* Shade everything but the link: four panels around it, gliding between steps */}
          {[
            { left: 0, top: 0, right: 0, height: rect.top },
            { left: 0, top: rect.top + rect.height, right: 0, bottom: 0 },
            { left: 0, top: rect.top, width: rect.left, height: rect.height },
            { left: rect.left + rect.width, top: rect.top, right: 0, height: rect.height },
          ].map((s, n) => (
            <div key={n} className="absolute bg-[#0A0A0A]/55 backdrop-blur-[2px] tour-fade transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)]" style={s} />
          ))}
          <div
            className="absolute rounded-xl pointer-events-none transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
            style={{ ...rect, boxShadow: '0 0 0 2px rgb(var(--brand-rgb)), 0 0 28px 6px rgb(var(--brand-rgb) / 0.45)' }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-[#0A0A0A]/55 backdrop-blur-[3px] tour-fade" />
      )}

      <div
        key={i}
        className="absolute tour-pop rounded-[22px] bg-white/95 dark:bg-[#181818]/95 backdrop-blur-xl border border-white/60 dark:border-[#2A2A2A] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.45)] overflow-hidden"
        style={cardStyle}
      >
        {beside && <span className="absolute -left-1.5 top-9 w-3 h-3 rotate-45 bg-white dark:bg-[#181818] border-l border-b border-white/60 dark:border-[#2A2A2A]" />}
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF7A6B] to-[#E84B3A] text-white flex items-center justify-center shadow-lg shadow-[#F95C4B]/30">
              <Icon className="w-6 h-6" strokeWidth={1.75} />
            </div>
            <button onClick={() => finish('skipped')} aria-label="Close the tour"
              className="w-8 h-8 -mr-2 -mt-2 rounded-full flex items-center justify-center text-[#9CA3AF] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] hover:text-[#111111] dark:hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-[#F95C4B]">Step {i + 1} of {steps.length}</p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-[#111111] dark:text-white">{step.title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[#6B7280] dark:text-[#A1A1AA]">{step.body}</p>

          {step.tips && (
            <ul className="mt-3 space-y-1">
              {step.tips.map((t) => (
                <li key={t} className="flex items-center gap-2 text-xs text-[#6B7280] dark:text-[#A1A1AA]">
                  <Check className="w-3.5 h-3.5 text-[#10B981]" /> {t}
                </li>
              ))}
            </ul>
          )}

          {step.checklist && (
            <div className="mt-4 space-y-2">
              {step.checklist.map((c) => {
                const done = Boolean(progress[c.key])
                return (
                  <button key={c.key} onClick={() => go(c.to)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#E5E7EB] dark:border-[#2A2A2A] hover:border-[#F95C4B]/50 hover:bg-[#F95C4B]/5 text-left transition-colors group">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-[#10B981] text-white' : 'border-2 border-[#D4D4D8] dark:border-[#3F3F46]'}`}>
                      {done && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={`block text-sm font-semibold ${done ? 'text-[#9CA3AF] line-through' : 'text-[#111111] dark:text-white'}`}>{c.label}</span>
                      <span className="block text-[11px] text-[#9CA3AF]">{c.sub}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#F95C4B] group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )
              })}
            </div>
          )}

          {step.to && (
            <button onClick={() => go(step.to)}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#F95C4B] bg-[#F95C4B]/10 hover:bg-[#F95C4B]/15 transition-colors">
              {step.cta ?? 'Open it'} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-[#E5E7EB]/80 dark:border-[#2A2A2A] bg-[#FAFAF9]/80 dark:bg-[#141414]/80">
          <div className="flex items-center gap-1.5 flex-1">
            {steps.map((_, n) => (
              <button key={n} onClick={() => setI(n)} aria-label={`Step ${n + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${n === i ? 'w-5 bg-[#F95C4B]' : n < i ? 'w-1.5 bg-[#F95C4B]/40' : 'w-1.5 bg-[#D4D4D8] dark:bg-[#3F3F46]'}`} />
            ))}
          </div>
          {i === 0 ? (
            <button onClick={() => finish('skipped')} className="px-3 py-2 rounded-xl text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white">
              Skip tour
            </button>
          ) : (
            <button onClick={() => setI(i - 1)} className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020]">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          )}
          <button onClick={() => (last ? finish('completed') : setI(i + 1))}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#F95C4B] hover:bg-[#E84B3A] shadow-btn transition-all active:scale-[0.97]">
            {last ? 'Finish' : i === 0 ? 'Show me around' : 'Next'} {!last && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
