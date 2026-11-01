import { useMemo, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Users, Plus, Search, Inbox, Loader2 } from 'lucide-react'
import { tenantsApi } from '../../services/tenantsApi'
import { ApplicationRow, TenantReviewDrawer, NewApplicationModal } from '../../components/tenants/TenantApplications'

// Every tenant application this person can see, across the listed rentals they work on —
// who still has to open their link, who's filling it in, who's waiting for a review.
const TABS = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'review', label: 'To review', match: (a) => a.status === 'submitted' },
  { key: 'progress', label: 'Filling in', match: (a) => ['opened', 'in_progress'].includes(a.status) },
  { key: 'waiting', label: 'Not opened', match: (a) => a.status === 'invited' },
  { key: 'fixes', label: 'Fixes asked', match: (a) => a.status === 'changes_requested' },
  { key: 'done', label: 'Decided', match: (a) => ['approved', 'declined', 'withdrawn'].includes(a.status) },
]

export default function TenantApplicationsPage() {
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['tenant-apps', 'list', search],
    queryFn: () => tenantsApi.list({ search: search || undefined }).then((r) => r.data.data.applications),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  })
  const apps = useMemo(() => data ?? [], [data])
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.key, apps.filter(t.match).length])), [apps])
  const shown = apps.filter(TABS.find((t) => t.key === tab).match)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-[#E5E7EB] bg-white px-5 pb-4 pt-6 dark:border-[#2A2A2A] dark:bg-[#181818] sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-[#111111] dark:text-white">
              <Users className="h-5 w-5 text-[#F95C4B]" strokeWidth={1.75} /> Tenant applications
            </h1>
            <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[#A1A1AA]">Add a tenant to a listed rental, send their link, and follow every step until you approve them.</p>
          </div>
          <button type="button" onClick={() => setAdding(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F95C4B] px-4 py-2.5 text-sm font-semibold text-white shadow-btn hover:bg-[#E84B3A] active:scale-[0.98]">
            <Plus className="h-4 w-4" /> New application
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-[#F5F5F4] p-1 dark:bg-[#202020]">
            {TABS.map((t) => (
              <button key={t.key} type="button" onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${tab === t.key ? 'bg-white text-[#111111] shadow-sm dark:bg-[#181818] dark:text-white' : 'text-[#6B7280] hover:text-[#111111] dark:text-[#A1A1AA] dark:hover:text-white'}`}>
                {t.label}
                <span className={`rounded-full px-1.5 text-[10px] ${tab === t.key ? 'bg-[#F95C4B]/10 text-[#F95C4B]' : 'bg-black/5 dark:bg-white/10'}`}>{counts[t.key] ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1 lg:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tenant, reference or address…"
              className="w-full rounded-xl border border-[#E5E7EB] bg-white py-2.5 pl-9 pr-3 text-sm text-[#111111] outline-none focus:border-[#F95C4B] dark:border-[#2A2A2A] dark:bg-[#121212] dark:text-white" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-8">
        {isLoading ? (
          <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-[#F95C4B]" /></div>
        ) : shown.length ? (
          <div className="mx-auto max-w-5xl space-y-2">{shown.map((a) => <ApplicationRow key={a.id} app={a} showProperty onOpen={(x) => setOpen(x.id)} />)}</div>
        ) : (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F95C4B]/10"><Inbox className="h-7 w-7 text-[#F95C4B]" strokeWidth={1.5} /></div>
            <p className="text-sm font-bold text-[#111111] dark:text-white">{apps.length ? 'Nothing in this list' : 'No tenant applications yet'}</p>
            <p className="mt-1 max-w-sm text-xs text-[#6B7280] dark:text-[#A1A1AA]">When someone asks about a listed rental, add them here and send their link — you'll see every step they take.</p>
            {!apps.length && <button type="button" onClick={() => setAdding(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#F95C4B] px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> New application</button>}
          </div>
        )}
      </div>

      {open && <TenantReviewDrawer id={open} onClose={() => setOpen(null)} />}
      {adding && <NewApplicationModal onClose={() => setAdding(false)} />}
    </div>
  )
}
