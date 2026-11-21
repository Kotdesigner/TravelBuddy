// Die Bausteine, die bisher keinen eigenen Test hatten.
//
// Beim Prüfdurchgang zu V45 kam heraus: 33 der 139 Module werden von keinem Test angefasst.
// Die meisten zeichnen nur (Logo, Kugel, Kartenexport) und gehören in eine Browser-Prüfung.
// Alles, was reine Rechnerei ist, steht hier: Sortieren, Gerät erkennen, Quiz, Sternenhimmel,
// Ortskoordinaten, Wanderorte, Wettersymbole, Impressum, Bildsuche, Ausgaben-Dienst.
//
// Ausführen: node tests/bausteine.test.mjs   (kein Netz)
import { get } from 'svelte/store'
import { verschiebe } from '../src/lib/sortierbar.js'
// In der Basic stehen dieselben Funktionen in install.js, zusammen mit dem Hinweis „Zum Home-Bildschirm“.
import { istIOS, istIPad, istAndroid, istFirefox } from '../src/lib/install.js'
import { auswerten } from '../src/lib/quiz.js'
import { sterneBewertung, sterneIcon } from '../src/lib/sterne.js'
import { WA_ORTE, WA_ORTE_NAMEN, findeKoordinaten, proj } from '../src/lib/wa-orte.js'
import { istWanderung, istPerle, WANDER_ORTE, WANDER_PERLEN } from '../src/lib/wander-orte.js'
import { wetterBild } from '../src/lib/wetter.js'
import { impressumFertig } from '../src/lib/impressum.js'
import { bildSuche } from '../src/lib/bild-nachweis.js'
import { SCHWIERIGKEIT, WEGART, WANDER_STATUS, S_MAP, ART_MAP, STATUS_MAP } from '../src/lib/wanderungen-daten.js'
import { schnellAusgabe, ausgabeZeitraum, letzteKategorien } from '../src/lib/buchung-dienst.js'
import { journal } from '../src/lib/userdata.js'
import { ausgabenVon, ausgabenSumme } from '../src/lib/kosten.js'

let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : '→ ' + info); if (!ok) fehler++ }

console.log('\nSortieren (Ziehen und Fallenlassen)')
{
  p('nach hinten', verschiebe(['a', 'b', 'c', 'd'], 0, 2).join('') === 'bcad')
  p('nach vorn', verschiebe(['a', 'b', 'c', 'd'], 3, 0).join('') === 'dabc')
  p('auf dieselbe Stelle ändert nichts', verschiebe(['a', 'b', 'c'], 1, 1).join('') === 'abc')
  p('ans Ende', verschiebe(['a', 'b', 'c'], 0, 2).join('') === 'bca')
  p('die Ursprungsliste bleibt unberührt', (() => { const l = ['a', 'b']; verschiebe(l, 0, 1); return l.join('') === 'ab' })())
  // Ein Griff ins Leere darf keine Lücke in die Liste reißen
  p('Stelle außerhalb der Liste lässt sie in Ruhe', verschiebe(['a', 'b'], 5, 0).join('') === 'ab' && verschiebe(['a', 'b'], 0, 9).join('') === 'ab')
  p('leere Liste', verschiebe([], 0, 0).length === 0)
}

console.log('\nWelches Gerät?')
{
  const iphone = { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone', touch: 5 }
  const ipad = { ua: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', platform: 'iPad', touch: 5 }
  const ipadOS = { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', touch: 5 }
  const mac = { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', touch: 0 }
  const android = { ua: 'Mozilla/5.0 (Linux; Android 15; Pixel 9)', platform: 'Linux armv8l', touch: 5 }
  p('iPhone ist iOS, aber kein iPad', istIOS(iphone) && !istIPad(iphone))
  p('iPad ist beides', istIOS(ipad) && istIPad(ipad))
  p('iPad, das sich als Mac ausgibt, wird erkannt', istIOS(ipadOS) && istIPad(ipadOS))
  p('Ein echter Mac ist keins von beidem', !istIOS(mac) && !istIPad(mac))
  p('Android auch nicht', !istIOS(android) && !istIPad(android))
  p('Ohne Angaben kein Fehlalarm', !istIOS() && !istIPad())
  p('Android und Firefox werden eigens erkannt', istAndroid(android) && !istAndroid(iphone) && istFirefox({ ua: 'Mozilla/5.0 Firefox/130.0' }) && !istFirefox(iphone))
}

console.log('\nQuiz auswerten')
{
  const fragen = [{ id: 'a', richtig: 1 }, { id: 'b', richtig: 2 }, { id: 'c', richtig: 0 }, { id: 'd', richtig: 3 }]
  const levels = [{ min: 0, max: 1, name: 'Neuling' }, { min: 2, max: 3, name: 'Kenner' }, { min: 4, max: 4, name: 'Profi' }]
  const leer = auswerten({}, fragen, levels)
  p('Ohne Antworten: nichts richtig, Neuling', leer.beantwortet === 0 && leer.richtig === 0 && leer.level.name === 'Neuling')
  const halb = auswerten({ a: 1, b: 9, c: 0 }, fragen, levels)
  p('Teils richtig wird richtig gezählt', halb.beantwortet === 3 && halb.richtig === 2 && halb.level.name === 'Kenner', JSON.stringify(halb))
  const alle = auswerten({ a: 1, b: 2, c: 0, d: 3 }, fragen, levels)
  p('Alles richtig: Profi und 100 Prozent', alle.richtig === 4 && alle.prozent === 100 && alle.level.name === 'Profi')
  p('Eine Null als Antwort zählt als Antwort', auswerten({ c: 0 }, fragen, levels).beantwortet === 1)
  p('Ohne Fragen kein Absturz', (() => { const r = auswerten({}, [], levels); return r.gesamt === 50 && r.prozent === 0 })())
}

console.log('\nSternenhimmel')
{
  // Kalbarri, Westaustralien. Ein Mondstand sagt mehr als eine feste Zahl: Neumond muss besser
  // sein als Vollmond, und Wolken müssen die Bewertung drücken.
  const [lat, lon] = WA_ORTE['Kalbarri']
  const monate = Array.from({ length: 60 }, (_, i) => {
    const d = new Date(Date.UTC(2037, 0, 1 + i))
    return d.toISOString().slice(0, 10)
  })
  const werte = monate.map((d) => ({ d, b: sterneBewertung(lat, lon, d) }))
  const dunkel = werte.reduce((a, x) => (x.b.mondProzent < a.b.mondProzent ? x : a))
  const hell = werte.reduce((a, x) => (x.b.mondProzent > a.b.mondProzent ? x : a))
  p('In zwei Monaten kommen Neumond und Vollmond vor', dunkel.b.mondProzent < 15 && hell.b.mondProzent > 85, `${dunkel.b.mondProzent}% / ${hell.b.mondProzent}%`)
  p('Bei Neumond ist es besser als bei Vollmond', dunkel.b.score > hell.b.score && dunkel.b.sterne >= hell.b.sterne)
  p('Mondanteil bleibt zwischen 0 und 100', werte.every((x) => x.b.mondProzent >= 0 && x.b.mondProzent <= 100))
  p('Jede Bewertung hat Sterne von 0 bis 3 und einen Text', werte.every((x) => x.b.sterne >= 0 && x.b.sterne <= 3 && !!x.b.label))
  const klar = sterneBewertung(lat, lon, dunkel.d, 0)
  const zu = sterneBewertung(lat, lon, dunkel.d, 95)
  p('Wolken drücken die Bewertung deutlich', zu.score < klar.score * 0.3, `${klar.score.toFixed(2)} → ${zu.score.toFixed(2)}`)
  p('Bei dichten Wolken heißt es „Bewölkt“', zu.sterne === 0 && /Bewölkt|Cloudy/.test(zu.label), zu.label)
  p('Symbole passen zur Sternzahl', sterneIcon(3) === '🌟' && sterneIcon(2) === '⭐' && sterneIcon(1) === '✨' && sterneIcon(0) === '🌙')
}

console.log('\nOrte in Westaustralien')
{
  p('Die Liste ist sortiert und vollständig', WA_ORTE_NAMEN.length === Object.keys(WA_ORTE).length && WA_ORTE_NAMEN[0] <= WA_ORTE_NAMEN[1])
  p('Alle Koordinaten liegen in Australien', Object.values(WA_ORTE).every(([la, lo]) => la < -10 && la > -40 && lo > 110 && lo < 130))
  p('Ein Name trifft genau', findeKoordinaten('Perth')?.join() === '-31.95,115.86')
  p('Mit Zusatz nach dem Komma trifft er auch', findeKoordinaten('Kalbarri, WA')?.join() === WA_ORTE['Kalbarri'].join())
  p('„National Park“ am Ende stört nicht', findeKoordinaten('Karijini National Park')?.join() === WA_ORTE['Karijini'].join())
  p('Auch die Kurzform NP', findeKoordinaten('Karijini NP')?.join() === WA_ORTE['Karijini'].join())
  p('Was nicht in der Liste steht, gibt null', findeKoordinaten('Timbuktu') === null)
  const [x1, y1] = proj(-31.95, 115.86), [x2, y2] = proj(-21.93, 114.13)
  p('Die Karte projiziert Norden nach oben', y2 < y1, `${y1.toFixed(1)} / ${y2.toFixed(1)}`)
  p('Und Osten nach rechts', proj(-30, 120)[0] > proj(-30, 115)[0])
}

console.log('\nWanderorte')
{
  p('Es gibt Wanderorte und Perlen', WANDER_ORTE.size > 5 && WANDER_PERLEN.size > 2)
  p('Jede Perle ist auch ein Wanderort', [...WANDER_PERLEN].every((n) => WANDER_ORTE.has(n)), [...WANDER_PERLEN].filter((n) => !WANDER_ORTE.has(n)).join(', '))
  const einer = [...WANDER_ORTE][0]
  p('Ein bekannter Ort wird erkannt', istWanderung(einer), einer)
  p('Ein unbekannter nicht', !istWanderung('Hintertupfingen') && !istPerle('Hintertupfingen'))
}

console.log('\nWettersymbole')
{
  p('Klar ist die Sonne', wetterBild(0)[0] === '☀️')
  p('Gewitter ist ein Gewitter', wetterBild(95)[0] === '⛈️')
  p('Ein unbekannter Code bekommt einen Platzhalter', wetterBild(1234)[0] === '🌡️' && wetterBild(1234)[1] === '—')
  p('Jedes Symbol hat einen Text', [0, 1, 2, 3, 45, 61, 71, 80, 95, 99].every((c) => wetterBild(c)[1] && wetterBild(c)[1] !== '—'))
}

console.log('\nImpressum und Bildsuche')
{
  p('Vollständige Angaben gelten als fertig', impressumFertig({ name: 'A', strasse: 'B', ort: 'C', land: 'D', email: 'e@f.de' }))
  p('Fehlt etwas, gilt es als unfertig', !impressumFertig({ name: '', strasse: 'B', ort: 'C', email: 'e@f.de' })
    && !impressumFertig({ name: 'A', strasse: ' ', ort: 'C', email: 'e@f.de' })
    && !impressumFertig({ name: 'A', strasse: 'B', ort: 'C', email: '' }))
  const u = bildSuche('Hamelin Pool & Co')
  p('Die Bildsuche baut eine saubere Adresse', u.startsWith('https://www.google.com/search?') && !/ /.test(u) && u.includes('%26'), u)
}

console.log('\nStammdaten der Wanderungen')
{
  for (const [name, liste, karte] of [['Schwierigkeit', SCHWIERIGKEIT, S_MAP], ['Wegart', WEGART, ART_MAP], ['Status', WANDER_STATUS, STATUS_MAP]]) {
    p(`${name}: jede Zeile hat id, Text und Symbol`, liste.length > 1 && liste.every((x) => x.id && x.label && x.emoji), JSON.stringify(liste))
    p(`${name}: die Nachschlagekarte kennt alle`, liste.every((x) => karte[x.id]?.label === x.label))
  }
}

console.log('\nAusgaben-Dienst')
{
  journal.set([])
  const id = schnellAusgabe('2037-05-02', { kat: 'kosten_essen', betrag: '12,50', text: 'Markt' })
  const e = get(journal).find((j) => j.id === id)
  p('Für einen Tag ohne Eintrag wird einer angelegt', !!e && e.datum === '2037-05-02')
  p('Die Ausgabe steht darin', ausgabenVon(e).length === 1 && ausgabenSumme(ausgabenVon(e)) === 12.5)
  p('Die Kategorie-Summe stimmt auch im Feld', String(e.felder?.kosten_essen) === '12.5', JSON.stringify(e.felder))
  schnellAusgabe('2037-05-02', { kat: 'kosten_diesel', betrag: '40' })
  const e2 = get(journal).find((j) => j.id === id)
  p('Ein zweiter Posten kommt in denselben Tag', get(journal).length === 1 && ausgabenVon(e2).length === 2)

  journal.set([])
  const tage = ausgabeZeitraum('2037-05-01', '2037-05-04', { kat: 'kosten_essen', betrag: '10', text: 'Wocheneinkauf' })
  const js = get(journal)
  p('Ein Zeitraum legt jeden Tag an', tage === 4 && js.length === 4, `${tage} Tage, ${js.length} Einträge`)
  const summe = js.reduce((s, j) => s + ausgabenSumme(ausgabenVon(j)), 0)
  p('Die Teile ergeben zusammen genau den Betrag', Math.abs(summe - 10) < 0.001, String(summe))
  p('Alle Teile tragen dieselbe Gruppe', new Set(js.flatMap((j) => ausgabenVon(j).map((a) => a.gruppe))).size === 1)
  p('Ein rückwärts laufender Zeitraum legt nichts an', (() => { journal.set([]); const n = ausgabeZeitraum('2037-05-04', '2037-05-01', { kat: 'kosten_essen', betrag: '10' }); return n === 0 && get(journal).length === 0 })())

  journal.set([
    { id: 'j1', datum: '2037-05-01', ausgaben: [{ id: 'a', kat: 'kosten_essen', betrag: 5 }] },
    { id: 'j2', datum: '2037-05-03', ausgaben: [{ id: 'b', kat: 'kosten_diesel', betrag: 50 }, { id: 'c', kat: 'kosten_unterkunft', betrag: 90 }] },
  ])
  const letzte = letzteKategorien(get(journal), 6)
  p('Zuletzt benutzte Kategorien, neueste zuerst', letzte[0] === 'kosten_unterkunft' && letzte.includes('kosten_essen'), letzte.join(', '))
  p('Keine Kategorie doppelt', new Set(letzte).size === letzte.length)
  journal.set([])
}

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
