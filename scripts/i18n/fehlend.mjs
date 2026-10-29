// Sammelt alle Texte aus t('…') und tn(n, '…', '…') in src/ und vergleicht mit src/lib/sprache/en.js.
//   node scripts/i18n/fehlend.mjs            → Zusammenfassung und fehlende Schlüssel (eine Zeile je Schlüssel, JSON)
//   node scripts/i18n/fehlend.mjs --json     → fehlende Schlüssel als JSON-Liste
//   node scripts/i18n/fehlend.mjs --ueberfluessig → Einträge in en.js, die im Code nicht mehr vorkommen
import fs from 'node:fs'
import { execSync } from 'node:child_process'
import { parse } from 'svelte/compiler'
import * as acorn from 'acorn'
import { zusatzSchluessel } from './zusatz.mjs'

export function sammleSchluessel() {
  const dateien = execSync('find src -name "*.svelte" -o -name "*.js"', { encoding: 'utf8' }).trim().split('\n').filter((f) => !f.includes('/sprache/') && !f.endsWith('geo-world.js'))
  const schluessel = new Map()
  const merke = (s, f) => { if (!schluessel.has(s)) schluessel.set(s, new Set()); schluessel.get(s).add(f) }
  for (const f of dateien) {
    const q = fs.readFileSync(f, 'utf8')
    if (!/\bt\(|\btn\(/.test(q)) continue
    let wurzeln
    try {
      if (f.endsWith('.svelte')) { const a = parse(q, { modern: true }); wurzeln = [a.module?.content, a.instance?.content, a.fragment].filter(Boolean) }
      else wurzeln = [acorn.parse(q, { ecmaVersion: 'latest', sourceType: 'module' })]
    } catch (e) { console.error('Kann nicht lesen:', f, e.message); continue }
    const geh = (n) => {
      if (!n || typeof n !== 'object') return
      if (Array.isArray(n)) { n.forEach(geh); return }
      if (n.type === 'CallExpression' && n.callee.type === 'Identifier') {
        const a = n.arguments
        const s = (x) => (x && x.type === 'Literal' && typeof x.value === 'string' ? x.value : null)
        // t(bedingung ? 'A' : 'B', …) und verschachtelte Bedingungen: alle Texte zählen
        const lits = (x) => (!x ? [] : x.type === 'ConditionalExpression' ? [...lits(x.consequent), ...lits(x.alternate)] : s(x) != null ? [s(x)] : [])
        if (n.callee.name === 't') lits(a[0]).forEach((v) => merke(v, f))
        if (n.callee.name === 'tn') { if (s(a[1]) != null) merke(s(a[1]), f); if (s(a[2]) != null) merke(s(a[2]), f) }
      }
      for (const k of Object.keys(n)) if (k !== 'loc' && k !== 'metadata' && n[k] && typeof n[k] === 'object') geh(n[k])
    }
    wurzeln.forEach(geh)
  }
  for (const z of zusatzSchluessel()) merke(z, 'Daten')
  return schluessel
}
export function ladeEn() {
  const q = fs.readFileSync('src/lib/sprache/en.js', 'utf8')
  const json = q.slice(q.indexOf('export default') + 'export default'.length).trim().replace(/;?\s*$/, '')
  return JSON.parse(json)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = sammleSchluessel(), en = ladeEn()
  const fehlt = [...s.keys()].filter((k) => !(k in en))
  if (process.argv.includes('--json')) console.log(JSON.stringify(fehlt, null, 1))
  else if (process.argv.includes('--ueberfluessig')) console.log([...Object.keys(en)].filter((k) => !s.has(k)).join('\n'))
  else { console.log(`Schlüssel im Code: ${s.size}, übersetzt: ${s.size - fehlt.length}, fehlen: ${fehlt.length}`); fehlt.forEach((k) => console.log(JSON.stringify(k), '←', [...s.get(k)].map((f) => f.replace('src/', '')).join(', '))) }
}
