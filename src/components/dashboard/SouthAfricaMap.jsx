import { useMemo, useState } from 'react'
import mapData from '../../assets/maps/south-africa-provinces.json'

// Province shapes are pre-projected SVG paths (52 districts grouped into the 9 provinces),
// built from the open "Click That Hood" South Africa boundaries — so no map library or
// tile server is needed at runtime.

const BRAND = '#F95C4B'

// Light → full coral by share of leads; square-root scale so a province with a handful of
// leads is still visibly "on" next to one with thousands.
function shade(value, max, isDark) {
  if (!value) return isDark ? '#262626' : '#F1EFEC'
  const t = Math.sqrt(value / Math.max(1, max))
  const a = 0.18 + 0.82 * t
  return `rgba(249, 92, 75, ${a.toFixed(3)})`
}

/**
 * @param {{ provinces: {name:string, leads:number, contacts:number, closed:number, hot:number}[], metric: 'leads'|'contacts', isDark: boolean, selected?: string, onSelect?: (name) => void }} props
 */
export default function SouthAfricaMap({ provinces, metric = 'leads', isDark = false, selected, onSelect }) {
  const [hover, setHover] = useState(null)
  const byName = useMemo(() => Object.fromEntries((provinces ?? []).map((p) => [p.name, p])), [provinces])
  const max = Math.max(1, ...(provinces ?? []).map((p) => p[metric] ?? 0))
  const active = hover ?? selected
  const info = active ? byName[active] : null

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${mapData.width} ${mapData.height}`} className="w-full h-auto select-none" role="img" aria-label="Map of South Africa by province">
        <defs>
          <filter id="sa-map-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#F95C4B" floodOpacity="0.35" />
          </filter>
        </defs>
        {mapData.provinces.map((p, i) => {
          const stats = byName[p.name]
          const isActive = active === p.name
          const fill = shade(stats?.[metric] ?? 0, max, isDark)
          return (
            <g
              key={p.name}
              className="mac-in cursor-pointer"
              style={{ '--d': `${120 + i * 55}ms`, transformBox: 'fill-box', transformOrigin: 'center' }}
              onMouseEnter={() => setHover(p.name)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(selected === p.name ? null : p.name)}
              filter={isActive ? 'url(#sa-map-glow)' : undefined}
            >
              <g style={{ transform: isActive ? 'scale(1.035)' : 'scale(1)', transformBox: 'fill-box', transformOrigin: 'center', transition: 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                {p.districts.map((d) => (
                  <path
                    key={d.name}
                    d={d.d}
                    fill={isActive ? BRAND : fill}
                    stroke={isDark ? '#181818' : '#FFFFFF'}
                    strokeWidth={isActive ? 0.9 : 0.6}
                    style={{ transition: 'fill 240ms ease' }}
                  />
                ))}
              </g>
            </g>
          )
        })}
        {/* Province labels for the ones with data, drawn last so they sit on top */}
        {mapData.provinces.map((p) => {
          const v = byName[p.name]?.[metric] ?? 0
          if (!v) return null
          return (
            <g key={`l-${p.name}`} pointerEvents="none" className="mac-pop" style={{ '--d': '700ms', transformBox: 'fill-box', transformOrigin: 'center' }}>
              <circle cx={p.labelAt[0]} cy={p.labelAt[1]} r="15" fill={isDark ? '#111111' : '#FFFFFF'} opacity="0.92" />
              <text x={p.labelAt[0]} y={p.labelAt[1] + 3.5} textAnchor="middle" fontSize="10.5" fontWeight="800" fill={BRAND}>
                {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Hover / selection card */}
      <div
        className={`absolute top-2 left-2 pointer-events-none rounded-xl px-3 py-2 bg-white/90 dark:bg-[#111111]/90 backdrop-blur border border-[#E5E7EB] dark:border-[#2A2A2A] shadow-lg transition-all duration-200 ${
          info ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
        }`}
      >
        {info && (
          <>
            <p className="text-xs font-bold text-[#111111] dark:text-white">{info.name}</p>
            <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA] mt-0.5">
              <span className="font-semibold text-[#F95C4B]">{info.leads.toLocaleString()}</span> leads ·{' '}
              {info.contacts.toLocaleString()} contacts
            </p>
            <p className="text-[11px] text-[#6B7280] dark:text-[#A1A1AA]">
              {info.hot.toLocaleString()} hot · {info.closed.toLocaleString()} closed
            </p>
          </>
        )}
      </div>
    </div>
  )
}
