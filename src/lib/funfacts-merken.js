// Fun Facts merken: Ein gemerkter Fakt landet am Logbuch-Tag in der Liste „gelernt“. Er kommt damit ins
// Backup und ins Reisetagebuch („Heute gelernt“). Gibt es für den Tag noch keinen Eintrag, entsteht einer.

import { derived, get } from 'svelte/store'
import { journal, neuerJournalEintrag, updateJournalEintrag } from './userdata.js'
import { saubereGelernt, sichereQuelle } from './funfacts.js'

export function heuteIso(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const deckt = (e, datum) => e.datum === datum || (e.bis && e.datum <= datum && e.bis >= datum)

/** Merkt einen Fakt am Tag. Rückgabe: true, wenn neu gemerkt; false, wenn schon da. */
export function merkeFakt(f, datum = heuteIso()) {
  if (!f?.id || !f.text) return false
  let e = get(journal).find((x) => deckt(x, datum))
  const id = e ? e.id : neuerJournalEintrag({ datum, ort: f.ort || '' })
  e = get(journal).find((x) => x.id === id)
  const liste = saubereGelernt(e?.gelernt)
  if (liste.some((g) => g.id === f.id)) return false
  updateJournalEintrag(id, { gelernt: [...liste, { id: f.id, titel: f.titel || '', text: f.text, quelle: sichereQuelle(f.quelle), quelleName: f.quelleName || '', ts: new Date().toISOString() }] })
  return true
}

/** Alle gemerkten Fakten, neueste zuerst */
export const gemerkt = derived(journal, (js) =>
  js.flatMap((e) => saubereGelernt(e.gelernt).map((g) => ({ ...g, datum: e.datum, eintragId: e.id })))
    .sort((a, b) => (b.ts || '').localeCompare(a.ts || '')))

export const istGemerkt = (id) => get(gemerkt).some((g) => g.id === id)

export function vergiss(eintragId, faktId) {
  const e = get(journal).find((x) => x.id === eintragId)
  if (!e) return
  updateJournalEintrag(eintragId, { gelernt: saubereGelernt(e.gelernt).filter((g) => g.id !== faktId) })
}
