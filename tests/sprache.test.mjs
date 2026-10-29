// Englische Fassung: jeder Text hat eine Übersetzung, Platzhalter stimmen, Datumsformate und
// Mehrzahl sind englisch, die englischen Inhaltsdateien passen zu den deutschen.
// Anforderung: die ganze App auf Englisch (Umschalter, australisches/britisches Englisch).
// Ausführen: node tests/sprache.test.mjs
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { sammleSchluessel, ladeEn } from '../scripts/i18n/fehlend.mjs'

let ok = 0, bad = 0
const p = (name, bed, zusatz = '') => {
  if (bed) { ok++; console.log(`  ✓ ${name}`) }
  else { bad++; console.log(`  ✗ ${name}${zusatz ? '  → ' + zusatz : ''}`) }
}
const json = (f) => JSON.parse(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'))

console.log('\n1  Wörterbuch vollständig')
{
  const schluessel = sammleSchluessel(), en = ladeEn()
  const fehlt = [...schluessel.keys()].filter((k) => !(k in en))
  p(`alle ${schluessel.size} Texte im Code haben eine englische Fassung`, fehlt.length === 0, fehlt.slice(0, 5).map((k) => JSON.stringify(k)).join(', '))
  const platz = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((x) => x !== 'n').sort().join(',')
  const falsch = Object.entries(en).filter(([de, v]) => (typeof v === 'object' ? [v.one, v.other] : [v]).some((x) => platz(x) !== platz(de)))
  p('Platzhalter {…} in jeder Übersetzung erhalten', falsch.length === 0, falsch.slice(0, 3).map(([k]) => k).join(' | '))
  const deutsch = Object.values(en).flatMap((v) => (typeof v === 'object' ? [v.one, v.other] : [v])).filter((v) => /[äöüßÄÖÜ]/.test(v))
  p('keine Umlaute in englischen Texten (Hinweis auf vergessene Übersetzung)', deutsch.length === 0, deutsch.slice(0, 3).join(' | '))
  // Texte wie „Export fehlgeschlagen: “ werden mit dem Fehler verkettet: Leerzeichen am Rand müssen bleiben
  const rand = (s) => String(s).match(/^\s*/)[0] + '|' + String(s).match(/\s*$/)[0]
  const randFalsch = Object.entries(en).filter(([de, v]) => (typeof v === 'object' ? [v.one, v.other] : [v]).some((x) => rand(x) !== rand(de)))
  p('Leerzeichen am Anfang und Ende wie im deutschen Text', randFalsch.length === 0, randFalsch.slice(0, 3).map(([k]) => JSON.stringify(k)).join(', '))
}

console.log('\n2  Deutsch bleibt Standard in Node und Tests')
{
  const { t, tn, sprache, LOCALE } = await import('../src/lib/i18n.js')
  const { tagMonat, bereich, dezimal, tageText, zahl, eur, aud } = await import('../src/lib/format.js')
  p('Sprache de, LOCALE de-DE', sprache === 'de' && LOCALE === 'de-DE')
  p('t() liefert Deutsch', t('Heute') === 'Heute' && t('{n} km entfernt', { n: 5 }) === '5 km entfernt')
  p('tn() deutsch', tn(1, '{n} Tag', '{n} Tage') === '1 Tag' && tn(3, '{n} Tag', '{n} Tage') === '3 Tage')
  p('Datum deutsch: „1. Mai“, „4.–7. Mai“', tagMonat('2038-05-01') === '1. Mai' && bereich('2038-05-04', '2038-05-07') === '4.–7. Mai')
  p('Dezimal mit Komma, „2 Tage“', dezimal(2.5) === '2,5' && tageText(2) === '2 Tage')
  p('Tausender mit Punkt, Beträge „1.234 €“, „56.789 AU$“', zahl(1928) === '1.928' && eur(1234.4) === '1.234 €' && aud(56789) === '56.789 AU$', `${zahl(1928)} / ${eur(1234.4)} / ${aud(56789)}`)
}

console.log('\n3  Englisch (eigener Prozess mit __SPRACHE=en)')
{
  const code = `globalThis.__SPRACHE = 'en'
    const { t, tn, sprache, LOCALE } = await import('./src/lib/i18n.js')
    const f = await import('./src/lib/format.js')
    console.log(JSON.stringify({ sprache, LOCALE, heute: t('Heute'), km: t('{km} km entfernt', { km: 5 }),
      eins: tn(1, '{n} Tag', '{n} Tage'), drei: tn(3, '{n} Tag', '{n} Tage'),
      titel1: t('{n} Titel in „{name}“', { n: 1, name: 'X' }), titel3: t('{n} Titel in „{name}“', { n: 3, name: 'X' }),
      unbekannt: t('Mein eigener Ort'), tag: f.tagMonat('2038-05-01'), jahr: f.tagMonatJahr('2038-05-01'),
      bereich: f.bereich('2038-05-04', '2038-05-07'), lang: f.bereich('2038-04-30', '2038-05-03'),
      mitWt: f.mitWochentag('2038-05-01'), dez: f.dezimal(2.5), tage: f.tageText(1),
      zahl: f.zahl(1928), eur: f.eur(1234.4), aud: f.aud(56789), dez1: f.dezimal(12.345, 1),
      uhr: new Date(2038, 4, 1, 5, 38).toLocaleTimeString(LOCALE, { hour: f.ZWEI, minute: '2-digit' }) }))`
  const r = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd: new URL('..', import.meta.url), encoding: 'utf8' }))
  p('Sprache en, LOCALE en-AU', r.sprache === 'en' && r.LOCALE === 'en-AU')
  p('t() übersetzt mit Platzhaltern', r.heute === 'Today' && r.km === '5 km away', `${r.heute} / ${r.km}`)
  p('tn(): 1 day / 3 days', r.eins === '1 day' && r.drei === '3 days')
  p('gleiche deutsche Einzahl/Mehrzahl: 1 track / 3 tracks', r.titel1 === '1 track in “X”' && r.titel3 === '3 tracks in “X”', `${r.titel1} / ${r.titel3}`)
  p('eigene Texte bleiben unverändert', r.unbekannt === 'Mein eigener Ort')
  p('Datum: „1 May“, „1 May 2038“, „Sat, 1 May“', r.tag === '1 May' && r.jahr === '1 May 2038' && r.mitWt === 'Sat, 1 May', `${r.tag} / ${r.jahr} / ${r.mitWt}`)
  p('Bereich: „4–7 May“, „30 Apr – 3 May“', r.bereich === '4–7 May' && r.lang === '30 Apr – 3 May', `${r.bereich} / ${r.lang}`)
  p('Dezimalpunkt, „1 day“', r.dez === '2.5' && r.dez1 === '12.3' && r.tage === '1 day')
  p('Tausender mit Komma, Beträge „€1,234“, „AU$56,789“', r.zahl === '1,928' && r.eur === '€1,234' && r.aud === 'AU$56,789', `${r.zahl} / ${r.eur} / ${r.aud}`)
  p('Uhrzeit ohne führende Null: „5:38 am“', r.uhr === '5:38 am', r.uhr)
}

console.log('\n4  Englische Inhaltsdateien passen zu den deutschen')
{
  const orte = json('public/orte.json'), orteEn = json('public/orte.en.json')
  p(`alle ${orte.length} Orte haben eine englische Beschreibung`, orte.every((o) => orteEn[o.id]?.beschreibung))
  p('Saison-Hinweise vollständig übersetzt', orte.filter((o) => o.saison).every((o) => orteEn[o.id]?.saison))
  p('orte.en.json enthält nur Beschreibung und Saison (Gruppen bleiben Schlüssel)', Object.values(orteEn).every((x) => Object.keys(x).every((k) => k === 'beschreibung' || k === 'saison')))
  const q = json('public/quiz.json'), qe = json('public/quiz.en.json')
  p('Quiz: gleiche Fragen, gleiche richtige Antwort, gleich viele Antworten',
    q.fragen.length === qe.fragen.length && q.fragen.every((f, i) => qe.fragen[i].id === f.id && qe.fragen[i].richtig === f.richtig && qe.fragen[i].antworten.length === f.antworten.length))
  p('Quiz: Stufen mit gleichen Grenzen', q.levels.every((l, i) => qe.levels[i].min === l.min && qe.levels[i].max === l.max && qe.levels[i].stufe === l.stufe))
  const r = json('public/routen.json'), re = json('public/routen.en.json')
  p('Routen-Ideen: gleiche Routen, Tage und Google-Maps-Links', r.length === re.length && r.every((x, i) => re[i].id === x.id && re[i].steps.length === x.steps.length && re[i].links.every((l, k) => l.url === x.links[k].url)))
  const inh = json('public/inhalt.json'), inhEn = json('public/inhalt.en.json')
  p('Praxis/Inhalt: gleiche Felder', Object.keys(inh).every((k) => k in inhEn) && inh.praxisListe.length === inhEn.praxisListe.length && inh.kalender.length === inhEn.kalender.length)
}

console.log(`\n${'═'.repeat(46)}\n  ${ok} bestanden · ${bad} gescheitert\n`)
process.exit(bad ? 1 : 0)
