// Geteilte WA-Ortskoordinaten + schematische Karten-Projektion.

export const WA_ORTE = {
  'Perth': [-31.95, 115.86], 'Lancelin': [-31.02, 115.33], 'Cervantes': [-30.5, 115.07],
  'Geraldton': [-28.77, 114.61], 'Kalbarri': [-27.71, 114.16], 'Denham': [-25.93, 113.53],
  'Monkey Mia': [-25.79, 113.72], 'Steep Point': [-26.15, 113.15], 'Dirk Hartog': [-25.8, 113.05],
  'Carnarvon': [-24.88, 113.66], 'Quobba': [-24.48, 113.43], 'Red Bluff': [-24.03, 113.45],
  'Gnaraloo': [-23.76, 113.53], 'Warroora': [-23.48, 113.8], 'Coral Bay': [-23.14, 113.77],
  'Yardie Creek': [-22.33, 113.81], 'Exmouth': [-21.93, 114.13], 'Gascoyne Junction': [-25.05, 115.21],
  'Kennedy Range': [-24.65, 115.17], 'Mount Augustus': [-24.32, 116.9], 'Tom Price': [-22.69, 117.79],
  'Karijini': [-22.48, 118.55], 'Millstream': [-21.58, 117.06], 'Karratha': [-20.74, 116.85],
  'Nanutarra': [-22.53, 115.5], 'Marble Bar': [-21.17, 119.74], 'Carawine Gorge': [-21.49, 121.03],
  'Running Waters': [-21.69, 121.13], 'Margaret River': [-33.95, 115.07], 'Augusta': [-34.31, 115.16],
  'Pemberton': [-34.44, 116.04], 'Walpole': [-34.98, 116.73], 'Denmark': [-34.96, 117.35],
  'Albany': [-35.02, 117.88], 'Stirling Range': [-34.38, 118.1], 'Hopetoun': [-33.95, 120.12],
  'Stokes NP': [-33.85, 120.7], 'Esperance': [-33.86, 121.89], 'Cape Le Grand': [-33.98, 122.12],
  'Duke of Orleans': [-33.93, 122.6], 'Cape Arid': [-33.92, 123.16], 'Israelite Bay': [-33.61, 123.88],
  'Peak Charles': [-32.88, 121.17], 'Norseman': [-32.2, 121.78], 'Kalgoorlie': [-30.75, 121.47],
  'Menzies': [-29.69, 121.03], 'Lake Ballard': [-29.45, 120.62], 'Kookynie': [-29.34, 121.49],
  'Gwalia': [-28.92, 121.33], 'Southern Cross': [-31.23, 119.33], 'Hyden': [-32.44, 118.9],
}

export const WA_ORTE_NAMEN = Object.keys(WA_ORTE).sort()

// Schematischer WA-Umriss (gleicher Koordinatenraum wie die Prototyp-Karten).
export const WA_POLY = '150.3,16.0 136.8,9.0 131.4,6.0 121.5,12.0 113.4,22.0 108.9,31.0 101.7,40.0 89.5,46.6 82.8,58.0 69.3,66.0 56.5,70.1 40.9,74.4 25.3,83.4 18.9,86.5 16.7,85.0 14.9,90.0 13.2,98.4 10.2,111.8 12.2,115.8 9.9,122.0 7.7,128.5 12.6,133.0 16.7,144.1 20.8,154.7 24.9,172.0 27.3,177.2 32.0,186.5 30.8,192.3 30.1,200.3 27.4,203.5 24.5,202.3 24.2,206.5 25.6,210.7 29.7,212.5 33.6,215.3 39.9,216.8 45.4,216.6 50.2,217.2 55.8,216.0 63.9,211.0 70.4,206.5 86.3,205.6 98.1,206.0 104.2,203.1 111.6,197.0 123.3,190.0 136.8,187.0 149.4,184.0 150.3,183.9'

export const proj = (lat, lon) => [(lon - 112.3) * 9.0, (-lat - 13.3) * 10.0]

/** Bekannte Koordinaten zu einem Ortsnamen finden (für Routen-Übernahme). */
export function findeKoordinaten(name) {
  if (WA_ORTE[name]) return WA_ORTE[name]
  const clean = name.replace(/,.*$/, '').replace(/\s+(National Park|NP)$/i, '').trim()
  if (WA_ORTE[clean]) return WA_ORTE[clean]
  // lockerer Vergleich
  const key = Object.keys(WA_ORTE).find((k) => clean.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(clean.toLowerCase()))
  return key ? WA_ORTE[key] : null
}
