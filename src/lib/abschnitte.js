// V16: Routen mit Zeitraum. Eine Etappe ist ein Kapitel der Reise mit festem Zeitraum. Darin liegen Routen:
// Fahrt, Flug, Bus, Bahn oder Schiff, jeweils mit eigenem Zeitraum und ihren Stopps. Gespeichert wie immer
// im Topf `reisen` (typ 'route', etappeId), neu sind nur `von` (Datum) und `idee` (zählt nicht mit).
// Ohne `von` ist eine Route „noch nicht eingeplant“. Reine Rechnungen, ohne Speicher.
import { gueltigesDatum, plusTage, tageVon, istRoute } from './plan.js'

export const ARTEN = ['auto', 'flug', 'bus', 'bahn', 'boot']
export const FAHRZEUG = new Set(['auto', 'camper', undefined, null, ''])
export const artVon = (r) => r?.art || 'auto'
export const istFahrt = (r) => FAHRZEUG.has(r?.art)

/** Zeitraum eines Abschnitts oder null, wenn er noch kein Datum hat. */
export function bereichVon(r) {
  if (!gueltigesDatum(r?.von)) return null
  const tage = tageVon(r)
  return { von: r.von, bis: plusTage(r.von, tage - 1), tage }
}
export const eingeplant = (r) => !!bereichVon(r) && !r.idee

/** Abschnitte einer Etappe: eingeplante nach Datum, dann die ohne Datum, Ideen zuletzt. */
export function abschnitteDerEtappe(reisen = [], etappeId) {
  const liste = reisen.filter((r) => istRoute(r) && r.etappeId === etappeId)
  const mit = liste.filter(eingeplant).sort((a, b) => a.von.localeCompare(b.von) || (a.zeit || '').localeCompare(b.zeit || ''))
  const ohne = liste.filter((r) => !eingeplant(r))
  return { eingeplant: mit, offen: ohne.filter((r) => !r.idee), ideen: ohne.filter((r) => r.idee) }
}

/** Der Abschnitt an einem Tag. Mehrere an einem Tag (Flug, Shuttle, Boot): der letzte, der dort beginnt. */
export function abschnittAm(reisen = [], etappeId, datum) {
  let treffer = null
  for (const r of abschnitteDerEtappe(reisen, etappeId).eingeplant) {
    const b = bereichVon(r)
    if (datum >= b.von && datum <= b.bis && (!treffer || r.von >= treffer.von)) treffer = r
  }
  return treffer
}

/** Ein Tag als Ort in der Etappe: welcher Abschnitt, Tag x von y darin. */
export function stelleAm(reisen, etappeId, datum) {
  const r = abschnittAm(reisen, etappeId, datum)
  if (!r) return null
  const b = bereichVon(r)
  const tag = Math.round((new Date(datum + 'T12:00') - new Date(b.von + 'T12:00')) / 864e5) + 1
  return { abschnitt: r, tag, tage: b.tage }
}

// ---------- Umbau: Abschnitte ohne Datum aus den Buchungen datieren ----------
const KAT_FUER = { flug: ['flight'], bus: ['shuttle'], boot: ['boat'], bahn: ['train'] }
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const ALLGEMEIN = new Set(['airport', 'flughafen', 'ab', 'nach', 'transfer', 'the', 'harbour', 'beach'])
const kern = (s) => norm(s).split(' ').filter((w) => w.length >= 3 && !ALLGEMEIN.has(w))
function passt(r, e) {
  const [a, b] = String(e.titel || '').split('→').map(kern)
  if (!a || !b) return false
  const st = r.stops || []
  const start = kern(st[0]?.name), ziel = kern(st.at(-1)?.name)
  const hat = (x, y) => x.some((w) => y.includes(w))
  return hat(start, a) && hat(ziel, b)
}

/**
 * Für Flug, Bus, Boot und Bahn ohne Datum: die Buchung im Zeitraum der Etappe, deren Strecke zu Start
 * und Ziel passt. Nur eindeutige Treffer. Liefert Änderungen [{ id, von, tage: 1, zeit, terminId }].
 */
export function datiereAbschnitte(reisen = [], events = [], eintraege = []) {
  const etappe = new Map(eintraege.map((e) => [e.reise.id, e]))
  const vergeben = new Set(reisen.map((r) => r.terminId).filter(Boolean))
  const out = []
  for (const r of reisen) {
    if (!istRoute(r) || gueltigesDatum(r.von) || r.idee) continue
    const kats = KAT_FUER[r.art]
    const e = etappe.get(r.etappeId)
    if (!kats || !e) continue
    const kandidaten = events.filter((x) => !x.platzhalter && kats.includes(x.kat) && x.datum >= e.von && x.datum <= e.bis && !vergeben.has(x.id) && passt(r, x))
    if (kandidaten.length !== 1) continue
    const x = kandidaten[0]
    vergeben.add(x.id)
    const zeit = x.zeit || String(x.sub || '').match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/)?.[0]?.replace('.', ':') || ''
    out.push({ id: r.id, von: x.datum, tage: 1, ...(zeit ? { zeit } : {}), terminId: r.terminId || x.id })
  }
  return out
}

// ---------- Vorschlag: in welche Etappe gehört ein neuer Abschnitt? ----------
const RAD = Math.PI / 180
function km(a, b) {
  const dLat = (b.lat - a.lat) * RAD, dLon = (b.lon - a.lon) * RAD
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(s))
}
const mitKoord = (st) => (st || []).filter((s) => s && s.lat != null && s.lon != null)
/** Eine Etappe, die über Kontinente reicht (Hin- oder Heimreise), schlägt die App nie als Ziel vor.
 *  Gezählt werden ihre Stopps und die Stopps ihrer Routen (der Langstreckenflug steckt oft in einer Route). */
export function istReiseEtappe(e, reisen = []) {
  const st = [...mitKoord(e?.stops), ...reisen.filter((r) => istRoute(r) && r.etappeId === e?.id).flatMap((r) => mitKoord(r.stops))]
  for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) if (km(st[i], st[j]) > 3000) return true
  return false
}

/**
 * V39: In welche Etappe gehört ein Ort? Für „In Etappe …“ im Einplanen-Menü der Ortskachel: Hat die Etappe noch
 * keine Fahrt, legt ein Tipp dort die erste Route mit diesem Ort an, weitere Orte kommen dann in dieselbe Route.
 * Maßgeblich ist, wo man in der Etappe ist: ihr letzter Stopp mit Ort (Flug Melbourne → Cairns: Cairns) und die
 * Stopps ihrer Fahrten, nicht ihr Abflugort. Ohne eigenen Ort liegt sie dort, wo die vorige Etappe ankommt; sonst
 * zählt der Name (Etappe „Melbourne & Kinglake“ passt zu Orten in „Melbourne & Bucht“). Hin- und Heimreise bleiben draußen: ihre eigenen Stopps liegen über 3000 km
 * auseinander, bei der ersten und letzten Etappe zählen auch die Flüge darin. Ein langer Flug mitten in der Reise
 * (etwa der Weiterflug ab Proserpine) macht eine Etappe dagegen nicht zur Heimreise.
 * eintraege aus etappenMitDatum. Rückgabe: [{ eintrag, km, grund: 'nah' | 'name', hatFahrt }] nach Nähe.
 */
function ankunftVor(reihe, reisen, id) {
  const i = reihe.findIndex((e) => e.reise.id === id)
  if (i < 1) return null
  const vorige = reihe[i - 1].reise
  const rs = reisen.filter((x) => istRoute(x) && x.etappeId === vorige.id).sort((a, b) => String(a.von || '').localeCompare(String(b.von || '')))
  const letzte = rs.length ? mitKoord(rs[rs.length - 1].stops).at(-1) : null
  return letzte || mitKoord(vorige.stops).at(-1) || null
}
/** Hin- oder Heimreise im Plan? Eigene Stopps über 3000 km auseinander, bei erster und letzter Etappe auch ihre Flüge */
export function istReiseImPlan(reise, eintraege = [], reisen = []) {
  const reihe = [...eintraege].sort((a, b) => String(a.von).localeCompare(String(b.von)))
  const rand = reise.id === reihe[0]?.reise.id || reise.id === reihe.at(-1)?.reise.id
  return istReiseEtappe(reise, []) || (rand && istReiseEtappe(reise, reisen))
}
/**
 * Für das Einplanen-Menü: Etappen ohne eigene Fahrt, in die ein Ort mit einem Tipp kommt (dort entsteht die erste
 * Route). nah: passend zum Ort (höchstens zwei), andere: alle übrigen außer Hin- und Heimreise.
 */
export function etappenZumEinplanen(ort, eintraege = [], reisen = []) {
  const ohneFahrt = (e) => !reisen.some((x) => istRoute(x) && x.etappeId === e.reise.id && istFahrt(x))
  const nah = etappenFuerOrt(ort, eintraege, reisen).filter((x) => !x.hatFahrt).slice(0, 2).map((x) => x.eintrag)
  const ids = new Set(nah.map((e) => e.reise.id))
  const andere = [...eintraege].sort((a, b) => String(a.von).localeCompare(String(b.von)))
    .filter((e) => !ids.has(e.reise.id) && ohneFahrt(e) && !istReiseImPlan(e.reise, eintraege, reisen))
  return { nah, andere }
}
export function etappenFuerOrt(ort, eintraege = [], reisen = [], maxKm = 300) {
  if (!ort) return []
  const reihe = [...eintraege].sort((a, b) => String(a.von).localeCompare(String(b.von)))
  const woerter = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z]+/).filter((w) => w.length >= 5)
  const ortWorte = new Set([...woerter(ort.name), ...woerter(ort.region)])
  const aus = []
  for (const e of eintraege) {
    const r = e.reise
    if (istReiseImPlan(r, eintraege, reisen)) continue
    const fahrten = reisen.filter((x) => istRoute(x) && x.etappeId === r.id && istFahrt(x))
    const eigene = mitKoord(r.stops)
    const punkte = [...(eigene.length ? [eigene[eigene.length - 1]] : []), ...fahrten.flatMap((x) => mitKoord(x.stops))]
    // Ohne eigenen Ort: dort, wo die vorige Etappe ankommt (letzter Stopp ihrer letzten Route oder ihr eigener)
    if (!eigene.length) { const an = ankunftVor(reihe, reisen, r.id); if (an) punkte.push(an) }
    let bester = Infinity
    if (ort.lat != null && ort.lon != null) for (const p of punkte) bester = Math.min(bester, km(p, ort))
    if (bester <= maxKm) { aus.push({ eintrag: e, km: bester, grund: 'nah', hatFahrt: fahrten.length > 0 }); continue }
    // Etappe ohne eigenen Ort und nichts in Reichweite: der Name (nur Wörter ab fünf Buchstaben, „Kinglake“, „Melbourne“)
    if (!eigene.length && woerter(r.name).some((w) => ortWorte.has(w))) aus.push({ eintrag: e, km: Infinity, grund: 'name', hatFahrt: fahrten.length > 0 })
  }
  return aus.sort((a, b) => a.km - b.km)
}

/**
 * Vorschlag für eine Etappe zu Stopps. Nie Hin- oder Heimreise. Erst eine Etappe mit einem Stopp oder
 * Abschnitt bis 300 km entfernt, sonst die längste Etappe, in der man selbst fährt.
 * @returns { etappe (Eintrag aus etappenMitDatum), grund: 'nah' | 'laengste' } oder null
 */
export function etappeVorschlag(stops = [], eintraege = [], reisen = []) {
  const ziel = mitKoord(stops)
  const kand = eintraege.filter((e) => !istReiseEtappe(e.reise, reisen))
  if (!kand.length) return null
  if (ziel.length) {
    let best = null
    for (const e of kand) {
      const punkte = [...mitKoord(e.reise.stops), ...reisen.filter((r) => istRoute(r) && r.etappeId === e.reise.id && istFahrt(r)).flatMap((r) => mitKoord(r.stops))]
      for (const p of punkte) for (const z of ziel) {
        const d = km(p, z)
        if (d <= 300 && (!best || d < best.d)) best = { e, d }
      }
    }
    if (best) return { etappe: best.e, grund: 'nah' }
  }
  const selbst = kand.filter((e) => istFahrt(e.reise)).sort((a, b) => b.tage - a.tage)
  return selbst.length ? { etappe: selbst[0], grund: 'laengste' } : null
}

/** Erster Tag einer Etappe, an dem noch kein eingeplanter Abschnitt liegt (Vorgabe für einen neuen). */
export function ersterFreierTag(reisen, eintrag) {
  const belegt = new Set()
  for (const r of abschnitteDerEtappe(reisen, eintrag.reise.id).eingeplant) {
    const b = bereichVon(r)
    for (let d = b.von; d <= b.bis; d = plusTage(d, 1)) belegt.add(d)
  }
  for (let d = eintrag.von; d <= eintrag.bis; d = plusTage(d, 1)) if (!belegt.has(d)) return d
  return eintrag.von
}

/** Dauer aus einem Text wie „⏱️ 10–12 Tage“ (Routen-Ideen): die längere Zahl. */
export function tageAusText(liste = []) {
  for (const m of liste) {
    const t = String(m).match(/(\d+)\s*[–-]?\s*(\d+)?\s*Tage/)
    if (t) return Math.max(+t[1], t[2] ? +t[2] : 0)
  }
  return null
}
