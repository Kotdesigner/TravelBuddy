// Stammdaten für Wanderungen: Schwierigkeit, Wegart, Status.
import { t } from './i18n.js'

export const SCHWIERIGKEIT = [
  { id: 'leicht', label: t('Leicht'), emoji: '🟢' },
  { id: 'mittel', label: t('Mittel'), emoji: '🟡' },
  { id: 'schwer', label: t('Schwer'), emoji: '🟠' },
  { id: 'sehr-schwer', label: t('Sehr schwer'), emoji: '🔴' },
]

export const WEGART = [
  { id: 'rundweg', label: t('Rundweg'), emoji: '🔄' },
  { id: 'hin-zurueck', label: t('Hin & zurück'), emoji: '↔️' },
  { id: 'strecke', label: t('Strecke'), emoji: '➡️' },
]

export const WANDER_STATUS = [
  { id: 'wunsch', label: t('Wunschliste'), emoji: '⭐' },
  { id: 'geplant', label: t('Geplant'), emoji: '📌' },
  { id: 'gemacht', label: t('Gemacht'), emoji: '✅' },
]

export const S_MAP = Object.fromEntries(SCHWIERIGKEIT.map((s) => [s.id, s]))
export const ART_MAP = Object.fromEntries(WEGART.map((s) => [s.id, s]))
export const STATUS_MAP = Object.fromEntries(WANDER_STATUS.map((s) => [s.id, s]))

// Minuten -> "3 h 20 min"
export function dauerText(min) {
  const n = Number(min)
  if (!n || n <= 0) return ''
  const h = Math.floor(n / 60), m = n % 60
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`
}
