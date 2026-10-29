<script>
  import { t } from './i18n.js'
  // Modul „Tiere gesehen“ im Logbuch-Eintrag: Sichtungen des Tages, neu eintragen, löschen.
  // Gespeichert als eintrag.sichtungen über updateJournalEintrag (Backup läuft mit).
  import { get } from 'svelte/store'
  import { journal, updateJournalEintrag, merkeGeloescht } from './userdata.js'
  import { artVon, mitSichtung, ohneSichtung } from './tierwelt.js'
  import { loeschFrage } from './dialog.js'
  import { geh } from './navigation.js'
  import { dauer, klapp } from './motion.js'
  import SichtungFormular from './SichtungFormular.svelte'

  let { eintrag, orte = [] } = $props()

  const uid = Math.random().toString(36).slice(2, 8)
  let formOffen = $state(false)
  const liste = $derived(Array.isArray(eintrag.sichtungen) ? eintrag.sichtungen : [])

  const aktuell = () => get(journal).find((j) => j.id === eintrag.id) || eintrag
  function speichern(s) {
    updateJournalEintrag(eintrag.id, { sichtungen: mitSichtung(aktuell().sichtungen, s) })
    formOffen = false
  }
  async function entfernen(s) {
    if (!(await loeschFrage(t('Die Sichtung „{name}“', { name: artVon(s).name }), t('Notiz und Foto dieser Sichtung gehen mit.')))) return
    updateJournalEintrag(eintrag.id, { sichtungen: ohneSichtung(aktuell().sichtungen, s.id) })
    merkeGeloescht('sichtungen', s.id)
  }
</script>

<section class="tg" aria-labelledby="tg-t-{uid}">
  <div class="tg-kopf">
    <h4 id="tg-t-{uid}"><span aria-hidden="true">🦘</span> {t('Tiere gesehen')}{#if liste.length}<span class="tg-zahl">{liste.length}</span>{/if}</h4>
    <button type="button" class="tg-album" onclick={() => geh('logbuch/tiere')}>{t('Album')}</button>
  </div>

  {#if liste.length}
    <ul class="tg-liste">
      {#each liste as s (s.id)}
        {@const a = artVon(s)}
        <li class="tg-s">
          {#if s.foto}<img src={s.foto} alt={t('Foto: {name}', { name: a.name })} />{:else}<span class="tg-emoji" aria-hidden="true">{a.emoji}</span>{/if}
          <span class="tg-txt">
            <b>{a.name}{#if (s.anzahl || 1) > 1}&nbsp;× {s.anzahl}{/if}</b>
            {#if s.ort || s.lat != null}<small>{s.ort || ''}{#if s.lat != null}{s.ort ? ' ' : ''}📍{/if}</small>{/if}
            {#if s.notiz}<small class="tg-notiz">{s.notiz}</small>{/if}
          </span>
          <button type="button" class="tg-weg" onclick={() => entfernen(s)} aria-label={t('Sichtung {name} löschen', { name: a.name })}>✕</button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if formOffen}
    <div transition:klapp={{ duration: dauer(220) }}>
      <SichtungFormular ort={eintrag.ort || ''} lat={null} lon={null} {orte} onspeichern={speichern} onabbrechen={() => (formOffen = false)} />
    </div>
  {:else}
    <button type="button" class="tg-neu" onclick={() => (formOffen = true)}>{t('+ Tier eintragen')}</button>
  {/if}
</section>

<style>
  .tg { margin-top: 10px; border: 1px solid var(--line); border-radius: 8px; padding: 8px 11px 10px; display: flex; flex-direction: column; gap: 8px; }
  .tg-kopf { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .tg-kopf h4 { margin: 0; font-size: calc(13.5px * var(--schrift, 1)); display: flex; align-items: center; gap: 6px; }
  .tg-zahl { background: var(--brand-2); color: #1f1408; font-size: calc(12px * var(--schrift, 1)); font-weight: 800; padding: 1px 7px; border-radius: 9px; }
  .tg-album { min-height: 44px; padding: 0 8px; background: none; border: none; color: var(--brand-text); font-weight: 700; font-size: calc(13px * var(--schrift, 1)); cursor: pointer; }
  .tg-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .tg-s { display: flex; align-items: center; gap: 10px; }
  .tg-s img, .tg-emoji { width: 44px; height: 44px; border-radius: 8px; object-fit: cover; flex: none; }
  .tg-emoji { display: grid; place-items: center; font-size: calc(24px * var(--schrift, 1)); background: var(--flaeche); }
  .tg-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.3; font-size: calc(14px * var(--schrift, 1)); }
  .tg-txt small { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); }
  .tg-notiz { white-space: pre-line; }
  .tg-weg { width: 44px; height: 44px; flex: none; border: none; background: none; color: var(--danger-text); font-size: calc(14px * var(--schrift, 1)); cursor: pointer; border-radius: 10px; }
  .tg-neu { align-self: flex-start; min-height: 44px; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--btn-ink); background: var(--btn-flaeche); border: 1px solid var(--line-stark); border-radius: 22px; padding: 0 14px; cursor: pointer; }
</style>
