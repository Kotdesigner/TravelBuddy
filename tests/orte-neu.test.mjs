// Ort hinzufügen: Vorschläge aus OpenStreetMap und Einordnung in Süden/Norden/Ostküste.
// Anlass 15.10.2037: Steve will beim Anlegen gefragt werden, welcher Ort gemeint ist, und
// der Ort soll automatisch in der richtigen Gruppe stehen (z. B. Margaret River im Süden).
// Ausführen: node tests/orte-neu.test.mjs
import fs from 'node:fs'
import { setzeVorlagen, rubrikFuer, naechsteRubrik, alleRubriken, rubrikPatch } from '../src/lib/rubrik.js'
import { ortVorschlaege } from '../src/lib/ortdaten.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}

const orte = JSON.parse(fs.readFileSync(new URL('../public/orte.json', import.meta.url), 'utf8'))
setzeVorlagen(orte)
const kurz = (r) => (r.abschnitt ? r.abschnitt.split(':')[0] + ' · ' + r.region : '—')

console.log('\n1  Gruppe aus den Koordinaten')
{
  const mr = rubrikFuer(-33.953, 115.077, { gebiet: 'Westaustralien' })
  p('Margaret River → Süden · Margaret River & Augusta', kurz(mr) === 'Süden · Margaret River & Augusta', kurz(mr))
  const cb = rubrikFuer(-23.14, 113.77)
  p('Coral Bay → Norden · Ningaloo & Exmouth', kurz(cb) === 'Norden · Ningaloo & Exmouth', kurz(cb))
  const ka = rubrikFuer(-30.749, 121.465, { gebiet: 'Westaustralien' })
  p('Kalgoorlie (36 km vom nächsten Vorschlag) → Süden', ka.abschnitt?.startsWith('Süden'), kurz(ka))
  const br = rubrikFuer(-17.96, 122.24, { gebiet: 'Westaustralien' })
  p('Broome (weit weg) → Norden, Region = Bundesstaat', br.abschnitt?.startsWith('Norden') && br.region === 'Westaustralien', kurz(br))
  const sy = rubrikFuer(-33.87, 151.21, { gebiet: 'Neusüdwales' })
  p('Sydney → Ostküste · Neusüdwales (nicht bei Melbourne)', kurz(sy) === 'Ostküste · Neusüdwales', kurz(sy))
  p('Uluru (Northern Territory) → keine Gruppe, nur „Meine Orte“', !rubrikFuer(-25.345, 131.036, { gebiet: 'Nordterritorium' }).abschnitt)
  p('ohne Koordinaten → keine Gruppe', !rubrikFuer(null, null).abschnitt)
  p('naechsteRubrik mit Höchstabstand: Sydney liegt > 150 km von allen', !naechsteRubrik(-33.87, 151.21, 150).abschnitt)
  p('rubrikPatch lässt eine echte Gruppe stehen', Object.keys(rubrikPatch({ abschnitt: mr.abschnitt, region: mr.region }, -17.96, 122.24)).length === 0)
  p('rubrikPatch ordnet „Meine Orte“ ein', rubrikPatch({ abschnitt: 'Meine Orte' }, -33.953, 115.077).region === 'Margaret River & Augusta')
}

console.log('\n2  Auswahl der Gruppen')
{
  const g = alleRubriken(orte)
  p('drei Abschnitte (Süden, Norden, Ostküste)', g.length === 3 && ['Süden', 'Norden', 'Ostküste'].every((a) => g.some((x) => x.abschnitt.startsWith(a))))
  p('jede Region nur einmal', g.every((x) => new Set(x.regionen).size === x.regionen.length))
  p('„Meine Orte“ ist kein Abschnitt', alleRubriken([...orte, { abschnitt: 'Meine Orte', region: 'Meine Orte' }]).length === 3)
}

console.log('\n3  Vorschläge aus OpenStreetMap (Antwort nachgestellt)')
{
  const antwort = [
    { category: 'boundary', type: 'administrative', addresstype: 'town', name: 'Margaret River', lat: '-33.9531800', lon: '115.0769400', address: { town: 'Margaret River', state: 'Westaustralien' } },
    { category: 'waterway', type: 'river', addresstype: 'river', name: 'Margaret River', lat: '-33.95', lon: '115.05', address: { river: 'Margaret River', town: 'Margaret River', state: 'Westaustralien' } },
    { category: 'waterway', type: 'river', addresstype: 'river', name: 'Margaret River', lat: '-33.97', lon: '115.02', address: { river: 'Margaret River', town: 'Margaret River', state: 'Westaustralien' } },
    { category: 'waterway', type: 'river', addresstype: 'river', name: 'Margaret River', lat: '-14.2', lon: '131.4', address: { territory: 'Nordterritorium' } },
    { category: 'highway', type: 'residential', name: 'Margaret River Road', lat: '-33.9', lon: '115.1', address: { state: 'Westaustralien' } },
  ]
  let gefragt = ''
  globalThis.fetch = async (url) => { gefragt = String(url); return { ok: true, json: async () => antwort } }
  const v = await ortVorschlaege('Margaret River')
  p('nur Australien, mit Adresse und in der Sprache der App', /countrycodes=au/.test(gefragt) && /addressdetails=1/.test(gefragt) && /accept-language=de/.test(gefragt))
  p('Stadt erkannt: „Stadt · Westaustralien“ mit 🏘️', v[0]?.zusatz === 'Stadt · Westaustralien' && v[0].emoji === '🏘️', v[0]?.zusatz)
  p('Koordinaten als Zahlen mit 5 Nachkommastellen', v[0]?.lat === -33.95318 && v[0]?.lon === 115.07694)
  p('Fluss in WA nur einmal, obwohl zwei Abschnitte', v.filter((x) => x.art === 'Fluss' && x.gebiet === 'Westaustralien').length === 1)
  p('Fluss im Northern Territory bleibt eigener Vorschlag', v.some((x) => x.gebiet === 'Nordterritorium'))
  p('Straßen werden nicht vorgeschlagen', !v.some((x) => /Road/.test(x.name)))
  p('Bundesstaat steht im Vorschlag (gebiet)', v[0]?.gebiet === 'Westaustralien')
}

console.log(`\n${'═'.repeat(46)}\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
