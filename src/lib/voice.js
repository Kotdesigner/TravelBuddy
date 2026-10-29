// Sprache-zu-Text über die Web Speech API (nur wo der Browser es unterstützt, online).
import { LOCALE, t } from './i18n.js'
export function spracheVerfuegbar() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export function diktiere({ onText, onEnde, onFehler } = {}) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) { onFehler?.(t('nicht unterstützt')); return null }
  const rec = new SR()
  rec.lang = LOCALE
  rec.interimResults = false
  rec.continuous = false
  rec.onresult = (e) => {
    const t = Array.from(e.results).map((r) => r[0].transcript).join(' ').trim()
    onText?.(t)
  }
  rec.onerror = (e) => onFehler?.(e.error || t('Fehler'))
  rec.onend = () => onEnde?.()
  try { rec.start() } catch { onFehler?.(t('Start fehlgeschlagen')) }
  return rec
}
