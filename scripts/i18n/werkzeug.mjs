// Werkzeug für die englische Fassung: findet deutsche Texte und wickelt sie in t('…') ein.
//
//   node scripts/i18n/werkzeug.mjs vorlage <datei.svelte…>       Texte und Attribute im Markup einwickeln (sicher, nur Anzeige)
//   node scripts/i18n/werkzeug.mjs liste <datei>                  Zeichenketten im Code auflisten (Kandidaten mit Nummer)
//   node scripts/i18n/werkzeug.mjs wickeln <datei> alle|1,2,5|-3,4  Kandidaten einwickeln (alle, nur diese, alle außer diesen)
//
// Zeichenketten im Code werden nie blind übersetzt: Viele sind Schlüssel (Speicher, Vergleiche,
// Kategorien). Deshalb erst `liste`, dann gezielt `wickeln`.
import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'svelte/compiler'
import * as acorn from 'acorn'
import MagicString from 'magic-string'

const BUCHST = /[A-Za-zÄÖÜäöüß]/g
const buchstaben = (s) => (s.match(BUCHST) || []).length
const lit = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'"
const ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", shy: '­', thinsp: ' ', ndash: '–', mdash: '—', hellip: '…', bdquo: '„', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', middot: '·', times: '×', euro: '€', deg: '°' }
const entschluesseln = (s) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e] ?? m))
const ATTRIBUTE = new Set(['placeholder', 'title', 'aria-label', 'alt', 'label', 'aria-roledescription', 'aria-valuetext', 'aria-description'])
const OHNE_TEXT = new Set(['style', 'script', 'code', 'pre', 'textarea'])

// ---------- Platzhalternamen aus Ausdrücken ----------
function nameVon(expr, quelle) {
  if (!expr) return 'wert'
  if (expr.type === 'Identifier') return expr.name
  if (expr.type === 'MemberExpression' && !expr.computed && expr.property.type === 'Identifier') return expr.property.name
  if (expr.type === 'CallExpression') return nameVon(expr.callee, quelle)
  if (expr.type === 'ChainExpression') return nameVon(expr.expression, quelle)
  return 'wert'
}
function eindeutig(name, belegt) {
  let n = name.replace(/[^\w]/g, '') || 'wert', i = 2
  if (/^\d/.test(n)) n = 'w' + n
  while (belegt.has(n)) n = name + i++
  belegt.add(n)
  return n
}
const parameter = (paare) => (paare.length ? ', { ' + paare.map(([k, v]) => (k === v ? k : `${k}: ${v}`)).join(', ') + ' }' : '')

// ---------- Markup ----------
function vorlage(datei) {
  const quelle = fs.readFileSync(datei, 'utf8')
  const ast = parse(quelle, { modern: true })
  const ms = new MagicString(quelle)
  let zahl = 0
  const lauf = (nodes) => {
    let i = 0
    while (i < nodes.length) {
      if (nodes[i].type !== 'Text' && nodes[i].type !== 'ExpressionTag') { i++; continue }
      let j = i
      while (j < nodes.length && (nodes[j].type === 'Text' || nodes[j].type === 'ExpressionTag')) j++
      wickleLauf(nodes.slice(i, j))
      i = j
    }
  }
  const wickleLauf = (teile) => {
    const texte = teile.filter((n) => n.type === 'Text')
    if (!texte.some((n) => buchstaben(n.data) >= 2)) return
    // führende/folgende Leerzeichen bleiben stehen
    const erstes = teile[0], letztes = teile[teile.length - 1]
    const vorn = erstes.type === 'Text' ? erstes.raw.match(/^(?:[ \t\n\r]|&nbsp;|&#160;| )*/)[0].length : 0
    const hinten = letztes.type === 'Text' ? letztes.raw.match(/(?:[ \t\n\r]|&nbsp;|&#160;| )*$/)[0].length : 0
    const belegt = new Set(), paare = []
    let schl = ''
    teile.forEach((n, k) => {
      if (n.type === 'Text') {
        let raw = n.raw
        if (k === 0) raw = raw.slice(vorn)
        if (k === teile.length - 1) raw = raw.slice(0, raw.length - hinten)
        schl += entschluesseln(raw.replace(/[ \t\n\r]+/g, ' '))
      } else {
        const src = quelle.slice(n.expression.start, n.expression.end)
        const name = eindeutig(nameVon(n.expression, quelle), belegt)
        paare.push([name, src])
        schl += `{${name}}`
      }
    })
    if (buchstaben(schl.replace(/\{\w+\}/g, '')) < 3) return
    const von = erstes.start + vorn, bis = letztes.end - hinten
    if (von >= bis) return
    ms.overwrite(von, bis, `{t(${lit(schl)}${parameter(paare)})}`)
    zahl++
  }
  const attribut = (a) => {
    if (a.type !== 'Attribute' || !ATTRIBUTE.has(a.name) || !Array.isArray(a.value)) return
    const teile = a.value
    if (!teile.some((n) => n.type === 'Text' && buchstaben(n.data) >= 2)) return
    const belegt = new Set(), paare = []
    let schl = ''
    for (const n of teile) {
      if (n.type === 'Text') schl += entschluesseln(n.raw)
      else { const src = quelle.slice(n.expression.start, n.expression.end); const name = eindeutig(nameVon(n.expression, quelle), belegt); paare.push([name, src]); schl += `{${name}}` }
    }
    if (buchstaben(schl.replace(/\{\w+\}/g, '')) < 3) return
    ms.overwrite(a.start, a.end, `${a.name}={t(${lit(schl.trim())}${parameter(paare)})}`)
    zahl++
  }
  const geh = (node) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) { node.forEach(geh); return }
    if (node.type === 'Fragment') { lauf(node.nodes); node.nodes.forEach(geh); return }
    if (['RegularElement', 'SvelteElement'].includes(node.type) && OHNE_TEXT.has(node.name)) { (node.attributes || []).forEach(attribut); return }
    if (node.attributes) node.attributes.forEach(attribut)
    for (const k of ['fragment', 'consequent', 'alternate', 'body', 'fallback', 'pending', 'then', 'catch']) if (node[k]) geh(node[k])
  }
  geh(ast.fragment)
  if (zahl) { importiere(ms, quelle, ast, datei, ['t']); fs.writeFileSync(datei, ms.toString()) }
  return zahl
}

// ---------- Import ergänzen ----------
function importPfad(datei) {
  let rel = path.relative(path.dirname(datei), path.resolve('src/lib/i18n.js')).split(path.sep).join('/')
  if (!rel.startsWith('.')) rel = './' + rel
  return rel
}
function importiere(ms, quelle, ast, datei, namen) {
  const pfad = importPfad(datei)
  const re = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]*i18n\.js)['"]/
  if (datei.endsWith('.svelte')) {
    const skript = ast.instance
    if (!skript) { ms.prepend(`<script>\n  import { ${namen.join(', ')} } from '${pfad}'\n</script>\n\n`); return }
    const inhalt = quelle.slice(skript.content.start, skript.content.end)
    const m = inhalt.match(re)
    if (m) {
      const da = m[1].split(',').map((s) => s.trim()).filter(Boolean)
      const neu = [...new Set([...da, ...namen])]
      if (neu.length !== da.length) ms.overwrite(skript.content.start + m.index, skript.content.start + m.index + m[0].length, `import { ${neu.join(', ')} } from '${m[2]}'`)
      return
    }
    ms.appendLeft(skript.content.start, `\n  import { ${namen.join(', ')} } from '${pfad}'`)
  } else {
    const m = quelle.match(re)
    if (m) {
      const da = m[1].split(',').map((s) => s.trim()).filter(Boolean)
      const neu = [...new Set([...da, ...namen])]
      if (neu.length !== da.length) ms.overwrite(m.index, m.index + m[0].length, `import { ${neu.join(', ')} } from '${m[2]}'`)
      return
    }
    // nach dem letzten Import am Dateianfang
    const prog = ast
    const imps = prog.body.filter((n) => n.type === 'ImportDeclaration')
    const zeile = `import { ${namen.join(', ')} } from '${pfad}'\n`
    if (imps.length) ms.appendLeft(imps[imps.length - 1].end, '\n' + zeile.trimEnd())
    else {
      // hinter einführende Kommentare
      const kopf = quelle.match(/^(?:\s*\/\/[^\n]*\n|\s*\/\*[\s\S]*?\*\/\s*\n)*/)[0].length
      ms.appendLeft(kopf, zeile)
    }
  }
}

// ---------- Code: Kandidaten ----------
const AUFRUF_NEIN = new Set(['getItem', 'setItem', 'removeItem', 'querySelector', 'querySelectorAll', 'getElementById', 'closest', 'matches', 'addEventListener', 'removeEventListener',
  'add', 'remove', 'toggle', 'contains', 'setAttribute', 'getAttribute', 'hasAttribute', 'removeAttribute', 'fetch', 'URL', 'createElement', 'createElementNS', 'matchMedia', 'require',
  'log', 'warn', 'error', 'info', 'debug', 't', 'tn', 'je', 'includes', 'startsWith', 'endsWith', 'indexOf', 'lastIndexOf', 'split', 'replace', 'replaceAll', 'match', 'matchAll', 'test', 'RegExp', 'get', 'set', 'has',
  'delete', 'dispatchEvent', 'Event', 'CustomEvent', 'postMessage', 'open', 'objectStore', 'transaction', 'createObjectStore', 'createIndex', 'index', 'toLocaleString', 'toLocaleDateString',
  'toLocaleTimeString', 'DateTimeFormat', 'NumberFormat', 'padStart', 'padEnd', 'localeCompare', 'geh', 'animate', 'scrollTo', 'getContext', 'toDataURL', 'toBlob', 'setProperty', 'getPropertyValue',
  'importScripts', 'register', 'search', 'getOrCreate', 'merke', 'speichern', 'laden', 'lade', 'oeffneDB', 'keyPath', 'getAll', 'put', 'execCommand', 'insertAdjacentHTML', 'append', 'Date', 'parse', 'stringify', 'Symbol'])
// Werte, die Schlüssel in gespeicherten Daten sind: nie im Code übersetzen, nur bei der Anzeige
const WERTE_NEIN = new Set(['MUSS-SEHEN', 'NUR-4WD', 'MEIN ORT', 'GEHEIMTIPP', 'EXPEDITION', ', Australia'])
const SCHLUESSEL_NEIN = new Set(['schluessel', 'id', 'typ', 'type', 'art', 'kat', 'key', 'icon', 'farbe', 'color', 'class', 'href', 'src', 'url', 'pfad', 'route', 'modus', 'format', 'mime', 'emoji', 'ortId', 'feld', 'einheit', 'tab', 'unter', 'quelle', 'datei', 'region', 'zone', 'lang', 'rel', 'target', 'accept', 'stil', 'cls'])
function istProsa(s) {
  if (buchstaben(s) < 3) return false
  if (/^\s*$/.test(s) || WERTE_NEIN.has(s)) return false
  if (process.env.KLEIN && /^[a-zäöüß]{3,}$/.test(s) && /[äöüß]|(ung|en|lich|ig|bar|heit|keit|ert|iert|t)$/.test(s) && !/^(true|false|null|auto|none|flug|route|etappe|text|zahl|rating|dropdown|tags|toggle|farbe|counter|textlang|eigen|plan|heute|orte|logbuch|mehr|sueden|norden|osten|meine|routen|lesen|tiere|notizen|notfall|vorbereitung|gefahren|packliste|praxis|musik|teilen|quiz|wanderung|wunsch|gemacht|geplant|hell|dunkel|ok|fehler|info|lang|kurz|alle)$/.test(s)) return true
  if (/^[a-z0-9_\-.:]+$/.test(s)) return false
  if (/^[A-Z0-9_]+$/.test(s)) return false
  if (/^[a-z]+(?:[A-Z][a-z0-9]*)+$/.test(s)) return false
  if (/^(https?:|\/|\.\/|\.\.\/|#|data:|mailto:|tel:|blob:|geo:|sms:)/.test(s)) return false
  if (/^[\w\-./@{}]+$/.test(s) && /[./@]/.test(s)) return false
  if (/\.(js|mjs|json|png|jpe?g|svg|pdf|html?|mp3|m4a|webp|pmtiles|css|xlsx|csv|ics|gpx|txt|webmanifest)$/i.test(s)) return false
  if (/var\(--|[{};]|^\s*[\d.\s]+(px|rem|em|vh|vw|%|deg|ms|s)\b|rgba?\(|cubic-bezier|^\d+(\.\d+)?\s*\/\s*\d/.test(s)) return false
  return /\s/.test(s) || /^[A-ZÄÖÜ]/.test(s) || /[äöüßÄÖÜ]/.test(s)
}
function sammle(quelle, wurzeln) {
  const kand = []
  const besuche = (node, eltern) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) { node.forEach((n) => besuche(n, eltern)); return }
    if (typeof node.type !== 'string') return
    if (node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration') return
    if (node.type === 'ExportNamedDeclaration' && node.source) return
    if (node.type === 'TaggedTemplateExpression') return
    if (node.type === 'Literal' && typeof node.value === 'string' && istProsa(node.value)) pruefe(node, eltern, node.value)
    else if (node.type === 'TemplateLiteral') {
      const stat = node.quasis.map((q) => q.value.cooked ?? '').join('X')   // Platzhalter ohne Leerzeichen: Pfade wie plan/X/X bleiben Pfade
      if (istProsa(stat) && /\s/.test(stat) && !/[<>]|:\/\//.test(stat)) pruefe(node, eltern, quelle.slice(node.start, node.end))
    }
    for (const k of Object.keys(node)) {
      if (k === 'parent' || k === 'loc' || k === 'metadata' || k === 'leadingComments' || k === 'trailingComments') continue
      const v = node[k]
      if (v && typeof v === 'object') besuche(v, [...eltern.slice(-6), { node, k }])
    }
  }
  const pruefe = (node, eltern, text) => {
    const p = eltern[eltern.length - 1] || {}
    const pn = p.node || {}
    if (pn.type === 'Property' && p.k === 'key' && !pn.computed) return
    if (pn.type === 'MemberExpression' && p.k === 'property') return
    if (pn.type === 'BinaryExpression' && ['===', '!==', '==', '!='].includes(pn.operator)) return
    if (pn.type === 'SwitchCase' && p.k === 'test') return
    if (pn.type === 'CallExpression' || pn.type === 'NewExpression') {
      const c = pn.callee
      const fn = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && !c.computed ? c.property.name : ''
      if (p.k === 'arguments' && AUFRUF_NEIN.has(fn)) return
    }
    let ctx = pn.type || '?'
    if (pn.type === 'Property') { const kn = pn.key.name ?? pn.key.value; if (SCHLUESSEL_NEIN.has(kn)) return; ctx = 'Prop:' + kn }
    else if (pn.type === 'CallExpression' || pn.type === 'NewExpression') { const c = pn.callee; ctx = 'Arg:' + (c.name ?? c.property?.name ?? '?') }
    else if (pn.type === 'VariableDeclarator') ctx = 'Var:' + (pn.id.name ?? '?')
    else if (pn.type === 'AssignmentExpression') ctx = 'Zuw:' + (pn.left.name ?? pn.left.property?.name ?? '?')
    else if (pn.type === 'ArrayExpression') { const gp = eltern[eltern.length - 2]?.node; ctx = 'Liste' + (gp?.type === 'Property' ? ':' + (gp.key.name ?? gp.key.value) : gp?.type === 'VariableDeclarator' ? ':' + gp.id.name : '') }
    kand.push({ node, text, ctx })
  }
  for (const w of wurzeln) besuche(w, [])
  kand.sort((a, b) => a.node.start - b.node.start)
  return kand
}
function einlesen(datei) {
  const quelle = fs.readFileSync(datei, 'utf8')
  if (datei.endsWith('.svelte')) {
    const ast = parse(quelle, { modern: true })
    const wurzeln = [ast.module?.content, ast.instance?.content, ast.fragment].filter(Boolean)
    return { quelle, ast, wurzeln }
  }
  const ast = acorn.parse(quelle, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true })
  return { quelle, ast, wurzeln: [ast] }
}
const zeileVon = (quelle, pos) => quelle.slice(0, pos).split('\n').length

function liste(datei) {
  const { quelle, wurzeln } = einlesen(datei)
  const kand = sammle(quelle, wurzeln)
  kand.forEach((c, i) => console.log(`${i + 1}\tZ${zeileVon(quelle, c.node.start)}\t${c.ctx}\t${c.text.length > 110 ? c.text.slice(0, 107) + '…' : c.text}`))
  return kand.length
}

function wickeln(datei, auswahl) {
  const { quelle, ast, wurzeln } = einlesen(datei)
  const kand = sammle(quelle, wurzeln)
  let nimm
  if (auswahl === 'alle') nimm = kand.map((_, i) => i + 1)
  else if (auswahl.startsWith('-')) { const weg = new Set(auswahl.slice(1).split(',').map(Number)); nimm = kand.map((_, i) => i + 1).filter((n) => !weg.has(n)) }
  else nimm = auswahl.split(',').map(Number)
  const ms = new MagicString(quelle)
  let zahl = 0
  // äußere zuerst; innere (in einem schon gewickelten Bereich) überspringen
  const bereiche = []
  for (const n of nimm.sort((a, b) => a - b)) {
    const c = kand[n - 1]
    if (!c) continue
    if (bereiche.some(([a, b]) => c.node.start >= a && c.node.end <= b)) continue
    if (c.node.type === 'Literal') ms.overwrite(c.node.start, c.node.end, `t(${lit(c.node.value)})`)
    else {
      const belegt = new Set(), paare = []
      let schl = ''
      c.node.quasis.forEach((q, k) => {
        schl += q.value.cooked ?? ''
        const e = c.node.expressions[k]
        if (e) { const name = eindeutig(nameVon(e, quelle), belegt); paare.push([name, quelle.slice(e.start, e.end)]); schl += `{${name}}` }
      })
      ms.overwrite(c.node.start, c.node.end, `t(${lit(schl)}${parameter(paare)})`)
    }
    bereiche.push([c.node.start, c.node.end])
    zahl++
  }
  if (zahl) { importiere(ms, quelle, datei.endsWith('.svelte') ? ast : ast, datei, ['t']); fs.writeFileSync(datei, ms.toString()) }
  return zahl
}

// 'de-DE' in Datums- und Zahlenformaten durch LOCALE ersetzen
function locale(datei) {
  const quelle = fs.readFileSync(datei, 'utf8')
  const re = /(['"])de-DE\1|(?<=toLocale(?:Date|Time)?String\()(['"])de\2|(?<=localeCompare\([^,()]+,\s*)(['"])de\3/g
  const treffer = [...quelle.matchAll(re)]
  if (!treffer.length) return 0
  const { ast } = einlesen(datei)
  const ms = new MagicString(quelle)
  for (const m of treffer) ms.overwrite(m.index, m.index + m[0].length, 'LOCALE')
  importiere(ms, quelle, ast, datei, ['LOCALE'])
  fs.writeFileSync(datei, ms.toString())
  return treffer.length
}

// Findet t('…')-Aufrufe in Bereichen, in denen eine lokale Variable `t` die Übersetzungsfunktion verdeckt
function namenAus(muster, out = []) {
  if (!muster) return out
  if (muster.type === 'Identifier') out.push(muster.name)
  else if (muster.type === 'ObjectPattern') muster.properties.forEach((p) => namenAus(p.type === 'RestElement' ? p.argument : p.value, out))
  else if (muster.type === 'ArrayPattern') muster.elements.forEach((e) => namenAus(e, out))
  else if (muster.type === 'AssignmentPattern') namenAus(muster.left, out)
  else if (muster.type === 'RestElement') namenAus(muster.argument, out)
  return out
}
function schatten(datei) {
  const { quelle, wurzeln } = einlesen(datei)
  const funde = []
  const geh = (n, verdeckt) => {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) { n.forEach((x) => geh(x, verdeckt)); return }
    let v = verdeckt
    const deklariert = []
    if (/Function/.test(n.type || '')) n.params?.forEach((p) => namenAus(p, deklariert))
    if (n.type === 'CatchClause') namenAus(n.param, deklariert)
    if (n.type === 'BlockStatement' || n.type === 'Program' || n.type === 'SwitchCase') for (const st of n.body || n.consequent || []) if (st.type === 'VariableDeclaration') st.declarations.forEach((d) => namenAus(d.id, deklariert))
    if ((n.type === 'ForOfStatement' || n.type === 'ForInStatement' || n.type === 'ForStatement') && (n.left || n.init)?.type === 'VariableDeclaration') (n.left || n.init).declarations.forEach((d) => namenAus(d.id, deklariert))
    if (n.type === 'EachBlock') { namenAus(n.context, deklariert); if (n.index) deklariert.push(n.index) }
    if (n.type === 'SnippetBlock') n.parameters?.forEach((p) => namenAus(p, deklariert))
    if (n.type === 'AwaitBlock') { namenAus(n.value, deklariert); namenAus(n.error, deklariert) }
    if (n.type === 'Program' && verdeckt === undefined) v = false   // oberste Ebene: Import t ist gemeint
    else if (deklariert.includes('t')) v = true
    if (n.type === 'CallExpression' && n.callee?.type === 'Identifier' && n.callee.name === 't' && v) funde.push(zeileVon(quelle, n.start))
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'metadata') continue
      if (n.type === 'EachBlock' && k === 'expression') { geh(n[k], verdeckt); continue }
      if (n[k] && typeof n[k] === 'object') geh(n[k], v)
    }
  }
  wurzeln.forEach((w) => geh(w, undefined))
  return funde
}

// Benennt im Markup die Variable `t` eines {#each … as t} oder {#snippet x(t)} in der angegebenen Zeile um
function umbenennen(datei, zeile, neu) {
  const quelle = fs.readFileSync(datei, 'utf8')
  const ast = parse(quelle, { modern: true })
  const ms = new MagicString(quelle)
  let zahl = 0
  const ersetze = (n, eltern) => {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) { n.forEach((x) => ersetze(x, eltern)); return }
    if (n.type === 'Identifier' && n.name === 't') {
      const e = eltern
      const ueber = e && e.node.type === 'CallExpression' && e.k === 'callee' && e.node.arguments[0]?.type === 'Literal' && typeof e.node.arguments[0].value === 'string'
      const eig = e && e.node.type === 'MemberExpression' && e.k === 'property' && !e.node.computed
      const schl = e && e.node.type === 'Property' && e.k === 'key' && !e.node.computed
      if (schl && e.node.shorthand) { ms.overwrite(n.start, n.end, 't: ' + neu); zahl++ }
      else if (!ueber && !eig && !schl) { ms.overwrite(n.start, n.end, neu); zahl++ }
    }
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'metadata') continue
      if (n.type === 'Property' && n.shorthand && k === 'value') continue
      if (n[k] && typeof n[k] === 'object') ersetze(n[k], { node: n, k })
    }
  }
  const geh = (n) => {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) { n.forEach(geh); return }
    if ((n.type === 'EachBlock' || n.type === 'SnippetBlock') && zeileVon(quelle, n.start) === zeile) {
      const bindung = n.type === 'EachBlock' ? n.context : n.parameters?.find((p) => p.name === 't')
      if (bindung?.type === 'Identifier' && bindung.name === 't') {
        ms.overwrite(bindung.start, bindung.end, neu); zahl++
        if (n.key) ersetze(n.key, null)
        ersetze(n.body, null)
        if (n.fallback) ersetze(n.fallback, null)
        return
      }
    }
    for (const k of Object.keys(n)) if (k !== 'loc' && k !== 'metadata' && n[k] && typeof n[k] === 'object') geh(n[k])
  }
  geh(ast.fragment)
  if (zahl) fs.writeFileSync(datei, ms.toString())
  return zahl
}

// t('{length} {wert} …', { length: X, wert: X === 1 ? 'A' : 'B' }) → tn(X, '{n} A …', '{n} B …')
function mehrzahl(datei) {
  const { quelle, ast, wurzeln } = einlesen(datei)
  const ms = new MagicString(quelle)
  let zahl = 0
  const src = (n) => quelle.slice(n.start, n.end)
  const geh = (n) => {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) { n.forEach(geh); return }
    if (n.type === 'CallExpression' && n.callee?.type === 'Identifier' && n.callee.name === 't' && n.arguments.length === 2 && n.arguments[0].type === 'Literal' && n.arguments[1].type === 'ObjectExpression') {
      const props = n.arguments[1].properties.filter((p) => p.type === 'Property')
      const wahl = props.find((p) => p.value.type === 'ConditionalExpression' && p.value.test.type === 'BinaryExpression' && ['===', '=='].includes(p.value.test.operator) && p.value.test.right.type === 'Literal' && p.value.test.right.value === 1
        && p.value.consequent.type === 'Literal' && p.value.alternate.type === 'Literal')
      if (wahl) {
        const x = src(wahl.value.test.left)
        const zaehler = props.find((p) => p !== wahl && src(p.value) === x)
        const kn = (p) => p.key.name ?? p.key.value
        if (zaehler) {
          let k = n.arguments[0].value.split('{' + kn(zaehler) + '}').join('{n}')
          const k1 = k.split('{' + kn(wahl) + '}').join(wahl.value.consequent.value), k2 = k.split('{' + kn(wahl) + '}').join(wahl.value.alternate.value)
          const rest = props.filter((p) => p !== wahl && p !== zaehler).map((p) => (p.shorthand ? kn(p) : `${kn(p)}: ${src(p.value)}`))
          ms.overwrite(n.start, n.end, `tn(${x}, ${lit(k1)}, ${lit(k2)}${rest.length ? ', { ' + rest.join(', ') + ' }' : ''})`)
          zahl++
          return
        }
      }
    }
    for (const k of Object.keys(n)) if (k !== 'loc' && k !== 'metadata' && n[k] && typeof n[k] === 'object') geh(n[k])
  }
  wurzeln.forEach(geh)
  if (zahl) { importiere(ms, quelle, ast, datei, ['tn']); fs.writeFileSync(datei, ms.toString()) }
  return zahl
}

// Benennt im Code eine Variable `t` (Parameter oder const/let in der angegebenen Zeile) im
// ganzen umgebenden Funktionsbereich um. Innere Bereiche mit eigenem `t` bleiben unberührt,
// Übersetzungsaufrufe t('…') auch.
function umbenennenJs(datei, zeile, neu) {
  const { quelle, wurzeln } = einlesen(datei)
  const ms = new MagicString(quelle)
  let zahl = 0, bereich = null
  const finde = (n, fnStack) => {
    if (!n || typeof n !== 'object' || bereich) return
    if (Array.isArray(n)) { n.forEach((x) => finde(x, fnStack)); return }
    const istFn = /Function/.test(n.type || '')
    const stack = istFn || n.type === 'Program' ? [...fnStack, n] : fnStack
    if (istFn && n.params.some((p) => namenAus(p).includes('t')) && zeileVon(quelle, n.start) === zeile) { bereich = n; return }
    if (n.type === 'VariableDeclarator' && namenAus(n.id).includes('t') && zeileVon(quelle, n.start) === zeile) { bereich = stack[stack.length - 1]; return }
    for (const k of Object.keys(n)) if (k !== 'loc' && k !== 'metadata' && n[k] && typeof n[k] === 'object') finde(n[k], stack)
  }
  wurzeln.forEach((w) => finde(w, []))
  if (!bereich) return 0
  const eigenesT = (n) => /Function/.test(n.type || '') && (n.params.some((p) => namenAus(p).includes('t')) || (n.body?.type === 'BlockStatement' && n.body.body.some((st) => st.type === 'VariableDeclaration' && st.declarations.some((d) => namenAus(d.id).includes('t')))))
  const ersetze = (n, eltern) => {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) { n.forEach((x) => ersetze(x, eltern)); return }
    if (n !== bereich && eigenesT(n)) return
    if (n.type === 'Identifier' && n.name === 't') {
      const e = eltern
      const ueber = e && e.node.type === 'CallExpression' && e.k === 'callee' && e.node.arguments[0]?.type === 'Literal' && typeof e.node.arguments[0].value === 'string'
      const eig = e && e.node.type === 'MemberExpression' && e.k === 'property' && !e.node.computed
      const schl = e && e.node.type === 'Property' && e.k === 'key' && !e.node.computed
      if (schl && e.node.shorthand) { ms.overwrite(n.start, n.end, 't: ' + neu); zahl++ }
      else if (!ueber && !eig && !schl) { ms.overwrite(n.start, n.end, neu); zahl++ }
    }
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'metadata') continue
      if (n.type === 'Property' && n.shorthand && k === 'value') continue
      if (n[k] && typeof n[k] === 'object') ersetze(n[k], { node: n, k })
    }
  }
  ersetze(bereich, null)
  if (zahl) fs.writeFileSync(datei, ms.toString())
  return zahl
}

const [befehl, ...rest] = process.argv.slice(2)
if (befehl === 'vorlage') { let s = 0; for (const d of rest) { const n = vorlage(d); s += n; console.log(String(n).padStart(4), d) } console.log('gesamt', s) }
else if (befehl === 'locale') { for (const d of rest) { const n = locale(d); if (n) console.log(String(n).padStart(4), d) } }
else if (befehl === 'schatten') { for (const d of rest) { const f = schatten(d); if (f.length) console.log(d, 'Zeilen', [...new Set(f)].join(', ')) } }
else if (befehl === 'umbenennen') console.log('umbenannt:', umbenennen(rest[0], Number(rest[1]), rest[2]))
else if (befehl === 'mehrzahl') { for (const d of rest) { const n = mehrzahl(d); if (n) console.log(String(n).padStart(4), d) } }
else if (befehl === 'import') { const [d, ...namen] = rest; const { quelle, ast } = einlesen(d); const ms = new MagicString(quelle); importiere(ms, quelle, ast, d, namen); fs.writeFileSync(d, ms.toString()); console.log('Import ergänzt:', d, namen.join(', ')) }
else if (befehl === 'umbenennenjs') console.log('umbenannt:', umbenennenJs(rest[0], Number(rest[1]), rest[2]))
else if (befehl === 'liste') console.log('Kandidaten:', liste(rest[0]))
else if (befehl === 'wickeln') console.log('eingewickelt:', wickeln(rest[0], rest[1] || 'alle'))
else console.log('Befehle: vorlage <dateien…> | liste <datei> | wickeln <datei> alle|1,2|-3,4')
