// Musik unterwegs: Spotify (Anmeldung und Playlist, PlaylistManager)
//
// Anmeldung ohne Geheimnis: „Authorization Code mit PKCE“. Die App braucht nur die
// Client-ID einer eigenen Spotify-Entwickler-App; ein Client Secret kommt nie in den Code.
// Das Token liegt nur auf diesem Gerät (localStorage) und lässt sich jederzeit trennen.
//
// Stand der Spotify-Schnittstelle laut Änderungsliste Februar 2026 (geprüft am 10.10.2026):
//   - Hinzufügen:      POST /v1/playlists/{id}/items  (früher …/tracks)
//   - Inhalt lesen:    GET  /v1/playlists/{id}/items  (nur eigene Playlists)
//   - Suche:           GET  /v1/search?type=track, höchstens 10 Treffer je Abruf
//   - Anlegen:         über /me (POST /users/{id}/playlists gibt es nicht mehr)
//   - keine Beliebtheitswerte mehr an Titeln, keine Top-Titel je Künstler
//   - Entwicklungsmodus: Premium nötig, höchstens 5 Nutzer
//
// Die Funktionen bekommen ihr fetch hineingereicht (Vorgabe: das echte), damit die Tests
// ohne Netz laufen.

import { CLIENT_ID, PLAYLIST_ID } from './spotify-ids.js'
import { t } from '../i18n.js'
export { CLIENT_ID, PLAYLIST_ID }
export const SCOPES = ['playlist-modify-private', 'playlist-modify-public', 'playlist-read-private']
const TOKEN_KEY = 'tb-spotify-token'
const PKCE_KEY = 'tb-spotify-pkce'

// ---------- PKCE ----------
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export function erzeugeVerifier(laenge = 64) {
  const zeichen = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const zufall = crypto.getRandomValues(new Uint8Array(laenge))
  return Array.from(zufall, (b) => zeichen[b % zeichen.length]).join('')
}
export async function challengeVon(verifier) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return b64url(new Uint8Array(hash))
}
export function anmeldeUrl({ clientId, redirectUri, challenge, state, scopes = SCOPES }) {
  const p = new URLSearchParams({
    response_type: 'code', client_id: clientId, redirect_uri: redirectUri,
    code_challenge_method: 'S256', code_challenge: challenge, state, scope: scopes.join(' '),
  })
  return 'https://accounts.spotify.com/authorize?' + p.toString()
}

/** Schritt 1: zu Spotify weiterleiten. Merkt sich Verifier und Rücksprung. */
export async function anmelden({ clientId, redirectUri }) {
  if (!clientId) throw new Error(t('Client-ID fehlt'))
  const verifier = erzeugeVerifier()
  const state = erzeugeVerifier(16)
  const challenge = await challengeVon(verifier)
  const pk = JSON.stringify({ verifier, state, redirectUri, clientId, ruecksprung: location.hash || '#/mehr/musik', zeit: Date.now() })
  try { sessionStorage.setItem(PKCE_KEY, pk) } catch {}
  // Zusätzlich in localStorage: Die Web-App auf dem iPhone-Home-Bildschirm verliert den
  // sessionStorage, wenn iOS sie während der Spotify-Anmeldung kurz beiseitelegt.
  try { localStorage.setItem(PKCE_KEY, pk) } catch {}
  location.assign(anmeldeUrl({ clientId, redirectUri, challenge, state }))
}

/** Rücksprung-Adresse für Spotify. Spotify nimmt „localhost“ nicht an, 127.0.0.1 aber schon:
    Am Mac geht der Rücksprung deshalb an 127.0.0.1 und wird von dort an localhost weitergereicht. */
export function rueckAdresseFuer(loc = typeof location !== 'undefined' ? location : null) {
  if (!loc) return ''
  if (loc.hostname === 'localhost') return `http://127.0.0.1${loc.port ? ':' + loc.port : ''}/`
  return loc.origin + '/'
}

/**
 * Wo läuft die App? Für die Einrichtung am iPhone: Safari und die App vom Home-Bildschirm
 * haben getrennte Speicher, die Spotify-Anmeldung gilt nur in dem, in dem sie geschah.
 * iPadOS meldet sich als Mac, verrät sich aber über den Touchscreen.
 */
export function laufumgebung({ ua = '', touch = 0, standalone = false, hostname = '' } = {}) {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1)
  return { ios, standalone: !!standalone, lokal: /^(localhost|127\.0\.0\.1)$/.test(hostname), iosSafari: ios && !standalone }
}
export function aktuelleUmgebung() {
  if (typeof navigator === 'undefined' || typeof location === 'undefined') return laufumgebung()
  let standalone = navigator.standalone === true
  try { standalone = standalone || matchMedia('(display-mode: standalone)').matches } catch {}
  return laufumgebung({ ua: navigator.userAgent || '', touch: navigator.maxTouchPoints || 0, standalone, hostname: location.hostname })
}

/** Kommt der Rücksprung auf 127.0.0.1 an, die Anmeldung wurde aber unter localhost begonnen,
    dorthin weiterreichen (nur der einmalige Code, kein Token). */
export function weiterreichenNachLocalhost(loc = typeof location !== 'undefined' ? location : null) {
  if (!loc || loc.hostname !== '127.0.0.1') return null
  let eigene = null
  try { eigene = sessionStorage.getItem(PKCE_KEY) } catch {}
  if (eigene) return null   // hier selbst begonnen
  return loc.href.replace('//127.0.0.1', '//localhost')
}

/** Liegt im Adressfeld ein Rücksprung von Spotify (?code=…&state=…)? */
export function rueckspungDaten(href = typeof location !== 'undefined' ? location.href : '') {
  try {
    const u = new URL(href)
    const code = u.searchParams.get('code'), state = u.searchParams.get('state'), fehler = u.searchParams.get('error')
    if (!code && !fehler) return null
    return { code, state, fehler }
  } catch { return null }
}

// ---------- Token ----------
export function gespeichertesToken() {
  try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null') } catch { return null }
}
export function speichereToken(t) { try { localStorage.setItem(TOKEN_KEY, JSON.stringify(t)) } catch {} }
export function trennen() { try { localStorage.removeItem(TOKEN_KEY) } catch {} }
export const istVerbunden = () => !!gespeichertesToken()?.refresh_token

// ---------- Abrufe ----------
const API = 'https://api.spotify.com/v1'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const schlaf = (ms) => new Promise((r) => setTimeout(r, ms))
let laufendesErneuern = null

export class SpotifyFehler extends Error {
  constructor(text, status) { super(text); this.name = 'SpotifyFehler'; this.status = status }
}

function lesbar(status, inhalt) {
  const m = inhalt?.error?.message || inhalt?.error_description || inhalt?.error || ''
  if (status === 401) return t('Anmeldung abgelaufen, bitte neu verbinden')
  if (status === 403 && /scope/i.test(m)) return t('Der App fehlt bei Spotify eine Berechtigung (') + m + t('). Spotify trennen und neu verbinden.')
  if (status === 403) return t('Spotify verweigert den Zugriff') + (m ? ` (${m})` : '') + t('. Ist dein Konto in der Spotify-App unter „User Management“ eingetragen und hast du Premium?')
  if (status === 404) return t('Nicht gefunden') + (m ? ` (${m})` : '')
  if (status === 429) return t('Spotify bremst gerade (zu viele Anfragen)')
  if (status >= 500) return t('Spotify ist gerade nicht erreichbar')
  return m || t('Fehler {status}', { status })
}

async function tokenAbruf(felder, f = fetch) {
  const r = await f(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(felder).toString() })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new SpotifyFehler(r.status === 400 ? t('Spotify hat die Anmeldung abgelehnt') + (j.error_description ? ` (${j.error_description})` : '') : lesbar(r.status, j), r.status)
  return j
}
const alsToken = (j, alt = {}) => ({
  access_token: j.access_token,
  refresh_token: j.refresh_token || alt.refresh_token,   // Spotify schickt nicht immer ein neues
  ablauf: Date.now() + ((j.expires_in || 3600) - 60) * 1000,
  scope: j.scope || alt.scope,
  clientId: alt.clientId,
})

/** Gültiges Zugangs-Token, bei Bedarf erneuert. Mehrere gleichzeitige Abrufe erneuern nur einmal. */
export async function zugang({ f = fetch, erzwingen = false } = {}) {
  const tok = gespeichertesToken()
  if (!tok?.refresh_token) throw new SpotifyFehler(t('Spotify ist nicht verbunden'), 401)
  if (!erzwingen && tok.access_token && tok.ablauf > Date.now()) return tok.access_token
  if (!laufendesErneuern) {
    laufendesErneuern = (async () => {
      try {
        const j = await tokenAbruf({ grant_type: 'refresh_token', refresh_token: tok.refresh_token, client_id: tok.clientId || CLIENT_ID }, f)
        const neu = alsToken(j, tok)
        speichereToken(neu)
        return neu.access_token
      } catch (e) {
        if (e.status === 400) trennen()   // Erneuerung widerrufen: sauber trennen statt endlos scheitern
        throw e
      } finally { laufendesErneuern = null }
    })()
  }
  return laufendesErneuern
}

/** Eine Hülle für alle Abrufe: Token, 401 einmal erneuern, 429 warten, 5xx einmal wiederholen. */
export async function abruf(pfad, { method = 'GET', body, f = fetch, versuch = 0 } = {}) {
  const token = await zugang({ f })
  let r
  try {
    r = await f(pfad.startsWith('http') ? pfad : API + pfad, {
      method, headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (e) {
    if (versuch < 1) { await schlaf(800); return abruf(pfad, { method, body, f, versuch: versuch + 1 }) }
    throw new SpotifyFehler(t('Keine Verbindung zu Spotify'), 0)
  }
  if (r.status === 401 && versuch < 1) { await zugang({ f, erzwingen: true }); return abruf(pfad, { method, body, f, versuch: versuch + 1 }) }
  if (r.status === 429 && versuch < 2) {
    const s = Math.min(30, +(r.headers?.get?.('Retry-After')) || 2)
    await schlaf(s * 1000); return abruf(pfad, { method, body, f, versuch: versuch + 1 })
  }
  if (r.status >= 500 && versuch < 1 && method === 'GET') { await schlaf(1000); return abruf(pfad, { method, body, f, versuch: versuch + 1 }) }
  if (r.status === 204) return {}
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new SpotifyFehler(lesbar(r.status, j), r.status)
  return j
}

// ---------- Abgleich: ist der Treffer wirklich der gesuchte Titel? ----------
export const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\s*[([].*?[)\]]\s*/g, ' ').replace(/\s+-\s+.*$/, '').replace(/^the\s+/, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim()
const kuenstlerPasst = (track, name) => (track.artists || []).some((a) => norm(a.name) === norm(name))
const titelPasst = (track, titel) => { const a = norm(track.name), b = norm(titel); return a === b || a.startsWith(b + ' ') || b.startsWith(a + ' ') }

/** Wählt aus Suchtreffern den passenden. Ohne Titel (nur Künstler bekannt): dessen meistgehörter
    Treffer, wenn Spotify die Beliebtheit mitliefert, sonst der erste. */
export function waehleTreffer(tracks, { titel, kuenstler }) {
  const passend = (tracks || []).filter((t) => t && t.id && kuenstlerPasst(t, kuenstler) && (!titel || titelPasst(t, titel)))
  if (!titel && passend.some((t) => typeof t.popularity === 'number')) passend.sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
  const t = passend[0]
  if (!t) return null
  return { spotifyId: t.id, uri: t.uri, url: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`, titel: t.name, kuenstler: (t.artists || []).map((a) => a.name).join(', ') }
}

const zitat = (s) => '"' + String(s).replace(/"/g, '') + '"'

export const spotify = {
  /** Schritt 2 der Anmeldung: Code gegen Token tauschen. */
  async codeEinloesen({ code, state }, { f = fetch } = {}) {
    let pk = null
    try { pk = JSON.parse(sessionStorage.getItem(PKCE_KEY) || 'null') } catch {}
    if (!pk) {
      try { const l = JSON.parse(localStorage.getItem(PKCE_KEY) || 'null'); if (l && Date.now() - (l.zeit || 0) < 15 * 60e3) pk = l } catch {}
    }
    try { sessionStorage.removeItem(PKCE_KEY) } catch {}
    try { localStorage.removeItem(PKCE_KEY) } catch {}
    if (!pk?.verifier) throw new SpotifyFehler(t('Anmeldung nicht in diesem Fenster begonnen, bitte noch einmal verbinden'))
    if (pk.state !== state) throw new SpotifyFehler(t('Rücksprung passt nicht zur Anmeldung, bitte noch einmal verbinden'))
    const j = await tokenAbruf({ grant_type: 'authorization_code', code, redirect_uri: pk.redirectUri, client_id: pk.clientId || CLIENT_ID, code_verifier: pk.verifier }, f)
    speichereToken(alsToken(j, { clientId: pk.clientId || CLIENT_ID }))
    return { ruecksprung: pk.ruecksprung }
  },

  async ich({ f = fetch } = {}) {
    const j = await abruf('/me', { f })
    return { id: j.id, name: j.display_name || j.id, produkt: j.product || null }
  },

  /** Titel suchen. Nur ein eindeutig passender Treffer zählt, sonst null. */
  async findeTitel(t, { f = fetch } = {}) {
    const q = t.titel ? `track:${zitat(t.titel)} artist:${zitat(t.kuenstler)}` : `artist:${zitat(t.kuenstler)}`
    // Land aus dem Standort (z. B. DE, AU). „from_token“ bräuchte eine zusätzliche Berechtigung.
    const markt = /^[A-Z]{2}$/.test(t.markt || '') ? `&market=${t.markt}` : ''
    const j = await abruf(`/search?type=track&limit=10${markt}&q=${encodeURIComponent(q)}`, { f })
    let treffer = waehleTreffer(j.tracks?.items, t)
    if (!treffer && t.titel) {
      // zweiter Versuch ohne Feldfilter (hilft bei Schreibweisen wie „feat.“)
      const j2 = await abruf(`/search?type=track&limit=10${markt}&q=${encodeURIComponent(t.titel + ' ' + t.kuenstler)}`, { f })
      treffer = waehleTreffer(j2.tracks?.items, t)
    }
    return treffer
  },

  /**
   * Was in der Gegend gehört wird (29.10.2026): öffentliche Playlisten, die nach dem Ort heißen
   * („Broome Vibes“, „Perth Summer“), und deren Titel. Spotifys eigene Listen lässt Spotify
   * Entwickler-Apps nicht lesen; die werden übersprungen. Liefert schon fertige Spotify-Titel.
   */
  async gegendTitel(namen, { markt = null, f = fetch, jeListe = 50 } = {}) {
    const out = [], gesehen = new Set(), listen = []
    const mk = /^[A-Z]{2}$/.test(markt || '') ? `&market=${markt}` : ''
    for (const name of [...new Set((namen || []).filter(Boolean))].slice(0, 2)) {
      const n = ' ' + norm(name) + ' '
      const j = await abruf(`/search?type=playlist&limit=20${mk}&q=${encodeURIComponent(name)}`, { f })
      for (const pl of j.playlists?.items || []) {
        if (!pl?.id || pl.owner?.id === 'spotify' || listen.some((x) => x.id === pl.id)) continue
        if ((' ' + norm(pl.name) + ' ').includes(n)) listen.push(pl)
      }
    }
    let gelesen = 0
    for (const pl of listen.slice(0, 4)) {
      let k
      try { k = await abruf(`/playlists/${pl.id}/items?limit=${jeListe}`, { f }) } catch { continue }
      gelesen++
      for (const e of k.items || []) {
        const tr = e.item || e.track
        if (!tr?.id || (tr.type && tr.type !== 'track') || gesehen.has(tr.id)) continue
        gesehen.add(tr.id)
        out.push({ spotifyId: tr.id, uri: tr.uri, titel: tr.name, kuenstler: (tr.artists || []).map((a) => a.name).join(', '),
          beliebtheit: typeof tr.popularity === 'number' ? tr.popularity : null, art: 'gegend', ebene: 'stadt', gebiet: pl.name, quelle: 'Spotify-Playlist' })
      }
    }
    // Beliebteste zuerst, wenn Spotify die Zahl mitliefert; sonst bunt gemischt
    if (out.some((x) => x.beliebtheit != null)) out.sort((a, b) => (b.beliebtheit || 0) - (a.beliebtheit || 0))
    else for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[out[i], out[j]] = [out[j], out[i]] }
    return { titel: out, listen: listen.length, gelesen }
  },

  /** Playlist anlegen (über /me, privat) */
  async playlistAnlegen(name, { f = fetch } = {}) {
    const j = await abruf('/me/playlists', { method: 'POST', body: { name, public: false, description: t('Musik aus den Gegenden meiner Reise, gesammelt von TravelBuddy') }, f })
    return { id: j.id, name: j.name, url: j.external_urls?.spotify || `https://open.spotify.com/playlist/${j.id}` }
  },

  /** Vorhandene Playlist prüfen (Link oder ID) */
  async playlistHolen(linkOderId, { f = fetch } = {}) {
    const id = playlistIdAus(linkOderId)
    if (!id) throw new SpotifyFehler(t('Das ist kein Playlist-Link'))
    const j = await abruf(`/playlists/${id}?fields=id,name,external_urls,owner(id)`, { f })
    return { id: j.id, name: j.name, url: j.external_urls?.spotify || `https://open.spotify.com/playlist/${j.id}`, besitzer: j.owner?.id }
  },

  /** Track-IDs, die schon in der Playlist stehen (seitenweise) */
  async playlistIds(id, { f = fetch } = {}) {
    const ids = []
    let url = `/playlists/${id}/items?limit=50`
    for (let seite = 0; url && seite < 40; seite++) {
      const j = await abruf(url, { f })
      for (const e of j.items || []) { const t = e.item || e.track; if (t?.id) ids.push(t.id) }
      url = j.next || null
    }
    return ids
  },

  /** Titel wieder herausnehmen (DELETE /items), höchstens 100 je Abruf */
  async entfernen(id, uris, { f = fetch } = {}) {
    let n = 0
    for (let i = 0; i < uris.length; i += 100) {
      const teil = uris.slice(i, i + 100)
      await abruf(`/playlists/${id}/items`, { method: 'DELETE', body: { items: teil.map((uri) => ({ uri })) }, f })
      n += teil.length
    }
    return n
  },

  /** Hinzufügen, höchstens 100 je Abruf */
  async hinzufuegen(id, uris, { f = fetch } = {}) {
    let snapshotId = null
    for (let i = 0; i < uris.length; i += 100) {
      const j = await abruf(`/playlists/${id}/items`, { method: 'POST', body: { uris: uris.slice(i, i + 100) }, f })
      snapshotId = j.snapshot_id || snapshotId
    }
    return { ok: !!snapshotId, snapshotId, fehler: snapshotId ? null : t('keine Bestätigung von Spotify') }
  },
}

export function playlistIdAus(s) {
  const t = String(s || '').trim()
  const m = t.match(/playlist[/:]([A-Za-z0-9]{22})/) || t.match(/^([A-Za-z0-9]{22})$/)
  return m ? m[1] : null
}
