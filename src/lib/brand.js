// A company's brand colour across the app. postcss-brand-vars.js points every coral in the
// CSS at --brand-rgb / --brand-hover-rgb / --brand-light-rgb; setting those on <html> re-colours
// buttons, active links, badges and focus rings at once. Only a company's own people get its
// colour (AgencyLayout); everyone else keeps Reliable Touch's.

export const RT_BRAND = '#F95C4B'

// Ready-made colours the Agency Admin can pick from (plus any colour of their own)
export const BRAND_PRESETS = ['#1D4ED8', '#0F766E', '#7E22CE', '#B91C1C', '#0E7490', '#1E293B', '#C2410C', '#047857', '#BE185D', '#F95C4B']

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '')
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const rgbToHex = ([r, g, b]) => `#${[r, g, b].map((x) => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, '0')).join('')}`.toUpperCase()

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

function hslToRgb([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}

function luminance([r, g, b]) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

// Contrast of white text on this colour (WCAG ratio)
export const contrastWithWhite = (rgb) => 1.05 / (luminance(rgb) + 0.05)

// Buttons put white text on the brand colour, so a very light pick (yellow, mint) is darkened
// until white text on it is readable (≥ 3:1).
export function readableBrand(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  let [h, s, l] = rgbToHsl(rgb)
  let out = rgb
  while (contrastWithWhite(out) < 3 && l > 0.15) { l -= 0.03; out = hslToRgb([h, s, l]) }
  return rgbToHex(out)
}

// The three shades the CSS uses, from one colour
export function brandShades(hex) {
  const base = hexToRgb(readableBrand(hex) ?? RT_BRAND)
  const [h, s, l] = rgbToHsl(base)
  return {
    base,
    hover: hslToRgb([h, s, clamp(l - 0.07, 0, 1)]),
    light: hslToRgb([h, s, clamp(l + 0.1, 0, 0.92)]),
  }
}

const rgbVar = (rgb) => rgb.map((x) => Math.round(x)).join(' ')

// ── Live colour tokens for JavaScript ─────────────────────────────────────────
// Charts, inline styles and SVG attributes can't use CSS variables (and `${CORAL}1A` needs a
// real hex), so code imports these instead of writing '#F95C4B'. Each token turns into the
// current brand's hex whenever it's used as a string — in a template literal, a style value,
// an SVG fill — so the same code paints Reliable Touch coral or the company's colour.
const RT_SHADES = { base: '#F95C4B', dark: '#E84B3A', deep: '#C93A2B', light: '#FF7A6B', soft: '#FF8C7A', pale: '#FDBAAE' }
let current = { ...RT_SHADES }
const token = (key) => {
  const get = () => current[key]
  return { toString: get, valueOf: get, toJSON: get, [Symbol.toPrimitive]: get }
}
export const CORAL = token('base')        // the brand colour
export const CORAL_DARK = token('dark')   // hover / pressed
export const CORAL_DEEP = token('deep')   // deepest shade (last step of a scale)
export const CORAL_LIGHT = token('light') // gradient top
export const CORAL_2 = token('soft')      // softer tint (charts, gradients)
export const CORAL_3 = token('pale')      // palest tint (chart backgrounds, pipeline start)

function setShades(hex) {
  if (!hex) { current = { ...RT_SHADES }; return }
  const { base, hover, light } = brandShades(hex)
  const [h, s, l] = rgbToHsl(base)
  current = {
    base: rgbToHex(base), dark: rgbToHex(hover), light: rgbToHex(light),
    deep: rgbToHex(hslToRgb([h, s, clamp(l - 0.14, 0.08, 1)])),
    soft: rgbToHex(hslToRgb([h, s, clamp(l + 0.14, 0, 0.9)])),
    pale: rgbToHex(hslToRgb([h, clamp(s, 0, 0.9), clamp(l + 0.3, 0, 0.92)])),
  }
}

export function applyBrand(hex) {
  const root = document.documentElement
  if (!hex) return clearBrand()
  setShades(hex)
  const { base, hover, light } = brandShades(hex)
  root.style.setProperty('--brand-rgb', rgbVar(base))
  root.style.setProperty('--brand-hover-rgb', rgbVar(hover))
  root.style.setProperty('--brand-light-rgb', rgbVar(light))
}

export function clearBrand() {
  setShades(null)
  const root = document.documentElement
  for (const v of ['--brand-rgb', '--brand-hover-rgb', '--brand-light-rgb']) root.style.removeProperty(v)
}

// The colour the JS tokens hold right now — AgencyLayout keys its pages on it so they repaint
export const currentBrandHex = () => current.base

// The company's colours, read straight out of its logo in the browser (no upload needed):
// the pixels are bucketed, near-white / near-black / grey / see-through ones skipped, and the
// most common distinct colours returned, most colourful first.
export async function paletteFromImage(src, count = 5) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('Could not read the image'))
    i.src = src
  })
  const size = 96
  const scale = Math.min(1, size / Math.max(img.naturalWidth || size, img.naturalHeight || size))
  const w = Math.max(1, Math.round((img.naturalWidth || size) * scale))
  const h = Math.max(1, Math.round((img.naturalHeight || size) * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)

  const buckets = new Map()
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue
    const rgb = [data[i], data[i + 1], data[i + 2]]
    const [, s, l] = rgbToHsl(rgb)
    if (l > 0.93 || l < 0.08 || s < 0.18) continue
    const key = rgb.map((v) => v >> 4).join(',')
    const b = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    b.n++; b.r += rgb[0]; b.g += rgb[1]; b.b += rgb[2]
    buckets.set(key, b)
  }
  const ranked = [...buckets.values()].sort((a, b) => b.n - a.n).map((b) => [b.r / b.n, b.g / b.n, b.b / b.n])

  const picked = []
  for (const rgb of ranked) {
    if (picked.every((p) => Math.hypot(p[0] - rgb[0], p[1] - rgb[1], p[2] - rgb[2]) > 60)) picked.push(rgb)
    if (picked.length >= count) break
  }
  return picked.map(rgbToHex)
}

// Last brand seen, so the colour is there on the very first paint after a reload
const CACHE = 'rt-agency-brand'
export function cachedBrand() {
  try { return JSON.parse(localStorage.getItem(CACHE) ?? 'null') } catch { return null }
}
export function cacheBrand(brand) {
  try {
    if (brand) localStorage.setItem(CACHE, JSON.stringify(brand))
    else localStorage.removeItem(CACHE)
  } catch { /* private mode */ }
}

// Sets the JS tokens only (safe to call while rendering) — useAgencyBrand calls it so the
// pages it re-mounts on a colour change render with the new colour straight away
export function syncBrandTokens(hex) {
  if ((hex ? readableBrand(hex) : RT_SHADES.base) !== current.base) setShades(hex)
}

// Signed in as a company user? Paint their last-known colour before the first render
try {
  const auth = JSON.parse(localStorage.getItem('rt-auth') ?? 'null')?.state
  const b = cachedBrand()
  if (auth?.user?.role === 'agency' && b?._id === String(auth.user.agencyId) && b.branding?.primaryColor) applyBrand(b.branding.primaryColor)
} catch { /* no storage */ }
