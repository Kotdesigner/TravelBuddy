// Musik unterwegs: der Ablauf vom Standort bis zur Playlist.
//
// Alles, was nach außen spricht (Quellen, Spotify), wird hineingereicht. So lässt sich der
// ganze Weg in Tests mit Attrappen durchspielen, und die echte Anbindung ändert hier nichts.
//
//   Standort → Region → lohnt eine Suche? → (offline: vormerken) → Quellen fragen →
//   auf Spotify eindeutig finden → Doppelte aussortieren → hinzufügen → NUR bei bestätigtem
//   Erfolg zählt der Titel als neu (Zähler am Symbol).

import { CLIENT_ID, PLAYLIST_ID, LASTFM_KEY } from './spotify-ids.js'
import { regionFuer, relevanterWechsel, ebenenFolge } from './region.js'
import { sammle, mische, istGehoert } from './quellen.js'
import { vormerken, alsHinzugefuegt, alsFehler, alsDoppelt, bekannteIds, regionMerken, ausstehendDazu, ausstehendWeg, protokolliere } from './zustand.js'
import { t } from '../i18n.js'

export const VORGABEN = Object.freeze({
  aktiv: false,               // erst nach ausdrücklichem Einschalten
  playlistName: 'Sounds of the Road',
  titelJeOrt: 10,
  mindestAbstandM: 10000,
  mindestAbstandMin: 30,
  suchRadiusKm: 50,
  stadtKm: 25,
  quellen: { lastfm: true, musicbrainz: true },
  spotifyClientId: CLIENT_ID,
  playlistId: PLAYLIST_ID,
  lastfmKey: LASTFM_KEY,
  umkreisKm: 200,             // Bands aus Orten bis so weit weg zählen noch als „aus der Gegend“
  // Bevorzugte Stile: Künstler aus der Gegend mit diesen Stil-Angaben kommen zuerst
  stile: ['hardstyle', 'rawstyle', 'schranz', 'hard techno', 'hardcore techno', 'hard trance', 'hard dance', 'hands up', 'gabber', 'techno', 'trance'],
})

/** Prüft eine neue Position. Ändert den Zustand nur, wenn eine Suche fällig ist. */
export function ortPruefen(z, pos, { orte = [], cfg = VORGABEN, region: vorgabe = null } = {}) {
  const region = vorgabe || regionFuer(pos, orte, cfg)
  const w = relevanterWechsel(z.letzterOrt, pos, region, cfg)
  if (!w.ja) return { z, region, faellig: false, grund: w.grund }
  const z2 = { ...z, letzterOrt: { lat: pos.lat, lon: pos.lon, zeit: pos.zeit, regionId: region.id } }
  return { z: z2, region, faellig: true, grund: w.grund }
}

/**
 * Ein Suchlauf für eine Region.
 * @param deps { quellen, spotify, online, cfg, zeit, beliebtheit }
 *   spotify: { verbunden, findeTitel(t), playlistIds(id), hinzufuegen(id, uris), gegendTitel?(namen, { markt }) }
 *   beliebtheit: (bands, { cfg, signal }) → dieselben Bands, beliebteste zuerst (optional, quellen.js)
 * @returns { z, hinzugefuegt: [ids], status }
 */
export async function suchlauf(z, region, { quellen, spotify, online = true, cfg = VORGABEN, zeit = new Date().toISOString(), signal, beliebtheit = null } = {}) {
  if (!online) {
    z = ausstehendDazu(regionMerken(z, region, 'ausstehend', zeit), region.id)
    return { z: protolog(z, 'info', t('{name}: offline erkannt, Suche folgt mit Netz', { name: region.name }), zeit), hinzugefuegt: [], status: 'ausstehend' }
  }
  if (!spotify?.verbunden) {
    z = ausstehendDazu(regionMerken(z, region, 'wartet', zeit), region.id)
    return { z: protolog(z, 'info', t('{name}: Spotify ist nicht verbunden', { name: region.name }), zeit), hinzugefuegt: [], status: 'ohne-spotify' }
  }
  if (!z.playlist?.id) {
    return { z: protolog(z, 'fehler', t('Noch keine Playlist verknüpft'), zeit), hinzugefuegt: [], status: 'ohne-playlist' }
  }

  // 1. Quellen fragen, genaueste Ebene zuerst
  let { funde, meldungen } = await sammle(region, ebenenFolge(region), { quellen, cfg, wunsch: cfg.titelJeOrt * 2, signal })
  for (const m of meldungen) z = protolog(z, m.nichtEingerichtet ? 'info' : 'fehler', `${m.quelle}: ${m.text}`, zeit)
  // Was in der Gegend gehört wird: Playlisten, die nach dem Ort heißen (nur mit Spotify)
  let gegend = []
  if (spotify.gegendTitel && region.ebene !== 'land') {
    try {
      const g = await spotify.gegendTitel([region.name, region.naechsterOrt], { markt: region.land || null })
      gegend = g.titel
      z = protolog(z, 'info', t('{name}: {n} Titel aus {listen} Playlisten der Gegend', { name: region.name, n: gegend.length, listen: g.gelesen }) + (g.listen > g.gelesen ? t(' ({wert} ließ Spotify nicht lesen)', { wert: g.listen - g.gelesen }) : ''), zeit)
    } catch (e) { z = protolog(z, 'fehler', t('Playlisten der Gegend: {message}', { message: e.message }), zeit) }
  }
  // Bands aus der Gegend: beliebte zuerst, mit ihrem meistgehörten Titel
  if (beliebtheit) {
    const bands = funde.filter((t) => t.art === 'herkunft')
    try { const sortiert = await beliebtheit(bands, { cfg, signal }); funde = [...sortiert, ...funde.filter((t) => t.art !== 'herkunft')] } catch {}
  }
  funde = [...funde, ...gegend]
  const lokal = funde.filter((t) => !istGehoert(t))
  z = protolog(z, 'info', `${region.name}: ${lokal.length} Künstler aus der Gegend, davon ${lokal.filter((t) => t.stil).length} im Lieblingsstil; ${funde.filter((t) => t.art === 'beliebt').length} Chart-Titel`, zeit)
  if (!funde.length) {
    z = ausstehendWeg(regionMerken(z, region, 'keine-daten', zeit), region.id)
    return { z: protolog(z, 'info', t('{name}: keine Musikdaten gefunden, Playlist unverändert', { name: region.name }), zeit), hinzugefuegt: [], status: 'keine-daten' }
  }

  // 2. Erst lesen, was schon in der Playlist steht (Stand bei Spotify, nicht nur das Gedächtnis des
  //    Geräts). Bis 29.10.2026 geschah das erst nach der Auswahl: standen 7 von 10 schon drin, kamen
  //    nur 3 dazu, obwohl es mehr gab. Jetzt füllen neue Titel die „Titel je Ort“.
  let inPlaylist = new Set()
  try { inPlaylist = new Set(await spotify.playlistIds(z.playlist.id)) } catch (e) { z = protolog(z, 'fehler', t('Playlist lesen: {message}', { message: e.message }), zeit) }
  const bekannt = bekannteIds(z)
  const kandidaten = [], doppelt = []
  // Viele Bands aus der Gegend sind nicht bei Spotify: lieber mehr Kandidaten prüfen
  let fehlerFolge = 0, letzterFehler = ''
  // Charts höchstens ein Drittel; der Rest gehört den Künstlern aus der Gegend.
  // Finden sich nicht genug davon bei Spotify, füllen die zurückgestellten Charts auf.
  const chartsMax = Math.max(1, Math.round(cfg.titelJeOrt / 3))
  const zurueck = []
  const liste = mische(funde, cfg.titelJeOrt * 6)
  for (let i = 0; i < liste.length || zurueck.length; i++) {
    if (kandidaten.length >= cfg.titelJeOrt) break
    let tr
    if (i < liste.length) {
      tr = liste[i]
      if (istGehoert(tr) && kandidaten.filter(istGehoert).length >= chartsMax) { zurueck.push(tr); continue }
    } else tr = zurueck.shift()
    let treffer = null
    // Titel aus einer Spotify-Playlist sind schon gefunden
    if (tr.spotifyId) treffer = { spotifyId: tr.spotifyId, uri: tr.uri, titel: tr.titel, kuenstler: tr.kuenstler }
    else try { treffer = await spotify.findeTitel({ ...tr, markt: region.land || null }); fehlerFolge = 0 } catch (e) {
      // Gleicher Fehler mehrmals hintereinander (Berechtigung, Netz): abbrechen statt 40 Zeilen Protokoll
      fehlerFolge = letzterFehler === e.message ? fehlerFolge + 1 : 1; letzterFehler = e.message
      if (fehlerFolge === 1) z = protolog(z, 'fehler', t('Suche „{wert}“: {message}', { wert: tr.titel || tr.kuenstler, message: e.message }), zeit)
      if (fehlerFolge >= 3) { z = protolog(z, 'fehler', t('Suche abgebrochen, derselbe Fehler kam mehrmals'), zeit); break }
      continue
    }
    if (!treffer?.spotifyId || bekannt.has(treffer.spotifyId) || kandidaten.some((k) => k.spotifyId === treffer.spotifyId) || doppelt.some((k) => k.spotifyId === treffer.spotifyId)) continue
    const k = { ...treffer, quelle: tr.quelle, ebene: tr.ebene, art: tr.art, stil: tr.stil || null, gebiet: tr.gebiet || region.name, regionId: region.id, regionName: region.name }
    // Steht schon in der Playlist: merken (damit es nie doppelt hineinkommt), aber den Platz nicht belegen
    if (inPlaylist.has(k.spotifyId)) { doppelt.push(k); continue }
    kandidaten.push(k)
  }
  if (doppelt.length) z = alsDoppelt(vormerken(z, doppelt, { zeit }).z, doppelt.map((k) => k.spotifyId))
  if (!kandidaten.length) {
    z = ausstehendWeg(regionMerken(z, region, 'nichts-neues', zeit), region.id)
    const text = doppelt.length ? t('{name}: alles schon in der Playlist', { name: region.name }) : t('{name}: nichts Neues für die Playlist', { name: region.name })
    return { z: protolog(z, 'info', text, zeit), hinzugefuegt: [], status: 'nichts-neues' }
  }

  // 3. Vormerken (wartend), damit ein Abbruch beim Schreiben nichts doppelt hinterlässt
  const neu = kandidaten
  z = vormerken(z, kandidaten, { zeit }).z

  // 4. Hinzufügen. Bei unklarem Ausgang erst nachsehen, dann entscheiden (nie blind doppelt schreiben)
  const ids = neu.map((k) => k.spotifyId)
  let bestaetigt = []
  try {
    const antwort = await spotify.hinzufuegen(z.playlist.id, neu.map((k) => k.uri || `spotify:track:${k.spotifyId}`))
    if (antwort?.ok) bestaetigt = ids
    else throw new Error(antwort?.fehler || t('Spotify hat nicht bestätigt'))
  } catch (e) {
    try {
      const jetzt = new Set(await spotify.playlistIds(z.playlist.id))
      bestaetigt = ids.filter((id) => jetzt.has(id))
      const fehlen = ids.filter((id) => !jetzt.has(id))
      if (fehlen.length) z = alsFehler(z, fehlen, e.message)
    } catch (e2) {
      z = alsFehler(z, ids, `unklar (${e.message}); Nachprüfen schlug fehl: ${e2.message}`)
    }
  }
  if (bestaetigt.length) z = alsHinzugefuegt(z, bestaetigt, zeit)
  z = ausstehendWeg(regionMerken(z, region, bestaetigt.length ? 'fertig' : 'fehler', zeit), region.id)
  z = protolog(z, bestaetigt.length ? 'ok' : 'fehler', t('{name}: {length} von {length2} Titeln hinzugefügt', { name: region.name, length: bestaetigt.length, length2: ids.length }), zeit)
  return { z, hinzugefuegt: bestaetigt, status: bestaetigt.length ? 'ok' : 'fehler' }
}

const protolog = (z, art, text, zeit) => protokolliere(z, art, text, zeit)
