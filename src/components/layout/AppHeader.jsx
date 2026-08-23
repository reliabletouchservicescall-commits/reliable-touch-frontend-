import { Building2, Sun, Moon } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

export default function AppHeader() {
  const { theme, toggle } = useTheme()

  return (
    <header className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5 bg-white/80 dark:bg-[#0B0B0B]/80 backdrop-blur-sm border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#F95C4B]">
          <Building2 className="w-5 h-5 text-white" strokeWidth={2} />
        </div>
        <span className="text-[#111111] dark:text-white font-semibold text-base tracking-tight">
          Reliable Touch
        </span>
      </div>

      <div className="flex items-center gap-4">
        <span className="hidden sm:block text-xs text-[#6B7280] dark:text-[#A1A1AA] tracking-widest uppercase font-medium">
          CRM Platform
        </span>
        <button
          onClick={toggle}
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#181818] text-[#6B7280] dark:text-[#A1A1AA] hover:border-[#F95C4B] hover:text-[#F95C4B] dark:hover:border-[#F95C4B] dark:hover:text-[#F95C4B]"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>
      </div>
    </header>
  )
}
