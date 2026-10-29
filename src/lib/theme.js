// Theme-Steuerung (New Style Phase 5): 'auto' | 'hell' | 'dunkel'.
// auto = folgt dem System. Persistiert in localStorage, setzt data-theme
// am <html> und die Browser-Chrome-Farbe (theme-color).
import { writable } from 'svelte/store'

const KEY = 'wa-theme'
const start = (() => { try { return localStorage.getItem(KEY) || 'auto' } catch { return 'auto' } })()

export const theme = writable(start)

const media = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null

function istDunkel(modus) {
  if (modus === 'dunkel') return true
  if (modus === 'hell') return false
  return !!media?.matches
}

function anwenden(modus) {
  const dunkel = istDunkel(modus)
  document.documentElement.setAttribute('data-theme', dunkel ? 'dark' : 'light')
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta) }
  meta.content = dunkel ? '#1e150e' : '#2b2621'
}

let aktuell = start
theme.subscribe((m) => {
  aktuell = m
  try { localStorage.setItem(KEY, m) } catch {}
  if (typeof document !== 'undefined') anwenden(m)
})
media?.addEventListener?.('change', () => { if (aktuell === 'auto') anwenden('auto') })

// Wo zuletzt getippt wurde: von dort breitet sich das neue Farbschema als Kreis aus
let tippX = null, tippY = null
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => { tippX = e.clientX; tippY = e.clientY }, { capture: true, passive: true })
}

/** Farbschema wechseln. Wo der Browser View Transitions kann, wächst das neue Schema als
    Kreis aus dem Knopf heraus; sonst wechselt es sofort. */
export function setzeTheme(m) {
  const vorher = istDunkel(aktuell), nachher = istDunkel(m)
  const ruhig = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  if (vorher === nachher || ruhig || typeof document === 'undefined' || !document.startViewTransition || document.visibilityState !== 'visible') {
    theme.set(m); return
  }
  const html = document.documentElement
  const x = tippX ?? innerWidth / 2, y = tippY ?? innerHeight / 2
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  html.dataset.vt = 'theme'
  let vt
  try { vt = document.startViewTransition(() => theme.set(m)) } catch { delete html.dataset.vt; theme.set(m); return }
  vt.ready.then(() => {
    html.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 520, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', pseudoElement: '::view-transition-new(root)' })
  }).catch(() => {})
  const fertig = () => { delete html.dataset.vt }
  vt.finished.then(fertig, fertig)
}
