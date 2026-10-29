<script>
  import { t } from './i18n.js'
  // „Bereit für unterwegs?“: prüft vor der Fahrt ins Funkloch, was offline auf diesem Gerät liegt.
  // Nur lesen: Karten-Cache (wie Karte.svelte), Offline-Speicher der App (Service Worker),
  // berechnete Routen, Spotify-Verbindung, letzte Sicherung.
  import { reisen, gesamtStart, syncZeiten } from './userdata.js'
  import { heuteTag } from './heute.js'
  import { online } from './netz.js'
  import { veraltet } from './routen-dienst.js'
  import { istVerbunden } from './musik/spotify.js'
  import { benoetigteKartenteile, benoetigtePoiDateien, routenStand, sicherungTage } from './offlinecheck.js'

  /** geh(pfad) aus App.svelte für die „Hin“-Knöpfe; onbackup() startet das Backup (optional). */
  let { geh = null, onbackup = null } = $props()

  const KARTEN_CACHE = 'karten-pmtiles-v2'
  let karten = $state(null)      // { da: [...], fehlen: [...] }
  let appStand = $state(null)    // { sw, pois: { da, fehlen } , kannCache }
  let prueft = $state(false)

  const teile = $derived(benoetigteKartenteile($reisen))
  const poiDateien = $derived(benoetigtePoiDateien($reisen))
  const routen = $derived(routenStand($reisen, $gesamtStart, $heuteTag, (r) => !veraltet(r)))
  const backupTage = $derived(sicherungTage($syncZeiten?.gesichert))
  let spotify = $state(istVerbunden())

  async function pruefe() {
    prueft = true
    spotify = istVerbunden()
    const kannCache = typeof caches !== 'undefined'
    if (!kannCache) {
      karten = { da: [], fehlen: teile }
      appStand = { sw: false, kannCache: false, da: [], fehlen: poiDateien }
      prueft = false
      return
    }
    try {
      const c = await caches.open(KARTEN_CACHE)
      const da = [], fehlen = []
      for (const t of teile) ((await c.match(location.origin + '/karten/' + t.datei)) ? da : fehlen).push(t)
      karten = { da, fehlen }
    } catch { karten = { da: [], fehlen: teile } }
    try {
      const da = [], fehlen = []
      for (const d of poiDateien) ((await caches.match('/' + d.datei, { ignoreSearch: true })) ? da : fehlen).push(d)
      const sw = !!navigator.serviceWorker?.controller
      appStand = { sw, kannCache, da, fehlen }
    } catch { appStand = { sw: false, kannCache, da: [], fehlen: poiDateien } }
    prueft = false
  }

  $effect(() => {
    teile; poiDateien; $online       // neu prüfen, wenn sich Reise oder Netz ändert
    pruefe()
  })
  $effect(() => {
    const sicht = () => { if (document.visibilityState === 'visible') pruefe() }
    document.addEventListener('visibilitychange', sicht)
    return () => document.removeEventListener('visibilitychange', sicht)
  })

  const routeZiel = (r) => (r.typ === 'route' ? (r.etappeId ? `plan/etappe/${r.etappeId}/${r.id}` : `plan/route/${r.id}`) : `plan/etappe/${r.id}`)
  const namen = (l) => (l.length <= 3 ? l.join(', ') : t('{a} und {n} weitere', { a: l.slice(0, 2).join(', '), n: l.length - 2 }))
  const vorText = (tage) => (tage === 0 ? t('heute') : tage === 1 ? t('gestern') : t('vor {n} Tagen', { n: tage }))

  const punkte = $derived([
    {
      id: 'karten', titel: t('Offline-Karten'),
      ok: !!karten && !karten.fehlen.length,
      stand: !karten ? t('wird geprüft …') : karten.fehlen.length
        ? t('{length} von {length2} Kartenteilen für deine Reise gespeichert. Es fehlt: {namen}.', { length: karten.da.length, length2: teile.length, namen: namen(karten.fehlen.map((t) => t.name)) })
        : t('Alle {length} Kartenteile für deine Reise sind gespeichert.', { length: teile.length }),
      tun: t('Mit WLAN unter Plan → Karte „Ganz Australien sichern“ tippen und warten, bis alles geladen ist.'),
      knopf: geh ? { text: t('Zur Karte'), ziel: 'plan/karte' } : null,
    },
    {
      id: 'app', titel: t('App und Versorgungspunkte offline'),
      ok: !!appStand && appStand.sw && !appStand.fehlen.length,
      stand: !appStand ? t('wird geprüft …') : !appStand.kannCache ? t('Dieser Browser bietet keinen Offline-Speicher.')
        : !appStand.sw ? t('Die App läuft gerade ohne Offline-Speicher.')
        : appStand.fehlen.length ? t('Tankstellen, Wasser und Co. fehlen für: {namen}.', { namen: namen(appStand.fehlen.map((d) => d.name)) })
        : t('App, Tankstellen, Wasserstellen und Camps liegen auf dem Gerät.'),
      tun: t('Die App mit Netz einmal öffnen und ein paar Sekunden warten, dann einmal neu starten. Auf dem iPhone immer vom Home-Bildschirm aus öffnen, Safari hat einen eigenen Speicher.'),
    },
    {
      id: 'routen', titel: t('Routen berechnet'),
      ok: routen.fertig === routen.gesamt,
      stand: !routen.gesamt ? t('Noch keine Auto-Strecken mit mindestens zwei Stopps geplant.')
        : routen.fehlen.length ? t('{fertig} von {gesamt} Strecken haben eine Straßenroute. Es fehlt: {namen}.', { fertig: routen.fertig, gesamt: routen.gesamt, namen: namen(routen.fehlen.map((r) => r.name || 'ohne Namen')) })
        : routen.gesamt === 1 ? t('Die geplante Strecke hat eine Straßenroute mit Tank-Lücken und Versorgung.') : t('Alle {gesamt} Strecken haben eine Straßenroute mit Tank-Lücken und Versorgung.', { gesamt: routen.gesamt }),
      tun: t('Solange Netz da ist, die Strecke öffnen. Die Route rechnet sich von selbst, sonst „Route berechnen“ tippen.'),
      knopf: geh && routen.fehlen.length ? { text: t('Strecke öffnen'), ziel: routeZiel(routen.fehlen[0]) } : null,
    },
    {
      id: 'spotify', titel: t('Spotify verbunden'),
      ok: spotify,
      stand: spotify ? t('Musik unterwegs kann Titel in deine Playlist schreiben.') : t('Nicht verbunden. Titel aus der Gegend werden dann nur vorgemerkt.'),
      tun: t('Mit Netz unter Mehr → Musik „Mit Spotify verbinden“ tippen. Gespeicherte Playlists in der Spotify-App vorher für offline laden.'),
      knopf: geh ? { text: t('Zur Musik'), ziel: 'mehr/musik' } : null,
    },
    {
      id: 'backup', titel: t('Letzte Sicherung'),
      ok: backupTage != null && backupTage <= 7,
      stand: backupTage == null ? t('Von diesem Gerät gibt es noch keine Sicherung.') : t('Zuletzt gesichert {vorText}.', { vorText: vorText(backupTage) }),
      tun: t('Backup tippen und die Datei per AirDrop auf den Mac oder in iCloud legen. Unterwegs etwa einmal pro Woche.'),
      aktion: onbackup ? { text: t('💾 Backup jetzt'), tu: onbackup } : null,
    },
  ])
  const bereit = $derived(punkte.filter((x) => x.ok).length)
</script>

<section class="oc" aria-labelledby="oc-titel">
  <div class="oc-kopf">
    <div>
      <h2 class="oc-titel" id="oc-titel">{t('Bereit für unterwegs?')}</h2>
      <p class="oc-summe">{t('{bereit} von {length} Punkten erledigt', { bereit, length: punkte.length })}{#if !$online} {t('· gerade offline')}{/if}</p>
    </div>
    <button class="btn oc-neu" onclick={pruefe} disabled={prueft}>{prueft ? t('prüft …') : t('↻ Neu prüfen')}</button>
  </div>
  <ul class="oc-liste">
    {#each punkte as x (x.id)}
      <li class="oc-punkt" class:ok={x.ok}>
        <span class="oc-ampel" aria-hidden="true">{x.ok ? '✓' : '!'}</span>
        <div class="oc-txt">
          <b>{x.titel}<span class="sr">: {x.ok ? t('erledigt') : t('noch offen')}</span></b>
          <span class="oc-stand">{x.stand}</span>
          {#if !x.ok}
            <span class="oc-tun"><b>{t('Was tun:')}</b> {x.tun}</span>
            {#if x.knopf || x.aktion}
              <span class="oc-knoepfe">
                {#if x.knopf}<button class="btn" onclick={() => geh(x.knopf.ziel)}>{x.knopf.text}</button>{/if}
                {#if x.aktion}<button class="btn" onclick={x.aktion.tu}>{x.aktion.text}</button>{/if}
              </span>
            {/if}
          {/if}
        </div>
      </li>
    {/each}
  </ul>
</section>

<style>
  .oc { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-m); box-shadow: var(--shadow); padding: 14px; display: flex; flex-direction: column; gap: 10px; }
  .oc-kopf { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .oc-titel { margin: 0; font-size: calc(17px * var(--schrift, 1)); text-wrap: balance; }
  .oc-summe { margin: 2px 0 0; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .oc-neu { flex: none; }
  .oc-neu:disabled { opacity: 0.55; cursor: default; }
  .oc-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .oc-punkt { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--warn); background: var(--warn-flaeche); }
  .oc-punkt.ok { border-color: var(--ok-linie); background: var(--ok-flaeche); }
  .oc-ampel { flex: none; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: calc(14px * var(--schrift, 1)); font-weight: 900; background: var(--warn); color: #2b2621; }
  .oc-punkt.ok .oc-ampel { background: var(--ok); color: #fff; }
  .oc-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .oc-txt > b { font-size: calc(14.5px * var(--schrift, 1)); color: var(--ink); }
  .oc-stand { font-size: calc(13px * var(--schrift, 1)); color: var(--ink); line-height: 1.45; }
  .oc-punkt.ok .oc-stand { color: var(--ok-text); }
  .oc-tun { font-size: calc(13px * var(--schrift, 1)); color: var(--warn-text); line-height: 1.45; }
  .oc-knoepfe { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
