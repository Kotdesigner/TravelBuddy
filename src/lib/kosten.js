// Kosten der Reise: Kategorien, einzelne Ausgaben je Logbuch-Eintrag und die Auswertung.
//
// Ein Eintrag hält seine Ausgaben in `ausgaben` ({ id, kat, betrag, text }). Die Summe je Kategorie
// steht zusätzlich wie bisher in `felder.kosten_*`, damit Bilanz, Tagebuch und Reise-Film unverändert
// weiterrechnen. Einträge von früher haben nur die Felder: `ausgabenVon` macht daraus eine Liste.
// Ein Eintrag über mehrere Tage zählt seine Ausgaben einmal, zum Kurs des ersten Tages.
//
// Die vier Cluster sind die Summe aller Kategorien. Short-Values sind laufender Konsum, Long-Values
// Anschaffungen. Long-Values zählen in die Gesamtsumme, aber nicht in den Schnitt pro Tag: eine
// Kamera ist kein Tagesbudget, so wie Vorabausgaben auch nicht.
import { t, jeSprache } from './i18n.js'
import { kursFuer, inBeide } from './fx.js'
import { rundeAufSumme } from './runden.js'
import { etappeAm, eintragTage } from './plan.js'

// Reihenfolge wie in der Auswahl: was unterwegs am häufigsten vorkommt, zuerst
export const KOSTEN_KATEGORIEN = jeSprache(() => ([
  { id: 'kosten_essen', icon: '🍽️', label: t('Essen gehen') },
  { id: 'kosten_lebensmittel', icon: '🍎', label: t('Lebensmittel') },
  { id: 'kosten_sprit', icon: '⛽', label: t('Sprit / Tanken') },
  { id: 'kosten_unterkunft', icon: '🏨', label: t('Unterkunft') },
  { id: 'kosten_attraktion', icon: '🎟️', label: t('Aktivitäten / Touren') },
  { id: 'kosten_genuss', icon: '🍺', label: t('Genussmittel') },
  { id: 'kosten_bedarf', icon: '🧴', label: t('Täglicher Bedarf') },
  { id: 'kosten_boot', icon: '🚤', label: t('Boot / Fähre') },
  { id: 'kosten_bahn', icon: '🚆', label: t('Bahn') },
  { id: 'kosten_bus', icon: '🚌', label: t('Bus') },
  { id: 'kosten_flug', icon: '✈️', label: t('Flug') },
  { id: 'kosten_mietfahrzeug', icon: '🚐', label: t('Mietfahrzeug') },
  { id: 'kosten_telefon', icon: '📱', label: t('Telefon') },
  { id: 'kosten_internet', icon: '🌐', label: t('Internet') },
  { id: 'kosten_souvenir', icon: '🎁', label: t('Souvenirs') },
  { id: 'kosten_kleidung', icon: '👕', label: t('Kleidung') },
  { id: 'kosten_kamera', icon: '📷', label: t('Kamera') },
  { id: 'kosten_drohne', icon: '🚁', label: t('Drohne') },
  { id: 'kosten_technik', icon: '🎥', label: t('Technik') },
  { id: 'kosten_behoerde', icon: '🏛️', label: t('Behörde') },
  { id: 'kosten_short', icon: '🪙', label: t('Short-Value (Konsum)') },
  { id: 'kosten_long', icon: '📦', label: t('Long-Value (Anschaffung)') },
  { id: 'kosten_sonstiges', icon: '🛒', label: t('Sonstiges') },
]))
export const KATEGORIE = jeSprache(() => Object.fromEntries(KOSTEN_KATEGORIEN.map((k) => [k.id, k])))

export const CLUSTER_KATS = {
  short: ['kosten_essen', 'kosten_lebensmittel', 'kosten_genuss', 'kosten_bedarf', 'kosten_telefon', 'kosten_internet', 'kosten_short'],
  long: ['kosten_drohne', 'kosten_kamera', 'kosten_kleidung', 'kosten_souvenir', 'kosten_technik', 'kosten_long'],
  verkehr: ['kosten_flug', 'kosten_sprit', 'kosten_boot', 'kosten_bahn', 'kosten_bus', 'kosten_mietfahrzeug'],
  erleben: ['kosten_unterkunft', 'kosten_attraktion', 'kosten_sonstiges', 'kosten_behoerde'],
}
export const KOSTEN_CLUSTER = jeSprache(() => ([
  { id: 'short', icon: '🪙', label: t('Short-Values'), info: t('Laufender Konsum'), kats: CLUSTER_KATS.short },
  { id: 'long', icon: '📦', label: t('Long-Values'), info: t('Anschaffungen'), kats: CLUSTER_KATS.long },
  { id: 'verkehr', icon: '🚦', label: t('Verkehr'), info: t('Flug, Sprit, Boot, Bahn, Bus, Mietfahrzeug'), kats: CLUSTER_KATS.verkehr },
  { id: 'erleben', icon: '🏨', label: t('Unterkunft & Erlebnisse'), info: t('Unterkunft, Aktivitäten, Behörde, Sonstiges'), kats: CLUSTER_KATS.erleben },
]))
export const clusterVon = (kat) => Object.keys(CLUSTER_KATS).find((c) => CLUSTER_KATS[c].includes(kat)) || 'erleben'

/** „12,50“ und „12.50“ → 12.5, alles andere → 0. */
export function betragVon(w) {
  const n = Number(String(w ?? '').trim().replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}
const cent = (n) => Math.round(n * 100) / 100

/** Die Ausgaben eines Eintrags. Alte Einträge ohne Liste: je Kategorie eine Zeile aus den Feldern. */
export function ausgabenVon(e) {
  if (Array.isArray(e?.ausgaben)) return e.ausgaben
  return KOSTEN_KATEGORIEN
    .filter((k) => betragVon(e?.felder?.[k.id]))
    .map((k) => ({ id: 'alt-' + k.id, kat: k.id, betrag: betragVon(e.felder[k.id]), text: '' }))
}

/** Die Felder eines Eintrags mit den Summen aus der Ausgabenliste. */
export function felderMitAusgaben(felder = {}, liste = []) {
  const neu = { ...felder }
  for (const k of KOSTEN_KATEGORIEN) delete neu[k.id]
  for (const a of liste) {
    const n = betragVon(a.betrag)
    if (n) neu[a.kat] = String(cent(betragVon(neu[a.kat]) + n))
  }
  return neu
}

export const ausgabenSumme = (liste = []) => cent(liste.reduce((s, a) => s + betragVon(a.betrag), 0))

function runde(zeilen, feld, gesamt) {
  const r = rundeAufSumme(zeilen.map((z) => z[feld]), gesamt)
  zeilen.forEach((z, i) => { z[feld] = r[i] })
}

/**
 * Alles zusammen: Logbuch und Vorabausgaben, je Kategorie und je Etappe, in Euro und AU$.
 * Gezeigt werden ganze Beträge. Jede Liste ergibt genau die Gesamtsumme (siehe runden.js).
 * @param eintraege  Etappen mit Datum aus etappenMitDatum
 */
export function kostenAuswertung({ journal = [], vorab = [], kurse = {}, eintraege = [] } = {}) {
  const posten = [], tage = new Set()
  for (const e of journal) {
    if (!e) continue
    const cur = e.felder?.waehrung || 'AUD'
    const kurs = kursFuer(kurse, e.datum)
    const etappe = etappeAm(eintraege, e.datum)?.reise.id || null
    for (const a of ausgabenVon(e)) {
      const x = inBeide(a.betrag, cur, kurs)
      if (!x.eur && !x.aud) continue
      const kat = KATEGORIE[a.kat] ? a.kat : 'kosten_sonstiges'
      posten.push({ ...x, kat, cluster: clusterVon(kat), etappe, vorab: false, datum: e.datum, bis: e.bis || '', text: a.text || '', betrag: betragVon(a.betrag), waehrung: cur, ort: e.ort || '' })
      if (clusterVon(kat) !== 'long') eintragTage(e).forEach((d) => tage.add(d))
    }
  }
  const etappenIds = new Set(eintraege.map((x) => x.reise.id))
  for (const k of vorab) {
    const x = inBeide(k.betrag, k.waehrung, kursFuer(kurse, k.datum))
    if (!x.eur && !x.aud) continue
    const kat = KATEGORIE[k.kat] ? k.kat : 'kosten_sonstiges'
    posten.push({ ...x, kat, cluster: clusterVon(kat), etappe: etappenIds.has(k.reiseId) ? k.reiseId : null, vorab: true, datum: k.datum, bis: '', text: k.text || '', betrag: betragVon(k.betrag), waehrung: k.waehrung, ort: '' })
  }

  const summe = (liste) => liste.reduce((s, p) => ({ eur: s.eur + p.eur, aud: s.aud + p.aud }), { eur: 0, aud: 0 })
  const genau = summe(posten)
  const gesamt = { eur: Math.round(genau.eur), aud: Math.round(genau.aud) }

  const kategorien = KOSTEN_KATEGORIEN.map((k) => ({ id: k.id, icon: k.icon, label: k.label, ...summe(posten.filter((p) => p.kat === k.id)) }))
  const nachEtappe = [
    ...eintraege.map((x) => ({ id: x.reise.id, name: x.reise.name, farbe: x.reise.farbe || '', ...summe(posten.filter((p) => p.etappe === x.reise.id)) })),
    { id: null, name: t('Ohne Etappe'), farbe: '', ...summe(posten.filter((p) => !p.etappe)) },
  ]
  const teile = [{ ...summe(posten.filter((p) => p.vorab)) }, { ...summe(posten.filter((p) => !p.vorab)) }]
  for (const f of ['eur', 'aud']) for (const liste of [kategorien, nachEtappe, teile]) runde(liste, f, gesamt[f])
  const [vor, unterwegs] = teile

  const anteil = (z) => (gesamt.eur ? z.eur / gesamt.eur : 0)
  const sichtbar = kategorien.filter((z) => z.eur || z.aud).sort((a, b) => b.eur - a.eur).map((z) => ({ ...z, anteil: anteil(z) }))
  // Zwischensummen sind die Summe der angezeigten Kategorien, nicht neu gerundet
  const cluster = KOSTEN_CLUSTER.map((c) => {
    const liste = sichtbar.filter((k) => c.kats.includes(k.id))
    return { id: c.id, icon: c.icon, label: c.label, info: c.info, eur: liste.reduce((s, k) => s + k.eur, 0), aud: liste.reduce((s, k) => s + k.aud, 0), kategorien: liste }
  })
  const proTag = (liste) => {
    const s = summe(liste)
    return tage.size ? { eur: Math.round(s.eur / tage.size), aud: Math.round(s.aud / tage.size) } : null
  }
  const unterwegsPosten = posten.filter((p) => !p.vorab)
  return {
    gesamt, vorab: vor, unterwegs, tage: tage.size,
    proTag: proTag(unterwegsPosten.filter((p) => p.cluster !== 'long')),
    shortProTag: proTag(unterwegsPosten.filter((p) => p.cluster === 'short')),
    kategorien: sichtbar, cluster,
    etappen: nachEtappe.filter((z) => z.eur || z.aud).map((z) => ({ ...z, anteil: anteil(z) })),
    posten: [...posten].sort((a, b) => b.datum.localeCompare(a.datum)),
  }
}

/** Ein Teil der Auswertung fürs Auswahlmenü: `alle`, ein Cluster (`cluster:short`) oder eine Kategorie. */
export function postenAuswahl(a, wahl = 'alle') {
  const cl = wahl.startsWith('cluster:') ? a.cluster.find((c) => c.id === wahl.slice(8)) : null
  const kat = a.kategorien.find((k) => k.id === wahl)
  const summe = cl || kat || a.gesamt
  const posten = a.posten.filter((p) => (cl ? p.cluster === cl.id : kat ? p.kat === kat.id : wahl === 'alle'))
  return { eur: summe.eur, aud: summe.aud, posten, anzahl: posten.length, proPosten: posten.length ? Math.round(summe.eur / posten.length) : 0 }
}
