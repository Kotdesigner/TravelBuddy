// Musik unterwegs (Spotify-Grundgerüst): Region, Ortswechsel, Zustand, Ablauf.
// Ausführen: node tests/musik.test.mjs
// Quellen und Spotify sind hier Attrappen. Sie prüfen den Weg, nicht echte Daten.
import { regionFuer, relevanterWechsel, staatFuer, ebenenFolge } from '../src/lib/musik/region.js'
import { LEER, vormerken, alsHinzugefuegt, neueAnzahl, alleGesehen, bekannteIds, standortVergessen } from '../src/lib/musik/zustand.js'
import { ortPruefen, suchlauf, VORGABEN } from '../src/lib/musik/ablauf.js'
import { sammle, mische, eindeutig, NichtEingerichtet, QUELLEN } from '../src/lib/musik/quellen.js'
import { anmeldeUrl, rueckspungDaten } from '../src/lib/musik/spotify.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}
const ORTE = [
  { id: 'broome', name: 'Broome', lat: -17.96, lon: 122.24, region: 'Kimberley', typ: 'Stadt' },
  { id: 'kalbarri', name: 'Kalbarri NP', lat: -27.71, lon: 114.16, region: 'Coral Coast' },
  { id: 'perth', name: 'Perth', lat: -31.95, lon: 115.86, region: 'Perth', typ: 'Stadt' },
]
const T0 = Date.parse('2037-12-20T08:00:00Z')

console.log('\n1  Region')
p('Broome: Stadt', regionFuer({ lat: -17.95, lon: 122.23 }, ORTE).ebene === 'stadt')
p('bei Kalbarri: Region „Coral Coast“', regionFuer({ lat: -27.8, lon: 114.3 }, ORTE).name === 'Coral Coast')
{
  const r = regionFuer({ lat: -24.5, lon: 120.5 }, ORTE)
  p('mitten im Outback: Bundesstaat WA', r.ebene === 'bundesstaat' && r.staat === 'WA', JSON.stringify(r))
}
p('Melbourne liegt in Victoria', staatFuer({ lat: -37.81, lon: 144.96 })?.id === 'VIC')
p('Cairns liegt in Queensland', staatFuer({ lat: -16.92, lon: 145.77 })?.id === 'QLD')
p('Frankfurt: außerhalb Australiens', regionFuer({ lat: 50.04, lon: 8.56 }, ORTE).ebene === 'land')
p('Outback fragt Bundesstaat, dann national', ebenenFolge({ ebene: 'bundesstaat' }).join(',') === 'bundesstaat,national')

console.log('\n2  Ortswechsel (10 km, 30 min)')
{
  const a = { lat: -31.95, lon: 115.86, zeit: T0, regionId: 'stadt:perth' }
  p('erster Standort löst aus', relevanterWechsel(null, a, null).ja)
  p('GPS-Zittern (200 m, 2 h) löst nicht aus', !relevanterWechsel(a, { lat: -31.952, lon: 115.861, zeit: T0 + 7200e3 }, { id: 'stadt:perth' }).ja)
  p('20 km nach 10 min: noch zu früh', !relevanterWechsel(a, { lat: -31.77, lon: 115.86, zeit: T0 + 600e3 }, { id: 'x' }).ja)
  p('20 km nach 40 min: Suche', relevanterWechsel(a, { lat: -31.77, lon: 115.86, zeit: T0 + 2400e3 }, { id: 'stadt:perth' }).ja)
  p('neue Region nach 40 min, auch wenn nah', relevanterWechsel(a, { lat: -31.96, lon: 115.87, zeit: T0 + 2400e3 }, { id: 'region:x' }).ja)
  const r1 = ortPruefen(LEER, { lat: -31.95, lon: 115.86, zeit: T0 }, { orte: ORTE })
  p('ortPruefen merkt sich den Ort nur, wenn gesucht wird', r1.faellig && r1.z.letzterOrt?.regionId === r1.region.id)
  const r2 = ortPruefen(r1.z, { lat: -31.951, lon: 115.861, zeit: T0 + 60e3 }, { orte: ORTE })
  p('… und lässt ihn bei Zittern stehen', !r2.faellig && r2.z === r1.z)
}

console.log('\n3  Zustand und Zähler')
{
  let { z, neu } = vormerken(LEER, [{ spotifyId: 'a', titel: 'A', kuenstler: 'X' }, { spotifyId: 'b', titel: 'B', kuenstler: 'Y' }])
  p('vorgemerkt heißt noch nicht neu (Zähler 0)', neu.length === 2 && neueAnzahl(z) === 0)
  z = alsHinzugefuegt(z, ['a'])
  p('erst bestätigtes Hinzufügen zählt (1)', neueAnzahl(z) === 1)
  p('bekannte IDs enthalten auch wartende', bekannteIds(z).has('b'))
  const r = vormerken(z, [{ spotifyId: 'a', titel: 'A', kuenstler: 'X' }])
  p('derselbe Titel wird nicht zweimal angelegt', r.neu.length === 0)
  z = alleGesehen(z)
  p('angesehen: Zähler wieder 0', neueAnzahl(z) === 0)
  const v = standortVergessen({ ...z, letzterOrt: { lat: 1, lon: 2 }, regionen: { x: {} } })
  p('Standort vergessen löscht Ortsbezug, Titel bleiben', !v.letzterOrt && !Object.keys(v.regionen).length && Object.keys(v.titel).length === 2)
}

console.log('\n4  Quellen')
{
  const { funde, meldungen } = await sammle({ name: 'WA' }, ['bundesstaat', 'national'], { quellen: QUELLEN, cfg: {} })
  p('ohne Bundesstaat und ohne Last.fm-Schlüssel: keine Funde, ehrliche Meldung', funde.length === 0 && meldungen.length >= 1, JSON.stringify(meldungen))
  p('Doppelte (auch „(Remastered)“) fliegen raus', eindeutig([{ titel: 'Song', kuenstler: 'A' }, { titel: 'Song (Remastered)', kuenstler: 'a' }]).length === 1)
  const m = mische([{ titel: 1, art: 'beliebt' }, { titel: 2, art: 'beliebt' }, { titel: 3, art: 'herkunft' }], 3)
  p('Mischung: zwei von hier, dann Charts', m.map((x) => x.titel).join() === '3,1,2')
}

console.log('\n5  Ablauf mit Attrappen')
const quelleAttrappe = (titel) => [{ id: 'test', name: 'Testquelle', ebenen: ['bundesstaat', 'national'], art: 'beliebt', bereit: () => ({ ok: true }), suche: async () => titel }]
const spotifyAttrappe = ({ inPlaylist = [], hinzufuegen } = {}) => {
  const liste = new Set(inPlaylist)
  return {
    verbunden: true,
    findeTitel: async (t) => ({ spotifyId: 'id-' + t.titel, uri: 'spotify:track:id-' + t.titel, titel: t.titel, kuenstler: t.kuenstler }),
    playlistIds: async () => [...liste],
    hinzufuegen: hinzufuegen ? (id, uris) => hinzufuegen(liste, uris) : async (id, uris) => { uris.forEach((u) => liste.add(u.split(':').pop())); return { ok: true } },
  }
}
const REGION = { id: 'staat:WA', name: 'Westaustralien', ebene: 'bundesstaat' }
const MIT_PL = { ...LEER, playlist: { id: 'pl1', name: 'Sounds of the Road' } }
{
  const r = await suchlauf(MIT_PL, REGION, { quellen: quelleAttrappe([]), spotify: spotifyAttrappe(), cfg: VORGABEN })
  p('keine Daten: Playlist unverändert, Zähler 0', r.status === 'keine-daten' && neueAnzahl(r.z) === 0)
}
{
  const r = await suchlauf(MIT_PL, REGION, { quellen: quelleAttrappe([{ titel: 'T1', kuenstler: 'K' }]), spotify: spotifyAttrappe(), online: false, cfg: VORGABEN })
  p('offline: Region vorgemerkt, nichts geschrieben', r.status === 'ausstehend' && r.z.ausstehend.includes('staat:WA') && neueAnzahl(r.z) === 0)
}
{
  const titel = [1, 2, 3].map((i) => ({ titel: 'T' + i, kuenstler: 'K' + i }))
  const r = await suchlauf(MIT_PL, REGION, { quellen: quelleAttrappe(titel), spotify: spotifyAttrappe({ inPlaylist: ['id-T2'] }), cfg: VORGABEN })
  p('2 neu hinzugefügt, 1 als doppelt erkannt', r.hinzugefuegt.length === 2 && r.z.titel['id-T2'].status === 'doppelt', JSON.stringify(r.hinzugefuegt))
  p('Zähler zeigt genau 2', neueAnzahl(r.z) === 2)
  const r2 = await suchlauf(r.z, REGION, { quellen: quelleAttrappe(titel), spotify: spotifyAttrappe({ inPlaylist: ['id-T1', 'id-T2', 'id-T3'] }), cfg: VORGABEN })
  p('zweiter Lauf: nichts doppelt hinzugefügt', r2.hinzugefuegt.length === 0 && neueAnzahl(r2.z) === 2)
}
{
  // Netz bricht nach dem Schreiben ab: Antwort fehlt, aber Spotify hat T1 übernommen
  const sp = spotifyAttrappe({ hinzufuegen: async (liste, uris) => { liste.add(uris[0].split(':').pop()); throw new Error('Verbindung abgebrochen') } })
  const r = await suchlauf(MIT_PL, REGION, { quellen: quelleAttrappe([{ titel: 'T1', kuenstler: 'K' }, { titel: 'T2', kuenstler: 'L' }]), spotify: sp, cfg: VORGABEN })
  p('unklarer Ausgang: nachgesehen, T1 zählt, T2 als Fehler', r.hinzugefuegt.join() === 'id-T1' && r.z.titel['id-T2'].status === 'fehler', JSON.stringify(r))
}
{
  const r = await suchlauf(MIT_PL, REGION, { quellen: quelleAttrappe([{ titel: 'T1', kuenstler: 'K' }]), spotify: spotifyAttrappe({ hinzufuegen: async () => ({ ok: false, fehler: '403' }) }), cfg: VORGABEN })
  p('abgelehnt (403): kein Zähler, Fehler vermerkt', neueAnzahl(r.z) === 0 && r.z.titel['id-T1'].status === 'fehler')
}
{
  const r = await suchlauf(LEER, REGION, { quellen: quelleAttrappe([{ titel: 'T1', kuenstler: 'K' }]), spotify: { verbunden: false }, cfg: VORGABEN })
  p('ohne Spotify: nichts passiert, Region wartet', r.status === 'ohne-spotify' && r.z.ausstehend.includes('staat:WA'))
}

console.log('\n6  Anmeldung (PKCE)')
{
  const u = new URL(anmeldeUrl({ clientId: 'abc', redirectUri: 'https://x.netlify.app/', challenge: 'CH', state: 'S' }))
  p('Anmelde-Adresse mit PKCE (S256) und ohne Secret', u.host === 'accounts.spotify.com' && u.searchParams.get('code_challenge_method') === 'S256' && !u.search.includes('secret'))
  p('Rücksprung wird erkannt', rueckspungDaten('https://x.netlify.app/?code=C1&state=S').code === 'C1')
  p('normale Adresse ist kein Rücksprung', rueckspungDaten('https://x.netlify.app/#/heute') === null)
}


console.log('\n7  Echte Abrufe mit nachgestelltem Netz')
{
  const speicher = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) } }
  globalThis.localStorage = speicher(); globalThis.sessionStorage = speicher()
  const sp = await import('../src/lib/musik/spotify.js')
  const q = await import('../src/lib/musik/quellen.js')
  const antwort = (status, body, headers = {}) => ({ ok: status >= 200 && status < 300, status, headers: { get: (k) => headers[k] }, json: async () => body })

  // MusicBrainz: Perth in Schottland fliegt raus, Gebiet muss passen
  const mb = q.mbKuenstler([
    { name: 'Tame Impala', country: 'AU', area: { name: 'Perth' }, score: 100 },
    { name: 'Schottische Band', country: 'GB', area: { name: 'Perth' }, score: 100 },
    { name: 'Ohne Land', area: { name: 'Western Australia' }, 'begin-area': { name: 'Perth' }, score: 90 },
    { name: 'Woanders', country: 'AU', area: { name: 'Sydney' }, score: 95 },
  ], 'Perth')
  p('MusicBrainz: nur australische Künstler aus dem Gebiet', mb.map((a) => a.name).join() === 'Tame Impala,Ohne Land', mb.map((a) => a.name).join())
  p('Gebiete je Ebene', q.mbGebiete({ name: 'Pilbara', naechsterOrt: 'Karratha', staat: 'WA' }, 'region').join() === 'Karratha,Pilbara' && q.mbGebiete({ staat: 'WA' }, 'bundesstaat')[0] === 'Western Australia')
  const mbQ = q.QUELLEN.find((x) => x.id === 'musicbrainz')
  let mbUrl = ''
  const mbFunde = await mbQ.suche({ name: 'Broome', staat: 'WA' }, 'stadt', { f: async (u) => { mbUrl = u; return antwort(200, { artists: [{ name: 'The Pigram Brothers', country: 'AU', 'begin-area': { name: 'Broome' }, score: 100 }] }) } })
  p('MusicBrainz-Suche: Künstler ohne Titel, Ebene Stadt', mbFunde.length === 1 && mbFunde[0].titel === null && mbFunde[0].ebene === 'stadt' && mbUrl.includes('beginarea'))
  p('Künstler ohne Titel überlebt die Doppelprüfung', q.eindeutig(mbFunde).length === 1)

  const lf = q.QUELLEN.find((x) => x.id === 'lastfm')
  const lfFunde = await lf.suche({}, 'national', { cfg: { lastfmKey: 'k' }, f: async () => antwort(200, { tracks: { track: [{ name: 'Song', artist: { name: 'Band' } }] } }) })
  p('Last.fm: Charts als „beliebt, national“', lfFunde[0].titel === 'Song' && lfFunde[0].art === 'beliebt' && lfFunde[0].ebene === 'national')
  let lfFehler = ''
  try { await lf.suche({}, 'national', { cfg: { lastfmKey: 'falsch' }, f: async () => antwort(200, { error: 10, message: 'Invalid API key' }) }) } catch (e) { lfFehler = e.message }
  p('Last.fm: falscher Schlüssel als lesbarer Fehler', lfFehler.includes('Invalid API key'))

  // Treffer-Abgleich
  const tr = (name, ...artists) => ({ id: name + artists[0], uri: 'spotify:track:' + name, name, artists: artists.map((a) => ({ name: a })) })
  p('falscher Künstler wird nicht genommen', sp.waehleTreffer([tr('Song', 'Andere Band')], { titel: 'Song', kuenstler: 'Band' }) === null)
  p('„The“, Klammern und Remaster stören nicht', !!sp.waehleTreffer([tr('Song - 2011 Remaster', 'The Band')], { titel: 'Song', kuenstler: 'Band' }))
  p('nur Künstler: erster passender Titel', sp.waehleTreffer([tr('X', 'Fremd'), tr('Hit', 'Band')], { titel: null, kuenstler: 'Band' })?.titel === 'Hit')
  p('Playlist-Link wird erkannt', sp.playlistIdAus('https://open.spotify.com/playlist/0abcDEFghiJKLmnoPQRstu?si=aa84') === '0abcDEFghiJKLmnoPQRstu' && sp.playlistIdAus('hallo') === null)
  p('Basic: keine festen Zugänge (eigene Client-ID, eigene Playlist)', sp.PLAYLIST_ID === '' && sp.CLIENT_ID === '')

  // Anmeldung abschließen
  let fehler = ''
  sessionStorage.setItem('tb-spotify-pkce', JSON.stringify({ verifier: 'V', state: 'S1', redirectUri: 'https://x/' }))
  try { await sp.spotify.codeEinloesen({ code: 'C', state: 'FALSCH' }, { f: async () => antwort(200, {}) }) } catch (e) { fehler = e.message }
  p('fremder Rücksprung (state) wird abgelehnt', fehler.includes('passt nicht'))
  sessionStorage.setItem('tb-spotify-pkce', JSON.stringify({ verifier: 'V', state: 'S1', redirectUri: 'https://x/' }))
  let tokenBody = ''
  await sp.spotify.codeEinloesen({ code: 'C', state: 'S1' }, { f: async (u, o) => { tokenBody = o.body; return antwort(200, { access_token: 'A1', refresh_token: 'R1', expires_in: 3600 }) } })
  p('Code-Tausch mit Verifier, ohne Secret', tokenBody.includes('code_verifier=V') && !tokenBody.includes('secret') && sp.istVerbunden())

  // 401 → Token erneuern → wiederholen; 429 → warten → wiederholen
  let schritte = []
  let einmal401 = true
  const f = async (u, o) => {
    if (u.includes('/api/token')) { schritte.push('erneuern'); return antwort(200, { access_token: 'A2', expires_in: 3600 }) }
    schritte.push(o.headers.Authorization)
    if (einmal401) { einmal401 = false; return antwort(401, { error: { message: 'expired' } }) }
    return antwort(200, { tracks: { items: [tr('Song', 'Band')] } })
  }
  const t = await sp.spotify.findeTitel({ titel: 'Song', kuenstler: 'Band' }, { f })
  p('abgelaufenes Token: erneuert und wiederholt', t?.titel === 'Song' && schritte.join() === 'Bearer A1,erneuern,Bearer A2', schritte.join())
  p('Refresh-Token bleibt erhalten', sp.gespeichertesToken().refresh_token === 'R1')
  let n429 = 0
  const t2 = await sp.spotify.findeTitel({ titel: 'Song', kuenstler: 'Band' }, { f: async () => (n429++ === 0 ? antwort(429, {}, { 'Retry-After': '0' }) : antwort(200, { tracks: { items: [tr('Song', 'Band')] } })) })
  p('429: kurz gewartet, dann geklappt', !!t2 && n429 === 2)
  let fehler403 = ''
  try { await sp.spotify.hinzufuegen('PL', ['spotify:track:x'], { f: async () => antwort(403, { error: { message: 'Forbidden' } }) }) } catch (e) { fehler403 = e.message }
  p('403: verständlicher Hinweis (User Management)', fehler403.includes('User Management'))
  const h = await sp.spotify.hinzufuegen('PL', ['spotify:track:x'], { f: async (u, o) => { const b = JSON.parse(o.body); return antwort(u.endsWith('/playlists/PL/items') && b.uris.length === 1 ? 201 : 400, { snapshot_id: 'SN' }) } })
  p('Hinzufügen über /items mit Bestätigung', h.ok && h.snapshotId === 'SN')
  let seiten = 0
  const ids = await sp.spotify.playlistIds('PL', { f: async (u) => { seiten++; return antwort(200, seiten === 1 ? { items: [{ item: { id: 'a' } }, { track: { id: 'b' } }], next: 'https://api.spotify.com/v1/next' } : { items: [{ item: { id: 'c' } }], next: null }) } })
  p('Mac: Rücksprung über 127.0.0.1', sp.rueckAdresseFuer({ hostname: 'localhost', port: '8900', origin: 'http://localhost:8900' }) === 'http://127.0.0.1:8900/' && sp.rueckAdresseFuer({ hostname: 'x.netlify.app', port: '', origin: 'https://x.netlify.app' }) === 'https://x.netlify.app/')
  sessionStorage.removeItem('tb-spotify-pkce')
  p('Code auf 127.0.0.1 wird an localhost weitergereicht', sp.weiterreichenNachLocalhost({ hostname: '127.0.0.1', href: 'http://127.0.0.1:8900/?code=C&state=S' }) === 'http://localhost:8900/?code=C&state=S')
  sessionStorage.setItem('tb-spotify-pkce', '{}')
  p('… außer die Anmeldung begann auf 127.0.0.1', sp.weiterreichenNachLocalhost({ hostname: '127.0.0.1', href: 'http://127.0.0.1:8900/?code=C' }) === null)
  p('Playlist seitenweise gelesen', ids.join() === 'a,b,c')
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1'
  const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15'
  p('iPhone in Safari erkannt (Anmeldung gälte nur dort)', sp.laufumgebung({ ua: IPHONE, hostname: 'x.netlify.app' }).iosSafari === true)
  p('iPhone vom Home-Bildschirm: kein Safari-Hinweis', sp.laufumgebung({ ua: IPHONE, standalone: true, hostname: 'x.netlify.app' }).iosSafari === false)
  p('iPad meldet sich als Mac, hat aber Touch → iOS', sp.laufumgebung({ ua: MAC, touch: 5 }).ios === true)
  p('Mac ist kein iOS, localhost ist lokal', !sp.laufumgebung({ ua: MAC, touch: 0, hostname: 'localhost' }).ios && sp.laufumgebung({ ua: MAC, hostname: '127.0.0.1' }).lokal)
}

console.log('\n8  Außerhalb Australiens (Anreise, Test zu Hause)')
{
  const { regionAusAdresse } = await import('../src/lib/musik/ortname.js')
  const q = await import('../src/lib/musik/quellen.js')
  const { ebenenFolge } = await import('../src/lib/musik/region.js')
  const kiel = regionAusAdresse({ address: { city: 'Kiel', state: 'Schleswig-Holstein', country: 'Germany', country_code: 'de' } })
  p('Kiel wird Stadt in DE', kiel.ebene === 'stadt' && kiel.land === 'DE' && kiel.id === 'welt:de:kiel')
  p('ohne Ort keine Region', regionAusAdresse({ address: { country_code: 'de' } }) === null)
  p('Ebenen: Stadt, Umgebung, Umkreis, Bundesland, Land', q.mbGebiete(kiel, 'stadt')[0] === 'Kiel' && q.mbGebiete(kiel, 'region').length === 0 && q.mbGebiete(kiel, 'bundesstaat')[0] === 'Schleswig-Holstein' && ebenenFolge(kiel).join() === 'stadt,region,weit,bundesstaat,national')
  const mb = q.mbKuenstler([{ name: 'Kieler Band', country: 'DE', area: { name: 'Kiel' }, score: 100 }, { name: 'Fremd', country: 'AU', area: { name: 'Kiel' }, score: 100 }], 'Kiel', 'DE')
  p('Bands aus Kiel, nur aus Deutschland', mb.map((a) => a.name).join() === 'Kieler Band')
  let url = ''
  const lf = q.QUELLEN.find((x) => x.id === 'lastfm')
  await lf.suche(kiel, 'national', { cfg: { lastfmKey: 'k' }, f: async (u) => { url = u; return { ok: true, status: 200, json: async () => ({ tracks: { track: [] } }) } } })
  p('Charts für Germany statt Australia', /country=Germany/.test(url), url)
}

console.log('\n9  Umgebung statt nur Dorf')
{
  const { umgebungAus } = await import('../src/lib/musik/ortname.js')
  const q = await import('../src/lib/musik/quellen.js')
  const pos = { lat: 54.348, lon: 10.175 }
  const ring = umgebungAus([
    { tags: { name: 'Preetz', place: 'town' }, lat: 54.235, lon: 10.28 }, { tags: { name: 'Kiel', place: 'city', population: '246306' }, lat: 54.32, lon: 10.13 },
    { tags: { name: 'Mönkeberg', place: 'town' }, lat: 54.35, lon: 10.17 }, { tags: { name: 'Hamburg', place: 'city', population: '1900000' }, lat: 53.55, lon: 10.0 },
    { tags: { name: 'Kleinstadt weit', place: 'town', population: '3000' }, lat: 53.6, lon: 10.2 }, { tags: { name: 'Berlin', place: 'city' }, lat: 52.52, lon: 13.4 }],
    { eigener: 'Mönkeberg', kreis: 'Kreis Plön', pos, radiusKm: 200 })
  const um = ring.nah
  p('nah: Kiel zuerst, Kreis Plön dabei, eigener Ort nicht', um[0] === 'Kiel' && um.includes('Plön') && um.includes('Preetz') && !um.includes('Mönkeberg'), um.join())
  p('weit: Hamburg ja, kleine Orte und Berlin (über 200 km) nicht', ring.weit.join() === 'Hamburg', ring.weit.join())
  const reg = { name: 'Mönkeberg', ebene: 'stadt', welt: true, land: 'DE', staatName: 'Schleswig-Holstein', umgebung: um, umgebungWeit: ring.weit }
  let url = ''
  const mb = q.QUELLEN.find((x) => x.id === 'musicbrainz')
  const funde = await mb.suche(reg, 'region', { f: async (u) => { url = decodeURIComponent(u); return { ok: true, status: 200, json: async () => ({ count: 3, artists: [
    { name: 'Ølgod', area: { name: 'Kiel' }, score: 60 }, { name: 'Preetzer', country: 'DE', 'begin-area': { name: 'Preetz' } }, { name: 'Woanders', country: 'DE', area: { name: 'Hamburg' } }] }) } } })
  p('eine Abfrage für alle Orte der Umgebung', /area:"Kiel"/.test(url) && /area:"Plön"/.test(url) && /area:"Preetz"/.test(url), url.slice(0, 200))
  p('Bands aus Kiel und Preetz, nicht aus Hamburg', funde.map((x) => x.kuenstler).sort().join() === 'Preetzer,Ølgod', funde.map((x) => x.kuenstler).join())
  p('Gebiet je Band richtig', funde.find((x) => x.kuenstler === 'Preetzer').gebiet === 'Preetz')
  const lf = { id: 'lastfm', name: 'Charts', ebenen: ['national'], art: 'beliebt', bereit: () => ({ ok: true }), suche: async () => [{ titel: 'Hit', kuenstler: 'Star' }] }
  const viel = { id: 'mb', name: 'MB', ebenen: ['stadt'], art: 'herkunft', bereit: () => ({ ok: true }), suche: async () => Array.from({ length: 30 }, (_, i) => ({ titel: null, kuenstler: 'Band' + i })) }
  const r = await q.sammle(reg, ['stadt', 'region', 'bundesstaat', 'national'], { quellen: [viel, lf], wunsch: 20 })
  p('Charts kommen auch dazu, wenn die Gegend schon genug liefert', r.funde.some((t) => t.art === 'beliebt'))
}

console.log('\n10  Suche ohne Zusatzberechtigung')
{
  const sp = await import('../src/lib/musik/spotify.js')
  let url = ''
  await sp.spotify.findeTitel({ titel: null, kuenstler: 'Ølgod', markt: 'DE' }, { f: async (u) => { url = u; return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ tracks: { items: [] } }) } } })
  p('kein market=from_token, dafür market=DE', !/from_token/.test(url) && /market=DE/.test(url), url)
}

console.log('\n11  Lieblingsstile')
{
  const q = await import('../src/lib/musik/quellen.js')
  const STILE = ['hardstyle', 'schranz', 'hard techno', 'hardcore techno', 'hard trance', 'techno']
  p('Hardtrance passt', q.stilVon({ tags: [{ name: 'trance' }, { name: 'hard trance' }] }, STILE) === 'hard trance')
  p('„hardtechno“ ohne Leerzeichen passt zu „hard techno“', q.stilVon({ tags: [{ name: 'hardtechno' }] }, STILE) === 'hardtechno')
  p('Hardcore-Punk passt nicht', q.stilVon({ tags: [{ name: 'hardcore punk' }, { name: 'punk' }] }, STILE) === null)
  const reg = { name: 'Kiel', ebene: 'stadt', welt: true, land: 'DE', umgebung: [], umgebungWeit: ['Hamburg'] }
  const urls = []
  const mb = q.QUELLEN.find((x) => x.id === 'musicbrainz')
  const funde = await mb.suche(reg, 'weit', { cfg: { stile: STILE }, f: async (u) => { urls.push(decodeURIComponent(u)); return { ok: true, status: 200, json: async () => (/tag:/.test(decodeURIComponent(u))
    ? { count: 2, artists: [{ name: 'Gary D.', country: 'DE', area: { name: 'Hamburg' }, tags: [{ name: 'hard trance' }] }, { name: 'Punkband', country: 'DE', area: { name: 'Hamburg' }, tags: [{ name: 'hardcore punk' }] }] }
    : { count: 2, artists: [{ name: 'Popband', country: 'DE', area: { name: 'Hamburg' } }] }) } } })
  p('erst Stil-Abfrage, dann allgemein', urls.length === 2 && /tag:"hardstyle"/.test(urls[0]))
  p('Gary D. als Stil-Treffer, Punkband nicht', funde.some((t) => t.kuenstler === 'Gary D.' && t.stil === 'hard trance') && !funde.some((t) => t.kuenstler === 'Punkband' && t.stil))
  const m = q.mische([{ kuenstler: 'Pop', art: 'herkunft' }, { kuenstler: 'Gary', art: 'herkunft', stil: 'hard trance' }, { kuenstler: 'Chart', titel: 'x', art: 'beliebt' }], 3)
  p('Stil-Künstler zuerst', m[0].kuenstler === 'Gary' && m[2].art === 'beliebt', m.map((x) => x.kuenstler).join())
}

console.log('\n12  Von vorne anfangen')
{
  const zu = await import('../src/lib/musik/zustand.js')
  const z = { ...zu.LEER, playlist: { id: 'P', name: 'Sounds of the Road' }, letzterOrt: { lat: 1, lon: 2 }, regionen: { a: {} }, ausstehend: ['a'],
    titel: { t1: { spotifyId: 't1', uri: 'spotify:track:t1', status: 'hinzugefuegt' }, t2: { spotifyId: 't2', status: 'hinzugefuegt' }, t3: { spotifyId: 't3', status: 'doppelt' }, t4: { spotifyId: 't4', status: 'fehler' } } }
  p('nur selbst eingetragene Titel werden herausgenommen', zu.eigeneUris(z).join() === 'spotify:track:t1,spotify:track:t2')
  const n = zu.vonVorn(z, { entfernt: 2 })
  p('alles leer, Playlist bleibt verknüpft', !Object.keys(n.titel).length && !Object.keys(n.regionen).length && !n.ausstehend.length && n.letzterOrt === null && n.playlist.id === 'P')
  p('Protokoll nennt das Zurücksetzen', n.protokoll.length === 1 && /2 Titel/.test(n.protokoll[0].text))
}

console.log('\n13  Umkreis-Ersatz und Anteil der Charts')
{
  const o = await import('../src/lib/musik/ortname.js')
  const speicher = {}
  globalThis.localStorage = { getItem: (k) => speicher[k] ?? null, setItem: (k, v) => { speicher[k] = String(v) }, removeItem: (k) => { delete speicher[k] } }
  const wd = { results: { bindings: [
    { name: { value: 'Hamburg' }, einw: { value: '1900000' }, km: { value: '89' } }, { name: { value: 'Kiel' }, einw: { value: '246000' }, km: { value: '4' } },
    { name: { value: 'Preetz' }, einw: { value: '16000' }, km: { value: '18' } }, { name: { value: 'Kleindorf' }, einw: { value: '3000' }, km: { value: '80' } }] } }
  const aufrufe = []
  const f = async (u) => { aufrufe.push(u.slice(8, 20)); return /overpass/.test(u) ? { ok: false, status: 504, json: async () => ({}) } : { ok: true, status: 200, json: async () => wd } }
  const um = await o.umgebungFuer({ lat: 54.348, lon: 10.175 }, { f, radiusKm: 200, eigener: 'Mönkeberg', kreis: 'Kreis Plön' })
  p('Overpass 504 → Wikidata', um.quelle === 'Wikidata' && aufrufe.length === 2, aufrufe.join())
  p('nah: Kiel, Preetz, Plön; weit: nur Hamburg', um.nah.join() === 'Kiel,Preetz,Plön' && um.weit.join() === 'Hamburg', um.nah.join() + ' | ' + um.weit.join())
  const um2 = await o.umgebungFuer({ lat: 54.33, lon: 10.19 }, { f, radiusKm: 200, eigener: 'Mönkeberg', kreis: 'Kreis Plön' })
  p('zweites Mal aus dem Zwischenspeicher, ohne Netz', um2.quelle === 'speicher' && aufrufe.length === 2 && um2.weit.join() === 'Hamburg')
  const tot = async () => ({ ok: false, status: 504, json: async () => ({}) })
  const um3 = await o.umgebungFuer({ lat: -20, lon: 120 }, { f: tot, radiusKm: 200, eigener: 'X', kreis: 'Kreis Plön' })
  p('keiner antwortet: wenigstens der Kreis', um3.quelle === 'keine' && um3.nah.join() === 'Plön' && um3.fehler.length === 2)

  const quellen = [
    { id: 'c', name: 'Charts', ebenen: ['national'], art: 'beliebt', bereit: () => ({ ok: true }), suche: async () => Array.from({ length: 20 }, (_, i) => ({ titel: 'C' + i, kuenstler: 'Chart' + i })) },
    { id: 'l', name: 'Lokal', ebenen: ['bundesstaat'], art: 'herkunft', bereit: () => ({ ok: true }), suche: async () => Array.from({ length: 20 }, (_, i) => ({ titel: null, kuenstler: 'Band' + i })) },
  ]
  // Nur jede dritte Band ist bei Spotify
  const sp = { verbunden: true, findeTitel: async (t) => (t.titel || +t.kuenstler.slice(4) % 3 === 0) ? { spotifyId: 'id-' + (t.titel || t.kuenstler), titel: t.titel || 'Hit', kuenstler: t.kuenstler } : null,
    playlistIds: async () => [], hinzufuegen: async () => ({ ok: true, snapshotId: 's' }) }
  const r = await suchlauf(MIT_PL, REGION, { quellen, spotify: sp, cfg: { ...VORGABEN, titelJeOrt: 9, stile: [] } })
  const neu = Object.values(r.z.titel)
  p('höchstens ein Drittel Charts, Rest aus der Gegend', neu.length === 9 && neu.filter((t) => t.art === 'beliebt').length === 3, neu.map((t) => t.kuenstler).join())
  p('Protokoll nennt die Zahl der Künstler aus der Gegend', r.z.protokoll.some((x) => /20 Künstler aus der Gegend/.test(x.text)))
  const sp2 = { ...sp, findeTitel: async (t) => t.titel ? { spotifyId: 'id-' + t.titel, titel: t.titel, kuenstler: t.kuenstler } : null }
  const r2 = await suchlauf(MIT_PL, REGION, { quellen, spotify: sp2, cfg: { ...VORGABEN, titelJeOrt: 9, stile: [] } })
  p('keine Band bei Spotify: Charts füllen auf', Object.keys(r2.z.titel).length === 9)
}

console.log('\n9  Mehr Neues, Beliebtes zuerst, Playlisten der Gegend (29.10.2037)')
{
  const { ordneNachBeliebtheit, mische } = await import('../src/lib/musik/quellen.js')
  const { waehleTreffer, spotify: sp9 } = await import('../src/lib/musik/spotify.js')
  const lokalQ = (liste) => [{ id: 'l', name: 'Lokal', ebenen: ['bundesstaat'], art: 'herkunft', bereit: () => ({ ok: true }), suche: async () => liste }]
  const spT = (inPl = []) => ({ verbunden: true, findeTitel: async (t) => ({ spotifyId: 'id-' + (t.titel || t.kuenstler), titel: t.titel || 'Hit', kuenstler: t.kuenstler }),
    playlistIds: async () => inPl, hinzufuegen: async () => ({ ok: true, snapshotId: 's' }) })
  const bands = Array.from({ length: 12 }, (_, i) => ({ titel: 'B' + i, kuenstler: 'Band' + i }))
  const cfg5 = { ...VORGABEN, titelJeOrt: 5, stile: [] }
  const r = await suchlauf(MIT_PL, REGION, { quellen: lokalQ(bands), spotify: spT(['id-B0', 'id-B1', 'id-B2', 'id-B3', 'id-B4', 'id-B5', 'id-B6']), cfg: cfg5 })
  p('7 von 12 schon in der Playlist: trotzdem 5 neue (vorher nur der Rest der ersten 5)', r.hinzugefuegt.length === 5 && !r.hinzugefuegt.some((id) => +id.slice(4) < 7), r.hinzugefuegt.join())
  p('die schon vorhandenen sind als doppelt gemerkt', Object.values(r.z.titel).filter((t) => t.status === 'doppelt').length === 7)
  const alle = await suchlauf(MIT_PL, REGION, { quellen: lokalQ(bands.slice(0, 3)), spotify: spT(['id-B0', 'id-B1', 'id-B2']), cfg: cfg5 })
  p('alles schon drin: klare Meldung, nichts geschrieben', alle.status === 'nichts-neues' && alle.z.protokoll.some((x) => /alles schon in der Playlist/.test(x.text)))

  const beliebt = async (liste) => [...liste].sort((a, b) => (b.kuenstler === 'Band9') - (a.kuenstler === 'Band9'))
  const rb = await suchlauf(MIT_PL, REGION, { quellen: lokalQ(bands.map((b) => ({ ...b, titel: null, art: 'herkunft' }))), spotify: spT(), cfg: { ...cfg5, titelJeOrt: 1 }, beliebtheit: beliebt })
  p('die beliebteste Band aus der Gegend kommt zuerst', rb.hinzugefuegt.join() === 'id-Band9', rb.hinzugefuegt.join())

  const urls = []
  const lfm = async (u) => { urls.push(u); const mbid = new URL(u).searchParams.get('mbid'); const h = { m1: 120, m2: 98000, m3: 4500 }[mbid]
    return { json: async () => (h ? { toptracks: { track: [{ name: 'Top von ' + mbid, listeners: String(h) }] } } : { error: 6, message: 'not found' }) } }
  const sortiert = await ordneNachBeliebtheit([{ kuenstler: 'Klein', mbid: 'm1' }, { kuenstler: 'Ohne ID' }, { kuenstler: 'Gross', mbid: 'm2' }, { kuenstler: 'Mittel', mbid: 'm3' }, { kuenstler: 'Unbekannt', mbid: 'm9' }], { cfg: { lastfmKey: 'k' }, f: lfm })
  p('nach Hörern bei Last.fm, mit dem meistgehörten Titel', sortiert.map((x) => x.kuenstler).slice(0, 3).join() === 'Gross,Mittel,Klein' && sortiert[0].titel === 'Top von m2' && sortiert[0].hoerer === 98000)
  p('gefragt wird über die MusicBrainz-ID, nicht über den Namen', urls.length === 4 && urls.every((u) => /mbid=m\d/.test(u) && !/artist=/.test(u)))
  p('ohne ID oder ohne Treffer: bleibt dabei, ohne Titel', sortiert.some((x) => x.kuenstler === 'Ohne ID' && !x.titel) && sortiert.some((x) => x.kuenstler === 'Unbekannt' && !x.titel))
  p('ohne Last.fm-Schlüssel: unverändert', (await ordneNachBeliebtheit([{ kuenstler: 'A', mbid: 'x' }], { cfg: {}, f: () => { throw new Error('kein Abruf') } }))[0].kuenstler === 'A')

  const tr = (id, pop) => ({ id, name: 'Song ' + id, popularity: pop, artists: [{ name: 'Band' }] })
  p('nur der Künstler bekannt: sein meistgehörter Titel', waehleTreffer([tr('a', 10), tr('b', 70), tr('c', 40)], { kuenstler: 'Band' }).spotifyId === 'b')
  p('mit Titel: der passende, nicht der beliebteste', waehleTreffer([tr('a', 10), tr('b', 70)], { kuenstler: 'Band', titel: 'Song a' }).spotifyId === 'a')

  // Playlisten der Gegend: über die echte Funktion mit nachgebauter Spotify-Antwort
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} }
  localStorage.setItem('tb-spotify-token', JSON.stringify({ access_token: 'A', refresh_token: 'R', laeuftAb: Date.now() + 3600e3, clientId: 'c' }))
  const gelesen = []
  const sf = async (u) => {
    const pfad = u.replace('https://api.spotify.com/v1', '')
    const antwort = (j, status = 200) => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => j })
    if (u.includes('accounts.spotify.com')) return antwort({ access_token: 'A', refresh_token: 'R', expires_in: 3600, token_type: 'Bearer' })
    if (pfad.startsWith('/search')) return antwort({ playlists: { items: [null,
      { id: 'p1', name: 'Broome Vibes', owner: { id: 'jo' } }, { id: 'p2', name: 'Top 50 Broome', owner: { id: 'spotify' } },
      { id: 'p3', name: 'Broomestick Party', owner: { id: 'x' } }, { id: 'p4', name: 'Sunset in Broome WA', owner: { id: 'y' } }] } })
    gelesen.push(pfad.split('/')[2])
    if (pfad.startsWith('/playlists/p4')) return antwort({ error: { message: 'Forbidden' } }, 403)
    return antwort({ items: [{ item: { id: 't1', type: 'track', name: 'Eins', popularity: 30, uri: 'spotify:track:t1', artists: [{ name: 'A' }] } }, { item: { id: 't2', type: 'track', name: 'Zwei', popularity: 80, uri: 'spotify:track:t2', artists: [{ name: 'B' }] } }, { item: { id: 'e1', type: 'episode', name: 'Podcast' } }] })
  }
  let g = null
  try { g = await sp9.gegendTitel(['Broome'], { markt: 'AU', f: sf }) } catch (e) { g = { fehler: e.message } }
  p('nur Playlisten, die nach dem Ort heißen; Spotifys eigene übersprungen', !!g?.titel && g.listen === 2 && gelesen.join() === 'p1,p4', JSON.stringify(g?.fehler || gelesen))
  p('gesperrte Liste zählt nicht als gelesen, Podcasts fallen raus, Beliebteste zuerst', g?.gelesen === 1 && g.titel.map((x) => x.spotifyId).join() === 't2,t1' && g.titel[0].art === 'gegend' && g.titel[0].gebiet === 'Broome Vibes')

  let gesucht = 0
  const spG = { ...spT(), findeTitel: async (t) => { gesucht++; return { spotifyId: 'id-' + (t.titel || t.kuenstler), titel: t.titel, kuenstler: t.kuenstler } },
    gegendTitel: async () => ({ titel: [{ spotifyId: 'g1', uri: 'spotify:track:g1', titel: 'Gehört', kuenstler: 'X', art: 'gegend', gebiet: 'Broome Vibes' }], listen: 1, gelesen: 1 }) }
  const STADT = { id: 'stadt:broome', name: 'Broome', ebene: 'stadt', land: 'AU' }
  const lokalStadt = [{ id: 'l', name: 'Lokal', ebenen: ['stadt', 'bundesstaat'], art: 'herkunft', bereit: () => ({ ok: true }), suche: async () => bands.slice(0, 6) }]
  const rg = await suchlauf(MIT_PL, STADT, { quellen: lokalStadt, spotify: spG, cfg: { ...VORGABEN, titelJeOrt: 6, stile: [] } })
  p('Titel aus Playlisten der Gegend kommen dazu, ohne neue Suche', rg.hinzugefuegt.includes('g1') && Object.values(rg.z.titel).find((x) => x.spotifyId === 'g1')?.art === 'gegend')
  p('Protokoll nennt die Playlisten der Gegend', rg.z.protokoll.some((x) => /Titel aus 1 Playlisten der Gegend/.test(x.text)))
  p('Mischung: Playlist der Gegend vor den Charts', mische([{ art: 'beliebt', kuenstler: 'C' }, { art: 'gegend', kuenstler: 'G' }, { art: 'herkunft', kuenstler: 'L1' }, { art: 'herkunft', kuenstler: 'L2' }], 4).map((x) => x.kuenstler).join() === 'L1,L2,G,C')
}

console.log(`\n${'═'.repeat(46)}\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
