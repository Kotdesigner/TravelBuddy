// Recherchierte Orte in public/orte.json einfuegen — im Format der 88 bestehenden.
//
//   node scripts/fuege-orte-ein.js <neue-orte.json> [--trocken]
//
// Die neuen Orte sind Ostkueste (Victoria + Queensland) und landen deshalb im
// Abschnitt „Ostkueste"; App.svelte gruppiert ueber abschnitt.startsWith('Ostküste')
// und bildet innerhalb des Abschnitts Gruppen nach `region`.
import fs from 'node:fs'

const ABSCHNITT = 'Ostküste: Melbourne, Cairns & Whitsundays'
const ERLAUBTE_TAGS = new Set(['MUSS-SEHEN', 'GEHEIMTIPP', 'NUR-4WD', 'EXPEDITION'])

// Die Recherche liefert sehr feine Regionsnamen („Toolangi State Forest",
// „East Warburton, Yarra Ranges") — 10 Gruppen fuer 14 Orte. Die 88 bestehenden Orte
// liegen bei rund 7 Orten je Gruppe. Also zu sinnvollen Gebieten zusammenfassen.
const GEBIETE = [
  [/kinglake|toolangi|sugarloaf|jehosaphat|st\.? ?leonard|wirrawilla/i, 'Kinglake & Toolangi'],
  [/marysville|steavenson|black spur|fernshaw|maroondah|donna buang|warburton|redwood|yarra ranges|lake mountain|cathedral range/i,
    'Yarra Ranges, Black Spur & Marysville'],
  [/healesville|yarra valley|tarrawarra|yarra glen|coldstream/i, 'Yarra Valley & Healesville'],
  [/dandenong|puffing billy|sherbrooke|olinda|belgrave|emerald/i, 'Dandenong Ranges'],
  [/phillip island|mornington|sorrento|portsea|penguin parade|peninsula hot springs/i,
    'Phillip Island & Mornington Peninsula'],
  [/melbourne|st kilda|brighton|williamstown|werribee|fitzroy|carlton|docklands|southbank|brunswick|richmond|port phillip/i,
    'Melbourne & Bucht'],
  [/daintree|mossman|port douglas|cape trib|bloomfield|rex lookout|four mile/i, 'Daintree & Port Douglas'],
  [/atherton|tableland|kuranda|barron|millaa|zillie|ellinjaa|eacham|barrine|curtain fig|cathedral fig|mareeba|granite gorge|hypipamee|yungaburra|malanda/i,
    'Atherton Tablelands'],
  [/cairns|palm cove|trinity|esplanade|green island|fitzroy island|babinda|josephine|innisfail|mission beach|dunk|wooroonooran|bartle frere|tully|kuranda range/i,
    'Cairns & Küste'],
]
// Zuerst nach Breitengrad trennen, dann erst nach Namen. Sonst landet „Fitzroy Island"
// (vor Cairns) im Muster fuer den Melbourner Stadtteil Fitzroy — genau das ist passiert.
const VICTORIA = new Set(['Kinglake & Toolangi', 'Yarra Ranges, Black Spur & Marysville',
  'Yarra Valley & Healesville', 'Dandenong Ranges', 'Phillip Island & Mornington Peninsula',
  'Melbourne & Bucht'])
function gebietFuer(o) {
  const text = `${o.name} ${o.region || ''} ${o.mapsQuery || ''}`
  const imSueden = o.lat < -30                       // Victoria; Queensland liegt bei −16…−18
  for (const [muster, name] of GEBIETE) {
    if (!muster.test(text)) continue
    if (VICTORIA.has(name) !== imSueden) continue    // Muster passt, Gegend nicht
    return name
  }
  return imSueden ? 'Melbourne & Bucht' : 'Cairns & Küste'
}

const [, , quelle, ...rest] = process.argv
if (!quelle) { console.error('Aufruf: node scripts/fuege-orte-ein.js <neue-orte.json> [--trocken]'); process.exit(1) }
const trocken = rest.includes('--trocken')

const vorhanden = JSON.parse(fs.readFileSync('public/orte.json', 'utf8'))
const neu = JSON.parse(fs.readFileSync(quelle, 'utf8'))

const idsDa = new Set(vorhanden.map((o) => o.id))
const namenDa = new Set(vorhanden.map((o) => o.name.toLowerCase()))
// Die fuenf aus der Vacation-Zusammenlegung liegen in der IndexedDB, nicht in orte.json —
// sie muessen trotzdem gegen Doppelung geprueft werden.
const AUS_INDEXEDDB = ['melbourne', 'kinglake', 'cairns', 'airlie beach', 'whitsunday island']
AUS_INDEXEDDB.forEach((n) => namenDa.add(n))

const bilder = fs.existsSync('public/bilder') ? fs.readdirSync('public/bilder') : []
const bildFuer = (id) => {
  const f = bilder.find((x) => x.replace(/\.[^.]+$/, '') === id)
  return f ? 'bilder/' + f : null
}

const raus = []
const uebernommen = []

for (const o of neu) {
  const fehler = []
  if (!o.id || !/^[a-z0-9_]+$/.test(o.id)) fehler.push('id unbrauchbar')
  if (!o.name) fehler.push('Name fehlt')
  if (typeof o.lat !== 'number' || typeof o.lon !== 'number') fehler.push('Koordinate fehlt')
  if (o.lat > -9 || o.lat < -44 || o.lon < 112 || o.lon > 154) fehler.push('Koordinate ausserhalb Australiens')
  if (!o.beschreibung || o.beschreibung.length < 40) fehler.push('Beschreibung zu duenn')
  if (idsDa.has(o.id)) fehler.push('id gibt es schon')
  if (namenDa.has((o.name || '').toLowerCase())) fehler.push('Name gibt es schon')
  if (fehler.length) { raus.push(`${o.name || o.id}: ${fehler.join(', ')}`); continue }

  const tags = (o.tags || []).filter((t) => ERLAUBTE_TAGS.has(t))
  // Saisonhinweis gehoert in die Beschreibung — die App zeigt kein eigenes Feld dafuer,
  // und gerade im Hochsommer ist er der wichtigste Teil.
  const saison = (o.saison || '').trim()
  const beschreibung = saison
    ? `${o.beschreibung.trim()} · Dez/Jan: ${saison.replace(/^Dez\/Jan:?\s*/i, '')}`
    : o.beschreibung.trim()

  uebernommen.push({
    id: o.id,
    name: o.name,
    abschnitt: ABSCHNITT,
    region: gebietFuer(o),
    tags,
    beschreibung,
    emoji: o.emoji || '📍',
    mapsQuery: o.mapsQuery || `${o.name}, Australia`,
    bild: bildFuer(o.id),
    lat: Number(o.lat.toFixed(5)),
    lon: Number(o.lon.toFixed(5)),
  })
  idsDa.add(o.id)
  namenDa.add(o.name.toLowerCase())
}

console.log(`Uebernommen: ${uebernommen.length} · abgewiesen: ${raus.length}`)
raus.forEach((r) => console.log('  ✗ ' + r))
console.log()
const proRegion = {}
uebernommen.forEach((o) => { (proRegion[o.region] ||= []).push(o.name) })
for (const [r, n] of Object.entries(proRegion)) console.log(`  ${r} (${n.length}): ${n.join(', ')}`)
console.log()
console.log(`ohne Bild: ${uebernommen.filter((o) => !o.bild).length}`)

if (trocken) { console.log('\n(Trockenlauf — nichts geschrieben)'); process.exit(0) }

fs.copyFileSync('public/orte.json', 'public/orte.json.bak')
fs.writeFileSync('public/orte.json', JSON.stringify([...vorhanden, ...uebernommen], null, 1))
console.log(`\npublic/orte.json: ${vorhanden.length} → ${vorhanden.length + uebernommen.length} Orte (Sicherung: orte.json.bak)`)
