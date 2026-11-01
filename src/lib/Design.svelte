<script>
  // Alles zum Aussehen an einer Stelle: Hell und Dunkel, Sprache, Schrift, Größe und die Effekte.
  import { t, je, sprache, setzeSprache } from './i18n.js'
  import { theme, setzeTheme } from './theme.js'
  import { darstellung, setzeSchrift, setzeGesamt, SCHRIFT, GESAMT } from './darstellung.js'
  import { effekte, setzeEffekt, setzeAlleEffekte } from './effekte.js'

  const SCHRIFT_NAME = { klein: t('Klein'), standard: t('Standard'), gross: t('Groß'), sehrgross: t('Sehr groß') }
  const GESAMT_NAME = { kompakt: t('Kompakt'), standard: t('Standard'), gross: t('Groß'), sehrgross: t('Sehr groß') }
  const EFFEKTE = [
    { id: 'verblassen', titel: je('Weiches Ausblenden', 'Soft fade'), text: je('Text verblasst beim Scrollen kurz vor dem Kopfbereich.', 'Text fades gently just before the header when you scroll.') },
    { id: 'kopf', titel: je('Kopf schrumpft', 'Shrinking header'), text: je('Der Titel wird beim Scrollen kleiner, das gibt mehr Platz zum Lesen.', 'The title gets smaller as you scroll, leaving more room to read.') },
    { id: 'rahmen', titel: je('Rahmen bei Verbindungen', 'Connection glow'), text: je('Ein schmaler Lichtrand zeigt, wenn die App GPS, Wetter, Warnungen oder Spotify abruft.', 'A thin edge of light shows when the app uses GPS, weather, warnings or Spotify.') },
    { id: 'stimmung', titel: je('Wetter-Stimmung', 'Weather mood'), text: je('Die Farben passen sich leicht dem Wetter und der Tageszeit an deinem Ort an.', 'Colours adapt slightly to the weather and time of day where you are.') },
    { id: 'hitze', titel: je('Hitze-Logo', 'Heat logo'), text: je('Ab 38 Grad flimmert der Schriftzug beim Start kurz wie Luft über heißem Asphalt.', 'From 38 degrees the logo shimmers briefly on start, like air over hot asphalt.') },
    { id: 'sonne', titel: je('Sonnenuntergang', 'Sunset'), text: je('30 Minuten vor Sonnenuntergang leuchtet der Rahmen einmal golden, mit kurzem Hinweis.', 'The edge glows gold once 30 minutes before sunset, with a short note.') },
  ]
  const alleAn = $derived(EFFEKTE.every((e) => $effekte[e.id]))
</script>

<div class="de">
  <section>
    <h2>{je('Erscheinungsbild', 'Appearance')}</h2>
    <div class="segment" role="group" aria-label={je('Erscheinungsbild', 'Appearance')}>
      {#each [['auto', t('Auto')], ['hell', t('Hell')], ['dunkel', t('Dunkel')]] as [m, l]}
        <button class:an={$theme === m} aria-pressed={$theme === m} onclick={() => setzeTheme(m)}>{l}</button>
      {/each}
    </div>
  </section>

  <section>
    <h2>{t('Sprache')}</h2>
    <div class="segment" role="group" aria-label={t('Sprache')}>
      {#each [['de', 'Deutsch'], ['en', 'English']] as [s, l]}
        <button class:an={sprache === s} aria-pressed={sprache === s} lang={s} onclick={() => setzeSprache(s)}>{l}</button>
      {/each}
    </div>
  </section>

  <section>
    <h2>{t('Schrift')}</h2>
    <div class="segment" role="group" aria-label={t('Schriftgröße')}>
      {#each SCHRIFT as s (s.id)}<button class:an={$darstellung.schrift === s.id} aria-pressed={$darstellung.schrift === s.id} onclick={() => setzeSchrift(s.id)}>{SCHRIFT_NAME[s.id]}</button>{/each}
    </div>
  </section>

  <section>
    <h2>{t('Größe')}</h2>
    <div class="segment" role="group" aria-label={t('Gesamtgröße')}>
      {#each GESAMT as s (s.id)}<button class:an={$darstellung.gesamt === s.id} aria-pressed={$darstellung.gesamt === s.id} onclick={() => setzeGesamt(s.id)}>{GESAMT_NAME[s.id]}</button>{/each}
    </div>
  </section>

  <section>
    <h2>{je('Effekte', 'Effects')}</h2>
    <label class="de-zeile de-alle"><span><b>{je('Alle Effekte', 'All effects')}</b></span><input type="checkbox" role="switch" checked={alleAn} onchange={(e) => setzeAlleEffekte(e.currentTarget.checked)} /></label>
    {#each EFFEKTE as e (e.id)}
      <label class="de-zeile"><span><b>{e.titel}</b><small>{e.text}</small></span><input type="checkbox" role="switch" checked={$effekte[e.id]} onchange={(x) => setzeEffekt(e.id, x.currentTarget.checked)} /></label>
    {/each}
  </section>
</div>

<style>
  .de { display: flex; flex-direction: column; gap: 18px; max-width: 560px; }
  section { display: flex; flex-direction: column; gap: 8px; }
  h2 { margin: 0; font-size: calc(15px * var(--schrift, 1)); color: var(--muted); }
  .segment { display: flex; }
  .segment > button { flex: 1; min-width: 0; min-height: 44px; }
  .de-zeile { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 52px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); cursor: pointer; }
  .de-alle { background: var(--flaeche-2); }
  .de-zeile span { display: flex; flex-direction: column; min-width: 0; }
  .de-zeile b { font-size: calc(15px * var(--schrift, 1)); }
  small { color: var(--muted); font-size: calc(13px * var(--schrift, 1)); }
  input { flex: none; width: 24px; height: 24px; accent-color: var(--brand); }
</style>
