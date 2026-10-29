// Fehlermeldungen verständlich machen. Browser melden Netzprobleme auf Englisch und je nach
// Gerät anders („Failed to fetch“ in Chrome, „Load failed“ in Safari, „NetworkError …“ in
// Firefox). Solche Rohmeldungen sollen nie unübersetzt in der Oberfläche landen.
import { t } from './i18n.js'
const NETZ = /failed to fetch|load failed|networkerror|network request failed|network error|err_internet|err_network/i

export function fehlerText(e, rueckfall = t('Das hat nicht geklappt.')) {
  const m = String(e?.message || e || '')
  if (e?.name === 'AbortError' || /timeout|timed out/i.test(m)) return t('Der Dienst hat zu lange gebraucht. Später noch einmal versuchen.')
  if (NETZ.test(m) || e?.name === 'TypeError' && /fetch/i.test(m)) {
    return typeof navigator !== 'undefined' && navigator.onLine === false
      ? t('Gerade offline. Das holt die App nach, sobald du wieder Netz hast.')
      : t('Der Dienst ist gerade nicht erreichbar. Später noch einmal versuchen.')
  }
  return m || rueckfall
}
