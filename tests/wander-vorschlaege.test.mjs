// Wanderungs-Vorschläge entlang der Route: Daten stimmig, mit Orten verknüpft, ein Tipp übernimmt
import fs from 'node:fs'
import { WANDER_VORSCHLAEGE, GEGENDEN, alsWanderung, schonDa, sommerText } from '../src/lib/wander-vorschlaege.js'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const lies = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const orte = JSON.parse(lies('public/orte.json'))
const ortMap = new Map(orte.map((o) => [o.id, o]))
const V = WANDER_VORSCHLAEGE

console.log('\nWanderungs-Vorschläge')
p('Gut 20 Vorschläge in fünf Gegenden, jede belegt', V.length >= 20 && GEGENDEN.length === 5 && GEGENDEN.every((g) => V.some((v) => v.gegend === g.id)) && V.every((v) => GEGENDEN.some((g) => g.id === v.gegend)))
p('Gegenden von Süd nach Nord', GEGENDEN.map((g) => g.id).join() === 'sw,sk,es,mw,nw' && V.find((v) => v.id === 'bluff-knoll').gegend === 'sk' && V.find((v) => v.id === 'dales-gorge').gegend === 'nw')
p('Kennungen eindeutig', new Set(V.map((v) => v.id)).size === V.length)
const schlecht = V.filter((v) => !v.name || !v.gebiet || !v.beschreibung || !v.besteZeit || !(v.dauerMin > 0) || !(v.wasser > 0))
p('Jeder hat Name, Gebiet, Beschreibung, beste Zeit, Dauer und Wasser', !schlecht.length, schlecht.map((v) => v.id).join(', '))
p('Schwierigkeit, Wegart und Sommerhinweis aus den bekannten Werten', V.every((v) => ['leicht', 'mittel', 'schwer', 'sehr-schwer'].includes(v.schwierigkeit) && ['rundweg', 'hin-zurueck', 'strecke'].includes(v.art) && [undefined, 'zu', 'oft-zu', 'frueh'].includes(v.sommer)))
p('Alle in Western Australia', V.every((v) => v.lat < -13 && v.lat > -36 && v.lon > 112 && v.lon < 129))
const ohneOrt = V.filter((v) => v.ortId && !ortMap.has(v.ortId))
p('Verknüpfte Orte gibt es in orte.json', !ohneOrt.length, ohneOrt.map((v) => v.ortId).join(', '))
const km = (a, b) => { const r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lon - a.lon) * r; const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)) }
const weit = V.filter((v) => v.ortId && km(v, ortMap.get(v.ortId)) > 2)
p('Startpunkt passt zum verknüpften Ort', !weit.length, weit.map((v) => v.id).join(', '))
p('Sommer-Sperren drin: Mount Augustus und Z Bend zu, The Loop nur früh', V.find((v) => v.id === 'mount-augustus')?.sommer === 'zu' && V.find((v) => v.id === 'kalbarri-z-bend')?.sommer === 'zu' && V.find((v) => v.id === 'kalbarri-loop')?.sommer === 'frueh')
p('Keine Gedankenstriche in Sätzen', V.every((v) => !/ [–—] /.test(v.beschreibung + v.besteZeit + v.name)))
p('Keine Reisedaten', !/202[67]/.test(lies('src/lib/wander-vorschlaege.js')))

console.log('\nÜbernehmen')
const w = alsWanderung(V.find((v) => v.id === 'mount-augustus'))
p('Vorlage mit Zahlen, Startpunkt und Status Wunschliste', w.status === 'wunsch' && w.km === 12 && w.lat != null && w.ortId === 'mount_augustus_burringurrah' && w.vorschlagId === 'mount-augustus')
p('Sommerhinweis landet in der Beschreibung', w.beschreibung.endsWith(sommerText('zu')) && sommerText(undefined) === '')
p('Schon da: über die Kennung oder den Namen', schonDa(V[0], [{ vorschlagId: V[0].id, name: 'umbenannt' }]) && schonDa(V[1], [{ name: '  ' + V[1].name.toUpperCase() }]) && !schonDa(V[2], [{ name: 'anders' }, null]))
const ud = lies('src/lib/userdata.js')
p('neueWanderung merkt sich vorschlagId', /vorschlagId: vorlage\.vorschlagId \|\| null/.test(ud))
const seite = lies('src/lib/Wanderungen.svelte'), ideen = lies('src/lib/WanderIdeen.svelte')
p('Wanderungen: Wander-Ideen zugeklappt, mit eigener Ansicht', /<details class="vorschlaege">/.test(seite) && /<WanderIdeen \{reisen\} \{onkarte\} onoeffne=\{zeigeKarte\} \/>/.test(seite))
p('Gemeinsame Karte mit Routen und Punkten, zoomt bei Gedränge', /<UebersichtsKarte \{punkte\} \{linien\} gewaehlt=\{auswahl\} onpunkt=\{zeige\}/.test(ideen) && /zoomBeiEnge/.test(ideen) && /rot: v\.sommer === 'zu', ring: !!inListe\(v\)/.test(ideen))
p('Gegend-Knöpfe filtern Karte und Liste', /gegend === 'alle' \? WANDER_VORSCHLAEGE : WANDER_VORSCHLAEGE\.filter\(\(v\) => v\.gegend === gegend\)/.test(ideen) && /aria-pressed=\{gegend === g\.id\}/.test(ideen))
p('Punkt und Zeile öffnen das Fenster', /onpunkt=\{zeige\}/.test(ideen) && /onclick=\{\(\) => zeige\(v\.id\)\}/.test(ideen) && /role="dialog" aria-labelledby="wi-pop-titel"/.test(ideen))
p('Fenster: vormerken, Etappe oder Route wählen, große Karte, Schließen mit Esc', /vormerken\(offen\)/.test(ideen) && /zuordnen\(offen, e\.target\.value\)/.test(ideen) && /optgroup label=\{je\('Etappen'/.test(ideen) && /onkarte\(offen\)/.test(ideen) && /e\.key === 'Escape'/.test(ideen))
p('Tipp daneben schließt das Fenster', /<svelte:window onkeydown=\{taste\} onclick=\{daneben\} \/>/.test(ideen) && /closest\?\.\('\.wi-pop, \.uk-punkt, \.wi-zeile'\)/.test(ideen))
p('Selbst gewählt: reiseAuto false, Status geplant', /reiseId, reiseAuto: false, status: 'geplant'/.test(ideen))
const app = lies('src/App.svelte'), karte = lies('src/lib/Karte.svelte')
p('Große Karte springt zur Wanderung', /onkarte=\{\(v\) => geh\('plan\/karte\/wanderung\/' \+ v\.id\)\}/.test(app) && /punktFokus=\{ansicht\.id\?\.startsWith\('wanderung\/'\)/.test(app) && /function zeigePunktFokus\(\)/.test(karte) && /!warnFokus && !punktFokus/.test(karte))
const et = lies('src/lib/EtappeDetail.svelte')
p('Etappe zeigt Wander-Ideen in der Nähe zum Vormerken', /const ideenNah = \$derived/.test(et) && /naechsteReise\(v, kand\)/.test(et) && /ideeMerken\(v, n\.reise\.id\)/.test(et))

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
