import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

const BRAND = '#F95C4B'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#1E1E1E] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-semibold text-[#111111] dark:text-white mb-1">{label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-medium">
          {p.name}: <span className="font-bold">{p.value?.toLocaleString()}</span>
        </p>
      ))}
    </div>
  )
}

/**
 * Horizontal ranked bar chart for a performance leaderboard — top N entries by
 * `dataKey`, highest first. Reused by cold-caller and agency performance pages.
 */
export default function LeaderboardChart({ board, dataKey, name, color = BRAND, limit = 8 }) {
  const data = [...board]
    .sort((a, b) => (b[dataKey] ?? 0) - (a[dataKey] ?? 0))
    .slice(0, limit)
    .reverse() // recharts vertical layout renders top-to-bottom in array order

  if (data.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: '#6B7280' }}
          axisLine={false}
          tickLine={false}
          width={104}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F5F5F4' }} />
        <Bar dataKey={dataKey} name={name} radius={[0, 6, 6, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={color} fillOpacity={0.5 + (0.5 * (i + 1)) / data.length} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
