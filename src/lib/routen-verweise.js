// Wer in den Routen-Ideen vorkommt und wo er in der App steht. So passen die Werkseinstellungen
// zusammen: jeder Stopp ist ein Ort (mit Kachel) oder ein Etappenort (Stadt, Station, Roadhouse mit
// Versorgung), jeder Tag im Tagesplan nennt seine Orte. Ein Test (routen-verweise) prüft das bei
// jeder Änderung; eine neue Routen-Idee ohne Eintrag hier fällt sofort auf.

// Etappenorte: Städte zum Tanken, Einkaufen und Übernachten, keine Sehenswürdigkeit. Halt der Routen-Ideen
// und Stützpunkte jeder Gegend (auch an der Ostküste). Daten erzeugt scripts/etappenorte.mjs; koord nur,
// wo die Offline-Karte den Ort nicht unter diesem Namen kennt.
export const ETAPPENORTE = [
  { id: 'perth', name: 'Perth', art: 'stadt', gegend: 'beide' },
  { id: 'margaret_river', name: 'Margaret River', art: 'stadt', gegend: 'sued' },
  { id: 'augusta', name: 'Augusta', art: 'stadt', gegend: 'sued' },
  { id: 'pemberton', name: 'Pemberton', art: 'stadt', gegend: 'sued' },
  { id: 'walpole', name: 'Walpole', art: 'stadt', gegend: 'sued' },
  { id: 'denmark', name: 'Denmark', art: 'stadt', gegend: 'sued' },
  { id: 'albany', name: 'Albany', art: 'stadt', gegend: 'sued' },
  { id: 'ravensthorpe', name: 'Ravensthorpe', art: 'stadt', gegend: 'sued' },
  { id: 'hopetoun', name: 'Hopetoun', art: 'stadt', gegend: 'sued' },
  { id: 'esperance', name: 'Esperance', art: 'stadt', gegend: 'sued' },
  { id: 'condingup', name: 'Condingup', art: 'stadt', gegend: 'sued' },
  { id: 'norseman', name: 'Norseman', art: 'stadt', gegend: 'sued' },
  { id: 'kalgoorlie', name: 'Kalgoorlie', art: 'stadt', gegend: 'sued' },
  { id: 'menzies', name: 'Menzies', art: 'stadt', gegend: 'sued' },
  { id: 'cervantes', name: 'Cervantes', art: 'stadt', gegend: 'nord' },
  { id: 'geraldton', name: 'Geraldton', art: 'stadt', gegend: 'nord' },
  { id: 'kalbarri', name: 'Kalbarri', art: 'stadt', gegend: 'nord' },
  { id: 'denham', name: 'Denham', art: 'stadt', gegend: 'nord' },
  { id: 'carnarvon', name: 'Carnarvon', art: 'stadt', gegend: 'nord' },
  { id: 'gascoyne_junction', name: 'Gascoyne Junction', art: 'stadt', gegend: 'nord' },
  { id: 'exmouth', name: 'Exmouth', art: 'stadt', gegend: 'nord' },
  { id: 'tom_price', name: 'Tom Price', art: 'stadt', gegend: 'nord' },
  { id: 'karratha', name: 'Karratha', art: 'stadt', gegend: 'nord' },
  { id: 'nanutarra', name: 'Nanutarra', art: 'roadhouse', gegend: 'nord', suche: 'Nanutarra Roadhouse', region: 'Ningaloo & Exmouth' },
  // Ostküste: Melbourne und Umgebung
  { id: 'melbourne', name: 'Melbourne', art: 'stadt', gegend: 'ost' },
  { id: 'kinglake', name: 'Kinglake', art: 'stadt', gegend: 'ost' },
  { id: 'whittlesea', name: 'Whittlesea', art: 'stadt', gegend: 'ost' },
  { id: 'yarra_glen', name: 'Yarra Glen', art: 'stadt', gegend: 'ost' },
  { id: 'healesville', name: 'Healesville', art: 'stadt', gegend: 'ost', region: 'Yarra Valley & Healesville' },
  { id: 'marysville', name: 'Marysville', art: 'stadt', gegend: 'ost', koord: [-37.5094, 145.7483] },
  { id: 'warburton', name: 'Warburton', art: 'stadt', gegend: 'ost', koord: [-37.7536, 145.6887] },   // nicht Warburton in WA
  { id: 'belgrave', name: 'Belgrave', art: 'stadt', gegend: 'ost', koord: [-37.9095, 145.354] },
  { id: 'cowes', name: 'Cowes', art: 'stadt', gegend: 'ost' },
  { id: 'sorrento', name: 'Sorrento', art: 'stadt', gegend: 'ost', koord: [-38.3392, 144.7417] },
  // Ostküste: Cairns und Umgebung
  { id: 'cairns', name: 'Cairns', art: 'stadt', gegend: 'ost' },
  { id: 'port_douglas', name: 'Port Douglas', art: 'stadt', gegend: 'ost' },
  { id: 'mossman', name: 'Mossman', art: 'stadt', gegend: 'ost' },
  { id: 'kuranda', name: 'Kuranda', art: 'stadt', gegend: 'ost' },
  { id: 'mareeba', name: 'Mareeba', art: 'stadt', gegend: 'ost' },
  { id: 'atherton', name: 'Atherton', art: 'stadt', gegend: 'ost' },
]

// Stopp (Name aus dem Google-Maps-Link der Route) → Ort mit Kachel oder Etappenort
export const STOPP = {
  'Perth': { etappe: 'perth' }, 'Margaret River': { etappe: 'margaret_river' }, 'Augusta': { etappe: 'augusta' },
  'Pemberton': { etappe: 'pemberton' }, 'Walpole': { etappe: 'walpole' }, 'Denmark': { etappe: 'denmark' },
  'Albany': { etappe: 'albany' }, 'Stirling Range National Park': { ort: 'bluff_knoll' }, 'Esperance': { etappe: 'esperance' },
  'Hopetoun': { etappe: 'hopetoun' }, 'Cape Arid National Park': { ort: 'cape_arid_national_park' }, 'Israelite Bay': { ort: 'israelite_bay' },
  'Norseman': { etappe: 'norseman' }, 'Kalgoorlie': { etappe: 'kalgoorlie' }, 'Menzies': { etappe: 'menzies' },
  'Lake Ballard': { ort: 'lake_ballard_inside_australia' }, 'Gwalia, Leonora': { ort: 'gwalia_ghost_town_hoover_house' },
  'Cervantes': { etappe: 'cervantes' }, 'Kalbarri': { etappe: 'kalbarri' }, 'Denham': { etappe: 'denham' },
  'Carnarvon': { etappe: 'carnarvon' }, 'Coral Bay': { ort: 'coral_bay' }, 'Exmouth': { etappe: 'exmouth' },
  'Steep Point': { ort: 'steep_point_edel_land' }, 'Quobba Station': { ort: 'red_bluff_quobba_station' }, 'Gnaraloo Station': { ort: 'gnaraloo_bay_3_mile_camp' },
  'Gascoyne Junction': { etappe: 'gascoyne_junction' }, 'Kennedy Range National Park': { ort: 'kennedy_range_np_temple_gorge' },
  'Mount Augustus': { ort: 'mount_augustus_burringurrah' }, 'Tom Price': { etappe: 'tom_price' }, 'Karijini National Park': { ort: 'karijini_np' },
  'Millstream Chichester National Park': { ort: 'millstream_chichester_np' }, 'Marble Bar': { ort: 'marble_bar_carawine_gorge' },
  'Karratha': { etappe: 'karratha' },
}

// Neue Orte, die die Routen nennen und die es noch nicht gibt: kommen nach Steves Freigabe in orte.json.
// Freigegeben und eingetragen: Super Pit Lookout, Hutt Lagoon, Carnarvon Space & Technology Museum.
export const NEU_ZUR_FREIGABE = []

// Tagesplan: je Tag (gleiche Reihenfolge wie steps) die Orte, die dieser Tag nennt
export const TAG = {
  'sued-route-sud-1-klassiker': [
    ['busselton_jetty', 'canal_rocks', 'sugarloaf_rock', 'injidup_natural_spa'],
    ['cape_leeuwin_lighthouse', 'jewel_cave', 'hamelin_bay', 'gloucester_tree'],
    ['valley_of_the_giants_tree_top_walk', 'circular_pool'],
    ['greens_pool', 'elephant_rocks', 'the_gap_and_natural_bridge'],
    ['castle_rock_granite_skywalk', 'bluff_knoll'],
    ['east_mount_barren', 'west_mount_barren', 'great_ocean_drive_esperance'],
    ['lucky_bay', 'frenchman_peak', 'hellfire_bay'],
  ],
  'sued-route-sud-2-erweitert-mit-4wd-highlights': [
    ['busselton_jetty', 'canal_rocks', 'sugarloaf_rock', 'injidup_natural_spa'],
    ['cape_leeuwin_lighthouse', 'jewel_cave', 'hamelin_bay', 'boranup_forest_drive'],
    ['gloucester_tree', 'dave_evans_bicentennial_tree', 'heartbreak_trail_heartbreak_crossing'],
    ['yeagarup_dunes', 'windy_harbour_salmon_beach'],
    ['valley_of_the_giants_tree_top_walk', 'circular_pool', 'peaceful_bay', 'mandalay_beach'],
    ['greens_pool', 'elephant_rocks', 'lights_beach', 'mount_shadforth_lookout'],
    ['the_gap_and_natural_bridge', 'little_beach_two_peoples_bay', 'golden_gate_dunsky_beach'],
    ['castle_rock_granite_skywalk', 'bluff_knoll'],
    ['east_mount_barren', 'west_mount_barren', 'point_ann'],
    ['great_ocean_drive_esperance', 'lucky_bay', 'frenchman_peak', 'hellfire_bay'],
    ['stokes_national_park', 'quagi_beach'],
    ['cape_arid_national_park', 'duke_of_orleans_bay_wharton_beach'],
  ],
  'sued-route-sud-3-expedition-nullarbor-grenzland': [
    ['cape_arid_national_park'],
    ['peak_charles_national_park'],
    ['israelite_bay'],
    ['israelite_bay'],
    ['nuytsland_nature_reserve_point_culver_baxter_cliffs'],
  ],
  'sued-ruckweg-option-goldfields-schleife': [
    ['super_pit_lookout'],
    ['lake_ballard_inside_australia', 'kookynie_niagara_dam'],
    ['gwalia_ghost_town_hoover_house'],
  ],
  'nord-route-nord-1-kusten-klassiker-mit-insider-camps': [
    ['lancelin_sand_dunes', 'the_pinnacles_nambung_np'],
    ['lesueur_np_mount_lesueur', 'stockyard_gully_tunnel', 'hutt_lagoon', 'kalbarri_np_murchison_station'],
    ['monkey_mia_herald_bight', 'francois_peron_np_voll_loop'],
    ['carnarvon_space_museum'],
    ['warroora_maggies_camp', 'coral_bay'],
    ['turquoise_bay_jurabi_turtle_centre', 'yardie_creek_track_coral_bay_cape_range'],
    [],
  ],
  'nord-route-nord-2-halbinsel-expedition-empfehlung': [
    ['the_pinnacles_nambung_np', 'lesueur_np_mount_lesueur', 'stockyard_gully_tunnel', 'kalbarri_np_murchison_station', 'houtman_abrolhos_islands'],
    ['steep_point_edel_land', 'zuytdorp_cliffs_thunder_bay'],
    ['dirk_hartog_island'],
    ['francois_peron_np_voll_loop', 'monkey_mia_herald_bight'],
    ['quobba_blowholes', 'red_bluff_quobba_station', 'gnaraloo_bay_3_mile_camp'],
    ['warroora_maggies_camp', 'coral_bay'],
    ['yardie_creek_track_coral_bay_cape_range', 'turquoise_bay_jurabi_turtle_centre'],
    ['charles_knife_canyon_shothole_canyon'],
    [],
  ],
  'nord-route-nord-3-outback-expedition-gascoyne-pilbara': [
    ['lesueur_np_mount_lesueur', 'stockyard_gully_tunnel', 'kalbarri_np_murchison_station', 'monkey_mia_herald_bight', 'francois_peron_np_voll_loop'],
    ['kennedy_range_np_temple_gorge'],
    ['mount_augustus_burringurrah', 'cattle_pool_goolinee_lyons_river'],
    [],
    ['karijini_np'],
    ['millstream_chichester_np'],
    [],
    ['turquoise_bay_jurabi_turtle_centre', 'coral_bay'],
    [],
    ['karijini_np', 'marble_bar_carawine_gorge', 'running_waters_eel_pool_oakover_river'],
  ],
}

/** Orte eines Tages, die es in der App gibt (neue erst nach der Freigabe) */
export function orteAmTag(routeId, i, orteNachId) {
  return (TAG[routeId]?.[i] || []).map((id) => orteNachId.get(id)).filter(Boolean)
}
