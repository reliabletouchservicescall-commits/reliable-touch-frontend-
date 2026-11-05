// The first-login guided tour, one walkthrough per kind of user. KEEP THIS IN STEP WITH THE
// APP: when a page is added, renamed, moved in a sidebar or removed, update the steps here
// (see .claude/skills/onboarding-tour/SKILL.md). Bump TOUR_VERSION when the tour changes.
//
// A step: { title, body, icon, target?, to?, cta?, tips?, checklist? }
//   target — the sidebar link it points at (its href), or a CSS selector for a top-bar
//            control; spotlighted when it's on screen
//   to/cta  — a button that opens that page (closes the tour first)
//   checklist — the closing "get set up" list: [{ label, sub, to, done? }]
export const TOUR_VERSION = 11

const welcome = (who, what) => ({
  icon: 'Sparkles',
  title: `Welcome to ${who}`,
  body: what,
  tips: ['Takes about a minute', 'Skip any time — reopen it from the ? button at the top'],
})

const COLD_CALLER = [
  welcome('Reliable Touch', 'You find landlords and sellers, turn them into leads and earn points when they sign. Everything lives in five places. Here is the quick tour.'),
  { icon: 'Home', target: '/cold-caller', title: 'Home', body: 'Your day: how many calls you have made, the next owner with one big Call button, and a button for each job — callbacks, a new lead, your leads, viewings and your progress.' },
  { icon: 'Phone', target: '/cold-caller/calls', title: 'Calls', body: 'Call next, the callbacks owners asked for, all your contacts, the calls you made and the do-not-call list — in tabs. Today’s campaign shows on top.' },
  { icon: 'TrendingUp', target: '/cold-caller/leads', title: 'My leads', body: 'Every lead you found, how each deal is going (Deal Tracker), the tenants applying and the viewings booked.', to: '/cold-caller/leads?new=1', cta: 'Create a lead' },
  { icon: 'CalendarDays', target: '/cold-caller/diary', title: 'Diary', body: 'A calendar of your callbacks, the follow-ups and viewings on leads you found, those leads moving forward, and your own reminders — like “call the tenant at 10:00”.' },
  { icon: 'Award', target: '/cold-caller/progress', title: 'My progress', body: 'Your points, what your leads can still earn you, and where you rank on the leaderboard.' },
  { icon: 'MessageSquare', target: '[data-tour="messages"]', title: 'Messages and the bell', body: 'The speech bubble opens your chats. The bell tells you the moment something happens on your leads. Dark mode and sign out are under your initials.' },
]

const AGENT = (company) => [
  welcome(company, 'You work the leads your company gets — call, book viewings and close deals. Everything lives in five places. Here is the quick tour.'),
  { icon: 'Home', target: '/agency', title: 'Home', body: 'Your day: a button for each everyday job — update landlords, start calling, callbacks, add a lead, book a viewing, send a tenant link — and what is due today.' },
  { icon: 'TrendingUp', target: '/agency/leads', title: 'Leads', body: 'Your leads in three tabs: List, Deal Tracker (each deal stage by stage) and Applications (tenants applying for your listed rentals).' },
  { icon: 'Phone', target: '/agency/calls', title: 'Calls', body: 'Who to call next, the callbacks owners asked for, all your contacts and the do-not-call list — in tabs. Today’s campaign shows on top.' },
  { icon: 'CalendarDays', target: '/agency/diary', title: 'Diary', body: 'A calendar of your viewings, callbacks, follow-ups and landlord updates. Add your own reminders too — like “call the tenant at 10:00” — and the bell rings when it’s time.' },
  { icon: 'Target', target: '/agency/progress', title: 'My progress', body: 'Your points, your rank, your calls against your own daily goal and the milestones you are close to. Reach #1 for the day and you get fireworks.' },
  { icon: 'MessageSquare', target: '[data-tour="messages"]', title: 'Messages', body: 'The speech bubble at the top: chat with your manager and the Reliable Touch team.' },
  { icon: 'Plus', target: '[data-tour="new"]', title: 'New, from anywhere', body: 'Add a lead, book a viewing or send a tenant link without leaving the page you are on. Search (Ctrl K) finds any lead or contact.' },
  { icon: 'Bell', target: 'button[aria-label="Notifications"]', title: 'Notifications', body: 'The bell tells you the moment something happens on your leads. Your profile, dark mode and sign out are under your initials.' },
]

const MANAGER = (company) => [
  welcome(company, 'You run your company on Reliable Touch: your team, every lead and every deal. Here is the quick tour.'),
  { icon: 'Home', target: '/agency', title: 'Home', body: 'Big buttons for the jobs you do every day, what needs you now and who is working. Tap “Show all the numbers” for the charts.' },
  { icon: 'TrendingUp', target: '/agency/leads', title: 'Leads', body: "Every lead in your company. Use List to find one, Deal Tracker to see each deal step by step, and Applications for people renting a listed home.", to: '/agency/leads?new=1', cta: 'Create a lead' },
  { icon: 'CalendarDays', target: '/agency/diary', title: 'Diary', body: "Your team's viewings and meetings in one calendar." },
  { icon: 'Users', target: '/agency/team', title: 'Team', body: 'Add agents, reset passwords and see who is leading this month.', to: '/agency/team', cta: 'Open Team' },
  { icon: 'Phone', target: '/agency/calls', title: 'Calls', body: 'See how much each agent has to call, give out Excel files, then phone owners and do callbacks. Areas and campaigns are here too.' },
  { icon: 'Bell', target: '[data-tour="new"]', title: '+ New, messages and the bell', body: 'Add a lead, book a viewing or send a tenant link from any page with + New. The speech bubble opens your messages, and the bell tells you when something happens.' },
]
const AGENCY_ADMIN = (company) => [
  welcome(company, 'As Agency Admin you set up your company: its look, its people and its first leads. Let’s get you going.'),
  { icon: 'Building2', target: '/agency/company-profile', title: 'Make it yours', body: 'Upload your logo and pick your colour — everyone in your company sees your brand instead of ours. Add your registration details while you are there.', to: '/agency/company-profile', cta: 'Set up company profile' },
  { icon: 'Users', target: '/agency/team', title: 'Add your people', body: 'Create a login for each agent or manager. You get their password once to hand over.', to: '/agency/team', cta: 'Add a person' },
  { icon: 'TrendingUp', target: '/agency/leads', title: 'Create and assign leads', body: 'Add a lead in seconds and give it to an agent. Deal Tracker shows each deal step by step; Applications is for people renting a listed home.', to: '/agency/leads?new=1', cta: 'Create a lead' },
  { icon: 'Phone', target: '/agency/calls', title: 'Calls', body: 'Upload Excel files of owners and give them to your agents to phone. Areas and campaigns live here too.' },
  { icon: 'Home', target: '/agency', title: 'Home', body: 'Big buttons for the jobs you do every day, what needs you now and who is working.' },
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
  welcome('Reliable Touch', 'You keep hot leads moving — follow up, book viewings and hand them to the right company. Everything lives in three places.'),
  { icon: 'Home', target: '/follow-up-manager', title: 'Home', body: 'A button for each job — overdue follow-ups, due today, never followed up, hand to an agency, viewings, a reminder — then your queue, most urgent first.' },
  { icon: 'Flame', target: '/follow-up-manager/leads', title: 'Hot leads', body: 'The leads that need a follow-up. Open one to call, comment, give it to an agency or book a viewing. The Deal Tracker, tenant applications and campaigns are in tabs here.' },
  { icon: 'CalendarDays', target: '/follow-up-manager/diary', title: 'Diary', body: 'A calendar of follow-ups and viewings on your hot leads, those leads moving on, and your own reminders. The appointments list is the second tab.' },
  { icon: 'MessageSquare', target: '[data-tour="messages"]', title: 'Messages and the bell', body: 'The speech bubble opens your chats with cold callers, agents and admin. The bell tells you when a lead turns hot or moves.' },
]

const ADMIN = [
  welcome('Reliable Touch admin', 'You see and run everything: leads, people, companies and money — from seven places.'),
  { icon: 'Home', target: '/admin', title: 'Home', body: 'A button for each job you do most — hand out hot leads, contact requests, late follow-ups, upload contacts, add a person, commissions — then what needs you today.' },
  { icon: 'TrendingUp', target: '/admin/leads', title: 'Leads', body: 'Every lead in the system, the Deal Tracker, tenant applications and lease renewals — in tabs.', to: '/admin/leads?new=1', cta: 'Create a lead' },
  { icon: 'BookUser', target: '/admin/contacts', title: 'Contacts', body: 'Upload contacts and hand them out, see who calls what and every call made. Campaigns, areas and do-not-call are here too.' },
  { icon: 'Users', target: '/admin/team', title: 'Team', body: 'How everyone is doing, the people and their logins, and when they signed in.' },
  { icon: 'Building2', target: '/admin/agencies', title: 'Agencies', body: 'Create a company and its Agency Admin login, see their agents and the commissions.', to: '/admin/agencies', cta: 'Open Agencies' },
  { icon: 'MessageSquare', target: '[data-tour="messages"]', title: 'Messages, the bell and the Bin', body: 'The speech bubble opens your chats and the bell your notifications. The Bin (deleted items) is under your initials.' },
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
