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
  import { t, je } from './i18n.js'
  // Die Belege eines Termins als Knöpfe: tippen öffnet sie (vom Gerät oder aus dem Build).
  // Dieselbe Darstellung in Vorbereitung, Etappe, Tag, Logbuch und Kalender.
  import { dokumentUrl, belegDa } from './reisekalender.js'
  import { lokaleBelege, oeffneBeleg, loescheBeleg, dateiName } from './belege.js'
  import { belegAbnehmen, belegHaengtWoanders } from './userdata.js'
  import { loeschFrage } from './dialog.js'
  import { zeigeToast } from './toast.js'

  // `ziele`: die Termine dieser Buchung. Ohne sie ginge ein Beleg von jedem Termin ab, an dem
  // dieselbe Datei hängt, und nicht nur von der Buchung, die man gerade vor sich hat.
  let { docs = [], entfernbar = false, klein = false, ziele = null } = $props()
  ladeEinmal()

  const istLokal = (pfad) => $lokaleBelege.has((pfad || '').normalize('NFC'))
  // Selbst zugeordnete Belege gibt es nie im Build, nur auf dem Gerät.
  const imBuild = (d) => !d.eigen && !!$verzeichnis && belegDa($verzeichnis, d.datei)

  // Nicht async: iOS lässt das neue Fenster nur direkt im Fingertipp zu (siehe belege.js).
  function oeffnen(pfad) {
    oeffneBeleg(pfad).then((ok) => { if (!ok) zeigeToast(t('Dieser Beleg liegt nicht auf dem Gerät.')) })
  }
  async function entfernen(d) {
    // Die Rückfrage soll die Wahrheit sagen: hängt die Datei noch an einer anderen Buchung,
    // bleibt sie auf dem Gerät, und dann darf hier nichts anderes stehen.
    const woanders = belegHaengtWoanders(d.datei, ziele)
    const text = d.eigen
      ? (woanders
        ? je('Der Beleg geht von diesem Termin ab. Die Datei bleibt auf dem Gerät, weil sie noch an einer anderen Buchung hängt.',
          'The document is detached from this booking. The file stays on the device because another booking still uses it.')
        : t('Die Datei verschwindet von diesem Gerät und vom Termin. Der Termin selbst bleibt.'))
      : (woanders
        ? je('Der Beleg geht von dieser Buchung ab und kommt beim nächsten Import des Reisekalenders nicht zurück. Die Datei bleibt auf dem Gerät, weil sie noch an einer anderen Buchung hängt.',
          'The document is detached from this booking and will not come back on the next calendar import. The file stays on the device because another booking still uses it.')
        : je('Der Beleg geht von dieser Buchung ab und die Datei verschwindet von diesem Gerät. Beim nächsten Import des Reisekalenders kommt er nicht zurück.',
          'The document is detached from this booking and the file is removed from this device. It will not come back on the next calendar import.'))
    if (!(await loeschFrage(t('Beleg „{label}“', { label: d.label }), text))) return
    // Hängt dieselbe Datei noch an einer anderen Buchung, bleibt sie auf dem Gerät.
    const { nochInBenutzung } = belegAbnehmen(d.datei, ziele) || {}
    if (!nochInBenutzung) { try { await loescheBeleg(d.datei) } catch {} }
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
        {#if entfernbar}
          <button class="bk-x" onclick={() => entfernen(d)} aria-label={t('Beleg „{label}“ entfernen', { label: d.label })}>✕</button>
        {/if}
      </span>
    {/each}
  </span>
{/if}

<style>
  .bk-liste { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .bk-paar { display: inline-flex; align-items: center; gap: 1px; max-width: 100%; }
  .bk {
    font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--info-text); background: var(--info-flaeche);
    border: 1px solid var(--info-linie); border-radius: 6px; padding: 5px 9px; min-height: 30px; display: inline-flex; align-items: center;
    text-decoration: none; font-family: inherit; line-height: 1.25; text-align: left; max-width: 100%;
    overflow-wrap: anywhere;
  }
  .bk.lokal { cursor: pointer; background: var(--ok-flaeche); border-color: var(--ok-linie); color: var(--ok-text); }
  .bk.fehlt { background: none; border: 1px dashed var(--line-stark); color: var(--muted); font-weight: 500; }
  .bk-x { width: 30px; height: 30px; border: none; background: none; color: var(--danger-text); font-size: calc(13px * var(--schrift, 1)); cursor: pointer; border-radius: 50%; flex: none; }
  .klein .bk { font-size: calc(12px * var(--schrift, 1)); padding: 3px 7px; min-height: 24px; }
</style>
