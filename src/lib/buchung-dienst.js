// V14: Buchungen im Alltag. Verbindet vorhandene Ausgaben mit ihren Terminen und trägt
// schnelle Ausgaben in den Logbuch-Eintrag des Tages ein.
import { get } from 'svelte/store'
import { buchungen, vorabKosten, updateVorabKosten, reisen, gesamtStart, journal, neuerJournalEintrag, updateJournalEintrag } from './userdata.js'
import { etappenMitDatum, deckt, plusTage } from './plan.js'
import { buendle, verbindungsVorschlaege } from './buchung.js'
import { ausgabenVon, felderMitAusgaben, betragVon, verteileBetrag } from './kosten.js'

const eintraege = () => etappenMitDatum(get(reisen), get(gesamtStart))

/** Vorschläge für Ausgaben ohne Buchung (sichere und unsichere). */
export const vorschlaegeJetzt = () => verbindungsVorschlaege(get(vorabKosten), buendle(get(buchungen)?.events || []), eintraege())

/** Sichere Zuordnungen übernehmen. Die Etappe kommt dabei aus dem Datum der Buchung, falls noch keine gesetzt ist. */
export function verbindeSichere() {
  const v = vorschlaegeJetzt().filter((x) => x.sicher)
  const kosten = get(vorabKosten)
  for (const x of v) {
    const k = kosten.find((y) => y.id === x.kostenId)
    updateVorabKosten(x.kostenId, { terminId: x.terminId, ...(k?.reiseId || !x.etappe ? {} : { reiseId: x.etappe }) })
  }
  return v.length
}

/** Eine Ausgabe heute: landet im Logbuch-Eintrag des Tages, der notfalls angelegt wird. Gibt die Eintrags-ID zurück. */
export function schnellAusgabe(datum, { kat, betrag, text = '', gruppe = '' }, etappeId = null) {
  let e = get(journal).find((j) => deckt(j, datum))
  if (!e) {
    const id = neuerJournalEintrag({ datum, ...(etappeId ? { etappeId } : {}) })
    e = get(journal).find((j) => j.id === id)
    if (etappeId && e && !e.etappeId) updateJournalEintrag(id, { etappeId })
    e = get(journal).find((j) => j.id === id)
  }
  if (!e) return null
  const neu = [...ausgabenVon(e), { id: Math.random().toString(36).slice(2, 10), kat, betrag: betragVon(betrag), text: String(text || '').trim(), ...(gruppe ? { gruppe } : {}) }]
  updateJournalEintrag(e.id, { ausgaben: neu, felder: felderMitAusgaben(e.felder, neu) })
  return e.id
}

/**
 * V17: Ein Betrag für einen Zeitraum (z. B. Lebensmittel für die Woche), gleichmäßig auf die Tage verteilt.
 * Jeder Tag bekommt seinen Anteil im Logbuch, so stimmen Schnitt pro Tag und Etappe. Die Teile tragen
 * dieselbe `gruppe`. etappeFuer(datum) liefert die Etappe des Tages. Gibt die Zahl der Tage zurück.
 */
export function ausgabeZeitraum(von, bis, { kat, betrag, text = '' }, etappeFuer = () => null) {
  const tage = []
  for (let d = von; d <= bis && tage.length < 366; d = plusTage(d, 1)) tage.push(d)
  const teile = verteileBetrag(betrag, tage.length)
  if (!teile.length) return 0
  const gruppe = Math.random().toString(36).slice(2, 10)
  tage.forEach((d, i) => { if (teile[i] > 0) schnellAusgabe(d, { kat, betrag: teile[i], text, gruppe }, etappeFuer(d)) })
  return tage.length
}

/** Zuletzt benutzte Kategorien, neueste zuerst. */
export function letzteKategorien(js = get(journal), n = 6) {
  const out = []
  for (const e of [...js].sort((a, b) => (b.datum || '').localeCompare(a.datum || ''))) {
    for (const a of [...ausgabenVon(e)].reverse()) if (!out.includes(a.kat)) out.push(a.kat)
    if (out.length >= n) break
  }
  return out.slice(0, n)
}

/** Termin-ID → { buchung, kosten }: damit jede Ansicht zu einem Termin Nummer, Kosten und alle Belege der Buchung findet. */
import { derived } from 'svelte/store'
export const buchungsIndex = derived([buchungen, vorabKosten], ([b, vk]) => {
  const m = new Map()
  for (const bu of buendle(b?.events || [])) {
    const kosten = (vk || []).filter((k) => k.terminId && bu.ids.includes(k.terminId))
    for (const id of bu.ids) m.set(id, { buchung: bu, kosten })
  }
  return m
})
