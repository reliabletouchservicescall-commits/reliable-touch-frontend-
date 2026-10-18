import { useEffect, useRef, useState } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Counts from the previous value to `value` with an ease-out-expo curve — quick start,
 * soft landing, like the numbers in a macOS widget. Re-animates from wherever it is when
 * `value` changes (e.g. on refetch), and jumps straight there for reduced-motion users.
 */
export default function AnimatedNumber({ value, duration = 900, format = (n) => Math.round(n).toLocaleString(), className }) {
  const target = Number(value) || 0
  const [shown, setShown] = useState(prefersReducedMotion() ? target : 0)
  const fromRef = useRef(0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (prefersReducedMotion()) { setShown(target); fromRef.current = target; return undefined }
    const from = fromRef.current
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = t === 1 ? 1 : 1 - 2 ** (-10 * t)
      const v = from + (target - from) * eased
      setShown(v)
      fromRef.current = v
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return <span className={`tabular-nums ${className ?? ''}`}>{format(shown)}</span>
}
