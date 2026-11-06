// Beschädigte Einträge reparieren, bevor sie in die App kommen (Import und Start).
// Eine Sicherung von einem anderen Gerät, ein halb geschriebener Stand oder eine von Hand
// bearbeitete Datei kann Felder in falscher Art enthalten, etwa `stops` als Text. Die App
// rechnet überall mit Listen, ein einziger solcher Eintrag ließ Plan, Karte und Logbuch bei
// jedem Start abstürzen. Hier wird nur repariert, was sicher falsch ist, nichts Gültiges ändert sich.

/** Felder, die in der App immer Listen sind */
export const LISTEN_FELDER = ['stops', 'fotos', 'audios', 'fotoMeta', 'tags', 'sichtungen', 'segmente',
  'bilder', 'tagebuch', 'dateien', 'docs']
/** Felder, die immer Texte sind */
const TEXT_FELDER = ['name', 'text', 'notiz', 'bericht', 'beschreibung']
/** Felder, die ein Datum als Text tragen */
const DATUM_FELDER = ['datum', 'von', 'bis']

const istObjekt = (x) => !!x && typeof x === 'object' && !Array.isArray(x)

/** Einen Eintrag reparieren. Gibt denselben Eintrag zurück, wenn nichts zu tun war, sonst eine Kopie. */
export function heileEintrag(e) {
  if (!istObjekt(e)) return null
  let k = null
  const kopie = () => (k ??= { ...e })
  for (const f of LISTEN_FELDER) {
    if (!(f in e)) continue
    if (!Array.isArray(e[f])) kopie()[f] = []
    else if (f === 'stops' && e[f].some((s) => !istObjekt(s))) kopie()[f] = e[f].filter(istObjekt)
  }
  for (const f of TEXT_FELDER) {
    if (f in e && e[f] != null && typeof e[f] !== 'string') kopie()[f] = typeof e[f] === 'number' ? String(e[f]) : ''
  }
  for (const f of DATUM_FELDER) {
    if (f in e && e[f] != null && typeof e[f] !== 'string') delete kopie()[f]
  }
  if ('felder' in e && !istObjekt(e.felder)) kopie().felder = {}
  if ('tage' in e && !(Number.isFinite(e.tage) && e.tage > 0)) {
    const n = Math.round(Number(e.tage))
    kopie().tage = Number.isFinite(n) && n > 0 ? n : 1
  }
  if ('farbe' in e && typeof e.farbe !== 'string') delete kopie().farbe
  return k || e
}

/** Eine ganze Liste reparieren: Unbrauchbares fällt weg, der Rest wird geheilt. */
export function heileListe(liste) {
  if (!Array.isArray(liste)) return liste
  let geaendert = false
  const neu = []
  for (const e of liste) {
    const h = heileEintrag(e)
    if (h !== e) geaendert = true
    if (h) neu.push(h)
  }
  return geaendert ? neu : liste
}

/** Notizen und Fotos je Ort ({ ortId: { notiz, bilder, tagebuch } }) reparieren. */
export function heileOrtDaten(daten) {
  if (!istObjekt(daten)) return {}
  let k = null
  for (const [id, v] of Object.entries(daten)) {
    const h = heileEintrag(v)
    if (h !== v) { k ??= { ...daten }; if (h) k[id] = h; else delete k[id] }
  }
  return k || daten
}

/** Buchungen ({ events: [...] }) reparieren. */
export function heileBuchungen(b) {
  if (!istObjekt(b) || !Array.isArray(b.events)) return b
  const ev = heileListe(b.events)
  const pe = Array.isArray(b.persoenlich) ? heileListe(b.persoenlich) : b.persoenlich
  return ev === b.events && pe === b.persoenlich ? b : { ...b, events: ev, ...(pe !== undefined ? { persoenlich: pe } : {}) }
}
