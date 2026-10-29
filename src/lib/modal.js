// Svelte-Aktion für eigene Dialoge und Blätter:  <div role="dialog" use:modal={{ onclose }}>
//
// Umsetzung von WCAG 2.4.3 (Fokusreihenfolge) und 2.1.2 (keine Tastaturfalle):
//   · Fokus springt hinein (erstes Feld/Knopf, sonst der Dialog selbst)
//   · Tab bleibt im Dialog, Escape schließt
//   · Rest der Seite ist `inert` (für Tastatur und VoiceOver gesperrt)
//   · beim Schließen kehrt der Fokus dorthin zurück, wo er vorher war
// Hintergrund-Flächen zum Wegtippen markiert man mit `data-dialog-hg` — die bleiben bedienbar.

const FOKUSSIERBAR = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function modal(node, optionen = {}) {
  let { onclose = null, fokus = null, zurueck = null } = optionen
  // Ein Hilfsfeld (nur da, damit das iPhone die Tastatur öffnet) ist kein Ort, an den der Fokus zurück soll.
  const vorher = document.activeElement?.hasAttribute?.('data-hilfsfeld') ? null : document.activeElement
  node.setAttribute('aria-modal', 'true')
  if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1')

  // Alles außerhalb sperren: auf jeder Ebene vom Dialog bis <body> die Geschwister.
  const gesperrt = []
  let el = node
  while (el && el.parentElement && el !== document.body) {
    for (const g of el.parentElement.children) {
      if (g === el || g.hasAttribute('inert') || g.hasAttribute('data-dialog-hg')) continue
      if (g.tagName === 'SCRIPT' || g.tagName === 'STYLE') continue
      if (g.closest('[aria-live]') || g.querySelector?.('[aria-live]')) continue   // Meldungen bleiben hörbar
      g.setAttribute('inert', '')
      gesperrt.push(g)
    }
    el = el.parentElement
  }

  const elemente = () => [...node.querySelectorAll(FOKUSSIERBAR)].filter((e) => e.offsetParent !== null || e === document.activeElement)
  // Nach dem Einblenden fokussieren (sonst verschluckt iOS den Fokus während der Animation).
  const t = setTimeout(() => {
    const ziel = (fokus && node.querySelector(fokus)) || elemente()[0] || node
    try { ziel.focus({ preventScroll: true }) } catch { ziel.focus() }
    // Fokus ist übergeben — Hilfsfelder jetzt weg, sonst landet ein schnelles Schließen darin
    // und die Tastatur geht noch einmal auf
    if (document.activeElement === ziel) document.querySelectorAll('[data-hilfsfeld]').forEach((e) => e.remove())
  }, 30)

  function taste(e) {
    if (e.key === 'Escape' && onclose) { e.stopPropagation(); e.preventDefault(); onclose(); return }
    if (e.key !== 'Tab') return
    const liste = elemente()
    if (!liste.length) { e.preventDefault(); node.focus(); return }
    const erst = liste[0], letzt = liste[liste.length - 1]
    if (e.shiftKey && (document.activeElement === erst || document.activeElement === node)) { e.preventDefault(); letzt.focus() }
    else if (!e.shiftKey && document.activeElement === letzt) { e.preventDefault(); erst.focus() }
  }
  node.addEventListener('keydown', taste)

  return {
    update(neu = {}) { onclose = neu.onclose ?? onclose; fokus = neu.fokus ?? fokus; zurueck = neu.zurueck ?? zurueck },
    destroy() {
      clearTimeout(t)
      node.removeEventListener('keydown', taste)
      for (const g of gesperrt) g.removeAttribute('inert')
      // (Safari am Mac fokussiert angeklickte Knöpfe nicht — dann war vorher nur <body>)
      if (vorher && vorher !== document.body && typeof vorher.focus === 'function' && document.contains(vorher)) {
        try { vorher.focus({ preventScroll: true }) } catch {}
      } else if (zurueck) {
        // Kein brauchbarer voriger Fokus (Hilfsfeld fürs iPhone, Klick in Safari, ⌘K) —
        // dann zum Öffner zurück, damit Tastatur/VoiceOver nicht im Nichts landen.
        const ziel = [...document.querySelectorAll(zurueck)].find((e) => e.getClientRects().length > 0 && !e.closest('[inert]'))
        try { ziel?.focus({ preventScroll: true }) } catch {}
      }
    },
  }
}
