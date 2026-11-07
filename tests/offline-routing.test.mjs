// Offline-Routen auf echten Straßen (V29): Netz bauen und lesen, Wegsuche (A*), Einbahn, Pisten meiden,
// Stopp mitten auf einer Straße, Schein-Kreuzungen, Genauigkeit gegen OSRM an den Routen-Ideen, Einbau.
import fs from 'node:fs'
import { baueNetz, netzAlsDatei, bewerteWeg, HAUPT_MAX_KLASSE } from '../scripts/strassennetz-kern.mjs'
import { leseNetz, routeOffline, wegZwischen, naechsteStrasse, meter } from '../src/lib/offline-router.js'
import { gebietFuer, netzReihe, GEBIETE, allradBesser } from '../src/lib/routing-offline.js'
import { stoppsAusRoute, brauchtAllrad } from '../src/lib/routen-ideen.js'
import { PISTEN_AUFSCHLAG } from '../src/lib/offline-router.js'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')

console.log('\nStraßenarten aus OSM')
p('Highway mit Asphalt: schnell, keine Piste', (() => { const b = bewerteWeg({ highway: 'primary', surface: 'asphalt' }); return b.klasse === 2 && b.kmh === 90 && !b.piste })())
p('Track ist Piste mit 30 km/h, Sand mit 20', bewerteWeg({ highway: 'track' }).piste && bewerteWeg({ highway: 'track' }).kmh === 30 && bewerteWeg({ highway: 'track', surface: 'sand' }).kmh === 20)
p('Schotter-Hauptstraße: Piste, höchstens 70 km/h', (() => { const b = bewerteWeg({ highway: 'secondary', surface: 'gravel' }); return b.piste && b.kmh === 70 })())
p('Privat, Einfahrten und Parkplätze fallen weg', !bewerteWeg({ highway: 'track', access: 'private' }) && !bewerteWeg({ highway: 'service', service: 'parking_aisle' }) && !bewerteWeg({ highway: 'footway' }))
p('Hauptstraßen-Netz nur bis Klasse 4 (tertiary), kein Track', bewerteWeg({ highway: 'tertiary' }, HAUPT_MAX_KLASSE) && !bewerteWeg({ highway: 'unclassified' }, HAUPT_MAX_KLASSE) && !bewerteWeg({ highway: 'track' }, HAUPT_MAX_KLASSE))
p('Einbahn erkannt, auch rückwärts und Kreisverkehr', bewerteWeg({ highway: 'primary', oneway: 'yes' }).einbahn === 1 && bewerteWeg({ highway: 'primary', oneway: '-1' }).einbahn === -1 && bewerteWeg({ highway: 'primary', junction: 'roundabout' }).einbahn === 1)

// Testnetz: ein Quadrat bei Perth. A(0,0) B(1,0) C(1,1) D(0,1) in Hundertstel Grad, dazu eine Piste quer A–C
const g = (x, y) => [115.8 + x * 0.01, -31.9 - y * 0.01]
const WEGE = [
  { tags: { highway: 'primary' }, refs: [1, 11, 2], coords: [g(0, 0), g(0.5, 0), g(1, 0)] },   // A–B (über Zwischenpunkt)
  { tags: { highway: 'primary' }, refs: [2, 3], coords: [g(1, 0), g(1, 1)] },                    // B–C
  { tags: { highway: 'primary' }, refs: [3, 4], coords: [g(1, 1), g(0, 1)] },                    // C–D
  { tags: { highway: 'primary', oneway: 'yes' }, refs: [4, 1], coords: [g(0, 1), g(0, 0)] },     // D→A Einbahn
  { tags: { highway: 'track' }, refs: [1, 3], coords: [g(0, 0), g(1, 1)] },                      // Piste quer
  { tags: { highway: 'primary' }, refs: [3, 5], coords: [g(1, 1), g(2, 1)] },                    // C–E, …
  { tags: { highway: 'primary' }, refs: [5, 6], coords: [g(2, 1), g(3, 1)] },                    // … E–F: E ist Schein-Kreuzung
]
const wege = (f) => WEGE.forEach(f)
const roh = baueNetz(wege, { minKomponenteKm: 0 })
const net = leseNetz(netzAlsDatei(roh))
console.log('\nTestnetz')
p('Schein-Kreuzungen B und E aufgelöst: A bis C und C bis F je eine Kante, D bleibt (Einbahn beginnt)', roh.kanten.length === 5 && roh.lon.length === 4, `${roh.kanten.length} Kanten, ${roh.lon.length} Knoten`)
p('Datei gelesen: gleiche Knoten und Kanten', net.N === roh.lon.length && net.M === roh.kanten.length)
const A = { lon: g(0, 0)[0], lat: g(0, 0)[1] }, C = { lon: g(1, 1)[0], lat: g(1, 1)[1] }, D = { lon: g(0, 1)[0], lat: g(0, 1)[1] }
const AB = meter(...g(0, 0), ...g(1, 0)), BC = meter(...g(1, 0), ...g(1, 1)), AD = meter(...g(0, 0), ...g(0, 1))
const ac = wegZwischen(net, A, C)
p('Schnellster Weg A nach C über die Hauptstraße, nicht die langsame Piste', ac && Math.abs(ac.m - (AB + BC)) < 5 && ac.pisteM === 0, ac && `${Math.round(ac.m)} m`)
const da = wegZwischen(net, D, A), ad = wegZwischen(net, A, D)
p('Einbahn D→A direkt, A→D nur außen herum', da && ad && Math.abs(da.m - AD) < 5 && Math.abs(ad.m - (AB + BC + AB)) < 5, `${da && Math.round(da.m)} / ${ad && Math.round(ad.m)}`)
const nurPiste = baueNetz((f) => f(WEGE[4]), { minKomponenteKm: 0 })
const pnet = leseNetz(netzAlsDatei(nurPiste))
p('Nur Piste: Weg gefunden, als Piste gezählt', (() => { const w = wegZwischen(pnet, A, C); return w && w.pisteM > 1000 })())
p('Pisten meiden: dann kein Weg', wegZwischen(pnet, A, C, { meidePiste: true }) === null)
const mitte = { lon: g(0.25, 0)[0], lat: g(0.25, 0)[1] + 0.0005 }   // knapp neben A–B, ein Viertel weit
const s = naechsteStrasse(net, mitte.lon, mitte.lat)
p('Stopp neben der Straße: auf die Straße gesetzt, an der richtigen Stelle der Kante A bis C', s && Math.abs(s.anteil - 0.25 * AB / (AB + BC)) < 0.005 && Math.abs(s.d - 55) < 3, s && `${s.anteil.toFixed(3)} · ${Math.round(s.d)} m`)
const dS = naechsteStrasse(net, D.lon, D.lat)
p('Stopp genau auf einer Straße am Süd- oder Westrand des Netzes wird gefunden', dS && dS.d < 1, dS && `${Math.round(dS.d)} m`)
const r = routeOffline(net, [A, mitte, C])
p('Route über drei Stopps: Abschnitte ergeben die Summe', r && r.legs.length === 2 && r.legs.reduce((n, l) => n + l.km, 0) === r.km && r.offline === true)
p('Stopp zu weit weg (über 30 km): keine Offline-Route', routeOffline(net, [A, { lon: 116.5, lat: -31.9 }]) === null)
// Lange gerade Kante (über 36 km) prüft den Sprung im Speicherformat
const lang = baueNetz((f) => f({ tags: { highway: 'primary' }, refs: [1, 2, 3], coords: [[120, -30], [120.6, -30.3], [121.2, -30]] }), { minKomponenteKm: 0, toleranzGrad: 0 })
const lnet = leseNetz(netzAlsDatei(lang))
p('Weiter Sprung zwischen Linienpunkten bleibt genau', lnet.pLon[0] === 12060000 && lnet.pLat[0] === -3030000, `${lnet.pLon[0]} ${lnet.pLat[0]}`)

console.log('\nWelches Netz wann')
p('Gebiet nach Stopps: WA, Melbourne, Cairns, sonst keins', gebietFuer([{ lat: -31.9, lon: 115.8 }, { lat: -35, lon: 117.9 }]) === 'wa' && gebietFuer([{ lat: -37.8, lon: 144.9 }, { lat: -37.5, lon: 145.3 }]) === 'vic' && gebietFuer([{ lat: -16.9, lon: 145.8 }, { lat: -16.5, lon: 145.5 }]) === 'qld' && gebietFuer([{ lat: -31.9, lon: 115.8 }, { lat: -37.8, lon: 144.9 }]) === null)
p('Pisten-Netz zuerst, wenn geladen, sonst nur Hauptstraßen', netzReihe('wa', true).map((n) => n.name).join() === 'pisten,haupt' && netzReihe('wa', false).map((n) => n.name).join() === 'haupt' && netzReihe(null, true).length === 0)

console.log('\nEchte Netze: Größe und Genauigkeit gegen OSRM (Routen-Ideen in WA)')
const manifest = JSON.parse(lies('public/routing/netze.json'))
p('Alle Gebiete mit beiden Netzen', Object.keys(GEBIETE).every((g2) => manifest[g2]?.haupt?.bytes > 0 && manifest[g2]?.pisten?.bytes > 0))
const haupt = Object.values(manifest).reduce((n, x) => n + x.haupt.bytes, 0)
p('Hauptstraßen zusammen unter 5 MB, jedes Pisten-Netz unter 15 MB', haupt < 5 * 1048576 && Object.values(manifest).every((x) => x.pisten.bytes < 15 * 1048576), `${(haupt / 1048576).toFixed(1)} MB`)
const OSRM = { 'sued-route-sud-1-klassiker': 1176, 'sued-route-sud-2-erweitert-mit-4wd-highlights': 1383, 'sued-route-sud-3-expedition-nullarbor-grenzland': 1342, 'sued-ruckweg-option-goldfields-schleife': 1558, 'nord-route-nord-1-kusten-klassiker-mit-insider-camps': 1663, 'nord-route-nord-2-halbinsel-expedition-empfehlung': 2202, 'nord-route-nord-3-outback-expedition-gascoyne-pilbara': 3567 }
const routen = JSON.parse(lies('public/routen.json'))
let t0 = Date.now()
const wh = leseNetz(fs.readFileSync(new URL('../public/routing/wa-haupt.bin', import.meta.url)))
const ladeH = Date.now() - t0
t0 = Date.now()
const wp = leseNetz(fs.readFileSync(new URL('../public/routing/wa-pisten.bin', import.meta.url)))
const ladeP = Date.now() - t0
const ergebnis = (net2) => routen.map((x) => { const t1 = Date.now(); const e = routeOffline(net2, stoppsAusRoute(x).filter((s2) => s2.lat != null)); return { id: x.id, e, ms: Date.now() - t1, abw: e ? e.km / OSRM[x.id] - 1 : null } })
const H = ergebnis(wh), Pn = ergebnis(wp)
const kurz = (l) => l.map((x) => `${x.id.split('-').slice(0, 3).join('-')} ${x.e ? Math.round(x.abw * 100) + ' %' : 'kein Weg'}`).join(' · ')
p('Hauptstraßen: gefundene Routen höchstens 10 % neben OSRM', H.filter((x) => x.e).every((x) => Math.abs(x.abw) <= 0.1), kurz(H))
p('Hauptstraßen: Süd 1, Süd 2, Rückweg und Nord 1 höchstens 3 % daneben', H.filter((x) => /sud-1|sud-2|ruckweg|nord-1/.test(x.id)).every((x) => x.e && Math.abs(x.abw) <= 0.03), kurz(H))
p('Hauptstraßen: Israelite Bay und Steep Point liegen abseits, dort keine Route (Schätzung greift)', !H.find((x) => /sud-3/.test(x.id)).e && !H.find((x) => /nord-2/.test(x.id)).e)
p('Pisten-Netz: alle 7 Routen-Ideen gefunden, höchstens 12 % neben OSRM', Pn.every((x) => x.e && Math.abs(x.abw) <= 0.12), kurz(Pn))
p('Pisten-Netz zählt die Piste: Nord 2 über Steep Point mit über 100 km Piste', Pn.find((x) => /nord-2/.test(x.id)).e.pisteKm > 100)
p('Schnell: Netz lesen unter 1 s, jede Route unter 0,5 s', ladeH < 1000 && ladeP < 1000 && [...H, ...Pn].every((x) => x.ms < 500), `lesen ${ladeH}/${ladeP} ms, längste Route ${Math.max(...[...H, ...Pn].map((x) => x.ms))} ms`)
const pa = routeOffline(wh, [{ lat: -31.95, lon: 115.86 }, { lat: -33.95, lon: 115.07 }, { lat: -34.31, lon: 115.16 }, { lat: -34.98, lon: 116.73 }, { lat: -35.02, lon: 117.88 }])
p('Testfahrt Perth bis Albany über die Küste: 677 km bei OSRM, offline höchstens 3 % daneben', pa && Math.abs(pa.km / 677 - 1) <= 0.03, pa && `${pa.km} km, ${Math.floor(pa.dauerMin / 60)} h ${pa.dauerMin % 60} min`)

// Fahrzeiten von OSRM (router.project-osrm.org, gemessen am 7.11.) für Strecken auf Asphalt
const OSRM_MIN = { 'sued-route-sud-1-klassiker': 893, 'sued-route-sud-2-erweitert-mit-4wd-highlights': 1086, 'sued-ruckweg-option-goldfields-schleife': 1168, 'nord-route-nord-1-kusten-klassiker-mit-insider-camps': 1189 }
const zeiten = H.filter((x) => OSRM_MIN[x.id]).map((x) => x.e.dauerMin / OSRM_MIN[x.id] - 1)
p('Fahrzeit auf Asphalt wie online: Süd 1, Süd 2, Rückweg, Nord 1 höchstens 5 % neben OSRM', zeiten.length === 4 && zeiten.every((z) => Math.abs(z) <= 0.05), zeiten.map((z) => Math.round(z * 100) + ' %').join(' · '))
p('Perth bis Albany: OSRM 8 h 45 min, offline höchstens 5 % daneben', pa && Math.abs(pa.dauerMin / 525 - 1) <= 0.05, pa && `${pa.dauerMin} min`)
const kurzeFahrt = routeOffline(wh, [{ lat: -31.95, lon: 115.86 }, { lat: -32.05, lon: 115.75 }])
p('Perth bis Fremantle: OSRM 23 km und 24 min, offline genauso (höchstens 2 km, 3 min daneben)', kurzeFahrt && Math.abs(kurzeFahrt.km - 23) <= 2 && Math.abs(kurzeFahrt.dauerMin - 24) <= 3, kurzeFahrt && `${kurzeFahrt.km} km ${kurzeFahrt.dauerMin} min`)

console.log('\nPisten-Aufschlag und 4WD')
const perth = { lat: -31.95, lon: 115.86 }, kununurra = { lat: -15.77, lon: 128.74 }, augustus = { lat: -24.32, lon: 116.90 }, tomPrice = { lat: -22.69, lon: 117.79 }
const pk = routeOffline(wp, [perth, kununurra]), pk4 = routeOffline(wp, [perth, kununurra], { pistenFaktor: 1 })
p('Aufschlag 1,5: Perth bis Kununurra bleibt auf Asphalt wie OSRM (3.189 km), keine Abkürzung über Marble Bar', PISTEN_AUFSCHLAG === 1.5 && pk && pk.pisteKm < 5 && Math.abs(pk.km / 3189 - 1) <= 0.02, pk && `${pk.km} km, ${pk.pisteKm} km Piste`)
p('Mit 4WD (ohne Aufschlag) nimmt es dort die Pisten-Abkürzung', pk4 && pk4.pisteKm > 200 && pk4.km < pk.km, pk4 && `${pk4.km} km, ${pk4.pisteKm} km Piste`)
const at = routeOffline(wp, [augustus, tomPrice])
p('Geplante Pisten-Etappe Mount Augustus bis Tom Price bleibt auch mit Aufschlag (rund 346 km statt OSRM 693 km)', at && at.km < 400 && at.pisteKm > 200, at && `${at.km} km, ${at.pisteKm} km Piste`)
const kurzerSchnitt = (n, a) => routeOffline(wp, stoppsAusRoute(routen.find((x) => x.id.includes(n))).filter((s) => s.lat != null).slice(a, a + 2))
const kr = kurzerSchnitt('nord-3', 4), ka = kurzerSchnitt('nord-3', 5)
p('Nationalparks bleiben erreichbar: Gascoyne Junction bis Kennedy Range, weiter nach Mount Augustus, ohne Luftlinie', kr && ka && kr.anschlussKm <= 2 && ka.anschlussKm <= 2 && ka.km < 300, `${kr?.km} km / ${ka?.km} km`)
p('Vergleich OSRM gegen Pisten-Netz: ein Abschnitt 30 km und 15 % kürzer zählt, kleine Unterschiede nicht', allradBesser({ legs: [{ km: 100 }, { km: 693 }] }, { legs: [{ km: 101 }, { km: 346 }] }) && !allradBesser({ legs: [{ km: 120 }] }, { legs: [{ km: 100 }] }) && !allradBesser({ legs: [{ km: 300 }] }, { legs: [{ km: 265 }] }) && !allradBesser({ legs: [{ km: 693 }] }, { legs: [{ km: 346 }, { km: 1 }] }))
const routenEn = JSON.parse(lies('public/routen.en.json'))
p('4WD-Ideen erkannt: Süd 3, Nord 2, Nord 3 (de und en), die 2WD-Routen nicht', [routen, routenEn].every((l) => l.filter(brauchtAllrad).map((x) => x.id.split('-').slice(1, 3).join('-')).join() === 'route-sud,route-nord,route-nord' && l.filter(brauchtAllrad).length === 3 && brauchtAllrad(l.find((x) => x.id.includes('nord-3')))) && !brauchtAllrad(routen.find((x) => x.id.includes('sud-2'))))
const n3 = stoppsAusRoute(routen.find((x) => x.id.includes('nord-3'))), n3en = stoppsAusRoute(routenEn.find((x) => x.id.includes('nord-3')))
p('Nord 3: 12 Stopps wie die Legende, über Karratha nach Exmouth, ohne die optionale Verlängerung', [n3, n3en].every((s) => s.length === 12 && s.every((x) => x.lat != null) && s.slice(-2).map((x) => x.name).join() === 'Karratha,Exmouth' && !s.some((x) => x.name === 'Marble Bar')))
const linien = JSON.parse(lies('public/routen-strassen.json'))
const n3Linie = linien['nord-route-nord-3-outback-expedition-gascoyne-pilbara']
p('Straßenverlauf Nord 3 auf dem Pisten-Netz: von Mount Augustus die Piste direkt Richtung Tom Price (OSRM fuhr außen herum)', n3Linie && n3Linie.some(([x, y]) => y > -24 && y < -23.5 && x > 117.3 && x < 118.1))

console.log('\nEinbau in die App')
const rd = lies('src/lib/routen-dienst.js'), re = lies('src/lib/RouteEditor.svelte'), ro = lies('src/lib/routing-offline.js'), vc = lies('vite.config.js')
p('Online OSRM, fällt es aus, offline weiter', /try \{ route = await berechneRoute\(r\.stops\) \} catch \(e\) \{ route = await offlineBerechnen\(r\); if \(!route\) throw e \}/.test(rd))
p('Ohne Netz: offline, wenn das Gebiet ein Netz hat', /if \(!gerade\(r\) && !online && !gebietFuer\(r\.stops\)\) continue/.test(rd) && /route = await offlineBerechnen\(r\)\n      if \(!route\) \{ setze\(routeMsg/.test(rd))
p('Wieder online: Offline-Route wird automatisch genau nachgerechnet', /!\(online && r\.route\.offline\)/.test(rd) && /\(online \? 'on' : 'off'\)/.test(rd))
p('Rechnen im Hintergrund (Worker), Netz einmal geladen', /new Worker\(new URL\('\.\/routing-worker\.js', import\.meta\.url\)/.test(ro) && /netze\.set\(url/.test(lies('src/lib/routing-worker.js')))
p('Hauptstraßen-Netze offline vorab gespeichert, Pisten-Netze nicht', /'routing\/\*-haupt\.bin'/.test(vc) && !/pisten\.bin/.test(vc))
p('An der Route: Quelle, Piste-km, Luftlinie zur Straße, Vorschlag Pisten-Netz', /routeQuelleText\(r\.route\)/.test(re) && /km Piste/.test(re) && /km Luftlinie bis zur Straße/.test(rd) && /pistenVorschlag/.test(re))
p('Hinweis aufs Pisten-Netz auch, wenn ohne Netz geänderte Stopps keinen Weg finden', /const ohneWeg = \(!r\.route \|\| veraltet\(r\)\) && !\$online && !\$rechnet\[r\.id\]/.test(re) && (re.match(/\{#if !\$online && pistenVorschlag\}/g) || []).length === 2)
p('4WD-Schalter an Auto-Routen, schaltet über setAllrad und lädt das Pisten-Netz mit', /\{#if artVon\(r\) === 'auto'\}[\s\S]{0,200}onchange=\{\(e\) => setAllrad\(r, e\.currentTarget\.checked\)\}/.test(re) && /export async function setAllrad\(r, an\)[\s\S]{0,400}pistenLaden\(g\)/.test(rd))
p('Online mit 4WD: Pisten-Route statt OSRM, wenn ein Abschnitt deutlich kürzer ist', /if \(r\.allrad && !route\.offline\) \{[\s\S]{0,200}allradBesser\(route, p\)\) route = \{ \.\.\.p, offline: false, allradWahl: true, osrmKm: route\.km \}/.test(rd))
p('4WD wechseln rechnet neu, auch beim Auto-Routing', /allradPasst\(r\) && !\(online && r\.route\.offline\)/.test(rd) && /\(r\.allrad \? '4wd' : ''\)/.test(rd) && /route\.allrad = !!r\.allrad/.test(rd))
p('4WD-Routen-Idee kommt mit eingeschaltetem 4WD in den Plan', /allrad: brauchtAllrad\(r\)/.test(lies('src/lib/Routen.svelte')) && /if \(typ === 'route' && vorlage\.allrad\) r\.allrad = true/.test(lies('src/lib/userdata.js')))
p('Offline mit 4WD ohne Aufschlag, sonst mit', /pistenFaktor: allrad \? 1 : PISTEN_AUFSCHLAG/.test(ro) && /allrad: !!r\.allrad/.test(rd))
p('Ohne Netz kein Weg zu allen Stopps: Hinweis an der Route, warum, und dass die bisherige Route bleibt', /if \(!route\) \{ setze\(routeMsg, r\.id, ohneNetzKeinWeg\(r\)\); return \}/.test(rd) && /function ohneNetzKeinWeg\(r\)/.test(rd) && /Die bisherige Route bleibt/.test(rd))
p('Route berechnen geht offline, wenn das Gebiet ein Netz hat', /disabled=\{\(!\$online && !gebiet\)/.test(re))
p('Pisten-Netz verwalten unter der Offline-Karte', /<PistenNetz \/>/.test(lies('src/lib/Karte.svelte')) && /pistenLaden\(g\)/.test(lies('src/lib/PistenNetz.svelte')) && /pistenEntfernen\(g\)/.test(lies('src/lib/PistenNetz.svelte')))

const pn = lies('src/lib/PistenNetz.svelte'), hilfe = lies('src/lib/hilfe.js')
p('Box Offline-Routen: Vergleich Hauptstraßen und Pisten-Netz als Tabelle mit fünf Zeilen', /class="pn-tab pn-vergleich"/.test(pn) && (pn.match(/^    \[je\('/gm) || []).length >= 9 && /Sperrungen umfahren/.test(pn))
p('Größe und Genauigkeit zum Aufklappen', /<details class="pn-mehr">\s*<summary>\{je\('Größe', 'Size'\)\}/.test(pn) && /<summary>\{je\('Wie genau\?', 'How accurate\?'\)\}/.test(pn) && !/<details class="pn-mehr" open/.test(pn))
p('Sperrungen hinter dem kleinen ⓘ oben, Fenster wie alle anderen (InfoKnopf, hilfe.js)', /<InfoKnopf id="sperrungen" \/>/.test(pn) && /sperrungen: \{\s*titel: je\('Straßensperrungen umfahren'/.test(hilfe) && /Floodway/.test(hilfe) && !/class="pn-sperr/.test(pn))
p('Box Offline-Routen klappt auf und zu wie die anderen (runder Pfeil), anfangs zu, das ⓘ bleibt außerhalb des Knopfs', /<button class="pn-auf" aria-expanded=\{offen\} onclick=\{umschalten\}>\s*<span class="aufklapp klein" class:offen/.test(pn) && /\{#if offen\}<div class="pn-innen" transition:klapp/.test(pn) && /localStorage\.getItem\(OFFEN_KEY\) === '1'/.test(pn) && /<\/button>\s*<InfoKnopf id="sperrungen" \/>/.test(pn))
p('Größe aus netze.json, nicht fest im Text', /info\[g\]\?\.haupt\?\.bytes/.test(pn) && /hauptZusammen/.test(pn))

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
