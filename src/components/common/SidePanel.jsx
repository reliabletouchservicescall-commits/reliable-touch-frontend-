import { X } from 'lucide-react'

/**
 * Shared right-side sliding panel shell used across the leads flows.
 * Full-width on mobile (where the cold caller mostly lives), capped on larger screens.
 */
export default function SidePanel({
  onClose,
  icon: Icon,
  iconColor = '#F95C4B',
  title,
  subtitle,
  children,
  footer,
  widthClass = 'sm:max-w-md',
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full ${widthClass} flex flex-col bg-white dark:bg-[#181818] shadow-2xl border-l border-[#E5E7EB] dark:border-[#2A2A2A] animate-slide-in-right`}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A] flex-shrink-0">
          {Icon && (
            <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${iconColor}18` }}>
              <Icon className="w-4 h-4" style={{ color: iconColor }} strokeWidth={1.75} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#111111] dark:text-white truncate">{title}</p>
            {subtitle && <p className="text-xs text-[#6B7280] dark:text-[#A1A1AA] truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[#6B7280] dark:text-[#A1A1AA] hover:bg-[#F5F5F4] dark:hover:bg-[#202020] hover:text-[#111111] dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">{children}</div>

        {footer && (
          <div className="px-5 py-4 border-t border-[#E5E7EB] dark:border-[#2A2A2A] flex-shrink-0 flex gap-3">
            {footer}
          </div>
        )}
      </div>
    </>
  )
}
