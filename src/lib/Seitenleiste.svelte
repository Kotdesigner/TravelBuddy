<script>
  import { t, LOCALE, sprache, setzeSprache } from './i18n.js'
  // Seitenleiste am Mac (V4): dieselben fünf Bereiche wie unten am iPhone, darunter die
  // Unterpunkte des offenen Bereichs. Ersetzt die Leiste oben mit ihren Aufklappmenüs
  // und das ⋯-Dock unten rechts (Backup, Import, Design wohnen jetzt hier).
  import { online } from './netz.js'
  import { theme, setzeTheme } from './theme.js'
  import { darstellung, setzeSchrift, setzeGesamt, SCHRIFT, GESAMT } from './darstellung.js'
  const SCHRIFT_NAME = { klein: t('Klein'), standard: t('Standard'), gross: t('Groß'), sehrgross: t('Sehr groß') }
  const GESAMT_NAME = { kompakt: t('Kompakt'), standard: t('Standard'), gross: t('Groß'), sehrgross: t('Sehr groß') }
  import { syncZeiten } from './userdata.js'

  let { ansicht, unterpunkte = {}, geh = () => {}, onSuche = () => {}, onBackup = () => {}, onImport = () => {}, onHandbuch = () => {}, onEinfuehrung = () => {} } = $props()

  const BEREICHE = [
    { id: 'heute', label: t('Heute') },
    { id: 'plan', label: t('Plan') },
    { id: 'orte', label: t('Orte') },
    { id: 'logbuch', label: t('Logbuch') },
    { id: 'mehr', label: t('Mehr') },
  ]
  const gesichert = $derived($syncZeiten.gesichert ? new Date($syncZeiten.gesichert).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' }) : null)
</script>

<nav class="sl" aria-label={t('Hauptnavigation')}>
  <div class="sl-marke">{t('Western')}<span>{t('Australia')}</span></div>
  <button class="sl-suche" onclick={onSuche} aria-keyshortcuts="Meta+K /">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
    {t('Suchen')} <kbd>⌘K</kbd>
  </button>
  <ul class="sl-liste">
    {#each BEREICHE as b (b.id)}
      <li>
        <a href="#/{b.id}" class="sl-b" class:aktiv={ansicht.tab === b.id} aria-current={ansicht.tab === b.id ? 'page' : undefined}
          onclick={(e) => { e.preventDefault(); geh(b.id) }}>{b.label}</a>
        {#if ansicht.tab === b.id && unterpunkte[b.id]?.length}
          <ul class="sl-unter">
            {#each unterpunkte[b.id] as [pfad, label]}
              <li><a href="#/{pfad}" class:aktiv={ansicht.pfad === pfad || (pfad === b.id && !ansicht.unter) || ansicht.pfad.startsWith(pfad + '/')}
                onclick={(e) => { e.preventDefault(); geh(pfad) }}>{label}</a></li>
            {/each}
          </ul>
        {/if}
      </li>
    {/each}
  </ul>

  <div class="sl-fuss">
    <div class="sl-aktionen">
      <button onclick={onBackup}>{t('💾 Backup')}</button>
      <button onclick={onImport}>{t('📂 Import')}</button>
      <button onclick={onHandbuch}>{t('📖 Handbuch')}</button>
      <button onclick={onEinfuehrung}>{t('🧭 Einführung')}</button>
    </div>
    <div class="segment sl-theme" role="group" aria-label={t('Design')}>
      {#each [['auto', t('Auto')], ['hell', t('Hell')], ['dunkel', t('Dunkel')]] as [m, l]}
        <button class:an={$theme === m} aria-pressed={$theme === m} onclick={() => setzeTheme(m)}>{l}</button>
      {/each}
    </div>
    <!-- Sprache: Namen immer in der eigenen Sprache; ein Wechsel lädt die App neu (i18n.js) -->
    <div class="segment sl-sprache" role="group" aria-label={t('Sprache')}>
      {#each [['de', 'Deutsch'], ['en', 'English']] as [s, l]}
        <button class:an={sprache === s} aria-pressed={sprache === s} lang={s} onclick={() => setzeSprache(s)}>{l}</button>
      {/each}
    </div>
    <!-- V7: Schrift (nur Texte) und Gesamtgröße (alles), je Gerät gemerkt (darstellung.js) -->
    <div class="sl-groesse">
      <label>{t('Schrift')}<select value={$darstellung.schrift} onchange={(e) => setzeSchrift(e.currentTarget.value)}>{#each SCHRIFT as s (s.id)}<option value={s.id}>{SCHRIFT_NAME[s.id]}</option>{/each}</select></label>
      <label>{t('Größe')}<select value={$darstellung.gesamt} onchange={(e) => setzeGesamt(e.currentTarget.value)}>{#each GESAMT as s (s.id)}<option value={s.id}>{GESAMT_NAME[s.id]}</option>{/each}</select></label>
    </div>
    <p class="sl-status"><span class="sl-punkt" class:an={$online} aria-hidden="true"></span>{$online ? t('Online') : t('Offline')}{#if gesichert}&nbsp;{t('· Backup {gesichert}', { gesichert })}{/if}</p>
  </div>
</nav>

<style>
  .sl {
    position: sticky; top: 0; height: 100dvh; overflow: auto; width: 232px; flex: none;
    background: var(--flaeche); border-right: 1px solid var(--line); padding: 18px 12px 14px;
    display: flex; flex-direction: column; gap: 14px;
  }
  .sl-marke { font-family: 'Anton', Impact, sans-serif; font-size: calc(24px * var(--schrift, 1)); line-height: 1; letter-spacing: 0.5px; color: var(--ink); text-transform: uppercase; padding: 4px 8px; }
  .sl-marke span { display: block; color: var(--brand-text); }
  .sl-suche {
    display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 10px; border-radius: 10px;
    border: 1px solid var(--line-stark); background: var(--card); color: var(--muted); font-size: calc(14px * var(--schrift, 1)); cursor: pointer; text-align: left;
  }
  .sl-suche kbd { margin-left: auto; font-family: inherit; font-size: calc(12px * var(--schrift, 1)); border: 1px solid var(--line); border-radius: 5px; padding: 1px 5px; }
  .sl-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  .sl-b {
    display: flex; align-items: center; min-height: 40px; padding: 0 10px; border-radius: 10px;
    font-size: calc(15px * var(--schrift, 1)); font-weight: 700; color: var(--ink); text-decoration: none;
  }
  .sl-b:hover { background: var(--flaeche-2); }
  .sl-b.aktiv { background: var(--brand); color: #fff; }
  .sl-unter { list-style: none; margin: 4px 0 6px; padding: 0 0 0 12px; display: flex; flex-direction: column; gap: 1px; }
  .sl-unter a { display: flex; align-items: center; min-height: 34px; padding: 0 10px; border-radius: 8px; font-size: calc(14px * var(--schrift, 1)); color: var(--muted); text-decoration: none; }
  .sl-unter a:hover { background: var(--flaeche-2); color: var(--ink); }
  .sl-unter a.aktiv { color: var(--brand-text); font-weight: 700; background: var(--card); }
  .sl-fuss { margin-top: auto; display: flex; flex-direction: column; gap: 10px; }
  .sl-aktionen { display: flex; flex-direction: column; gap: 4px; }
  .sl-aktionen button { min-height: 36px; text-align: left; padding: 0 10px; border: none; background: none; border-radius: 8px; font-size: calc(14px * var(--schrift, 1)); color: var(--ink); cursor: pointer; }
  .sl-aktionen button:hover { background: var(--flaeche-2); }
  .sl-theme { display: grid; grid-template-columns: repeat(3, 1fr); }
  .sl-theme button { padding: 6px 4px; min-height: 34px; font-size: calc(12.5px * var(--schrift, 1)); }
  .sl-sprache { display: grid; grid-template-columns: repeat(2, 1fr); margin-top: 6px; }
  .sl-sprache button { padding: 6px 4px; min-height: 34px; font-size: calc(12.5px * var(--schrift, 1)); }
  .sl-groesse { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .sl-groesse label { display: flex; flex-direction: column; gap: 2px; font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .sl-groesse select { min-height: 34px; padding: 4px 6px; font-size: calc(13px * var(--schrift, 1)); border: 1px solid var(--line); border-radius: 8px; background: var(--card); color: var(--ink); }
  .sl-status { margin: 0; font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); display: flex; align-items: center; gap: 6px; padding: 0 6px; }
  .sl-punkt { width: 8px; height: 8px; border-radius: 50%; background: var(--line-stark); }
  .sl-punkt.an { background: var(--ok); }
</style>
