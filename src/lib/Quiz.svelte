<script>
  import { t } from './i18n.js'
  import { frage } from './dialog.js'
  import { quizAntworten, setQuizAntwort, quizZuruecksetzen } from './userdata.js'
  import { auswerten } from './quiz.js'

  let { fragen = [], levels = [] } = $props()

  const ergebnis = $derived(auswerten($quizAntworten, fragen, levels))
  const buchstabe = ['A', 'B', 'C', 'D', 'E']

  function antwort(fId, i) {
    if ($quizAntworten[fId] != null) return // schon beantwortet → gesperrt
    setQuizAntwort(fId, i)
  }
</script>

<div class="quiz">
  <div class="summe" style={ergebnis.level ? `border-color:${'#d98a3d'}` : ''}>
    <div class="s-links">
      <span class="s-emoji">{ergebnis.level?.emoji}</span>
      <div>
        <div class="s-level">{t('Stufe {stufe}: {titel}', { stufe: ergebnis.level?.stufe, titel: ergebnis.level?.titel })}</div>
        <div class="s-zahlen">{t('{richtig}/{gesamt} richtig · {prozent}% · {beantwortet} beantwortet', { richtig: ergebnis.richtig, gesamt: ergebnis.gesamt, prozent: ergebnis.prozent, beantwortet: ergebnis.beantwortet })}</div>
      </div>
    </div>
    {#if ergebnis.beantwortet > 0}
      <button class="reset" onclick={async () => { if (await frage({ titel: t('Alle Antworten zurücksetzen?'), ja: t('Zurücksetzen'), gefahr: true })) quizZuruecksetzen() }}>{t('↻ Zurücksetzen')}</button>
    {/if}
  </div>
  {#if ergebnis.level}<p class="level-text">{ergebnis.level.text}</p>{/if}

  <div class="fragen">
    {#each fragen as f (f.id)}
      {@const gewaehlt = $quizAntworten[f.id]}
      {@const beantwortet = gewaehlt != null}
      <div class="frage" class:done={beantwortet}>
        <div class="f-kopf"><span class="tag">{t('Tag {tag}', { tag: f.tag })}</span><span class="thema">{f.thema}</span></div>
        <div class="f-text">{f.frage}</div>
        <div class="antworten">
          {#each f.antworten as a, i}
            <button class="antwort"
              class:richtig={beantwortet && i === f.richtig}
              class:falsch={beantwortet && i === gewaehlt && i !== f.richtig}
              disabled={beantwortet}
              onclick={() => antwort(f.id, i)}>
              <span class="a-b">{buchstabe[i]}</span>
              <span class="a-t">{a}</span>
              {#if beantwortet && i === f.richtig}<span class="a-ic">✅</span>
              {:else if beantwortet && i === gewaehlt}<span class="a-ic">❌</span>{/if}
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .summe { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    background: var(--card); border: 2px solid var(--line); border-radius: 12px; padding: 12px 16px; margin-bottom: 8px; box-shadow: var(--shadow); }
  .s-links { display: flex; align-items: center; gap: 12px; }
  .s-emoji { font-size: calc(34px * var(--schrift, 1)); }
  .s-level { font-size: calc(15px * var(--schrift, 1)); font-weight: 800; color: var(--brand-text); }
  .s-zahlen { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); margin-top: 2px; }
  .reset { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; padding: 7px 12px; border: 1px solid var(--line-stark); background: var(--card); color: var(--muted); border-radius: 8px; cursor: pointer; }
  .level-text { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); background: var(--warn-flaeche); border-left: 3px solid #d98a3d; padding: 10px 14px; border-radius: 0 8px 8px 0; margin: 0 0 16px; line-height: 1.55; }

  .fragen { display: flex; flex-direction: column; gap: 10px; }
  .frage { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
  .frage.done { background: var(--eingabe); }
  .f-kopf { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
  .tag { font-size: calc(12px * var(--schrift, 1)); font-weight: 800; color: #1f1408; background: var(--brand-2); padding: 1px 8px; border-radius: 8px; }
  .thema { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-weight: 600; }
  .f-text { font-size: calc(14.5px * var(--schrift, 1)); font-weight: 700; color: var(--ink); margin-bottom: 10px; }
  .antworten { display: flex; flex-direction: column; gap: 6px; }
  .antwort { display: flex; align-items: center; gap: 10px; text-align: left; width: 100%;
    font-size: calc(13.5px * var(--schrift, 1)); padding: 9px 12px; border: 1px solid var(--line-stark); background: var(--eingabe); border-radius: 8px; cursor: pointer; color: var(--ink); }
  .antwort:hover:not(:disabled) { background: var(--flaeche-2); }
  .antwort:disabled { cursor: default; }
  .antwort.richtig { background: var(--ok-flaeche); border-color: #2f7a63; color: #1f5c48; font-weight: 700; }
  .antwort.falsch { background: #fbeee7; border-color: #c0392b; color: #7a2317; }
  .a-b { flex: 0 0 20px; height: 20px; border-radius: 50%; background: #efe6d6; color: var(--btn-ink); font-size: calc(12px * var(--schrift, 1)); font-weight: 800; display: inline-flex; align-items: center; justify-content: center; }
  .antwort.richtig .a-b { background: #2f7a63; color: #fff; }
  .antwort.falsch .a-b { background: #c0392b; color: #fff; }
  .a-t { flex: 1; }
  .a-ic { font-size: calc(14px * var(--schrift, 1)); }
</style>
