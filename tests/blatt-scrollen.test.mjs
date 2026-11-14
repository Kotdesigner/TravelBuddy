// Blätter und Dialoge: Was offen ist, scrollt bei sich. Die Seite dahinter steht still.
// Befund am iPhone: Im Blatt „Buchung ändern“ scrollte die Seite dahinter mit.
// Ausführen: node tests/blatt-scrollen.test.mjs   (kein Netz)
import fs from 'node:fs'
import path from 'node:path'

let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const ordner = new URL('../src/lib/', import.meta.url)

console.log('\nJedes feste Blatt hält seine Wischgeste bei sich')
{
  const offen = []
  for (const datei of fs.readdirSync(ordner).filter((f) => f.endsWith('.svelte'))) {
    const stil = lies(path.join('src/lib', datei)).split('<style>')[1] || ''
    for (const m of stil.matchAll(/\n\s*([.#][\w-]+)\s*\{([^}]*)\}/g)) {
      const [, wahl, regeln] = m
      if (!/position:\s*fixed/.test(regeln)) continue
      if (!/overflow(-y)?:\s*(auto|scroll)/.test(regeln)) continue
      if (/overscroll-behavior/.test(regeln)) continue
      offen.push(`${datei} ${wahl}`)
    }
  }
  p('Kein festes Blatt ohne „overscroll-behavior: contain“', offen.length === 0, offen.join(' | '))
}

console.log('\nDie Seite dahinter steht still, solange ein Dialog offen ist')
{
  const m = lies('src/lib/modal.js')
  p('modal.js hält die Seite an und gibt sie wieder frei', /function seiteAnhalten/.test(m) && /function seiteWeiter/.test(m) && /seiteAnhalten\(\)/.test(m) && /seiteWeiter\(\)/.test(m))
  p('Dialog im Dialog wird mitgezählt', /offeneDialoge\+\+/.test(m) && /offeneDialoge > 0/.test(m))
  p('Der vorige Zustand kommt zurück', /vorigesOverflow/.test(m) && /style\.overflow = vorigesOverflow/.test(m))
}

console.log('\nDas Blatt „Buchung ändern“ im Besonderen')
{
  const ba = lies('src/lib/BuchungAendern.svelte')
  p('Das Blatt scrollt bei sich', /\.ba \{[^}]*overscroll-behavior: contain/.test(ba), ba.match(/\.ba \{[^}]*/)?.[0]?.slice(0, 160))
  p('Der dunkle Hintergrund nimmt keine Wischgeste an', /\.ba-hg \{[^}]*touch-action: none/.test(ba))
}

console.log('\nEine Rückfrage liegt über jedem Blatt')
{
  // Vollbild-Sachen dürfen darüber bleiben: Notruf und die Spiele nehmen den ganzen Schirm.
  const AUSNAHME = ['DialogHost.svelte', 'NotrufTippen.svelte', 'XoxoSpiel.svelte', 'VierSpiel.svelte', 'SnakeSpiel.svelte', 'Runterziehen.svelte']
  const dh = lies('src/lib/DialogHost.svelte')
  const zDialog = Number((dh.match(/\.dh \{[^}]*z-index:\s*(\d+)/) || [])[1])
  p('Die Rückfrage hat eine eigene Lage', zDialog > 0, String(zDialog))
  const drueber = []
  for (const datei of fs.readdirSync(ordner).filter((f) => f.endsWith('.svelte'))) {
    if (AUSNAHME.includes(datei)) continue
    const stil = lies(path.join('src/lib', datei)).split('<style>')[1] || ''
    for (const m of stil.matchAll(/\n\s*([.#][\w-]+)\s*\{([^}]*)\}/g)) {
      const [, wahl, regeln] = m
      if (!/position:\s*fixed/.test(regeln)) continue
      const z = Number((regeln.match(/z-index:\s*(\d+)/) || [])[1])
      if (z && z >= zDialog) drueber.push(`${datei} ${wahl} z${z}`)
    }
  }
  p('Kein Blatt liegt über der Rückfrage', drueber.length === 0, drueber.join(' | '))
}

console.log('\nEine Meldung liegt über jedem Blatt und jeder Rückfrage')
{
  // Eine Meldung kommt oft aus einem Blatt heraus („Text kopiert“, „Storniert“). Lag sie darunter,
  // stand sie hinter dem dunklen Rand und war nicht zu lesen. Nur Vollbild-Sachen bleiben darüber.
  const AUSNAHME = ['NotrufTippen.svelte', 'XoxoSpiel.svelte', 'VierSpiel.svelte', 'SnakeSpiel.svelte', 'Runterziehen.svelte']
  const zMeldung = Number((lies('src/app.css').match(/--z-meldung:\s*(\d+)/) || [])[1])
  const toast = lies('src/lib/Toast.svelte')
  p('Die Meldungen haben eine eigene Lage', zMeldung > 0, String(zMeldung))
  p('Der Meldungsbereich nimmt sie auch', /\.toasts\s*\{[^}]*z-index:\s*var\(--z-meldung\)/.test(toast))
  const drueber = []
  for (const datei of fs.readdirSync(ordner).filter((f) => f.endsWith('.svelte'))) {
    if (AUSNAHME.includes(datei) || datei === 'Toast.svelte') continue
    const stil = lies(path.join('src/lib', datei)).split('<style>')[1] || ''
    for (const m of stil.matchAll(/\n\s*([.#][\w-]+)\s*\{([^}]*)\}/g)) {
      const [, wahl, regeln] = m
      if (!/position:\s*fixed/.test(regeln)) continue
      const z = Number((regeln.match(/z-index:\s*(\d+)/) || [])[1])
      if (z && z >= zMeldung) drueber.push(`${datei} ${wahl} z${z}`)
    }
  }
  p('Kein Blatt und keine Rückfrage liegt über der Meldung', drueber.length === 0, drueber.join(' | '))
}

console.log('\nHinter einer Rückfrage ist nichts mehr bedienbar')
{
  const m = lies('src/lib/modal.js')
  p('Ein aria-live tief im Blatt hält es nicht mehr bedienbar', !/querySelector\?\.\('\[aria-live\]'\)/.test(m))
  p('Der Meldungsbereich selbst bleibt hörbar', /hasAttribute\('aria-live'\)/.test(m) && /closest\('\[aria-live\]'\)/.test(m))
  p('Flächen zum Wegtippen bleiben bedienbar', /data-dialog-hg/.test(m))
}

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
