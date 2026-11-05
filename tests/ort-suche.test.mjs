// Ortssuche: Photon-Antwort wird zu Treffern mit Koordinaten.
import assert from 'node:assert/strict'
import { ausPhoton } from '../src/lib/ort-suche.js'
const f = (name, osm_value, state, country, xy, city) => ({ properties: { name, osm_value, state, country, city }, geometry: { coordinates: xy } })
const t = ausPhoton({ features: [
  f('Proserpine', 'town', 'Queensland', 'Australien', [148.5832137, -20.4018085]),
  f('Proserpine', 'bus_stop', 'Queensland', 'Australien', [148.58, -20.4]),
  f('Proserpine', 'town', 'Queensland', 'Australien', [148.6, -20.41]),
  f('Hamilton Island', 'island', 'Queensland', 'Australien', [148.95, -20.35]),
] })
assert.equal(t.length, 2)
assert.deepEqual(t[0], { name: 'Proserpine', lat: -20.40181, lon: 148.58321, region: 'Queensland, Australien', quelle: 'netz' })
assert.equal(ausPhoton({}).length, 0)
console.log('✓ Ortssuche')
