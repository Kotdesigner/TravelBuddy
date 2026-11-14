// Flug oder Zug speichern: alles wird ein normaler Termin in `buchungen`. Damit taucht die Fahrt von
// selbst in Kalender, Heute und unter Flüge & Bahn auf und wird dort abgefragt.
import { get } from 'svelte/store'
import { t } from './i18n.js'
import { buchungen, buchungenEinfuegen, aendereTermin, belegeAnhaengen } from './userdata.js'
import { eigenerPfad, speichereBeleg, belegLabel, lokaleBelege, ladeBelegListe } from './belege.js'
import { normalNummer, normalZug, flugNummern, nummernImText, zugnummernImText, abflugzeitImText } from './flug.js'

const neueId = () => 'eb-' + Math.random().toString(36).slice(2, 10)

export const leereAngaben = (vorlage = {}) => ({ nr: '', bahnhof: '', datum: '', zeit: '', ref: '', sitz: '', ...vorlage })

/** Die Angaben eines vorhandenen Termins für das Formular. */
export const angabenAus = (e) => e ? leereAngaben({
  // Auch eine Nummer, die nur im Titel steht („Flug EK 421“), füllt das Feld vor.
  nr: e.kat === 'train' ? (e.zugNr || '') : (flugNummern(e)[0] || e.flugNr || ''), bahnhof: e.bahnhof || '', datum: e.datum || '',
  // Die Zeit steht bei Kalender-Buchungen oft nur im Untertitel („· Abflug 13:55“). Ohne diesen
  // Rückfall stünde das Feld leer da, und ein Speichern ohne Anfassen würde die Uhrzeit löschen.
  zeit: e.zeit || e.zeitVon || abflugzeitImText(e.sub) || '', ref: e.ref || '', sitz: e.sitz || '',
}) : leereAngaben()

function untertitel(art, f, nr) {
  const zeit = f.zeit ? (art === 'flug' ? t('Abflug {zeit}', { zeit: f.zeit }) : t('Abfahrt {zeit}', { zeit: f.zeit })) : ''
  return [nr, zeit, f.sitz].filter(Boolean).join(' · ')
}

// Im Untertitel steht dieselbe Angabe nochmal als Text („Qatar Airways QR901 · Abflug 22:45“), und
// genau daraus lesen Kalender, Heute, Wechselzeit und die Nächte. Wird oben eine Nummer oder eine
// Zeit berichtigt, muss der Text also mitziehen. Sonst steht überall weiter der alte Wert, und es
// sieht aus, als wäre beim Ergänzen nichts übernommen worden.
const ABFAHRT_ZEIT = /(?:Abflug|Abfahrt|Departure|Departs|Dep\.?)\D{0,3}(\d{1,2}:\d{2})|(\d{1,2}:\d{2})\s*(?:→|->|–|-)\s*\d{1,2}:\d{2}/i
/** Davor steht eine Ankunftszeit. Die wird nie für eine Abfahrt gehalten. */
const ANKUNFT_DAVOR = /(?:Ankunft|Ankommt|Arrival|Arrives|Arr\.?|Landung|landet|lands|bis|until|→|->|–|-)\s*$/i
/** Alle Uhrzeiten im Text, mit Stelle und der Frage, ob eine Ankunft gemeint ist. */
const zeitStellen = (s) => [...String(s || '').matchAll(/\d{1,2}:\d{2}/g)]
  .map((m) => ({ i: m.index, wert: m[0], ankunft: ANKUNFT_DAVOR.test(String(s).slice(0, m.index)) }))
/**
 * Eine Abfahrtszeit ohne Wort davor finden, wie sie viele Untertitel tragen
 * („Beispiel Air ZZ471 · 21:35 · 7C“). Getroffen wird nur genau die Zeit, die bisher im Feld
 * stand, nie eine Ankunftszeit. Steht dort etwas anderes, bleibt der Text lieber unangetastet.
 */
const zeitOhneWort = (sub, alteZeit) => (/^\d{1,2}:\d{2}$/.test(alteZeit || '')
  ? zeitStellen(sub).find((z) => z.wert === alteZeit && !z.ankunft) || null
  : null)
/** Trennzeichen aufräumen, wenn mitten im Text etwas weggefallen ist. */
const aufgeraeumt = (s) => String(s || '').replace(/\s{2,}/g, ' ').replace(/(\s*·\s*){2,}/g, ' · ').replace(/^[\s·]+|[\s·]+$/g, '')
/** Nummer im Text treffen, auch als „QR 901“, „QR-0901“ oder „ICE 75“. */
const nummerMuster = (nr) => {
  const m = String(nr).match(/^(.*[A-Za-z])(\d+)$/)
  return new RegExp((m ? `${m[1]}[ -]?0*${m[2]}` : String(nr)) + '(?!\\d)', 'i')
}

/**
 * Untertitel und Titel nachziehen. Ersetzt nur die berichtigte Nummer und die Abfahrtszeit.
 * Airline, Ankunftszeit, Terminal und alles andere bleiben unangetastet, eine Ankunftszeit wird
 * nie als Abfahrt verstanden.
 * @returns Teil-Patch mit `sub` und `titel`, nur wenn sich wirklich etwas ändert.
 */
export function textNachziehen(alt = {}, art = 'flug', f = {}, nr = '') {
  const raus = {}
  let sub = String(alt.sub || '')
  const nrAlt = art === 'flug' ? (flugNummern(alt)[0] || '') : normalZug(alt.zugNr || '')
  if (nr && nrAlt && nr !== nrAlt) {
    const muster = nummerMuster(nrAlt)
    if (muster.test(sub)) sub = sub.replace(muster, nr)
    const titel = String(alt.titel || '')
    if (muster.test(titel)) raus.titel = titel.replace(muster, nr)
  } else if (nr && !nrAlt && !(art === 'flug' ? nummernImText : zugnummernImText)(`${sub} ${alt.titel || ''}`).length) {
    sub = [sub, nr].filter(Boolean).join(' · ')
  } else if (!nr && nrAlt && (art !== 'flug' || flugNummern(alt).length === 1)) {
    // Nummer bewusst entfernt: sie darf auch im Text nicht stehen bleiben, sonst holt sie der
    // Heiler in flugNummern() gleich wieder zurück. Bei mehreren Nummern bleibt der Text, wie er
    // ist: welche gemeint war, ist dann nicht zu erkennen.
    sub = aufgeraeumt(sub.replace(nummerMuster(nrAlt), ''))
  }
  const zeit = String(f.zeit || '').trim()
  const m = sub.match(ABFAHRT_ZEIT)
  const altZeit = m && (m[1] || m[2])
  const ohneWort = altZeit ? null : zeitOhneWort(sub, String(alt.zeit || alt.zeitVon || '').trim())
  const ersetze = (i, lang) => { sub = sub.slice(0, i) + zeit + sub.slice(i + lang) }
  if (zeit) {
    if (altZeit && altZeit !== zeit) ersetze(m.index + m[0].indexOf(altZeit), altZeit.length)
    else if (ohneWort && ohneWort.wert !== zeit) ersetze(ohneWort.i, ohneWort.wert.length)
    else if (!altZeit && !ohneWort && !zeitStellen(sub).some((z) => !z.ankunft)) {
      sub = [sub, art === 'flug' ? t('Abflug {zeit}', { zeit }) : t('Abfahrt {zeit}', { zeit })].filter(Boolean).join(' · ')
    }
  } else if (m && m[1]) {
    // Zeit bewusst geleert: der beschriftete Text muss mit weg. Sonst füllt er beim nächsten
    // Öffnen das Feld wieder, und überall stünde weiter die alte Abfahrt.
    sub = aufgeraeumt(sub.slice(0, m.index) + sub.slice(m.index + m[0].length))
  } else if (ohneWort) sub = aufgeraeumt(sub.slice(0, ohneWort.i) + sub.slice(ohneWort.i + ohneWort.wert.length))
  if (sub !== String(alt.sub || '')) raus.sub = sub
  return raus
}

/** Legt einen Termin an oder ergänzt `id`, hängt den Beleg an und gibt die Termin-ID zurück. */
export async function speichereVerkehr(art, f, { id = null, titel = '', datei = null } = {}) {
  const nr = art === 'flug' ? normalNummer(f.nr) : normalZug(f.nr)
  const felder = { datum: f.datum, zeit: f.zeit || '', ref: String(f.ref || '').trim(), sitz: String(f.sitz || '').trim() }
  const alt = id ? (get(buchungen)?.events || []).find((e) => e.id === id) : null
  if (art === 'flug') {
    felder.flugNr = nr
    // `flugNr` und `flugNrs` dürfen nicht auseinanderlaufen, sonst zählt die leere Liste und der
    // Flug steht nach dem Ergänzen weiter unter „Hier fehlt noch etwas“.
    const alteNummern = flugNummern(alt || {})
    if (alteNummern.length <= 1) felder.flugNrs = nr ? [nr] : []
    // Umsteigeflug mit mehreren Nummern: hier wird nur die erste berichtigt, die Anschlüsse
    // bleiben. Ohne das zählte weiter die alte Nummer und der Anschluss würde doppelt abgefragt.
    else if (nr && alteNummern[0] !== nr) felder.flugNrs = [nr, ...alteNummern.slice(1)]
  } else { felder.zugNr = nr; felder.bahnhof = String(f.bahnhof || '').trim() }
  const vorhanden = !!alt
  if (vorhanden) aendereTermin(id, { ...felder, ...textNachziehen(alt, art, f, nr) })
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
