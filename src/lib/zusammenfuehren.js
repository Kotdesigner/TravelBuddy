// Zwei Datenstände zusammenführen — für den Austausch iPhone ↔ Mac per AirDrop.
//
// GRUNDSATZ (aus der Sicherheitsprüfung der Regeln):
// Zusammengeführt wird ausschließlich über die `id`, feldweise und additiv.
// Der jüngere Wert gewinnt — aber LEER SCHLÄGT NIE VOLL, Listen werden vereinigt
// statt ersetzt, und was sich nicht entscheiden lässt, bleibt doppelt stehen.
// Lieber ein Eintrag doppelt als einer weg.
//
// Reine Funktionen ohne Stores und ohne DOM: so lässt sich jede Regel einzeln prüfen.
import { LOCALE, t, tn } from './i18n.js'
import { eur } from './format.js'

export const URZEIT = '2000-01-01T00:00:00.000Z'
const zeitVon = (o) => (o && o.geaendert) || URZEIT
const leer = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)

/**
 * Ein Feld entscheiden.
 * Reihenfolge der Regeln ist Absicht:
 *  1. Gleich → nichts zu tun.
 *  2. Eine Seite leer → die gefüllte gewinnt, EGAL welche jünger ist. Das ist die
 *     Regel, die „niemals Daten verlieren" im Alltag durchsetzt: ein versehentlich
 *     geleertes Feld mit frischem Stempel darf keinen ausgefüllten Text schlagen.
 *  3. Sonst der jüngere Stempel.
 */
function feldWert(hier, dort, hierZeit, dortZeit) {
  if (JSON.stringify(hier) === JSON.stringify(dort)) return { wert: hier, geaendert: false }
  if (leer(dort)) return { wert: hier, geaendert: false }
  if (leer(hier)) return { wert: dort, geaendert: true }
  return dortZeit > hierZeit ? { wert: dort, geaendert: true } : { wert: hier, geaendert: false }
}

/** Kurzkennung einer data:-URL — zum Entdoppeln von Fotos und Sprachnotizen. */
export function medienSchluessel(s) {
  const t = String(s || '')
  return t.length + '|' + t.slice(0, 128) + '|' + t.slice(-64)
}

/**
 * Listen von Medien vereinigen, nie ersetzen.
 * Fotos sind das Einzige, was sich nach der Reise nicht nachtragen lässt — eine
 * Vereinigung kann nur zu viele liefern, nie zu wenige. Der Entdopplungs-Schlüssel
 * ist Pflicht: ohne ihn verdreifacht ein dreifacher Import jedes Bild.
 */
export function vereinigeMedien(a = [], b = []) {
  const raus = [], gesehen = new Set()
  for (const x of [...(a || []), ...(b || [])]) {
    const k = medienSchluessel(x)
    if (gesehen.has(k)) continue
    gesehen.add(k); raus.push(x)
  }
  return raus
}

/** Zwei nicht-leere, unterschiedliche Texte: nicht entscheiden, beide behalten. */
function textZusammen(hier, dort, quelle = t('anderes Gerät')) {
  const a = String(hier || '').trim(), b = String(dort || '').trim()
  if (!b || a === b) return { wert: hier, doppelt: false }
  if (!a) return { wert: dort, doppelt: false }
  if (a.includes(b)) return { wert: hier, doppelt: false }
  return { wert: `${a}\n\n––– ${quelle} –––\n${b}`, doppelt: true }
}

// ---------------------------------------------------------------------------
// Einzelne Töpfe
// ---------------------------------------------------------------------------

const MEDIEN_FELDER = ['fotos', 'audios', 'bilder']
// Listen in einem Eintrag, die zusammen wachsen dürfen (Tier-Sichtungen vom iPhone und vom Mac
// am selben Tag). Schlüssel je Liste; gelöschte Sichtungen sperren Grabsteine.
const SAMMEL_FELDER = { sichtungen: 'id', fotoMeta: 'k' }
export function vereinigeNachSchluessel(a = [], b = [], schluessel = 'id', tot = new Set()) {
  const raus = [], gesehen = new Set()
  for (const x of [...(a || []), ...(b || [])]) {
    const k = x && x[schluessel]
    if (k == null || gesehen.has(k) || tot.has(k)) continue
    gesehen.add(k); raus.push(x)
  }
  return raus
}
const TEXT_FELDER = ['text', 'notiz', 'bericht', 'beschreibung']

/**
 * Liste von Datensätzen mit `id` zusammenführen.
 * @param tot  Grabsteine [{id, ts}] der Gegenseite — löschen hier nur, wenn der
 *             hiesige Eintrag SEIT dem Löschen nicht mehr angefasst wurde.
 */
export function fuehreListe(hier = [], dort = [], { tot = [], quelle, feldweise = false, nurErgaenzen = false, teilTot = new Set() } = {}) {
  const bilanz = { neu: 0, ergaenzt: 0, gleich: 0, geloescht: 0, doppelt: 0 }
  const hierMap = new Map((hier || []).filter((x) => x && x.id).map((x) => [x.id, x]))
  const raus = []

  for (const h of hier || []) {
    if (!h || !h.id) { raus.push(h); continue }
    const d = (dort || []).find((x) => x && x.id === h.id)
    if (!d) { raus.push(h); bilanz.gleich++; continue }

    const hz = zeitVon(h), dz = zeitVon(d)
    const zusammen = { ...h }
    let veraendert = false

    for (const k of new Set([...Object.keys(h), ...Object.keys(d)])) {
      if (k === 'id' || k === 'geaendert' || k === 'herkunft' || k === 'stempel') continue
      // Bei verstellter Uhr der Gegenseite darf NICHTS überschrieben werden. Medien
      // bleiben erlaubt: eine Vereinigung ist rein additiv und kann nichts verlieren.
      if (SAMMEL_FELDER[k]) {
        const v = vereinigeNachSchluessel(h[k], d[k], SAMMEL_FELDER[k], teilTot)
        if (v.length !== (h[k] || []).length) veraendert = true
        if (v.length || h[k]) zusammen[k] = v
        continue
      }
      if (nurErgaenzen && !MEDIEN_FELDER.includes(k)) continue
      if (MEDIEN_FELDER.includes(k)) {
        const v = vereinigeMedien(h[k], d[k])
        if (v.length !== (h[k] || []).length) { zusammen[k] = v; veraendert = true } else zusammen[k] = v
        continue
      }
      if (feldweise && TEXT_FELDER.includes(k)) {
        const t = textZusammen(h[k], d[k], quelle)
        if (t.wert !== h[k]) { zusammen[k] = t.wert; veraendert = true }
        if (t.doppelt) bilanz.doppelt++
        continue
      }
      if (k === 'felder' && feldweise) {
        // Die Zusatzfelder des Logbuchs sind eine flache Karte mit festen IDs —
        // hier lohnt sich die Feinarbeit: Kosten vom Mac und Stimmung vom iPhone
        // gehören in denselben Tag.
        const zf = { ...(h.felder || {}) }
        for (const fk of Object.keys(d.felder || {})) {
          const e = feldWert(zf[fk], d.felder[fk], hz, dz)
          if (e.geaendert) { zf[fk] = e.wert; veraendert = true }
        }
        zusammen.felder = zf
        continue
      }
      const e = feldWert(h[k], d[k], hz, dz)
      if (e.geaendert) { zusammen[k] = e.wert; veraendert = true }
    }

    if (veraendert) { zusammen.geaendert = dz > hz ? dz : hz; bilanz.ergaenzt++ } else bilanz.gleich++
    raus.push(zusammen)
  }

  // Was die Gegenseite kennt und wir nicht — außer wir haben es bewusst gelöscht.
  const meineGraeber = new Map((tot || []).map((g) => [g.id, g.ts]))
  for (const d of dort || []) {
    if (!d || !d.id || hierMap.has(d.id)) continue
    const grab = meineGraeber.get(d.id)
    // Wiederbelebung ist erwünscht, wenn der Eintrag NACH dem Löschen bearbeitet wurde.
    if (grab && zeitVon(d) <= grab) { bilanz.geloescht++; continue }
    raus.push(d); bilanz.neu++
  }
  return { liste: raus, bilanz }
}

/** Grabsteine der Gegenseite anwenden: hier löschen, was dort bewusst weg ist. */
export function wendeGrabsteineAn(liste = [], graeber = []) {
  let weg = 0
  const raus = (liste || []).filter((e) => {
    const g = (graeber || []).find((x) => x.id === e?.id)
    if (!g) return true
    if (zeitVon(e) > g.ts) return true   // seit dem Löschen wieder bearbeitet → behalten
    weg++; return false
  })
  return { liste: raus, weg }
}

/** Zwei Grabstein-Sammlungen vereinigen (je id der jüngere Zeitpunkt). */
export function vereinigeGrabsteine(a = {}, b = {}) {
  const raus = {}
  for (const topf of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    const m = new Map()
    for (const g of [...(a[topf] || []), ...(b[topf] || [])]) {
      if (!g?.id) continue
      const alt = m.get(g.id)
      if (!alt || g.ts > alt.ts) m.set(g.id, g)
    }
    raus[topf] = [...m.values()]
  }
  return raus
}

/** userData: Karte ortId → { notiz, bericht, bilder[], tagebuch[] }. */
export function fuehreOrtsdaten(hier = {}, dort = {}, quelle, nurErgaenzen = false) {
  const bilanz = { neu: 0, ergaenzt: 0, gleich: 0, doppelt: 0 }
  const raus = { ...hier }
  for (const id of Object.keys(dort || {})) {
    const d = dort[id], h = hier[id]
    if (!d) continue
    if (!h) { raus[id] = d; bilanz.neu++; continue }
    const hz = zeitVon(h), dz = zeitVon(d)
    const z = { ...h }
    let veraendert = false
    for (const k of new Set([...Object.keys(h), ...Object.keys(d)])) {
      if (k === 'geaendert' || k === 'herkunft') continue
      if (nurErgaenzen && k !== 'bilder' && k !== 'tagebuch') continue
      if (k === 'bilder') { const v = vereinigeMedien(h.bilder, d.bilder); if (v.length !== (h.bilder || []).length) veraendert = true; z.bilder = v; continue }
      if (k === 'tagebuch') {
        const r = fuehreListe(h.tagebuch || [], d.tagebuch || [], { quelle })
        if (r.bilanz.neu || r.bilanz.ergaenzt) veraendert = true
        z.tagebuch = r.liste; bilanz.doppelt += r.bilanz.doppelt; continue
      }
      if (k === 'notiz' || k === 'bericht') {
        const t = textZusammen(h[k], d[k], quelle)
        if (t.wert !== h[k]) { z[k] = t.wert; veraendert = true }
        if (t.doppelt) bilanz.doppelt++
        continue
      }
      const e = feldWert(h[k], d[k], hz, dz)
      if (e.geaendert) { z[k] = e.wert; veraendert = true }
    }
    if (veraendert) { z.geaendert = dz > hz ? dz : hz; bilanz.ergaenzt++ } else bilanz.gleich++
    raus[id] = z
  }
  return { daten: raus, bilanz }
}

/**
 * Haken-Karten (Packliste, Vorbereitung).
 * Altformat { id: true } kennt kein Abwählen — ein Haken, den man entfernt hat,
 * ist einfach nicht mehr da und ließe sich beim Abgleich nicht von „noch nie
 * gesetzt" unterscheiden. Neues Format { id: { an, ts } } macht das Abwählen
 * sichtbar. Beim Zusammenführen gewinnt je Haken der jüngere Zeitpunkt.
 */
export function zuHakenKarte(k = {}) {
  const raus = {}
  for (const [id, v] of Object.entries(k || {})) {
    if (v && typeof v === 'object') raus[id] = { an: !!v.an, ts: v.ts || URZEIT }
    else if (v) raus[id] = { an: true, ts: URZEIT }
  }
  return raus
}
export function fuehreHaken(hier = {}, dort = {}) {
  const a = zuHakenKarte(hier), b = zuHakenKarte(dort)
  const raus = { ...a }
  let geaendert = 0
  for (const [id, v] of Object.entries(b)) {
    const h = a[id]
    if (!h) { raus[id] = v; if (v.an) geaendert++; continue }
    if (v.ts > h.ts && v.an !== h.an) { raus[id] = v; geaendert++ }
  }
  return { karte: raus, geaendert }
}

/**
 * Einzelwert (Startdatum, Budget) mit eigenem Änderungsstempel.
 *
 * Früher entschied der Exportzeitpunkt der GANZEN Datei. „Hier" ist beim Import aber
 * immer „jetzt" — also gewann immer das Zielgerät, und ein Backup brachte Startdatum und
 * Budget nie mit, auch nicht auf ein frisch eingerichtetes Gerät (gefunden 18.09.2026).
 *
 * Jetzt:  Grundwert hier (nie eingestellt) → Wert der Datei.   Grundwert in der Datei → hier bleibt.
 *         Sonst gewinnt der jüngere Stempel dieses einen Werts; unbekannt → hier bleibt, mit Hinweis.
 */
export function fuehreSkalar(hier, dort, hierTs, dortTs, name, { grundwert = null, nurErgaenzen = false, zeige = String } = {}) {
  const leer = (v) => v == null || v === '' || v === grundwert
  if (leer(dort) || dort === hier) return { wert: hier, meldung: null, vonDort: false }
  if (leer(hier)) return { wert: dort, meldung: `${name} aus der Datei übernommen: ${zeige(dort)}`, vonDort: true }
  if (!nurErgaenzen && dortTs > hierTs) {
    return { wert: dort, meldung: `${name}: in der Datei später geändert — ${zeige(hier)} → ${zeige(dort)}`, vonDort: true }
  }
  return { wert: hier, meldung: `${name}: hier ${zeige(hier)} bleibt (in der Datei ${zeige(dort)}, nicht jünger)`, vonDort: false }
}
const ZEIGE = {
  gesamtStart: (v) => String(v).split('-').reverse().join('.'),
  reiseBudget: (v) => eur(v),
  reiseTage: (v) => tn(v, '{n} Tag', '{n} Tage'),
}

/** Grundwerte, die „noch nie eingestellt" bedeuten. userdata.js reicht die echten herein. */
export const SKALAR_GRUND = { gesamtStart: null, reiseBudget: 0, reiseTage: 0 }

// ---------------------------------------------------------------------------
// Gesamtlauf
// ---------------------------------------------------------------------------

const LISTEN = [
  ['journal', t('Logbuch'), true],
  ['wanderungen', t('Wanderungen'), false],
  ['eigeneOrte', t('Eigene Orte'), false],
  ['notizen', t('Notizen'), false],
  ['dokumente', t('Dokumente'), false],
  ['vorabKosten', t('Vorab-Ausgaben'), false],
  ['reisen', t('Reisen'), false],
  ['checkins', t('Check-ins'), false],
]

/**
 * Trockenlauf UND echter Lauf benutzen dieselbe Funktion — die Vorschau zeigt
 * damit garantiert dieselben Zahlen wie das Ergebnis.
 *
 * @param hier  aktueller Stand (Objekt wie baueBackupPayload)
 * @param datei eingelesenes Backup
 */
export function fuehreZusammen(hier, datei, { quelle = t('anderes Gerät'), grundwerte = SKALAR_GRUND } = {}) {
  const ergebnis = {}, bericht = [], hinweise = []
  const graeberDort = datei.grabsteine || {}
  const graeberHier = hier.grabsteine || {}

  // Uhrenversatz: liegt die Datei mehr als eine Stunde in der Zukunft, ist die
  // Uhr des anderen Geräts verstellt. Dann NUR ergänzen, nichts überschreiben —
  // sonst gewänne das falsch gestellte Gerät jeden Vergleich.
  const versatzMs = datei.exportiert ? new Date(datei.exportiert) - new Date() : 0
  const nurErgaenzen = versatzMs > 3600000
  if (nurErgaenzen) {
    hinweise.push(`Die Uhr des anderen Geräts geht etwa ${Math.round(versatzMs / 3600000)} Stunden vor. ` +
      t('Es wird deshalb nur ergänzt und nichts überschrieben.'))
  }

  for (const [feld, label, feldweise] of LISTEN) {
    const h0 = Array.isArray(hier[feld]) ? hier[feld] : []
    const d0 = Array.isArray(datei[feld]) ? datei[feld] : []
    // Erst anwenden, was die Gegenseite gelöscht hat …
    const g = wendeGrabsteineAn(h0, graeberDort[feld] || [])
    // … dann zusammenführen, mit unseren eigenen Grabsteinen als Sperre.
    const teilTot = new Set([...(graeberHier.sichtungen || []), ...(graeberDort.sichtungen || [])].map((x) => x.id))
    const r = fuehreListe(g.liste, d0, {
      tot: graeberHier[feld] || [], quelle, nurErgaenzen, teilTot,
      feldweise: feldweise && !nurErgaenzen,
    })
    ergebnis[feld] = r.liste
    bericht.push({ topf: label, ...r.bilanz, geloescht: r.bilanz.geloescht + g.weg })
  }

  const o = fuehreOrtsdaten(hier.daten || {}, datei.daten || {}, quelle, nurErgaenzen)
  ergebnis.daten = o.daten
  bericht.push({ topf: t('Notizen an Orten'), ...o.bilanz, geloescht: 0 })

  // Eigene Einträge in Pack- und Vorbereitungsliste: mit Grabsteinen wie die großen Listen —
  // sonst kam ein hier gelöschter Eintrag beim nächsten Abgleich zurück.
  const eigene = (h, d, topf) => fuehreListe(
    wendeGrabsteineAn(h || [], graeberDort[topf] || []).liste, d || [],
    { quelle, tot: graeberHier[topf] || [], nurErgaenzen }).liste
  const pk = fuehreHaken(hier.packliste?.checked, datei.packliste?.checked)
  ergebnis.packliste = {
    checked: pk.karte,
    custom: eigene(hier.packliste?.custom, datei.packliste?.custom, 'packCustom'),
  }
  if (pk.geaendert) bericht.push({ topf: t('Pack-Haken'), neu: 0, ergaenzt: pk.geaendert, gleich: 0, geloescht: 0, doppelt: 0 })

  const vb = fuehreHaken(hier.vorbereitung?.checked, datei.vorbereitung?.checked)
  ergebnis.vorbereitung = {
    checked: vb.karte,
    custom: eigene(hier.vorbereitung?.custom, datei.vorbereitung?.custom, 'vorbCustom'),
  }
  if (vb.geaendert) bericht.push({ topf: t('Vorbereitungs-Haken'), neu: 0, ergaenzt: vb.geaendert, gleich: 0, geloescht: 0, doppelt: 0 })

  // Buchungen sind der Spiegel der Kalender-App — nie feldweise mischen.
  const bh = hier.buchungen, bd = datei.buchungen
  if (bd?.events?.length && (!bh?.events?.length || (bd.stand || '') > (bh.stand || ''))) {
    ergebnis.buchungen = { ...bd, startVorher: bh?.startVorher ?? bd.startVorher }
    hinweise.push(t('Buchungen: die Fassung aus der Datei ist neuer und wird ganz übernommen.'))
  } else ergebnis.buchungen = bh
  // Selbst eingefügte Buchungen (aus Mails) gibt es je Gerät: die von beiden Seiten behalten,
  // außer sie wurden auf einer Seite gelöscht.
  if (ergebnis.buchungen?.events) {
    const totB = new Set([...(graeberHier.buchungenEigen || []), ...(graeberDort.buchungenEigen || [])].map((x) => x.id))
    const eigene = vereinigeNachSchluessel(
      (bh?.events || []).filter((e) => e.quelle === 'eigen'), (bd?.events || []).filter((e) => e.quelle === 'eigen'), 'id', totB)
    const vorher = ergebnis.buchungen.events.filter((e) => e.quelle === 'eigen').length
    const events = [...ergebnis.buchungen.events.filter((e) => e.quelle !== 'eigen'), ...eigene].sort((x, y) => (x.datum || '').localeCompare(y.datum || ''))
    ergebnis.buchungen = { ...ergebnis.buchungen, events }
    if (eigene.length > vorher) hinweise.push(`Buchungen aus Mails: ${eigene.length - vorher} vom anderen Gerät ergänzt.`)
  }

  // Skalare — je Wert ein eigener Stempel (`skalarStand`), siehe fuehreSkalar.
  // Bei verstellter Uhr wird nur ein noch leerer Wert ergänzt.
  const sh = hier.skalarStand || {}, sd = datei.skalarStand || {}
  ergebnis.skalarStand = { ...sh }
  for (const [feld, name] of [['gesamtStart', t('Startdatum')], ['reiseBudget', t('Budget')], ['reiseTage', t('Reisedauer')]]) {
    const r = fuehreSkalar(hier[feld], datei[feld], sh[feld] || URZEIT, sd[feld] || URZEIT, name,
      { grundwert: grundwerte[feld], nurErgaenzen, zeige: ZEIGE[feld] })
    ergebnis[feld] = r.wert
    if (r.vonDort) ergebnis.skalarStand[feld] = sd[feld] || URZEIT
    if (r.meldung) hinweise.push(r.meldung)
  }

  // Musik-Einstellungen: als Ganzes, die jüngere Fassung gewinnt (Stempel je Gerät, siehe
  // musik/speicher.js). Ohne Stempel (nie geändert) gewinnt die Seite mit Stempel.
  const mh = hier.musikEinstellungen, md = datei.musikEinstellungen
  const mJuenger = md?.werte && (!mh?.werte || (!nurErgaenzen && (md.stand || URZEIT) > (mh.stand || URZEIT)))
  if (mJuenger && JSON.stringify(md.werte) !== JSON.stringify(mh?.werte)) {
    ergebnis.musikEinstellungen = md
    bericht.push({ topf: t('Musik-Einstellungen'), neu: 0, ergaenzt: 1, gleich: 0, geloescht: 0 })
  } else ergebnis.musikEinstellungen = mh ?? null

  // Quiz wird bewusst nicht übertragen — es ist Zeitvertreib, keine Reisedaten,
  // und ein Zurücksetzen dürfte nicht durch einen Import aufgehoben werden.
  ergebnis.quizAntworten = hier.quizAntworten
  ergebnis.grabsteine = vereinigeGrabsteine(graeberHier, graeberDort)

  const doppelt = bericht.reduce((n, b) => n + (b.doppelt || 0), 0)
  if (doppelt) hinweise.push(tn(doppelt, '{n} Text lässt sich nicht entscheiden — beide Fassungen bleiben untereinander stehen.', '{n} Texte lassen sich nicht entscheiden — beide Fassungen bleiben untereinander stehen.'))

  return {
    ergebnis,
    bericht: bericht.filter((b) => b.neu || b.ergaenzt || b.geloescht || b.gleich),
    hinweise,
    summe: bericht.reduce((a, b) => ({
      neu: a.neu + (b.neu || 0), ergaenzt: a.ergaenzt + (b.ergaenzt || 0),
      gleich: a.gleich + (b.gleich || 0), geloescht: a.geloescht + (b.geloescht || 0),
    }), { neu: 0, ergaenzt: 0, gleich: 0, geloescht: 0 }),
  }
}
