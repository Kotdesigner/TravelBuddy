import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import { mkdirSync, readdirSync, statSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Die Reisedokumente (Tickets, Buchungsbestätigungen, Pass, Visum) liegen als PDF
// in `_Documente`. Sie gehören NICHT nach `public/`: dort würden sie in den
// Workbox-Vorab-Cache wandern und die App lüde beim ersten Start 29 MB ungefragt.
// Stattdessen werden sie NACH dem Bundle nach `dist/dokumente/` kopiert und zur
// Laufzeit einzeln gecacht — genau wie die Offline-Karten.
//
// Beim Kopieren werden die Dateinamen auf NFC normalisiert. macOS legt sie als NFD
// ab („ä" = a + ̈ ), die Kalender-Datei verweist aber in NFC. Ohne diesen Schritt
// liefe jeder Verweis mit Umlaut ins Leere.
// Basic-Fassung: nur ein eigener Ordner `_Documente` (gibt es hier nicht). Nie in fremden Ordnern suchen,
// sonst landete eine Größentabelle fremder Belege im Build.
const DOK_QUELLE = '_Documente'
const DOK_ZIEL = 'dokumente'
const UEBERSPRINGEN = /^\.|\.msg$/i   // .DS_Store und Outlook-Nachrichten kann kein Browser zeigen

// ---------------------------------------------------------------------------
// Persönliche Papiere: Reisepass, Visum, Führerschein, Personalausweis,
// Krankenversicherung. Die liegen im Unterordner für persönliche Papiere.
//
// Sie sind STANDARDMÄSSIG NICHT im Build. Das ist Absicht: Wer den Schalter
// vergisst, veröffentlicht dann höchstens Hotelbestätigungen — nicht seinen Pass.
// Der umgekehrte Standard wäre die falsche Voreinstellung, weil sein Fehlerfall
// nicht wiedergutzumachen ist.
//
//   npm run build          → ohne persönliche Papiere  (zum Hochladen)
//   npm run build:privat   → mit allem                 (nur fürs eigene Gerät)
// ---------------------------------------------------------------------------
const PERSOENLICH = '00_Docs'

// GRUNDSATZ NACH DER SICHERHEITSPRUEFUNG:
// Der Standard-Build enthaelt GAR KEINE Reisebelege. Auch Flugtickets und
// Hotelbestaetigungen tragen vollen Namen, Buchungsnummern, eine Wohnanschrift
// und im Camper-Vertrag das Geburtsdatum einer zweiten Person, die der
// Veroeffentlichung nie zugestimmt hat. Auf eine oeffentlich erreichbare Adresse
// gehoert davon nichts.
//
//   npm run build          -> nur die App. Keine Belege. Zum Hochladen.
//   npm run build:privat   -> mit allen Belegen inkl. Pass/Visum. NUR lokal.
//
// Frueher stand hier eine Zwischenstufe (Belege ja, Pass nein). Die ist weg:
// sie hat eine Sicherheit vorgetaeuscht, die es nicht gab.
const MIT_BELEGEN = false   // Basic: nie Belege im Build
const MIT_PERSOENLICHEN = MIT_BELEGEN

function kopiereBaum(von, nach, gesammelt = [], praefix = '') {
  mkdirSync(nach, { recursive: true })
  for (const eintrag of readdirSync(von)) {
    if (UEBERSPRINGEN.test(eintrag)) continue
    if (!praefix && eintrag === PERSOENLICH && !MIT_PERSOENLICHEN) continue
    const q = join(von, eintrag)
    const name = eintrag.normalize('NFC')
    const z = join(nach, name)
    const rel = praefix ? `${praefix}/${name}` : name
    if (statSync(q).isDirectory()) kopiereBaum(q, z, gesammelt, rel)
    else { copyFileSync(q, z); gesammelt.push(rel) }
  }
  return gesammelt
}

// Kleiner, stabiler Hash (djb2) — identisch zu pfadHash() in src/lib/belege.js.
// Er ist KEINE Sicherheitsmassnahme, sondern nur ein Schluessel: die Groessentabelle
// darf keine lesbaren Pfade enthalten, weil die Dateinamen selbst schon Namen und
// Buchungsnummern tragen.
function pfadHash(pfad) {
  const s = pfad.normalize('NFC')
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

// Alle Belege im Quellordner mit ihrer Groesse erfassen — ohne sie zu kopieren.
// Damit kann die App spaeter selbst geladene Dateien eindeutig zuordnen:
// „Buchungsbestaetigung.pdf" gibt es siebenmal, die Groessen sind aber verschieden.
function groessenTabelle(von, praefix = '', out = {}) {
  for (const eintrag of readdirSync(von)) {
    if (UEBERSPRINGEN.test(eintrag)) continue
    const q = join(von, eintrag)
    const name = eintrag.normalize('NFC')
    const rel = praefix ? `${praefix}/${name}` : name
    if (statSync(q).isDirectory()) groessenTabelle(q, rel, out)
    else out[pfadHash(rel)] = statSync(q).size
  }
  return out
}

function reisedokumente() {
  return {
    name: 'reisedokumente',
    // Im Entwicklungsserver direkt aus dem Quellordner ausliefern, damit sich
    // `npm run dev` und der gebaute Stand nicht unterschiedlich verhalten.
    configureServer(server) {
      server.middlewares.use(`/${DOK_ZIEL}/`, (req, res, next) => {
        try {
          const rel = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
          const datei = resolve(DOK_QUELLE, rel)
          // Pfad-Ausbruch (../) verhindern: das Ziel muss im Quellordner liegen.
          if (!datei.startsWith(resolve(DOK_QUELLE)) || !existsSync(datei)) return next()
          res.setHeader('Content-Type', datei.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream')
          res.end(readFileSync(datei))
        } catch { next() }
      })
    },
    closeBundle() {
      const ziel = join('dist', DOK_ZIEL)
      // Die Groessentabelle wird IMMER mitgeliefert — sie enthaelt nur Hashes und
      // Zahlen, verraet also nichts, ermoeglicht aber das Zuordnen selbst geladener
      // Belege auf dem Telefon.
      if (existsSync(DOK_QUELLE)) {
        mkdirSync(ziel, { recursive: true })
        const tab = groessenTabelle(DOK_QUELLE)
        writeFileSync(join('dist', 'belege-groessen.json'), JSON.stringify(tab, null, 0))
        console.log(`\n  ✓ Groessentabelle fuer ${Object.keys(tab).length} Belege (nur Hashes und Zahlen)`)
      }
      if (!MIT_BELEGEN) {
        // Kennzeichen trotzdem schreiben: die App soll wissen, dass sie fuer keinen
        // Beleg einen Link anbieten darf, statt tote Links zu erzeugen.
        writeFileSync(join('dist', 'belege-verzeichnis.json'), JSON.stringify({ mitPersoenlichen: false, ausgelassen: ['*'] }, null, 0))
        console.log(`\n  🔒 OHNE Reisebelege gebaut — nichts Persoenliches im Build. Zum Hochladen geeignet.`)
        return
      }
      if (!existsSync(DOK_QUELLE)) { console.warn(`  ⚠ ${DOK_QUELLE}/ fehlt — keine Reisedokumente im Build`); return }
      const dateien = kopiereBaum(DOK_QUELLE, ziel)
      // Kennzeichen fuer die App: WELCHE Ordner wurden ausgelassen?
      //
      // Bewusst KEINE Dateiliste: Die Datei ist öffentlich abrufbar und wäre sonst ein
      // Inhaltsverzeichnis aller Belege mit ihren genauen Pfaden.
      //
      // Die App braucht die Liste gar nicht. Sie muss nur wissen, welcher Ordner
      // fehlt, um dafuer keinen toten Link anzubieten. Das verraet nichts.
      writeFileSync(join('dist', 'belege-verzeichnis.json'), JSON.stringify({ mitPersoenlichen: true, ausgelassen: [] }, null, 0))
      console.log(`\n  ✓ ${dateien.length} Reisebelege nach dist/${DOK_ZIEL}/ (nicht im Vorab-Cache)`)
      console.log(`  ⚠ MIT allem: Tickets, Hotelbestaetigungen, Reisepass, Visum, Fuehrerschein.`)
      console.log(`    Dieser Build gehoert AUSSCHLIESSLICH auf dein eigenes Geraet — niemals hochladen.\n`)
    },
  }
}

// Große Karte (`npm run build:gross`): die vier WA-Teile auf Stufe 14 liegen wegen ihrer Größe
// (zusammen gut 200 MB) nicht in public/, sondern in karten-gross/. Nur dieser Build kopiert sie
// nach dist/karten/; der normale Build bleibt klein. Fehlt eine Datei, bricht der Build ab,
// sonst zeigte die App Kartenteile an, die es auf dem Server nicht gibt.
const GROSS = process.env.VITE_KARTE === 'gross'
const GROSS_QUELLE = 'karten-gross'
const GROSS_DATEIEN = ['wa-sued.pmtiles', 'wa-mitte.pmtiles', 'wa-nordwest.pmtiles', 'wa-kimberley.pmtiles']

function grosseKarte() {
  return {
    name: 'grosse-karte',
    buildStart() {
      if (!GROSS) return
      const fehlt = GROSS_DATEIEN.filter((d) => !existsSync(join(GROSS_QUELLE, d)))
      if (fehlt.length) this.error(`Große Karte: es fehlt ${fehlt.join(', ')} in ${GROSS_QUELLE}/. Erst \`sh karten-gross/holen.sh\` ausführen.`)
    },
    configureServer(server) {
      if (!GROSS) return
      server.middlewares.use('/karten/', (req, res, next) => {
        const name = (req.url || '').split('?')[0].replace(/^\/+/, '')
        if (!GROSS_DATEIEN.includes(name)) return next()
        res.setHeader('Content-Type', 'application/octet-stream')
        res.end(readFileSync(join(GROSS_QUELLE, name)))
      })
    },
    closeBundle() {
      if (!GROSS) return
      mkdirSync(join('dist', 'karten'), { recursive: true })
      for (const d of GROSS_DATEIEN) copyFileSync(join(GROSS_QUELLE, d), join('dist', 'karten', d))
      console.log(`\n  ✓ Große Karte: ${GROSS_DATEIEN.length} Teile auf Stufe 14 nach dist/karten/`)
    },
  }
}

// PWA: App-Hülle + Inhalte + Bilder werden für Offline-Betrieb gecacht.
// registerType 'autoUpdate' => neue Version wird geladen, sobald wieder online.
// Build-Kennung: erscheint in der Fußzeile. So ist auf einen Blick erkennbar,
// ob der Browser noch eine alte, vom Service-Worker gecachte Fassung zeigt.
// Als Zeitstempel, die App schreibt ihn in ihrer Sprache („1.5.2027, 21:29“ / „1/5/2027, 9:29 pm“).
const BUILD = new Date().toISOString()

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [
    svelte(),
    reisedokumente(),
    grosseKarte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'TravelBuddy · Western Australia',
        short_name: 'TravelBuddy',
        description: 'Roadtrip-Planer und Reisetagebuch für Western Australia, auch offline.',
        lang: 'de',
        start_url: '/',
        display: 'standalone',
        background_color: '#fbf8f3',
        theme_color: '#7a3b1e',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App-Hülle + Inhalte vorab cachen. pmtiles NICHT vorab (sonst 22 MB Precache) —
        // sie werden SEGMENTWEISE bei Bedarf geholt: die App lädt die ganze Region-Datei
        // (normaler 200-Request) und pmtiles liest lokal daraus. Kein HTTP-Range nötig.
        globPatterns: ['**/*.{js,css,html,svg,json,png,webp,jpg,jpeg,woff2,pbf,pdf}'],
        // Reisedokumente werden erst NACH dem Bundle kopiert und sind hier ohnehin
        // nicht sichtbar — der Eintrag steht trotzdem da, damit die Absicht klar ist.
        globIgnores: ['**/*.pmtiles', '**/startdaten.json', 'dokumente/**'],
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Reisedokumente: jedes geöffnete PDF bleibt danach offline verfügbar.
            // 46 Dateien, 29 MB — deshalb bewusst NICHT vorab, sondern bei Bedarf
            // (oder auf einen Rutsch über „alle offline sichern").
            // Nur die PDFs selbst. Steuerdateien liegen bewusst NICHT hier drunter:
            // CacheFirst mit Jahresfrist wuerde sie nie wieder aktualisieren, und die App
            // wuerde nach einem neuen Build noch monatelang die alte Auskunft glauben.
            urlPattern: ({ url }) => url.pathname.includes('/dokumente/') && !url.pathname.endsWith('.json'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'reisedokumente-v1',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Offline-Karten: nur das geöffnete Segment wird gecacht (ganze Datei, ein 200-Request).
            urlPattern: ({ url }) => url.pathname.endsWith('.pmtiles'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'karten-pmtiles-v2',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
