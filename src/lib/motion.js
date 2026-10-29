// Motion-Werkzeuge (New Style Phase 4). Ref: UX-Recherche/04.
// Beide respektieren prefers-reduced-motion (dann: sofort Endzustand).
import { LOCALE } from './i18n.js'

const reduziert = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** use:zaehlHoch={{ wert }} — Zahl zählt beim ersten Sichtbarwerden hoch (einmalig).
    Formatiert de-DE; bei reduce oder Wert-Updates: direkt final. */
export function zaehlHoch(node, { wert = 0, dauer = 650 } = {}) {
  let ziel = Math.round(wert)
  let gelaufen = false
  const fmt = (n) => n.toLocaleString(LOCALE)
  node.textContent = fmt(ziel)

  function lauf() {
    if (gelaufen) return
    gelaufen = true
    // Kein Spektakel nötig/möglich? → sofort Endwert (auch bei verstecktem Tab,
    // dort drosselt der Browser requestAnimationFrame).
    if (reduziert() || ziel <= 0 || document.hidden) { node.textContent = fmt(ziel); return }
    const start = performance.now()
    let fertig = false
    const tick = (t) => {
      if (fertig) return
      const p = Math.min(1, (t - start) / dauer)
      node.textContent = fmt(Math.round(ziel * (1 - Math.pow(1 - p, 3))))
      if (p < 1) requestAnimationFrame(tick)
      else fertig = true
    }
    requestAnimationFrame(tick)
    // Garantie: Endwert steht spätestens nach dauer+250ms — egal was rAF macht.
    setTimeout(() => { fertig = true; node.textContent = fmt(ziel) }, dauer + 250)
  }

  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) { lauf(); io.disconnect() }
  }, { threshold: 0.4 })
  io.observe(node)

  return {
    update(p) { ziel = Math.round(p?.wert ?? 0); node.textContent = fmt(ziel) },
    destroy() { io.disconnect() },
  }
}

/** use:erscheine — Block gleitet beim ersten Sichtbarwerden sanft ein (einmalig). */
export function erscheine(node, { dauer = 240, y = 10 } = {}) {
  if (reduziert()) return {}
  node.style.opacity = '0'
  node.style.transform = `translateY(${y}px)`
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) {
      node.style.transition = `opacity ${dauer}ms ease-out, transform ${dauer}ms ease-out`
      node.style.opacity = '1'
      node.style.transform = 'translateY(0)'
      // Danach alle Inline-Stile wieder abräumen. Wichtig: ein stehengebliebenes
      // `transform` macht den Block zum Bezugsrahmen — `position: fixed` darin
      // würde sich sonst am Block statt am Fenster ausrichten (Vollbild ginge kaputt).
      setTimeout(() => {
        node.style.transition = ''
        node.style.willChange = ''
        node.style.transform = ''
        node.style.opacity = ''
      }, dauer + 60)
      io.disconnect()
    }
  }, { threshold: 0.12 })
  io.observe(node)
  return { destroy() { io.disconnect() } }
}

/** use:leisteRand={schluessel} — für waagrecht wischbare Leisten (Reiter oben am iPhone).
    Setzt `mehr-links` / `mehr-rechts`, solange dort noch etwas verborgen ist (die Leiste
    blendet dann weich aus), und holt den aktiven Reiter ins Bild. */
export function leisteRand(node) {
  const pruef = () => {
    node.classList.toggle('mehr-links', node.scrollLeft > 4)
    node.classList.toggle('mehr-rechts', node.scrollLeft + node.clientWidth < node.scrollWidth - 4)
  }
  const zeigAktiv = () => {
    const a = node.querySelector('[aria-current="page"]')
    if (a) {
      const nr = node.getBoundingClientRect(), ar = a.getBoundingClientRect()
      if (ar.right > nr.right - 36 || ar.left < nr.left + 4) {
        node.scrollTo({ left: node.scrollLeft + ar.left - nr.left - 14, behavior: reduziert() ? 'auto' : 'smooth' })
      }
    }
    pruef()
  }
  node.addEventListener('scroll', pruef, { passive: true })
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(pruef) : null
  ro?.observe(node)
  requestAnimationFrame(zeigAktiv)
  return {
    update() { requestAnimationFrame(zeigAktiv) },
    destroy() { node.removeEventListener('scroll', pruef); ro?.disconnect() },
  }
}

/** Dauer für Svelte-Übergänge: 0 bei „Bewegung reduzieren“. Svelte spielt Übergänge
    selbst ab, die CSS-Regel für reduzierte Bewegung greift dort nicht. */
export const dauer = (ms) => (reduziert() ? 0 : ms)

/** Bildschirmwechsel: der Inhalt gleitet kurz herein. `richtung` 1 = tiefer hinein
    (von rechts), -1 = zurück (von links), 0 = anderer Bereich (leicht von unten). */
export function wechsel(node, richtung = 0) {
  if (reduziert() || !node?.animate) return
  const von = richtung > 0 ? 'translateX(14px)' : richtung < 0 ? 'translateX(-14px)' : 'translateY(8px)'
  node.animate([{ opacity: 0, transform: von }, { opacity: 1, transform: 'none' }],
    { duration: richtung ? 240 : 220, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' })
}

/** Bildschirmwechsel über die View Transitions API. Gibt false zurück, wenn der Browser sie
    nicht kann; dann übernimmt `wechsel`.
    Der Name `haupt` hängt nur während des Wechsels am Inhalt: dauerhaft gesetzt würde er
    einen eigenen Stapelkontext bilden, und Blätter im Inhalt lägen dann unter der Leiste. */
let laeuftWechsel = null
export function bildwechsel(node, richtung, aendern) {
  // Bei reduzierter Bewegung läuft der Wechsel trotzdem, die CSS macht daraus eine kurze Überblendung
  if (!node || typeof document === 'undefined' || !document.startViewTransition) return false
  if (document.visibilityState !== 'visible') return false
  try { laeuftWechsel?.skipTransition() } catch {}
  const html = document.documentElement
  html.dataset.richtung = richtung > 0 ? 'vor' : richtung < 0 ? 'zurueck' : 'neu'
  node.style.viewTransitionName = 'haupt'
  let vt
  try { vt = document.startViewTransition(aendern) } catch { node.style.viewTransitionName = ''; return false }
  laeuftWechsel = vt
  const aufraeumen = () => {
    if (laeuftWechsel !== vt) return   // ein neuerer Wechsel läuft schon
    laeuftWechsel = null
    delete html.dataset.richtung
    node.style.viewTransitionName = ''
  }
  vt.finished.then(aufraeumen, aufraeumen)
  vt.ready?.catch(() => {})
  vt.updateCallbackDone?.catch(() => {})
  return true
}

/** Aufklappen für Svelte (`transition:klapp`). Kurze Inhalte klappen wie `slide`. Lange
    Listen (Logbuch-Tage, Etappen) würden dabei jedes Bild neu umbrechen; sie blenden
    stattdessen nur weich ein und aus, das läuft komplett auf der Grafikkarte. */
export function klapp(node, { duration = 240 } = {}) {
  if (reduziert() || !duration) return { duration: 0 }
  const h = node.offsetHeight
  const sanft = (t) => 1 - Math.pow(1 - t, 3)
  if (h > 360) {
    return { duration: Math.min(duration, 200), easing: sanft, css: (t) => `opacity:${t};transform:translateY(${(1 - t) * -8}px)` }
  }
  const st = getComputedStyle(node)
  const werte = ['paddingTop', 'paddingBottom', 'marginTop', 'marginBottom', 'borderTopWidth', 'borderBottomWidth'].map((k) => parseFloat(st[k]) || 0)
  return {
    duration, easing: sanft,
    css: (t) => `overflow:hidden;opacity:${Math.min(1, t * 1.6)};height:${t * h}px;` +
      `padding-top:${t * werte[0]}px;padding-bottom:${t * werte[1]}px;margin-top:${t * werte[2]}px;margin-bottom:${t * werte[3]}px;` +
      `border-top-width:${t * werte[4]}px;border-bottom-width:${t * werte[5]}px;`,
  }
}

/** Ausgang für Blätter von unten (`out:blattRaus`): schneller als der Eingang, gleicher Weg.
    Ist das Blatt mittig (Mac), blendet es stattdessen leicht kleiner werdend aus. */
export function blattRaus(node, { duration = 220 } = {}) {
  if (reduziert()) return { duration: 120, css: (t) => `opacity:${t}` }
  const st = getComputedStyle(node).transform
  const basis = st && st !== 'none' ? st + ' ' : ''
  const unten = node.getBoundingClientRect().bottom >= innerHeight - 40
  if (!unten) return { duration: 160, css: (t, u) => `opacity:${t};transform:${basis}scale(${1 - 0.03 * u})` }
  return { duration, easing: (t) => t * t, css: (t, u) => `transform:${basis}translateY(${u * 100}%)` }
}
/** Ausgang für Abdunkelungen und kleine Dialoge (`out:ausblenden`). */
export function ausblenden(node, { duration = 160, skala = 1 } = {}) {
  if (reduziert()) return { duration: 100, css: (t) => `opacity:${t}` }
  const st = getComputedStyle(node).transform
  const basis = st && st !== 'none' ? st + ' ' : ''
  return { duration, css: (t, u) => `opacity:${t}` + (skala !== 1 ? `;transform:${basis}scale(${1 - (1 - skala) * u})` : '') }
}

/* Signaturmoment: Die angetippte Etappe wird beim Öffnen zum Kopf der Detailseite (und beim
   Zurückgehen wieder zur Zeile). Der Name hängt nur an genau einem Element je Seite. */
let morphZiel = null
export const morphName = 'etappe-kopf'
export function merkeMorph(id, node) {
  morphZiel = id
  if (typeof document === 'undefined') return
  for (const el of document.querySelectorAll('[data-morph]')) el.style.viewTransitionName = ''
  if (node) node.style.viewTransitionName = morphName
}
export const istMorph = (id) => id != null && id === morphZiel
