<script>
  import { t } from './i18n.js'
  // Entsperren vor dem Öffnen eines Belegs (tresor.js). Face ID oder Touch ID startet schon beim
  // Antippen des Belegs; hier steht, was gerade passiert, danach der Knopf „Beleg öffnen“.
  // Klappt es nicht: nochmal oder mit dem Notfall-Code.
  import { onMount } from 'svelte'
  import { modal } from './modal.js'
  import { tresorAnfrage, starteFaceId, codeEingeben, weiter, abbrechen, ladeTresor, bioName } from './tresor.js'

  const a = $derived($tresorAnfrage)
  const bio = bioName()
  let code = $state('')
  let prueft = $state(false)
  onMount(() => { ladeTresor() })
  $effect(() => { if (!a) { code = ''; prueft = false } })

  async function mitCode(e) {
    e.preventDefault()
    if (prueft || !code.trim()) return
    prueft = true
    const ok = await codeEingeben(code)
    prueft = false
    if (ok) code = ''
  }
</script>

{#if a}
  <div class="td-hg" data-dialog-hg onclick={abbrechen} aria-hidden="true"></div>
  <div class="td" role="dialog" aria-labelledby="td-titel" use:modal={{ onclose: abbrechen, fokus: a.zustand === 'bereit' ? '.td-ja' : a.zustand === 'code' ? 'input' : null }}>
    <h2 id="td-titel"><span aria-hidden="true">{a.zustand === 'bereit' ? '🔓' : '🔒'}</span> {a.zustand === 'bereit' ? t('Entsperrt') : t('Belege sind geschützt')}</h2>

    {#if a.zustand === 'passkey'}
      <p aria-live="polite">{t('Bestätige mit {bio} …', { bio })}</p>
      <div class="td-knoepfe einzeln"><button class="td-nein" onclick={abbrechen}>{t('Abbrechen')}</button></div>

    {:else if a.zustand === 'bereit'}
      <p>{t('Für fünf Minuten bleiben deine Belege offen.')}</p>
      <div class="td-knoepfe">
        <button class="td-nein" onclick={abbrechen}>{t('Abbrechen')}</button>
        <button class="td-ja" onclick={weiter}>{a.knopf}</button>
      </div>

    {:else if a.zustand === 'wahl'}
      {#if a.fehler}<p class="td-fehler" role="alert">{a.fehler}</p>{:else}<p>{t('{bio} hat nicht geklappt.', { bio })}</p>{/if}
      <div class="td-knoepfe">
        <button class="td-nein" onclick={() => tresorAnfrage.update((x) => x && { ...x, zustand: 'code', fehler: '' })}>{t('Notfall-Code')}</button>
        <button class="td-ja" onclick={starteFaceId}>{t('Nochmal mit {bio}', { bio })}</button>
      </div>

    {:else}
      <form onsubmit={mitCode}>
        <label class="td-feld">{t('Notfall-Code')}
          <input bind:value={code} autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" />
        </label>
        {#if a.fehler}<p class="td-fehler" role="alert">{a.fehler}</p>{/if}
        <div class="td-knoepfe">
          <button type="button" class="td-nein" onclick={abbrechen}>{t('Abbrechen')}</button>
          <button type="submit" class="td-ja" disabled={prueft || !code.trim()}>{prueft ? t('Prüfe …') : t('Entsperren')}</button>
        </div>
      </form>
    {/if}
  </div>
{/if}

<style>
  .td-hg { position: fixed; inset: 0; background: rgba(20, 14, 8, 0.42); z-index: 150; }
  .td {
    position: fixed; z-index: 151; left: 50%; top: 50%; transform: translate(-50%, -50%);
    width: min(360px, calc(100vw - 40px)); background: var(--card); color: var(--ink);
    border-radius: var(--radius-l); box-shadow: var(--shadow-float); padding: 22px 20px 16px;
  }
  h2 { margin: 0 0 6px; font-size: calc(18px * var(--schrift, 1)); line-height: 1.3; }
  p { margin: 0 0 16px; font-size: calc(15px * var(--schrift, 1)); color: var(--muted); }
  .td-fehler { color: var(--danger); font-weight: 600; }
  .td-feld { display: flex; flex-direction: column; gap: 6px; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--muted); margin-bottom: 12px; }
  .td-feld input {
    min-height: 48px; font-size: max(16px, calc(18px * var(--schrift, 1))); letter-spacing: 1px; font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    padding: 6px 12px; border: 1px solid var(--line-stark); border-radius: var(--radius-s); background: var(--eingabe); color: var(--ink);
  }
  .td-knoepfe { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .td-knoepfe.einzeln { grid-template-columns: 1fr; }
  .td-knoepfe button { min-height: 48px; border-radius: var(--radius-m); font-size: calc(16px * var(--schrift, 1)); font-weight: 700; cursor: pointer; }
  .td-nein { background: var(--flaeche-2); color: var(--ink); border: 1px solid var(--line); }
  .td-ja { background: var(--brand); color: #fff; border: none; }
  .td-ja:disabled { opacity: 0.5; cursor: default; }
</style>
