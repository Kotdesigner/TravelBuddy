// Kategorien für die Notizen (auch im Tagebuch verwendet)
import { t, jeSprache } from './i18n.js'
export const NOTIZ_TYPEN = jeSprache(() => ([
  { id: 'notiz', label: t('Notizen'), icon: '📝' },
  { id: 'einkaufen', label: t('Einkaufen'), icon: '🛒' },
  { id: 'routentips', label: t('Routentips'), icon: '🧭' },
  { id: 'orga', label: t('Orga'), icon: '🗂️' },
  { id: 'kontakte', label: t('Kontakte'), icon: '📇' },
]))
export const NOTIZ_TYP = jeSprache(() => Object.fromEntries(NOTIZ_TYPEN.map((t) => [t.id, t])))
