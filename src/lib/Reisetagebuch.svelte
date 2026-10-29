<script>
  import { t, tn } from './i18n.js'
  import { journal, neuerJournalEintrag, reisen } from './userdata.js'
  import { spracheVerfuegbar } from './voice.js'
  import JournalEintrag from './JournalEintrag.svelte'
  import TagebuchLese from './TagebuchLese.svelte'

  let { orte = [], warnungen = [], umkreisKm = 150 } = $props()

  let modus = $state('bearbeiten') // 'bearbeiten' | 'lesen'

  // Neueste zuerst — man scrollt also von heute rückwärts in die Historie.
  // Was gerade angelegt wurde, bleibt aber OBEN, egal welches Datum draufsteht:
  // sonst rutscht ein frischer Tag unter die Reisetage im Dezember und man sucht ihn.
  // Bewusst an die Sitzung gebunden (kein Feld in den Daten) und nicht an „ist leer" —
  // sonst würde der Eintrag beim ersten getippten Buchstaben wegspringen.
  let frisch = $state(new Set())
  const sortiert = $derived(
    [...$journal].sort((a, b) => {
      const fa = frisch.has(a.id), fb = frisch.has(b.id)
      if (fa !== fb) return fa ? -1 : 1
      return (b.datum || '').localeCompare(a.datum || '')
    })
  )

  let listeEl = $state()
  function neuerTag() {
    const id = neuerJournalEintrag()
    frisch = new Set([...frisch, id])
    // Der neue Tag steht jetzt ganz oben — dorthin scrollen, sonst sucht man ihn.
    setTimeout(() => listeEl?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }
</script>

<div class="kopf">
  <div class="umschalter" role="group" aria-label={t('Ansicht des Logbuchs')}>
    <button class="u-btn" class:an={modus === 'bearbeiten'} aria-pressed={modus === 'bearbeiten'} onclick={() => (modus = 'bearbeiten')}>{t('✏️ Bearbeiten')}</button>
    <button class="u-btn" class:an={modus === 'lesen'} aria-pressed={modus === 'lesen'} onclick={() => (modus = 'lesen')}>{t('📖 Lesen')}</button>
  </div>
  {#if modus === 'bearbeiten'}
    <button class="btn neu" onclick={neuerTag}>{t('+ Neuer Tag')}</button>
  {:else if $journal.length}
    <span class="lese-hinweis">{tn($journal.length, '📖 {n} Reisetag zum Zurücklehnen', '📖 {n} Reisetage zum Zurücklehnen')}</span>
  {/if}
</div>

{#if modus === 'lesen'}
  <TagebuchLese {orte} reisen={$reisen} />
{:else}
  <p class="intro">{t('Dein Roadtrip-Logbuch — pro Tag ein Eintrag. Fülle nur die Module aus, zu denen du an dem Tag etwas erlebt hast.')}{#if spracheVerfuegbar()} {t('🎙️ = einsprechen.')}{/if} {t('Fertig? Wechsle auf')} <b>{t('📖 Lesen')}</b>.</p>
  {#if $journal.length === 0}
    <p class="leer">{t('Noch kein Eintrag. „+ Neuer Tag" legt einen an — mit Datum, Ort, Quick-Stats und aufklappbaren Themen-Modulen (Sinneseindrücke, Wildlife, Vanlife, Nachthimmel …).')}</p>
  {:else}
    <div class="liste" bind:this={listeEl}>
      {#each sortiert as e (e.id)}
        <JournalEintrag eintrag={e} {orte} reisen={$reisen} {warnungen} {umkreisKm} neuAngelegt={frisch.has(e.id)} />
      {/each}
    </div>
  {/if}
{/if}

<style>
  .kopf { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
  .umschalter { display: inline-flex; background: var(--flaeche-2); border: 1px solid var(--line); border-radius: 22px; padding: 3px; }
  .u-btn {
    font-size: calc(13px * var(--schrift, 1)); font-weight: 700; padding: 7px 16px; border: none; background: none;
    color: var(--muted); border-radius: 20px; cursor: pointer;
  }
  .u-btn.an { background: var(--card); color: var(--brand-text); box-shadow: var(--shadow); }
  .lese-hinweis { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); font-weight: 600; }
  .intro { color: var(--muted); font-size: calc(13.5px * var(--schrift, 1)); margin: 0 0 14px; }
  .btn { font-size: calc(13px * var(--schrift, 1)); font-weight: 700; padding: 8px 14px; border: 1px solid var(--line-stark); background: var(--btn-flaeche); color: var(--btn-ink); border-radius: 8px; cursor: pointer; }
  .neu { background: #2f7a63; color: #fff; border-color: #2f7a63; }
  .liste { scroll-margin-top: max(48px, calc(env(safe-area-inset-top, 0px) + 16px)); }
  .leer { color: var(--muted); font-size: calc(13.5px * var(--schrift, 1)); background: var(--flaeche); padding: 16px; border-radius: 10px; }
</style>
