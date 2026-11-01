// Dateien aus der Ausgabe: PDF-Aufbau, TIFF-Kopf und Seitenumbrüche.
import assert from 'node:assert/strict'
import { pdfAusJpegs, tiffAusSeiten, seitenSchnitte, A4_HOCH } from '../src/lib/ausgabe.js'

const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9])
const pdf = new Uint8Array(await pdfAusJpegs([{ bytes: jpeg, ...A4_HOCH }, { bytes: jpeg, ...A4_HOCH }]).arrayBuffer())
const text = new TextDecoder('latin1').decode(pdf)
assert.ok(text.startsWith('%PDF-1.4'))
assert.ok(text.endsWith('%%EOF\n'))
assert.ok(text.includes('/Count 2'))
const xref = Number(/startxref\n(\d+)/.exec(text)[1])
assert.equal(text.slice(xref, xref + 4), 'xref')
for (const [, stelle, nr] of text.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm).map((m, i) => [m, m[1], i + 1])) assert.equal(text.slice(Number(stelle)).split(' ')[0], String(nr))

const rgb = new Uint8Array(12).fill(200)
const t = new DataView(await tiffAusSeiten([{ rgb, breite: 2, hoehe: 2 }, { rgb, breite: 2, hoehe: 2 }]).arrayBuffer())
assert.equal(t.getUint16(0), 0x4949)
assert.equal(t.getUint16(2, true), 42)
const ifd1 = t.getUint32(4, true)
assert.equal(t.getUint16(ifd1, true), 12)
const ifd2 = t.getUint32(ifd1 + 2 + 12 * 12, true)
assert.ok(ifd2 > ifd1)
assert.equal(t.getUint32(ifd2 + 2 + 12 * 12, true), 0)

const a = (oben, unten, umbruch = false) => ({ oben, unten, umbruch })
assert.deepEqual(seitenSchnitte([a(0, 400), a(400, 800), a(800, 1200)], 1000), [{ von: 0, bis: 800 }, { von: 800, bis: 1200 }])
assert.deepEqual(seitenSchnitte([a(0, 100, true), a(100, 200)], 1000), [{ von: 0, bis: 100 }, { von: 100, bis: 200 }])
assert.deepEqual(seitenSchnitte([a(0, 2500)], 1000), [{ von: 0, bis: 1000 }, { von: 1000, bis: 2000 }, { von: 2000, bis: 2500 }])
assert.deepEqual(seitenSchnitte([a(0, 900), { ...a(900, 960), halten: true }, a(960, 1100)], 1000), [{ von: 0, bis: 900 }, { von: 900, bis: 1100 }])
console.log('✓ Ausgabe')
