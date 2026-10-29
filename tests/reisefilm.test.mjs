// Reise-Film: Zeitplan, Fotos je Etappe, Kamera, Easing, Videoformat.
// Ausführen: node tests/reisefilm.test.mjs
import {
  zeitplan, szeneBei, fotosDerEtappe, gesamtBilanz, kameraFlug, winkel, teilLinie, teilLinien,
  sanft, ausklang, blende, kenBurns, deckend, waehleFormat, endung, filmDaten, MIN_S, MAX_S,
} from '../src/lib/reisefilm.js'
import { globusProjektion } from '../src/lib/globus.js'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}
const nah = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps
const foto = (n) => 'data:image/jpeg;base64,' + n

console.log('\n1  Easing')
p('sanft: 0 → 0, 1 → 1, Mitte 0,5', sanft(0) === 0 && sanft(1) === 1 && nah(sanft(0.5), 0.5))
p('sanft klemmt außerhalb 0..1', sanft(-1) === 0 && sanft(2) === 1)
p('sanft steigt monoton', [0.1, 0.2, 0.4, 0.6, 0.8, 0.9].every((t, i, a) => i === 0 || sanft(t) > sanft(a[i - 1])))
p('ausklang schneller am Anfang', ausklang(0.3) > 0.3 && ausklang(1) === 1)
p('blende: Anfang 0, Mitte 1, Ende 0', blende(0, 3) === 0 && blende(1.5, 3) === 1 && blende(3, 3) === 0)

console.log('\n2  Fotos je Etappe')
const J = [
  { id: 'a', datum: '2037-12-01', ort: 'Perth', fotos: [foto('a0'), foto('a1')] },
  { id: 'b', datum: '2037-12-02', ort: 'Fremantle', fotos: [foto('b0')] },
  { id: 'c', datum: '2037-12-03', ort: 'Lancelin', fotos: [] },
  { id: 'd', datum: '2037-12-04', ort: 'Cervantes', fotos: [foto('d0')] },
  { id: 'e', datum: '2037-12-05', ort: 'Jurien', fotos: [foto('e0')] },
  { id: 'f', datum: '2037-12-09', ort: 'Kalbarri', fotos: [foto('f0')] },   // außerhalb
]
const ET = { von: '2037-12-01', bis: '2037-12-05' }
{
  const f = fotosDerEtappe(J, ET, 3)
  p('höchstens 3 Fotos', f.length === 3)
  p('nur aus dem Zeitraum', f.every((x) => x.datum >= ET.von && x.datum <= ET.bis))
  p('von verschiedenen Tagen', new Set(f.map((x) => x.datum)).size === 3)
  p('erstes und letztes Foto des Zeitraums dabei', f[0].datum === '2037-12-01' && f[2].datum === '2037-12-05', f.map((x) => x.datum).join())
  p('Ort und Datum mitgegeben', f[0].ort === 'Perth' && f[0].id === 'a:0')
  p('nach Datum sortiert', f.every((x, i) => i === 0 || x.datum >= f[i - 1].datum))
}
{
  const f = fotosDerEtappe(J, { von: '2037-12-01', bis: '2037-12-02' }, 3)
  p('wenige Tage: zweites Foto eines Tages nachgeholt', f.length === 3 && f.some((x) => x.id === 'a:1'))
}
p('Etappe ohne Fotos: leer', fotosDerEtappe(J, { von: '2037-12-03', bis: '2037-12-03' }).length === 0)
p('max 0: leer', fotosDerEtappe(J, ET, 0).length === 0)
p('kaputte Einträge stören nicht', fotosDerEtappe([null, { datum: '2037-12-01' }, ...J], ET, 1).length === 1)

console.log('\n3  Zeitplan')
const etappe = (i, nFotos) => ({ id: 'e' + i, name: 'Etappe ' + i, fotos: Array.from({ length: nFotos }, (_, k) => ({ src: foto(i + '_' + k) })) })
{
  const zp = zeitplan([etappe(1, 3), etappe(2, 2), etappe(3, 3)])
  p('3 Etappen: zwischen 30 und 60 s', zp.gesamt >= MIN_S - 1e-9 && zp.gesamt <= MAX_S + 1e-9, zp.gesamt.toFixed(1))
  p('beginnt mit Titel, endet mit Bilanz', zp.szenen[0].typ === 'titel' && zp.szenen.at(-1).typ === 'bilanz')
  p('je Etappe Flug vor Route', zp.szenen.filter((s) => s.nr === 0).map((s) => s.typ).slice(0, 2).join() === 'flug,route')
  p('Szenen lückenlos', zp.szenen.every((s, i) => i === 0 ? s.start === 0 : nah(s.start, zp.szenen[i - 1].start + zp.szenen[i - 1].dauer)))
  p('Fotos im Plan', zp.szenen.filter((s) => s.typ === 'foto').length === 8)
}
{
  const zp = zeitplan(Array.from({ length: 14 }, (_, i) => etappe(i, 3)))
  p('14 Etappen: höchstens 60 s', zp.gesamt <= MAX_S + 1e-9, zp.gesamt.toFixed(1))
  p('14 Etappen: weniger Fotos je Etappe', zp.fotosJeEtappe < 3, String(zp.fotosJeEtappe))
  p('alle Etappen bleiben drin', new Set(zp.szenen.filter((s) => s.typ === 'route').map((s) => s.nr)).size === 14)
}
{
  const zp = zeitplan(Array.from({ length: 11 }, (_, i) => etappe(i, 3)))
  p('11 Etappen: Fotos bleiben (mindestens eines je Etappe)', zp.fotosJeEtappe >= 1 && zp.gesamt <= MAX_S + 1e-9, `${zp.fotosJeEtappe} / ${zp.gesamt.toFixed(1)}`)
  const z4 = zeitplan(Array.from({ length: 4 }, (_, i) => etappe(i, 3)))
  p('4 Etappen: lieber schneller als ohne Fotos', z4.fotosJeEtappe >= 2, String(z4.fotosJeEtappe))
}
{
  const kurz = zeitplan([{ ...etappe(1, 0), flugGewicht: 0.5 }, { ...etappe(2, 0), flugGewicht: 1 }], { min: 0 })
  const f = kurz.szenen.filter((s) => s.typ === 'flug')
  p('kurzer Weg: kürzerer Flug', f[0].dauer < f[1].dauer)
}
{
  const zp = zeitplan([etappe(1, 0)])
  p('1 Etappe ohne Fotos: trotzdem 30 s', nah(zp.gesamt, MIN_S, 1e-6), zp.gesamt.toFixed(2))
}
{
  const zp = zeitplan([])
  p('ohne Etappen: Titel und Bilanz, 30 s', zp.szenen.length === 2 && nah(zp.gesamt, MIN_S, 1e-6))
}
{
  const zp = zeitplan([etappe(1, 2), etappe(2, 1)])
  const a = szeneBei(zp, 0), b = szeneBei(zp, zp.szenen[1].start + zp.szenen[1].dauer / 2), c = szeneBei(zp, 999)
  p('szeneBei: Start im Titel', a.szene.typ === 'titel' && a.p === 0)
  p('szeneBei: Mitte der zweiten Szene', b.index === 1 && nah(b.p, 0.5))
  p('szeneBei: nach dem Ende letzte Szene, p = 1', c.szene.typ === 'bilanz' && c.p === 1)
}

console.log('\n4  Kamera und Linien')
{
  const a = { mitte: [10, 50], P: 3 }, b = { mitte: [115.9, -31.9], P: 1.5 }
  const s = kameraFlug(a, b, 0), m = kameraFlug(a, b, 0.5), z = kameraFlug(a, b, 1)
  p('Flug startet beim ersten Blick', winkel(s.mitte, a.mitte) < 0.01 && nah(s.P, 3, 1e-6))
  p('Flug endet beim zweiten Blick', winkel(z.mitte, b.mitte) < 0.01 && nah(z.P, 1.5, 1e-6))
  p('in der Mitte weiter draußen', m.P > 3, m.P.toFixed(2))
  p('Mitte liegt auf dem Großkreis', nah(winkel(a.mitte, m.mitte) + winkel(m.mitte, b.mitte), winkel(a.mitte, b.mitte), 0.01))
  const kurz = kameraFlug({ mitte: [115, -31], P: 2 }, { mitte: [116, -32], P: 2 }, 0.5)
  p('kurzer Weg: kaum Bogen', kurz.P < 2.2, kurz.P.toFixed(2))
}
{
  const l = [[0, 0], [10, 0], [10, 10]]
  p('teilLinie 0: nur Anfang', teilLinie(l, 0).length === 1)
  p('teilLinie 1: ganze Linie', teilLinie(l, 1).length === 3)
  const h = teilLinie(l, 0.5)
  p('teilLinie 0,5: bis zur Ecke', h.length === 2 && nah(h[1][0], 10) && nah(h[1][1], 0))
  const v = teilLinie(l, 0.75)
  p('teilLinie 0,75: halb hinauf', nah(v[2][1], 5))
  const m = teilLinien([{ coords: [[0, 0], [10, 0]] }, { coords: [[20, 0], [30, 0]] }], 0.5)
  p('teilLinien: erst die erste Linie ganz', m.length === 1 && nah(m[0].coords.at(-1)[0], 10))
}
{
  const pr = globusProjektion({ breite: 400, hoehe: 400, mitte: [120, -25], P: 3 })
  const mitte = pr.proj([120, -25])
  p('Projektion: Blickpunkt in der Bildmitte', nah(mitte[0], 200, 1e-6) && nah(mitte[1], 200, 1e-6))
  p('Projektion: Rückseite unsichtbar', pr.proj([-60, 25]) === null)
  const ost = pr.proj([125, -25])
  p('Projektion: Osten rechts', ost[0] > 200)
}

console.log('\n5  Ken Burns')
{
  const a = kenBurns(0, 0), z = kenBurns(1, 0)
  p('zoomt langsam heran', z.skala > a.skala && a.skala >= 1)
  p('bleibt dezent (unter 16 %)', z.skala <= 1.16)
  p('Drift klein', Math.abs(z.dx) <= 0.02 && Math.abs(z.dy) <= 0.02)
  p('Richtung wechselt je Foto', Math.sign(kenBurns(1, 0).dx) !== Math.sign(kenBurns(1, 1).dx))
  const d = deckend(400, 300, 720, 1280)
  p('Foto füllt das Hochformat', d.w >= 720 && d.h >= 1280 && nah(d.x, (720 - d.w) / 2))
}

console.log('\n6  Videoformat')
p('Safari: MP4 zuerst', waehleFormat((m) => m.startsWith('video/mp4') || m === 'video/webm') === 'video/mp4;codecs=avc1')
p('Chrome: WebM VP9', waehleFormat((m) => m.startsWith('video/webm')) === 'video/webm;codecs=vp9')
p('nur einfaches WebM', waehleFormat((m) => m === 'video/webm') === 'video/webm')
p('älteres Safari: einfaches MP4', waehleFormat((m) => m === 'video/mp4') === 'video/mp4')
p('nichts unterstützt: null', waehleFormat(() => false) === null)
p('ohne MediaRecorder: null', waehleFormat(undefined) === null)
p('Prüfung wirft: nächstes Format', waehleFormat((m) => { if (m.includes('mp4')) throw new Error('x'); return true }) === 'video/webm;codecs=vp9')
p('Endung', endung('video/mp4;codecs=avc1') === 'mp4' && endung('video/webm') === 'webm')

console.log('\n7  Bilanz und Gesamtdaten')
const REISEN = [
  { id: 'E1', typ: 'etappe', name: 'Perth', von: '2037-11-30', tage: 4, farbe: '#aa3300', stops: [{ name: 'Perth', lat: -31.95, lon: 115.86 }] },
  { id: 'R1', typ: 'route', etappeId: 'E1', name: 'Süd', route: { km: 412 }, stops: [{ name: 'Perth', lat: -31.95, lon: 115.86 }, { name: 'Albany', lat: -35.02, lon: 117.88 }] },
  { id: 'E2', typ: 'etappe', name: 'Broome', art: 'flug', von: '2037-12-10', tage: 3, route: { km: 1700 }, stops: [{ name: 'Perth', lat: -31.95, lon: 115.86 }, { name: 'Broome', lat: -17.96, lon: 122.24 }] },
]
{
  const plan = [{ reise: REISEN[0], von: '2037-11-30', bis: '2037-12-03', tage: 4 }, { reise: REISEN[2], von: '2037-12-10', bis: '2037-12-12', tage: 3 }]
  const b = gesamtBilanz(plan, REISEN, [])
  p('Tage von erster bis letzter Etappe', b.tage === 13, String(b.tage))
  p('geplante km ohne Flüge', b.km === 412 && b.kmArt === 'geplant', JSON.stringify(b))
  const g = gesamtBilanz(plan, REISEN, [{ datum: '2037-12-01', felder: { distance_km: '120' } }, { datum: '2037-12-02', felder: { distance_km: 80.4 } }, { datum: '2038-03-01', felder: { distance_km: 999 } }])
  p('gefahrene km aus dem Logbuch', g.km === 200 && g.kmArt === 'gefahren', JSON.stringify(g))
  p('leer: 0 Tage', gesamtBilanz([], [], []).tage === 0)
}
{
  const d = filmDaten({ reisen: REISEN, journal: [{ id: 'j', datum: '2037-12-01', ort: 'Perth', fotos: [foto(1)] }], gesamtStart: '2037-11-29' })
  p('filmDaten: 2 Etappen', d.etappen.length === 2)
  p('filmDaten: Route der Etappe als Linie', d.etappen[0].geo.linien.length === 1)
  p('filmDaten: Flug als Bogen verdichtet', d.etappen[1].geo.linien[0].coords.length > 2 && d.etappen[1].geo.linien[0].flug)
  p('filmDaten: Foto der ersten Etappe', d.etappen[0].fotos.length === 1 && d.etappen[1].fotos.length === 0)
  p('filmDaten: Blick über Australien', d.etappen[0].blick.mitte[0] > 110 && d.etappen[0].blick.mitte[0] < 125)
  p('filmDaten: Zeitplan 30 bis 60 s', d.zeitplan.gesamt >= 30 && d.zeitplan.gesamt <= 60)
}

console.log(`\n${'═'.repeat(46)}\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
