// Rechnet den Zug des Computers für „Vier in einer Reihe“ im Hintergrund (Web Worker), damit
// die Seite beim Nachdenken nicht stockt. Die Logik steht in vier.js.
import { berechneZug } from './vier.js'

self.onmessage = (e) => {
  const { nr, felder, opt } = e.data || {}
  try { self.postMessage({ nr, ...berechneZug(felder, opt) }) }
  catch (f) { self.postMessage({ nr, fehler: String(f?.message || f) }) }
}
