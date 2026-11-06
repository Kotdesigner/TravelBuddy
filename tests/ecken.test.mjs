// Lichtrand: Eckrundung passend zum Gerät
import { bildschirmEcke } from '../src/lib/ecken.js'
let fehler = 0
const p = (name, ok, info = '') => { console.log(ok ? '  ✓' : '  ✗', name, ok ? '' : info); if (!ok) fehler++ }
const e = (breite, hoehe, ios = true, ipad = false) => bildschirmEcke({ breite, hoehe, ios, ipad })
console.log('\n1  iPhone')
p('iPhone SE eckig', e(375, 667) === 0)
p('iPhone 13 mini 44', e(360, 780) === 44)
p('iPhone 14 47', e(390, 844) === 47)
p('iPhone 15 55', e(393, 852) === 55)
p('iPhone 17 Pro 62', e(402, 874) === 62)
p('iPhone 17 Pro Max 62', e(440, 956) === 62)
p('quer gemessen gleich', e(874, 402) === 62)
p('unbekanntes neues iPhone rund', e(410, 900) === 55)
console.log('\n2  iPad und andere')
p('iPad Pro 11 rund', e(834, 1194, true, true) === 18)
p('iPad mini rund', e(744, 1133, true, true) === 18)
p('altes iPad eckig', e(768, 1024, true, true) === 0)
p('Android-Handy leicht rund', e(412, 915, false) === 28)
p('Rechner eckig', e(1440, 900, false) === 0)
p('ohne Maße eckig', bildschirmEcke() === 0)
if (fehler) { console.log(`\n${fehler} Fehler`); process.exit(1) }
console.log('\nAlles grün')
