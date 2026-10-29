// Schlüssel, die nicht als t('…') im Code stehen, sondern aus Daten kommen und erst bei der
// Anzeige übersetzt werden: Regionen und Abschnitte der Orte, Kennzeichen, Auswahlwerte im
// Logbuch, Dokumentarten. Ihre Werte bleiben gespeichert auf Deutsch, damit Daten in beiden
// Sprachen gültig sind.
import fs from 'node:fs'
import { MODULE } from '../../src/lib/journal-schema.js'
import { DOKUMENT_TYPEN } from '../../src/lib/vorbereitung-daten.js'

export function zusatzSchluessel() {
  const s = new Set(['MUSS-SEHEN', 'GEHEIMTIPP', 'NUR-4WD', 'EXPEDITION', 'MEIN ORT', 'Meine Orte', 'Weitere Orte', 'Buchung', 'Wanderung', 'Logbuch'])
  for (const o of JSON.parse(fs.readFileSync('public/orte.json', 'utf8'))) { s.add(o.region); s.add(o.abschnitt) }
  for (const m of MODULE) for (const f of m.felder) for (const o of f.optionen || []) s.add(typeof o === 'string' ? o : o.label)
  for (const d of DOKUMENT_TYPEN) s.add(d)
  return [...s].filter((x) => x && /[A-Za-zÄÖÜäöüß]{2}/.test(x))
}
