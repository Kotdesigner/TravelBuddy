// Musik unterwegs: der Dienst, der im Hintergrund der offenen App läuft.
//
// - Ist „Musik unterwegs“ eingeschaltet und der Standort freigegeben, beobachtet er die
//   Position sparsam (ohne Hochgenauigkeit, alte Werte bis 5 min sind recht).
// - Jede Position geht durch ortPruefen(); nur bei einem relevanten Wechsel wird gesucht.
// - Kommt das Netz zurück, holt er offline erkannte Regionen nach.
// - Hintergrund-Ortung gibt es nicht: Eine Web-App auf dem iPhone läuft nur, solange sie
//   offen ist. Das ist eine Grenze der Plattform, keine Einstellung.

import { get } from 'svelte/store'
import { musik, musikCfg, aendere, musikLaden } from './speicher.js'
import { ortPruefen, suchlauf } from './ablauf.js'
import { QUELLEN, ordneNachBeliebtheit } from './quellen.js'
import { spotify, istVerbunden, rueckspungDaten, weiterreichenNachLocalhost, aktuelleUmgebung, PLAYLIST_ID } from './spotify.js'
import { protokolliere, vonVorn, eigeneUris } from './zustand.js'
import { ortFuerPosition, umgebungFuer } from './ortname.js'
import { km } from './region.js'
import { t } from '../i18n.js'
let letzteWelt = null, letzteUmgebung = null

let beobachter = null, laeuft = false, orte = []

export function setzeOrte(liste) { orte = liste || [] }

function deps() {
  return {
    quellen: QUELLEN,
    online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
    cfg: get(musikCfg),
    spotify: { verbunden: istVerbunden(), ...spotify },
    beliebtheit: ordneNachBeliebtheit,
  }
}

/** Die Playlist aus den Einstellungen mit dem Konto verknüpfen und prüfen, ob sie dem Konto gehört. */
export async function playlistVerbinden({ linkOderId } = {}) {
  const cfg = get(musikCfg)
  const pl = await spotify.playlistHolen(linkOderId || cfg.playlistId || PLAYLIST_ID)
  const ich = await spotify.ich()
  if (pl.besitzer && pl.besitzer !== ich.id) throw new Error(t('„{name}“ gehört einem anderen Konto. Titel lassen sich nur in eigene Playlists eintragen.', { name: pl.name }))
  aendere((z) => protokolliere({ ...z, playlist: { id: pl.id, name: pl.name, url: pl.url } }, 'ok', t('Playlist „{name}“ verknüpft (Konto {name2})', { name: pl.name, name2: ich.name })))
  if (pl.id !== cfg.playlistId) musikCfg.update((c) => ({ ...c, playlistId: pl.id }))
  return { playlist: pl, ich }
}

/** Eine Position verarbeiten (GPS oder von Hand gewählt). */
export async function position(pos, { vonHand = false } = {}) {
  if (laeuft) return
  const cfg = get(musikCfg)
  const p = { lat: pos.lat, lon: pos.lon, zeit: pos.zeit || Date.now() }
  const r = vonHand
    ? { z: { ...get(musik), letzterOrt: null }, faellig: true }
    : null
  let pruef = ortPruefen(r ? r.z : get(musik), p, { orte, cfg })
  if (!pruef.faellig) return { faellig: false, grund: pruef.grund, region: pruef.region }
  // Außerhalb Australiens kennt die Ortssammlung nichts: Ortsnamen online nachschlagen
  if (pruef.region.ebene === 'land' && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
    try {
      // Gleicher Fleck wie beim letzten Nachschlagen (unter 3 km): Antwort wiederverwenden
      let welt = letzteWelt && km(letzteWelt.pos, p) < 3 ? letzteWelt.region : null
      if (!welt) { welt = await ortFuerPosition(p); letzteWelt = { pos: p, region: welt } }
      if (welt) pruef = ortPruefen(r ? r.z : get(musik), p, { orte, cfg, region: welt })
    } catch (e) { aendere((z) => protokolliere(z, 'info', t('Ortsname: ') + e.message)) }
  }
  // Umkreis (nah bis 35 km, weit bis zum eingestellten Radius), überall auf der Welt
  if (typeof navigator === 'undefined' || navigator.onLine !== false) {
    const radiusKm = Math.max(25, Math.min(300, Number(cfg.umkreisKm) || 200))
    try {
      let um = letzteUmgebung && letzteUmgebung.radiusKm === radiusKm && km(letzteUmgebung.pos, p) < 5 ? letzteUmgebung.um : null
      if (!um) {
        um = await umgebungFuer(p, { radiusKm, eigener: pruef.region.welt ? pruef.region.name : (pruef.region.naechsterOrt || pruef.region.name), kreis: pruef.region.kreis })
        if (um.quelle !== 'keine') letzteUmgebung = { pos: p, radiusKm, um }
      }
      if (um.quelle === 'keine') aendere((z) => protokolliere(z, 'fehler', t('Umkreis nicht gefunden (') + (um.fehler || []).join('; ') + t('), nur Kreis und Bundesland')))
      else if (um.quelle !== 'speicher') aendere((z) => protokolliere(z, 'info', t('Umkreis über {quelle}: {length} Orte nah, {length2} weiter weg', { quelle: um.quelle, length: um.nah.length, length2: um.weit.length })))
      pruef = { ...pruef, region: { ...pruef.region, umgebung: um.nah, umgebungWeit: um.weit } }
    } catch (e) { aendere((z) => protokolliere(z, 'info', t('Umkreis: ') + e.message)) }
  }
  laeuft = true
  try {
    musik.set(protokolliere(pruef.z, 'info', `${pruef.region.name} (${pruef.grund})`))
    if (istVerbunden() && !get(musik).playlist?.id) {
      try { await playlistVerbinden() } catch (e) { aendere((z) => protokolliere(z, 'fehler', t('Playlist: ') + e.message)) }
    }
    const erg = await suchlauf(get(musik), pruef.region, deps())
    musik.set(erg.z)
    return { faellig: true, region: pruef.region, ...erg }
  } finally { laeuft = false }
}

/** Offline vorgemerkte Regionen nachholen. */
export async function nachholen() {
  const z = get(musik)
  if (!z.ausstehend.length || laeuft) return
  laeuft = true
  try {
    for (const id of [...z.ausstehend]) {
      const reg = get(musik).regionen[id]
      if (!reg) continue
      const erg = await suchlauf(get(musik), { ...reg, id }, deps())
      musik.set(erg.z)
      if (erg.status === 'ausstehend' || erg.status === 'ohne-spotify') break
    }
  } finally { laeuft = false }
}

export function beobachten(an) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return
  if (an && !beobachter) {
    const id = navigator.geolocation.watchPosition(
      (p) => position({ lat: p.coords.latitude, lon: p.coords.longitude, zeit: Date.now() }),
      () => {},
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 30000 },
    )
    beobachter = id
  } else if (!an && beobachter != null) {
    navigator.geolocation.clearWatch(beobachter)
    beobachter = null
  }
}

/** Beim App-Start: laden, Rücksprung von Spotify erkennen, bei Bedarf beobachten. */
export async function starteMusik({ meldung = () => {} } = {}) {
  await musikLaden()
  const r = rueckspungDaten()
  if (r) {
    const weiter = weiterreichenNachLocalhost()
    if (weiter) { location.replace(weiter); return }
    // Adresse aufräumen, damit ein Neuladen den Code nicht noch einmal schickt
    try { history.replaceState(null, '', location.origin + location.pathname + '#/mehr/musik'); window.dispatchEvent(new HashChangeEvent('hashchange')) } catch {}
    if (r.fehler) meldung(t('Spotify-Anmeldung abgebrochen'), 'info')
    else {
      try {
        await spotify.codeEinloesen(r)
        aendere((z) => protokolliere(z, 'ok', t('Mit Spotify verbunden')))
        try { const { playlist } = await playlistVerbinden(); meldung(t('Mit Spotify verbunden, Playlist „{name}“', { name: playlist.name }), 'ok') }
        catch (e) { aendere((z) => protokolliere(z, 'fehler', t('Playlist: ') + e.message)); meldung(t('Verbunden, aber Playlist: ') + e.message, 'info') }
      }
      catch (e) {
        // Am iPhone kommt der Rücksprung manchmal in Safari an statt in der App vom Home-Bildschirm
        const tipp = aktuelleUmgebung().iosSafari ? ' ' + t('Am iPhone in TravelBuddy vom Home-Bildschirm verbinden, nicht in Safari.') : ''
        aendere((z) => protokolliere(z, 'fehler', t('Anmeldung: ') + e.message + tipp)); meldung(t('Spotify-Anmeldung: ') + e.message + tipp, 'info')
      }
    }
  }
  musikCfg.subscribe((c) => beobachten(!!c.aktiv))
  if (typeof window !== 'undefined') window.addEventListener('online', () => nachholen())
}

/** Von vorne anfangen. Mit ausPlaylist nimmt Spotify nur die Titel wieder heraus, die
 *  TravelBuddy selbst eingetragen hat; selbst hinzugefügte Titel bleiben. */
export async function vonVorneAnfangen({ ausPlaylist = false } = {}) {
  const z = get(musik)
  let entfernt = 0
  if (ausPlaylist) {
    const uris = eigeneUris(z)
    const id = z.playlist?.id || get(musikCfg).playlistId
    if (uris.length) {
      if (!istVerbunden()) throw new Error(t('Für das Herausnehmen erst mit Spotify verbinden'))
      if (!id) throw new Error(t('Keine Playlist verknüpft'))
      entfernt = await spotify.entfernen(id, uris)
    }
  }
  letzteWelt = null; letzteUmgebung = null
  aendere((alt) => vonVorn(alt, { entfernt }))
  return { entfernt }
}
