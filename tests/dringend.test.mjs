// Startseite: was kurz vor Flug oder Zug wichtig ist.
import assert from 'node:assert/strict'
import { dringendeMeldungen } from '../src/lib/flug.js'

const jetzt = Date.parse('2030-05-01T10:00:00Z'), STD = 3600e3
const flug = (id, ms) => ({ id, nr: id, art: 'flug', datum: new Date(ms).toISOString().slice(0, 10), zeit: new Date(ms).toISOString().slice(11, 16) })
const ab = (ms, neu = ms) => ({ daten: { status: 'Expected', ab: { planMs: ms, neuMs: neu }, an: {} } })
const f1 = flug('LH1', jetzt + 5 * STD), f2 = flug('LH2', jetzt + 5 * STD), f3 = flug('LH3', jetzt + 90 * STD)
const m = dringendeMeldungen([f1, f2, f3], {
  LH1: { ...ab(jetzt + 5 * STD, jetzt + 6 * STD), verlauf: [{ zeit: jetzt - STD, text: 'Abflug 60 Min. später' }] },
  LH2: { ...ab(jetzt + 5 * STD), verlauf: [{ zeit: jetzt - STD, text: 'Gate 12' }] },
  LH3: { ...ab(jetzt + 90 * STD, jetzt + 92 * STD), verlauf: [{ zeit: jetzt - STD, text: 'x' }] },
}, jetzt)
assert.deepEqual(m.map((x) => [x.flug.id, x.stark, x.text]), [['LH1', true, 'Abflug 60 Min. später'], ['LH2', false, 'Gate 12']])
assert.equal(dringendeMeldungen([f2], { LH2: { ...ab(jetzt + 5 * STD), verlauf: [{ zeit: jetzt - 7 * STD, text: 'alt' }] } }, jetzt).length, 0)
console.log('✓ Dringende Meldungen')
