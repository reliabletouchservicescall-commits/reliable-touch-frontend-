// The first-login guided tour, one walkthrough per kind of user. KEEP THIS IN STEP WITH THE
// APP: when a page is added, renamed, moved in a sidebar or removed, update the steps here
// (see .claude/skills/onboarding-tour/SKILL.md). Bump TOUR_VERSION when the tour changes.
//
// A step: { title, body, icon, target?, to?, cta?, tips?, checklist? }
//   target — the sidebar link it points at (its href), or a CSS selector for a top-bar
//            control; spotlighted when it's on screen
//   to/cta  — a button that opens that page (closes the tour first)
//   checklist — the closing "get set up" list: [{ label, sub, to, done? }]
export const TOUR_VERSION = 4

const welcome = (who, what) => ({
  icon: 'Sparkles',
  title: `Welcome to ${who}`,
  body: what,
  tips: ['Takes about a minute', 'Skip any time — reopen it from the ? button at the top'],
})

const COLD_CALLER = [
  welcome('Reliable Touch', 'You find landlords and sellers, turn them into leads and earn points when they sign. Here is where everything lives.'),
  { icon: 'PhoneOutgoing', target: '/cold-caller/call-mode', title: 'Call mode', body: 'Your calling session: the next contact, one tap to call, and how many calls you still need today to reach #1.' },
  { icon: 'AlarmClock', target: '/cold-caller/callbacks', title: 'Callbacks', body: 'Everyone who said "call me back", sorted by the time they asked for. Overdue ones float to the top.' },
  { icon: 'FileText', target: '/cold-caller/leads', title: 'My leads', body: 'Every lead you created. Open one to see the full story, chat to the team in Follow-up chat and add appointments.', to: '/cold-caller/leads?new=1', cta: 'Create a lead' },
  { icon: 'Handshake', target: '/cold-caller/deal-tracker', title: 'Deal Tracker', body: 'Follow your leads from viewing to signed lease or sale. A deal that closes earns you points.' },
  { icon: 'KeyRound', target: '/cold-caller/tenants', title: 'Tenants', body: 'Someone wants to rent a listed property? Add them by name and send their private link — they apply, upload documents and sign on their phone, and you see every step.' },
  { icon: 'Award', target: '/cold-caller/progress', title: 'My progress', body: 'Your points, what each listed lead can still earn you, and who is working it right now.' },
  { icon: 'Trophy', target: '/cold-caller/leaderboard', title: 'Leaderboard', body: 'See where you rank today, this week and this month.' },
  { icon: 'MessageSquare', target: '/cold-caller/chat', title: 'Messages & notifications', body: 'Chat with the team, and the bell tells you the moment something happens on your leads.' },
]

const AGENT = (company) => [
  welcome(company, 'You work the leads your company gets — call, book viewings and close deals. Everything lives in six places. Here is the quick tour.'),
  { icon: 'Home', target: '/agency', title: 'Home', body: 'Your day: a button for each everyday job — update landlords, start calling, callbacks, add a lead, book a viewing, send a tenant link — and what is due today.' },
  { icon: 'Phone', target: '/agency/calls', title: 'Calls', body: 'Who to call next, the callbacks owners asked for, all your contacts and the do-not-call list — in tabs. Today’s campaign shows on top.' },
  { icon: 'TrendingUp', target: '/agency/leads', title: 'Leads', body: 'Your leads as a list, as a board stage by stage (the Deal Tracker), and the tenants applying for your listed rentals.' },
  { icon: 'CalendarDays', target: '/agency/diary', title: 'Diary', body: 'Viewings, callbacks, follow-ups and landlord updates due — by day, week or month. Overdue things sit on today.' },
  { icon: 'Target', target: '/agency/progress', title: 'My progress', body: 'Your points, your rank, your calls against your own daily goal and the milestones you are close to. Reach #1 for the day and you get fireworks.' },
  { icon: 'MessageSquare', target: '/agency/chat', title: 'Messages', body: 'Chat with your manager and the Reliable Touch team.' },
  { icon: 'Plus', target: '[data-tour="new"]', title: 'New, from anywhere', body: 'Add a lead, book a viewing or send a tenant link without leaving the page you are on. Search (Ctrl K) finds any lead or contact.' },
  { icon: 'Bell', target: 'button[aria-label="Notifications"]', title: 'Notifications', body: 'The bell tells you the moment something happens on your leads. Your profile, dark mode and sign out are under your initials.' },
]

const MANAGER = (company) => [
  welcome(company, 'You run your company on Reliable Touch: your team, every lead and every deal. Here is the quick tour.'),
  { icon: 'LayoutDashboard', target: '/agency', title: 'Dashboard', body: "Today at a glance — who's calling, new leads, appointments and deals." },
  { icon: 'TrendingUp', target: '/agency/leads', title: 'Leads', body: "All of your company's leads. Assign them to agents and follow each one live.", to: '/agency/leads?new=1', cta: 'Create a lead' },
  { icon: 'Users', target: '/agency/team', title: 'Team', body: 'Add agents, reset passwords and switch access off — each person gets their own login.', to: '/agency/team', cta: 'Open Team' },
  { icon: 'KeyRound', target: '/agency/tenants', title: 'Tenants', body: 'Someone wants to rent a listed property? Add them by name and send their private link — they apply, upload documents and sign on their phone, and you see every step.' },
  { icon: 'Gauge', target: '/agency/caller-workload', title: 'Calling workload', body: 'Hand out contacts to call and see who is keeping up.' },
  { icon: 'Handshake', target: '/agency/deal-tracker', title: 'Deal Tracker', body: 'Every deal stage by stage, with its documents and commission.' },
  { icon: 'CalendarCheck', target: '/agency/appointments', title: 'Appointments', body: "Your team's viewings and meetings in one calendar." },
]

const AGENCY_ADMIN = (company) => [
  welcome(company, 'As Agency Admin you set up your company: its look, its people and its first leads. Let’s get you going.'),
  { icon: 'Building2', target: '/agency/company-profile', title: 'Make it yours', body: 'Upload your logo and pick your colour — everyone in your company sees your brand instead of ours. Add your registration details while you are there.', to: '/agency/company-profile', cta: 'Set up company profile' },
  { icon: 'Users', target: '/agency/team', title: 'Add your people', body: 'Create a login for each agent or manager. You get their password once to hand over.', to: '/agency/team', cta: 'Add a person' },
  { icon: 'TrendingUp', target: '/agency/leads', title: 'Create and assign leads', body: 'Add a lead in seconds and assign it to an agent. Everything that happens on it shows live.', to: '/agency/leads?new=1', cta: 'Create a lead' },
  { icon: 'Handshake', target: '/agency/deal-tracker', title: 'Track every deal', body: 'Deals stage by stage, with the paperwork uploaded at each step.' },
  { icon: 'KeyRound', target: '/agency/tenants', title: 'Tenants', body: 'Someone wants to rent a listed property? Add them by name and send their private link — they apply, upload documents and sign on their phone, and you see every step.' },
  { icon: 'LayoutDashboard', target: '/agency', title: 'Your dashboard', body: "Who's calling, new leads, appointments and deals — today at a glance." },
  {
    icon: 'Rocket',
    title: 'Your set-up checklist',
    body: 'Three things and your company is ready. You can come back to this from the ? button.',
    checklist: [
      { key: 'profile', label: 'Set up your company profile', sub: 'Logo, colour and details', to: '/agency/company-profile' },
      { key: 'team', label: 'Add your first person', sub: 'An agent or a manager', to: '/agency/team' },
      { key: 'lead', label: 'Create your first lead', sub: 'And assign it to someone', to: '/agency/leads?new=1' },
    ],
  },
]

const FOLLOW_UP = [
  welcome('Reliable Touch', 'You keep hot leads moving — follow up, book appointments and hand them to the right company.'),
  { icon: 'Flame', target: '/follow-up-manager/leads', title: 'Hot leads', body: 'The leads that need a follow-up. Open one to call, comment, assign or book an appointment.' },
  { icon: 'KeyRound', target: '/follow-up-manager/tenants', title: 'Tenants', body: 'Someone wants to rent a listed property? Add them by name and send their private link — they apply, upload documents and sign on their phone, and you see every step.' },
  { icon: 'CalendarCheck', target: '/follow-up-manager/appointments', title: 'Appointments', body: 'Every appointment you are managing.' },
  { icon: 'Megaphone', target: '/follow-up-manager/campaigns', title: 'Campaigns', body: 'The campaigns that leads come from.' },
  { icon: 'MessageSquare', target: '/follow-up-manager/chat', title: 'Messages', body: 'Chat with cold callers, agents and admin.' },
]

const ADMIN = [
  welcome('Reliable Touch admin', 'You see and run everything: leads, people, companies and money.'),
  { icon: 'TrendingUp', target: '/admin/leads', title: 'Leads', body: 'Every lead in the system — assign, follow and change them.', to: '/admin/leads?new=1', cta: 'Create a lead' },
  { icon: 'Building2', target: '/admin/agencies', title: 'Agencies', body: 'Create a company and its Agency Admin login. The Agency Admin then brands it and adds their own team.', to: '/admin/agencies', cta: 'Open Agencies' },
  { icon: 'Users', target: '/admin/users', title: 'Users', body: 'Cold callers, follow-up managers and admins — logins, roles and access.' },
  { icon: 'KeyRound', target: '/admin/tenants', title: 'Tenants', body: 'Someone wants to rent a listed property? Add them by name and send their private link — they apply, upload documents and sign on their phone, and you see every step.' },
  { icon: 'Handshake', target: '/admin/deal-tracker', title: 'Deal Tracker', body: 'Every deal across all companies, with documents and points.' },
  { icon: 'Trophy', target: '/admin/performance', title: 'Performance & reports', body: 'Who is calling, converting and closing.' },
]

// `company` — the company's name, for its own people's welcome
export function tourFor(user, { company } = {}) {
  if (!user) return []
  if (user.role === 'admin') return ADMIN
  if (user.role === 'cold_caller') return COLD_CALLER
  if (user.role === 'follow_up_manager') return FOLLOW_UP
  const who = company ?? 'your company portal'
  if (user.role === 'agency') return user.isAgencyAdmin ? AGENCY_ADMIN(who) : user.isAgencyManager ? MANAGER(who) : AGENT(who)
  return []
}
