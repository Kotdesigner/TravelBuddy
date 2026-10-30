// Kleine Formatierer für Datumstexte ('YYYY-MM-DD' rein, Text in der Sprache der App raus).
// Deutsch: „30. Nov“, „Sa, 1. Mai“. Englisch (australisch): „30 Nov“, „Sat, 1 May“.
import { LOCALE, istEn, tn, jeSprache, beiSprache } from './i18n.js'
const MONATE = jeSprache(() => (istEn
  ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  : ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']))
const TAGE = jeSprache(() => (istEn ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']))
const TAGE_LANG = jeSprache(() => (istEn
  ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  : ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']))
const d = (s) => new Date(s + 'T12:00:00')
const tagZahl = (n) => (istEn ? `${n}` : `${n}.`)
// Für toLocaleString: Englisch ohne führende Null („1 May“, „5:38 am“), Deutsch wie gehabt („01. Mai“, „05:38“).
export let ZWEI
beiSprache(() => { ZWEI = istEn ? 'numeric' : '2-digit' })

export const tagMonat = (s) => { if (!s) return ''; const x = d(s); return `${tagZahl(x.getDate())} ${MONATE[x.getMonth()]}` }
export const tagMonatJahr = (s) => { if (!s) return ''; const x = d(s); return `${tagZahl(x.getDate())} ${MONATE[x.getMonth()]} ${x.getFullYear()}` }
export const wochentag = (s) => (s ? TAGE[d(s).getDay()] : '')
export const wochentagLang = (s) => (s ? TAGE_LANG[d(s).getDay()] : '')
export const mitWochentag = (s) => (s ? `${wochentag(s)}, ${tagMonat(s)}` : '')

/** „30. Nov – 3. Dez", gleicher Monat: „4.–7. Dez", ein Tag: „29. Nov" (englisch „4–7 Dec“) */
export function bereich(von, bis) {
  if (!von) return ''
  if (!bis || bis === von) return tagMonat(von)
  const a = d(von), b = d(bis)
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return `${tagZahl(a.getDate())}–${tagZahl(b.getDate())} ${MONATE[b.getMonth()]}`
  return `${tagMonat(von)} – ${tagMonat(bis)}`
}
export const tageText = (n) => tn(n, '{n} Tag', '{n} Tage')
export const zahl = (n) => Math.round(Number(n) || 0).toLocaleString(LOCALE)
/** Beträge gerundet: Deutsch „1.234 €“, „1.234 AU$“; Englisch „€1,234“, „AU$1,234“ */
export const eur = (n) => (istEn ? '€' + zahl(n) : zahl(n) + ' €')
export const aud = (n) => (istEn ? 'AU$' + zahl(n) : zahl(n) + ' AU$')
/** Dezimalzahl als Text: Deutsch mit Komma, Englisch mit Punkt (dezimal(2.5) → „2,5“ / „2.5“) */
export const dezimal = (n, stellen) => {
  const s = stellen == null ? String(n) : Number(n).toFixed(stellen)
  return istEn ? s : s.replace('.', ',')
}
/** Kurzer Tag mit Wochentag: „Sa 1.5.“ / „Sat 1/5“ */
export const kurzTag = (s) => { if (!s) return ''; const x = d(s); return istEn ? `${TAGE[x.getDay()]} ${x.getDate()}/${x.getMonth() + 1}` : `${TAGE[x.getDay()]} ${x.getDate()}.${x.getMonth() + 1}.` }
/** Zeitstempel kurz: „01.05. 14:30“ / „01/05, 14:30“ */
export const kurzZeit = (iso) => { try { return new Date(iso).toLocaleString(LOCALE, { day: '2-digit', month: '2-digit', hour: ZWEI, minute: '2-digit' }) } catch { return '' } }
