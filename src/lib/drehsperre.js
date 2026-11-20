// Am Telefon bleibt die App im Hochformat.
//
// Warum: Die Leisten, die Blätter und die Karte sind für eine hohe, schmale Fläche gebaut.
// Gekippt bliebe vom Inhalt ein Streifen, und die Unterpunkte hätten keinen Platz mehr.
//
// Zwei Wege, beide nötig:
//  1. Die INSTALLIERTE App kann die Ausrichtung wirklich sperren. screen.orientation.lock()
//     gibt es aber nur dort (Android/Chrome im Standalone-Modus), nicht im Browser-Tab
//     und auf iOS überhaupt nicht.
//  2. Alles, was Weg 1 nicht erreicht, fängt der Hinweis „Bitte hochhalten“ ab
//     (.dreh-hinweis in App.svelte, reines CSS).
//
// Tablets und Rechner bleiben ausdrücklich frei: dort ist quer die bessere Ansicht,
// die Leiste steht dann links. Deshalb sperrt auch das Manifest nichts — eine Sperre
// dort würde für jedes Gerät gelten, auch fürs iPad.

/** Telefon: Finger-Bedienung UND eine kurze Seite unter 500 px.
 *  Das höchste Telefon ist gekippt knapp 440 px hoch, das kleinste Tablet 600 px. */
function istTelefon() {
  try {
    if (typeof matchMedia === 'undefined' || !matchMedia('(pointer: coarse)').matches) return false
    const kurz = Math.min(screen?.width || 0, screen?.height || 0)
    return kurz > 0 && kurz <= 500
  } catch {
    return false
  }
}

export function drehsperre() {
  if (!istTelefon()) return
  try {
    const p = screen.orientation?.lock?.('portrait')
    if (p && typeof p.catch === 'function') p.catch(() => {})
  } catch {
    /* Browser-Tab und iOS können das nicht — dort greift der Hinweis */
  }
}
