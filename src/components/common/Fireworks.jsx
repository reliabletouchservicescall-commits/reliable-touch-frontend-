import { useEffect, useMemo, useState } from 'react'

// Brand palette only — no new colors introduced for the celebration burst.
const COLORS = ['#F95C4B', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6']
const BURSTS = 3
const PARTICLES_PER_BURST = 18

function randomBetween(min, max) {
  return min + Math.random() * (max - min)
}

function buildBurst(burstIndex) {
  const originX = randomBetween(20, 80)
  const originY = randomBetween(15, 45)
  const delay = burstIndex * 0.35

  return Array.from({ length: PARTICLES_PER_BURST }).map((_, i) => {
    const angle = (i / PARTICLES_PER_BURST) * Math.PI * 2
    const distance = randomBetween(60, 140)
    return {
      key: `${burstIndex}-${i}`,
      originX,
      originY,
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      color: COLORS[i % COLORS.length],
      delay,
      duration: randomBetween(0.9, 1.4),
      size: randomBetween(6, 11),
    }
  })
}

/**
 * Full-screen celebratory burst shown when the current user becomes the #1 cold
 * caller. Pure CSS/JS — no canvas or external confetti library — colors are drawn
 * only from the app's existing palette. Auto-dismisses after ~3.2s.
 */
export default function Fireworks({ onDone }) {
  const [visible, setVisible] = useState(true)
  const particles = useMemo(() => Array.from({ length: BURSTS }).flatMap((_, i) => buildBurst(i)), [])

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      onDone?.()
    }, 3200)
    return () => clearTimeout(t)
  }, [onDone])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <span
          key={p.key}
          style={{
            position: 'absolute',
            left: `${p.originX}%`,
            top: `${p.originY}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            backgroundColor: p.color,
            animation: `firework-particle ${p.duration}s ease-out ${p.delay}s forwards`,
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`,
          }}
        />
      ))}
      <style>{`
        @keyframes firework-particle {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--dx), calc(var(--dy) + 80px)) scale(0.3); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
