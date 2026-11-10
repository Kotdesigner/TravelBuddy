// Anzeige der Meldungen (V32): Namen und Zeichen der Arten, Gegenden, Gründe und Zeitangaben, deutsch und englisch.
import { writable } from 'svelte/store'
import { je } from './i18n.js'
import { GEGENDEN } from './meldungen-regeln.js'

export const ART = {
  weg: { icon: '🚧', de: 'Weg', en: 'Road' },
  tiere: { icon: '🐬', de: 'Tiere', en: 'Wildlife' },
  tanken: { icon: '⛽', de: 'Tanken', en: 'Fuel' },
  camping: { icon: '⛺', de: 'Camping', en: 'Camping' },
  wetter: { icon: '🌧️', de: 'Wetter', en: 'Weather' },
  tipp: { icon: '💡', de: 'Tipp', en: 'Tip' },
}
export const artName = (a) => (ART[a] ? je(ART[a].de, ART[a].en) : a)
export const gegendName = (id) => { const g = GEGENDEN.find((x) => x.id === id); return g ? je(g.de, g.en) : je('Australien', 'Australia') }

/** Platzhalter je Art, damit klar ist, was gemeint ist */
export const BEISPIEL = {
  weg: () => je('z. B. Pentecost River nicht passierbar', 'e.g. Pentecost River not passable'),
  tiere: () => je('z. B. viele Delfine am Strand, ab 7:30 Uhr', 'e.g. lots of dolphins on the beach from 7:30'),
  tanken: () => je('z. B. Diesel leer, Lieferung Donnerstag', 'e.g. no diesel, delivery on Thursday'),
  camping: () => je('z. B. Campground voll, Ausweichplatz frei', 'e.g. campground full, overflow has space'),
  wetter: () => je('z. B. Sturm, Piste rutschig', 'e.g. storm, track slippery'),
  tipp: () => je('z. B. Sonnenaufgang am Lookout lohnt sich', 'e.g. sunrise at the lookout is worth it'),
}

export function grundText(g) {
  return {
    kurz: je('Schreib kurz, was los ist.', 'Write briefly what is going on.'),
    lang: je('Bitte höchstens 300 Zeichen.', 'Please no more than 300 characters.'),
    nummer: je('Bitte keine Telefonnummern.', 'Please no phone numbers.'),
    mail: je('Bitte keine Mailadressen.', 'Please no email addresses.'),
    link: je('Bitte keine Links.', 'Please no links.'),
    ort: je('Wähle, wo es ist: Standort oder Ort.', 'Choose where it is: location or place.'),
    // Basic 1.35: Standort oder Ort außerhalb Australiens hieß vorher auch „Wähle, wo es ist“, obwohl schon gewählt
    'standort-ausserhalb': je('Du bist gerade nicht in Australien. Meldungen gehen nur für Orte dort. Such den Ort stattdessen.', 'You are not in Australia right now. Reports only work for places there. Search for the place instead.'),
    ausserhalb: je('Dieser Ort liegt nicht in Australien. Meldungen gehen nur für Orte dort.', 'This place is not in Australia. Reports only work for places there.'),
    art: je('Wähle, worum es geht.', 'Choose what it is about.'),
    'zu-viele': je('Gerade zu viele Meldungen von diesem Gerät. Versuch es in einer Stunde.', 'Too many reports from this device right now. Try again in an hour.'),
  }[g] || je('Das ging nicht. Versuch es später noch einmal.', 'That did not work. Please try again later.')
}

export function alter(ms, jetzt = Date.now()) {
  const min = Math.max(0, Math.round((jetzt - ms) / 60000))
  if (min < 2) return je('gerade eben', 'just now')
  if (min < 60) return je(`vor ${min} Min`, `${min} min ago`)
  const h = Math.round(min / 60)
  if (h < 24) return je(`vor ${h} Std`, `${h} h ago`)
  const d = Math.round(h / 24)
  return d === 1 ? je('gestern', 'yesterday') : je(`vor ${d} Tagen`, `${d} days ago`)
}
export function giltNoch(ablauf, jetzt = Date.now()) {
  const h = Math.max(0, Math.round((ablauf - jetzt) / 3600000))
  if (h < 24) return je(`gilt noch ${h} Std`, `valid for ${h} more h`)
  const d = Math.round(h / 24)
  return je(`gilt noch ${d} ${d === 1 ? 'Tag' : 'Tage'}`, `valid for ${d} more ${d === 1 ? 'day' : 'days'}`)
}

/** Blatt „Neue Meldung“ öffnen: { lat, lon, ort, art } oder {} (dann fragt das Blatt nach dem Ort) */
export const meldenBlatt = writable(null)
/** Eine Meldung ansehen: { id } */
export const meldungAuf = writable(null)
