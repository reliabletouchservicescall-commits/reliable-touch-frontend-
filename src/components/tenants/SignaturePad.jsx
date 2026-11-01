import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

// Finger / mouse signature. `ref.current.toDataURL()` gives a PNG (null when empty).
const SignaturePad = forwardRef(function SignaturePad({ onChange, invalid }, ref) {
  const canvas = useRef(null)
  const drawing = useRef(false)
  const last = useRef(null)
  const [empty, setEmpty] = useState(true)

  function fit() {
    const c = canvas.current
    if (!c) return
    const r = c.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    c.width = Math.round(r.width * dpr)
    c.height = Math.round(r.height * dpr)
    const ctx = c.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111111'
  }

  useEffect(() => {
    fit()
    const onResize = () => { if (empty) fit() }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const point = (e) => {
    const r = canvas.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function down(e) {
    e.preventDefault()
    canvas.current.setPointerCapture?.(e.pointerId)
    drawing.current = true
    last.current = point(e)
    const ctx = canvas.current.getContext('2d')
    ctx.beginPath()
    ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2)
    ctx.fillStyle = '#111111'
    ctx.fill()
  }
  function move(e) {
    if (!drawing.current) return
    const p = point(e)
    const ctx = canvas.current.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
    if (empty) { setEmpty(false); onChange?.(true) }
  }
  function up() { drawing.current = false }

  function clear() {
    const c = canvas.current
    c.getContext('2d').clearRect(0, 0, c.width, c.height)
    setEmpty(true)
    onChange?.(false)
  }

  useImperativeHandle(ref, () => ({
    toDataURL: () => (empty ? null : canvas.current.toDataURL('image/png')),
    clear,
    isEmpty: () => empty,
  }))

  return (
    <div className={`relative rounded-xl border border-dashed bg-white transition-colors ${invalid ? 'border-[#DC2626]' : empty ? 'border-[#D4D4D8]' : 'border-[#F95C4B]/60'}`}>
      <canvas
        ref={canvas}
        className="block w-full h-[150px] touch-none cursor-crosshair rounded-xl"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
        aria-label="Signature pad — sign with your finger"
      />
      <div className="pointer-events-none absolute inset-x-4 bottom-3 flex justify-between border-t border-[#E5E7EB] pt-1.5 text-[11px] text-[#9CA3AF]">
        <span>{empty ? 'Sign above with your finger' : 'Signed'}</span>
        <span>{new Date().toLocaleDateString('en-ZA')}</span>
      </div>
      {!empty && (
        <button type="button" onClick={clear} className="absolute top-2.5 right-3 text-xs font-semibold text-[#6B7280] underline underline-offset-2">
          Clear
        </button>
      )}
    </div>
  )
})

export default SignaturePad
