import { Calendar, X } from 'lucide-react'

export const PERIOD_TABS = [
  { key: 'day',   label: 'Today' },
  { key: 'week',  label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year',  label: 'This Year' },
]

/**
 * Relative period tabs (Today / This Week / This Month / This Year) plus a native
 * month picker for looking at any specific past month (e.g. June). The month picker
 * always wins when set — clear it to go back to the relative tabs.
 */
export default function PeriodPicker({ period, onPeriod, month, onMonth }) {
  const active = Boolean(month)
  const thisMonth = new Date().toISOString().slice(0, 7)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center bg-[#F5F5F4] dark:bg-[#202020] rounded-xl p-1 gap-1">
        {PERIOD_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onPeriod(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              !active && period === key
                ? 'bg-white dark:bg-[#2A2A2A] text-[#F95C4B] shadow-sm'
                : 'text-[#6B7280] dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <label
        className={`flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-xl border cursor-pointer transition-all ${
          active
            ? 'border-[#F95C4B] bg-[#F95C4B]/5'
            : 'border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] hover:border-[#D1D5DB] dark:hover:border-[#3A3A3A]'
        }`}
      >
        <Calendar className={`w-3.5 h-3.5 flex-shrink-0 ${active ? 'text-[#F95C4B]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`} strokeWidth={1.75} />
        <input
          type="month"
          value={month}
          max={thisMonth}
          onChange={(e) => onMonth(e.target.value)}
          className={`bg-transparent text-xs font-semibold outline-none cursor-pointer ${active ? 'text-[#F95C4B]' : 'text-[#6B7280] dark:text-[#A1A1AA]'}`}
        />
        {active && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onMonth('') }}
            className="text-[#F95C4B] hover:text-[#E84B3A] flex-shrink-0"
            title="Clear month"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </label>
    </div>
  )
}
