// Flug oder Zug speichern: alles wird ein normaler Termin in `buchungen`. Damit taucht die Fahrt von
// selbst in Kalender, Heute und unter Flüge & Bahn auf und wird dort abgefragt.
import { get } from 'svelte/store'
import { t } from './i18n.js'
import { buchungen, buchungenEinfuegen, aendereTermin, belegeAnhaengen } from './userdata.js'
import { eigenerPfad, speichereBeleg, belegLabel, lokaleBelege, ladeBelegListe } from './belege.js'
import { normalNummer, normalZug } from './flug.js'

const neueId = () => 'eb-' + Math.random().toString(36).slice(2, 10)

export const leereAngaben = (vorlage = {}) => ({ nr: '', bahnhof: '', datum: '', zeit: '', ref: '', sitz: '', ...vorlage })

/** Die Angaben eines vorhandenen Termins für das Formular. */
export const angabenAus = (e) => e ? leereAngaben({
  nr: e.flugNr || e.zugNr || '', bahnhof: e.bahnhof || '', datum: e.datum || '', zeit: e.zeit || e.zeitVon || '', ref: e.ref || '', sitz: e.sitz || '',
}) : leereAngaben()

function untertitel(art, f, nr) {
  const zeit = f.zeit ? (art === 'flug' ? t('Abflug {zeit}', { zeit: f.zeit }) : t('Abfahrt {zeit}', { zeit: f.zeit })) : ''
  return [nr, zeit, f.sitz].filter(Boolean).join(' · ')
}

/** Legt einen Termin an oder ergänzt `id`, hängt den Beleg an und gibt die Termin-ID zurück. */
export async function speichereVerkehr(art, f, { id = null, titel = '', datei = null } = {}) {
  const nr = art === 'flug' ? normalNummer(f.nr) : normalZug(f.nr)
  const felder = { datum: f.datum, zeit: f.zeit || '', ref: String(f.ref || '').trim(), sitz: String(f.sitz || '').trim() }
  if (art === 'flug') felder.flugNr = nr
  else { felder.zugNr = nr; felder.bahnhof = String(f.bahnhof || '').trim() }
  const vorhanden = id && (get(buchungen)?.events || []).some((e) => e.id === id)
  if (vorhanden) aendereTermin(id, felder)
  else {
    id = neueId()
    buchungenEinfuegen([{ ...felder, id, kat: art === 'flug' ? 'flight' : 'train', emoji: art === 'flug' ? '✈️' : '🚆',
      titel: titel || (art === 'flug' ? t('Flug {nr}', { nr }) : t('Zug {nr}', { nr })), sub: untertitel(art, f, nr) }])
  }
  if (datei) {
    await ladeBelegListe()
    const pfad = eigenerPfad(id, datei.name, get(lokaleBelege))
    await speichereBeleg(pfad, datei)
    belegeAnhaengen([{ ziel: id, label: belegLabel(datei.name), datei: pfad }])
  }
  return id
}
