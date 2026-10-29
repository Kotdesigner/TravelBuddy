// Welche der 88 Vorschlags-Orte sind (auch) Wanderungen — und welche davon
// „Wander-Perlen" (die absoluten Top-Wanderungen). Namen exakt wie in public/orte.json.

export const WANDER_PERLEN = new Set([
  'Bluff Knoll',
  'Castle Rock Granite Skywalk',
  'Frenchman Peak',
  'East Mount Barren',
  'Peak Charles National Park',
  'Gloucester Tree',
  'Dave Evans Bicentennial Tree',
  'Valley of the Giants Tree Top Walk',
  'Kalbarri NP & Murchison Station',
  'Karijini NP',
  'Mount Augustus (Burringurrah)',
  'Charles Knife Canyon & Shothole Canyon',
])

export const WANDER_ORTE = new Set([
  ...WANDER_PERLEN,
  'West Mount Barren',
  'Heartbreak Trail / Heartbreak Crossing',
  'Shelley Beach, West Cape Howe NP',
  'Little Beach, Two Peoples Bay',
  'Cape Arid National Park',
  'Stokes National Park',
  'Conspicuous Cliffs',
  'Yardie Creek Track (Coral Bay ↔ Cape Range)',
  'Kennedy Range NP (Temple Gorge)',
  'Francois Peron NP (Voll-Loop)',
  'Millstream Chichester NP',
])

export const istWanderung = (name) => WANDER_ORTE.has(name)
export const istPerle = (name) => WANDER_PERLEN.has(name)
