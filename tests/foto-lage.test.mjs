// Fotolage: Milchstraße, Nachtfenster, Mond und Bewertung.
import assert from 'node:assert/strict'
import { lichtLage, mondLage, milchstrasse, nachtFenster, nachtVon, stadtLicht, himmelIn, fotoLage, richtung, stufeVon, lichtWert, naechsteMilchstrasse, schauerBei } from '../src/lib/foto-lage.js'

const PERTH = [-31.95, 115.86], OUTBACK = [-25.5, 122.0]
// Juni, Mitternacht in Perth: Die Mitte der Milchstraße steht fast im Zenit
assert.ok(milchstrasse(new Date('2030-06-15T16:00:00Z'), ...PERTH).hoehe > 75)
// Dezember, Mitternacht: unter dem Horizont
assert.ok(milchstrasse(new Date('2030-12-15T16:00:00Z'), ...PERTH).hoehe < 0)
assert.equal(richtung(180), 'S'); assert.equal(richtung(359), 'N')

// Die Nacht hängt nicht an der Uhrzeit des Abends
const a = nachtVon(new Date('2030-06-15T14:00:00Z'), ...PERTH), b = nachtVon(new Date('2030-06-15T20:00:00Z'), ...PERTH)
assert.equal(a.von.getTime(), b.von.getTime())
assert.ok(a.bis - a.von > 12 * 3600000 && a.bis - a.von < 15 * 3600000)
// Tagsüber zählt die kommende Nacht
assert.ok(nachtVon(new Date('2030-06-15T04:00:00Z'), ...PERTH).von > new Date('2030-06-15T04:00:00Z'))

// Neumond 1. Juni 2030: lange freie Milchstraße im Outback. Vollmond 15. Juni: nur Reste
const neu = nachtFenster(...OUTBACK, new Date('2030-06-01T14:00:00Z'))
assert.ok(neu.mw && neu.mw.bis - neu.mw.von > 4 * 3600000, 'Neumond')
assert.ok(neu.mw.spitze.hoehe > 70)
const voll = nachtFenster(...OUTBACK, new Date('2030-06-15T14:00:00Z'))
assert.ok(!voll.mw || voll.mw.bis - voll.mw.von < 2 * 3600000, 'Vollmond')

assert.equal(stadtLicht(...PERTH).stufe, 2)
assert.equal(stadtLicht(...OUTBACK).stufe, 0)
assert.equal(stadtLicht(52.5, 13.4), null)

const t0 = new Date('2030-06-01T12:00:00Z')
const wetter = (w) => ({ time: Array.from({ length: 48 }, (_, i) => t0.getTime() / 1000 + i * 3600), cloud_cover: Array(48).fill(w), cloud_cover_low: Array(48).fill(w), cloud_cover_mid: Array(48).fill(0), cloud_cover_high: Array(48).fill(0) })
assert.equal(himmelIn(wetter(40), t0, new Date(t0.getTime() + 7200000)).wolken, 40)
assert.equal(himmelIn(null, t0, t0), null)

const klar = fotoLage(...OUTBACK, new Date('2030-06-01T14:00:00Z'), wetter(5))
assert.equal(klar.stufe, 'top'); assert.equal(klar.fokus, 'milchstrasse')
const trueb = fotoLage(...OUTBACK, new Date('2030-06-01T14:00:00Z'), wetter(95))
assert.ok(trueb.wertNacht < 0.1)
assert.ok(fotoLage(...PERTH, new Date('2030-06-01T14:00:00Z'), wetter(5)).wertNacht < klar.wertNacht)
assert.equal(klar.pol.richtung, 180)

assert.equal(stufeVon(0.1), 'schlecht')
assert.ok(lichtWert({ tief: 90 }) < lichtWert({ tief: 5, mittel: 30, hoch: 30 }))
assert.ok(naechsteMilchstrasse(...OUTBACK, new Date('2030-06-13T04:00:00Z')))
assert.equal(schauerBei(new Date('2030-12-13T12:00:00'))?.tag.getMonth(), 11)
assert.equal(schauerBei(new Date('2030-03-13T12:00:00')), null)
// Echte Größen: Dunkel erst rund anderthalb Stunden nach Sonnenuntergang
const d = nachtFenster(...PERTH, new Date('2030-06-01T14:00:00Z'))
const nachUntergang = (d.dunkel.von - d.nacht.von) / 60000
assert.ok(nachUntergang > 70 && nachUntergang < 110, String(nachUntergang))
// Winter in Perth: Sonne geht im Nordosten auf, im Nordwesten unter, mittags im Norden
const li = lichtLage(...PERTH, new Date('2030-06-21T04:00:00Z'))
assert.ok(li.morgen.richtung > 45 && li.morgen.richtung < 80, String(li.morgen.richtung))
assert.ok(li.abend.richtung > 280 && li.abend.richtung < 315, String(li.abend.richtung))
assert.ok(li.jetzt.hoehe > 30 && li.jetzt.hoehe < 40 && (li.jetzt.richtung < 20 || li.jetzt.richtung > 340), JSON.stringify(li.jetzt))
// Abends im Juni steigt die Milchstraße im Osten auf
const ms = milchstrasse(new Date('2030-06-15T11:00:00Z'), ...PERTH)
assert.ok(ms.richtung > 60 && ms.richtung < 150, String(ms.richtung))
const mo = mondLage(...PERTH, new Date('2030-06-15T04:00:00Z'))
assert.ok(mo.prozent > 95 && mo.auf && mo.unter && mo.aufRichtung > 45 && mo.aufRichtung < 135, JSON.stringify(mo))
console.log('foto-lage ok')
