// Monats- und Jahresansicht: Wochen, Etappen über Monatsgrenzen, Startmonat.
import assert from 'node:assert/strict'
import { monatWochen, tageZwischen, tagKarte, startMonat } from '../src/lib/kalender-raster.js'

// Juni 2030 beginnt an einem Samstag: fünf Lücken, dann genau fünf Wochen
const juni = monatWochen(2030, 5)
assert.equal(juni.length, 5)
assert.equal(monatWochen(2030, 8).length, 6)
assert.deepEqual(juni[0].slice(0, 6), [null, null, null, null, null, '2030-06-01'])
assert.equal(juni.flat().filter(Boolean).length, 30)
assert.ok(juni.every((w) => w.length === 7))
assert.equal(monatWochen(2032, 1).flat().filter(Boolean).length, 29)

assert.deepEqual(tageZwischen('2030-12-30', '2031-01-02'), ['2030-12-30', '2030-12-31', '2031-01-01', '2031-01-02'])
assert.equal(tageZwischen('2030-03-30', '2030-03-31').length, 2)

const karte = tagKarte(
  [{ id: 'a', von: '2030-05-30', bis: '2030-06-02' }, { id: 'b', von: '2030-06-02', bis: '2030-06-03' }],
  [{ id: 'x', datum: '2030-06-02' }, { id: 'y', datum: '2030-07-01' }],
  ['2030-06-01'],
)
assert.equal(karte.get('2030-05-31').etappen[0].id, 'a')
assert.deepEqual(karte.get('2030-06-02').etappen.map((e) => e.id), ['a', 'b'])
assert.equal(karte.get('2030-06-02').termine.length, 1)
assert.equal(karte.get('2030-06-01').logbuch, true)
assert.equal(karte.get('2030-07-01').etappen.length, 0)
assert.equal(karte.has('2030-06-04'), false)

assert.deepEqual(startMonat('2030-01-10', '2030-05-01', '2030-05-20'), { jahr: 2030, monat: 4 })
assert.deepEqual(startMonat('2030-05-10', '2030-05-01', '2030-06-20'), { jahr: 2030, monat: 4 })
assert.deepEqual(startMonat('2030-01-10', undefined, undefined), { jahr: 2030, monat: 0 })
console.log('✓ Kalender-Raster')
