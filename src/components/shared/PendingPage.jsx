import { Clock, Construction } from 'lucide-react'

export default function PendingPage({ title = 'Coming Soon', description = 'This page is being integrated.' }) {
  return (
    <div className="min-h-full bg-[#FAFAF9] dark:bg-[#0B0B0B] flex flex-col items-center justify-center p-10 text-center">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#F59E0B]/10 mb-5">
        <Construction className="w-7 h-7 text-[#F59E0B]" strokeWidth={1.75} />
      </div>
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] text-[10px] font-bold uppercase tracking-widest mb-4">
        <Clock className="w-3 h-3" />
        Integration Pending
      </span>
      <h2 className="text-xl font-bold text-[#111111] dark:text-white mb-2 tracking-tight">{title}</h2>
      <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] max-w-xs">{description}</p>
    </div>
  )
}
