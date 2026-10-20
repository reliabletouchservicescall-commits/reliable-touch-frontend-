import { FileSpreadsheet } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import ExcelFilesBoard from '../../components/files/ExcelFilesBoard'

// The company manager's Excel Files board — the same board admin uses, scoped to the
// company's own spreadsheets and assigning to its own agents.
export default function ExcelFilesPage() {
  const { user } = useAuthStore()

  if (!user?.isAgencyManager) {
    return (
      <div className="flex items-center justify-center h-full py-32 px-6 text-center">
        <div>
          <div className="w-14 h-14 rounded-2xl bg-[#F95C4B]/10 flex items-center justify-center mb-4 mx-auto">
            <FileSpreadsheet className="w-7 h-7 text-[#F95C4B]" strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-bold text-[#111111] dark:text-white mb-1">Manager access only</h3>
          <p className="text-sm text-[#6B7280] dark:text-[#A1A1AA] max-w-xs">
            Only your company's manager can view and manage uploaded spreadsheets.
          </p>
        </div>
      </div>
    )
  }

  return <ExcelFilesBoard mode="agency" />
}
