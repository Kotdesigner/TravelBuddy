// Prüfung der Tour-Funktionen (V28): Kilometer ohne Doppelzählung (Etappe und ihre Routen),
// Wetter an der Strecke mit Ausweichdienst MET Norway, wenn Open-Meteo ausfällt (ohne echtes Netz).
import { ohneDoppelteStrecken } from '../src/lib/plan.js'
import { metTage } from '../src/lib/wetter-ausweich.js'
import { holeGefahren } from '../src/lib/gefahren.js'
import fs from 'node:fs'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }

console.log('\nKilometer ohne Doppelzählung')
const etappe = { id: 'e', typ: 'etappe', stops: [{}, {}], route: { km: 417 } }
const route = { id: 'r', typ: 'route', etappeId: 'e', route: { km: 677 } }
const ids = (l) => ohneDoppelteStrecken(l).map((r) => r.id).join()
p('Etappe mit Routen über dieselbe Strecke: nur die Routen zählen', ids([etappe, route]) === 'r')
p('Etappe ohne Routen zählt selbst', ids([etappe]) === 'e')
p('Anreise per Flug zählt weiter neben den Routen', ids([{ ...etappe, art: 'flug' }, route]) === 'e,r')
p('Routen decken nur einen kleinen Teil ab (unter 80 %): Etappe zählt weiter', ids([{ ...etappe, route: { km: 2000 } }, route]) === 'e,r')
p('Ideen zählen nie', ids([etappe, { ...route, idee: true }]) === 'e')
p('Startseite, Bilanz und Reisefilm nutzen es', ['src/App.svelte', 'src/lib/reise-bilanz.js', 'src/lib/reisefilm.js'].every((f) => /ohneDoppelteStrecken\(/.test(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'))))

console.log('\nWetter an der Strecke: Ausweichen auf MET Norway')
// Kleine MET-Antwort: zwei Tage in Perth-Zeit, mit Gewitter und Böen
const zeile = (iso, temp, boe, regen, symbol, sechs = false) => ({ time: iso, data: { instant: { details: { air_temperature: temp, wind_speed: 5, wind_speed_of_gust: boe } }, [sechs ? 'next_6_hours' : 'next_1_hours']: { summary: { symbol_code: symbol }, details: { precipitation_amount: regen } } } })
const met = { properties: { timeseries: [
  zeile('2031-01-10T00:00:00Z', 30, 10, 0, 'clearsky_day'), zeile('2031-01-10T06:00:00Z', 41, 20, 2, 'rainshowersandthunder_day'),
  zeile('2031-01-10T15:00:00Z', 25, 5, 0, 'clearsky_night'),   // 23 Uhr Perth, noch derselbe Tag
  zeile('2031-01-10T18:00:00Z', 22, 5, 12, 'heavyrain', true),  // 2 Uhr am nächsten Tag in Perth
] } }
const d = metTage(met, 'Australia/Perth', 3).daily
p('Tage nach Ortszeit getrennt', d.time.join() === '2031-01-10,2031-01-11', d.time.join())
p('Höchsttemperatur, Regen, Böen in km/h, Gewitter als WMO 95', d.temperature_2m_max[0] === 41 && d.precipitation_sum[0] === 2 && d.wind_gusts_10m_max[0] === 72 && d.weather_code[0] === 95)
p('6-Stunden-Zeilen zählen ihren Regen', d.precipitation_sum[1] === 12 && d.weather_code[1] === 65)

const aufrufe = []
const fakeFetch = async (url) => {
  aufrufe.push(String(url))
  if (String(url).includes('open-meteo')) return { ok: false, status: 429, json: async () => ({}) }
  return { ok: true, json: async () => met }
}
const res = await holeGefahren([{ id: 'a', lat: -31.95, lon: 115.86 }, { id: 'b', lat: -33.95, lon: 115.07 }], { f: fakeFetch })
p('Open-Meteo am Limit (429): MET für jeden Punkt gefragt', aufrufe.filter((u) => u.includes('open-meteo')).length === 1 && aufrufe.filter((u) => u.includes('api.met.no')).length === 2)
p('Gefahren kommen trotzdem: Hitze und Gewitter', res.get('a').gefahren.some((g) => g.typ === 'Hitze') && res.get('b').gefahren.some((g) => g.typ === 'Gewitter'))
const nix = async () => { throw new TypeError('offline') }
let meldung = ''
try { await holeGefahren([{ id: 'a', lat: -31.95, lon: 115.86 }], { f: nix }) } catch (e) { meldung = e.message }
p('Beide Dienste weg: klare Meldung statt Absturz', /Wetterdienst nicht erreichbar|Weather service/.test(meldung), meldung)

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
