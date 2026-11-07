// Inseln: wie man hinkommt und von wo. Der Abstand zur Route zählt vom Hafen oder Flugplatz aus,
// nicht über das Wasser. Angaben nach den Texten der Orte (orte.json), Koordinaten der Häfen gerundet.
import { je, jeSprache } from './i18n.js'

export const INSELN = jeSprache(() => ({
  rottnest_island_wadjemup: { art: 'faehre', hafen: 'Fremantle', lat: -32.055, lon: 115.745,
    text: je('Fähre ab Fremantle, ca. 25 Min., auch ab Perth und Hillarys', 'Ferry from Fremantle, about 25 min, also from Perth and Hillarys') },
  penguin_island_shoalwater_kajaktour: { art: 'faehre', hafen: 'Mersey Point, Shoalwater', lat: -32.292, lon: 115.707,
    text: je('Fähre oder Kajak ab Mersey Point, Shoalwater, die Fähre fährt zurzeit unsicher', 'Ferry or kayak from Mersey Point, Shoalwater, the ferry is unreliable at the moment') },
  carnac_island: { art: 'boot', hafen: 'Fremantle', lat: -32.055, lon: 115.745,
    text: je('Nur Charter, Kajak oder eigenes Boot ab Fremantle', 'Charter, kayak or own boat from Fremantle only') },
  woody_island_recherche_archipel: { art: 'faehre', hafen: 'Esperance', lat: -33.862, lon: 121.893,
    text: je('Katamaran ab Esperance, Tagesausflug', 'Catamaran from Esperance, day trip') },
  middle_island_lake_hillier_aus_der_luft: { art: 'flug', hafen: 'Esperance', lat: -33.684, lon: 121.823,
    text: je('Nur Rundflug ab Esperance, Anlanden verboten', 'Scenic flight from Esperance only, landing not allowed') },
  king_george_sound_safari_albany: { art: 'boot', hafen: 'Albany', lat: -35.027, lon: 117.884,
    text: je('Bootssafari ab Albany, November bis April', 'Boat safari from Albany, November to April') },
  houtman_abrolhos_islands: { art: 'flug', hafen: 'Geraldton', lat: -28.796, lon: 114.707,
    text: je('Keine Fähre, Flug-Tagestour ab Geraldton', 'No ferry, day trip by plane from Geraldton') },
  muiron_islands_exmouth: { art: 'boot', hafen: 'Exmouth', lat: -21.958, lon: 114.141,
    text: je('Tauch- und Schnorchelboot ab Exmouth', 'Dive and snorkel boat from Exmouth') },
  mackerel_islands_thevenard: { art: 'boot', hafen: 'Onslow', lat: -21.638, lon: 115.112,
    text: je('Charter ab Onslow, im Januar zu', 'Charter from Onslow, closed in January') },
  montebello_islands: { art: 'boot', hafen: 'Exmouth', lat: -21.958, lon: 114.141,
    text: je('Nur Mehrtages-Charter ab Exmouth', 'Multi-day charter from Exmouth only') },
  dampier_archipel_murujuga: { art: 'boot', hafen: 'Dampier', lat: -20.664, lon: 116.709,
    text: je('Bootstouren ab Dampier, im Januar wetterabhängig', 'Boat tours from Dampier, weather dependent in January') },
}))

export const ANREISE_ZEICHEN = { faehre: '⛴️', boot: '🚤', flug: '✈️' }

/** Punkt, von dem aus der Abstand zur Route zählt: bei Inseln der Hafen, sonst der Ort selbst. */
export function abfahrtPunkt(ort) {
  const i = ort && INSELN[ort.id]
  return i ? { lat: i.lat, lon: i.lon } : ort
}

export const istInsel = (ort) => !!(ort && INSELN[ort.id])
