<script>
  import { neueGruppe, gruppeVon } from './mehr-gruppen.js'
  import LogoAnimiert from './LogoAnimiert.svelte'
  import { t, LOCALE } from './i18n.js'
  // Seitenleiste am Mac: dieselben fünf Bereiche wie unten am iPhone, darunter die
  // Unterpunkte des offenen Bereichs. Ersetzt die Leiste oben mit ihren Aufklappmenüs
  // und das ⋯-Dock unten rechts (Backup, Import, Design wohnen jetzt hier).
  import { online } from './netz.js'
  import { testreiseAn, testreiseKnopfZeigen } from './testreise-dienst.js'
  import { einrichtenZeigen } from './install.js'
  import { je } from './i18n.js'
  import { syncZeiten } from './userdata.js'

  let { ansicht, unterpunkte = {}, geh = () => {}, onSuche = () => {}, onBackupImport = () => {}, onHandbuch = () => {}, onDesign = () => {}, onEinrichten = () => {}, onZuruecksetzen = () => {}, onEinfuehrung = () => {}, onTestreise = () => {} } = $props()

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
  <!-- App-Logo, animiert: die Kugel dreht sich, die Route fließt, alle 90 Sekunden fährt sie zweimal um die Kugel -->
  <div class="sl-logo"><LogoAnimiert /></div>
  <div class="sl-marke">Travel<span>Buddy</span></div>
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
            {#each unterpunkte[b.id] as [pfad, label], i}
              {#if b.id === 'mehr' && (i === 0 || neueGruppe(unterpunkte.mehr, i, (e) => e[0]))}<li class="sl-gruppe" aria-hidden="true">{je(...gruppeVon(pfad).titel)}</li>{/if}
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
      <button onclick={onBackupImport}>💾 {je('Backup & Import', 'Backup & import')}</button>
      <button onclick={onHandbuch}>{t('📖 Handbuch')}</button>
      <button onclick={onDesign}>🎨 {t('Design')}</button>
      <button onclick={onEinfuehrung}>{t('🧭 Einführung')}</button>
      {#if $einrichtenZeigen}<button onclick={onEinrichten}>📲 {je('App einrichten', 'Set up the app')}</button>{/if}
      {#if $testreiseKnopfZeigen}<button onclick={onTestreise}>🧪 {$testreiseAn ? t('Testreise beenden') : t('Testreise')}</button>{/if}
      <button class="sl-gefahr" onclick={onZuruecksetzen}>↩️ {je('App zurücksetzen', 'Reset the app')}</button>
    </div>
    <p class="sl-status"><span class="sl-punkt" class:an={$online} aria-hidden="true"></span>{$online ? t('Online') : t('Offline')}{#if gesichert}&nbsp;{t('· Backup {gesichert}', { gesichert })}{/if}</p>
  </div>
</nav>

<style>
  .sl-gruppe { padding: 10px 10px 2px; font-size: calc(11.5px * var(--schrift, 1)); font-weight: 800; color: var(--muted); letter-spacing: 0.3px; }
  .sl-gefahr { color: var(--danger-text) !important; }
  .sl {
    position: sticky; top: 0; height: 100dvh; overflow: auto; width: 232px; flex: none;
    background: var(--flaeche); border-right: 1px solid var(--line); padding: 18px 12px 14px max(12px, env(safe-area-inset-left, 0px));
    display: flex; flex-direction: column; gap: 14px;
  }
  /* Scrollbalken der Seitenleiste: schmal und unsichtbar, erst sichtbar, wenn die Maus über der Leiste ist
     (oder die Tastatur darin steht). So stört er nicht, ist aber da, wenn man ihn braucht. */
  .sl { scrollbar-width: thin; scrollbar-color: transparent transparent; }
  .sl:hover, .sl:focus-within { scrollbar-color: color-mix(in srgb, var(--muted) 40%, transparent) transparent; }
  .sl::-webkit-scrollbar { width: 6px; }
  .sl::-webkit-scrollbar-track { background: transparent; }
  .sl::-webkit-scrollbar-thumb { background: transparent; border-radius: 3px; }
  .sl:hover::-webkit-scrollbar-thumb, .sl:focus-within::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--muted) 40%, transparent); }
  .sl-marke { font-family: 'Anton', Impact, sans-serif; font-size: calc(30px * var(--schrift, 1)); line-height: 1.1; letter-spacing: 0.6px; color: var(--ink); text-align: center; white-space: nowrap; padding: 4px 0 10px; }
  .sl-marke span { color: var(--brand-text); }
  /* Logo über dem Schriftzug, wie das App-Symbol */
  .sl-logo { display: flex; justify-content: center; margin: 2px 0 -8px; }
  /* iPhone quer: wenig Höhe, dort lieber Platz für die Bereiche */
  @media (max-height: 520px) { .sl-logo { display: none; } }
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
  .sl-status { margin: 0; font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); display: flex; align-items: center; gap: 6px; padding: 0 6px; }
  .sl-punkt { width: 8px; height: 8px; border-radius: 50%; background: var(--line-stark); }
  .sl-punkt.an { background: var(--ok); }
</style>
