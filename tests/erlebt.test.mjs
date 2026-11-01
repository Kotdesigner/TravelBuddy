// Nahe Ereignisse: nur im kleinen Umkreis, je Tag einmal, kleinster Abstand gewinnt.
import assert from 'node:assert/strict'
import { merkeNahe } from '../src/lib/erlebt.js'

const w = (id, lat, lon) => ({ id, rang: 1, punkte: [[lon, lat]], icon: '🔥', level: 'Watch', titel: id, staat: 'WA', farbe: '#c00' })
const nah = w('nah', -22.7, 114.1), fern = w('fern', -25, 114.1)
const pos = { lat: -22.68, lon: 114.13 }, tag1 = Date.UTC(2030, 4, 1, 4), tag2 = Date.UTC(2030, 4, 2, 4)
let l = merkeNahe([], [nah, fern], pos, tag1)
assert.deepEqual(l.map((x) => x.titel), ['nah'])
assert.equal(merkeNahe(l, [nah], pos, tag1 + 1000), l)
assert.equal(merkeNahe(l, [nah], null, tag1), l)
l = merkeNahe(l, [nah], pos, tag2)
assert.equal(l.length, 2)
console.log('✓ Erlebt')
