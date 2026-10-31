<script>
  // Flug- oder Zugangaben an einer Route oder Vorabausgabe. Die merken sich nur, zu welchem Termin sie gehören.
  import { t } from './i18n.js'
  import { buchungen } from './userdata.js'
  import { verkehrOk } from './flug.js'
  import { speichereVerkehr, angabenAus, leereAngaben } from './verkehr.js'
  import { zeigeToast } from './toast.js'
  import VerkehrFormular from './VerkehrFormular.svelte'
  import BelegKnoepfe from './BelegKnoepfe.svelte'

  let { art = 'flug', terminId = null, titel = '', nr = '', onverknuepft = () => {} } = $props()
  const termin = $derived(($buchungen?.events || []).find((e) => e.id === terminId) || null)
  let angaben = $state(angabenAus(null))
  let datei = $state(null)
  let offen = $state(false)
  function auf() { angaben = termin ? angabenAus(termin) : leereAngaben({ nr }); datei = null; offen = true }
  async function sichern() {
    const id = await speichereVerkehr(art, angaben, { id: terminId, titel, datei })
    if (id !== terminId) onverknuepft(id)
    offen = false
    zeigeToast(art === 'flug' ? t('Flug gespeichert ✓') : t('Zug gespeichert ✓'), 'ok')
  }
</script>

<div class="vb">
  {#if offen}
    <VerkehrFormular {art} bind:angaben bind:datei />
    <div class="vb-knoepfe">
      <button class="btn-primary" disabled={!verkehrOk(art, angaben)} onclick={sichern}>{t('Speichern')}</button>
      <button class="btn" onclick={() => (offen = false)}>{t('Abbrechen')}</button>
    </div>
  {:else if termin}
    <p>{termin.flugNr || termin.zugNr}{#if termin.ref}&nbsp;· {termin.ref}{/if}{#if termin.sitz}&nbsp;· {termin.sitz}{/if}</p>
    {#if termin.docs?.length}<BelegKnoepfe docs={termin.docs} klein />{/if}
    <button class="vb-leise" onclick={auf}>{t('Angaben ändern')}</button>
  {:else}
    <button class="vb-leise" onclick={auf}>{art === 'flug' ? t('Flugdaten eintragen') : t('Zugdaten eintragen')}</button>
  {/if}
</div>

<style>
  .vb { display: flex; flex-direction: column; gap: 8px; }
  .vb p { margin: 0; font-size: calc(14px * var(--schrift, 1)); font-weight: 700; }
  .vb-knoepfe { display: flex; gap: 8px; }
  .vb-leise { align-self: flex-start; min-height: 36px; padding: 0; border: none; background: none; color: var(--brand-text); font-size: calc(13.5px * var(--schrift, 1)); font-weight: 700; cursor: pointer; }
</style>
