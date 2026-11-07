// Wanderungs-Vorschläge entlang der WA-Route. Mit einem Tipp landen sie auf der
// Wunschliste unter Plan → Wanderungen. Zahlen nach den Angaben der Parkverwaltung (DBCA,
// exploreparks.dbca.wa.gov.au) und Trails WA, gerundet. Wo die Quellen auseinandergehen, gilt DBCA.
// sommer: 'zu' = im Hochsommer gesperrt, 'oft-zu' = im Sommer oft gesperrt, 'frueh' = nur früh morgens offen oder sinnvoll.
import { je, jeSprache } from './i18n.js'

// Gegend je Vorschlag, von Süd nach Nord wie man fährt
const GEGEND = {
  'cape-to-cape-naturaliste': 'sw', 'gloucester-tree': 'sw', 'dave-evans-tree': 'sw', 'tree-top-walk': 'sw',
  'castle-rock-skywalk': 'sk', 'bluff-knoll': 'sk', 'west-mount-barren': 'sk', 'east-mount-barren': 'sk',
  'frenchman-peak': 'es', 'cape-le-grand-coastal': 'es', 'peak-charles': 'es',
  'mount-lesueur': 'mw', 'kalbarri-loop': 'mw', 'kalbarri-z-bend': 'mw', 'wanamalu': 'mw',
}

export const WANDER_VORSCHLAEGE = jeSprache(() => ([
  // ---------- Süden ----------
  {
    id: 'cape-to-cape-naturaliste', abschnitt: 'sued',
    name: je('Cape to Cape Track: Leuchtturm bis Sugarloaf Rock', 'Cape to Cape Track: lighthouse to Sugarloaf Rock'),
    gebiet: 'Leeuwin-Naturaliste NP', lat: -33.5373, lon: 115.0190,
    km: 3.5, dauerMin: 90, hoehenmeter: '', schwierigkeit: 'leicht', art: 'strecke', wasser: 1.5,
    besteZeit: je('früh morgens oder am späten Nachmittag', 'early morning or late afternoon'),
    beschreibung: je('Erster Abschnitt des rund 125 km langen Cape to Cape Track, mit Platten und Holzstegen gut ausgebaut. Start am Leuchtturm Cape Naturaliste. Zurück auf demselben Weg sind es 7 km.',
      'First section of the Cape to Cape Track, which is about 125 km long. Paved paths and boardwalks, starts at Cape Naturaliste Lighthouse. Walking back the same way makes it 7 km.'),
  },
  {
    id: 'gloucester-tree', abschnitt: 'sued', ortId: 'gloucester_tree',
    name: je('Gloucester Tree: auf den Feuerwachbaum', 'Gloucester Tree: climb the fire lookout'),
    gebiet: 'Gloucester NP, Pemberton', lat: -34.44765, lon: 116.05585,
    km: '', dauerMin: 30, hoehenmeter: 53, schwierigkeit: 'mittel', art: 'hin-zurueck', wasser: 0.5,
    besteZeit: je('trocken und windstill', 'dry and calm'),
    beschreibung: je('153 Stahlsprossen führen spiralförmig auf die Plattform in 53 m Höhe. Nur für Schwindelfreie, bei Regen oder Wind lieber unten bleiben. Kurze Rundwege durch den Karri-Wald gibt es direkt am Parkplatz.',
      '153 steel pegs spiral up to the platform at 53 m. Only if you have a head for heights, skip it in rain or wind. Short loops through the karri forest start at the car park.'),
  },
  {
    id: 'dave-evans-tree', abschnitt: 'sued', ortId: 'dave_evans_bicentennial_tree',
    name: je('Dave Evans Bicentennial Tree: der höchste Kletterbaum', 'Dave Evans Bicentennial Tree: the tallest climbing tree'),
    gebiet: 'Warren NP, Pemberton', lat: -34.49527, lon: 115.97504,
    km: '', dauerMin: 45, hoehenmeter: 75, schwierigkeit: 'schwer', art: 'hin-zurueck', wasser: 0.5,
    besteZeit: je('trocken und windstill', 'dry and calm'),
    beschreibung: je('Die Plattform liegt in 75 m Höhe, deutlich höher als am Gloucester Tree und meist weniger los. Gleiche Regeln: nur bei trockenem Wetter und schwindelfrei.',
      'The platform is at 75 m, clearly higher than the Gloucester Tree and usually quieter. Same rules: only in dry weather and with a head for heights.'),
  },
  {
    id: 'tree-top-walk', abschnitt: 'sued', ortId: 'valley_of_the_giants_tree_top_walk',
    name: je('Valley of the Giants: Tree Top Walk', 'Valley of the Giants: Tree Top Walk'),
    gebiet: 'Walpole-Nornalup NP', lat: -34.97635, lon: 116.895,
    km: 0.6, dauerMin: 45, hoehenmeter: '', schwierigkeit: 'leicht', art: 'rundweg', wasser: 0.5,
    besteZeit: je('gleich zur Öffnung, dann ist es leer', 'right at opening time, when it is quiet'),
    beschreibung: je('Hängebrücken bis 40 m hoch durch die Kronen der Tingle-Bäume, danach der Ancient Empire Walk am Boden. Eintritt kostet.',
      'Walkway up to 40 m high through the crowns of the tingle trees, followed by the Ancient Empire walk on the ground. Entry fee.'),
  },
  {
    id: 'castle-rock-skywalk', abschnitt: 'sued', ortId: 'castle_rock_granite_skywalk',
    name: je('Castle Rock: Granite Skywalk', 'Castle Rock: Granite Skywalk'),
    gebiet: 'Porongurup NP', lat: -34.68, lon: 117.88,
    km: 4.4, dauerMin: 120, hoehenmeter: 300, schwierigkeit: 'schwer', art: 'hin-zurueck', wasser: 1.5,
    besteZeit: je('vormittags, bei klarer Sicht', 'in the morning with clear skies'),
    beschreibung: je('Stetig bergauf durch den Wald, zum Schluss über Granit und eine Leiter auf den Skywalk. Das letzte Stück ist steil und ausgesetzt.',
      'Steady climb through the forest, at the end over granite and up a ladder to the skywalk. The last part is steep and exposed.'),
  },
  {
    id: 'bluff-knoll', abschnitt: 'sued', ortId: 'bluff_knoll',
    name: je('Bluff Knoll', 'Bluff Knoll'),
    gebiet: 'Stirling Range NP', lat: -34.37461, lon: 118.2561,
    km: 6, dauerMin: 210, hoehenmeter: 600, schwierigkeit: 'schwer', art: 'hin-zurueck', wasser: 2,
    besteZeit: je('früh starten, oben ist es oft windig und kalt', 'start early, the top is often windy and cold'),
    beschreibung: je('Höchster Gipfel im Süden von WA (1.095 m), steiler Weg mit vielen Stufen. Das Wetter schlägt schnell um, auch im Sommer eine Jacke mitnehmen.',
      'Highest peak in the south of WA (1,095 m), steep path with many steps. The weather changes fast, bring a jacket even in summer.'),
  },
  {
    id: 'west-mount-barren', abschnitt: 'sued', ortId: 'west_mount_barren',
    name: je('West Mount Barren', 'West Mount Barren'),
    gebiet: 'Fitzgerald River NP', lat: -34.21656, lon: 119.43299,
    km: 1.7, dauerMin: 120, hoehenmeter: '', schwierigkeit: 'mittel', art: 'hin-zurueck', wasser: 1,
    besteZeit: je('morgens', 'in the morning'),
    beschreibung: je('Kurz, aber steil und felsig. Oben weiter Blick über den Nationalpark bis zur Küste.',
      'Short but steep and rocky. Wide views over the national park to the coast from the top.'),
  },
  {
    id: 'east-mount-barren', abschnitt: 'sued', ortId: 'east_mount_barren',
    name: je('East Mount Barren', 'East Mount Barren'),
    gebiet: 'Fitzgerald River NP, Hopetoun', lat: -33.92292, lon: 120.02271,
    km: 2.6, dauerMin: 150, hoehenmeter: '', schwierigkeit: 'mittel', art: 'hin-zurueck', wasser: 1.5,
    besteZeit: je('morgens', 'in the morning'),
    beschreibung: je('Felsiger Weg auf den Quarzitrücken über der Küste bei Hopetoun, oben Blick aufs Meer und die Barrens.',
      'Rocky path up the quartzite ridge above the coast near Hopetoun, with views of the sea and the Barrens.'),
  },
  {
    id: 'frenchman-peak', abschnitt: 'sued', ortId: 'frenchman_peak',
    name: je('Frenchman Peak', 'Frenchman Peak'),
    gebiet: 'Cape Le Grand NP, Esperance', lat: -33.96807, lon: 122.16636,
    km: 3, dauerMin: 120, hoehenmeter: 180, schwierigkeit: 'schwer', art: 'hin-zurueck', wasser: 1.5,
    besteZeit: je('früh morgens oder zum Sonnenuntergang', 'early morning or at sunset'),
    beschreibung: je('Steil über blanken Granit zu einer Felshöhle unter dem Gipfel, oben Blick auf Lucky Bay und die Inseln. Bei Nässe sehr glatt, in der Mittagssonne heiß.',
      'Steep climb over bare granite to a rock cave below the summit, with views of Lucky Bay and the islands. Very slippery when wet, hot in the midday sun.'),
  },
  {
    id: 'cape-le-grand-coastal', abschnitt: 'sued',
    name: je('Cape Le Grand Coastal Trail: Lucky Bay bis Thistle Cove', 'Cape Le Grand Coastal Trail: Lucky Bay to Thistle Cove'),
    gebiet: 'Cape Le Grand NP, Esperance', lat: -33.9935, lon: 122.2290,
    km: 2.5, dauerMin: 60, hoehenmeter: '', schwierigkeit: 'mittel', art: 'strecke', wasser: 1,
    besteZeit: je('morgens, dann liegen oft Kängurus am Strand von Lucky Bay', 'in the morning, when kangaroos often rest on Lucky Bay beach'),
    beschreibung: je('Der leichteste Abschnitt des rund 20 km langen Küstenwegs, mit Blick auf die Inseln des Recherche-Archipels. Weiter nach Hellfire Bay sind es 4,7 km, deutlich schwerer.',
      'The easiest section of the coastal trail, which is about 20 km long, with views of the Recherche Archipelago. Going on to Hellfire Bay adds 4.7 km and is much harder.'),
  },
  {
    id: 'peak-charles', abschnitt: 'sued', ortId: 'peak_charles_national_park',
    name: je('Peak Charles', 'Peak Charles'),
    gebiet: 'Peak Charles NP', lat: -32.90859, lon: 121.10828,
    km: 3.4, dauerMin: 180, hoehenmeter: '', schwierigkeit: 'sehr-schwer', art: 'hin-zurueck', wasser: 2,
    besteZeit: je('früh morgens, nur bei trockenem Wetter', 'early morning, only in dry weather'),
    beschreibung: je('Bis zum Sattel ein steiler Pfad, das letzte Stück zum Gipfel ist Klettern mit Händen und Füßen in Felsspalten. Nur für Geübte. Anfahrt über Schotter, Allrad empfohlen.',
      'A steep path up to the saddle, the last part to the summit is a scramble with hands and feet in rock cracks. Experienced hikers only. Gravel road, 4WD recommended.'),
  },
  // ---------- Norden ----------
  {
    id: 'mount-lesueur', abschnitt: 'nord', ortId: 'lesueur_np_mount_lesueur',
    name: je('Mount Lesueur', 'Mount Lesueur'),
    gebiet: 'Lesueur NP', lat: -30.18338, lon: 115.14071,
    km: 3.5, dauerMin: 90, hoehenmeter: '', schwierigkeit: 'mittel', art: 'hin-zurueck', wasser: 1.5,
    besteZeit: je('morgens', 'in the morning'),
    beschreibung: je('Auf den flachen Tafelberg mit Blick über die Heide bis zum Meer. Im Frühling blüht hier eine der artenreichsten Pflanzenwelten von WA.',
      'Up the flat-topped hill with views across the heath to the sea. In spring one of the richest plant areas of WA is in flower.'),
  },
  {
    id: 'kalbarri-loop', abschnitt: 'nord', ortId: 'natures_window_the_loop', sommer: 'frueh',
    name: je('Kalbarri: The Loop mit Nature’s Window', 'Kalbarri: The Loop with Nature’s Window'),
    gebiet: 'Kalbarri NP', lat: -27.55302, lon: 114.44606,
    km: 8, dauerMin: 210, hoehenmeter: '', schwierigkeit: 'mittel', art: 'rundweg', wasser: 3,
    besteZeit: je('bei Sonnenaufgang', 'at sunrise'),
    beschreibung: je('Rundweg am Rand der Murchison-Schlucht, Nature’s Window liegt 400 m vom Parkplatz. Von November bis März ist der Rundweg ab 7 Uhr gesperrt, dort werden bis zu 50 °C gemessen.',
      'Loop along the rim of the Murchison gorge, Nature’s Window is 400 m from the car park. From November to March the loop is closed after 7 am, temperatures there can reach 50 °C.'),
  },
  {
    id: 'kalbarri-z-bend', abschnitt: 'nord', sommer: 'zu',
    name: je('Kalbarri: Z Bend River Trail', 'Kalbarri: Z Bend River Trail'),
    gebiet: 'Kalbarri NP', lat: -27.6553, lon: 114.4553,
    km: 2.6, dauerMin: 120, hoehenmeter: '', schwierigkeit: 'schwer', art: 'hin-zurueck', wasser: 2,
    besteZeit: je('April bis Oktober, morgens', 'April to October, in the morning'),
    beschreibung: je('Über Leitern hinunter an den Fluss in der Schlucht. Von November bis März wegen der Hitze gesperrt. Der Aussichtspunkt oben bleibt offen und ist nur 1,2 km hin und zurück.',
      'Down ladders to the river in the gorge. Closed from November to March because of the heat. The lookout at the top stays open and is only 1.2 km return.'),
  },
  {
    id: 'wanamalu', abschnitt: 'nord',
    name: je('Wanamalu Trail: Cape Peron bis Skipjack Point', 'Wanamalu Trail: Cape Peron to Skipjack Point'),
    gebiet: 'Francois Peron NP, Shark Bay', lat: -25.507, lon: 113.515,
    km: 3, dauerMin: 90, hoehenmeter: '', schwierigkeit: 'leicht', art: 'hin-zurueck', wasser: 1.5,
    besteZeit: je('früh morgens, von oben sieht man oft Haie, Rochen und Delfine', 'early morning, from the cliffs you often see sharks, rays and dolphins'),
    beschreibung: je('Auf den roten Klippen zwischen Cape Peron und Skipjack Point, je Richtung 1,5 km. Kein Schatten. Nur mit Allrad über Sandpisten erreichbar.',
      'Along the red cliffs between Cape Peron and Skipjack Point, 1.5 km each way. No shade. Only reachable by 4WD on sand tracks.'),
  },
  {
    id: 'temple-gorge', abschnitt: 'nord', ortId: 'kennedy_range_np_temple_gorge',
    name: je('Kennedy Range: Temple Gorge', 'Kennedy Range: Temple Gorge'),
    gebiet: 'Kennedy Range NP', lat: -24.66114, lon: 115.16951,
    km: 2, dauerMin: 90, hoehenmeter: '', schwierigkeit: 'mittel', art: 'hin-zurueck', wasser: 1.5,
    besteZeit: je('früh morgens', 'early morning'),
    beschreibung: je('Durch ein trockenes Bachbett bis zu einer Sandsteinwand, dem „Tempel“. Hinter der Gabelung wird es felsiger.',
      'Along a dry creek bed to a sandstone wall called the Temple. Beyond the fork it gets rockier.'),
  },
  {
    id: 'mount-augustus', abschnitt: 'nord', ortId: 'mount_augustus_burringurrah', sommer: 'zu',
    name: je('Mount Augustus: Summit Trail', 'Mount Augustus: Summit Trail'),
    gebiet: 'Mount Augustus NP (Burringurrah)', lat: -24.89565, lon: 116.95715,
    km: 12, dauerMin: 360, hoehenmeter: 700, schwierigkeit: 'sehr-schwer', art: 'hin-zurueck', wasser: 4,
    besteZeit: je('Mai bis August, Start vor Sonnenaufgang', 'May to August, start before sunrise'),
    beschreibung: je('Auf den Gipfel des größten Monolithen der Welt (1.105 m). Vom 1. November bis Ende Februar gesperrt, im September, Oktober, März und April nur mit Start vor 7 Uhr. Im Sommer bleiben die kurzen Wege am Fuß des Berges.',
      'To the summit of the world’s largest monolith (1,105 m). Closed from 1 November to the end of February, in September, October, March and April only with a start before 7 am. In summer, stick to the short walks at the foot of the mountain.'),
  },
  {
    id: 'mandu-mandu', abschnitt: 'nord', sommer: 'frueh',
    name: je('Mandu Mandu Gorge', 'Mandu Mandu Gorge'),
    gebiet: 'Cape Range NP, Exmouth', lat: -22.14995, lon: 113.88221,
    km: 3, dauerMin: 120, hoehenmeter: '', schwierigkeit: 'mittel', art: 'rundweg', wasser: 2,
    besteZeit: je('früh morgens', 'early morning'),
    beschreibung: je('Durch das trockene Bachbett in die Schlucht und oben am Rand zurück, mit Blick bis aufs Ningaloo Reef. Steinig und ohne Schatten.',
      'Through the dry creek bed into the gorge and back along the rim, with views out to Ningaloo Reef. Rocky and without shade.'),
  },
  {
    id: 'yardie-creek', abschnitt: 'nord', ortId: 'yardie_creek_track_coral_bay_cape_range',
    name: je('Yardie Creek Gorge', 'Yardie Creek Gorge'),
    gebiet: 'Cape Range NP, Exmouth', lat: -22.3226, lon: 113.8127,
    km: 2, dauerMin: 60, hoehenmeter: '', schwierigkeit: 'mittel', art: 'hin-zurueck', wasser: 1,
    besteZeit: je('früh morgens, mit etwas Glück Felskängurus', 'early morning, with luck you see rock wallabies'),
    beschreibung: je('Erst der leichte Naturpfad am Wasser, dann der felsige Weg oben an der Schlucht entlang. Auch eine Bootstour durch die Schlucht ist möglich.',
      'First the easy nature walk by the water, then the rocky path along the top of the gorge. A boat tour through the gorge is also possible.'),
  },
  {
    id: 'charles-knife', abschnitt: 'nord', ortId: 'charles_knife_canyon_shothole_canyon', sommer: 'frueh',
    name: je('Charles Knife Canyon: Badjirrajirra Trail', 'Charles Knife Canyon: Badjirrajirra Trail'),
    gebiet: 'Cape Range NP, Exmouth', lat: -22.06, lon: 114.02,
    km: 6.8, dauerMin: 180, hoehenmeter: '', schwierigkeit: 'mittel', art: 'rundweg', wasser: 3,
    besteZeit: je('nur früh morgens', 'only early in the morning'),
    beschreibung: je('Über das Kalksteinplateau der Cape Range mit Blick in die Schluchten. Lose Steine, kaum Schatten. Start am Parkplatz Thomas Carter Lookout.',
      'Across the limestone plateau of the Cape Range with views into the canyons. Loose rock, hardly any shade. Starts at the Thomas Carter Lookout car park.'),
  },
  {
    id: 'mount-herbert', abschnitt: 'nord', ortId: 'millstream_chichester_np', sommer: 'frueh',
    name: je('Millstream Chichester: Mount Herbert und Camel Trail', 'Millstream Chichester: Mount Herbert and Camel Trail'),
    gebiet: 'Millstream Chichester NP', lat: -21.45492, lon: 117.48029,
    km: 0.6, dauerMin: 25, hoehenmeter: '', schwierigkeit: 'leicht', art: 'hin-zurueck', wasser: 1,
    besteZeit: je('früh morgens', 'early morning'),
    beschreibung: je('Kurzer, steiler Weg auf den Mount Herbert, den höchsten Punkt der Chichester Range. Wer mehr will: Der Camel Trail führt 8 km ohne Schatten hinunter zum Python Pool, dafür ein Auto am Ziel abstellen. Der Startpunkt hier ist der Nationalpark, der Parkplatz liegt an der Straße nach Roebourne.',
      'Short, steep path up Mount Herbert, the highest point of the Chichester Range. For more: the Camel Trail runs 8 km without shade down to Python Pool, leave a car at the end. The start point here is the national park, the car park is on the road to Roebourne.'),
  },
  {
    id: 'dales-gorge', abschnitt: 'nord', sommer: 'frueh',
    name: je('Karijini: Dales Gorge mit Fortescue Falls und Fern Pool', 'Karijini: Dales Gorge with Fortescue Falls and Fern Pool'),
    gebiet: 'Karijini NP', lat: -22.4739, lon: 118.5598,
    km: 5.1, dauerMin: 210, hoehenmeter: '', schwierigkeit: 'mittel', art: 'rundweg', wasser: 3,
    besteZeit: je('früh morgens, mittags im Fern Pool baden', 'early morning, swim in Fern Pool at midday'),
    beschreibung: je('Am Schluchtrand entlang, über Stufen hinunter zu den Fortescue Falls und zum Fern Pool, unten durch die Schlucht zur Circular Pool. Wer es kürzer mag: nur Fortescue Falls, 800 m hin und zurück.',
      'Along the gorge rim, down steps to Fortescue Falls and Fern Pool, then through the gorge to Circular Pool. For a shorter walk: only Fortescue Falls, 800 m return.'),
  },
  {
    id: 'hancock-gorge', abschnitt: 'nord', ortId: 'karijini_np', sommer: 'oft-zu',
    name: je('Karijini: Hancock Gorge und Spider Walk', 'Karijini: Hancock Gorge and Spider Walk'),
    gebiet: 'Karijini NP', lat: -22.40684, lon: 118.47567,
    km: 1.5, dauerMin: 120, hoehenmeter: '', schwierigkeit: 'sehr-schwer', art: 'hin-zurueck', wasser: 1.5,
    besteZeit: je('Mai bis September', 'May to September'),
    beschreibung: je('Leitern hinunter, dann durch Wasser und im Spreizschritt durch den engen Spider Walk bis zum Kermit’s Pool. Der Bereich Weano mit Hancock Gorge ist im Sommer oft wegen Hitze und Sturzfluten gesperrt, vorher bei der Parkverwaltung nachsehen. Der Startpunkt hier ist der Nationalpark, die Schlucht liegt im Bereich Weano.',
      'Down ladders, then through water and with legs braced through the narrow Spider Walk to Kermit’s Pool. The Weano area with Hancock Gorge is often closed in summer because of heat and flash floods, check with the park service first. The start point here is the national park, the gorge is in the Weano area.'),
  },
]).map((v) => ({ ...v, gegend: GEGEND[v.id] || 'nw' })))

export const GEGENDEN = jeSprache(() => ([
  { id: 'sw', titel: je('Südwesten', 'South West'), unter: 'Margaret River, Pemberton, Walpole' },
  { id: 'sk', titel: je('Südküste', 'South Coast'), unter: 'Albany, Stirling Range, Fitzgerald River' },
  { id: 'es', titel: 'Esperance', unter: je('Cape Le Grand und Hinterland', 'Cape Le Grand and inland') },
  { id: 'mw', titel: je('Mittlerer Westen', 'Mid West'), unter: 'Lesueur, Kalbarri, Shark Bay' },
  { id: 'nw', titel: je('Outback und Nordwesten', 'Outback and North West'), unter: 'Kennedy Range, Mount Augustus, Exmouth, Pilbara' },
]))

/** Kurzer Hinweis zur Sommerhitze, leer wenn es keinen gibt. */
export function sommerText(sommer) {
  if (sommer === 'zu') return je('Im Hochsommer gesperrt.', 'Closed in midsummer.')
  if (sommer === 'oft-zu') return je('Im Sommer oft gesperrt.', 'Often closed in summer.')
  if (sommer === 'frueh') return je('Im Sommer nur früh morgens.', 'In summer only early in the morning.')
  return ''
}

/** Vorlage für neueWanderung() aus einem Vorschlag. */
export function alsWanderung(v) {
  const hinweis = sommerText(v.sommer)
  return {
    name: v.name, gebiet: v.gebiet, km: v.km, dauerMin: v.dauerMin, hoehenmeter: v.hoehenmeter,
    schwierigkeit: v.schwierigkeit, art: v.art, lat: v.lat, lon: v.lon, ortId: v.ortId || null,
    wasser: v.wasser, besteZeit: v.besteZeit, status: 'wunsch', vorschlagId: v.id,
    beschreibung: [v.beschreibung, hinweis].filter(Boolean).join(' '),
  }
}

/** Ist der Vorschlag schon in der Liste? Über die gemerkte Kennung, sonst über den Namen. */
export function schonDa(v, wanderungen = []) {
  const n = (s) => String(s || '').trim().toLowerCase()
  return wanderungen.some((w) => w && (w.vorschlagId === v.id || n(w.name) === n(v.name)))
}
