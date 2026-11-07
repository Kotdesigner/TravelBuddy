// Wanderungen ordnen sich der Route zu, die nah vorbeiführt. Selbst Gewähltes bleibt, wie es ist.
import fs from 'node:fs'
import { NAH_KM, abstandZur, naechsteReise, autoZuordnung, autoErlaubt, zuordenbar, punkteVon } from '../src/lib/wander-zuordnung.js'
import { WANDER_VORSCHLAEGE } from '../src/lib/wander-vorschlaege.js'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')

// Ausgedachte Route Albany → Esperance mit Stopps, eine Strecke im Norden, eine Idee und ein Flug
const sued = { id: 'r-sued', typ: 'route', name: 'Südküste', stops: [
  { name: 'Albany', lat: -35.02, lon: 117.88 }, { name: 'Stirling Range', lat: -34.42, lon: 118.2 },
  { name: 'Hopetoun', lat: -33.95, lon: 120.12 }, { name: 'Esperance', lat: -33.86, lon: 121.89 }] }
const nord = { id: 'r-nord', typ: 'route', name: 'Exmouth', stops: [{ name: 'Coral Bay', lat: -23.14, lon: 113.77 }, { name: 'Exmouth', lat: -21.93, lon: 114.13 }],
  route: { geometry: [[113.77, -23.14], [113.9, -22.6], [114.13, -21.93]] } }
const idee = { id: 'r-idee', typ: 'route', idee: true, name: 'Idee', stops: [{ name: 'X', lat: -34.4, lon: 118.25 }] }
const flug = { id: 'r-flug', typ: 'route', art: 'flug', name: 'Flug', stops: [{ name: 'Perth', lat: -31.95, lon: 115.86 }, { name: 'Albany', lat: -35.02, lon: 117.88 }] }
const etappe = { id: 'e-1', typ: 'etappe', name: 'Süden', stops: [{ name: 'Perth', lat: -31.95, lon: 115.86 }] }
const reisen = [sued, nord, idee, flug, etappe]
const V = Object.fromEntries(WANDER_VORSCHLAEGE.map((v) => [v.id, v]))

console.log('\nAbstand und nächste Route')
p('Punkte: Strecke, sonst Stopps', punkteVon(nord).length === 3 && punkteVon(sued).length === 4 && punkteVon({}).length === 0)
p('Ideen, Flüge und leere Reisen zählen nicht', !zuordenbar(idee) && !zuordenbar(flug) && !zuordenbar({ id: 'x' }) && zuordenbar(sued))
const a = abstandZur(V['bluff-knoll'], sued)
p('Bluff Knoll liegt nah an der Südküste, nächster Stopp Stirling Range', a && a.km < 10 && a.stopp === 'Stirling Range', JSON.stringify(a))
p('Weit weg: kein Treffer', abstandZur(V['dales-gorge'], sued) === null && naechsteReise(V['dales-gorge'], reisen) === null)
p('Mandu Mandu passt zur Route Exmouth', naechsteReise(V['mandu-mandu'], reisen)?.reise.id === 'r-nord')
p('Grenze ' + NAH_KM + ' km wird eingehalten', naechsteReise(V['peak-charles'], reisen) === null && naechsteReise(V['peak-charles'], reisen, 500)?.reise.id === 'r-sued')

console.log('\nAutomatische Zuordnung')
const w = (id, extra = {}) => ({ id, name: id, lat: V[id].lat, lon: V[id].lon, reiseId: null, reiseAuto: null, ...extra })
const liste = [
  w('bluff-knoll'),                                         // neu: wird zugeordnet
  w('frenchman-peak', { reiseId: 'e-1', reiseAuto: false }), // selbst gewählt: bleibt
  w('east-mount-barren', { reiseAuto: false }),             // ausdrücklich „keine Angabe“: bleibt leer
  w('dales-gorge'),                                         // weit weg: nichts
  w('mandu-mandu', { reiseId: 'r-sued', reiseAuto: true }), // falsch automatisch: wird umgehängt
  w('castle-rock-skywalk', { reiseId: 'r-nord', reiseAuto: true }), // passt nicht mehr: Südküste
  { id: 'ohne', name: 'Ohne Punkt', lat: null, lon: null },
]
const aend = Object.fromEntries(autoZuordnung(liste, reisen).map((x) => [x.id, x.patch]))
p('Neue Wanderung bekommt die nahe Route', aend['bluff-knoll']?.reiseId === 'r-sued' && aend['bluff-knoll']?.reiseAuto === true)
p('Selbst gewählte Route bleibt', !aend['frenchman-peak'])
p('„Keine Angabe“ bleibt leer', !aend['east-mount-barren'] && !autoErlaubt(liste[2]))
p('Weit weg: keine Änderung', !aend['dales-gorge'])
p('Automatisch, aber falsch: wird umgehängt', aend['mandu-mandu']?.reiseId === 'r-nord' && aend['castle-rock-skywalk']?.reiseId === 'r-sued')
p('Ohne Startpunkt: nichts', !aend['ohne'])
const route2 = autoZuordnung([w('bluff-knoll', { reiseId: 'r-sued', reiseAuto: true })], [nord])
p('Route gelöscht oder verlegt: automatische Zuordnung fällt weg', route2.length === 1 && route2[0].patch.reiseId === null)
p('Schon richtig: keine Änderung, also keine Schleife', autoZuordnung([w('bluff-knoll', { reiseId: 'r-sued', reiseAuto: true })], reisen).length === 0)

console.log('\nEinbau')
const app = lies('src/App.svelte'), ud = lies('src/lib/userdata.js'), wa = lies('src/lib/Wanderungen.svelte')
p('Läuft im Hintergrund, sobald die Daten geladen sind', /if \(laden\) return; return starteWanderZuordnung\(\)/.test(app))
p('Neue Wanderungen haben reiseAuto', /reiseAuto: vorlage\.reiseAuto \?\? null/.test(ud))
p('Route selbst wählen setzt reiseAuto false', /reiseId: e\.target\.value \|\| null, reiseAuto: false/.test(wa))
p('Karte der Wanderung zeigt, wenn von selbst zugeordnet', /w\.reiseAuto && w\.reiseId/.test(wa))

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
