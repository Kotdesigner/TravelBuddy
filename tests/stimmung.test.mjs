// Wetter-Stimmung und Erkennung von Verbindungen nach außen.
import assert from 'node:assert/strict'
import { stimmungVon, istNacht, kurzVorUntergang, tempFarbe, tempHoehe } from '../src/lib/stimmung.js'
import { artVon } from '../src/lib/netz-aktivitaet.js'

assert.equal(stimmungVon({ temp: 20, code: 0, nacht: true }), 'nacht')
assert.equal(stimmungVon({ temp: 38, code: 95 }), 'regen')
assert.equal(stimmungVon({ temp: 38, code: 0 }), 'heiss')
assert.equal(stimmungVon({ temp: 20, code: 3 }), 'bewoelkt')
assert.equal(stimmungVon({ temp: 22, code: 1 }), '')
assert.equal(istNacht(-31.95, 115.86, new Date('2030-06-01T04:00:00Z')), false)
assert.equal(istNacht(-31.95, 115.86, new Date('2030-06-01T16:00:00Z')), true)
assert.equal(kurzVorUntergang(-31.95, 115.86, new Date('2030-06-01T09:10:00Z')), true)
assert.equal(kurzVorUntergang(-31.95, 115.86, new Date('2030-06-01T04:00:00Z')), false)
assert.equal(artVon('/bilder/a.jpg', 'app.test'), null)
assert.equal(artVon('https://app.test/x', 'app.test'), null)
assert.equal(artVon('data:image/png;base64,AA', 'app.test'), null)
assert.equal(artVon('https://api.spotify.com/v1/me', 'app.test'), 'spotify')
assert.equal(artVon('https://api.open-meteo.com/v1/forecast', 'app.test'), 'daten')
// Temperatur: Mitte silbern, warm rot, kalt blau, und je wärmer, desto weiter oben
assert.equal(tempFarbe(20), 'rgb(201, 206, 214)')
assert.equal(tempFarbe(40), 'rgb(235, 52, 44)')
assert.equal(tempFarbe(-5), 'rgb(52, 128, 240)')
assert.ok(tempHoehe(35) < tempHoehe(10))
console.log('✓ Stimmung und Verbindungen')
