<script>
  // Hinweis oben, solange Einträge nicht gesichert werden konnten (meist: Speicher voll).
  // Bleibt stehen, bis das Speichern wieder klappt. Ein Toast wäre nach Sekunden weg.
  import { speicherProblem, nochmalSpeichern } from './userdata.js'
  import { t } from './i18n.js'
  import { zeigeToast } from './toast.js'

  let { onBackup } = $props()
  let laeuft = $state(false)

  async function nochmal() {
    laeuft = true
    try {
      const ok = await nochmalSpeichern()
      zeigeToast(ok ? t('Gesichert ✓ Alles ist wieder gespeichert.') : t('Klappt noch nicht. Es ist weiter kein Platz frei.'), ok ? 'ok' : 'fehler')
    } finally { laeuft = false }
  }
</script>

{#if $speicherProblem}
  <div class="sh" role="alert">
    <p class="sh-text">
      <b>{$speicherProblem.voll ? t('Speicher voll: Neues wird nicht gesichert') : t('Speichern klappt gerade nicht')}</b>
      <span>{t('Was du jetzt einträgst, ist nach dem Schließen der App weg. Sichere ein Backup und schaffe Platz, zum Beispiel durch Löschen von Fotos oder Offline-Karten.')}</span>
    </p>
    <div class="sh-knoepfe">
      <button class="btn btn-primary" onclick={() => onBackup?.()}>{t('💾 Backup sichern')}</button>
      <button class="btn" onclick={nochmal} disabled={laeuft}>{laeuft ? t('Speichere …') : t('Erneut speichern')}</button>
    </div>
  </div>
{/if}

<style>
  .sh {
    display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px;
    margin: 0 0 14px; padding: 12px 14px; border-radius: 14px;
    background: var(--danger-flaeche); border: 1px solid var(--danger-linie); color: var(--danger-text);
  }
  .sh-text { margin: 0; flex: 1 1 260px; display: flex; flex-direction: column; gap: 3px; font-size: calc(14px * var(--schrift, 1)); line-height: 1.4; }
  .sh-text b { font-size: calc(15px * var(--schrift, 1)); }
  .sh-knoepfe { display: flex; flex-wrap: wrap; gap: 8px; }
  .sh-knoepfe .btn { min-height: 44px; }
</style>
