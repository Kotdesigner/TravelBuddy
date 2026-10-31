// Warnlage als Stores: alles, was Heute, Gefahrenlage, Plan, Wanderungen und Karte gemeinsam brauchen.
// App.svelte liefert die geladenen Warnungen und den Umkreis, der Rest ergibt sich daraus.
import { writable, derived } from 'svelte/store'
import { reisen, gesamtStart, wanderungen } from './userdata.js'
import { etappenMitDatum } from './plan.js'
import { standort } from './standort.js'
import { heuteTag } from './heute.js'
import { warnlage, probeWarnung } from './warnlage.js'

const KEY_TEST = 'tb-warn-test'
export const TEST_AUS = { aktiv: false, lat: null, lon: null, name: '', probe: '' }

/** { liste, zeit: ms|null } */
export const warnDaten = writable({ liste: [], zeit: null })
export const warnUmkreis = writable(150)

function testLesen() { try { return { ...TEST_AUS, ...JSON.parse(localStorage.getItem(KEY_TEST) || '{}') } } catch { return TEST_AUS } }
/** Testmodus: fester Standort und eine Probe-Warnung, ganz ohne neuen Code. Bleibt, bis man ihn ausschaltet. */
export const testmodus = writable(testLesen())
testmodus.subscribe((v) => { try { localStorage.setItem(KEY_TEST, JSON.stringify(v)) } catch {} })

/** Der Standort für alle Warnungen: im Testmodus der gewählte, sonst das GPS. */
export const meinePosition = derived([standort, testmodus], ([$s, $t]) => {
  if ($t.aktiv && $t.lat != null) return { lat: $t.lat, lon: $t.lon, name: $t.name, test: true }
  return $s ? { ...$s, test: false } : null
})

/** Geladene Warnungen, im Testmodus dazu die Probe-Warnung. */
export const warnListe = derived([warnDaten, testmodus, meinePosition, reisen], ([$d, $t, $p, $r]) => {
  const probe = $t.aktiv && $t.probe ? probeWarnung($t.probe, $p, $r) : null
  return probe ? [probe, ...$d.liste] : $d.liste
})

export const lage = derived([warnListe, meinePosition, reisen, gesamtStart, wanderungen, warnUmkreis, heuteTag],
  ([$w, $p, $r, $g, $wa, $u, $h]) => warnlage({ warnungen: $w, standort: $p, reisen: $r, eintraege: etappenMitDatum($r, $g), wanderungen: $wa, umkreisKm: $u, heute: $h }))
