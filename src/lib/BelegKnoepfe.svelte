<script module>
  // Einmal je Sitzung: welche Belege der Build mitbringt und welche auf dem Gerät liegen.
  // Ohne das stünde in Plan, Tag und Logbuch jeder Beleg als „fehlt“ da, solange man
  // nicht vorher unter Vorbereitung war.
  import { writable } from 'svelte/store'
  import { ladeBelegVerzeichnis } from './reisekalender.js'
  import { ladeBelegListe } from './belege.js'
  const verzeichnis = writable(null)
  let geladen = false
  function ladeEinmal() {
    if (geladen || typeof window === 'undefined') return
    geladen = true
    ladeBelegVerzeichnis().then((v) => verzeichnis.set(v))
    ladeBelegListe()
  }
</script>

<script>
  import { t } from './i18n.js'
  // Die Belege eines Termins als Knöpfe: tippen öffnet sie (vom Gerät oder aus dem Build).
  // Dieselbe Darstellung in Vorbereitung, Etappe, Tag, Logbuch und Kalender.
  import { dokumentUrl, belegDa } from './reisekalender.js'
  import { lokaleBelege, oeffneBeleg, loescheBeleg, dateiName } from './belege.js'
  import { belegAbnehmen } from './userdata.js'
  import { loeschFrage } from './dialog.js'
  import { zeigeToast } from './toast.js'

  let { docs = [], entfernbar = false, klein = false } = $props()
  ladeEinmal()

  const istLokal = (pfad) => $lokaleBelege.has((pfad || '').normalize('NFC'))
  // Selbst zugeordnete Belege gibt es nie im Build, nur auf dem Gerät.
  const imBuild = (d) => !d.eigen && !!$verzeichnis && belegDa($verzeichnis, d.datei)

  // Nicht async: iOS lässt das neue Fenster nur direkt im Fingertipp zu (siehe belege.js).
  function oeffnen(pfad) {
    oeffneBeleg(pfad).then((ok) => { if (!ok) zeigeToast(t('Dieser Beleg liegt nicht auf dem Gerät.')) })
  }
  async function entfernen(d) {
    if (!(await loeschFrage(t('Beleg „{label}“', { label: d.label }), t('Die Datei verschwindet von diesem Gerät und vom Termin. Der Termin selbst bleibt.')))) return
    belegAbnehmen(d.datei)
    try { await loescheBeleg(d.datei) } catch {}
  }
</script>

{#if docs?.length}
  <span class="bk-liste" class:klein>
    {#each docs as d, i (d.datei + i)}
      <span class="bk-paar">
        {#if istLokal(d.datei)}
          <button class="bk lokal" onclick={() => oeffnen(d.datei)} title={t('{belegName}, auf diesem Gerät', { belegName: dateiName(d.datei) })}>📎 {d.label}</button>
        {:else if imBuild(d)}
          <a class="bk" href={dokumentUrl(d.datei)} target="_blank" rel="noopener" title={d.datei}>📎 {d.label}</a>
        {:else}
          <span class="bk fehlt" title={t('{belegName}, noch nicht geladen', { belegName: dateiName(d.datei) })}>{t('📎 {label} · fehlt', { label: d.label })}</span>
        {/if}
        {#if entfernbar && d.eigen}
          <button class="bk-x" onclick={() => entfernen(d)} aria-label={t('Beleg „{label}“ entfernen', { label: d.label })}>✕</button>
        {/if}
      </span>
    {/each}
  </span>
{/if}

<style>
  .bk-liste { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 4px; }
  .bk-paar { display: inline-flex; align-items: center; gap: 1px; max-width: 100%; }
  .bk {
    font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--info-text); background: var(--info-flaeche);
    border: 1px solid var(--info-linie); border-radius: 6px; padding: 5px 9px; min-height: 30px; display: inline-flex; align-items: center;
    text-decoration: none; font-family: inherit; line-height: 1.25; text-align: left; max-width: 100%;
    overflow-wrap: anywhere;
  }
  .bk.lokal { cursor: pointer; background: var(--ok-flaeche); border-color: var(--ok-linie); color: var(--ok-text); }
  .bk.fehlt { background: var(--flaeche-2); border-color: var(--line); color: var(--muted); font-weight: 600; }
  .bk-x { width: 30px; height: 30px; border: none; background: none; color: var(--danger-text); font-size: calc(13px * var(--schrift, 1)); cursor: pointer; border-radius: 50%; flex: none; }
  .klein .bk { font-size: calc(12px * var(--schrift, 1)); padding: 3px 7px; min-height: 24px; }
</style>
