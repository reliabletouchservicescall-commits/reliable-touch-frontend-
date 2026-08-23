import { useNavigate } from 'react-router-dom'
import { ShieldCheck, PhoneCall, Briefcase, ArrowRight, Check } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import AppHeader from '../../components/layout/AppHeader'

const roles = [
  {
    key: 'admin',
    label: 'Administrator',
    icon: ShieldCheck,
    description:
      'Full platform access — manage contacts, assignments, leads, agents, commissions, and reports.',
    highlights: [
      'Assign contacts & agents',
      'Review all leads',
      'Commission & lease tracking',
      'Performance reports',
    ],
  },
  {
    key: 'cold_caller',
    label: 'Cold Caller',
    icon: PhoneCall,
    description:
      'Work through your assigned contacts, log call outcomes, capture leads, and hit your daily targets.',
    highlights: [
      'Assigned contact queue',
      'Call outcome logging',
      'Lead creation',
      'Follow-up reminders',
    ],
  },
  {
    key: 'agency',
    label: 'Agency',
    icon: Briefcase,
    description:
      'Real estate agency portal — view appointments assigned to your company and manage property visit outcomes.',
    highlights: [
      'Assigned appointments',
      'Property visit schedule',
      'Deal outcome recording',
      'Commission visibility',
    ],
  },
]

export default function RoleSelectPage() {
  const navigate = useNavigate()
  const setSelectedRole = useAuthStore((s) => s.setSelectedRole)

  function handleSelect(roleKey) {
    setSelectedRole(roleKey)
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[#FAFAF9] dark:bg-[#0B0B0B] flex flex-col">
      {/* Subtle brand wash behind header */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-gradient-to-b from-[#F95C4B]/[0.045] dark:from-[#F95C4B]/[0.07] to-transparent" />

      <AppHeader />

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-20">
        {/* Hero */}
        <div className="text-center mb-14 max-w-lg animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F95C4B]/10 dark:bg-[#F95C4B]/15 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F95C4B] animate-pulse-slow" />
            <span className="text-xs font-medium text-[#F95C4B] tracking-wide">
              Select your role to continue
            </span>
          </div>

          <h1 className="text-4xl sm:text-[2.75rem] font-bold text-[#111111] dark:text-white mb-4 tracking-tight leading-tight text-balance">
            Welcome to{' '}
            <span className="text-[#F95C4B]">Reliable Touch</span>
          </h1>

          <p className="text-base sm:text-lg text-[#6B7280] dark:text-[#A1A1AA] leading-relaxed">
            Real estate lead management — choose your role to access your workspace.
          </p>
        </div>

        {/* Role cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-4xl animate-slide-up">
          {roles.map((role) => {
            const Icon = role.icon
            return (
              <button
                key={role.key}
                onClick={() => handleSelect(role.key)}
                className="
                  group relative text-left rounded-2xl p-7 cursor-pointer
                  bg-white dark:bg-[#181818]
                  border border-[#E5E7EB] dark:border-[#2A2A2A]
                  hover:border-[#F95C4B] dark:hover:border-[#F95C4B]
                  shadow-card hover:shadow-card-hover dark:hover:shadow-card-hover-dark
                  hover:-translate-y-1
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F95C4B] focus-visible:ring-offset-2
                  dark:focus-visible:ring-offset-[#0B0B0B]
                "
              >
                {/* Top accent line — appears on hover */}
                <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl bg-[#F95C4B] scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300 ease-out" />

                {/* Icon area */}
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#F5F5F4] dark:bg-[#202020] group-hover:bg-[#F95C4B]/10 dark:group-hover:bg-[#F95C4B]/15 mb-5">
                  <Icon
                    className="w-6 h-6 text-[#6B7280] dark:text-[#A1A1AA] group-hover:text-[#F95C4B]"
                    strokeWidth={1.75}
                  />
                </div>

                {/* Title */}
                <h2 className="text-base font-semibold text-[#111111] dark:text-white mb-2">
                  {role.label}
                </h2>

                {/* Description */}
                <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] leading-relaxed mb-6">
                  {role.description}
                </p>

                {/* Feature list */}
                <ul className="space-y-2.5 mb-7">
                  {role.highlights.map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-xs text-[#6B7280] dark:text-[#A1A1AA]">
                      <Check
                        className="w-3.5 h-3.5 text-[#F95C4B] flex-shrink-0"
                        strokeWidth={2.5}
                      />
                      {item}
                    </li>
                  ))}
                </ul>

                {/* CTA row */}
                <div className="flex items-center gap-1.5 text-sm font-semibold text-[#F95C4B] group-hover:gap-3">
                  Continue as {role.label}
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            )
          })}
        </div>

        <p className="mt-12 text-xs text-[#6B7280]/60 dark:text-[#A1A1AA]/50 text-center max-w-sm">
          Your access level is determined by your account role. Contact your administrator if you need access.
        </p>
      </main>
    </div>
  )
}
