// Was der Nutzer liest, wenn etwas schiefgeht. Nie Technik, immer ein Satz.
// Ausführen: node tests/fehlertext.test.mjs   (kein Netz)
//
// Gefunden im Prüfdurchgang zu V45: Ohne Grafikbeschleunigung stand auf der Kartenseite der rohe
// Brocken der Kartenbibliothek — ein JSON mit requestedAttributes und statusMessage.
import { fehlerText } from '../src/lib/fehlertext.js'

let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : '→ ' + info); if (!ok) fehler++ }

console.log('\nFehlermeldungen für Menschen')
{
  const webgl = new Error(JSON.stringify({ requestedAttributes: { antialias: false }, statusMessage: 'Could not create a WebGL context, VENDOR = 0x0000' }))
  const t1 = fehlerText(webgl)
  p('Fehlende Grafikbeschleunigung wird erklärt', /Grafikbeschleunigung/.test(t1), t1)
  p('Und dabei steht, dass der Rest weiterläuft', /Plan, Orte und Listen/.test(t1), t1)

  p('Ein JSON-Brocken kommt nicht auf den Bildschirm', fehlerText(new Error('{"a":1,"b":2}')) === 'Das hat nicht geklappt.')
  p('Eine Stapelspur auch nicht', fehlerText(new Error('Boom\n    at foo (bar.js:1:1)')) === 'Das hat nicht geklappt.')
  p('Ellenlanges wird abgefangen', fehlerText(new Error('x'.repeat(200))) === 'Das hat nicht geklappt.')

  p('Netzprobleme bleiben erklärt', /nicht erreichbar|offline/i.test(fehlerText(new TypeError('Failed to fetch'))))
  p('Zeitüberschreitung bleibt erklärt', /zu lange/i.test(fehlerText(Object.assign(new Error('x'), { name: 'AbortError' }))))
  p('Ein eigener, klarer Satz bleibt stehen', fehlerText(new Error('Die Offline-Karte liegt noch nicht auf diesem Gerät.')) === 'Die Offline-Karte liegt noch nicht auf diesem Gerät.')
  p('Ohne alles kommt der Rückfall', fehlerText(null) === 'Das hat nicht geklappt.' && fehlerText(undefined, 'Nope') === 'Nope')
}

if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
