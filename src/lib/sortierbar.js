// Liste per Ziehen umsortieren (V4) — für Stopps einer Route.
//
//   <ol use:sortierbar={{ onbewege: (von, nach) => … }}>
//     <li data-zeile> … <button data-griff aria-label="Verschieben">≡</button> … </li>
//
// Ziehen am Griff (Finger oder Maus); Tastatur: Griff fokussieren, Pfeil hoch/runter.
// Statt der zwei Knöpfe ↑ ↓ je Zeile ein Griff — weniger Ziele, und ein Stopp wandert
// mit einer Bewegung von Platz 9 auf Platz 2 statt mit sieben Tipps.
import { haptic } from './haptik.js'

export function sortierbar(node, optionen = {}) {
  let { onbewege = () => {} } = optionen
  let zug = null   // { zeile, start, index, hoehen, mitten, ziel, id }

  const zeilen = () => [...node.querySelectorAll(':scope > [data-zeile]')]

  function runter(e) {
    const griff = e.target.closest('[data-griff]')
    if (!griff || !node.contains(griff) || e.button > 0) return
    const zeile = griff.closest('[data-zeile]')
    const alle = zeilen()
    const index = alle.indexOf(zeile)
    if (index < 0) return
    e.preventDefault()
    const rects = alle.map((z) => z.getBoundingClientRect())
    zug = { zeile, start: e.clientY, index, ziel: index, rects, id: e.pointerId, griff }
    try { griff.setPointerCapture(e.pointerId) } catch {}
    zeile.classList.add('wird-gezogen')
    node.classList.add('beim-ziehen')
    haptic()
  }
  function bewegen(e) {
    if (!zug || e.pointerId !== zug.id) return
    e.preventDefault()
    const dy = e.clientY - zug.start
    zug.zeile.style.transform = `translateY(${dy}px)`
    const mitte = zug.rects[zug.index].top + zug.rects[zug.index].height / 2 + dy
    let ziel = zug.index
    zug.rects.forEach((r, i) => {
      if (i < zug.index && mitte < r.top + r.height / 2) ziel = Math.min(ziel, i)
      if (i > zug.index && mitte > r.top + r.height / 2) ziel = Math.max(ziel, i)
    })
    if (ziel !== zug.ziel) { zug.ziel = ziel; haptic(6) }
    const h = zug.rects[zug.index].height + 4
    zeilen().forEach((z, i) => {
      if (z === zug.zeile) return
      let v = 0
      if (zug.index < ziel && i > zug.index && i <= ziel) v = -h
      if (zug.index > ziel && i < zug.index && i >= ziel) v = h
      z.style.transform = v ? `translateY(${v}px)` : ''
    })
  }
  function hoch(e) {
    if (!zug || e.pointerId !== zug.id) return
    const { index, ziel } = zug
    zeilen().forEach((z) => { z.style.transform = '' })
    zug.zeile.classList.remove('wird-gezogen')
    node.classList.remove('beim-ziehen')
    zug = null
    if (ziel !== index) onbewege(index, ziel)
  }
  function taste(e) {
    const griff = e.target.closest('[data-griff]')
    if (!griff || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
    const alle = zeilen()
    const i = alle.indexOf(griff.closest('[data-zeile]'))
    const j = i + (e.key === 'ArrowUp' ? -1 : 1)
    if (i < 0 || j < 0 || j >= alle.length) return
    e.preventDefault()
    onbewege(i, j)
    // Fokus folgt dem Stopp an seinen neuen Platz
    requestAnimationFrame(() => zeilen()[j]?.querySelector('[data-griff]')?.focus())
  }

  node.addEventListener('pointerdown', runter)
  node.addEventListener('pointermove', bewegen)
  node.addEventListener('pointerup', hoch)
  node.addEventListener('pointercancel', hoch)
  node.addEventListener('keydown', taste)
  return {
    update(neu = {}) { onbewege = neu.onbewege ?? onbewege },
    destroy() {
      node.removeEventListener('pointerdown', runter)
      node.removeEventListener('pointermove', bewegen)
      node.removeEventListener('pointerup', hoch)
      node.removeEventListener('pointercancel', hoch)
      node.removeEventListener('keydown', taste)
    },
  }
}

/** Element von Position a nach b verschieben (neue Liste). */
export function verschiebe(liste, a, b) {
  const l = [...liste]
  const [x] = l.splice(a, 1)
  l.splice(b, 0, x)
  return l
}
