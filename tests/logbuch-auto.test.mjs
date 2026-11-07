// Logbuch automatisch ausfüllen: km, Wetter, gefühlte Hitze, Sternenhimmel, Verkehrsmittel. Dienste nur nachgebaut.
import fs from 'node:fs'
import {
  ermittle, wendeAn, istAuto, istSchaetzung, darfSetzen, punkteVon, schaetzKm, verkehrsmittelFuer, buchungenAm,
  wetterAdresse, fasseZusammen, wetterText, gefuehltText, sterneText, holeTageswetter, bericht,
} from '../src/lib/logbuch-auto.js'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const lies = (f) => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')

// Beispielorte (keine Reisedaten): eine Runde Stadt → Berg → Stadt
const STADT = { name: 'Stadt', lat: -37.81, lon: 144.96 }
const BERG = { name: 'Berg', lat: -37.52, lon: 145.21 }
const eintrag = (x = {}) => ({ id: 'e1', datum: '2037-11-05', ort: STADT.name, lat: STADT.lat, lon: STADT.lon, ziele: [BERG, STADT], felder: {}, ...x })
const tag = (code, max, min, mehr = {}) => ({ daily: { weather_code: [code], temperature_2m_max: [max], temperature_2m_min: [min], apparent_temperature_max: [max + 2], precipitation_sum: [0], wind_speed_10m_max: [18.4], relative_humidity_2m_mean: [40], cloud_cover_mean: [10], uv_index_max: [8.6], ...mehr } })
const antwort = (j, ok = true) => async () => ({ ok, status: ok ? 200 : 429, json: async () => j })
let routeAufrufe = 0
const route = async (pk) => { routeAufrufe++; return { km: 124 } }
const ohneRoute = async () => { throw new Error('weg') }
const ctx = (x = {}) => ({ online: true, heute: '2037-11-07', route, wetter: antwort([tag(1, 24, 12), tag(3, 21, 10)]), ...x })

console.log('\n1  Strecke und Kilometer')
p('Punkte: Ort plus Ziele mit Koordinaten', punkteVon(eintrag()).length === 3 && punkteVon(eintrag({ ziele: [{ name: 'ohne' }] })).length === 1)
p('Schätzung aus der Luftlinie mal 1,25', schaetzKm([STADT, BERG]) > 45 && schaetzKm([STADT, BERG]) < 60)
let erg = await ermittle(eintrag(), ctx())
p('Mit Netz: Straßenkilometer der Route', erg.werte.distance_km?.w === 124 && !erg.werte.distance_km.ca)
let erg2 = await ermittle(eintrag(), ctx({ online: false }))
p('Ohne Netz: geschätzt, als „ca.“ markiert', erg2.werte.distance_km?.ca === true && erg2.werte.distance_km.w > 90)
const geschaetzt = { ...eintrag(), ...wendeAn(eintrag(), erg2) }
p('Schätzung wird später durch die Route ersetzt', istSchaetzung(geschaetzt, 'distance_km') && (await ermittle(geschaetzt, ctx())).werte.distance_km?.w === 124)
const mitRoute = { ...eintrag(), ...wendeAn(eintrag(), erg) }
routeAufrufe = 0
await ermittle(mitRoute, ctx())
p('Gleiche Strecke: keine neue Routenabfrage', routeAufrufe === 0)
const geaendert = { ...mitRoute, ziele: [BERG] }
p('Strecke geändert: neu gerechnet', (await ermittle(geaendert, ctx())).werte.distance_km?.w === 124 && routeAufrufe === 1)
p('Routendienst weg: Schätzung', (await ermittle(eintrag(), ctx({ route: ohneRoute }))).werte.distance_km?.ca === true)
p('Gewählte Strecke ohne eigene Ziele: km der Strecke', (await ermittle(eintrag({ ziele: [] }), ctx({ strecke: { km: 77, sig: 'strecke|r1|' } }))).werte.distance_km?.w === 77)

console.log('\n2  Eigene Werte bleiben')
const eigen = eintrag({ felder: { distance_km: '130', temp_celsius: 'heiß!' } })
const e3 = await ermittle(eigen, ctx())
p('Eigene km und eigenes Wetter werden nicht überschrieben', !e3.werte.distance_km && !e3.werte.temp_celsius)
const nachEdit = { ...mitRoute, felder: { ...mitRoute.felder, distance_km: '140' } }
p('Nach eigener Änderung gehört das Feld dir', !istAuto(nachEdit, 'distance_km') && !darfSetzen(nachEdit, 'distance_km'))
const patch = wendeAn(nachEdit, { werte: { distance_km: { w: 124 } }, stand: nachEdit.autoStand })
p('Vermerk wird aufgeräumt, Wert bleibt', patch && patch.felder.distance_km === '140' && !patch.autoFelder.distance_km)
const getippt = { ...eintrag(), felder: { temp_celsius: 'gerade getippt' } }
p('Während der Abfrage getippt: bleibt', wendeAn(getippt, erg).felder.temp_celsius === 'gerade getippt')
p('Nichts Neues: kein Speichern', wendeAn(mitRoute, { werte: {}, stand: mitRoute.autoStand }) === null)

console.log('\n3  Wetter')
p('Zusammenfassung über die Strecke: wärmster Höchst-, kühlster Tiefstwert, schlechteres Wetter',
  (() => { const w = fasseZusammen([tag(1, 24, 12), tag(3, 21, 10)]); return w.max === 24 && w.min === 10 && w.code === 3 && w.uv === 9 })())
p('Text Wetter', /^☁️ 24 \/ 10 °C · .+ · Wind bis 18 km\/h$/.test(wetterText(fasseZusammen([tag(1, 24, 12), tag(3, 21, 10)]))), wetterText(fasseZusammen([tag(1, 24, 12), tag(3, 21, 10)])))
p('Regen ab 0,5 mm genannt', /2,4 mm Regen/.test(wetterText(fasseZusammen(tag(61, 18, 9, { precipitation_sum: [2.4] })))))
p('Gefühlt, UV, Luftfeuchte', gefuehltText(fasseZusammen(tag(0, 30, 15))) === 'Gefühlt bis 32 °C · UV 9 · Luftfeuchte 40 %')
p('Gleicher Ort nur einmal abgefragt', (await (async () => { let url = ''; await ermittle(eintrag(), ctx({ wetter: async (u) => { url = u; return { ok: true, json: async () => [tag(1, 1, 1), tag(1, 1, 1)] } } })); return url.split('latitude=')[1].split('&')[0].split(',').length === 2 })()))
p('Bis 90 Tage zurück: Vorhersage-Schnittstelle mit UV', /api\.open-meteo\.com\/v1\/forecast.*uv_index_max.*start_date=2037-11-05&end_date=2037-11-05/.test(wetterAdresse([STADT], '2037-11-05', '2037-11-05', '2037-11-07')))
p('Älter: Archiv', /archive-api\.open-meteo\.com/.test(wetterAdresse([STADT], '2037-05-01', '2037-05-01', '2037-11-07')))
p('Für die Zukunft kein Wetter', !(await ermittle(eintrag({ datum: '2037-11-09' }), ctx())).werte.temp_celsius)
const mitWetter = { ...mitRoute }
let alt = 0
await ermittle(mitWetter, ctx({ jetzt: Date.now() + 30 * 86400e3, wetter: async () => { alt++; return { ok: true, json: async () => tag(1, 1, 1) } } }))
p('Vergangener Tag: Wetter gilt als fertig, keine neue Abfrage', mitWetter.autoStand.wetterFinal === true && alt === 0)
const heuteE = eintrag({ datum: '2037-11-07' })
const h1 = await ermittle(heuteE, ctx({ jetzt: 1000 }))
const heuteMit = { ...heuteE, ...wendeAn(heuteE, h1) }
let gefragt = 0
const zaehl = async () => { gefragt++; return { ok: true, json: async () => tag(2, 26, 14) } }
await ermittle(heuteMit, ctx({ jetzt: 1000 + 3600e3, wetter: zaehl }))
await ermittle(heuteMit, ctx({ jetzt: 1000 + 4 * 3600e3, wetter: zaehl }))
p('Heute: höchstens alle drei Stunden neu', h1.stand.wetterFinal === false && gefragt === 1)
const met = async () => ({ current: { weather_code: 0, wind_speed_10m: 12, relative_humidity_2m: 30, cloud_cover: 5 }, daily: { temperature_2m_max: [27], temperature_2m_min: [13] } })
p('Open-Meteo am Limit, heute: MET Norway springt ein', (await holeTageswetter([STADT], '2037-11-07', '2037-11-07', '2037-11-07', { f: antwort({ error: true, reason: 'limit' }), met })).werte.max === 27)
p('Open-Meteo am Limit, vor einer Woche: Archiv', await (async () => { const urls = []; const r = await holeTageswetter([STADT], '2037-10-31', '2037-10-31', '2037-11-07', { f: async (u) => { urls.push(u); return u.includes('archive') ? { ok: true, json: async () => tag(1, 20, 8) } : { ok: false, status: 429, json: async () => ({}) } }, met }); return r.werte.max === 20 && urls.length === 2 })())
p('Ohne Netz: kein Wetter, kein Fehler', !(await ermittle(eintrag(), ctx({ online: false }))).werte.temp_celsius)

let rueck = 0
const hin = eintrag({ ziele: [BERG] })
const hinMit = { ...hin, ...wendeAn(hin, await ermittle(hin, ctx())) }
await ermittle({ ...hinMit, ziele: [BERG, STADT] }, ctx({ wetter: async () => { rueck++; return { ok: true, json: async () => [tag(1, 1, 1), tag(1, 1, 1)] } } }))
p('Rückfahrt zum Start: Wetter nicht neu abgefragt', rueck === 0)

console.log('\n4  Sternenhimmel und Verkehrsmittel')
p('Sternenhimmel mit Mond und Wolken', /Mond \d+ % .*Wolken 10 %/.test(erg.werte.night_sky?.w || ''), erg.werte.night_sky?.w)
p('Sternenhimmel auch ohne Netz (Mond)', /Mond \d+ %/.test(erg2.werte.night_sky?.w || '') && !/Wolken/.test(erg2.werte.night_sky.w))
p('Text Sternenhimmel', /^(🌟|⭐|✨|🌙) /.test(sterneText(STADT, '2037-11-05')))
p('Strecke mit dem Auto', erg.werte.verkehrsmittel?.w.join() === '🚗 Auto')
p('Etappe mit Flug und Fährbuchung', verkehrsmittelFuer({ art: 'flug', buchungen: [{ kat: 'faehre' }] }).join() === '✈️ Flug,⛴️ Fähre')
p('Unbekanntes bleibt leer', verkehrsmittelFuer({ buchungen: [{ kat: 'tour' }] }).length === 0)
p('Buchungen nach Tagen', buchungenAm([{ datum: '2037-11-05', kat: 'car' }, { datum: '2037-11-06', kat: 'flight' }], ['2037-11-05']).length === 1)
p('Bericht', bericht(erg.werte) === 'km, Wetter, Sternenhimmel, Verkehrsmittel' && bericht(erg2.werte).startsWith('km geschätzt'))

console.log('\n5  Eingebaut')
const je = lies('lib/JournalEintrag.svelte')
p('Läuft beim Aufklappen, mit Pause', /if \(!aufgeklappt\) return/.test(je) && /setTimeout\(\(\) => untrack\(\(\) => autoFuellen\(false\)\), 1200\)/.test(je))
p('Knopf zum Nachholen', /onclick=\{\(\) => autoFuellen\(true\)\}/.test(je))
p('Zeichen am automatisch gefüllten Feld', /istAuto\(eintrag, f\.id\)/.test(je) && /class="f-auto"/.test(je))
p('Schreibt auf den frischen Stand des Eintrags', /const frisch = get\(journal\)\.find/.test(je) && /wendeAn\(frisch, erg\)/.test(je))
p('Nur bekannte Felder', /if \(!AUTO_FELDER\.includes\(fid\)/.test(lies('lib/logbuch-auto.js')))

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
