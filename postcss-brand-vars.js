// Turns every use of the Reliable Touch coral in the built CSS — Tailwind classes like
// bg-[#F95C4B]/10, hover:bg-[#E84B3A], the shadows in tailwind.config and our own CSS — into
// CSS variables (--brand-rgb, --brand-hover-rgb, --brand-light-rgb). The defaults in
// index.css keep the coral; a company's Agency Admin can then re-colour the whole app for
// their people by setting those variables (see src/lib/brand.js). Runs after Tailwind.
const SHADES = [
  { hex: 'F95C4B', rgb: [249, 92, 75], v: '--brand-rgb' },
  { hex: 'E84B3A', rgb: [232, 75, 58], v: '--brand-hover-rgb' },
  { hex: 'FF7A6B', rgb: [255, 122, 107], v: '--brand-light-rgb' },
  // other coral hovers used here and there, and the pale coral of unread notifications
  { hex: 'E84D3C', rgb: [232, 77, 60], v: '--brand-hover-rgb' },
  { hex: 'E04D3D', rgb: [224, 77, 61], v: '--brand-hover-rgb' },
  { hex: 'E05A48', rgb: [224, 90, 72], v: '--brand-hover-rgb' },
  { hex: 'FFF5F4', rgb: [255, 245, 244], v: '--brand-rgb', alpha: '0.06' },
]

function swap(value) {
  let out = value
  for (const { hex, rgb: [r, g, b], v, alpha } of SHADES) {
    if (alpha) { // a fixed pale tint → the brand colour, see-through
      out = out.replace(new RegExp(`#${hex}\\b`, 'gi'), `rgb(var(${v}) / ${alpha})`)
      // its own opacity part may be var(--tw-bg-opacity, 1) — swallow that whole
      out = out.replace(new RegExp(`rgb\\(\\s*${r}\\s+${g}\\s+${b}\\s*(\\/\\s*(var\\([^)]*\\)|[^)]*))?\\)`, 'g'), `rgb(var(${v}) / ${alpha})`)
      continue
    }
    // rgb(249 92 75 / x) and rgb(249 92 75)
    out = out.replace(new RegExp(`rgb\\(\\s*${r}\\s+${g}\\s+${b}\\s*(\\/[^)]*)?\\)`, 'g'), (_, a) => `rgb(var(${v})${a ? ` ${a.trim()}` : ''})`)
    // rgba(249,92,75,x)
    out = out.replace(new RegExp(`rgba?\\(\\s*${r}\\s*,\\s*${g}\\s*,\\s*${b}\\s*(?:,\\s*([^)]+))?\\)`, 'g'), (_, a) => `rgb(var(${v})${a ? ` / ${a.trim()}` : ''})`)
    // #F95C4BAA (8-digit) then #F95C4B
    out = out.replace(new RegExp(`#${hex}([0-9a-f]{2})\\b`, 'gi'), (_, aa) => `rgb(var(${v}) / ${(parseInt(aa, 16) / 255).toFixed(3)})`)
    out = out.replace(new RegExp(`#${hex}\\b`, 'gi'), `rgb(var(${v}))`)
  }
  return out
}

export default function brandVars() {
  return {
    postcssPlugin: 'brand-vars',
    OnceExit(root) {
      root.walkDecls((decl) => {
        if (decl.prop.startsWith('--brand-')) return // the defaults themselves
        const next = swap(decl.value)
        if (next !== decl.value) decl.value = next
      })
    },
  }
}
brandVars.postcss = true
