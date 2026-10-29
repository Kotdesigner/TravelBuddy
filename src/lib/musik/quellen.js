// Musik unterwegs: Woher kommen die Titel? (RegionalMusicDiscovery)
//
// Jede Quelle ist ein kleines Objekt mit derselben Form. So lassen sich Quellen dazu-
// nehmen, abschalten oder in Tests durch Attrappen ersetzen.
// Last.fm braucht einen Schlüssel; fehlt er, meldet die Quelle das ehrlich und liefert
// nichts. Erfunden wird nichts.
//
// Form einer Quelle:
//   id, name
//   ebenen:  welche Ebenen sie abdeckt ('stadt' | 'region' | 'bundesstaat' | 'national')
//   art:     'beliebt'  = belegte Beliebtheit (Charts)
//            'herkunft' = Künstler stammt aus der Gegend (keine Aussage über Beliebtheit!)
//   bereit(cfg)            → { ok, grund }
//   suche(region, ebene, { cfg, signal }) → [{ titel, kuenstler, ebene, art, gebiet, quelle, abgerufen }]
//
// Wichtig für die Ehrlichkeit in der Oberfläche: `ebene` sagt, für welches Gebiet die Daten
// gelten. Gibt es für Broome nur nationale Charts, steht dort „national“, nicht „Broome“.
import { t } from '../i18n.js'

export class NichtEingerichtet extends Error {
  constructor(text) { super(text); this.name = 'NichtEingerichtet' }
}

const STAAT_EN = { WA: 'Western Australia', NT: 'Northern Territory', SA: 'South Australia', QLD: 'Queensland', NSW: 'New South Wales', VIC: 'Victoria', TAS: 'Tasmania' }
const mischeZufall = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[b[i], b[j]] = [b[j], b[i]] } return b }

// MusicBrainz erlaubt eine Anfrage pro Sekunde. Alle Abrufe laufen durch diese Schlange.
let mbLetzte = 0
async function mbAbruf(pfad, { f = fetch, signal } = {}) {
  for (let versuch = 0; versuch < 5; versuch++) {
    const warte = mbLetzte + 1100 - Date.now()
    if (warte > 0) await new Promise((r) => setTimeout(r, warte))
    mbLetzte = Date.now()
    const r = await f('https://musicbrainz.org/ws/2/' + pfad + (pfad.includes('?') ? '&' : '?') + 'fmt=json', { signal, headers: { Accept: 'application/json' } })
    if (r.status === 503 || r.status === 429) { await new Promise((ok) => setTimeout(ok, 1500 * (versuch + 1))); continue }
    if (!r.ok) throw new Error(t('MusicBrainz antwortet mit {status}', { status: r.status }))
    return r.json()
  }
  throw new Error(t('MusicBrainz ist gerade überlastet'))
}

/** Welche Gebietsnamen passen zu Region und Ebene? */
export function mbGebiete(region, ebene) {
  if (ebene === 'stadt') return [region.name]
  if (ebene === 'region') return [...new Set([...(region.welt ? [] : [region.naechsterOrt, region.name]), ...(region.umgebung || [])].filter(Boolean))].slice(0, 16)
  if (ebene === 'weit') return (region.umgebungWeit || []).slice(0, 25)
  if (ebene === 'bundesstaat') {
    if (region.staatName) return [region.staatName]                    // außerhalb Australiens, z. B. Schleswig-Holstein
    return region.staat && STAAT_EN[region.staat] ? [STAAT_EN[region.staat]] : []
  }
  return []
}

const normStil = (s) => String(s || '').toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim()
/** Passt ein Künstler zu den Lieblingsstilen? Nur genaue Stil-Angaben zählen, sonst wäre
    „hardcore punk“ ein Treffer für „hardcore techno“. Gibt den passenden Stil zurück. */
export function stilVon(artist, stile = []) {
  const ziel = new Set(stile.map(normStil).flatMap((s) => [s, s.replace(/ /g, '')]))
  for (const t of artist?.tags || []) {
    const n = normStil(t.name)
    if (ziel.has(n) || ziel.has(n.replace(/ /g, ''))) return t.name
  }
  return null
}

/** Künstler aus Suchergebnis: nur solche, die zum Land des Standorts gehören können. */
export function mbKuenstler(artists, gebiet, land = 'AU') {
  const namen = new Set((Array.isArray(gebiet) ? gebiet : [gebiet]).map((x) => x.toLowerCase()))
  return (artists || []).filter((a) => {
    if (a.country && a.country !== land) return false                       // Perth in Schottland & Co.
    // Der Ortsname muss genau passen; die Trefferpunkte der Suche zählen dann nicht mehr
    const orte = [a.area?.name, a['begin-area']?.name].filter(Boolean).map((x) => x.toLowerCase())
    return orte.some((o) => namen.has(o))
  })
}

export const QUELLEN = [
  {
    id: 'lastfm',
    name: t('Charts des Landes (Last.fm)'),
    ebenen: ['national'],
    art: 'beliebt',
    // geo.getTopTracks für das Land des Standorts, dazu tag.getTopTracks der Lieblingsstile.
    // Braucht einen kostenlosen API-Schlüssel (last.fm/api).
    bereit: (cfg) => (cfg?.lastfmKey ? { ok: true } : { ok: false, grund: t('Last.fm-Schlüssel fehlt') }),
    async suche(region, ebene, { cfg, signal, f = fetch } = {}) {
      const seite = 1 + Math.floor(Math.random() * 3)                       // etwas Abwechslung
      const u = `https://ws.audioscrobbler.com/2.0/?method=geo.gettoptracks&country=${encodeURIComponent(region.landName || 'australia')}&limit=50&page=${seite}&format=json&api_key=${encodeURIComponent(cfg.lastfmKey)}`
      const r = await f(u, { signal })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j.error) throw new Error(j.message ? t('Last.fm: {message}', { message: j.message }) : t('Last.fm antwortet mit {status}', { status: r.status }))
      const jetzt = new Date().toISOString()
      const land = mischeZufall((j.tracks?.track || []).map((t) => ({ titel: t.name, kuenstler: t.artist?.name, ebene: 'national', art: 'beliebt', gebiet: region.landName || 'Australien', quelle: 'Last.fm', abgerufen: jetzt }))).slice(0, 15)
      // Dazu Charts der Lieblingsstile (weltweit, Last.fm kennt keine Stil-Charts je Land)
      const stile = mischeZufall((cfg.stile || []).filter(Boolean)).slice(0, 2)
      const imStil = []
      for (const st of stile) {
        try {
          const rs = await f(`https://ws.audioscrobbler.com/2.0/?method=tag.gettoptracks&tag=${encodeURIComponent(st)}&limit=40&format=json&api_key=${encodeURIComponent(cfg.lastfmKey)}`, { signal })
          const js = await rs.json().catch(() => ({}))
          for (const tr of mischeZufall(js.tracks?.track || []).slice(0, 8)) imStil.push({ titel: tr.name, kuenstler: tr.artist?.name, ebene: 'national', art: 'beliebt', stil: st, gebiet: t('Charts ') + st, quelle: 'Last.fm', abgerufen: jetzt })
        } catch {}
      }
      // abwechselnd Landes-Charts und Stil-Charts
      const out = []
      while (land.length || imStil.length) { if (imStil.length) out.push(imStil.shift()); if (land.length) out.push(land.shift()) }
      return out.slice(0, 25)
    },
  },
  {
    id: 'musicbrainz',
    name: t('Local Heroes: Bands aus der Gegend (MusicBrainz)'),
    ebenen: ['stadt', 'region', 'weit', 'bundesstaat'],
    art: 'herkunft',
    // Künstler, deren Gebiet oder Gründungsort zur Gegend passt. Ohne Schlüssel.
    // Den Titel sucht danach Spotify (der bekannteste Treffer des Künstlers).
    bereit: () => ({ ok: true }),
    async suche(region, ebene, { signal, f = fetch, cfg = {} } = {}) {
      const jetzt = new Date().toISOString()
      const gebiete = mbGebiete(region, ebene)
      if (!gebiete.length) return []
      const land = region.land || 'AU'
      const ort = '(' + gebiete.map((g) => `area:"${g}" OR beginarea:"${g}"`).join(' OR ') + ')'
      const stile = (cfg.stile || []).filter(Boolean)
      const gebietVon = (a) => [a['begin-area']?.name, a.area?.name].find((n) => n && gebiete.some((g) => g.toLowerCase() === n.toLowerCase())) || gebiete[0]
      const aus = (a, stil) => ({ titel: null, kuenstler: a.name, mbid: a.id || null, ebene, art: 'herkunft', quelle: 'MusicBrainz', abgerufen: jetzt, gebiet: gebietVon(a), ...(stil ? { stil } : {}) })
      const out = []
      // 1. Lieblingsstile aus der Gegend (eine Abfrage für alle Orte und Stile)
      if (stile.length) {
        const q = `${ort} AND (${stile.map((x) => `tag:"${x}"`).join(' OR ')})`
        const j = await mbAbruf(`artist?limit=100&query=${encodeURIComponent(q)}`, { f, signal }).catch(() => null)
        for (const a of mischeZufall(mbKuenstler(j?.artists, gebiete, land))) { const st = stilVon(a, stile); if (st) out.push(aus(a, st)) }
      }
      // 2. Alle Künstler aus der Gegend
      const q = `${ort} AND (type:group OR type:person)`
      const erst = await mbAbruf(`artist?limit=100&query=${encodeURIComponent(q)}`, { f, signal })
      let artists = erst.artists || []
      // Sehr große Gebiete (über tausend Treffer): zusätzlich ein zufälliger Ausschnitt weiter hinten
      if ((erst.count || 0) > 200) {
        const offset = 100 + Math.floor(Math.random() * Math.min(erst.count - 150, 400))
        const mehr = await mbAbruf(`artist?limit=100&offset=${offset}&query=${encodeURIComponent(q)}`, { f, signal }).catch(() => null)
        artists = [...artists, ...(mehr?.artists || [])]
      }
      for (const a of mischeZufall(mbKuenstler(artists, gebiete, land))) out.push(aus(a, stilVon(a, stile)))
      return out
    },
  },
]

export const EBENE_TEXT = {
  stadt: t('aus der Stadt'),
  region: 'aus der Umgebung',
  weit: t('aus dem Umkreis'),
  bundesstaat: t('aus dem Bundesstaat'),
  national: t('ganzes Land'),
}
export const ART_TEXT = {
  beliebt: t('Charts'),
  herkunft: t('Local Hero'),
  gegend: t('Playlist der Gegend'),
}

/** Charts und Playlisten der Gegend: beides „was dort gehört wird“, im Gegensatz zu den Bands aus der Gegend. */
export const istGehoert = (t) => t.art === 'beliebt' || t.art === 'gegend'

/**
 * Bands aus der Gegend nach Beliebtheit ordnen: Hörer ihres meistgehörten Titels bei
 * Last.fm, und genau dieser Titel wird gesucht. Gefragt wird über die MusicBrainz-ID, nicht über den
 * Namen: sonst bekäme die kleine Band „Sons“ aus Broome die Hörer einer berühmten Band gleichen Namens.
 * Ohne ID oder ohne Treffer bleibt die Band dabei, nur ohne Hörerzahl (dann sucht Spotify ihren Titel).
 * Innerhalb der Lieblingsstile und der übrigen Bands gilt dann: beliebteste zuerst (mische trennt die Stile).
 */
export async function ordneNachBeliebtheit(liste, { cfg = {}, signal, f = fetch, max = 40 } = {}) {
  if (!cfg.lastfmKey || !liste.length) return liste
  const vorn = liste.slice(0, max), rest = liste.slice(max)
  const fertig = []
  for (let i = 0; i < vorn.length; i += 5) {
    fertig.push(...await Promise.all(vorn.slice(i, i + 5).map(async (k) => {
      if (!k.mbid) return { ...k, hoerer: 0 }
      try {
        const r = await f(`https://ws.audioscrobbler.com/2.0/?method=artist.gettoptracks&mbid=${encodeURIComponent(k.mbid)}&limit=1&format=json&api_key=${encodeURIComponent(cfg.lastfmKey)}`, { signal })
        const j = await r.json().catch(() => ({}))
        const top = j.toptracks?.track?.[0]
        return top?.name ? { ...k, titel: k.titel || top.name, hoerer: +top.listeners || 0 } : { ...k, hoerer: 0 }
      } catch { return { ...k, hoerer: 0 } }
    })))
  }
  fertig.sort((a, b) => b.hoerer - a.hoerer)
  return [...fertig, ...rest]
}

/** Alle Quellen der Reihe nach fragen, von der genauesten Ebene zur gröbsten.
    Hört auf, sobald genug Kandidaten da sind. Fehler einzelner Quellen brechen nichts ab. */
export async function sammle(region, ebenen, { quellen = QUELLEN, cfg = {}, wunsch = 10, signal } = {}) {
  const funde = []
  const meldungen = []
  for (const ebene of ebenen) {
    for (const q of quellen) {
      if (!q.ebenen.includes(ebene)) continue
      if (cfg.quellen && cfg.quellen[q.id] === false) continue
      const b = q.bereit(cfg)
      if (!b.ok) { meldungen.push({ quelle: q.id, text: b.grund }); continue }
      try {
        const liste = await q.suche(region, ebene, { cfg, signal })
        for (const t of liste || []) funde.push({ ...t, ebene: t.ebene || ebene, art: t.art || q.art, quelle: t.quelle || q.name })
      } catch (e) {
        meldungen.push({ quelle: q.id, text: e?.message || String(e), nichtEingerichtet: e instanceof NichtEingerichtet })
      }
    }
    // Genug beisammen? Bei Lieblingsstilen erst, wenn auch davon ein paar dabei sind
    // (sonst endet die Suche in Kiel, bevor der Umkreis mit Hamburg drankommt)
    const stilZahl = eindeutig(funde).filter((t) => t.stil).length
    if (eindeutig(funde).length >= wunsch && (!(cfg.stile || []).length || stilZahl >= Math.ceil(wunsch / 4))) break
  }
  // Charts kommen immer dazu, wenn es sie gibt, auch wenn die Gegend schon genug liefert
  if (!funde.some((t) => t.art === 'beliebt')) {
    for (const q of quellen) {
      if (!q.ebenen.includes('national') || (cfg.quellen && cfg.quellen[q.id] === false)) continue
      if (funde.some((t) => t.ebene === 'national' && t.quelle === q.name)) continue
      const b = q.bereit(cfg)
      if (!b.ok) { if (!meldungen.some((m) => m.quelle === q.id)) meldungen.push({ quelle: q.id, text: b.grund }); continue }
      try {
        for (const t of (await q.suche(region, 'national', { cfg, signal })) || []) funde.push({ ...t, ebene: 'national', art: t.art || q.art, quelle: t.quelle || q.name })
      } catch (e) { meldungen.push({ quelle: q.id, text: e?.message || String(e) }) }
    }
  }
  return { funde: eindeutig(funde), meldungen }
}

const schluessel = (t) => `${(t.kuenstler || '').toLowerCase().trim()}|${(t.titel || '').toLowerCase().replace(/\s*[([].*?[)\]]\s*/g, ' ').trim()}`
export function eindeutig(liste) {
  const gesehen = new Set()
  return liste.filter((t) => { const k = schluessel(t); if (!t.kuenstler || (!t.titel && t.art !== 'herkunft') || gesehen.has(k)) return false; gesehen.add(k); return true })
}

/** Mischung: zwei Titel von Künstlern aus der Gegend, dann einer, der dort gehört wird, und so weiter. */
export function mische(funde, anzahl) {
  // Gehört: Playlisten der Gegend und Charts im Wechsel, Playlisten zuerst
  const pl = funde.filter((t) => t.art === 'gegend'), ch = funde.filter((t) => t.art === 'beliebt')
  const a = []
  while (pl.length || ch.length) { if (pl.length) a.push(pl.shift()); if (ch.length) a.push(ch.shift()) }
  // Künstler aus der Gegend im Lieblingsstil zuerst, dann die übrigen aus der Gegend (Reihenfolge bleibt, z. B. nach Beliebtheit)
  const b = [...funde.filter((t) => !istGehoert(t) && t.stil), ...funde.filter((t) => !istGehoert(t) && !t.stil)]
  const out = []
  while (out.length < anzahl && (a.length || b.length)) {
    for (let i = 0; i < 2 && b.length && out.length < anzahl; i++) out.push(b.shift())
    if (a.length && out.length < anzahl) out.push(a.shift())
  }
  return out
}
