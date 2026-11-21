// Fehlermeldungen verständlich machen. Browser melden Netzprobleme auf Englisch und je nach
// Gerät anders („Failed to fetch“ in Chrome, „Load failed“ in Safari, „NetworkError …“ in
// Firefox). Solche Rohmeldungen sollen nie unübersetzt in der Oberfläche landen.
import { t } from './i18n.js'
const NETZ = /failed to fetch|load failed|networkerror|network request failed|network error|err_internet|err_network/i
// Grafik: Die Karte braucht WebGL. Fehlt es (altes Gerät, abgeschaltete Beschleunigung, manche
// Browser mit strengem Datenschutz), wirft die Kartenbibliothek einen technischen Brocken.
// Beim Prüfdurchgang zu V45 stand der als JSON mitten auf der Kartenseite.
const GRAFIK = /webgl|webgl2|gpu|graphics context|context lost|failifmajorperformancecaveat/i

export function fehlerText(e, rueckfall = t('Das hat nicht geklappt.')) {
  const m = String(e?.message || e || '')
  if (e?.name === 'AbortError' || /timeout|timed out/i.test(m)) return t('Der Dienst hat zu lange gebraucht. Später noch einmal versuchen.')
  if (NETZ.test(m) || e?.name === 'TypeError' && /fetch/i.test(m)) {
    return typeof navigator !== 'undefined' && navigator.onLine === false
      ? t('Gerade offline. Das holt die App nach, sobald du wieder Netz hast.')
      : t('Der Dienst ist gerade nicht erreichbar. Später noch einmal versuchen.')
  }
  if (GRAFIK.test(m)) return t('Die Karte braucht eine Grafikbeschleunigung, die dieses Gerät gerade nicht anbietet. Plan, Orte und Listen gehen weiter.')
  // Was wie Technik aussieht, gehört nicht auf den Bildschirm: JSON-Brocken, Stapelspuren,
  // ellenlange Meldungen. Die Einzelheiten stehen weiter in der Konsole.
  if (/^[[{<]/.test(m.trim()) || m.length > 160 || /\n\s+at /.test(m)) return rueckfall
  return m || rueckfall
}
