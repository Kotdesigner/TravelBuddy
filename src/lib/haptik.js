// Haptik — Progressive Enhancement, nie vorausgesetzt.
// Android: navigator.vibrate. iOS 17.4–26.4: Switch-Checkbox-Trick (Safari/PWA).
// iOS ≥ 26.5 / Desktop: stilles No-op.
let lbl = null

function iosTick() {
  try {
    if (!lbl) {
      const sw = document.createElement('input')
      sw.type = 'checkbox'
      sw.setAttribute('switch', '')
      lbl = document.createElement('label')
      lbl.appendChild(sw)
      lbl.setAttribute('aria-hidden', 'true')
      lbl.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none'
      document.body.appendChild(lbl)
    }
    lbl.click()
  } catch {}
}

/** Kurzer Tick — Auswahl, Toggle, Tab-Wechsel. */
export function haptic(pattern = 12) {
  try {
    if (navigator.vibrate) { navigator.vibrate(pattern); return }
    iosTick()
  } catch {}
}
/** Doppel-Tick — wichtige Erfolge (Backup gesichert, Check-in OK). */
haptic.confirm = () => haptic([12, 70, 12])
/** Dreifach-Tick — Fehler / Warnung. */
haptic.error = () => haptic([45, 80, 45, 80, 45])
