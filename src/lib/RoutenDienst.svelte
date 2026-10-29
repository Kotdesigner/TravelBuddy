<script>
  // Unsichtbar, einmal in App.svelte: hält Routen, Hinweise und Wetter aktuell,
  // egal welcher Bildschirm gerade offen ist.
  import { reisen, gesamtStart } from './userdata.js'
  import { online } from './netz.js'
  import { etappenMitDatum, ymd, plusTage } from './plan.js'
  import { autoRouten, hinweiseRechnen, autoWetter, reichweite } from './routen-dienst.js'

  let { orte = [] } = $props()

  // Auto-Routing (debounced; je Stopp-Stand nur ein Versuch → kein Hämmern bei Fehlern)
  let timer
  $effect(() => {
    const rs = $reisen, on = $online
    if (!rs.length) return
    clearTimeout(timer)
    timer = setTimeout(() => autoRouten(rs, on), 1200)
    return () => clearTimeout(timer)
  })

  // Tank-Lücken und Sehenswertes an der Route (offline)
  $effect(() => {
    const rs = $reisen, alle = orte
    $reichweite
    hinweiseRechnen(rs, alle)
  })

  // Wetter an der Strecke automatisch für die laufende Etappe (nur online)
  $effect(() => {
    if (!$online) return
    const heute = ymd(new Date())
    autoWetter($reisen, etappenMitDatum($reisen, $gesamtStart), heute, plusTage(heute, 3), orte)
  })
</script>
