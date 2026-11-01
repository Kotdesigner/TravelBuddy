// Schreibt public/lizenzen.txt: alle Bibliotheken, die in der App landen, mit Lizenztext, dazu die Schriften.
// Neu erzeugen, wenn sich Pakete ändern: node scripts/lizenzen.mjs
import fs from 'node:fs'
import path from 'node:path'

const WURZEL = new URL('../', import.meta.url).pathname
const paket = JSON.parse(fs.readFileSync(WURZEL + 'package.json', 'utf8'))
// Laufzeit: die eigenen Abhängigkeiten, Svelte und was der Service Worker mitbringt
const start = [...Object.keys(paket.dependencies), 'svelte', 'workbox-window', 'workbox-precaching', 'workbox-routing', 'workbox-strategies', 'workbox-expiration', 'workbox-cacheable-response', 'workbox-core']
const NUR_BAU = /^(acorn|@sveltejs\/acorn-typescript|@types\/|aria-query|axobject-query|esrap|is-reference|locate-character|magic-string|zimmerframe|devalue|@jridgewell\/)/

function finde(name, von) {
  for (let d = von; (d + '/').startsWith(WURZEL); d = path.dirname(d)) {
    const p = path.join(d, 'node_modules', name)
    if (fs.existsSync(path.join(p, 'package.json'))) return p
  }
  return null
}
const gesehen = new Map()
function lauf(name, von) {
  if (NUR_BAU.test(name)) return
  const ort = finde(name, von)
  if (!ort || gesehen.has(ort)) return
  const p = JSON.parse(fs.readFileSync(path.join(ort, 'package.json'), 'utf8'))
  gesehen.set(ort, p)
  for (const d of Object.keys(p.dependencies || {})) lauf(d, ort + '/')
}
for (const n of start) lauf(n, WURZEL)

function text(ort) {
  const f = fs.readdirSync(ort).find((x) => /^(licen[cs]e|copying)/i.test(x))
  return f ? fs.readFileSync(path.join(ort, f), 'utf8').trim() : ''
}
// Diese beiden Pakete liefern ihren Lizenztext nicht mit, er stammt aus den Projekten selbst
const NACHGETRAGEN = { pmtiles: 'scripts/lizenz-pmtiles.txt', 'protomaps-themes-base': 'scripts/lizenz-protomaps-themes.txt' }
const eintraege = [...gesehen].map(([ort, p]) => ({ name: p.name, version: p.version, lizenz: typeof p.license === 'string' ? p.license : p.license?.type || p.licenses?.[0]?.type || 'BSD', url: String(p.repository?.url || p.repository || p.homepage || '').replace(/^git\+/, '').replace(/\.git$/, ''), text: text(ort) || (NACHGETRAGEN[p.name] ? fs.readFileSync(WURZEL + NACHGETRAGEN[p.name], 'utf8').trim() : '') }))
  .sort((a, b) => a.name.localeCompare(b.name))

const ofl = fs.readFileSync(WURZEL + 'scripts/ofl-1.1.txt', 'utf8').trim()
const L = '='.repeat(72)
const aus = [`TravelBuddy nutzt die folgenden freien Bibliotheken und Schriften. Vielen Dank an ihre Autorinnen und Autoren.`,
  `TravelBuddy uses the following free libraries and fonts. Thanks to their authors.`, '', ...eintraege.map((e) => `${e.name} ${e.version} (${e.lizenz})`), 'Anton (SIL OFL 1.1)', 'Noto Sans (SIL OFL 1.1)', '']
for (const e of eintraege) aus.push(L, `${e.name} ${e.version}`, `${e.lizenz}${e.url ? ' · ' + e.url : ''}`, '', e.text || 'Lizenz laut Paketangabe, kein eigener Lizenztext im Paket.', '')
aus.push(L, 'Schriften / Fonts', '', 'Anton: Copyright 2020 The Anton Project Authors (https://github.com/googlefonts/AntonFont)', 'Noto Sans: Copyright 2022 The Noto Project Authors (https://github.com/notofonts/latin-greek-cyrillic)', '', ofl, '')
fs.writeFileSync(WURZEL + 'public/lizenzen.txt', aus.join('\n'))
console.log(eintraege.length, 'Pakete,', eintraege.filter((e) => !e.text).length, 'ohne Lizenztext:', eintraege.filter((e) => !e.text).map((e) => e.name).join(' '))
console.log([...new Set(eintraege.map((e) => e.lizenz))].join(', '))
